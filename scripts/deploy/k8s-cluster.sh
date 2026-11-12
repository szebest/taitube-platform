# Sourced by scripts/deploy.sh: what a Kubernetes deploy sets up before the apply (secrets file, cluster, backing services, images).

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
  run hc repo add bitnami https://charts.bitnami.com/bitnami --force-update
  run hc repo add minio https://charts.min.io/ --force-update
  run hc upgrade --install vp-postgres "$POSTGRES_CHART" --version "$POSTGRES_VERSION" -n "$namespace" --create-namespace -f infra/k8s/helm-values/postgres.yaml --set primary.persistence.enabled=false --wait
  run hc upgrade --install vp-redis "$REDIS_CHART" --version "$REDIS_VERSION" -n "$namespace" --create-namespace -f infra/k8s/helm-values/redis.yaml --set master.persistence.enabled=false --wait
  run hc upgrade --install vp-minio "$MINIO_CHART" --version "$MINIO_VERSION" -n "$namespace" --create-namespace -f infra/k8s/helm-values/minio.yaml --set persistence.enabled=false --wait
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
