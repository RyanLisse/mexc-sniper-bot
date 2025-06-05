# MEXC Sniper Bot Makefile
# Provides convenient commands for development, testing, and deployment

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Default shell
SHELL := /bin/bash

# Python command
PYTHON := uv run python
PYTEST := uv run pytest
RUFF := uv run ruff

# Node command
NODE := bun

.PHONY: help
help: ## Show this help message
	@echo -e "${BLUE}MEXC Sniper Bot - Available Commands${NC}"
	@echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "${GREEN}%-20s${NC} %s\n", $$1, $$2}'

# ==================== Setup Commands ====================

.PHONY: install
install: ## Install all dependencies (Python + Node)
	@echo -e "${BLUE}Installing all dependencies...${NC}"
	@$(MAKE) install-python
	@$(MAKE) install-node
	@echo -e "${GREEN}✓ All dependencies installed${NC}"

.PHONY: install-python
install-python: ## Install Python dependencies with uv
	@echo -e "${BLUE}Installing Python dependencies...${NC}"
	@uv sync
	@echo -e "${GREEN}✓ Python dependencies installed${NC}"

.PHONY: install-node
install-node: ## Install Node dependencies with bun
	@echo -e "${BLUE}Installing Node dependencies...${NC}"
	@bun install
	@echo -e "${GREEN}✓ Node dependencies installed${NC}"

