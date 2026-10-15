# The four app images, built side by side from the one Dockerfile: `docker buildx bake --load`.
# With API_BUNDLE, WORKER_BUNDLE, WEB_BUNDLE and STUDIO_BUNDLE set to directories `scripts/bundle-app.sh`
# wrote, an image copies that bundle instead of building the app inside Docker.
variable "API_BUNDLE" {
  default = ""
}

variable "WORKER_BUNDLE" {
  default = ""
}

variable "WEB_BUNDLE" {
  default = ""
}

variable "STUDIO_BUNDLE" {
  default = ""
}

variable "WORKER_RUNTIME" {
  default = "bun"
}

group "default" {
  targets = ["api", "worker", "web", "studio"]
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

target "studio" {
  inherits = ["app"]
  target   = "studio"
  tags     = ["vp-studio:local"]
  contexts = STUDIO_BUNDLE == "" ? {} : { "studio-bundle" = STUDIO_BUNDLE }
}
