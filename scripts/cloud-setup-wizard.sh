#!/usr/bin/env bash
#
# Cloud Setup Wizard for video-pipeline (Ticket 31)
# Walks an operator through setting up Cloudflare, Hetzner, Neon, Grafana Cloud, and SOPS/age secrets.
#
# Generated based on the .agents/skills/wizard template.

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# Wizard library: delightful, consistent UX, identical across every wizard.
# ──────────────────────────────────────────────────────────────────────────

if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); RED=$(tput setaf 1)
else
  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; YELLOW=""; RED=""
fi

TOTAL_STAGES=6
_STAGE_INDEX=0
ENV_FILE="${ENV_FILE:-infra/terraform/terraform.tfvars}"
WRITTEN_ENV=()
WRITTEN_SECRET=()
SKIPPED=()

_clear() {
  [[ -t 1 ]] || return 0
  if command -v tput >/dev/null 2>&1; then tput clear; else printf '\033[2J\033[3J\033[H'; fi
}

banner() {
  _clear
  printf '\n%s%s  %s%s\n' "$BOLD" "$BLUE" "$1" "$RESET"
  printf '%s  %s stages%s\n\n' "$DIM" "$TOTAL_STAGES" "$RESET"
  printf '%s  You drive the browser; this wizard tells you exactly what to do and\n' "$DIM"
  printf '  captures the values you copy back. Stop any time with Ctrl-C and re-run\n'
  printf '  later, since it remembers values already saved.%s\n' "$RESET"
  pause "Ready to start?"
}

stage() {
  _clear
  _STAGE_INDEX=$((_STAGE_INDEX + 1))
  printf '\n%s%s▸ Stage %s/%s · %s%s\n' \
    "$BOLD" "$BLUE" "$_STAGE_INDEX" "$TOTAL_STAGES" "$1" "$RESET"
}

say()  { printf '  %s\n' "$1"; }
step() { printf '  %s•%s %s\n' "$BLUE" "$RESET" "$1"; }
note() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }

open_url() {
  local url="$1"
  printf '  %s↗ opening%s %s\n' "$GREEN" "$RESET" "$url"
  { if   command -v wslview      >/dev/null 2>&1; then wslview "$url"
    elif command -v explorer.exe >/dev/null 2>&1; then explorer.exe "$url"
    elif command -v xdg-open     >/dev/null 2>&1; then xdg-open "$url"
    elif command -v open         >/dev/null 2>&1; then open "$url"
    else warn "couldn't open a browser; visit it manually: $url"; fi
  } >/dev/null 2>&1 || warn "couldn't open a browser, so visit it manually: $url"
}

pause() {
  printf '  %s%s%s ' "$DIM" "${1:-Press Enter to continue}" "$RESET"
  read -r _ || true
}

confirm() {
  local reply=""
  printf '  %s? %s [y/N] ' "$YELLOW" "$1"
  read -r reply || true
  [[ "$reply" =~ ^[Yy] ]]
}

_existing() {
  [[ -f "$ENV_FILE" ]] || return 1
  local line; line=$(grep -E "^${1}\s*=" "$ENV_FILE" | tail -n1) || return 1
  local val="${line#*=}"
  val=$(echo "$val" | sed -e 's/^[[:space:]]*"//' -e 's/"[[:space:]]*$//')
  printf '%s' "$val"
}

ask() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -r input || true
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

ask_secret() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -rs input || true
  printf '\n'
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

write_tfvar() {
  local key="$1" value="$2" tmp
  touch "$ENV_FILE"
  tmp=$(mktemp)
  grep -vE "^${key}\s*=" "$ENV_FILE" > "$tmp" || true
  if [[ "$value" =~ ^[0-9]+$ ]]; then
    printf '%s = %s\n' "$key" "$value" >> "$tmp"
  else
    printf '%s = "%s"\n' "$key" "$value" >> "$tmp"
  fi
  mv "$tmp" "$ENV_FILE"
  WRITTEN_ENV+=("$key")
  printf '  %s✓ wrote%s %s → %s\n' "$GREEN" "$RESET" "$key" "$ENV_FILE"
}

