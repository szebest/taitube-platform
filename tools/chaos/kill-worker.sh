#!/usr/bin/env bash
set -euo pipefail

# tools/chaos/kill-worker.sh — Chaos tool: kill a random worker of a specified stage
# Usage: ./tools/chaos/kill-worker.sh <stage> [interval_seconds] [mode: compose|k8s]
# Example: ./tools/chaos/kill-worker.sh transcode-720p 45 compose

STAGE="${1:-transcode-720p}"
INTERVAL="${2:-45}"
MODE="${3:-auto}"
NAMESPACE="${K8S_NAMESPACE:-video-pipeline}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/compose/docker-compose.yml}"

echo "=========================================================="
echo "==> video-pipeline Chaos Tool: kill-worker"
echo "==> Stage: $STAGE | Interval: ${INTERVAL}s | Mode: $MODE"
echo "=========================================================="

if [ "$MODE" = "auto" ]; then
  if command -v kubectl >/dev/null 2>&1 && kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
    MODE="k8s"
  else
    MODE="compose"
  fi
  echo "==> Auto-detected execution mode: $MODE"
fi

kill_compose_worker() {
  local service_name="worker-${STAGE}"
  # Check if compose service exists or search by container name
  local containers
  containers=$(docker ps --filter "name=vp-worker-${STAGE}" --filter "status=running" -q)
  if [ -z "$containers" ]; then
    # Try compose ps
    containers=$(docker compose -f "$COMPOSE_FILE" ps "$service_name" --status running -q 2>/dev/null || true)
  fi

  if [ -z "$containers" ]; then
    echo "[kill-worker] WARNING: No running compose containers found for stage '$STAGE' (service: $service_name)."
    return 0
  fi

  # Pick random container
  local target
  target=$(echo "$containers" | shuf -n 1 2>/dev/null || echo "$containers" | sort -R 2>/dev/null | head -n 1 || echo "$containers" | head -n 1)
  local cname
  cname=$(docker inspect --format '{{.Name}}' "$target" 2>/dev/null || echo "$target")
  echo "[kill-worker] $(date -u +%FT%TZ) Killing worker container $cname ($target) with SIGKILL..."
  docker kill -s KILL "$target" >/dev/null 2>&1 || true
}

kill_k8s_worker() {
  local pods
  pods=$(kubectl get pods -n "$NAMESPACE" -l "stage=${STAGE}" --field-selector=status.phase=Running -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || true)
  if [ -z "$pods" ]; then
    # Fallback to app label
    pods=$(kubectl get pods -n "$NAMESPACE" -l "app=vp-worker-${STAGE}" --field-selector=status.phase=Running -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || true)
  fi

  if [ -z "$pods" ]; then
    echo "[kill-worker] WARNING: No running pods found for stage '$STAGE' in namespace '$NAMESPACE'."
    return 0
  fi

  local pod_arr=($pods)
  local count=${#pod_arr[@]}
  local rand_idx=$((RANDOM % count))
  local target_pod="${pod_arr[$rand_idx]}"

  echo "[kill-worker] $(date -u +%FT%TZ) Deleting pod $target_pod immediately..."
  kubectl delete pod "$target_pod" -n "$NAMESPACE" --now --wait=false >/dev/null 2>&1 || true
}

trap 'echo ""; echo "[kill-worker] Stopping chaos loop."; exit 0' INT TERM

echo "[kill-worker] Starting kill loop. Press Ctrl+C to terminate."
while true; do
  if [ "$MODE" = "k8s" ]; then
    kill_k8s_worker
  else
    kill_compose_worker
  fi
  sleep "$INTERVAL"
done
