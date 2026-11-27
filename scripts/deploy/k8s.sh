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

k8s_plan() {
  step "plan for $ENV: render and diff, nothing is applied"
  local rc=0
  static_checks || rc=$?
  step "what would be applied to namespace $(ns) with tag $(resolved_tag)"
  manifest plan | grep -E '^kind: ' | sort | uniq -c | sed 's/^/    /'
  step "diff against the cluster"
  if have kubectl && kc get ns >/dev/null 2>&1; then
    manifest plan | kc diff -f - | sed 's/^/    /' || true
  else
    info "not shown: context $(field cluster.context) is not reachable from here"
  fi
  return "$rc"
}

k8s_deploy() {
  step "deploy $ENV to $(field cluster.context) / $(ns), tag $(resolved_tag)"
  if [ "$DRY_RUN" = 1 ]; then info "dry run: nothing below is executed"; else ensure_dev_secrets; fi
  if [ "$(field kind)" = k3d ]; then
    check_tools || return $?
    bootstrap_cluster || return $?
    preflight_after_tools || return $?
  else
    preflight_all || return $?
    bootstrap_cluster
  fi
  helm_backing
  build_images
  if [ "$DRY_RUN" = 1 ]; then ensure_dev_secrets; fi
  step "apply"
  local before=""
  if [ "$DRY_RUN" = 0 ]; then before="$(deployment_revisions)"; fi
  run kc -n "$(ns)" delete job vp-migrate --ignore-not-found
  if ! { apply_manifest && wait_rollout && health_gate; }; then
    bad "the deploy of $ENV failed"
    rollback_deployments changed "$before" || warn "the rollback did not finish: check make deploy-status ENV=$ENV"
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
  kc -n "$(ns)" get deploy,scaledobject,job,pod -l "vp.dev/environment=$ENV"
  kc get ns "$(ns)" -o jsonpath='{.metadata.annotations.vp\.dev/expires-at}{"\n"}' 2>/dev/null | sed 's/^/    expires: /' || true
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
    run kc -n "$(ns)" logs "deploy/vp-$service" --tail="${TAIL:-200}" -f
  else
    run kc -n "$(ns)" logs "deploy/vp-$service" --tail="${TAIL:-200}"
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
  expired="$(kc get ns -l vp.dev/preview=true -o json | envctl expired-previews)"
  if [ -z "$expired" ]; then good "no preview has expired"; return 0; fi
  printf '%s\n' "$expired" | sed 's/^/    expired: /'
  if [ "$APPLY" = 1 ]; then
    # shellcheck disable=SC2086
    kc delete ns $expired
  else
    info "nothing deleted: pass APPLY=1 (make deploy-expire-previews APPLY=1) to delete them"
  fi
}
