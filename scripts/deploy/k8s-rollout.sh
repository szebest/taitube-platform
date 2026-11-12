# Sourced by scripts/deploy.sh: what a Kubernetes deploy does after the apply (rollout, health gate, rollback).

apply_manifest() {
  if [ "$DRY_RUN" = 1 ]; then
    would "apply the kustomize build of $(state_dir) to namespace $(ns) with kubectl --context $(field cluster.context)"
    return 0
  fi
  manifest apply | kc apply -f -
}

wait_rollout() {
  local namespace d
  namespace="$(ns)"
  run kc -n "$namespace" wait --for=condition=complete job/vp-migrate --timeout=300s || {
    bad "the migration job did not complete"
    kc -n "$namespace" logs job/vp-migrate --tail=40 || true
    return 1
  }
  for d in vp-api vp-web vp-studio; do
    if [ "$DRY_RUN" = 1 ]; then
      would "kubectl -n $namespace rollout status deployment/$d --timeout=300s, when it exists"
    elif kc -n "$namespace" get "deployment/$d" >/dev/null 2>&1; then
      kc -n "$namespace" rollout status "deployment/$d" --timeout=300s || return 1
    fi
  done
}

api_url() {
  if [ "$(field kind)" = k3d ]; then echo "http://localhost:3000"; else echo "http://127.0.0.1:$PF_PORT"; fi
}

health_gate() {
  step "health gate: /readyz$([ "$(field health.smoke)" = true ] && echo ' and the smoke upload')"
  local namespace timeout url pf_pid="" waited=0 ready=0
  namespace="$(ns)"
  timeout="$(field health.readyzTimeoutSec)"
  if [ "$DRY_RUN" = 1 ]; then
    would "GET /readyz until it answers 200, for up to ${timeout}s"
    if [ "$(field health.smoke)" = true ]; then would "bash scripts/e2e-smoke.sh against the API"; fi
    return 0
  fi
  PF_PORT=$((20000 + RANDOM % 20000))
  if [ "$(field kind)" != k3d ]; then
    kc -n "$namespace" port-forward svc/vp-api "$PF_PORT:3000" >/dev/null 2>&1 &
    pf_pid=$!
  fi
  url="$(api_url)"
  while [ "$waited" -lt "$timeout" ]; do
    if curl -fsS --max-time 3 "$url/readyz" >/dev/null 2>&1; then ready=1; break; fi
    sleep 3; waited=$((waited + 3))
  done
  if [ "$ready" = 1 ]; then good "/readyz answered 200 after ${waited}s"; else bad "/readyz did not answer 200 within ${timeout}s"; fi
  if [ "$ready" = 1 ] && [ "$(field health.smoke)" = true ]; then
    API_URL="$url" bash scripts/e2e-smoke.sh >/dev/null && good "smoke upload reached READY" || { bad "the smoke upload failed"; ready=0; }
  fi
  if [ -n "$pf_pid" ]; then kill "$pf_pid" 2>/dev/null || true; fi
  [ "$ready" = 1 ]
}

deployment_revisions() {
  kc -n "$(ns)" get deploy -l "vp.dev/environment=$ENV" \
    -o go-template='{{range .items}}{{.metadata.name}}={{index .metadata.annotations "deployment.kubernetes.io/revision"}}{{"\n"}}{{end}}' 2>/dev/null || true
}

revision_of() { printf '%s\n' "$1" | sed -n "s/^$2=//p" | head -1; }

# rollback_deployments all | changed <revisions recorded before the apply>
rollback_deployments() {
  local mode="${1:-all}" before="${2:-}" namespace d name now
  namespace="$(ns)"
  step "rolling back to the previous revision"
  if [ "$DRY_RUN" = 1 ]; then
    if [ "$mode" = changed ]; then
      would "kubectl -n $namespace rollout undo each deployment labelled vp.dev/environment=$ENV whose revision the apply changed"
    else
      would "kubectl -n $namespace rollout undo every deployment labelled vp.dev/environment=$ENV"
    fi
    return 0
  fi
  now="$(deployment_revisions)"
  for d in $(kc -n "$namespace" get deploy -l "vp.dev/environment=$ENV" -o name 2>/dev/null); do
    name="${d#*/}"
    if [ "$mode" = changed ]; then
      if [ -z "$(revision_of "$before" "$name")" ] || [ "$(revision_of "$before" "$name")" = "$(revision_of "$now" "$name")" ]; then
        info "$name kept its revision: nothing to undo"
        continue
      fi
    fi
    kc -n "$namespace" rollout undo "$d" 2>&1 | sed 's/^/    /' || warn "$d has no earlier revision"
  done
  kc -n "$namespace" rollout status deployment/vp-api --timeout=180s || return 1
}
