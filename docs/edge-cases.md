# Edge cases & enterprise hardening

A catalog of everything we considered going wrong, and what the system does about it. Organised by layer so it's easy to spot what your own deployment may need to extend.

## 1 · Input validation

| Edge case | Handling |
|----------|----------|
| Empty target list | `TargetRejected("No valid targets supplied.")` → 400 with friendly detail |
| Hostname with `https://` and a path (`https://example.com/auth?x=1`) | `_strip_scheme()` removes the scheme and everything after the first `/` or `:` |
| Hostname that doesn't resolve | `socket.gaierror` caught, raised as `TargetRejected` with the original input + DNS error message |
| Mixed IPv4 and IPv6 input | Both are accepted; IPv6 link-local is treated as private; IPv6 banner-grab works on platforms with dual-stack |
| Public IP without `allow_public` | `TargetRejected` with explicit hint to enable the toggle |
| Scanning own loopback | Always allowed (loopback is private) |
| 17+ targets in one in-app scan | `TargetRejected` with an explanation pointing the user at the CLI for larger sweeps |
| Schedule with `interval_minutes=5` | Pydantic 422 with `ge=15` constraint message |
| Schedule with `interval_minutes=20000` (>7 days) | Pydantic 422 with `le=10080` constraint |
| Schedule name longer than 80 chars | Pydantic 422 with `max_length=80` |
| Sample fixture id doesn't exist | Logged warning, ruleset skipped, scan continues — does not 500 |
| Malformed firewall config file | Parser tolerates unknown lines and produces what it can; doesn't crash |
| Empty firewall config file | Returns an empty ruleset; checks see no rules and produce `not_applicable` for that source |

## 2 · Network failures during a scan

| Edge case | Handling |
|----------|----------|
| Target firewalled — every TCP probe times out | Each port silently dropped after 0.5 s; ICMP fallback attempted; if ICMP also fails, host dropped from result |
| Target accepts connection but never sends a banner | `recv()` times out after 0.8 s, banner stored as `None`, port still listed |
| Target sends 1 MB of binary data | `recv(256)` reads at most 256 bytes; first newline + 256-byte cap applied; safe to log/render |
| Target closes connection mid-banner | Partial bytes captured if any were received before the close; banner truncated as usual |
| Reverse DNS lookup hangs | `socket.gethostbyaddr` honours the system resolver timeout; we catch any failure and store `hostname=None` |
| ARP cache empty / `arp -n` not available | `subprocess.CalledProcessError`/`FileNotFoundError` caught → MAC stored as `None` |
| `ping` binary missing (slim container) | `FileNotFoundError` caught → host gets dropped if no TCP ports answered |
| Target's banner contains UTF-8 invalid bytes | `decode(errors="replace")` substitutes `?` glyphs |
| Concurrent probes blow the file-descriptor limit | Thread-pool capped at 32 workers per host, 8 hosts at a time → ≤256 sockets at peak |
| Target deliberately sends malformed HTTP back | We're not parsing HTTP — we're treating the response as opaque text. No header parser to confuse |
| Banner contains the literal string `</script>` | We never inject banners into HTML directly — React escapes by default; CSV writer escapes via `csv.writer` |

## 3 · Backend failures

| Edge case | Handling |
|----------|----------|
| Storage layer raises during ingestion | Exception bubbles to FastAPI → 500 with generic message; full traceback in CloudWatch / stderr |
| FileStore JSON file is corrupt | `JSONDecodeError` caught at construction; store starts empty rather than crashing |
| FileStore disk full | `tmp.write_text()` raises `OSError` → propagates to 500. Recommendation: monitor disk on the host; or switch to DynamoDB |
| DynamoDB throttled | boto3 raises `ProvisionedThroughputExceededException` → 500. PAY_PER_REQUEST mostly avoids this; for sustained burst, set on-demand or provisioned with auto-scaling |
| DynamoDB SSL handshake fails | boto3 retries automatically; ultimate failure → 500 |
| Scheduler tick runs while previous scan is still running | Each schedule's tick runs in a worker thread; tick loop doesn't block on completion. Concurrent ticks of *the same schedule* aren't currently locked — fine because intervals are minimum 15 min and a scan completes in seconds |
| Scheduler runs a now-deleted schedule | Tick re-fetches the list each time; deleted schedules are gone before the next tick |
| Schedule `next_run_at` falls in the past after a long downtime | Tick fires it immediately; subsequent runs advance from `now` not from the missed time, so we don't backlog |
| Two FastAPI processes on the same store | FileStore locks per-instance only; concurrent writes can race. Production should use DynamoDB (atomic per-item updates) |

## 4 · Authentication & authorisation

