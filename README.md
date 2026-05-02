# Network Posture Scanner

A lightweight network posture tool that **discovers reachable hosts**, **parses firewall configurations** from multiple sources, **evaluates them against CIS-aligned benchmarks**, and reports findings through a backend that runs locally or on AWS.

```
┌──────────────┐    HTTPS/JSON     ┌──────────────────────┐    ┌────────────────┐
│  Scanner CLI │ ───── X-Api-Key ─►│  FastAPI / Lambda    │◄───┤ React Dashboard│
│  (Python)    │                   │  + DynamoDB / file   │    │ (Vite + TS)    │
└──────────────┘                   └──────────────────────┘    └────────────────┘
       │
       ▼
 ICMP / TCP SYN / banner grab
 iptables / AWS SG / Cisco IOS parsers
 8 CIS benchmark checks
```

## Repository layout

| Path | What's inside |
|------|--------------|
| `scanner/` | Python CLI: host discovery, banner grab, firewall config loader, ingestion client |
| `backend/` | FastAPI app + Lambda handler, parsers for iptables/AWS SG/Cisco, CIS checks, storage |
| `frontend/` | React + Vite + TypeScript dashboard with the project's custom palette |
| `infra/` | AWS SAM template (API Gateway → Lambda → DynamoDB) |
| `samples/` | Reference firewall configs the scanner can parse without a real device |
| `scripts/` | One-shot helpers: `dev.sh`, `seed.sh`, `deploy.sh` |
| `docs/` | Deep-dive documentation — see [Documentation](#documentation) below |

## Documentation

| Doc | What's in it |
|-----|--------------|
| [`docs/architecture.md`](docs/architecture.md) | System overview, component boundaries, AWS topology |
| [`docs/discovery.md`](docs/discovery.md) | How the scan works, every non-responsive-host edge case |
| [`docs/benchmarks.md`](docs/benchmarks.md) | All 8 CIS checks, evaluation algorithms, false-positive guards |
| [`docs/cis-mapping.md`](docs/cis-mapping.md) | Quick reference of CIS clause → check id |
| [`docs/data-flow.md`](docs/data-flow.md) | End-to-end pipeline, full API surface, AWS topology, auth model |
| [`docs/frontend.md`](docs/frontend.md) | React architecture, theming, mobile pattern, accessibility |
| [`docs/design-decisions.md`](docs/design-decisions.md) | Trade-offs, challenges we hit, what we'd build next |
| [`docs/edge-cases.md`](docs/edge-cases.md) | Enterprise-grade edge cases by layer (input, network, backend, auth, frontend, concurrency, security) |
| [`docs/threat-model.md`](docs/threat-model.md) | Threat model summary |

## Quick start (local, no AWS account required)

```bash
git clone <this-repo> && cd network-posture-scanner
cp .env.example .env                  # fill in API_KEY (any strong random string)

# 1. Backend
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                            # http://localhost:5173

# 3. Scanner (new terminal — seed sample data)
cd scanner
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m nps_scanner scan \
  --targets 127.0.0.1 \
  --firewall-source iptables --firewall-file ../samples/iptables/permissive.rules \
  --firewall-source aws-sg   --firewall-file ../samples/aws-sg/wide-open.json \
  --firewall-source cisco    --firewall-file ../samples/cisco/legacy-edge.cfg
```

Visit **http://localhost:5173** and you should see discovered devices, firewall rules across all three formats, and the CIS benchmark results with pass/fail evidence.

## Deploying to AWS

```bash
cd infra
sam build && sam deploy --guided           # provisions API Gateway + Lambda + DynamoDB
```

The deployed API URL becomes `NPS_API_URL` for the scanner and `VITE_API_URL` for a hosted frontend (e.g. S3 + CloudFront). The same `API_KEY` is checked by both the local FastAPI and the Lambda authorizer dependency, so the scanner code is unchanged across environments.

## Implemented CIS benchmark checks

| ID | Check | CIS Reference |
|----|-------|--------------|
| `CIS-NET-001` | No insecure management protocols exposed (Telnet, FTP, HTTP, SNMPv1/v2c) | CIS Controls v8 4.1, 4.8 |
| `CIS-NET-002` | SSH restricted to a management subnet, not `0.0.0.0/0` | CIS Cisco IOS 1.1.4 |
| `CIS-NET-003` | No default/weak SNMP community strings (`public`, `private`) | CIS Cisco IOS 2.1.2 |
| `CIS-NET-004` | No ingress `0.0.0.0/0` to sensitive ports (22/23/3389/445/3306/5432) | CIS Controls v8 4.4 |
| `CIS-NET-005` | Egress traffic filtered (default-deny outbound) | CIS Controls v8 13.10 |
| `CIS-NET-006` | Logging / syslog enabled and pointed at a remote collector | CIS Controls v8 8.2, 8.5 |
| `CIS-NET-007` | Stateful firewall enabled (no implicit-allow on established) | CIS Controls v8 4.5 |
| `CIS-NET-008` | No legacy/insecure cipher protocols exposed (e.g. SSLv3, TLS 1.0) | CIS Controls v8 3.10 |

See [`docs/cis-mapping.md`](docs/cis-mapping.md) for full evidence semantics.

## Security notes

- **Authentication.** All write and read endpoints require `X-Api-Key`. The key is compared in constant time and never logged. For AWS deployment the same value is read from a Secrets Manager secret by the Lambda.
- **Transport.** Local dev uses HTTP for convenience; the SAM template provisions API Gateway over HTTPS only.
- **Least privilege.** Scanner does not need DynamoDB credentials — it talks to the API only.
- **Discovery is consent-bounded.** The scanner refuses targets outside RFC1918 / loopback unless `--allow-public` is passed and the user types `I OWN THIS NETWORK`. Scan only what you are authorized to scan.

## Running tests

```bash
cd backend && pytest -q
cd ../scanner && pytest -q
```

## License

MIT.
