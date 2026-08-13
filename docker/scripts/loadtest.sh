#!/usr/bin/env bash
# Lightweight smoke + load test against a running deployment.
# Usage: ./docker/scripts/loadtest.sh [base_url] [concurrency] [requests]
set -euo pipefail

BASE_URL="${1:-https://diaryarchive.com}"
CONCURRENCY="${2:-20}"
REQUESTS="${3:-500}"

if ! command -v ab >/dev/null 2>&1; then
  echo "error: 'ab' (apache bench) not found. apt-get install apache2-utils" >&2
  exit 1
fi

echo "==> Smoke tests"
curl -fsS -o /dev/null -w "health: %{http_code}\n" "$BASE_URL/api/v1/health"
curl -fsS -o /dev/null -w "home:   %{http_code}\n" "$BASE_URL/"

echo "==> Load test: $REQUESTS requests @ concurrency $CONCURRENCY on /api/v1/health"
ab -n "$REQUESTS" -c "$CONCURRENCY" "$BASE_URL/api/v1/health" || true

echo "==> Load test: $REQUESTS requests @ concurrency $CONCURRENCY on /"
ab -n "$REQUESTS" -c "$CONCURRENCY" "$BASE_URL/" || true

echo "Load test complete. Watch backend/nginx metrics for p95/p99 latencies."
