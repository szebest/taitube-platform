SHELL := /bin/bash
COMPOSE_FILE := infra/compose/docker-compose.yml
REDIS_IMAGE ?= redis:7-alpine

CLUSTER_TOOL ?= k3d
CLUSTER_NAME ?= vp

.PHONY: help up down logs psql redis-cli mc check-redis nuke test test-bun lint format typecheck clean smoke smoke-infra smoke-offline e2e chaos-kill obs-up obs-down obs-check k3d-up k3d-down k3d-deploy k8s-local-secrets k8s-validate load-s1 load-s2 load-s3 load-smoke

help: ## Show help for each target
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

up: ## Start local infrastructure (Postgres, Redis, MinIO, minio-init)
	REDIS_IMAGE=$(REDIS_IMAGE) docker compose -f $(COMPOSE_FILE) up -d --wait

doctor: ## Check developer prerequisites
	@echo "Checking prerequisites..."
	@node -v | grep -q 'v24' || (echo "Node.js 24 required"; exit 1)
	@bun -v | grep -q '^1.4' || (echo "Bun 1.4 required"; exit 1)
	@pnpm -v | grep -q '10.' || (echo "pnpm 10 required"; exit 1)
	@docker -v >/dev/null || (echo "Docker required"; exit 1)
	@docker compose version >/dev/null || (echo "Docker Compose required"; exit 1)
	@ffmpeg -version >/dev/null || (echo "FFmpeg required"; exit 1)
	@echo "All prerequisites met."

setup: doctor ## Fast bootstrap environment
	@if [ ! -f .env ]; then cp .env.example .env && echo "Created .env"; fi
	pnpm install
	$(MAKE) up-all

dev: setup ## Alias for setup

up-all: ## Start full stack (infra, migrations, API, all worker stages)
	REDIS_IMAGE=$(REDIS_IMAGE) docker compose -f $(COMPOSE_FILE) up -d --build --wait

build-images: ## Build local Docker images for API and Worker
	docker compose -f $(COMPOSE_FILE) build

down: ## Stop local infrastructure
	docker compose -f $(COMPOSE_FILE) down -v --remove-orphans -t 1

logs: ## Follow infrastructure logs
	docker compose -f $(COMPOSE_FILE) logs -f

prune: ## Safe local pruning utility to reclaim Docker disk space
	docker system prune -f --volumes
	docker image prune -f

psql: ## Open psql shell in Postgres container
	docker compose -f $(COMPOSE_FILE) exec postgres psql -U vp -d vp

redis-cli: ## Open redis-cli in Redis container
	docker compose -f $(COMPOSE_FILE) exec redis redis-cli -a vp

mc: ## Run MinIO Client (mc) inside compose
	docker compose -f $(COMPOSE_FILE) run --rm minio-init mc $(ARGS)

check-redis: ## Assert Redis configuration satisfies BullMQ requirements (noeviction + appendonly)
	@echo "Checking Redis maxmemory-policy..."
	@docker compose -f $(COMPOSE_FILE) exec -T redis redis-cli -a vp config get maxmemory-policy | grep -q noeviction || (echo "Redis maxmemory-policy is not noeviction!" && exit 1)
	@echo "Checking Redis appendonly..."
	@docker compose -f $(COMPOSE_FILE) exec -T redis redis-cli -a vp config get appendonly | grep -q yes || (echo "Redis appendonly is not yes!" && exit 1)
	@echo "Redis configuration OK."

nuke: ## Teardown all containers and delete all persistent volumes
	docker compose -f $(COMPOSE_FILE) down -v --remove-orphans

test: ## Run Vitest tests across all workspace packages
	pnpm test

test-bun: ## Run Bun tests for worker runtime parity
	pnpm test:bun

lint: ## Run Biome linter across workspace
	pnpm lint

format: ## Format codebase with Biome
	pnpm format

typecheck: ## Typecheck all workspace packages with TypeScript
	pnpm typecheck

clean: ## Clean build artifacts and dist directories
	pnpm clean

smoke: ## Run end-to-end smoke tests against running stack
	bash scripts/e2e-smoke.sh

smoke-fast: ## Run smoke tests against active containers in under 5 seconds
	API_URL=http://127.0.0.1:3000 TIMEOUT_SEC=5 bash scripts/e2e-smoke.sh

smoke-infra: ## Run infrastructure smoke tests
	bash infra/compose/test.sh

