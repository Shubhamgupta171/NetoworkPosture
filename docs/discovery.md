# Discovery: how the scan actually works

This document explains the scanner's discovery pipeline, the trade-offs we made, and how every category of "host doesn't answer" is handled.

## The two scanning paths

There are two parallel implementations — same contract, different deployment shapes:

| Path | Module | When it's used |
|------|--------|---------------|
| **CLI scanner** | `scanner/src/nps_scanner/discovery.py` | An operator runs `python -m nps_scanner scan ...` from a host with reach into the network. Sends results to the backend over HTTPS. |
| **In-app scanner** | `backend/app/services/discovery.py` | The dashboard form (`POST /scans`) runs discovery inside the FastAPI/Lambda process for small target lists (≤ 16). Useful for demos and self-contained deployments. |

The CLI is the canonical implementation for production sweeps; the in-app path is bounded so a hostile or careless user cannot turn the backend into an outbound port-scanner.

## Phases of a single host scan

```
            ┌─────────────────┐
target ───► │ normalise       │  expand CIDRs, resolve hostnames, refuse public IPs
            └────────┬────────┘
                     ▼
            ┌─────────────────┐
            │ TCP connect     │  ~12 well-known ports, 0.5s timeout each, in a thread pool
            └────────┬────────┘
                     ▼
            ┌─────────────────┐
            │ banner grab     │  bounded to 256 bytes, first newline, opportunistic
            └────────┬────────┘
                     ▼
            ┌─────────────────┐
            │ ICMP fallback   │  if no TCP ports answered, try a single ping
            └────────┬────────┘
                     ▼
            ┌─────────────────┐
            │ enrich          │  hostname (rDNS) + MAC (system ARP cache, local subnet only)
            └────────┬────────┘
                     ▼
                  Device
```

### 1 · Target normalisation

`normalise_targets()` accepts a heterogeneous list:

- **CIDRs** (`10.0.0.0/24`) — expanded with `ipaddress.ip_network(strict=False).hosts()`. `/30` returns 2 hosts, `/32` returns 1.
- **Single IPv4/IPv6 addresses** — passed through.
- **Hostnames or URLs** (`example.com`, `https://example.com/path`) — `_strip_scheme()` removes any `https://` / `http://` / `ssh://` prefix and any path / port suffix, then `socket.gethostbyname()` resolves to one IPv4. Resolution failures raise `TargetRejected` with a friendly message.

Public-IP guard: every resolved IP is checked with `ip.is_private or ip.is_loopback or ip.is_link_local`. Non-private IPs are rejected unless `allow_public=True` is explicitly set. The CLI also requires the operator to type `I OWN THIS NETWORK` interactively — a typo of the literal string aborts.

Cap: `MAX_TARGETS = 16` for the in-app scanner. The CLI is unbounded but defaults to a single IP if none specified.

### 2 · TCP connect probing

We use `socket.create_connection((ip, port), timeout=0.5)` rather than raw SYN packets. Trade-off:

| Approach | Pros | Cons |
|---------|-----|-----|
| **TCP connect (chosen)** | No root/CAP_NET_RAW needed, works on macOS/Linux/Windows, identical behaviour everywhere, kernel handles retransmits | The remote sees a complete handshake → could appear in their access logs |
| Raw SYN scan | Lower footprint, slightly faster, doesn't show as a "connection" | Requires elevated privileges, complex retry logic, OS-specific code |

For a posture tool meant to be safe to run on a laptop, the trade was an easy one. If you need stealthier scanning, run `nmap -sS` separately and pipe the JSON into `POST /ingest`.

The default port list is small and intentional:

```python
DEFAULT_PORTS = (22, 23, 53, 80, 443, 445, 3306, 3389, 5432, 8080, 8443)
```

These are the ports that drive the CIS checks (insecure mgmt protocols, sensitive databases, web tier). The CLI accepts `--ports` for ad-hoc widening; the in-app scanner does not, by design.

Concurrency: a `ThreadPoolExecutor` with `max_workers=min(8, len(targets))` for hosts, and `max_workers=32` for ports within a host (CLI). The in-app version uses lower concurrency to play nicely inside Lambda.

### 3 · Banner grabbing

If a port answers, we attempt one polite read:

```python
if port in {80, 8080, 8443}:
    sock.sendall(b"HEAD / HTTP/1.0\r\nHost: probe\r\n\r\n")
data = sock.recv(256)
```

- For HTTP-ish ports we send a minimal `HEAD /` request to elicit a `Server:` header.
- For everything else we just `recv()`. SSH, SMTP, FTP, telnet daemons all push their banner first.
- We never send credentials, never reuse connections, and never re-probe the same port.

The captured banner is **truncated to 256 bytes** and **clipped at the first newline** before storage:

```python
data.decode(errors="replace").strip().splitlines()[0][:256]
```

This is the third-party-data hardening: a malicious banner that's a megabyte of carefully-crafted control characters can't blow up our log line, escape JSON encoding, or cause downstream rendering issues.

### 4 · ICMP fallback (host liveness)

