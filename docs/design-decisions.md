# Design decisions, challenges, and improvements

Here's what we picked, what we deliberately didn't pick, and what we'd build next given more time.

## What we chose, and why

### TCP-connect over raw SYN scanning

Discussed in [`discovery.md`](./discovery.md). Picking userland sockets means no privileged install, no OS-specific code, and an honest expectation that the scan is not stealthy — appropriate for a defensive tool used by the operator on their own network.

### Hand-rolled parsers over third-party libraries

The Cisco parser is ~150 lines of explicit regex + line iteration. We could have used `ciscoconfparse2` (and it's in `requirements.txt` for users who want to extend it), but for the in-tree code path:

- The CIS checks need only six fields per rule. 90% of `ciscoconfparse`'s feature surface is irrelevant.
- Hand-rolled means every parsing decision is auditable in plain Python — important for a security tool.
- No surprise behavior from a dependency upgrade.

Same reasoning for the iptables and AWS SG parsers: they're each <100 lines, fully covered by tests against bundled fixtures.

### Single-table DynamoDB

`pk = record_kind, sk = record_id`. One table for devices, rulesets, results, scans, schedules.

**Pro:** one IAM policy, one capacity to provision, point-in-time recovery applies uniformly, cross-resource queries are a single `query()` call.
**Con:** filtering within a record kind (e.g., "all results for check_id=X") requires a scan — fine at our scale, would warrant a GSI at >1M rows.

For the dashboard's read-mostly workload this is the right shape. If we move to event-sourcing per-scan immutable snapshots, a second table for `scan_snapshots` keyed by `(scan_id, sk)` is the natural extension.

### File-store for local dev

A single JSON file written atomically (`.tmp` → rename) is enough for one developer running uvicorn locally. No SQLite, no Postgres, no Docker dependency. The `Store` ABC means production code is never touched.

### React Query, no global state library

Every component fetches what it needs, mutations invalidate by query key. Total state-management code in the SPA: ~20 lines spread across `main.tsx` and the mutation `onSuccess` handlers.

We considered Redux / Zustand and decided neither would do anything React Query doesn't already do better for this app.

### Tailwind + CSS variables for theming

CSS variables for the *values* (so `data-theme="light"` swaps the entire palette without re-render); Tailwind for *layout and density* (so we don't write a single `.module.css`).

The alternative — generating two complete colour palettes in Tailwind config — bloats the generated CSS by ~3× and makes the dark/light comparison harder to audit visually.

### Synchronous discovery in the in-app scanner

`POST /scans` runs discovery in the request thread and returns the summary in the same response. No async job queue, no polling.

**Pro:** simplest possible UX — click, wait, results appear.
**Con:** capped at 16 targets and ~25 s wall-clock to fit inside API Gateway's 29 s timeout.

For larger sweeps, the CLI scanner exists. Between the two we cover both the demo and the production use case without building a job queue we'd then have to maintain.

### In-process scheduler vs. EventBridge

Local: an asyncio task in the FastAPI lifespan. Production Lambda: `DISABLE_SCHEDULER=1` + EventBridge → tick Lambda.

**Pro:** local development is one-command (no separate worker), production is appropriately serverless.
**Con:** two code paths for the same logical operation. We mitigated by extracting `_tick(store)` so both invocations call identical code.

### Single shared `X-Api-Key`

See [`data-flow.md`](./data-flow.md#authentication-model). Pragmatic for a one-operator tool. Easy to swap for Cognito / SigV4 / JWTs.

### Card3D tilt + glassmorphism

A judgment call on visual identity. We're a security tool selling to engineers; "boring spreadsheet" is a real risk for "this looks unfinished" perception. The 3D tilt and glass surfaces are subtle enough not to fight the data, but distinctive enough to feel intentional.

## Challenges we hit (and how we solved them)

### CIS-NET-001 false-positives on loopback rules

iptables fixtures contain `-A INPUT -i lo -j ACCEPT` (no `--dport`, port_range="any"). Our first cut of CIS-NET-001 happily reported "telnet exposed!" because port_overlaps("any", 23) → True.

**Fix:** explicitly skip rules with `port_range == "any"`. Same guard added to NET-002 and NET-004. Documented in [`benchmarks.md`](./benchmarks.md).

### CIS-NET-001 double-counting SNMP

SNMP communities became synthetic firewall rules so they'd be visible in the rules table. NET-001 then flagged them as "SNMP exposed" — but that's NET-003's job (weak community names).

**Fix:** NET-001 skips rules with `rule_id` starting with `snmp-community-`.

### Cisco hardened fixture failing CIS-NET-002

The hardened fixture had `access-class MGMT-IN in` on `vty 0 4` only, not on `vty 5 15`. The check correctly flagged this as a hole — except the test expected a pass.

**Fix:** updated the fixture to apply access-class to both VTY ranges (which is what a properly-hardened router would do anyway), and made the parser resolve `access-class` to its declared CIDR(s) so the rule's `source` field reflects reality.

### `/12` Tailwind opacity wasn't a valid step

`bg-accent-2/12` evaluated to no class — the AWS SG badge looked transparent. Tailwind 3.4's default opacity scale doesn't include `/12`.

**Fix:** changed to `/15` (which is valid) and grepped the codebase for any other off-scale opacities.

### Typer + Click version drift

`typer==0.13.0` paired with the latest Click broke `--help` rendering with a cryptic `Parameter.make_metavar() missing 1 required positional argument: 'ctx'`.

**Fix:** pinned `typer==0.15.1` and `click==8.1.7`.

### CORS hiding the download filename

Browsers strip `Content-Disposition` from cross-origin responses unless explicitly exposed. Our PDF / CSV / JSON downloads were saving as `nps-…[hash]` rather than the friendly name we set.

**Fix:** `expose_headers=["Content-Disposition"]` in the CORS middleware.

### iOS Safari focus-zoom on form inputs

Form inputs set to `text-sm` (14 px) trigger an automatic zoom on iOS Safari when focused. Annoying because it then doesn't zoom back out.

**Fix:** global rule in `index.css` — `input, textarea, select { font-size: 16px }` below the `sm` breakpoint, `14px` from `sm+`.

### FastAPI 204 responses can't be typed `-> None`

```python
@router.delete("/{id}", status_code=204)
async def delete(...) -> None: ...
```

Trips an assertion: "Status code 204 must not have a response body." FastAPI infers a response model from the return type.

**Fix:** explicit `response_class=Response` and return `Response(status_code=204)`.

## What we'd build next

### Per-scan immutable snapshots

Today, "the report from scan X" reflects current state. For audit-grade evidence, store a snapshot of devices + rulesets + results keyed by `scan_id` and serve those for `/scans/{id}/report`. Adds one new partition key in the storage layer.

### Diffing between scans

"What changed since last week's scan." The PDF report has a natural place for this — a coloured diff list at the top before the per-finding details.

### Email / Slack notifications

A scheduled scan that finds a *new* failure (one that wasn't in the previous run) should be able to push to Slack or email. The schedule model already has `last_scan_id` to anchor "previous"; this becomes a webhook field on `Schedule` and a small notifier service.

### Vulnerability / CVE matching

Banner-grab tells us "Apache 2.0.65"; CVE feed could tell us "and that's CVE-2017-7679." Not in MVP because pulling and refreshing CVE data adds operational complexity. A read-only integration with `vulners.com` or `nvd.nist.gov` is the natural first step.

### CIS coverage breadth

8 checks is a starter set. Production-grade would be 30-50 checks across CIS Cisco IOS, CIS Palo Alto, CIS Kubernetes, CIS AWS Foundations. Each one is a single file + a test fixture, so growth is linear.

### Per-user authentication + RBAC

Required for any multi-tenant or team deployment. Cognito + JWT in the API Gateway authoriser; user identity stamped onto every scan / schedule / read.

### Rate limiting + abuse controls

API Gateway's 50/s default is a starting point. A real deployment wants per-API-key throttling and abuse detection (e.g., "this key issued 5 scan-trigger requests in 10 seconds against five different /20 ranges — flag for review").

### Vulnerability assessment scheduling at scale

The current scheduler tick is fine for tens of schedules. For thousands, replace the in-process loop with an SQS queue + multiple worker Lambdas, with a deduplication layer to prevent double-firing.

### A11y polish

Live regions for async updates ("Scan complete, 3 new findings"), keyboard shortcut to focus the scan form, screen-reader-only labels on icon-only buttons. None of this is hard, just hasn't been priced in yet.

### Internationalisation

All copy is in `components/marketing/*` and individual table headers. Wrapping in an `i18n` context (react-i18next) would localise easily; nothing about the data model is English-locked.

### CI gate mode

A scanner subcommand `nps-scanner verify --max-findings 0 --max-critical 0` that exits non-zero if the latest scan has any findings above your threshold. Trivial wrapper around the existing API; would slot directly into a GitHub Actions step.

## What we explicitly aren't building

- **Active exploitation.** This is a defensive posture tool. It will never run a privilege-escalation chain, never attempt logins, never write to a target.
- **A SaaS multi-tenant version.** The spec is "self-hosted in your AWS account or your own server." Multi-tenancy is a different product.
- **A custom rule language.** CIS Controls is the lingua franca; building our own DSL would only fragment the conversation.
- **Replacing nmap/Nessus.** They're better at what they do. We're better at the posture-aggregation and dashboard layer.
