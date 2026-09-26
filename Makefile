SHELL := /bin/bash
COMPOSE_FILE := infra/compose/docker-compose.yml
OFFLINE_FILE := infra/compose/docker-compose.offline.yml
STACK := pnpm --silent stack

CLUSTER_TOOL ?= k3d
CLUSTER_NAME ?= vp
LOCAL_SECRETS := infra/k8s/overlays/local/secrets.env
DEV_TOKEN := pnpm --silent dev-token mint --raw

.PHONY: help up doctor setup dev down status logs prune psql redis-cli mc check-redis nuke test check-bun test-bun test-r2 lint format typecheck clean smoke smoke-fast smoke-infra smoke-offline e2e chaos-kill obs-check k8s-local-secrets k8s-validate k3d-up k3d-down k3d-deploy load-s1 load-s2 load-s3 load-smoke chaos-readiness hls-sample toxiproxy-up chaos-s4 chaos-s5 chaos-s6 chaos-s7

# `make up web`, `make up worker:thumbnail`: the words after up, down or status are its targets, not goals.
ifneq ($(filter up down status,$(firstword $(MAKECMDGOALS))),)
STACK_TARGETS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
%:
	@:
endif

help: ## Show help for each target
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

up: ## Build and start, tier by tier, gated on health: no target = infra; api, web, worker, worker:<stage>, all, observability
	@$(STACK) up $(STACK_TARGETS)

down: ## Stop every service, every profile included, and delete the volumes
	@$(STACK) down

status: ## Show every service, its state and the URL to reach it
	@$(STACK) status

doctor: ## Check developer prerequisites
	@echo "Checking prerequisites..."
	@node -v | grep -q 'v24' || (echo "Node.js 24 required"; exit 1)
	@pnpm -v | grep -q '10.' || (echo "pnpm 10 required"; exit 1)
	@docker -v >/dev/null || (echo "Docker required"; exit 1)
	@docker compose version >/dev/null || (echo "Docker Compose required"; exit 1)
	@ffmpeg -version >/dev/null || (echo "FFmpeg required"; exit 1)
	@echo "All prerequisites met."

setup: doctor ## Fast bootstrap environment
	@if [ ! -f .env ]; then cp .env.example .env && echo "Created .env"; fi
	pnpm install
	$(MAKE) up all

dev: setup ## Alias for setup

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

check-bun: ## Check for Bun 1.4, which only the Bun test run needs
	@bun -v | grep -q '^1.4' || (echo "Bun 1.4 required"; exit 1)

test-bun: check-bun ## Run Bun tests for worker runtime parity
	pnpm test:bun

test-r2: ## Run the S3 contracts against Cloudflare R2 (export the full app env with S3_* naming the R2 bucket)
	pnpm exec vitest run --config tests/integration/vitest.config.ts packages/server/adapters/s3

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

smoke-offline: ## Run the smoke against every app, web included, on an internal network with zero internet egress
	$(STACK) down --file $(COMPOSE_FILE) --file $(OFFLINE_FILE)
	sudo sysctl -w net.ipv4.conf.all.route_localnet=1 2>/dev/null || true
	which iptables >/dev/null 2>&1 && (sudo iptables -t nat -C POSTROUTING -d 172.16.0.0/12 -s 127.0.0.1 -j MASQUERADE 2>/dev/null || sudo iptables -t nat -A POSTROUTING -d 172.16.0.0/12 -s 127.0.0.1 -j MASQUERADE 2>/dev/null) || true
	$(STACK) up all --file $(COMPOSE_FILE) --file $(OFFLINE_FILE)
	bash scripts/assert-no-egress.sh $(COMPOSE_FILE) $(OFFLINE_FILE)
	API_URL=http://127.0.0.1:3000 WEB_URL=http://127.0.0.1:5173 bash scripts/e2e-smoke.sh

e2e: ## Run Phase 2 pipeline E2E acceptance suite (20 concurrent videos + hostile set; E2E_REDUCED=true for the CI set)
	pnpm e2e

chaos-kill: ## Run crash-safety chaos test (kill worker mid-transcode, assert effectively-once READY)
	bash scripts/chaos-kill.sh 5

obs-check: ## Assert observability stack targets UP and healthy via Prometheus API
	bash scripts/obs-check.sh

k8s-local-secrets: ## Write the local cluster's git-ignored ADMIN_TOKEN once, with a random value
	@test -f $(LOCAL_SECRETS) || printf 'ADMIN_TOKEN=%s\n' "$$(openssl rand -hex 32)" > $(LOCAL_SECRETS)