smoke-offline: ## Run smoke tests in offline mode (internal network with zero internet egress)
	docker compose -f $(COMPOSE_FILE) down -v --remove-orphans 2>/dev/null || true
	sudo sysctl -w net.ipv4.conf.all.route_localnet=1 2>/dev/null || true
	which iptables >/dev/null 2>&1 && (sudo iptables -t nat -C POSTROUTING -d 172.16.0.0/12 -s 127.0.0.1 -j MASQUERADE 2>/dev/null || sudo iptables -t nat -A POSTROUTING -d 172.16.0.0/12 -s 127.0.0.1 -j MASQUERADE 2>/dev/null) || true
	REDIS_IMAGE=$(REDIS_IMAGE) docker compose -f $(COMPOSE_FILE) -f infra/compose/docker-compose.offline.yml up -d --build --wait --wait-timeout 180
	docker compose -f $(COMPOSE_FILE) -f infra/compose/docker-compose.offline.yml exec -T api curl -s --connect-timeout 2 http://1.1.1.1 >/dev/null 2>&1 && { echo "ERROR: Container reached the internet!"; exit 1; } || echo "Verified: Containers have zero internet egress."
	API_URL=http://127.0.0.1:3000 bash scripts/e2e-smoke.sh

e2e: ## Run Phase 2 pipeline E2E acceptance suite (20 concurrent videos + hostile set; E2E_REDUCED=true for the CI set)
	bun scripts/run-e2e.ts

chaos-kill: ## Run crash-safety chaos test (kill worker mid-transcode, assert effectively-once READY)
	bash scripts/chaos-kill.sh 5

obs-up: ## Start observability stack profile (Prometheus, Grafana, Tempo, Loki, OTel collector, Alertmanager)
	docker compose -f $(COMPOSE_FILE) --profile observability up -d

obs-down: ## Stop observability stack
	docker compose -f $(COMPOSE_FILE) --profile observability stop

obs-check: ## Assert observability stack targets UP and healthy via Prometheus API
	bash scripts/obs-check.sh

k8s-local-secrets: ## Write the local overlay's git-ignored Secret patch with random values, once
	@test -f infra/k8s/overlays/local/secrets.patch.yaml || printf 'apiVersion: v1\nkind: Secret\nmetadata:\n  name: vp-secrets\n  namespace: video-pipeline\nstringData:\n  ADMIN_TOKEN: "%s"\n  WEBHOOK_SIGNING_SECRET: "%s"\n' "$$(openssl rand -hex 32)" "$$(openssl rand -hex 32)" > infra/k8s/overlays/local/secrets.patch.yaml

k8s-validate: k8s-local-secrets ## Validate Kubernetes manifests across local and cloud overlays
	bash scripts/validate-k8s.sh

k3d-up: ## Create local k3d (or kind) cluster and install Helm charts (Postgres, Redis, MinIO, KEDA, Prometheus Stack)
	@if [ "$(CLUSTER_TOOL)" = "kind" ]; then \
		kind get clusters | grep -q "^$(CLUSTER_NAME)$$" || kind create cluster --name $(CLUSTER_NAME) --config infra/k8s/kind-config.yaml; \
	else \
		k3d cluster list | grep -q "^$(CLUSTER_NAME) " || k3d cluster create $(CLUSTER_NAME) --agents 2 -p "3000:80@loadbalancer" -p "9000:9000@loadbalancer"; \
	fi
	@echo "Installing/upgrading in-cluster Helm releases..."
	helm repo add bitnami https://charts.bitnami.com/bitnami --force-update || true
	helm repo add minio https://charts.min.io/ --force-update || true
	helm repo add kedacore https://kedacore.github.io/charts --force-update || true
	helm repo add prometheus-community https://prometheus-community.github.io/helm-charts --force-update || true
	helm repo update
	helm upgrade --install vp-postgres bitnami/postgresql -n video-pipeline --create-namespace -f infra/k8s/helm-values/postgres.yaml
	helm upgrade --install vp-redis bitnami/redis -n video-pipeline --create-namespace -f infra/k8s/helm-values/redis.yaml
	helm upgrade --install vp-minio minio/minio -n video-pipeline --create-namespace -f infra/k8s/helm-values/minio.yaml
	helm upgrade --install keda kedacore/keda -n keda --create-namespace -f infra/k8s/helm-values/keda.yaml
	helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack -n monitoring --create-namespace -f infra/k8s/helm-values/kube-prometheus-stack.yaml
	@echo "Cluster infrastructure ready."

