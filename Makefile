# NEBULA — developer shortcuts
.PHONY: help install backend frontend test test-backend test-frontend typecheck build lint docker-up docker-down clean

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install backend (pip) and frontend (npm) dependencies
	cd backend && pip install -r requirements.txt && python -m playwright install chromium
	cd frontend && npm install

backend: ## Run the backend API + browser worker on :8000
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend: ## Run the frontend on :3000 (proxies /api + /ws to :8000)
	cd frontend && npm run dev

test: test-backend test-frontend ## Run all tests

test-backend: ## pytest (unit + API + Playwright browser E2E)
	cd backend && python -m pytest

test-frontend: ## vitest component tests
	cd frontend && npm test

typecheck: ## TypeScript type check
	cd frontend && npm run typecheck

build: ## Production build of the frontend
	cd frontend && npm run build

lint: ## Lint the frontend
	cd frontend && npm run lint

docker-up: ## Start the full stack with docker compose
	docker compose up --build

docker-down: ## Stop the stack
	docker compose down

clean: ## Remove local dev databases and build artefacts
	rm -rf backend/data backend/.pytest_cache backend/**/__pycache__ frontend/.next
