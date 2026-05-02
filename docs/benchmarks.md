# Benchmark engine: checks, mapping, and evaluation

We ship eight checks aligned to **CIS Controls v8** and **CIS Cisco IOS Benchmark**. This document covers what each check does, why it matters, the exact algorithm, and how to add more.

## Architecture

```
parsers (iptables / aws-sg / cisco) ──► FirewallRuleSet[]  ─┐
                                                            ├──► evaluate() ──► BenchmarkResult[]
discovery (TCP probe + banners)      ──► Device[]          ─┘
```

* `app/benchmarks/base.py` — abstract `BenchmarkCheck` + `CheckMetadata` (id, title, severity, CIS reference, remediation language).
* `app/benchmarks/checks/cis_net_*.py` — one file per check, each implementing `evaluate(devices, rulesets) → list[BenchmarkResult]`.
* `app/benchmarks/engine.py` — `registered_checks()` returns the canonical instances; `evaluate()` runs every check and returns a flat list of results.
* `app/benchmarks/_helpers.py` — small shared utilities (`is_world_open`, `port_overlaps`, sensitive-port table).

A check can return one row **per device** *and* one row **per ruleset**, with `target_kind` discriminating. This is deliberate — a customer with five SGs wants to know which SG is failing, not just "something failed."

## The eight checks

| ID | Title | CIS Reference | Severity |
|----|-------|--------------|----------|
| `CIS-NET-001` | No insecure management protocols exposed | CIS Controls v8 — 4.1, 4.8 | high |
| `CIS-NET-002` | SSH access restricted to a management subnet | CIS Cisco IOS 1.1.4 / Controls v8 4.4 | high |
| `CIS-NET-003` | No default or weak SNMP community strings | CIS Cisco IOS 2.1.2 | high |
| `CIS-NET-004` | No internet ingress to sensitive ports | CIS Controls v8 — 4.4 | critical |
| `CIS-NET-005` | Egress traffic is filtered (default-deny outbound) | CIS Controls v8 — 13.10 | medium |
| `CIS-NET-006` | Logging enabled and pointed at a remote collector | CIS Controls v8 — 8.2, 8.5 | medium |
| `CIS-NET-007` | Stateful inspection enabled (RELATED,ESTABLISHED rule) | CIS Controls v8 — 4.5 | low |
| `CIS-NET-008` | No legacy / insecure protocol banners advertised | CIS Controls v8 — 3.10 | medium |

Below: what each check evaluates, the algorithm, the false-positive guards we wrote.

---

### CIS-NET-001 — No insecure management protocols exposed

**What it catches:** Telnet (23), FTP (21), HTTP-as-management (80 on a router), SNMPv1/v2c (161), rlogin (513), rsh (514) — exposed to the network.

**Inputs:** Devices (port banners) **and** rulesets (allow rules).

**Algorithm:**
1. **Per device:** if any `OpenPort.port` is in the insecure-services dictionary, fail with `"port 23/tcp telnet — banner: 'Telnet ready.'"`.
2. **Per ruleset:** for each `direction=ingress`, `action=allow` rule, check whether `port_range` *specifically* matches an insecure port. Skip rules whose `port_range="any"` (those are loopback/state rules — flagging them would be a false positive). Skip rules whose `rule_id` starts with `snmp-community-` (those are SNMP community declarations evaluated by CIS-NET-003).

**Why the "skip port_range=any" guard:** iptables hardened fixtures contain `-A INPUT -i lo -j ACCEPT` (no `--dport`, port_range="any"). Without the guard, that rule would falsely match every insecure port the helper iterates over.

**Evidence example:**
```
INPUT-4: allows telnet from 0.0.0.0/0 → -A INPUT -p tcp -m tcp --dport 23 -s 0.0.0.0/0 -j ACCEPT
```

---

### CIS-NET-002 — SSH restricted to a management subnet

**What it catches:** `0.0.0.0/0` ingress to port 22, OR Cisco VTY lines without an `access-class` ACL.

**Inputs:** Rulesets only.

**Algorithm:**
1. For each ruleset, find rules where `direction=ingress`, `action=allow`, that *specifically* address SSH (protocol `ssh` OR (protocol `tcp`/`any` with port_range matching 22, but `port_range != "any"`)).
2. If none → `not_applicable`.
3. If any have `is_world_open(source)` → `fail` with the offending source.
4. Otherwise → `pass`.

**Cisco VTY handling:** The Cisco parser turns `transport input ssh` into a `vty-ssh` rule. If `access-class MGMT-IN in` is also present, the parser resolves the ACL's source CIDRs (`permit 10.10.0.0 0.0.0.255` → `10.10.0.0/24`) and stamps the rule's `source` accordingly. Without an access-class, source defaults to `any` and the check fails.

**False-positive guards:**
- `port_range="any"` is excluded so loopback/state rules don't false-trigger.
- Single-host CIDRs like `0.0.0.1/32` are correctly considered private/global by `ipaddress.ip_network` rather than relying on string matching.

---

### CIS-NET-003 — No default or weak SNMP community strings

**What it catches:** `snmp-server community public RO` and friends — Cisco-only.

**Inputs:** Cisco rulesets.

**Algorithm:** For every rule with `rule_id` prefixed `snmp-community-<name>`, fail if `<name>.lower()` is in `{"public", "private", "community", "snmp", "manager"}`.

**Why parser produces these rules:** The Cisco parser materialises each `snmp-server community` line as a synthetic rule with `protocol="snmp"`, `port_range="161"`, `source="any"`. This makes them visible in the firewall-rules table and CIS-NET-001 + CIS-NET-003 can both look at the same data without re-parsing.

---

