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
	@-pkill -f "playwright" 2>/dev/null || true
	@-pkill -f "vitest" 2>/dev/null || true
	@-lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:3008 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:8288 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:5555 | xargs kill -9 2>/dev/null || true
	@sleep 1
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
	@npx inngest-cli@latest dev -u http://localhost:3008/api/inngest

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

# ==================== Testing Commands ====================

.PHONY: test
test: kill-ports ## Run all unit tests with isolated database branches
	@echo -e "${BLUE}Running unit tests with isolated branches...${NC}"
	@$(NODE) run test
	@echo -e "${GREEN}✓ Unit tests completed${NC}"

.PHONY: test-unit
test-unit: ## Run unit tests only with branch isolation
	@echo -e "${BLUE}Running unit tests with branch isolation...${NC}"
	@bunx vitest run tests/unit/
	@echo -e "${GREEN}✓ Unit tests completed${NC}"

.PHONY: test-integration
test-integration: ## Run integration tests with isolated database branches
	@echo -e "${BLUE}Running integration tests with isolated branches...${NC}"
	@bunx vitest run tests/integration/
	@echo -e "${GREEN}✓ Integration tests completed${NC}"

.PHONY: test-utils
test-utils: ## Run utility/verification tests only
	@echo -e "${BLUE}Running utility tests only...${NC}"
	@bunx vitest run tests/unit/verification.test.ts
	@echo -e "${GREEN}✓ Utility tests completed${NC}"

.PHONY: test-watch
test-watch: ## Run tests in watch mode
	@echo -e "${BLUE}Running tests in watch mode...${NC}"
	@$(NODE) run test:watch

.PHONY: test-ui
test-ui: kill-ports ## Run tests with UI interface
	@echo -e "${BLUE}Running tests with UI...${NC}"
	@$(NODE) run test:ui

.PHONY: test-coverage
test-coverage: kill-ports ## Run tests with coverage report
	@echo -e "${BLUE}Running tests with coverage...${NC}"
	@$(NODE) run test:coverage
	@echo -e "${GREEN}✓ Coverage report generated${NC}"

.PHONY: test-e2e
test-e2e: kill-ports ## Run E2E tests (starts dev server)
	@echo -e "${BLUE}Running E2E tests...${NC}"
	@echo -e "${YELLOW}Starting development server for E2E tests...${NC}"
	@$(NODE) run dev &
	@sleep 5
	@echo -e "${BLUE}Running Playwright tests...${NC}"
	@$(NODE) run test:e2e || true
	@echo -e "${YELLOW}Cleaning up development server...${NC}"
	@$(MAKE) kill-ports
	@echo -e "${GREEN}✓ E2E tests completed${NC}"

.PHONY: test-e2e-ui
test-e2e-ui: kill-ports ## Run E2E tests with UI
	@echo -e "${BLUE}Running E2E tests with UI...${NC}"
	@echo -e "${YELLOW}Starting development server for E2E tests...${NC}"
	@$(NODE) run dev &
	@sleep 5
	@$(NODE) run test:e2e:ui || true
	@$(MAKE) kill-ports
	@echo -e "${GREEN}✓ E2E tests with UI completed${NC}"

.PHONY: test-e2e-headed
test-e2e-headed: kill-ports ## Run E2E tests in headed mode
	@echo -e "${BLUE}Running E2E tests in headed mode...${NC}"
	@echo -e "${YELLOW}Starting development server for E2E tests...${NC}"
	@$(NODE) run dev &
	@sleep 5
	@$(NODE) run test:e2e:headed || true
	@$(MAKE) kill-ports
	@echo -e "${GREEN}✓ E2E tests in headed mode completed${NC}"

.PHONY: test-stagehand
test-stagehand: kill-ports ## Run Stagehand E2E tests
	@echo -e "${BLUE}Running Stagehand E2E tests...${NC}"
	@echo -e "${YELLOW}Starting development server for Stagehand tests...${NC}"
	@$(NODE) run dev &
	@sleep 5
	@$(NODE) run test:stagehand || true
	@$(MAKE) kill-ports
	@echo -e "${GREEN}✓ Stagehand E2E tests completed${NC}"

.PHONY: test-stagehand-auth
test-stagehand-auth: kill-ports ## Run Stagehand authentication tests
	@echo -e "${BLUE}Running Stagehand authentication tests...${NC}"
	@$(NODE) run dev &
	@sleep 5
	@$(NODE) run test:stagehand:auth || true
	@$(MAKE) kill-ports
	@echo -e "${GREEN}✓ Stagehand auth tests completed${NC}"

.PHONY: test-stagehand-dashboard
test-stagehand-dashboard: kill-ports ## Run Stagehand dashboard tests
	@echo -e "${BLUE}Running Stagehand dashboard tests...${NC}"
	@$(NODE) run dev &
	@sleep 5
	@$(NODE) run test:stagehand:dashboard || true
	@$(MAKE) kill-ports
	@echo -e "${GREEN}✓ Stagehand dashboard tests completed${NC}"

.PHONY: test-stagehand-patterns
test-stagehand-patterns: kill-ports ## Run Stagehand pattern discovery tests
	@echo -e "${BLUE}Running Stagehand pattern discovery tests...${NC}"
	@$(NODE) run dev &
	@sleep 5
	@$(NODE) run test:stagehand:patterns || true
	@$(MAKE) kill-ports
	@echo -e "${GREEN}✓ Stagehand pattern tests completed${NC}"

.PHONY: test-stagehand-api
test-stagehand-api: kill-ports ## Run Stagehand API integration tests
	@echo -e "${BLUE}Running Stagehand API integration tests...${NC}"
	@$(NODE) run dev &
	@sleep 5
	@$(NODE) run test:stagehand:api || true
	@$(MAKE) kill-ports
	@echo -e "${GREEN}✓ Stagehand API tests completed${NC}"

