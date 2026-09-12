# NEBULA — developer shortcuts
.PHONY: help doctor install backend frontend test test-backend test-frontend typecheck build lint docker-up docker-down clean verify-tracked

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

doctor: ## Diagnose the browser environment (why can't the agent start Chromium?)
	@cd backend && python scripts/diagnose.py --launch

verify-tracked: ## Fail if any source file on disk is untracked (guards .gitignore mistakes)
	@tmp=$${TMPDIR:-/tmp}/nebula-tracked-check.$$$$; \
	find . -type f -not -path './.git/*' -not -path '*/node_modules/*' -not -path '*/.next/*' \
	  -not -path '*/__pycache__/*' -not -path './backend/data/*' -not -path '*/.pytest_cache/*' \
	  -not -name '*.pyc' -not -name '*.tsbuildinfo' -not -name 'next-env.d.ts' \
	  | sed 's|^\./||' | sort > $$tmp.ondisk; \
	git ls-files | sort > $$tmp.tracked; \
	missing=$$(comm -23 $$tmp.ondisk $$tmp.tracked); \
	if [ -n "$$missing" ]; then \
	  echo "✗ source files exist on disk but are NOT tracked (check .gitignore):"; \
	  echo "$$missing" | sed 's/^/    /'; \
	  rm -f $$tmp.ondisk $$tmp.tracked; exit 1; \
	else \
	  echo "✓ every source file is tracked by git"; \
	  rm -f $$tmp.ondisk $$tmp.tracked; \
	fi

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
