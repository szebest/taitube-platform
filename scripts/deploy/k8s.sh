# Sourced by scripts/deploy.sh: the Kubernetes environments (kind k3d and k3s).

render_overlay() {
  local args=(render "$ENV" --tag "$(resolved_tag)")
  if [ -n "$SLUG" ]; then args+=(--slug "$SLUG"); fi
  envctl "${args[@]}"
}

ns() { resolved_namespace; }

# The manifest to apply. The dev-mode ADMIN_TOKEN placeholder becomes the token from .secrets/<env>.env.
manifest() {
  local dir token
  dir="$(render_overlay)" || return 1
  if [ "$1" = apply ] && [ -f "$(secrets_file)" ] && grep -q '^ADMIN_TOKEN=' "$(secrets_file)"; then
    token="$(grep '^ADMIN_TOKEN=' "$(secrets_file)" | head -1 | cut -d= -f2-)"
    kustomize_build "$dir" | sed -e "s/change-me-admin-token-local-cluster/$token/"
  else
    kustomize_build "$dir"
  fi
}

ensure_dev_secrets() {
  local file legacy=infra/k8s/overlays/local/secrets.env
  file="$(secrets_file)"
  case " $(field secrets.keys) " in *" ADMIN_TOKEN "*) ;; *) return 0 ;; esac
  if [ "$DRY_RUN" = 1 ]; then
    would "write $file with a random ADMIN_TOKEN when it does not exist"
    return 0
  fi
  mkdir -p .secrets
  if [ ! -f "$file" ] && [ "$ENV" = local ] && [ -f "$legacy" ]; then cp "$legacy" "$file"; fi
  if [ ! -f "$file" ]; then printf 'ADMIN_TOKEN=%s\n' "$(openssl rand -hex 32)" > "$file"; fi
  chmod 600 "$file"
  good "$file holds ADMIN_TOKEN"
}

bootstrap_cluster() {
  step "cluster"
  case "$(field kind)" in
    k3d)
      local name
      name="$(field cluster.context)"; name="${name#k3d-}"
      if have k3d && k3d cluster list 2>/dev/null | grep -q "^$name "; then
        good "k3d cluster $name exists"
      else
        run make k3d-up CLUSTER_NAME="$name"
      fi ;;
    k3s) info "an existing cluster: context $(field cluster.context)" ;;
  esac
}

helm_backing() {
  if [ "$(field cluster.backing)" != helm ] || [ "$(field kind)" = k3d ]; then return 0; fi
  step "Postgres, Redis and MinIO in the namespace (Helm, no persistence)"
  # shellcheck disable=SC1091
  . infra/k8s/charts.env
  local namespace
  namespace="$(ns)"
  run helm repo add bitnami https://charts.bitnami.com/bitnami --force-update
  run helm repo add minio https://charts.min.io/ --force-update
  run helm upgrade --install vp-postgres "$POSTGRES_CHART" --version "$POSTGRES_VERSION" -n "$namespace" --create-namespace -f infra/k8s/helm-values/postgres.yaml --set primary.persistence.enabled=false --wait
  run helm upgrade --install vp-redis "$REDIS_CHART" --version "$REDIS_VERSION" -n "$namespace" --create-namespace -f infra/k8s/helm-values/redis.yaml --set master.persistence.enabled=false --wait
  run helm upgrade --install vp-minio "$MINIO_CHART" --version "$MINIO_VERSION" -n "$namespace" --create-namespace -f infra/k8s/helm-values/minio.yaml --set persistence.enabled=false --wait
}

build_images() {
  if [ "$(field images.source)" != build ]; then return 0; fi
  step "images from this checkout"
  run docker buildx bake --load
  if [ "$(field kind)" = k3d ]; then
    local name
    name="$(field cluster.context)"; name="${name#k3d-}"
    run k3d image import vp-api:local vp-worker:local vp-web:local vp-studio:local -c "$name"
  fi
}

apply_manifest() {
  if [ "$DRY_RUN" = 1 ]; then
    printf '    %s[dry-run]%s kustomize build %s | kubectl apply -n %s -f -\n' "$DIM" "$RESET" "$(state_dir)" "$(ns)"
    return 0
  fi
  manifest apply | kubectl apply -f -
}

