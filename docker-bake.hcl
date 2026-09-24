# The two app images, built side by side: `docker buildx bake --load`.
group "default" {
  targets = ["api", "worker"]
}

target "api" {
  context    = "."
  dockerfile = "apps/api/Dockerfile"
  tags       = ["vp-api:local"]
}

target "worker" {
  context    = "."
  dockerfile = "apps/worker/Dockerfile"
  args       = { WORKER_RUNTIME = "bun" }
  tags       = ["vp-worker:local"]
}