| Edge case | Handling |
|----------|----------|
| Missing `X-Api-Key` | 401 with `WWW-Authenticate: ApiKey` header |
| Wrong `X-Api-Key` | Same 401, no leak about whether the key prefix was right (constant-time compare) |
| Key rotated mid-session in dashboard | Next API call returns 401 → user reloads with new `VITE_API_KEY` |
| API key in URL (e.g., shared download link) | We refuse to accept the key in the query string; only the header is checked |
| Lambda cold start: env var unset | Pydantic settings raise on missing required field → Lambda init fails fast (visible in CloudWatch) rather than serving with `dev-insecure-key` |
| Logging of secrets | Structured logger uses an explicit `extra={...}` dict; the `Authorization`/`X-Api-Key` header is never propagated into log context |
| Secrets Manager rotation | Lambda reads the secret value at cold start; rotation requires a Lambda redeploy or a custom rotation handler |

## 5 · Frontend failures

| Edge case | Handling |
|----------|----------|
| Backend offline | Header status pill turns red ("backend offline"); per-component queries surface `error` state with the message |
| 401 from backend | `request<T>` throws `401 Unauthorized — Missing or invalid X-Api-Key` → component shows error inline |
| Slow API response | React Query keeps showing the previous data (`stale`); a loading spinner appears next to the action that triggered the refetch |
| User triggers a download then closes the tab | `URL.revokeObjectURL` runs on the `a.click()` cleanup; orphaned blob would be garbage-collected anyway |
| User disables JavaScript | Page is a single empty `<div id="root">` — graceful "this app needs JavaScript" placeholder is a planned improvement |
| Large dashboard on a 4G phone | Bundle is 184 KB gzipped; first paint <2 s on a throttled 4G simulation |
| Theme localStorage write fails (private mode quota) | `setItem` throw is wrapped — the in-memory state still updates, theme just doesn't persist |
| User opens the same scan id in two tabs and downloads | Both download independently; backend has no per-scan lock, but the underlying data is read-only |
| Hash-link to a missing section (`#scan-foo`) | Anchor link no-ops; user lands at the top |
| Browser without `backdrop-filter` support | Glass surfaces fall back to a flat `surface-1/0.85` background — still readable, just less premium |

## 6 · Concurrency & state

| Edge case | Handling |
|----------|----------|
| Scan request arrives while another scan is mid-flight | Both run; the second to finish "wins" the `replace_results` race. Acceptable because the engine is deterministic against the union of stored data |
| User pauses a schedule mid-tick | The tick that's already running completes and writes its update; the next tick sees `enabled=False` and skips |
| User deletes a schedule mid-tick | Same — write happens, then the next tick has nothing to fetch |
| Scheduler tick takes longer than the tick interval | Next tick runs immediately when the previous returns; we never `sleep(30)` while a tick is hung |
| Two users edit the same schedule | Last-write-wins; PATCH is a `model_copy(update=...)` so unspecified fields are preserved |
| Process killed mid-write to FileStore | Atomic `.tmp` → rename guarantees the file is either old or new, never half-written |
| Process killed during DynamoDB batch write | DynamoDB write atomicity is per-item; partial-batch on shutdown leaves some items missing — re-running the scan re-upserts |

## 7 · Security boundaries we enforce

- Public-IP scan refusal — discussed throughout.
- Banner truncation — bounded memory and bounded log lines.
- No credential probing — read-only by construction.
- API key never logged.
- HTTPS-only API Gateway in production.
- DynamoDB SSE + PITR.
- Lambda IAM scoped to one table.
- No secrets in source — `API_KEY` defaults to a fail-safe `dev-insecure-key` only for local dev.

## 8 · What we do **not** handle today

These are real edge cases that production deployments should consider before going live.

- **DDoS on the API.** Throttling is at API Gateway's defaults. A determined attacker with a valid key could exhaust scheduler capacity. Mitigation: WAF + per-key rate limits.
- **CSV injection in spreadsheet apps.** Our CSV download is consumed mostly by data tools. Excel users opening untrusted banners as CSV could execute formulas (`=cmd|...`). Add a CSV cell sanitiser if Excel is in your audience.
- **PDF rendering in older readers.** reportlab targets PDF 1.4. Tested in modern Chrome and macOS Preview. Older Adobe Reader builds have rendered the gradient header oddly in our smoke tests — acceptable for the audit-evidence use case.
- **IPv6 reverse DNS** — works in most environments but we haven't exhaustively tested on AAAA-only networks.
- **Time-zone display.** All timestamps are UTC throughout; the dashboard renders absolute times in the user's locale via `toLocaleString()` but doesn't show a TZ indicator.
- **Scan parallelism across schedules.** The tick loop processes schedules sequentially per tick. With dozens of due schedules, that adds ~3 s × N. Production: convert to concurrent worker Lambdas via SQS.
- **GDPR / data retention controls.** No automatic data expiry on scan results. Recommendation: a scheduled Lambda that prunes scans older than your retention policy.
- **Audit log** — we log scan ingestion at info level, but there's no separate immutable audit trail of who did what. CloudTrail covers the API Gateway / IAM side; a per-action audit table is a planned addition.