wait_rollout() {
  local namespace d
  namespace="$(ns)"
  run kubectl -n "$namespace" wait --for=condition=complete job/vp-migrate --timeout=300s || {
    bad "the migration job did not complete"
    kubectl -n "$namespace" logs job/vp-migrate --tail=40 || true
    return 1
  }
  for d in vp-api vp-web vp-studio; do
    if [ "$DRY_RUN" = 1 ]; then
      would "kubectl -n $namespace rollout status deployment/$d --timeout=300s, when it exists"
    elif kubectl -n "$namespace" get "deployment/$d" >/dev/null 2>&1; then
      kubectl -n "$namespace" rollout status "deployment/$d" --timeout=300s || return 1
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
    kubectl -n "$namespace" port-forward svc/vp-api "$PF_PORT:3000" >/dev/null 2>&1 &
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

verify_secret_names() {
  if [ "$(field secrets.source)" != external-secrets ]; then return 0; fi
  step "secret names in the cluster (names only)"
  if [ "$DRY_RUN" = 1 ]; then
    would "compare the keys of Secret vp-secrets with secrets.keys, printing names only"
    return 0
  fi
  local present key missing=""
  present="$(kubectl -n "$(ns)" get secret vp-secrets -o go-template='{{range $k, $v := .data}}{{$k}}{{"\n"}}{{end}}' 2>/dev/null || true)"
  for key in $(field secrets.keys); do
    printf '%s\n' "$present" | grep -qx "$key" || missing="$missing $key"
  done
  if [ -z "$missing" ]; then good "vp-secrets holds every expected key"; return 0; fi
  bad "vp-secrets lacks:$missing"
  return 1
}

rollback_deployments() {
  local namespace d
  namespace="$(ns)"
  step "rolling back to the previous revision"
  if [ "$DRY_RUN" = 1 ]; then
    would "kubectl -n $namespace rollout undo every deployment labelled vp.dev/environment=$ENV"
    return 0
  fi
  for d in $(kubectl -n "$namespace" get deploy -l "vp.dev/environment=$ENV" -o name 2>/dev/null); do
    kubectl -n "$namespace" rollout undo "$d" 2>&1 | sed 's/^/    /' || warn "$d has no earlier revision"
  done
  kubectl -n "$namespace" rollout status deployment/vp-api --timeout=180s || return 1
}

k8s_plan() {
  step "plan for $ENV: render and diff, nothing is applied"
  local rc=0
  static_checks || rc=$?
  step "what would be applied to namespace $(ns) with tag $(resolved_tag)"
  manifest plan | grep -E '^kind: ' | sort | uniq -c | sed 's/^/    /'
  step "diff against the cluster"
  if [ "$(current_context)" = "$(field cluster.context)" ] && have kubectl && kubectl get ns >/dev/null 2>&1; then
    manifest plan | kubectl diff -f - | sed 's/^/    /' || true
  else
    info "not shown: the current context is '$(current_context)', $ENV declares $(field cluster.context)"
  fi
  return "$rc"
}

k8s_deploy() {
  step "deploy $ENV to $(field cluster.context) / $(ns), tag $(resolved_tag)"
  if [ "$DRY_RUN" = 1 ]; then info "dry run: nothing below is executed"; else ensure_dev_secrets; fi
  preflight_all || return $?
  bootstrap_cluster
  helm_backing
  build_images
  if [ "$DRY_RUN" = 1 ]; then ensure_dev_secrets; fi
  step "apply"
  run kubectl -n "$(ns)" delete job vp-migrate --ignore-not-found
  if ! { apply_manifest && wait_rollout && verify_secret_names && health_gate; }; then
    bad "the deploy of $ENV failed"
    rollback_deployments || warn "the rollback did not finish: check make deploy-status ENV=$ENV"
    return 1
  fi
  if [ "$DRY_RUN" = 1 ]; then good "dry run of $ENV complete: nothing was changed"; else good "$ENV is deployed at $(resolved_tag)"; fi
}

k8s_status() {
  step "status of $ENV in $(ns)"
  if [ "$DRY_RUN" = 1 ]; then
    would "kubectl -n $(ns) get deploy,scaledobject,job,pod -l vp.dev/environment=$ENV"
    return 0
  fi
  kubectl -n "$(ns)" get deploy,scaledobject,job,pod -l "vp.dev/environment=$ENV"
  kubectl get ns "$(ns)" -o jsonpath='{.metadata.annotations.vp\.dev/expires-at}{"\n"}' 2>/dev/null | sed 's/^/    expires: /' || true
}

k8s_rollback() {
  step "rollback $ENV"
  if [ "$DRY_RUN" = 0 ]; then
    # shellcheck disable=SC2046
    show envctl confirm "$ENV" --context "$(current_context)" $(confirm_flags) || return 1
  fi
  rollback_deployments
}

k8s_logs() {
  local service="${SERVICE:-api}"
  step "logs of vp-$service in $(ns)"
  if [ "$FOLLOW" = 1 ]; then
    run kubectl -n "$(ns)" logs "deploy/vp-$service" --tail="${TAIL:-200}" -f
  else
    run kubectl -n "$(ns)" logs "deploy/vp-$service" --tail="${TAIL:-200}"
  fi
}

k8s_expire() {
  step "preview namespaces past their expiry"
  if [ "$DRY_RUN" = 1 ]; then
    would "kubectl get ns -l vp.dev/preview=true -o json | pnpm envctl expired-previews"
    return 0
  fi
  show envctl confirm "$ENV" --context "$(current_context)" || return 1
  local expired
  expired="$(kubectl get ns -l vp.dev/preview=true -o json | envctl expired-previews)"
  if [ -z "$expired" ]; then good "no preview has expired"; return 0; fi
  printf '%s\n' "$expired" | sed 's/^/    expired: /'
  if [ "$APPLY" = 1 ]; then
    # shellcheck disable=SC2086
    kubectl delete ns $expired
  else
    info "nothing deleted: pass APPLY=1 (make deploy-expire-previews APPLY=1) to delete them"
  fi
}
