# Sourced by scripts/deploy.sh: the compose environment (one VM, reached through a Docker context).

# compose <args>: docker compose against the environment's context, file, project and secrets file.
dc() {
  local envfile=()
  if [ -f "$(secrets_file)" ]; then envfile=(--env-file "$(secrets_file)"); fi
  docker --context "$(field compose.context)" compose \
    -f "$(field compose.file)" -p "$(field compose.project)" ${envfile[@]+"${envfile[@]}"} "$@"
}

compose_env() {
  VP_TAG="${1:-$(resolved_tag)}"
  VP_REGISTRY="$(field images.registry)"
  export VP_TAG VP_REGISTRY
}

remember_tag() {
  local dir
  dir="$(state_dir)"
  mkdir -p "$dir"
  if [ -f "$dir/current-tag" ]; then cp "$dir/current-tag" "$dir/previous-tag"; fi
  printf '%s\n' "$1" > "$dir/current-tag"
}

compose_health() {
  step "health gate: /readyz on the API container"
  local timeout waited=0
  timeout="$(field health.readyzTimeoutSec)"
  if [ "$DRY_RUN" = 1 ]; then
    would "docker compose exec api curl /readyz until it answers 200, for up to ${timeout}s"
    return 0
  fi
  while [ "$waited" -lt "$timeout" ]; do
    if dc exec -T api curl -fsS --max-time 3 http://localhost:3000/readyz >/dev/null 2>&1; then
      good "/readyz answered 200 after ${waited}s"
      return 0
    fi
    sleep 3; waited=$((waited + 3))
  done
  bad "/readyz did not answer 200 within ${timeout}s"
  return 1
}

compose_plan() {
  step "plan for $ENV: the compose file as it would run, nothing is applied"
  local rc=0
  static_checks || rc=$?
  compose_env
  step "services at $VP_REGISTRY, tag $VP_TAG"
  docker compose -f "$(field compose.file)" config --images | sort -u | sed 's/^/    /'
  step "diff against the VM"
  if [ "$(current_context)" = "$(field compose.context)" ]; then
    dc ps --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}' | sed 's/^/    /' || true
  else
    info "not shown: the current Docker context is '$(current_context)', $ENV declares $(field compose.context)"
  fi
  return "$rc"
}

compose_deploy() {
  local tag
  step "deploy $ENV to Docker context $(field compose.context)"
  if [ "$DRY_RUN" = 1 ]; then info "dry run: nothing below is executed"; fi
  preflight_all || return $?
  compose_env
  tag="$VP_TAG"
  step "pull and start tag $tag"
  run docker --context "$(field compose.context)" compose -f "$(field compose.file)" -p "$(field compose.project)" --env-file "$(secrets_file)" pull
  if ! { run docker --context "$(field compose.context)" compose -f "$(field compose.file)" -p "$(field compose.project)" --env-file "$(secrets_file)" up -d --remove-orphans --wait && compose_health; }; then
    bad "the deploy of $ENV failed"
    compose_rollback_to_previous || warn "the rollback did not finish: check make deploy-status ENV=$ENV"
    return 1
  fi
  if [ "$DRY_RUN" = 0 ]; then remember_tag "$tag"; fi
  if [ "$DRY_RUN" = 1 ]; then good "dry run of $ENV complete: nothing was changed"; else good "$ENV is deployed at $tag"; fi
}

remember_rollback() {
  local dir current=""
  dir="$(state_dir)"
  mkdir -p "$dir"
  if [ -f "$dir/current-tag" ]; then current="$(cat "$dir/current-tag")"; fi
  if [ -n "$current" ] && [ "$current" != "$1" ]; then printf '%s\n' "$current" > "$dir/previous-tag"; fi
  printf '%s\n' "$1" > "$dir/current-tag"
}

# compose_rollback_to_previous [tag]: without a tag, the one in previous-tag; a tag is the operator's choice.
compose_rollback_to_previous() {
  local target="${1:-}" file
  file="$(state_dir)/previous-tag"
  if [ -z "$target" ] && [ -f "$file" ]; then target="$(cat "$file")"; fi
  if [ -z "$target" ]; then
    if [ "$DRY_RUN" = 1 ]; then would "redeploy the tag recorded in $file"; return 0; fi
    bad "no previous tag is recorded in $file: pass TAG= to make deploy-rollback"
    return 1
  fi
  step "rolling back to $target"
  compose_env "$target"
  run docker --context "$(field compose.context)" compose -f "$(field compose.file)" -p "$(field compose.project)" --env-file "$(secrets_file)" up -d --remove-orphans --wait
  compose_health || return 1
  if [ "$DRY_RUN" = 0 ]; then remember_rollback "$target"; fi
}

compose_rollback() {
  step "rollback $ENV"
  if [ "$DRY_RUN" = 0 ]; then
    # shellcheck disable=SC2046
    show envctl confirm "$ENV" --context "$(current_context)" $(confirm_flags) || return 1
  fi
  compose_rollback_to_previous "${TAG:-}"
}

compose_status() {
  step "status of $ENV"
  if [ "$DRY_RUN" = 1 ]; then
    would "docker --context $(field compose.context) compose -p $(field compose.project) ps"
    return 0
  fi
  dc ps
}

compose_logs() {
  local service="${SERVICE:-api}"
  step "logs of $service"
  if [ "$FOLLOW" = 1 ]; then
    run docker --context "$(field compose.context)" compose -f "$(field compose.file)" -p "$(field compose.project)" logs --tail="${TAIL:-200}" -f "$service"
  else
    run docker --context "$(field compose.context)" compose -f "$(field compose.file)" -p "$(field compose.project)" logs --tail="${TAIL:-200}" "$service"
  fi
}
