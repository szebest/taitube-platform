# The two app images, built side by side: `docker buildx bake --load`.
# With API_BUNDLE and WORKER_BUNDLE set to directories `scripts/bundle-app.sh` wrote, an image
# copies that bundle instead of building the app inside Docker.
variable "API_BUNDLE" {
  default = ""
}

variable "WORKER_BUNDLE" {
  default = ""
}

group "default" {
  targets = ["api", "worker"]
}

target "api" {
  context    = "."
  dockerfile = "apps/api/Dockerfile"
  tags       = ["vp-api:local"]
  contexts   = API_BUNDLE == "" ? {} : { bundle = API_BUNDLE }
}

target "worker" {
  context    = "."
  dockerfile = "apps/worker/Dockerfile"
  args       = { WORKER_RUNTIME = "bun" }
  tags       = ["vp-worker:local"]
  contexts   = WORKER_BUNDLE == "" ? {} : { bundle = WORKER_BUNDLE }
}