k8s-validate: ## Validate Kubernetes manifests across local and cloud overlays
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
	helm upgrade --install keda kedacore/keda --version 2.21.0 -n keda --create-namespace -f infra/k8s/helm-values/keda.yaml
	helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack -n monitoring --create-namespace -f infra/k8s/helm-values/kube-prometheus-stack.yaml
	@echo "Cluster infrastructure ready."

k3d-deploy: k8s-local-secrets ## Build local images, import to k3d, and apply Kustomize local overlay
	@echo "Building local Docker images..."
	docker buildx bake --load
	@if [ "$(CLUSTER_TOOL)" = "kind" ]; then \
		kind load docker-image vp-api:local vp-worker:local vp-web:local --name $(CLUSTER_NAME); \
	else \
		k3d image import vp-api:local vp-worker:local vp-web:local -c $(CLUSTER_NAME); \
	fi
	@echo "Applying Kubernetes manifests (local overlay)..."
	@. ./$(LOCAL_SECRETS) && kubectl kustomize infra/k8s/overlays/local \
		| sed -e "s/change-me-admin-token-local-cluster/$$ADMIN_TOKEN/" \
		| kubectl apply -f -
	@echo "Waiting for database migrations Job to complete..."
	kubectl wait --for=condition=complete job/vp-migrate -n video-pipeline --timeout=120s || kubectl logs job/vp-migrate -n video-pipeline
	@echo "Waiting for API and Worker deployments to become ready..."
	kubectl rollout status deployment/vp-api -n video-pipeline --timeout=180s
	kubectl rollout status deployment/vp-worker-probe -n video-pipeline --timeout=180s
	kubectl rollout status deployment/vp-web -n video-pipeline --timeout=180s
	@echo "Deployment complete."

k3d-down: ## Delete local k3d (or kind) cluster
	@if [ "$(CLUSTER_TOOL)" = "kind" ]; then \
		kind delete cluster --name $(CLUSTER_NAME); \
	else \
		k3d cluster delete $(CLUSTER_NAME); \
	fi


load-s1: ## Run S1 Upload Storm load test (requires Compose stack)
	@API="http://localhost:3000" TOKEN=$$($(DEV_TOKEN)) k6 run tests/load/s1-upload-storm.js

load-s2: ## Run S2 Large File load test (requires Compose stack)
	@API="http://localhost:3000" TOKEN=$$($(DEV_TOKEN)) k6 run tests/load/s2-large-file.js

load-s3: ## Run S3 Backlog Burst load test (requires Compose stack)
	@API="http://localhost:3000" TOKEN=$$($(DEV_TOKEN)) k6 run tests/load/s3-backlog-burst.js

load-smoke: ## Run the nightly load smoke (S1, 5 VUs for 1 min) against a stack started with UPLOAD_RATE_LIMIT_MAX=100000
	@API="http://localhost:3000" TOKEN=$$($(DEV_TOKEN)) k6 run --vus 5 --duration 1m tests/load/s1-upload-storm.js

chaos-readiness: ## Stop MinIO and cut a worker's Redis via toxiproxy; /readyz must answer 503, then 200
	bash scripts/chaos-readiness.sh

hls-sample: ## Write the HLS sample tools/hls-test-page plays (s15 cut into 2 s segments)
	@test -f tests/fixtures/s15.mp4 || pnpm gen-video --only s15
	@mkdir -p tools/hls-test-page/sample
	ffmpeg -y -loglevel error -i tests/fixtures/s15.mp4 -c copy -f hls -hls_time 2 -hls_playlist_type vod tools/hls-test-page/sample/index.m3u8

toxiproxy-up: ## Start toxiproxy service fronting MinIO for chaos testing
	docker compose -f $(COMPOSE_FILE) --profile chaos up -d toxiproxy

chaos-s4: ## Run S4 Worker Kills chaos test (50 videos with worker kills)
	@API="http://localhost:3000" TOKEN=$$($(DEV_TOKEN)) k6 run tests/load/s4-worker-kills.js

chaos-s5: ## Run S5 Dependency Outage chaos test
	@API="http://localhost:3000" TOKEN=$$($(DEV_TOKEN)) k6 run tests/load/s5-dependency-outage.js

chaos-s6: ## Run S6 SSE Fan-out load & reconnect test
	@API="http://localhost:3000" TOKEN=$$($(DEV_TOKEN)) k6 run tests/load/s6-sse-fanout.js

chaos-s7: ## Run S7 Soak test (4h duration, configurable with SOAK_DURATION)
	@API="http://localhost:3000" TOKEN=$$($(DEV_TOKEN)) k6 run tests/load/s7-soak.js

