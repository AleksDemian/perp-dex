include config.mk

export DOCKER_BUILDKIT=1

.PHONY: dev-indexer dev-frontend up down down-v logs lint build clean help
.PHONY: build-indexer build-frontend push-indexer push-frontend docker deploy deploy-down deploy-logs

# ==================== Development ====================

dev-indexer: ## Start indexer locally
	cd backend && npm run dev

dev-frontend: ## Start frontend locally (port 3000)
	cd frontend && npm run dev

# ==================== Docker (local build + run) ====================

up: ## Build and start all services locally
	docker compose up --build -d

down: ## Stop all services
	docker compose down

down-v: ## Stop all services and delete volumes
	docker compose down -v

logs: ## Show service logs
	docker compose logs -f

# ==================== Docker Build ====================

build-indexer: ## Build indexer docker image
	docker build -f ./backend/Dockerfile -t $(INDEXER_BACKUP) ./backend && \
	docker build -f ./backend/Dockerfile -t $(INDEXER_LATEST) ./backend

build-frontend: ## Build frontend docker image
	docker build -f ./frontend/Dockerfile \
		--build-arg NEXT_PUBLIC_PERP_ADDRESS=$${PERP_ADDRESS} \
		--build-arg NEXT_PUBLIC_USDC_ADDRESS=$${USDC_ADDRESS} \
		--build-arg NEXT_PUBLIC_PRICE_FEED_ADDRESS=$${PRICE_FEED_ADDRESS} \
		--build-arg NEXT_PUBLIC_CHAIN_ID=$${CHAIN_ID:-11155111} \
		--build-arg NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$${NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:-demo} \
		--build-arg NEXT_PUBLIC_RPC_URL=$${RPC_URL} \
		--build-arg NEXT_PUBLIC_MARKET_SYMBOL=$${NEXT_PUBLIC_MARKET_SYMBOL:-BTC-USD} \
		-t $(FRONTEND_BACKUP) ./frontend && \
	docker build -f ./frontend/Dockerfile \
		--build-arg NEXT_PUBLIC_PERP_ADDRESS=$${PERP_ADDRESS} \
		--build-arg NEXT_PUBLIC_USDC_ADDRESS=$${USDC_ADDRESS} \
		--build-arg NEXT_PUBLIC_PRICE_FEED_ADDRESS=$${PRICE_FEED_ADDRESS} \
		--build-arg NEXT_PUBLIC_CHAIN_ID=$${CHAIN_ID:-11155111} \
		--build-arg NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$${NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:-demo} \
		--build-arg NEXT_PUBLIC_RPC_URL=$${RPC_URL} \
		--build-arg NEXT_PUBLIC_MARKET_SYMBOL=$${NEXT_PUBLIC_MARKET_SYMBOL:-BTC-USD} \
		-t $(FRONTEND_LATEST) ./frontend

push-indexer: ## Push indexer docker image
	docker push $(INDEXER_BACKUP) && \
	docker push $(INDEXER_LATEST)

push-frontend: ## Push frontend docker image
	docker push $(FRONTEND_BACKUP) && \
	docker push $(FRONTEND_LATEST)

docker: build-indexer build-frontend push-indexer push-frontend ## Build and push all docker images

# ==================== Deploy ====================

deploy: ## Start full stack with pre-built images (docker-compose.dev.yml)
	INDEXER_IMAGE=$(INDEXER_LATEST) FRONTEND_IMAGE=$(FRONTEND_LATEST) \
	docker compose -f docker-compose.dev.yml up -d

deploy-down: ## Stop deployed stack
	docker compose -f docker-compose.dev.yml down

deploy-logs: ## Show deployed stack logs
	docker compose -f docker-compose.dev.yml logs -f

# ==================== Quality ====================

lint: ## Run linting (frontend)
	cd frontend && npm run lint

build: ## Build all apps locally
	cd backend && npm run build 2>/dev/null || true
	cd frontend && npm run build

# ==================== Utility ====================

clean: ## Remove node_modules and build artifacts
	rm -rf frontend/node_modules frontend/.next
	rm -rf backend/node_modules backend/data

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
