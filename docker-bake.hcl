# The three app images, built side by side from the one Dockerfile: `docker buildx bake --load`.
# With API_BUNDLE, WORKER_BUNDLE and WEB_BUNDLE set to directories `scripts/bundle-app.sh` wrote, an
# image copies that bundle instead of building the app inside Docker.
variable "API_BUNDLE" {
  default = ""
}

variable "WORKER_BUNDLE" {
  default = ""
}

variable "WEB_BUNDLE" {
  default = ""
}

variable "WORKER_RUNTIME" {
  default = "bun"
}

group "default" {
  targets = ["api", "worker", "web"]
}

target "app" {
  context    = "."
  dockerfile = "Dockerfile"
}

target "api" {
  inherits = ["app"]
  target   = "api"
  tags     = ["vp-api:local"]
  contexts = API_BUNDLE == "" ? {} : { "api-bundle" = API_BUNDLE }
}

target "worker" {
  inherits = ["app"]
  target   = "worker"
  args     = { WORKER_RUNTIME = WORKER_RUNTIME }
  tags     = ["vp-worker:local"]
  contexts = WORKER_BUNDLE == "" ? {} : { "worker-bundle" = WORKER_BUNDLE }
}

target "web" {
  inherits = ["app"]
  target   = "web"
  tags     = ["vp-web:local"]
  contexts = WEB_BUNDLE == "" ? {} : { "web-bundle" = WEB_BUNDLE }
}
