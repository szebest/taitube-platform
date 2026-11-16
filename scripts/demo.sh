#!/usr/bin/env bash
set -euo pipefail

# Bootstrap for `make demo`: works on a fresh clone, before `pnpm install`. Everything else is `pnpm demo`.
# Exit codes: 0 ok, 1 failure, 2 usage, 3 prerequisite missing.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  RED=$'\033[31m'; GREEN=$'\033[32m'; BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
else
  RED=''; GREEN=''; BOLD=''; DIM=''; RESET=''
fi

usage() {
  cat <<USAGE
scripts/demo.sh [pnpm demo arguments]    (make demo)

Checks Node 24, pnpm 12, Docker (daemon and Compose v2) and ffmpeg, runs
pnpm install --frozen-lockfile when node_modules is missing or older than
pnpm-lock.yaml, creates .env from .env.example when it is absent, then runs
pnpm --silent demo with every argument you gave.

  --help      this text, then the pnpm demo options when dependencies are installed
  --dry-run   print these steps and, when dependencies are installed, the pnpm demo plan; execute nothing

Exit codes: 0 ok, 1 failure, 2 usage, 3 prerequisite missing.
USAGE
}

kind() {
  case "$(uname -s)" in
    Darwin) echo macos ;;
    Linux) if [ -n "${WSL_DISTRO_NAME:-}${WSL_INTEROP:-}" ]; then echo wsl; else echo linux; fi ;;
    *) echo linux ;;
  esac
}

hint() {
  local what="$1" platform
  platform="$(kind)"
  case "$what:$platform" in
    node:macos) echo "brew install node@24, then restart the shell" ;;
    node:wsl) echo "install Node 24 inside WSL (nvm install 24), not the Windows one" ;;
    node:*) echo "install Node 24 (nvm install 24)" ;;
    pnpm:*) echo "corepack enable && corepack prepare pnpm@12 --activate" ;;
    docker:macos) echo "start Docker Desktop, or: brew install colima docker docker-compose && colima start" ;;
    docker:wsl) echo "start Docker Desktop and enable Settings > Resources > WSL integration for this distro" ;;
    docker:*) echo "install Docker Engine and start it: sudo systemctl start docker" ;;
    compose:macos) echo "brew install docker-compose, or update Docker Desktop" ;;
    compose:*) echo "install the docker-compose-plugin package (Compose v2)" ;;
    ffmpeg:macos) echo "brew install ffmpeg" ;;
    ffmpeg:*) echo "sudo apt-get install ffmpeg (or your distro equivalent)" ;;
  esac
}

missing=0
need() {
  local what="$1" ok="$2" detail="$3"
  if [ "$ok" = 1 ]; then
    printf '  %sok%s    %s: %s\n' "$GREEN" "$RESET" "$what" "$detail"
  else
    printf '  %sFAIL%s  %s: %s\n        fix: %s\n' "$RED" "$RESET" "$what" "$detail" "$(hint "$what")" >&2
    missing=1
  fi
}

dry_run=0
help=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    --help | -h) help=1 ;;
  esac
done

cd "$ROOT"

if [ "$help" = 1 ]; then
  usage
  if [ -d node_modules ]; then
    echo
    exec pnpm --silent demo --help
  fi
  exit 0
fi

if [ "$dry_run" = 1 ]; then
  echo "Plan for scripts/demo.sh (dry run, nothing is executed)"
  echo "1 check Node 24, pnpm 12, docker daemon, docker compose v2, ffmpeg"
  echo "2 pnpm install --frozen-lockfile, when node_modules is missing or older than pnpm-lock.yaml"
  echo "3 create .env from .env.example when .env is absent"
  forwarded=()
  for arg in "$@"; do [ "$arg" = --dry-run ] || forwarded+=("$arg"); done
  echo "4 pnpm --silent demo ${forwarded[*]:-}"
  if [ -d node_modules ]; then
    echo
    exec pnpm --silent demo "$@"
  fi
  exit 0
fi

printf '%s[bootstrap] prerequisites%s\n' "$BOLD" "$RESET"
node_v="$(node -v 2>/dev/null || true)"
case "$node_v" in v24.*) need node 1 "$node_v" ;; *) need node 0 "${node_v:-not found}" ;; esac
pnpm_v="$(pnpm -v 2>/dev/null || true)"
case "$pnpm_v" in 12.*) need pnpm 1 "$pnpm_v" ;; *) need pnpm 0 "${pnpm_v:-not found}" ;; esac
if docker info >/dev/null 2>&1; then need docker 1 "daemon reachable"; else need docker 0 "daemon not reachable"; fi
compose_v="$(docker compose version --short 2>/dev/null || true)"
case "${compose_v#v}" in [2-9].*) need compose 1 "$compose_v" ;; *) need compose 0 "${compose_v:-not found}" ;; esac
if ffmpeg -version >/dev/null 2>&1; then need ffmpeg 1 "found"; else need ffmpeg 0 "not found"; fi
[ "$missing" = 0 ] || exit 3

if [ ! -d node_modules ] || [ pnpm-lock.yaml -nt node_modules/.modules.yaml ]; then
  printf '%s[bootstrap] pnpm install --frozen-lockfile%s\n' "$BOLD" "$RESET"
  pnpm install --frozen-lockfile || exit 1
fi

if [ ! -f .env ]; then
  if [ ! -f .env.example ]; then
    echo "${RED}.env.example is missing: run this from a full checkout${RESET}" >&2
    exit 1
  fi
  cp .env.example .env
  printf '%s[bootstrap] created .env from .env.example%s\n' "$DIM" "$RESET"
fi

exec pnpm --silent demo "$@"
