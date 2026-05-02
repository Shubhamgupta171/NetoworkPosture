# Data flow: from packet to dashboard

This document traces what happens after the scanner sees an open port, all the way to the moment a user hits "Download PDF" in the dashboard. It also covers the AWS deployment topology and the API surface.

## End-to-end flow

```
                          ┌──────────────────┐
                          │  Operator's CLI  │
                          │  python -m       │
                          │  nps_scanner     │
                          └────────┬─────────┘
                                   │
                               (1) discovery
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  HTTPS · X-Api-  │
                          │  Key · JSON      │
                          └────────┬─────────┘
                                   │
                               (2) POST /ingest
                                   │
                  ┌────────────────┼─────────────────┐
                  │                                  │
                  ▼                                  ▼
        ┌─────────────────┐               ┌─────────────────┐
        │  FastAPI (dev)  │   or          │  API Gateway →  │
        │  uvicorn :8000  │               │  Lambda (mangum)│
        └────────┬────────┘               └────────┬────────┘
                 │                                  │
            (3)  ▼                             (3)  ▼
        ┌─────────────────┐               ┌─────────────────┐
        │  benchmark eng  │               │  benchmark eng  │
        │  evaluate()     │               │  evaluate()     │
        └────────┬────────┘               └────────┬────────┘
                 │                                  │
            (4)  ▼                             (4)  ▼
        ┌─────────────────┐               ┌─────────────────┐
        │  FileStore /    │               │  DynamoDBStore  │
        │  MemoryStore    │               │  (single-table) │
        └─────────────────┘               └─────────────────┘
                 ▲                                  ▲
                 │                                  │
            (5)  │                             (5)  │
        ┌────────┴────────┐               ┌─────────┴────────┐
        │  React + Vite   │               │  React + Vite    │
        │  localhost:5173 │               │  S3 + CloudFront │
        └─────────────────┘               └──────────────────┘
                 ▲                                  ▲
                 │                                  │
                 │  GET /devices, /firewall-rules,  │
                 │  /cis-results, /scans, etc.      │
                 └──────────────────────────────────┘
```

## The five stages

### 1 · Discovery (scanner side)

- See [`discovery.md`](./discovery.md) for the full algorithm.
- The CLI scanner (`scanner/src/nps_scanner/discovery.py`) and the in-app scanner (`backend/app/services/discovery.py`) produce the same `Device` and `OpenPort` shapes.
- Firewall configs (iptables dumps, AWS SG JSON, Cisco IOS configs) are loaded from local files and parsed into `FirewallRuleSet` objects.

### 2 · Ingestion

The scanner POSTs an `IngestPayload`:

```json
{
  "scan_id": "fd1b624307b14053bdbfeaa185e8b7be",
  "scanner_version": "0.1.0",
  "started_at": "2026-04-29T00:09:54Z",
  "finished_at": "2026-04-29T00:09:57Z",
  "devices":  [...],
  "rulesets": [...]
}
```

Headers required: `X-Api-Key`, `Content-Type: application/json`. The body is bounded by Pydantic on the server (`IngestPayload`) — anything malformed returns 422 with field-level errors.

`/ingest` is **idempotent** at the device + ruleset level — re-posting the same scan upserts by ID rather than appending. `/scans` records the new scan summary regardless, so audit trail and "last seen" semantics both work.

The dashboard's **Run a scan** button uses `POST /scans` instead of `/ingest` — it's a different code path: discovery runs *server-side*, no payload needed beyond targets + sample IDs.

### 3 · Benchmark evaluation

Inside the request handler:

```python
store.upsert_devices(payload.devices)
store.upsert_rulesets(payload.rulesets)
all_devices  = store.list_devices()
all_rulesets = store.list_rulesets()
results = evaluate(all_devices, all_rulesets)   # 8 checks, ~3 ms
store.replace_results(results)
store.record_scan(summary)
```