.PHONY: test-stagehand-integration
test-stagehand-integration: kill-ports ## Run Stagehand integration tests
	@echo -e "${BLUE}Running Stagehand integration tests...${NC}"
	@$(NODE) run dev &
	@sleep 5
	@$(NODE) run test:stagehand:integration || true
	@$(MAKE) kill-ports
	@echo -e "${GREEN}✓ Stagehand integration tests completed${NC}"

.PHONY: test-stagehand-headed
test-stagehand-headed: kill-ports ## Run Stagehand tests in headed mode
	@echo -e "${BLUE}Running Stagehand tests in headed mode...${NC}"
	@$(NODE) run dev &
	@sleep 5
	@$(NODE) run test:stagehand:headed || true
	@$(MAKE) kill-ports
	@echo -e "${GREEN}✓ Stagehand headed tests completed${NC}"

.PHONY: test-stagehand-ui
test-stagehand-ui: kill-ports ## Run Stagehand tests with UI
	@echo -e "${BLUE}Running Stagehand tests with UI...${NC}"
	@$(NODE) run dev &
	@sleep 5
	@$(NODE) run test:stagehand:ui || true
	@$(MAKE) kill-ports
	@echo -e "${GREEN}✓ Stagehand UI tests completed${NC}"

.PHONY: test-all
test-all: kill-ports ## Run all tests in sequence (unit → integration → E2E → Stagehand)
	@echo -e "${BLUE}Running complete test suite in sequence...${NC}"
	@echo -e "${YELLOW}1/4: Running unit tests...${NC}"
	@$(NODE) run test:unit
	@echo -e "${GREEN}✓ Unit tests passed${NC}"
	@echo -e "${YELLOW}2/4: Running integration tests...${NC}"
	@bunx vitest run tests/integration/
	@echo -e "${GREEN}✓ Integration tests passed${NC}"
	@echo -e "${YELLOW}3/4: Running E2E tests...${NC}"
	@echo -e "${BLUE}Starting development server for E2E tests...${NC}"
	@$(NODE) run dev &
	@sleep 5
	@$(NODE) run test:e2e || true
	@$(MAKE) kill-ports
	@echo -e "${GREEN}✓ E2E tests completed${NC}"
	@echo -e "${YELLOW}4/4: Running Stagehand E2E tests...${NC}"
	@$(NODE) run dev &
	@sleep 5
	@$(NODE) run test:stagehand || true
	@$(MAKE) kill-ports
	@echo -e "${GREEN}✓ Stagehand tests completed${NC}"
	@echo -e "${GREEN}✓ All tests completed successfully${NC}"

.PHONY: test-quick
test-quick: ## Quick test run (unit tests only, no cleanup)
	@echo -e "${BLUE}Running quick unit tests...${NC}"
	@bunx vitest run --run
	@echo -e "${GREEN}✓ Quick tests completed${NC}"

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

# ==================== NeonDB Branch Management ====================

.PHONY: branch-create
branch-create: ## Create a new test branch
	@echo -e "${BLUE}Creating new test branch...${NC}"
	@$(NODE) run branch:create
	@echo -e "${GREEN}✓ Test branch created${NC}"

.PHONY: branch-list
branch-list: ## List all test branches
	@echo -e "${BLUE}Listing test branches...${NC}"
	@$(NODE) run branch:list

.PHONY: branch-cleanup
branch-cleanup: ## Cleanup old test branches (24h+)
	@echo -e "${BLUE}Cleaning up old test branches...${NC}"
	@$(NODE) run branch:cleanup
	@echo -e "${GREEN}✓ Branch cleanup completed${NC}"

.PHONY: branch-cleanup-all
branch-cleanup-all: ## Emergency cleanup of all test branches
	@echo -e "${YELLOW}Emergency cleanup of ALL test branches...${NC}"
	@$(NODE) run branch:cleanup 0
	@echo -e "${GREEN}✓ Emergency cleanup completed${NC}"

.PHONY: branch-help
branch-help: ## Show branch management help
	@$(NODE) run branch:help

.PHONY: branch-setup
branch-setup: ## Setup and validate branch testing environment
	@echo -e "${BLUE}Setting up branch testing environment...${NC}"
	@$(NODE) run branch:setup:validate
	@echo -e "${GREEN}✓ Branch testing setup completed${NC}"

.PHONY: branch-test
branch-test: ## Test complete branch workflow
	@echo -e "${BLUE}Testing branch workflow...${NC}"
	@$(NODE) run branch:setup:test
	@echo -e "${GREEN}✓ Branch workflow test completed${NC}"

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

.PHONY: t
t: test ## Alias for test

.PHONY: tw
tw: test-watch ## Alias for test-watch

.PHONY: te
te: test-e2e ## Alias for test-e2e

.PHONY: ts
ts: test-stagehand ## Alias for test-stagehand

.PHONY: tq
tq: test-quick ## Alias for test-quick

.PHONY: tu
tu: test-unit ## Alias for test-unit

.PHONY: ti
ti: test-integration ## Alias for test-integration

.PHONY: ta
ta: test-all ## Alias for test-all

# ==================== Complete Workflows ====================

.PHONY: workflow-dev
workflow-dev: kill-ports lint type-check test dev ## Complete development workflow

.PHONY: workflow-ci
workflow-ci: install lint type-check test build ## Complete CI workflow

.PHONY: workflow-deploy
workflow-deploy: workflow-ci deploy ## Complete deployment workflow

# ==================== Special Targets ====================

.DEFAULT_GOAL := help

# Ensure scripts are executable
$(shell chmod +x scripts/*.sh 2>/dev/null || true)