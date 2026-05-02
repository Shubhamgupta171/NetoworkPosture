# Threat model (abbreviated)

A small posture tool is itself a piece of attackable software. The notes below summarise what we worry about and how the design responds.

| # | Threat | Mitigation |
|---|--------|-----------|
| 1 | An attacker discovers the API and replays scanner data to mask real findings. | API gateway requires `X-Api-Key`; key is stored in Secrets Manager, rotated by the operator; constant-time comparison defeats prefix-timing attacks. |
| 2 | An attacker re-runs the scanner against a target they don't own. | Scanner refuses non-RFC1918 / non-loopback targets unless `--allow-public` is set *and* the operator types `I OWN THIS NETWORK` interactively. |
| 3 | A malicious firewall config tries to exploit the parser (e.g. very long lines, regex DoS). | Parsers are hand-written, allocate bounded structures, and never execute the input. `ciscoconfparse2` is intentionally avoided in the scanner so no third-party dependency parses untrusted data on a worker host. |
| 4 | Banner grab leaks credentials accidentally fetched from the target. | Banner buffer is capped at 256 bytes and the response is truncated at the first newline. We never send authentication probes — only `\r\n` or a `HEAD /` request. |
| 5 | A leaked scan report exposes internal IPs and service banners. | DynamoDB has SSE-AES256 enabled; API Gateway is HTTPS-only; CORS allow-list is explicit, not `*`, in non-dev configurations. |
| 6 | A misconfigured IAM allows the Lambda to read other DynamoDB tables. | The SAM template uses `DynamoDBCrudPolicy` *scoped* to `!Ref ScannerTable` — least privilege by construction. |
| 7 | An operator forgets to rotate the API key. | The key is generated in CloudFormation via `GenerateSecretString` so the initial value is not chosen by humans; rotation is `aws secretsmanager rotate-secret`. The Lambda picks up the new value at next cold start (≤ 15 minutes by default). |
| 8 | Logs leak the API key. | The `require_api_key` dependency never logs the header value; structured JSON logger is allow-list driven and only emits the fields explicitly added to the `extra=` dict. |
