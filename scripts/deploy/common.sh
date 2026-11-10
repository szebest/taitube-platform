# Sourced by scripts/deploy.sh. Exit codes: 0 ok, 1 failure, 2 usage, 3 prerequisite missing.

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BOLD=''; DIM=''; RESET=''
fi

step() { printf '%s==> %s%s\n' "$BOLD" "$*" "$RESET"; }
info() { printf '    %s\n' "$*"; }
good() { printf '    %sok%s    %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '    %swarn%s  %s\n' "$YELLOW" "$RESET" "$*"; }
bad() { printf '    %sFAIL%s  %s\n' "$RED" "$RESET" "$*" >&2; }
would() { printf '    %swould%s %s\n' "$DIM" "$RESET" "$*"; }
die() { local code="$1"; shift; printf '%s%s%s\n' "$RED" "$*" "$RESET" >&2; exit "$code"; }

# Runs a command, or prints it under --dry-run. Nothing mutating goes around this.
run() {
  if [ "$DRY_RUN" = 1 ]; then
    local shown="$*"
    case "$1" in
      kc) shown="kubectl --context $(field cluster.context) ${*:2}" ;;
      hc) shown="helm --kube-context $(field cluster.context) ${*:2}" ;;
    esac
    printf '    %s[dry-run]%s %s\n' "$DIM" "$RESET" "$shown"
    return 0
  fi
  "$@"
}

have() { command -v "$1" >/dev/null 2>&1; }

envctl() { pnpm --silent exec tsx --conditions=source packages/server/deploy/src/main.ts "$@"; }

# Reads the environment once into E_<path> variables, then field cluster.context answers from them.
load_environment() { eval "$(envctl vars "$ENV")"; }
field() {
  local var="E_${1//[^A-Za-z0-9]/_}"
  printf '%s' "${!var:-}"
}

# The only places kubectl and helm are named: every call goes to the context the environment declares, not
# whichever one is current when it runs. A k3d context exists only once bootstrap_cluster has made it.
kc() { kubectl --context "$(field cluster.context)" "$@"; }
hc() { helm --kube-context "$(field cluster.context)" "$@"; }
kube_current_context() { kubectl config current-context 2>/dev/null || true; }

kustomize_build() {
  if have kustomize; then kustomize build "$1"; else kc kustomize "$1"; fi
}

state_dir() { echo ".deploy/$ENV"; }
secrets_file() { echo ".secrets/$ENV.env"; }

resolved_tag() {
  if [ -n "$TAG" ]; then envctl tag "$ENV" --tag "$TAG"; else envctl tag "$ENV"; fi
}

resolved_namespace() {
  if [ -n "$SLUG" ]; then envctl namespace "$ENV" --slug "$SLUG"; else envctl namespace "$ENV"; fi
}

hint() {
  case "$1:$(uname -s)" in
    kubectl:Darwin) echo "brew install kubectl" ;;
    kubectl:*) echo "install kubectl: https://kubernetes.io/docs/tasks/tools/" ;;
    kustomize:Darwin) echo "brew install kustomize (or use kubectl kustomize)" ;;
    kustomize:*) echo "install kustomize, or use kubectl kustomize" ;;
    helm:Darwin) echo "brew install helm" ;;
    helm:*) echo "install helm: https://helm.sh/docs/intro/install/" ;;
    k3d:Darwin) echo "brew install k3d" ;;
    k3d:*) echo "install k3d: https://k3d.io" ;;
    docker:Darwin) echo "start Docker Desktop, or: brew install colima docker && colima start" ;;
    docker:*) echo "install Docker Engine and start it" ;;
    pnpm:*) echo "corepack enable && corepack prepare pnpm@12 --activate" ;;
    git:*) echo "install git" ;;
    *) echo "install $1" ;;
  esac
}

# Runs a command, prints its output indented and keeps its exit status.
show() {
  local out rc=0
  out="$("$@" 2>&1)" || rc=$?
  if [ -n "$out" ]; then printf '%s\n' "$out" | sed 's/^/    /'; fi
  return "$rc"
}

MISSING=0
# need_tool <tool> [runtime]: a runtime tool only a real run uses is a warning under --dry-run.
need_tool() {
  if have "$1"; then
    good "$1 found"
  elif [ "${2:-}" = runtime ] && [ "$DRY_RUN" = 1 ]; then
    warn "$1 not found, a real run needs it: $(hint "$1")"
  else
    bad "$1 not found: $(hint "$1")"
    MISSING=1
  fi
}

# --yes and --confirm as the operator gave them, for envctl gate and envctl confirm.
confirm_flags() {
  if [ "$YES" = 1 ]; then printf '%s ' --yes; fi
  if [ -n "$CONFIRM" ]; then printf '%s %s' --confirm "$CONFIRM"; fi
}
