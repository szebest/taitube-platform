#!/usr/bin/env bash
set -euo pipefail

# tools/chaos/redis-restart.sh — Chaos tool: restart Redis mid-run to test durability & reconnects
# Usage: ./tools/chaos/redis-restart.sh [mode: compose|k8s]

MODE="${1:-auto}"
NAMESPACE="${K8S_NAMESPACE:-video-pipeline}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/compose/docker-compose.yml}"

echo "=========================================================="
echo "==> video-pipeline Chaos Tool: redis-restart"
echo "==> Mode: $MODE"
echo "=========================================================="

if [ "$MODE" = "auto" ]; then
  if command -v kubectl >/dev/null 2>&1 && kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
    MODE="k8s"
  else
    MODE="compose"
  fi
  echo "==> Auto-detected execution mode: $MODE"
fi

if [ "$MODE" = "k8s" ]; then
  echo "[redis-restart] $(date -u +%FT%TZ) Restarting Redis deployment in Kubernetes ($NAMESPACE)..."
  if kubectl get deployment vp-redis -n "$NAMESPACE" >/dev/null 2>&1; then
    kubectl rollout restart deployment/vp-redis -n "$NAMESPACE"
    kubectl rollout status deployment/vp-redis -n "$NAMESPACE" --timeout=60s
  else
    # Fallback to pod deletion
    echo "[redis-restart] Deleting Redis pods with label app.kubernetes.io/name=redis..."
    kubectl delete pod -n "$NAMESPACE" -l "app.kubernetes.io/name=redis" --now || true
  fi
  echo "[redis-restart] $(date -u +%FT%TZ) Redis restarted in k8s."
else
  echo "[redis-restart] $(date -u +%FT%TZ) Restarting Redis container in Docker Compose..."
  if docker compose -f "$COMPOSE_FILE" ps redis -q >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" restart redis
  else
    docker restart vp-redis
  fi

  echo "[redis-restart] Waiting for Redis to accept connections..."
  count=0
  until docker exec vp-redis redis-cli -a vp ping >/dev/null 2>&1 || [ "$count" -ge 30 ]; do
    sleep 1
    count=$((count + 1))
  done

  if [ "$count" -ge 30 ]; then
    echo "[redis-restart] ERROR: Redis did not recover within 30 seconds."
    exit 1
  fi
  echo "[redis-restart] $(date -u +%FT%TZ) Redis is healthy and responding to PING."
fi