We evaluate over the **entire current store**, not just this scan's payload. This is so adding one new SG doesn't lose context of all the other SGs and devices already in the system. The trade-off is that "the report from scan X" reflects the posture *as of now*, not *as of when scan X ran*. For per-scan immutability, see the design-decisions doc.

### 4 · Storage

Three pluggable backends via the `Store` ABC:

| Backend | Use case | Persistence |
|---------|---------|-------------|
| `MemoryStore` | Tests and ephemeral demos | None — process exit loses everything |
| `FileStore` | Local dev | Single JSON file, atomic write via `.tmp` + rename |
| `DynamoDBStore` | Production / Lambda | Single-table design (PK=record kind, SK=record id) |

DynamoDB schema:

| pk | sk | Item |
|----|----|------|
| `devices`   | `<ip>`                         | Device |
| `rulesets`  | `<source_type>:<ruleset_id>`   | FirewallRuleSet |
| `results`   | `<target_id>:<check_id>`       | BenchmarkResult |
| `scans`     | `<scan_id>`                    | ScanSummary |
| `schedules` | `<schedule_id>`                | Schedule |

Selected for cost (PAY_PER_REQUEST), scale (millions of items per partition), and operational simplicity (no schema migrations, point-in-time recovery on by default in our SAM template).

### 5 · The frontend

The React SPA reads from the same API the scanner writes to. Every panel is a `useQuery` against one of the GET endpoints; no caching layer between them. React Query's `staleTime: 15s` prevents request storms when the user toggles between tabs without losing freshness.

When a scan finishes (instant or scheduled), the form invalidates every relevant query key:

```ts
qc.invalidateQueries({ queryKey: ["devices"] });
qc.invalidateQueries({ queryKey: ["rules"] });
qc.invalidateQueries({ queryKey: ["results"] });
qc.invalidateQueries({ queryKey: ["summary"] });
qc.invalidateQueries({ queryKey: ["scans"] });
qc.invalidateQueries({ queryKey: ["catalog"] });
```

— so the dashboard refreshes without a page reload.

## API surface (full reference)

All endpoints other than `/health` require `X-Api-Key`. CORS allows GET, POST, PATCH, DELETE, OPTIONS.

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/health` | Liveness probe (no auth). Returns `{status, version}`. |
| POST   | `/ingest` | Scanner uploads `IngestPayload`. Returns `ScanReport`. 201. |
| POST   | `/scans` | Trigger an in-app scan from the dashboard. Returns `ScanSummary`. 201. |
| GET    | `/scans` | List all scan summaries, newest first. |
| GET    | `/scans/{id}` | Single scan summary. 404 if unknown. |
| GET    | `/scans/{id}/report?format=json\|csv\|pdf` | Download a snapshot. `Content-Disposition` set. |
| GET    | `/scans/samples` | Catalog of bundled sample fixtures the form offers as checkboxes. |
| GET    | `/devices` | All discovered devices, sorted by IP. |
| GET    | `/devices/{ip}` | Single device. 404 if unknown. |
| GET    | `/firewall-rules?source_type=…` | Flattened rule listing across all rulesets. Optional source filter. |
| GET    | `/firewall-rules/sets` | The original `FirewallRuleSet` objects. |
| GET    | `/cis-results?outcome=pass\|fail\|not_applicable` | Per-target benchmark results. |
| GET    | `/cis-results/summary` | Aggregate counts (`{total, passed, failed, not_applicable, by_severity}`). |
| GET    | `/cis-results/catalog` | The 8 checks with metadata. Drives the dashboard catalog grid and the schedule form's hint text. |
| GET    | `/schedules` | List recurring schedules, newest first. |
| POST   | `/schedules` | Create a schedule. 201. |
| PATCH  | `/schedules/{id}` | Update name, targets, samples, interval, enabled. |
| DELETE | `/schedules/{id}` | Remove. 204. |

All response models live in `backend/app/models/` — the OpenAPI document is generated automatically by FastAPI at `/docs` (Swagger) and `/redoc`.

## AWS topology (when deployed)

```
                  ┌────────────────┐
   internet ──────│  CloudFront    │  (optional — hosts the SPA from S3)
                  └───────┬────────┘
                          ▼
                  ┌────────────────┐
                  │  S3 (frontend  │
                  │  static dist)  │
                  └────────────────┘

                  ┌────────────────┐                ┌────────────────┐
   X-Api-Key ─────│  HTTP API GW   │──── routes ───►│  Lambda (arm64)│
                  │  (HTTPS only)  │                │  app.lambda_   │
                  │  throttle 50/s │                │  handler.handle│
                  └────────────────┘                └────────┬───────┘
                                                            │
                                                            ▼
                                                   ┌────────────────┐
                                                   │  DynamoDB      │
                                                   │  PAY_PER_REQ   │
                                                   │  PITR + SSE    │
                                                   └────────────────┘

                                                   ┌────────────────┐
                                                   │  Secrets Mgr   │
                                                   │  X-Api-Key val │
                                                   └────────────────┘

                                                   ┌────────────────┐
                                                   │  EventBridge   │  (production
                                                   │  every 1 min ──┤   tick for
                                                   │  ──► tick Lambda│   schedules)
                                                   └────────────────┘
