#!/usr/bin/env bash
set -euo pipefail

# tools/chaos/toxiproxy-toxic.sh — Manage toxiproxy toxics against MinIO (port 8474)
# Usage:
#   ./tools/chaos/toxiproxy-toxic.sh latency [ms=2000] [jitter_ms=500]
#   ./tools/chaos/toxiproxy-toxic.sh timeout [timeout_ms=60000]
#   ./tools/chaos/toxiproxy-toxic.sh disable
#   ./tools/chaos/toxiproxy-toxic.sh enable
#   ./tools/chaos/toxiproxy-toxic.sh reset

TOXIPROXY_URL="${TOXIPROXY_URL:-http://localhost:8474}"
PROXY_NAME="minio"
COMMAND="${1:-help}"

case "$COMMAND" in
  latency)
    LATENCY="${2:-2000}"
    JITTER="${3:-500}"
    echo "[toxiproxy] Adding ${LATENCY}ms (+/- ${JITTER}ms) latency to $PROXY_NAME..."
    curl -s -X POST "$TOXIPROXY_URL/proxies/$PROXY_NAME/toxics" \
      -H "Content-Type: application/json" \
      -d "{\"name\": \"latency_downstream\", \"type\": \"latency\", \"stream\": \"downstream\", \"attributes\": {\"latency\": $LATENCY, \"jitter\": $JITTER}}" | grep -o '"name":[^,]*' || true
    echo ""
    ;;

  timeout)
    TIMEOUT_MS="${2:-60000}"
    echo "[toxiproxy] Adding ${TIMEOUT_MS}ms timeout toxic to $PROXY_NAME..."
    curl -s -X POST "$TOXIPROXY_URL/proxies/$PROXY_NAME/toxics" \
      -H "Content-Type: application/json" \
      -d "{\"name\": \"timeout_downstream\", \"type\": \"timeout\", \"stream\": \"downstream\", \"attributes\": {\"timeout\": $TIMEOUT_MS}}" | grep -o '"name":[^,]*' || true
    echo ""
    ;;

  disable)
    echo "[toxiproxy] Disabling proxy $PROXY_NAME (simulating complete outage / connection refused)..."
    curl -s -X POST "$TOXIPROXY_URL/proxies/$PROXY_NAME" \
      -H "Content-Type: application/json" \
      -d '{"enabled": false}' | grep -o '"enabled":[^,]*' || true
    echo ""
    ;;

  enable)
    echo "[toxiproxy] Enabling proxy $PROXY_NAME..."
    curl -s -X POST "$TOXIPROXY_URL/proxies/$PROXY_NAME" \
      -H "Content-Type: application/json" \
      -d '{"enabled": true}' | grep -o '"enabled":[^,]*' || true
    echo ""
    ;;

  reset)
    echo "[toxiproxy] Resetting all toxics and enabling $PROXY_NAME..."
    # Fetch existing toxics and delete them
    TOXICS=$(curl -s "$TOXIPROXY_URL/proxies/$PROXY_NAME/toxics" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 || true)
    for t in $TOXICS; do
      curl -s -X DELETE "$TOXIPROXY_URL/proxies/$PROXY_NAME/toxics/$t" >/dev/null 2>&1 || true
    done
    curl -s -X POST "$TOXIPROXY_URL/proxies/$PROXY_NAME" \
      -H "Content-Type: application/json" \
      -d '{"enabled": true}' >/dev/null 2>&1 || true
    echo "[toxiproxy] Proxy $PROXY_NAME is clean and enabled."
    ;;

  *)
    echo "Usage: $0 {latency [ms] [jitter] | timeout [ms] | disable | enable | reset}"
    exit 1
    ;;
esac
