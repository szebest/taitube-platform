#!/usr/bin/env bash
set -euo pipefail

# tools/chaos/disk-fill.sh — Chaos tool: fills worker temporary disk (/tmp/vp) to test ENOSPC & WorkerTmpDiskHigh alert
# Usage:
#   ./tools/chaos/disk-fill.sh [size_mb=7000] [stage_or_container=transcode-720p] [--cleanup]
# Example:
#   ./tools/chaos/disk-fill.sh 7000 transcode-720p
#   ./tools/chaos/disk-fill.sh --cleanup transcode-720p

SIZE_MB="7000"
TARGET="transcode-720p"
CLEANUP=false
MODE="auto"
NAMESPACE="${K8S_NAMESPACE:-video-pipeline}"

for arg in "$@"; do
  case "$arg" in
    --cleanup|-c)
      CLEANUP=true
      ;;
    compose|k8s)
      MODE="$arg"
      ;;
    [0-9]*)
      SIZE_MB="$arg"
      ;;
    *)
      TARGET="$arg"
      ;;
  esac
done

echo "=========================================================="
echo "==> video-pipeline Chaos Tool: disk-fill"
echo "==> Target: $TARGET | Size: ${SIZE_MB}MB | Cleanup: $CLEANUP"
echo "=========================================================="

if [ "$MODE" = "auto" ]; then
  if command -v kubectl >/dev/null 2>&1 && kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
    MODE="k8s"
  else
    MODE="compose"
  fi
  echo "==> Auto-detected mode: $MODE"
fi

FILL_FILE="/tmp/vp/chaos_disk_fill.tmp"

compose_worker() {
  local service="worker-${TARGET}" container
  container=$(docker ps -q --filter "status=running" \
    --filter "label=com.docker.compose.project=${COMPOSE_PROJECT_NAME:-video-pipeline}" \
    --filter "label=com.docker.compose.service=${service}" | head -n 1)
  if [ -z "$container" ]; then
    echo "[disk-fill] ERROR: no running container of compose service '$service'." >&2
    exit 1
  fi
  echo "$container"
}

cleanup_disk() {
  echo "[disk-fill] Cleaning up fill file ($FILL_FILE)..."
  if [ "$MODE" = "k8s" ]; then
    local pod
    pod=$(kubectl get pods -n "$NAMESPACE" -l "stage=${TARGET}" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
    if [ -n "$pod" ]; then
      kubectl exec -n "$NAMESPACE" "$pod" -- rm -f "$FILL_FILE" || true
      echo "[disk-fill] Removed $FILL_FILE from pod $pod."
    fi
  else
    local container
    container=$(compose_worker)
    docker exec "$container" rm -f "$FILL_FILE"
    echo "[disk-fill] Removed $FILL_FILE from container $container."
  fi
  echo "[disk-fill] Disk cleanup complete."
}

if [ "$CLEANUP" = true ]; then
  cleanup_disk
  exit 0
fi

trap 'echo ""; echo "[disk-fill] Caught interrupt, cleaning up..."; cleanup_disk; exit 0' INT TERM

fill_disk() {
  echo "[disk-fill] $(date -u +%FT%TZ) Allocating ${SIZE_MB}MB in $FILL_FILE on $TARGET..."
  if [ "$MODE" = "k8s" ]; then
    local pod
    pod=$(kubectl get pods -n "$NAMESPACE" -l "stage=${TARGET}" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
    if [ -z "$pod" ]; then
      echo "[disk-fill] ERROR: No running pods found for stage '$TARGET' in namespace '$NAMESPACE'."
      exit 1
    fi
    echo "[disk-fill] Writing ${SIZE_MB}MB to pod $pod at $FILL_FILE..."
    kubectl exec -n "$NAMESPACE" "$pod" -- sh -c "mkdir -p /tmp/vp && dd if=/dev/zero of=$FILL_FILE bs=1M count=$SIZE_MB status=progress || true"
  else
    local container
    container=$(compose_worker)
    echo "[disk-fill] Writing ${SIZE_MB}MB inside container $container at $FILL_FILE..."
    docker exec "$container" sh -c "mkdir -p /tmp/vp && dd if=/dev/zero of=$FILL_FILE bs=1M count=$SIZE_MB status=progress || true"
  fi
  echo "[disk-fill] Allocation complete. Run './tools/chaos/disk-fill.sh --cleanup $TARGET' to remove."
}

fill_disk
