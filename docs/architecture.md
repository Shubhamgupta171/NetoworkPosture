# Architecture

```
                       ┌──────────────────────────┐
                       │       Scanner CLI        │
                       │   (python -m nps_scanner)│
                       │                          │
                       │ • TCP-connect probe      │
                       │ • Banner grab            │
                       │ • iptables / SG / IOS    │
                       │   parsers                │
                       │ • httpx client           │
                       └─────────────┬────────────┘
                                     │ HTTPS / X-Api-Key
                                     │ POST /ingest
                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ FastAPI (local) / API Gateway + Lambda (AWS) — `app.main:app`   │
│                                                                 │
│  /health        public liveness probe                           │
│  /ingest        accepts scan payloads, runs the benchmark engine│
│  /devices       discovered hosts                                │
│  /firewall-rules  flattened rule listing (filterable)           │
│  /cis-results     per-target benchmark outcomes + evidence      │
│  /cis-results/summary, /catalog                                 │
│                                                                 │
│  ┌─────────────┐   ┌──────────────────┐   ┌──────────────────┐  │
│  │  parsers/   │   │  benchmarks/     │   │  services/storage│  │
│  │  iptables   │──▶│  8 CIS checks    │──▶│  memory/file/DDB │  │
│  │  aws_sg     │   │  registry-driven │   │  Pluggable Store │  │
│  │  cisco      │   └──────────────────┘   └──────────────────┘  │
│  └─────────────┘                                                │
└────────────────────────────────────┬────────────────────────────┘
                                     │ HTTPS / X-Api-Key
                                     ▼
                       ┌──────────────────────────┐
                       │    React + Vite + TS     │
                       │       (frontend/)        │
                       │                          │
                       │ • Devices table          │
                       │ • Firewall rules table   │
                       │ • CIS results panel      │
                       │ • Severity breakdown     │
                       └──────────────────────────┘
```

## Module boundaries

* `scanner/` only depends on `httpx`, the standard library, and its own minimal parser shapes. It can be packaged as a self-contained binary (e.g. via `pyinstaller`) and dropped onto an air-gapped host.
* `backend/app/parsers/` and `backend/app/benchmarks/` are pure functions — no I/O, no FastAPI imports — so they can be re-used in offline tooling or Lambda batch jobs.
* `backend/app/services/storage.py` is the only place that knows about persistence. Switching from local file to DynamoDB is a single env-var flip.
* `backend/app/api/` contains routes, dependency injection, and request/response models only.

## Auth

Single shared `X-Api-Key` header.

* **Local**: read from `.env` via `pydantic-settings`.
* **AWS**: stored in Secrets Manager; the SAM template injects it as a Lambda env var via `{{resolve:secretsmanager:...}}` so the value is never written into source.
* **Comparison**: `secrets.compare_digest` — constant time.

## Why not Cognito / SigV4?

For a posture-reporting tool whose only client is a CLI driven by a single operator, an API key strikes the right balance between security and "I can curl this in a hurry". The same `X-Api-Key` middleware can be replaced with a Lambda authorizer that calls Cognito or a JWKS endpoint without changing any scanner or frontend code — the contract is "send `X-Api-Key`, the gateway decides".

## Storage schema

DynamoDB single-table:

| pk | sk | item shape |
|----|----|-----------|
| `devices` | `<ip>` | `Device` |
| `rulesets` | `<source_type>:<ruleset_id>` | `FirewallRuleSet` |
| `results` | `<target_id>:<check_id>` | `BenchmarkResult` |
| `scans` | `<scan_id>` | `ScanSummary` |

`PointInTimeRecovery` is on, so a bad ingest can be rolled back by restoring to a few minutes earlier.
