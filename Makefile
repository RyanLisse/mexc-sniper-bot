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

.PHONY: setup-supabase
setup-supabase: ## Setup Supabase (interactive)
	@echo -e "${BLUE}Setting up Supabase...${NC}"
	@echo -e "${YELLOW}Please visit https://supabase.com to create your project${NC}"
	@echo -e "${YELLOW}Then configure your DATABASE_URL in .env.local${NC}"

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
test: kill-ports ## Run unit tests
	@echo -e "${BLUE}Running unit tests...${NC}"
	@$(NODE) run test
	@echo -e "${GREEN}✓ Unit tests completed${NC}"

.PHONY: test-unit
test-unit: ## Run unit tests only
	@echo -e "${BLUE}Running unit tests...${NC}"
	@$(NODE) run test
	@echo -e "${GREEN}✓ Unit tests completed${NC}"

.PHONY: test-integration
test-integration: ## Run integration tests only
	@echo -e "${BLUE}Running integration tests...${NC}"
	@$(NODE) run test:integration
	@echo -e "${GREEN}✓ Integration tests completed${NC}"

.PHONY: test-e2e
test-e2e: kill-ports ## Run E2E tests (starts dev server)
	@echo -e "${BLUE}Running E2E tests...${NC}"
	@echo -e "${YELLOW}Starting development server for E2E tests...${NC}"
	@$(NODE) run dev &
	@sleep 5
	@echo -e "${BLUE}Running E2E tests...${NC}"
	@$(NODE) run test:e2e || true
	@echo -e "${YELLOW}Cleaning up development server...${NC}"
	@$(MAKE) kill-ports
	@echo -e "${GREEN}✓ E2E tests completed${NC}"

.PHONY: test-stagehand
test-stagehand: kill-ports ## Run Stagehand E2E tests
	@echo -e "${BLUE}Running Stagehand E2E tests...${NC}"
	@echo -e "${YELLOW}Starting development server for Stagehand tests...${NC}"
	@$(NODE) run dev &
	@sleep 5
	@$(NODE) run test:stagehand || true
	@$(MAKE) kill-ports
	@echo -e "${GREEN}✓ Stagehand E2E tests completed${NC}"

.PHONY: test-all
test-all: kill-ports ## Run complete test suite
	@echo -e "${BLUE}Running complete test suite...${NC}"
	@$(NODE) run test:all
	@echo -e "${GREEN}✓ All tests completed successfully${NC}"

.PHONY: test-watch
test-watch: ## Run tests in watch mode
	@echo -e "${BLUE}Running tests in watch mode...${NC}"
	@$(NODE) run test:watch

.PHONY: test-coverage
test-coverage: kill-ports ## Run tests with coverage report
	@echo -e "${BLUE}Running tests with coverage...${NC}"
	@$(NODE) run test:coverage
	@echo -e "${GREEN}✓ Coverage report generated${NC}"

.PHONY: test-performance
test-performance: ## Run performance tests
	@echo -e "${BLUE}Running performance tests...${NC}"
	@$(NODE) run test:performance
	@echo -e "${GREEN}✓ Performance tests completed${NC}"

.PHONY: test-security
test-security: ## Run security tests
	@echo -e "${BLUE}Running security tests...${NC}"
	@$(NODE) run test:security
	@echo -e "${GREEN}✓ Security tests completed${NC}"

.PHONY: test-quick
test-quick: ## Quick test run with optimizations
	@echo -e "${BLUE}Running quick tests...${NC}"
	@$(NODE) run test
	@echo -e "${GREEN}✓ Quick tests completed${NC}"

.PHONY: test-build-verify
test-build-verify: ## Pre-build verification tests
	@echo -e "${BLUE}Running pre-build verification...${NC}"
	@$(NODE) run test:build-verify
	@echo -e "${GREEN}✓ Build verification completed${NC}"

# ==================== Authentication Commands ====================

.PHONY: auth-verify
auth-verify: ## Verify authentication setup and email confirmation
	@echo -e "${BLUE}Verifying authentication setup...${NC}"
	@$(NODE) run scripts/test-auth-verification.ts
	@echo -e "${GREEN}✓ Authentication verification completed${NC}"

