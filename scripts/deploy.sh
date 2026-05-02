#!/usr/bin/env bash
# Build and deploy the backend to AWS (API Gateway + Lambda + DynamoDB).
# Requires `sam` CLI and configured AWS credentials.
set -euo pipefail
cd "$(dirname "$0")/../infra"

sam build --template template.yaml
sam deploy --guided --template template.yaml --capabilities CAPABILITY_IAM
