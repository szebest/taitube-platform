#!/usr/bin/env bash
set -euo pipefail

# Provision k3s, KEDA, and Traefik on the remote VPS via SSH
# Usage: ./scripts/k3s-cloud-provision.sh <VPS_IP> <SSH_USER>

VPS_IP="${1:-}"
SSH_USER="${2:-root}"

if [[ -z "$VPS_IP" ]]; then
  echo "Usage: $0 <VPS_IP> [SSH_USER]"
  exit 1
fi

echo "==> Provisioning k3s on ${SSH_USER}@${VPS_IP}..."

ssh -o StrictHostKeyChecking=accept-new "${SSH_USER}@${VPS_IP}" << 'REMOTE'
set -euo pipefail

echo "--> Installing k3s..."
curl -sfL https://get.k3s.io | sh -s - server \
  --disable traefik \
  --write-kubeconfig-mode 644

echo "--> Waiting for k3s to be ready..."
sleep 10
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl wait --for=condition=Ready nodes --all --timeout=120s

echo "--> Installing Helm..."
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh

echo "--> Installing Traefik (Ingress)..."
helm repo add traefik https://traefik.github.io/charts
helm repo update
helm upgrade --install traefik traefik/traefik \
  --namespace kube-system \
  --set ports.web.redirectTo.port=websecure \
  --set ports.websecure.tls.enabled=true \
  --wait

echo "--> Installing KEDA..."
helm repo add kedacore https://kedacore.github.io/charts
helm repo update
helm upgrade --install keda kedacore/keda \
  --namespace keda \
  --create-namespace \
  --wait

echo "--> Helm repos updated for Grafana..."
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

echo "==> k3s provisioned successfully!"
REMOTE