### CIS-NET-004 — No internet ingress to sensitive ports

**What it catches:** `0.0.0.0/0` → ports 22 (SSH), 23 (Telnet), 445 (SMB), 3306 (MySQL), 3389 (RDP), 5432 (Postgres). The "ransomware shopping list."

**Inputs:** Rulesets.

**Algorithm:**
1. For each ingress allow rule with `is_world_open(source)`, check whether `port_range` overlaps any sensitive port.
2. Skip `port_range="any"` for the same reason as NET-001.

**Severity rationale:** marked `critical` because every public ransomware incident in 2023-2024 the public-domain reports name involved at least one of these ports being internet-reachable.

---

### CIS-NET-005 — Egress filtering

**What it catches:** "default allow outbound" — an explicit allow-all `0.0.0.0/0` egress on AWS SGs, or a missing default-deny on an iptables OUTPUT chain.

**Inputs:** Rulesets.

**Algorithm:** branched by source type because the semantics differ:

- **iptables:** `pass` if the OUTPUT chain has a synthetic `OUTPUT-default` rule with `action=default-deny`. `fail` otherwise.
- **AWS SG:** SGs are implicit-deny, so the failure mode is an *explicit* `0.0.0.0/0` allow-all egress. We look for an egress allow with `protocol in {"any", "-1"}`, `destination=0.0.0.0/0`, `port_range="any"`. Presence → fail; absence → pass.
- **Cisco-IOS:** `not_applicable`. Cisco egress filtering is typically expressed as outbound ACLs on specific interfaces; covering this properly needs interface→ACL graph traversal which we haven't built yet.

---

### CIS-NET-006 — Logging to a remote collector

**What it catches:** Devices not forwarding logs centrally.

**Inputs:** Rulesets (metadata only).

**Algorithm:**
- **Cisco:** parser stores `logging_enabled` and `logging_host` in `metadata`. Pass iff both are set; fail with explanation otherwise.
- **AWS SG:** there's no per-SG logging; we look for a `tag:FlowLogs=true` (informational signal). Absence → fail with a hint to enable VPC Flow Logs.
- **iptables:** not implemented — Linux logging is a host-level concern, not a netfilter one.

**Limitation:** This check is the weakest of the eight. A more robust version would call CloudWatch Logs / VPC Flow Log APIs to confirm logs are actually being delivered. Marked as a planned upgrade in `design-decisions.md`.

---

### CIS-NET-007 — Stateful inspection enabled

**What it catches:** iptables firewalls without an early `state RELATED,ESTABLISHED` accept rule, which means return traffic for legitimate outbound connections will be silently dropped or — in some configurations — fall through to a more permissive accept and bypass intent.

**Inputs:** iptables rulesets.

**Algorithm:** Look for any rule whose `raw` line contains `state RELATED,ESTABLISHED`. Found → pass; otherwise → fail.

**Severity rationale:** `low` because the failure mode here is usually "things mysteriously break" rather than "we got owned." Important to flag for hygiene, less important than the NET-001/004 set.

---

### CIS-NET-008 — Legacy / insecure protocol banners

**What it catches:** Banners advertising deprecated cryptography or vulnerable software.

**Inputs:** Devices (banners only).

**Algorithm:** For each `OpenPort.service.banner`, search for any of these substrings:

```python
"SSLv2", "SSLv3", "TLSv1.0", "TLSv1.1",
"Server: Apache/1.", "Server: Apache/2.0",
"Server: lighttpd/1.4.0",
"OpenSSH_5.",
```

Found → fail with `"port 22: banner 'OpenSSH_5.3' contains 'OpenSSH_5.'"`. Not exhaustive — easy to extend, low false-positive rate at the cost of recall.

---

## How a single scan flows through the engine

```python
# in orchestrator.run_in_app_scan / api.ingest
results = evaluate(devices, rulesets)   # list[BenchmarkResult]
store.replace_results(results)           # idempotent: clears + re-writes
```

`evaluate()` is intentionally not parallelised — checks are pure functions of bounded inputs and the engine completes in milliseconds for realistic input sizes (we measured ~3 ms for the bundled fixtures). Adding parallelism would buy nothing and complicate test determinism.

`replace_results` is full-table replace, not append. Rationale: `BenchmarkResult.id = f"{target_id}:{check_id}"` collides per scan, so an upsert would only ever return the latest. We commit to "the dashboard shows the most recent posture state," which is what users expect.

## Adding a new check

1. Create `backend/app/benchmarks/checks/cis_net_009_my_check.py`.
2. Subclass `BenchmarkCheck`, populate `meta = CheckMetadata(...)`, implement `evaluate(devices, rulesets)`.
3. Add the new instance to `registered_checks()` in `engine.py`.
4. Add a fixture-based test in `backend/tests/test_benchmarks.py`.
5. The dashboard, the `/cis-results/catalog` endpoint, and the PDF report all pick it up automatically — `registered_checks()` is the single source of truth.

## Why "evidence" is a list of strings, not a structured object

Every check produces evidence lines like:

```python
"in-1-cidr-1: SSH (port 22) open to the internet — {\"IpProtocol\":\"tcp\",...}"
```

We considered evidence as a typed object (`offending_rule_id`, `port`, `cidr`, ...). We chose strings because:

- Renderers (PDF, dashboard, CLI) all just need to display them.
- Adding a new check shouldn't require schema changes to a shared `Evidence` model.
- Auditors and ticket reviewers want copy-pasteable text, not JSON.

The trade-off is that programmatic consumers (a SOAR playbook, say) have to text-parse the evidence to extract specific fields. We consider that acceptable for the MVP; if it becomes a real need, evidence can become `list[Evidence | str]` without breaking existing code.