```

The SAM template (`infra/template.yaml`) provisions:

- **HTTP API Gateway** with throttling, CORS, HTTPS only
- **Lambda** (arm64, 512 MB, 15s timeout, mangum-wrapped FastAPI)
- **DynamoDB table** with PITR + SSE-AES256
- **Secrets Manager secret** holding `X-Api-Key` (auto-generated 48 chars)
- **IAM role** scoped via `DynamoDBCrudPolicy` to *just* the scanner table

Production scheduler: set `DISABLE_SCHEDULER=1` on the Lambda env (so the in-process loop doesn't spin up) and add an EventBridge rule that invokes a separate "tick" Lambda every minute. The tick Lambda imports `app.services.scheduler._tick` and runs it once. Same code, no state, scales horizontally if you ever need to.

## Authentication model

A single shared `X-Api-Key` for both the scanner (write) and the dashboard (read). Pragmatic trade-off:

- **Pros:** trivially explainable, one secret to rotate, works for the cron job and the dashboard alike, no OAuth dance for a tool used by one operator.
- **Cons:** no per-user attribution; key compromise gives full read+write.

Replacing this with a proper auth model is a one-file change (`app/core/security.py`):

- **Cognito JWTs** — swap `require_api_key` for `verify_jwt`; the user identity is attached to every request.
- **AWS SigV4** (signed requests) — Lambda authorizer + IAM principal, no shared secret.
- **mTLS for the scanner** — API Gateway supports client-cert auth, with the dashboard staying on JWTs.

The scanner's `submit_scan()` and the frontend's `request()` both abstract the header behind a single function, so changing auth is bounded.

## Failure modes & how the API behaves

| Failure | HTTP | Body |
|--------|------|------|
| Missing or wrong `X-Api-Key` | 401 | `{"detail": "Missing or invalid X-Api-Key"}` |
| Pydantic validation failure | 422 | List of field errors |
| Scan target rejected (public IP, unresolved hostname, too many) | 400 | `{"detail": "Target '8.8.8.8' resolves to public IP 8.8.8.8. ..."}` |
| Schedule interval too short | 422 | `{"detail": [..."greater than or equal to 15"...]}` |
| Unknown scan / schedule id | 404 | `{"detail": "No scan with id=..."}` |
| Backend dependency error (DynamoDB throttle, etc.) | 500 | Generic — full traceback only in CloudWatch |
| Banner read times out | (silent) | Banner is omitted; port still listed |
| Client disconnect during PDF download | (silent) | StreamingResponse aborts, no half-written file |

The backend catches every `Exception` in the scheduler tick and the request handler so a single bad input never takes the process down.
