#!/usr/bin/env bash
set -euo pipefail

# One command per environment: make deploy ENV=<env>. The typed half is `pnpm envctl` (packages/server/deploy).
# Exit codes: 0 ok, 1 failure, 2 usage, 3 prerequisite missing.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DRY_RUN=0 ENV="" SLUG="" TAG="" YES=0 CONFIRM="" APPLY=0 SERVICE="" FOLLOW=0 TAIL=""
COMMAND=""

# shellcheck disable=SC1091
. scripts/deploy/common.sh
# shellcheck disable=SC1091
. scripts/deploy/preflight.sh
# shellcheck disable=SC1091
. scripts/deploy/k8s.sh
# shellcheck disable=SC1091
. scripts/deploy/compose.sh

usage() {
  cat <<USAGE
scripts/deploy.sh <command> --env <name> [options]    (make deploy ENV=<name>)

Commands
  list                list the environments
  plan                render and diff; nothing is applied              (make deploy-plan)
  deploy              preflight, apply, health gate, rollback on failure   (make deploy)
  status              what is running                                  (make deploy-status)
  rollback            return to the previous revision                  (make deploy-rollback)
  logs                recent logs of one service                       (make deploy-logs)
  preflight           every check a deploy runs first, changing nothing  (make deploy-preflight)
  secrets-check       which expected secrets are missing, names only   (make secrets-check)
  expire-previews     list preview namespaces past their expiry        (make deploy-expire-previews)

Options
  --env <name>        environment (or ENV=)
  --slug <ref>        a branch or PR, for a preview
  --tag <tag>         image tag; a protected environment needs a pinned one
  --yes               confirm a protected environment (or --confirm <name>)
  --dry-run           run the static checks and print every step instead of executing it
  --service <name>    logs: api, web, studio, worker-probe, ... (default api)
  --follow, --tail N  logs
  --apply             expire-previews: delete what it lists
  -h, --help          this text

Nothing here applies to a cluster unless you run deploy or rollback without --dry-run.
Exit codes: 0 ok, 1 failure, 2 usage, 3 prerequisite missing.
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    -h | --help) usage; exit 0 ;;
    --dry-run) DRY_RUN=1 ;;
    --yes) YES=1 ;;
    --apply) APPLY=1 ;;
    --follow) FOLLOW=1 ;;
    --env | --slug | --tag | --confirm | --service | --tail)
      [ $# -ge 2 ] || die 2 "$1 takes a value (see --help)"
      case "$1" in
        --env) ENV="$2" ;; --slug) SLUG="$2" ;; --tag) TAG="$2" ;;
        --confirm) CONFIRM="$2" ;; --service) SERVICE="$2" ;; --tail) TAIL="$2" ;;
      esac
      shift ;;
    -*) die 2 "unknown option $1 (see --help)" ;;
    *) [ -z "$COMMAND" ] || die 2 "one command at a time: $COMMAND, $1"; COMMAND="$1" ;;
  esac
  shift
done

[ -n "$COMMAND" ] || { usage >&2; exit 2; }

if ! have pnpm || [ ! -d node_modules ]; then
  die 3 "pnpm and an installed workspace are needed: $(hint pnpm), then pnpm install"
fi

case "$COMMAND" in
  list) envctl list; exit 0 ;;
  plan | deploy | status | rollback | logs | preflight | secrets-check | expire-previews) ;;
  *) die 2 "unknown command $COMMAND (see --help)" ;;
esac

if [ -z "$ENV" ]; then
  if [ "$COMMAND" = expire-previews ]; then ENV=preview; else die 2 "$COMMAND needs --env <name>; one of: $(envctl list | cut -f1 | tr '\n' ' ')"; fi
fi
vars="$(envctl vars "$ENV" 2>&1)" || die 2 "$vars"
eval "$vars"
KIND="$(field kind)"
if [ "$COMMAND" = plan ]; then DRY_RUN=1; fi

case "$COMMAND:$KIND" in
  secrets-check:*) envctl secrets-check "$ENV" ;;
  preflight:*) preflight_all ;;
  plan:compose) compose_plan ;;
  plan:*) k8s_plan ;;
  deploy:compose) compose_deploy ;;
  deploy:*) k8s_deploy ;;
  status:compose) compose_status ;;
  status:*) k8s_status ;;
  rollback:compose) compose_rollback ;;
  rollback:*) k8s_rollback ;;
  logs:compose) compose_logs ;;
  logs:*) k8s_logs ;;
  expire-previews:compose) die 2 "$ENV is a compose environment: previews are namespaces" ;;
  expire-previews:*) k8s_expire ;;
esac