If **no** TCP port answered, we shell out to the system `ping`:

```python
subprocess.call(["ping", "-c", "1", "-W", "1", ip], ...)
```

This catches hosts that:
- Are alive but firewall every port we probe (very common for hardened internal nodes).
- Run only services on ports outside our default list.

ICMP-only hosts are stored with `discovery_method="icmp"` and an empty `open_ports` list — they still count as "discovered" in the dashboard, and the CIS device-level checks (CIS-NET-001, CIS-NET-008) will simply find nothing to flag.

If both TCP probes and ICMP fail, the host is dropped from the result set rather than being reported as "unreachable." This is a conscious trade — a result set padded with hundreds of `unreachable: true` rows for a `/24` scan would drown out the useful findings. For inventory tools that *do* need the negative confirmation, the CLI exposes `scan_host()` directly.

### 5 · Enrichment

For each surviving host we add:

- **Hostname**: `socket.gethostbyaddr(ip)` — a reverse DNS lookup. Failures (NXDOMAIN, timeout) yield `None`.
- **MAC address**: Best-effort parsing of `arp -n <ip>` output. Only useful when the scanner shares an L2 segment with the target. We never craft ARP packets ourselves; we just read what the OS already knows.
- **`mac_vendor`**: Reserved field for an OUI lookup — not implemented yet, marked as a future improvement in `design-decisions.md`.

## How non-responsive hosts are handled

| Failure mode | What we do | Where it surfaces |
|------|------|------|
| Hostname doesn't resolve | `TargetRejected` with the unresolved hostname in the message | Dashboard form shows a red error pill; CLI prints to stderr and exits non-zero |
| TCP `connect()` times out | The port is silently skipped after 0.5 s | Port simply doesn't appear in `open_ports` |
| TCP `connect()` returns RST | Port is closed → not added to `open_ports` | Port simply doesn't appear |
| Banner read times out / returns empty | `service.banner` is `None`; `service.name` still set from port number | Dashboard shows port + service name, no banner snippet |
| Banner contains binary garbage | `decode(errors="replace")` substitutes `?` for non-decodable bytes; first newline + 256-byte cap apply | Truncated, safe rendering |
| ICMP unavailable (no `ping` binary) | `subprocess.call` raises `FileNotFoundError`, caught and treated as "ping failed" | Host dropped if no TCP ports answered |
| Reverse DNS times out | `socket.gethostbyaddr` raises `OSError`/`herror` → caught, `hostname=None` | Hostname column shows `—` |
| ARP cache empty | `arp -n` produces no MAC line → returns `None` | MAC column shows `—` |
| Host returns a flood of bytes | `recv(256)` reads at most 256, then we `splitlines()[0]` | Bounded memory, single log line |
| Whole network blackholes us | All TCP times out, all ICMP times out → 0 hosts in result | Dashboard shows the empty-state with a hint to check connectivity |
| Concurrent probes on different hosts | Each runs in its own thread with its own socket; failures are isolated | One unreachable subnet doesn't slow another |

## Concurrency, timeouts, and budget

- Per-port connect timeout: **0.5 s** (in-app) / **0.6 s** (CLI).
- Per-port banner timeout: **0.8 s** (in-app) / **1.0 s** (CLI).
- Per-host worst case: ~`(ports × 1.4 s) ÷ port-concurrency`. With 11 ports and concurrency 8, that's ~2 s per host worst-case; in practice <1 s for reachable hosts and ~5 s for hosts where every port times out.
- ICMP fallback adds at most 1 s per unreachable host.
- API Gateway gives us 29 s; Lambda gives us 15 s by default. The 16-target cap and tight timeouts keep us comfortably inside both.

## What we explicitly do **not** do

- **No credential probing.** No basic auth, no SSH login, no SMB enumeration. Banner-grab only.
- **No vulnerability fingerprinting.** We capture banners; we don't compare them against CVE databases. CIS-NET-008 makes a small exception for legacy TLS / OpenSSH 5.x banner detection — clearly documented.
- **No UDP probing** beyond what the OS-level `ping` does. UDP scans are unreliable without raw sockets and are out of scope for the MVP.
- **No host operating-system fingerprinting.** TCP/IP stack fingerprinting requires raw packet manipulation; out of scope.
- **No traffic generation against the target's neighbours.** We probe exactly the IPs you give us — no broadcast, no route discovery.

## Pluggable upgrades

The discovery layer is pure functions returning Pydantic `Device` objects, so swapping in heavier tooling is straightforward:

- **`nmap` integration** — wrap `nmap -sV --script vulners` and reshape the XML/JSON into `Device` + `OpenPort` + `DeviceService`. Same downstream pipeline.
- **AWS-native discovery** — replace the TCP probe entirely with `ec2:DescribeInstances` + `ec2:DescribeNetworkInterfaces`, no actual packets sent.
- **Active Directory / Intune** — pull the inventory from the directory, enrich with SG / firewall data later.

The CIS engine doesn't care where `Device` came from, so substitutions are local.
