# Sourced by scripts/deploy.sh. Every check here is read-only. Under --dry-run the ones that need a cluster,
# a registry or the operator's confirmation are named, not run.

current_context() {
  if [ "$(field kind)" = compose ]; then
    docker context show 2>/dev/null || true
  else
    kube_current_context
  fi
}

context_field() {
  if [ "$(field kind)" = compose ]; then echo compose.context; else echo cluster.context; fi
}

check_tools() {
  step "tools"
  need_tool git
  need_tool pnpm
  case "$(field kind)" in
    k3d)
      need_tool kubectl runtime; need_tool k3d runtime; need_tool helm runtime; need_tool docker runtime ;;
    k3s)
      need_tool kubectl runtime
      if [ "$(field cluster.backing)" = helm ]; then need_tool helm runtime; fi
      if [ "$(field images.source)" = build ]; then need_tool docker runtime; fi ;;
    compose) need_tool docker ;;
  esac
  if [ "$(field kind)" != compose ] && ! have kustomize && ! have kubectl; then
    bad "neither kustomize nor kubectl found: $(hint kustomize)"
    MISSING=1
  fi
  if [ "$MISSING" = 0 ]; then return 0; else return 3; fi
}

check_spec() {
  step "environment files"
  show envctl validate
}

check_gate() {
  step "context and confirmation"
  local ctx
  ctx="$(current_context)"
  if [ "$DRY_RUN" = 1 ]; then
    would "refuse unless the current context (${ctx:-none}) is $(field "$(context_field)"), the tag is pinned and the deploy is confirmed"
    return 0
  fi
  # shellcheck disable=SC2046
  show envctl gate "$ENV" --context "$ctx" --tag "$(resolved_tag)" $(confirm_flags) && good "context $ctx is the one $ENV declares"
}

# Names only, against the cluster: an external-secrets environment keeps its values in the store, not on this machine.
verify_secret_names() {
  step "secret names in the cluster (names only)"
  if [ "$DRY_RUN" = 1 ]; then
    would "compare the keys of Secret vp-secrets with secrets.keys, printing names only"
    return 0
  fi
  local present key missing=""
  if ! present="$(kc -n "$(ns)" get secret vp-secrets -o go-template='{{range $k, $v := .data}}{{$k}}{{"\n"}}{{end}}' 2>/dev/null)"; then
    warn "Secret vp-secrets is not in $(ns) yet: the ExternalSecret creates it on the first apply"
    return 0
  fi
  for key in $(field secrets.keys); do
    printf '%s\n' "$present" | grep -qx "$key" || missing="$missing $key"
  done
  if [ -z "$missing" ]; then good "vp-secrets holds every expected key"; return 0; fi
  bad "vp-secrets lacks:$missing"
  return 1
}

check_secrets() {
  if [ "$(field secrets.source)" = external-secrets ]; then verify_secret_names; return; fi
  step "secrets, by name"
  if show envctl secrets-check "$ENV"; then return 0; fi
  if [ "$DRY_RUN" = 1 ]; then
    warn "a real run stops here until the secrets are in $(secrets_file)"
    return 0
  fi
  return 1
}

check_images() {
  step "images exist for the tag"
  if [ "$(field images.source)" = build ]; then
    info "built from this checkout: nothing to look up"
    return 0
  fi
  local tag registry image
  tag="$(resolved_tag)" || return 3
  registry="$(field images.registry)"
  for image in vp-api vp-worker; do
    if [ "$DRY_RUN" = 1 ]; then
      would "docker buildx imagetools inspect $registry/$image:$tag"
    elif docker buildx imagetools inspect "$registry/$image:$tag" >/dev/null 2>&1; then
      good "$registry/$image:$tag"
    else
      bad "$registry/$image:$tag is not in the registry: run the Images workflow with push, or pass TAG="
      return 1
    fi
  done
}

check_migrations() {
  step "migrations are forward-only"
  if [ "$(field production)" != true ]; then
    info "skipped: $ENV is not a production-mode environment (CI checks every pull request)"
    return 0
  fi
  show envctl migrations-check --base "${MIGRATIONS_BASE:-origin/main}"
}

check_manifests() {
  step "manifests render and validate"
  if [ "$(field kind)" = compose ]; then
    local file
    file="$(field compose.file)"
    show docker compose -f "$file" config -q && good "$file is valid compose"
    return
  fi
  local dir
  dir="$(render_overlay)" || return 1
  kustomize_build "$dir" >/dev/null && good "$dir builds"
  show bash scripts/validate-k8s.sh "$ENV" >/dev/null && good "scripts/validate-k8s.sh $ENV"
}

check_terraform() {
  step "terraform"
  if ! have terraform; then info "skipped: terraform is not installed"; return 0; fi
  if [ "$(field kind)" = compose ] || [ "$(field production)" != true ]; then
    info "skipped: $ENV has no cloud resources"
    return 0
  fi
  terraform -chdir=infra/terraform fmt -check -recursive >/dev/null && good "terraform fmt"
  if [ -d infra/terraform/.terraform ]; then
    terraform -chdir=infra/terraform validate >/dev/null && good "terraform validate"
  else
    info "validate skipped: terraform -chdir=infra/terraform init -backend=false first (CI does)"
  fi
}

check_cluster() {
  if [ "$(field kind)" = compose ]; then return 0; fi
  step "cluster prerequisites"
  local crds="scaledobjects.keda.sh servicemonitors.monitoring.coreos.com" crd failed=0
  if [ "$(field secrets.source)" = external-secrets ]; then crds="$crds externalsecrets.external-secrets.io"; fi
  if [ "$DRY_RUN" = 1 ]; then
    would "kubectl get crd $crds"
    return 0
  fi
  for crd in $crds; do
    if kc get crd "$crd" >/dev/null 2>&1; then good "$crd"; else bad "$crd is not installed in this cluster"; failed=1; fi
  done
  return "$failed"
}

# Every check runs; one that fails does not hide the next, and the worst exit code wins.
run_checks() {
  local code=0 check rc
  for check in "$@"; do
    rc=0
    "$check" || rc=$?
    if [ "$rc" -gt "$code" ]; then code=$rc; fi
  done
  return "$code"
}

PREFLIGHT_AFTER_TOOLS="check_spec check_gate check_secrets check_images check_migrations check_manifests check_terraform check_cluster"

preflight_all() {
  # shellcheck disable=SC2086
  run_checks check_tools $PREFLIGHT_AFTER_TOOLS
}

# For a cluster the deploy creates itself: tools first, the cluster, then these.
preflight_after_tools() {
  # shellcheck disable=SC2086
  run_checks $PREFLIGHT_AFTER_TOOLS
}

# What a dry run proves with no cluster or registry: tools, files, manifests, migrations.
static_checks() {
  run_checks check_tools check_spec check_migrations check_manifests check_terraform
}