finish() {
  _clear
  printf '\n%s%s  ✓ Cloud Setup Wizard Complete%s\n' "$BOLD" "$GREEN" "$RESET"
  (( ${#WRITTEN_ENV[@]} )) && note "wrote ${#WRITTEN_ENV[@]} variable(s) to $ENV_FILE: ${WRITTEN_ENV[*]}"
  if (( ${#SKIPPED[@]} )); then
    printf '\n'; warn "manual follow-ups:"
    for s in "${SKIPPED[@]}"; do note "  - $s"; done
  fi
  printf '\n'
  say "Next steps:"
  say "1. cd infra/terraform && terraform init && terraform plan"
  say "2. terraform apply"
  say "3. Store generated credentials in infra/k8s/overlays/cloud/secrets.enc.yaml"
  printf '\n'
}

# ──────────────────────────────────────────────────────────────────────────
# STAGES
# ──────────────────────────────────────────────────────────────────────────

banner "video-pipeline Cloud Setup Wizard (Phase 4)"

# ── Stage 1: Domain & Cloudflare Account ───────────────────────────────────
stage "Cloudflare: Domain & Account ID"
say "We need your Cloudflare Account ID and managed domain name."
open_url "https://dash.cloudflare.com"
step "In the Cloudflare dashboard, select your account/domain."
step "Find your 32-character Account ID on the right sidebar or URL."
ask cloudflare_account_id "Paste your Cloudflare Account ID:"
ask domain "Enter your domain name (e.g. example.com):"
ask admin_email "Enter operator email for /admin Zero Trust access:"
write_tfvar "cloudflare_account_id" "$cloudflare_account_id"
write_tfvar "domain" "$domain"
write_tfvar "admin_email" "$admin_email"

# ── Stage 2: Cloudflare API Token ──────────────────────────────────────────
stage "Cloudflare: Terraform API Token"
say "Create a custom API token with permissions for DNS, Tunnel, R2, and Access."
open_url "https://dash.cloudflare.com/profile/api-tokens"
step "Click 'Create Token' → 'Create Custom Token'."
step "Add permissions: Account.Workers R2 (Edit), Account.Cloudflare Tunnel (Edit), Account.Access Apps (Edit), Zone.DNS (Edit)."
step "Scope to your account and zone, then click 'Continue to summary' → 'Create Token'."
ask_secret cloudflare_api_token "Paste your Cloudflare API token:"
write_tfvar "cloudflare_api_token" "$cloudflare_api_token"

# ── Stage 3: Hetzner Cloud API & SSH Key ───────────────────────────────────
stage "Hetzner Cloud: API Token & SSH Key"
say "Configure Hetzner Cloud for the k3s VPS (CAX11 Arm64 or CX23 x86)."
open_url "https://console.hetzner.cloud"
step "In your project, navigate to Security → API Tokens and generate a Read & Write token."
ask_secret hcloud_token "Paste your Hetzner Cloud API token:"
write_tfvar "hcloud_token" "$hcloud_token"

step "Check your public SSH key (e.g. ~/.ssh/id_ed25519.pub)."
ask hcloud_ssh_public_key "Paste your SSH public key string:"
write_tfvar "hcloud_ssh_public_key" "$hcloud_ssh_public_key"

step "Determine your current public IP address for SSH firewall restriction."
ask operator_ssh_ip "Enter your public IPv4 CIDR (e.g. 203.0.113.10/32):"
write_tfvar "operator_ssh_ip" "$operator_ssh_ip"

write_tfvar "hcloud_location" "fsn1"
write_tfvar "hcloud_server_type" "cax11"
write_tfvar "raw_retention_days" "7"
write_tfvar "environment" "cloud"

# ── Stage 4: Neon PostgreSQL ───────────────────────────────────────────────
stage "Neon: Serverless PostgreSQL Setup"
say "Create a Neon serverless Postgres database for the cloud reference deployment."
open_url "https://console.neon.tech"
step "Create a project named 'video-pipeline' in region Frankfurt (eu-central-1)."
step "Copy the pooled connection string (feeds DATABASE_URL)."
step "Copy the direct unpooled connection string (feeds DATABASE_URL_MIGRATIONS)."
note "These values will be stored in infra/k8s/overlays/cloud/secrets.enc.yaml via SOPS."
pause "Confirm once you have copied your Neon database connection strings."

# ── Stage 5: Grafana Cloud Observability ───────────────────────────────────
stage "Grafana Cloud: OpenTelemetry & Observability"
say "Set up Grafana Cloud for remote metrics, traces, and logs."
open_url "https://grafana.com"
step "Go to your Grafana Cloud Portal → OpenTelemetry → Configure."
step "Note your OTLP Endpoint URL and generate an API Token."
step "Note the Basic Auth header (feeds OTEL_EXPORTER_OTLP_HEADERS)."
pause "Confirm once you have your Grafana Cloud credentials."

# ── Stage 6: SOPS & age Encryption ─────────────────────────────────────────
stage "Secrets: SOPS & age Key Management"
say "Check or generate an age key pair for decrypting secrets.enc.yaml."
if command -v age-keygen >/dev/null 2>&1; then
  step "age is installed on your system."
  note "Generate key: age-keygen -o age.key"
else
  warn "age-keygen not found. Install age (brew/apt/scoop) to manage encrypted secrets."
fi
note "Secret file location: infra/k8s/overlays/cloud/secrets.enc.yaml"
pause "Press Enter to finish cloud setup wizard."

finish