k3d-deploy: k8s-local-secrets ## Build local images, import to k3d, and apply Kustomize local overlay
	@echo "Building local Docker images..."
	docker compose -f $(COMPOSE_FILE) build api worker-probe
	docker tag video-pipeline-api:latest vp-api:local
	docker tag video-pipeline-worker-probe:latest vp-worker:local
	@if [ "$(CLUSTER_TOOL)" = "kind" ]; then \
		kind load docker-image vp-api:local --name $(CLUSTER_NAME); \
		kind load docker-image vp-worker:local --name $(CLUSTER_NAME); \
	else \
		k3d image import vp-api:local vp-worker:local -c $(CLUSTER_NAME); \
	fi
	@echo "Applying Kubernetes manifests (local overlay)..."
	kubectl apply -k infra/k8s/overlays/local
	@echo "Waiting for database migrations Job to complete..."
	kubectl wait --for=condition=complete job/vp-migrate -n video-pipeline --timeout=120s || kubectl logs job/vp-migrate -n video-pipeline
	@echo "Waiting for API and Worker deployments to become ready..."
	kubectl rollout status deployment/vp-api -n video-pipeline --timeout=180s
	kubectl rollout status deployment/vp-worker-probe -n video-pipeline --timeout=180s
	@echo "Deployment complete."

k3d-down: ## Delete local k3d (or kind) cluster
	@if [ "$(CLUSTER_TOOL)" = "kind" ]; then \
		kind delete cluster --name $(CLUSTER_NAME); \
	else \
		k3d cluster delete $(CLUSTER_NAME); \
	fi


load-s1: ## Run S1 Upload Storm load test (requires Compose stack)
	@TOKEN=$$(pnpm -w exec tsx tools/dev-token/src/cli.ts mint 2>/dev/null || node -e "console.log(require('./tools/dev-token/dist/jwt.js').mintDevToken())") && \
	API="http://localhost:3000" TOKEN=$$TOKEN k6 run tests/load/s1-upload-storm.js

load-s2: ## Run S2 Large File load test (requires Compose stack)
	@TOKEN=$$(pnpm -w exec tsx tools/dev-token/src/cli.ts mint 2>/dev/null || node -e "console.log(require('./tools/dev-token/dist/jwt.js').mintDevToken())") && \
	API="http://localhost:3000" TOKEN=$$TOKEN k6 run tests/load/s2-large-file.js

load-s3: ## Run S3 Backlog Burst load test (requires Compose stack)
	@TOKEN=$$(pnpm -w exec tsx tools/dev-token/src/cli.ts mint 2>/dev/null || node -e "console.log(require('./tools/dev-token/dist/jwt.js').mintDevToken())") && \
	API="http://localhost:3000" TOKEN=$$TOKEN k6 run tests/load/s3-backlog-burst.js

load-smoke: ## Run reduced S1 Load Smoke Test
	@TOKEN=$$(pnpm -w exec tsx tools/dev-token/src/cli.ts mint 2>/dev/null || node -e "console.log(require('./tools/dev-token/dist/jwt.js').mintDevToken())") && \
	API="http://localhost:3000" TOKEN=$$TOKEN k6 run --vus 60 --duration 2m tests/load/s1-upload-storm.js

toxiproxy-up: ## Start toxiproxy service fronting MinIO for chaos testing
	docker compose -f $(COMPOSE_FILE) --profile chaos up -d toxiproxy

chaos-s4: ## Run S4 Worker Kills chaos test (50 videos with worker kills)
	@TOKEN=$$(pnpm -w exec tsx tools/dev-token/src/cli.ts mint 2>/dev/null || node -e "console.log(require('./tools/dev-token/dist/jwt.js').mintDevToken())") && \
	API="http://localhost:3000" TOKEN=$$TOKEN k6 run tests/load/s4-worker-kills.js

chaos-s5: ## Run S5 Dependency Outage chaos test
	@TOKEN=$$(pnpm -w exec tsx tools/dev-token/src/cli.ts mint 2>/dev/null || node -e "console.log(require('./tools/dev-token/dist/jwt.js').mintDevToken())") && \
	API="http://localhost:3000" TOKEN=$$TOKEN k6 run tests/load/s5-dependency-outage.js

chaos-s6: ## Run S6 SSE Fan-out load & reconnect test
	@TOKEN=$$(pnpm -w exec tsx tools/dev-token/src/cli.ts mint 2>/dev/null || node -e "console.log(require('./tools/dev-token/dist/jwt.js').mintDevToken())") && \
	API="http://localhost:3000" TOKEN=$$TOKEN k6 run tests/load/s6-sse-fanout.js

chaos-s7: ## Run S7 Soak test (4h duration, configurable with SOAK_DURATION)
	@TOKEN=$$(pnpm -w exec tsx tools/dev-token/src/cli.ts mint 2>/dev/null || node -e "console.log(require('./tools/dev-token/dist/jwt.js').mintDevToken())") && \
	API="http://localhost:3000" TOKEN=$$TOKEN k6 run tests/load/s7-soak.js