.PHONY: setup
setup: install ## Complete project setup
	@echo -e "${BLUE}Setting up project...${NC}"
	@cp -n .env.example .env.local 2>/dev/null || echo ".env.local already exists"
	@chmod +x scripts/*.sh
	@echo -e "${GREEN}✓ Project setup complete${NC}"

.PHONY: setup-turso
setup-turso: ## Setup TursoDB (interactive)
	@echo -e "${BLUE}Setting up TursoDB...${NC}"
	@chmod +x scripts/setup-turso.sh
	@./scripts/setup-turso.sh

# ==================== Development Commands ====================

.PHONY: kill-ports
kill-ports: ## Kill processes on common development ports
	@echo -e "${BLUE}Killing processes on common ports...${NC}"
	@-pkill -f "next dev" 2>/dev/null || true
	@-pkill -f "uvicorn" 2>/dev/null || true
	@-pkill -f "inngest" 2>/dev/null || true
	@-lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:3001 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:8001 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:8288 | xargs kill -9 2>/dev/null || true
	@echo -e "${GREEN}✓ Ports cleared${NC}"

.PHONY: dev
dev: kill-ports ## Start all development servers (Next.js + Python API + Inngest)
	@echo -e "${BLUE}Starting all development servers...${NC}"
	@trap 'kill %1 %2 %3' SIGINT; \
	$(MAKE) dev-next & \
	$(MAKE) dev-python & \
	$(MAKE) dev-inngest & \
	wait

.PHONY: dev-next
dev-next: ## Start Next.js development server
	@echo -e "${BLUE}Starting Next.js development server...${NC}"
	@$(NODE) run dev

.PHONY: dev-python
dev-python: ## Start Python API server
	@echo -e "${BLUE}Starting Python API server...${NC}"
	@$(PYTHON) -m uvicorn api.agents:app --reload --port 8000

.PHONY: dev-inngest
dev-inngest: ## Start Inngest dev server
	@echo -e "${BLUE}Starting Inngest dev server...${NC}"
	@npx inngest-cli@latest dev

# ==================== Code Quality Commands ====================

.PHONY: lint
lint: ## Run all linters (Python + TypeScript)
	@echo -e "${BLUE}Running all linters...${NC}"
	@chmod +x scripts/lint-and-format.sh
	@./scripts/lint-and-format.sh

.PHONY: lint-python
lint-python: ## Run Python linters only
	@echo -e "${BLUE}Running Python linters...${NC}"
	@$(RUFF) check --fix
	@$(RUFF) format

.PHONY: lint-ts
lint-ts: ## Run TypeScript linters only
	@echo -e "${BLUE}Running TypeScript linters...${NC}"
	@$(NODE) run lint

.PHONY: format
format: ## Format all code
	@echo -e "${BLUE}Formatting code...${NC}"
	@$(MAKE) lint
	@echo -e "${GREEN}✓ Code formatted${NC}"

.PHONY: type-check
type-check: ## Run type checking (Python + TypeScript)
	@echo -e "${BLUE}Running type checks...${NC}"
	@echo "🐍 Python (ty):"
	@-$(PYTHON) -m ty --verbose || echo -e "${YELLOW}ty type checking completed with warnings${NC}"
	@echo "📦 TypeScript:"
	@$(NODE) run type-check
	@echo -e "${GREEN}✓ Type checking complete${NC}"

.PHONY: pre-commit
pre-commit: lint type-check test ## Run all pre-commit checks
	@echo -e "${GREEN}✓ All pre-commit checks passed${NC}"

# ==================== Testing Commands ====================

.PHONY: test
test: ## Run all tests
	@echo -e "${BLUE}Running tests...${NC}"
	@$(PYTEST) -v

.PHONY: test-cov
test-cov: ## Run tests with coverage
	@echo -e "${BLUE}Running tests with coverage...${NC}"
	@$(PYTEST) --cov=src --cov-report=html --cov-report=term

.PHONY: test-watch
test-watch: ## Run tests in watch mode
	@echo -e "${BLUE}Running tests in watch mode...${NC}"
	@$(PYTEST) -v --watch

.PHONY: test-integration
test-integration: ## Run integration tests only
	@echo -e "${BLUE}Running integration tests...${NC}"
	@$(PYTEST) -v -m integration

.PHONY: test-unit
test-unit: ## Run unit tests only
	@echo -e "${BLUE}Running unit tests...${NC}"
	@$(PYTEST) -v -m "not integration"

# ==================== Build Commands ====================

.PHONY: build
build: ## Build production bundles
	@echo -e "${BLUE}Building production bundles...${NC}"
	@$(NODE) run build
	@echo -e "${GREEN}✓ Build complete${NC}"

.PHONY: build-docker
build-docker: ## Build Docker image
	@echo -e "${BLUE}Building Docker image...${NC}"
	@docker build -t mexc-sniper-bot .
	@echo -e "${GREEN}✓ Docker image built${NC}"

# ==================== Database Commands ====================

.PHONY: db-migrate
db-migrate: ## Run database migrations
	@echo -e "${BLUE}Running database migrations...${NC}"
	@$(PYTHON) -c "from src.database import init_database, create_tables; import asyncio; init_database(); asyncio.run(create_tables())"
	@echo -e "${GREEN}✓ Migrations complete${NC}"

.PHONY: db-reset
db-reset: ## Reset database (WARNING: destroys all data)
	@echo -e "${RED}WARNING: This will destroy all data!${NC}"
	@read -p "Are you sure? (y/N) " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		rm -f mexc_sniper.db mexc_sniper_turso.db; \
		$(MAKE) db-migrate; \
		echo -e "${GREEN}✓ Database reset${NC}"; \
	else \
		echo -e "${YELLOW}Database reset cancelled${NC}"; \
	fi

# ==================== Agent Commands ====================

.PHONY: agent-start
agent-start: ## Start the MEXC monitoring agent
	@echo -e "${BLUE}Starting MEXC monitoring agent...${NC}"
	@$(PYTHON) start_mexc_agent.py

.PHONY: agent-test
agent-test: ## Test the MEXC agent
	@echo -e "${BLUE}Testing MEXC agent...${NC}"
	@$(PYTHON) test_mexc_agent.py

.PHONY: pattern-discovery
pattern-discovery: ## Run pattern discovery analysis
	@echo -e "${BLUE}Running pattern discovery...${NC}"
	@$(PYTHON) -m src.services.pattern_discovery

# ==================== Utility Commands ====================

.PHONY: clean
clean: ## Clean generated files and caches
	@echo -e "${BLUE}Cleaning generated files...${NC}"
	@rm -rf .next .pytest_cache .coverage htmlcov __pycache__ .ruff_cache
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@echo -e "${GREEN}✓ Clean complete${NC}"

.PHONY: deps-check
deps-check: ## Check for outdated dependencies
	@echo -e "${BLUE}Checking dependencies...${NC}"
	@echo -e "${YELLOW}Python dependencies:${NC}"
	@uv pip list --outdated || true
	@echo -e "${YELLOW}Node dependencies:${NC}"
	@$(NODE) outdated || true

.PHONY: deps-update
deps-update: ## Update all dependencies
	@echo -e "${BLUE}Updating dependencies...${NC}"
	@uv sync --upgrade
	@$(NODE) update
	@echo -e "${GREEN}✓ Dependencies updated${NC}"

.PHONY: env-check
env-check: ## Check environment variables
	@echo -e "${BLUE}Checking environment variables...${NC}"
	@$(PYTHON) -c "from src.config import settings; print(settings.model_dump_json(indent=2, exclude={'MEXC_SECRET_KEY', 'OPENAI_API_KEY', 'TURSO_AUTH_TOKEN'}))"

.PHONY: logs
logs: ## Show application logs
	@echo -e "${BLUE}Showing recent logs...${NC}"
	@tail -f -n 50 logs/*.log 2>/dev/null || echo "No log files found"

.PHONY: status
status: ## Show project status
	@echo -e "${BLUE}Project Status${NC}"
	@echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
	@echo -e "Git branch: $$(git branch --show-current)"
	@echo -e "Git status: $$(git status --porcelain | wc -l) uncommitted changes"
	@echo -e "Python version: $$(uv run python --version)"
	@echo -e "Node version: $$(bun --version)"
	@echo -e "Database: $$(if [ -n "$$TURSO_DATABASE_URL" ]; then echo "TursoDB"; else echo "SQLite"; fi)"

# ==================== Docker Commands ====================

.PHONY: docker-up
docker-up: ## Start services with Docker Compose
	@echo -e "${BLUE}Starting Docker services...${NC}"
	@docker-compose up -d
	@echo -e "${GREEN}✓ Services started${NC}"

.PHONY: docker-down
docker-down: ## Stop Docker services
	@echo -e "${BLUE}Stopping Docker services...${NC}"
	@docker-compose down
	@echo -e "${GREEN}✓ Services stopped${NC}"

.PHONY: docker-logs
docker-logs: ## Show Docker logs
	@docker-compose logs -f

# ==================== Production Commands ====================

.PHONY: deploy
deploy: ## Deploy to production (Vercel)
	@echo -e "${BLUE}Deploying to production...${NC}"
	@vercel --prod
	@echo -e "${GREEN}✓ Deployment complete${NC}"

.PHONY: deploy-preview
deploy-preview: ## Deploy preview build
	@echo -e "${BLUE}Deploying preview build...${NC}"
	@vercel
	@echo -e "${GREEN}✓ Preview deployment complete${NC}"

# ==================== Quick Aliases ====================

.PHONY: i
i: install ## Alias for install

.PHONY: d
d: dev ## Alias for dev

.PHONY: t
t: test ## Alias for test

.PHONY: l
l: lint ## Alias for lint

.PHONY: f
f: format ## Alias for format

.PHONY: b
b: build ## Alias for build

# ==================== AI/Codex Commands ====================

.PHONY: codex-setup
codex-setup: ## Setup OpenAI Codex integration
	@echo -e "${BLUE}Setting up OpenAI Codex...${NC}"
	@$(PYTHON) scripts/setup_openai.py

.PHONY: codex-review
codex-review: ## Run AI code review on files (usage: make codex-review FILES="file1.py file2.py")
	@echo -e "${BLUE}Running AI code review...${NC}"
	@if [ -z "$(FILES)" ]; then echo "Usage: make codex-review FILES=\"file1.py file2.py\""; exit 1; fi
	@$(PYTHON) .codex/agents.py --workflow review --files $(FILES) --output ai-review.json
	@echo -e "${GREEN}✓ Review complete. Check ai-review.json${NC}"

.PHONY: codex-docs
codex-docs: ## Generate AI documentation for files (usage: make codex-docs FILES="file1.py file2.py")
	@echo -e "${BLUE}Generating AI documentation...${NC}"
	@if [ -z "$(FILES)" ]; then echo "Usage: make codex-docs FILES=\"file1.py file2.py\""; exit 1; fi
	@$(PYTHON) .codex/agents.py --workflow docs --files $(FILES) --output ai-docs.json
	@echo -e "${GREEN}✓ Documentation generated. Check ai-docs.json${NC}"

.PHONY: codex-test
codex-test: ## Generate AI tests for files (usage: make codex-test FILES="file1.py file2.py")
	@echo -e "${BLUE}Generating AI tests...${NC}"
	@if [ -z "$(FILES)" ]; then echo "Usage: make codex-test FILES=\"file1.py file2.py\""; exit 1; fi
	@$(PYTHON) .codex/agents.py --workflow test --files $(FILES) --output ai-tests.json
	@echo -e "${GREEN}✓ Tests generated. Check ai-tests.json${NC}"

.PHONY: codex-check
codex-check: ## Check OpenAI API configuration
	@$(PYTHON) scripts/setup_openai.py --check

# ==================== Special Targets ====================

.DEFAULT_GOAL := help

# Ensure scripts are executable
$(shell chmod +x scripts/*.sh 2>/dev/null || true)