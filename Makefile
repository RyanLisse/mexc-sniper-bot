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

# Node command
NODE := bun

.PHONY: help
help: ## Show this help message
	@echo -e "${BLUE}MEXC Sniper Bot - Available Commands${NC}"
	@echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "${GREEN}%-20s${NC} %s\n", $$1, $$2}'

# ==================== Setup Commands ====================

.PHONY: install
install: ## Install all dependencies
	@echo -e "${BLUE}Installing dependencies...${NC}"
	@$(MAKE) install-node
	@echo -e "${GREEN}✓ All dependencies installed${NC}"

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
	@$(MAKE) db-migrate
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
	@-pkill -f "inngest" 2>/dev/null || true
	@-lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:8288 | xargs kill -9 2>/dev/null || true
	@echo -e "${GREEN}✓ Ports cleared${NC}"

.PHONY: dev
dev: kill-ports ## Start all development servers (Next.js + Inngest)
	@echo -e "${BLUE}Starting all development servers...${NC}"
	@trap 'kill %1 %2' SIGINT; \
	$(MAKE) dev-next & \
	$(MAKE) dev-inngest & \
	wait

.PHONY: dev-next
dev-next: ## Start Next.js development server
	@echo -e "${BLUE}Starting Next.js development server...${NC}"
	@$(NODE) run dev

.PHONY: dev-inngest
dev-inngest: ## Start Inngest dev server
	@echo -e "${BLUE}Starting Inngest dev server...${NC}"
	@npx inngest-cli@latest dev -u http://localhost:3000/api/inngest

# ==================== Code Quality Commands ====================

.PHONY: lint
lint: ## Run all linters (TypeScript)
	@echo -e "${BLUE}Running all linters...${NC}"
	@chmod +x scripts/lint-and-format.sh
	@./scripts/lint-and-format.sh

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
type-check: ## Run TypeScript type checking
	@echo -e "${BLUE}Running type checks...${NC}"
	@echo "📦 TypeScript:"
	@$(NODE) run type-check
	@echo -e "${GREEN}✓ Type checking complete${NC}"

.PHONY: pre-commit
pre-commit: lint type-check ## Run all pre-commit checks
	@echo -e "${GREEN}✓ All pre-commit checks passed${NC}"

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

.PHONY: db-generate
db-generate: ## Generate database migrations
	@echo -e "${BLUE}Generating database migrations...${NC}"
	@$(NODE) run db:generate
	@echo -e "${GREEN}✓ Migrations generated${NC}"

.PHONY: db-migrate
db-migrate: ## Run database migrations
	@echo -e "${BLUE}Running database migrations...${NC}"
	@$(NODE) run db:migrate
	@echo -e "${GREEN}✓ Migrations complete${NC}"

.PHONY: db-studio
db-studio: ## Open database studio
	@echo -e "${BLUE}Opening database studio...${NC}"
	@$(NODE) run db:studio

.PHONY: db-reset
db-reset: ## Reset database (WARNING: destroys all data)
	@echo -e "${RED}WARNING: This will destroy all data!${NC}"
	@read -p "Are you sure? (y/N) " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		$(NODE) run db:reset; \
		echo -e "${GREEN}✓ Database reset${NC}"; \
	else \
		echo -e "${YELLOW}Database reset cancelled${NC}"; \
	fi

# ==================== Utility Commands ====================

.PHONY: clean
clean: ## Clean generated files and caches
	@echo -e "${BLUE}Cleaning generated files...${NC}"
	@rm -rf .next node_modules/.cache tsconfig.tsbuildinfo
	@echo -e "${GREEN}✓ Clean complete${NC}"

.PHONY: deps-check
deps-check: ## Check for outdated dependencies
	@echo -e "${BLUE}Checking dependencies...${NC}"
	@echo -e "${YELLOW}Node dependencies:${NC}"
	@$(NODE) outdated || true

.PHONY: deps-update
deps-update: ## Update all dependencies
	@echo -e "${BLUE}Updating dependencies...${NC}"
	@$(NODE) update
	@echo -e "${GREEN}✓ Dependencies updated${NC}"

.PHONY: env-check
env-check: ## Check environment variables
	@echo -e "${BLUE}Checking environment variables...${NC}"
	@echo "Environment check would be performed here"

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

.PHONY: l
l: lint ## Alias for lint

.PHONY: f
f: format ## Alias for format

.PHONY: b
b: build ## Alias for build

# ==================== Special Targets ====================

.DEFAULT_GOAL := help

# Ensure scripts are executable
$(shell chmod +x scripts/*.sh 2>/dev/null || true)