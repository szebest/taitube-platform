#!/usr/bin/env bash
set -euo pipefail

# scripts/validate-k8s.sh — Validate k8s manifests across overlays
# Uses kubeconform if installed (or via docker), falls back to kubectl kustomize schema validation

LOCAL_OVERLAY="infra/k8s/overlays/local"
CLOUD_OVERLAY="infra/k8s/overlays/cloud"

# Support native Linux, macOS, WSL, and Windows Docker environments
if ! command -v kubectl >/dev/null 2>&1 && ! command -v kubectl.exe >/dev/null 2>&1; then
  if [ -d "/mnt/c/Program Files/Docker/Docker/resources/bin" ]; then
    export PATH="$PATH:/mnt/c/Program Files/Docker/Docker/resources/bin"
  elif [ -d "/c/Program Files/Docker/Docker/resources/bin" ]; then
    export PATH="$PATH:/c/Program Files/Docker/Docker/resources/bin"
  fi
fi

KUBECTL_CMD="kubectl"
if command -v kubectl.exe >/dev/null 2>&1 && ! command -v kubectl >/dev/null 2>&1; then
  KUBECTL_CMD="kubectl.exe"
fi

echo "==> Validating Kubernetes manifests with kubectl kustomize..."

echo "==> Building local overlay..."
"$KUBECTL_CMD" kustomize "$LOCAL_OVERLAY" > /dev/null
echo "Local overlay successfully rendered."

echo "==> Building cloud overlay..."
"$KUBECTL_CMD" kustomize "$CLOUD_OVERLAY" > /dev/null
echo "Cloud overlay successfully rendered."

if command -v kubeconform >/dev/null 2>&1; then
  echo "==> Validating with kubeconform..."
  "$KUBECTL_CMD" kustomize "$LOCAL_OVERLAY" | kubeconform -strict -summary -ignore-missing-schemas -
  "$KUBECTL_CMD" kustomize "$CLOUD_OVERLAY" | kubeconform -strict -summary -ignore-missing-schemas -
  echo "==> kubeconform validation passed!"
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "==> Validating with kubeconform via Docker..."
  "$KUBECTL_CMD" kustomize "$LOCAL_OVERLAY" | docker run --rm -i ghcr.io/yannh/kubeconform:latest -strict -summary -ignore-missing-schemas -
  "$KUBECTL_CMD" kustomize "$CLOUD_OVERLAY" | docker run --rm -i ghcr.io/yannh/kubeconform:latest -strict -summary -ignore-missing-schemas -
  echo "==> kubeconform Docker validation passed!"
else
  echo "==> kubeconform not available in environment; rendered manifests verified via kubectl kustomize."
fi

echo "==> Kubernetes manifest validation completed successfully."