.PHONY: auth-bypass-email
auth-bypass-email: ## Bypass email confirmation for test user
	@echo -e "${BLUE}Bypassing email confirmation...${NC}"
	@$(NODE) run scripts/bypass-email-confirmation.ts --email $(EMAIL)
	@echo -e "${GREEN}✓ Email confirmation bypassed${NC}"

.PHONY: auth-bypass-all
auth-bypass-all: ## Bypass email confirmation for all unconfirmed users
	@echo -e "${BLUE}Bypassing email confirmation for all users...${NC}"
	@$(NODE) run scripts/bypass-email-confirmation.ts --confirm-all
	@echo -e "${GREEN}✓ All email confirmations bypassed${NC}"

.PHONY: auth-check-status
auth-check-status: ## Check email confirmation status
	@echo -e "${BLUE}Checking email confirmation status...${NC}"
	@$(NODE) run scripts/bypass-email-confirmation.ts --check-status
	@echo -e "${GREEN}✓ Status check completed${NC}"

.PHONY: auth-create-test-user
auth-create-test-user: ## Create test user with bypassed email confirmation
	@echo -e "${BLUE}Creating test user...${NC}"
	@$(NODE) run scripts/bypass-email-confirmation.ts --create-test-user --email $(EMAIL)
	@echo -e "${GREEN}✓ Test user created${NC}"

.PHONY: auth-setup-testing
auth-setup-testing: ## Complete authentication setup for testing
	@echo -e "${BLUE}Setting up authentication for testing...${NC}"
	@$(MAKE) auth-verify
	@$(MAKE) auth-bypass-email EMAIL=ryan@ryanlisse.com
	@$(MAKE) auth-check-status
	@echo -e "${GREEN}✓ Authentication testing setup completed${NC}"

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

# ==================== Database Branch Management (Legacy) ====================

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
	@echo -e "Database: $$(if [ -n "$$DATABASE_URL" ] && [[ "$$DATABASE_URL" == *"supabase"* ]]; then echo "Supabase"; else echo "Local PostgreSQL"; fi)"

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

# ==================== Railway Setup Commands ====================

.PHONY: railway-init
railway-init: ## Initialize Railway project
	@echo -e "${BLUE}Initializing Railway project...${NC}"
	@bun run scripts/railway-init.ts
	@echo -e "${GREEN}✓ Railway initialization complete${NC}"

.PHONY: railway-status
railway-status: ## Show Railway project status
	@echo -e "${BLUE}Railway project status:${NC}"
	@railway status

.PHONY: railway-vars
railway-vars: ## Show Railway environment variables
	@echo -e "${BLUE}Railway environment variables:${NC}"
	@railway variables

.PHONY: railway-logs
railway-logs: ## Show Railway deployment logs
	@echo -e "${BLUE}Railway deployment logs:${NC}"
	@railway logs

# ==================== Production Commands ====================

.PHONY: deploy
deploy: ## Deploy to production (Railway)
	@echo -e "${BLUE}Deploying to production...${NC}"
	@railway deploy --environment production
	@echo -e "${GREEN}✓ Deployment complete${NC}"

.PHONY: deploy-preview
deploy-preview: ## Deploy preview build
	@echo -e "${BLUE}Deploying preview build...${NC}"
	@railway deploy --environment staging
	@echo -e "${GREEN}✓ Preview deployment complete${NC}"

.PHONY: deploy-verify
deploy-verify: ## Deploy and verify production deployment
	@echo -e "${BLUE}Deploying and verifying production...${NC}"
	@$(MAKE) production-readiness-check
	@$(MAKE) deploy
	@sleep 30
	@$(MAKE) verify-deployment
	@echo -e "${GREEN}✅ Production deployment verified and ready${NC}"

