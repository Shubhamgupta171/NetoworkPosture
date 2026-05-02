# CIS Benchmark mapping

Each check in `backend/app/benchmarks/checks/` maps onto the CIS reference below. The "Evidence" column describes what the API surfaces in the `evidence` array of a `BenchmarkResult` — that's what the dashboard renders verbatim.

| ID | Title | CIS Reference | Severity | Evidence shape |
|----|-------|--------------|----------|----------------|
| **CIS-NET-001** | No insecure management protocols exposed | CIS Controls v8 — 4.1, 4.8 | high | Either: (a) `port <n>/<proto> <protocol-name>` for a discovered host port matching the legacy services list, or (b) `<rule_id>: allows <protocol> from <source> → <raw>` for a firewall rule allowing it inbound. |
| **CIS-NET-002** | SSH restricted to a management subnet | CIS Cisco IOS 1.1.4 / Controls v8 4.4 | high | `<rule_id>: SSH allowed from <source> (<raw>)` when the source CIDR is `0.0.0.0/0` or otherwise globally routable. |
| **CIS-NET-003** | No default/weak SNMP community strings | CIS Cisco IOS 2.1.2 | high | `<rule_id>: weak community '<name>' — <raw>`. Strings checked: `public`, `private`, `community`, `snmp`, `manager`. |
| **CIS-NET-004** | No internet ingress to sensitive ports | CIS Controls v8 — 4.4 | critical | `<rule_id>: <service> (port <n>) open to the internet — <raw>`. Sensitive ports: 22, 23, 445, 3306, 3389, 5432. |
| **CIS-NET-005** | Egress filtered (default-deny outbound) | CIS Controls v8 — 13.10 | medium | iptables: `<rule_id>: allow-all egress (<proto> → <dst>, port <range>)` or "OUTPUT chain has no default-deny". AWS SG: explicit `0.0.0.0/0` allow-all egress is the failure. |
| **CIS-NET-006** | Logging enabled and pointed at a remote collector | CIS Controls v8 — 8.2, 8.5 | medium | Cisco: presence/absence of `logging host <ip>`. AWS SG: presence of a `FlowLogs=true` tag (informational signal). |
| **CIS-NET-007** | Stateful inspection enabled | CIS Controls v8 — 4.5 | low | iptables only — looks for `state RELATED,ESTABLISHED` accept. |
| **CIS-NET-008** | No legacy / insecure protocol banners | CIS Controls v8 — 3.10 | medium | `port <n>: banner '<text>' contains '<hint>'`. Hints: `SSLv2/3`, `TLSv1.0/1.1`, ancient `Apache 1.x/2.0`, `OpenSSH_5.x`. |

## Adding a new check

1. Create `backend/app/benchmarks/checks/cis_net_009_my_check.py`.
2. Implement a class extending `BenchmarkCheck` with a `CheckMetadata` and an `evaluate(devices, rulesets)` method that returns a `list[BenchmarkResult]`.
3. Register it in `backend/app/benchmarks/engine.py:registered_checks()`.
4. Add a fixture-based test in `backend/tests/test_benchmarks.py`.
5. The dashboard will pick it up automatically — the catalog endpoint is dynamic.
