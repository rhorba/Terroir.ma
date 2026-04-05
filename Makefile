.PHONY: help install build start stop restart logs lint lint-fix format typecheck \
        test test-unit test-integration test-e2e test-cov \
        migration-generate migration-run migration-revert \
        docker-up docker-down docker-logs docker-clean \
        keycloak-export keycloak-import \
        seed clean

# Default target
.DEFAULT_GOAL := help

# Colors for output
CYAN  := \033[0;36m
GREEN := \033[0;32m
RESET := \033[0m

##@ General

help: ## Display this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  $(CYAN)%-22s$(RESET) %s\n", $$1, $$2 } /^##@/ { printf "\n$(GREEN)%s$(RESET)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Setup

install: ## Install all npm dependencies
	npm install

prepare: ## Install Husky git hooks
	npm run prepare

##@ Development

start: ## Start the app in production mode (requires build)
	npm run start

start-dev: ## Start the app in watch/dev mode
	npm run start:dev

start-debug: ## Start the app in debug+watch mode
	npm run start:debug

build: ## Compile TypeScript to dist/
	npm run build

clean: ## Remove dist/ and coverage/ directories
	rm -rf dist coverage

##@ Code Quality

lint: ## Run ESLint (report only)
	npm run lint

lint-fix: ## Run ESLint and auto-fix violations
	npm run lint:fix

format: ## Format all source files with Prettier
	npm run format

format-check: ## Check formatting without writing changes
	npm run format:check

typecheck: ## Run tsc --noEmit type check
	npm run typecheck

##@ Testing

test: ## Run all test suites
	npm run test

test-unit: ## Run unit tests only
	npm run test:unit

test-integration: ## Run integration tests (requires running Docker services)
	npm run test:integration

test-e2e: ## Run end-to-end tests
	npm run test:e2e

test-cov: ## Run tests with coverage report
	npm run test:cov

##@ Database Migrations

migration-generate: ## Generate a new TypeORM migration (NAME=MigrationName required)
	@if [ -z "$(NAME)" ]; then echo "Usage: make migration-generate NAME=MyMigration" && exit 1; fi
	npm run migration:generate -- migrations/$(NAME)

migration-run: ## Apply all pending migrations
	npm run migration:run

migration-revert: ## Revert the last applied migration
	npm run migration:revert

##@ Docker Infrastructure

docker-up: ## Start all infrastructure services (PostgreSQL, Redis, Redpanda, Keycloak, Mailpit)
	docker compose -f infrastructure/docker/docker-compose.yml up -d

docker-down: ## Stop all infrastructure services
	docker compose -f infrastructure/docker/docker-compose.yml down

docker-restart: ## Restart all infrastructure services
	docker compose -f infrastructure/docker/docker-compose.yml restart

docker-logs: ## Tail logs from all Docker services
	docker compose -f infrastructure/docker/docker-compose.yml logs -f

docker-logs-db: ## Tail PostgreSQL logs only
	docker compose -f infrastructure/docker/docker-compose.yml logs -f postgres

docker-logs-kafka: ## Tail Redpanda (Kafka) logs only
	docker compose -f infrastructure/docker/docker-compose.yml logs -f redpanda

docker-clean: ## Stop containers and remove volumes (DESTRUCTIVE)
	docker compose -f infrastructure/docker/docker-compose.yml down -v --remove-orphans

docker-build: ## Build the application Docker image
	docker build -t terroir-ma:local .

##@ Keycloak

keycloak-export: ## Export the Keycloak realm configuration to realm-export.json
	docker compose -f infrastructure/docker/docker-compose.yml exec keycloak \
	  /opt/keycloak/bin/kc.sh export \
	  --realm terroir-ma \
	  --file /opt/keycloak/data/import/realm-export.json
	@echo "$(GREEN)Realm exported. Copy from container if needed.$(RESET)"

keycloak-import: ## Import realm-export.json into running Keycloak
	docker compose -f infrastructure/docker/docker-compose.yml exec keycloak \
	  /opt/keycloak/bin/kc.sh import \
	  --file /opt/keycloak/data/import/realm-export.json

##@ Utilities

seed: ## Seed the database with Morocco terroir demo data
	npx ts-node -r tsconfig-paths/register src/database/seeds/run-seeds.ts

env-check: ## Validate required environment variables are set
	@node -e "\
	  const required = ['DATABASE_URL','REDIS_URL','KAFKA_BROKERS','KEYCLOAK_URL','QR_HMAC_SECRET']; \
	  const missing = required.filter(k => !process.env[k]); \
	  if (missing.length) { console.error('Missing env vars:', missing.join(', ')); process.exit(1); } \
	  else { console.log('All required env vars are set.'); }"

ci: lint typecheck test-unit ## Run the full local CI suite (lint + typecheck + unit tests)

all: install docker-up migration-run start-dev ## Full local bootstrap: install, start infra, migrate, dev server