.PHONY: verify-deployment
verify-deployment: ## Verify production deployment health
	@echo -e "${BLUE}Verifying production deployment...${NC}"
	@bun run deployment/production-verification.ts --url $${RAILWAY_PUBLIC_DOMAIN:-https://mexc-sniper-bot-production.up.railway.app}
	@echo -e "${GREEN}✓ Deployment verification complete${NC}"

.PHONY: monitor-production
monitor-production: ## Start production monitoring
	@echo -e "${BLUE}Starting production monitoring...${NC}"
	@bun run scripts/production-monitoring.ts --url $${RAILWAY_PUBLIC_DOMAIN:-https://mexc-sniper-bot-production.up.railway.app}

.PHONY: monitor-dashboard
monitor-dashboard: ## Show production readiness dashboard
	@echo -e "${BLUE}Opening production readiness dashboard...${NC}"
	@bun run scripts/production-readiness-dashboard.ts --url $${RAILWAY_PUBLIC_DOMAIN:-https://mexc-sniper-bot-production.up.railway.app}

.PHONY: validate-config
validate-config: ## Validate production configuration
	@echo -e "${BLUE}Validating production configuration...${NC}"
	@bun run scripts/production-config-validator.ts
	@echo -e "${GREEN}✓ Configuration validation complete${NC}"

# ==================== Production Commands ====================

.PHONY: production-readiness-check
production-readiness-check: ## Complete production readiness validation
	@echo -e "${BLUE}Complete production readiness check...${NC}"
	@echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
	@echo -e "${YELLOW}1/9: Configuration validation...${NC}"
	@$(MAKE) validate-config
	@echo -e "${YELLOW}2/9: Code quality and type checking...${NC}"
	@$(MAKE) lint type-check
	@echo -e "${YELLOW}3/9: Unit and integration tests...${NC}"
	@$(MAKE) test-unit test-integration
	@echo -e "${YELLOW}4/9: Build verification...${NC}"
	@$(MAKE) build
	@echo -e "${YELLOW}5/9: E2E functional tests...${NC}"
	@$(MAKE) test-e2e
	@echo -e "${YELLOW}6/9: Stagehand user journey tests...${NC}"
	@$(MAKE) test-stagehand
	@echo -e "${YELLOW}7/9: Production security and performance tests...${NC}"
	@$(MAKE) test-security test-performance
	@echo -e "${YELLOW}8/9: Production readiness validation...${NC}"
	@bun run scripts/production-readiness-validator.ts
	@echo -e "${YELLOW}9/9: Generating final readiness report...${NC}"
	@bun run scripts/production-readiness-dashboard.ts --report
	@echo -e "${GREEN}✓ Production readiness check completed${NC}"
	@echo -e "${GREEN}🚀 System ready for production deployment${NC}"

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

.PHONY: prc
prc: production-readiness-check ## Alias for production-readiness-check

.PHONY: dv
dv: deploy-verify ## Alias for deploy-verify

.PHONY: vd
vd: verify-deployment ## Alias for verify-deployment

.PHONY: mp
mp: monitor-production ## Alias for monitor-production

.PHONY: md
md: monitor-dashboard ## Alias for monitor-dashboard

.PHONY: vc
vc: validate-config ## Alias for validate-config

.PHONY: ri
ri: railway-init ## Alias for railway-init

.PHONY: rs
rs: railway-status ## Alias for railway-status

.PHONY: rv
rv: railway-vars ## Alias for railway-vars

.PHONY: rl
rl: railway-logs ## Alias for railway-logs

# ==================== Complete Workflows ====================

.PHONY: workflow-dev
workflow-dev: kill-ports lint type-check test dev ## Complete development workflow

.PHONY: workflow-ci
workflow-ci: install lint type-check test build ## Complete CI workflow

.PHONY: workflow-deploy
workflow-deploy: workflow-ci deploy-verify ## Complete deployment workflow with verification

.PHONY: workflow-production
workflow-production: production-readiness-check deploy verify-deployment ## Complete production deployment workflow

# ==================== Special Targets ====================

.DEFAULT_GOAL := help

# Ensure scripts are executable
$(shell chmod +x scripts/*.sh 2>/dev/null || true)