SHELL := /bin/bash
COMPOSE_FILE := infra/compose/docker-compose.yml
REDIS_IMAGE ?= redis:7-alpine

.PHONY: help up down logs psql redis-cli mc check-redis nuke test test-bun lint format typecheck clean smoke smoke-infra smoke-offline e2e chaos-kill obs-up obs-down obs-check

help: ## Show help for each target
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

up: ## Start local infrastructure (Postgres, Redis, MinIO, minio-init)
	REDIS_IMAGE=$(REDIS_IMAGE) docker compose -f $(COMPOSE_FILE) up -d --wait

up-all: ## Start full stack (infra, migrations, API, all worker stages)
	REDIS_IMAGE=$(REDIS_IMAGE) docker compose -f $(COMPOSE_FILE) up -d --build --wait

build-images: ## Build local Docker images for API and Worker
	docker compose -f $(COMPOSE_FILE) build

down: ## Stop local infrastructure
	docker compose -f $(COMPOSE_FILE) down

logs: ## Follow infrastructure logs
	docker compose -f $(COMPOSE_FILE) logs -f

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

smoke-infra: ## Run infrastructure smoke tests
	bash infra/compose/test.sh

smoke-offline: ## Run smoke tests in offline mode (internal network with zero internet egress)
	REDIS_IMAGE=$(REDIS_IMAGE) docker compose -f $(COMPOSE_FILE) -f infra/compose/docker-compose.offline.yml up -d --build --wait
	bash scripts/e2e-smoke.sh

e2e: ## Run Phase 2 pipeline E2E acceptance suite (20 concurrent videos + hostile set)
	bash scripts/e2e-suite.sh

chaos-kill: ## Run crash-safety chaos test (kill worker mid-transcode, assert effectively-once READY)
	bash scripts/chaos-kill.sh 5

obs-up: ## Start observability stack profile (Prometheus, Grafana, Tempo, Loki, OTel collector, Alertmanager)
	docker compose -f $(COMPOSE_FILE) --profile observability up -d

obs-down: ## Stop observability stack
	docker compose -f $(COMPOSE_FILE) --profile observability stop

obs-check: ## Assert observability stack targets UP and healthy via Prometheus API
	bash scripts/obs-check.sh
