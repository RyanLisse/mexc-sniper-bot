#!/bin/bash

# SETUP.sh - MEXC Sniper Bot Environment Setup Script
# Idempotent setup script for cloud-based agents and local development

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check and install Node.js/Bun
setup_runtime() {
    log_info "Checking runtime requirements..."
    
    # Check Node.js version
    if command_exists node; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        REQUIRED_NODE="20.11.0"
        if [ "$(printf '%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_NODE" ]; then
            log_success "Node.js $NODE_VERSION found (required: $REQUIRED_NODE+)"
        else
            log_error "Node.js version $NODE_VERSION is too old. Required: $REQUIRED_NODE+"
            exit 1
        fi
    else
        log_error "Node.js not found. Please install Node.js $REQUIRED_NODE+ from https://nodejs.org/"
        exit 1
    fi
    
    # Check for Bun
    if ! command_exists bun; then
        log_warning "Bun not found. Installing Bun..."
        if command_exists curl; then
            curl -fsSL https://bun.sh/install | bash
            export PATH="$HOME/.bun/bin:$PATH"
        else
            log_error "curl not found. Please install Bun manually: https://bun.sh/"
            exit 1
        fi
    else
        log_success "Bun found: $(bun --version)"
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    if [ -f "package.json" ]; then
        bun install
        log_success "Dependencies installed successfully"
    else
        log_error "package.json not found in current directory"
        exit 1
    fi
}

# Setup database
setup_database() {
    log_info "Setting up database..."
    
    # Check if database migrations exist
    if [ -d "src/db/migrations" ]; then
        # Use safe migration script that handles existing tables
        if [ -f "scripts/safe-migrate.sh" ]; then
            log_info "Using safe migration script..."
            ./scripts/safe-migrate.sh
        else
            log_warning "Safe migration script not found, using standard migration"
            bun run db:migrate || {
                log_warning "Standard migration failed - this might be normal if tables already exist"
                log_info "Database setup continuing..."
            }
        fi
        log_success "Database setup completed"
    else
        log_warning "No database migrations found in src/db/migrations"
    fi
}

# Setup environment files
setup_environment() {
    log_info "Setting up environment configuration..."
    
    # Create .env.local if it doesn't exist
    if [ ! -f ".env.local" ] && [ -f ".env.example" ]; then
        cp .env.example .env.local
        log_success "Created .env.local from .env.example"
        log_warning "Please configure your environment variables in .env.local"
    elif [ ! -f ".env.local" ]; then
        log_warning "No .env.local found and no .env.example to copy from"
    else
        log_info ".env.local already exists"
    fi
}

# Validate setup
validate_setup() {
    log_info "Validating setup..."
    
    # Check if critical commands work
    if bun run type-check > /dev/null 2>&1; then
        log_success "TypeScript validation passed"
    else
        log_error "TypeScript validation failed"
        exit 1
    fi
    
    # Check if build works
    if bun run build > /dev/null 2>&1; then
        log_success "Build process completed successfully"
    else
        log_warning "Build process failed - check your configuration"
    fi
    
    # Check if tests can run
    if bun run test --run > /dev/null 2>&1; then
        log_success "Test framework is working"
    else
        log_warning "Test framework may have issues"
    fi
}

# Main setup function
main() {
    log_info "Starting MEXC Sniper Bot setup..."
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ] || ! grep -q "mexc-sniper-bot" package.json; then
        log_error "Please run this script from the mexc-sniper-bot project root directory"
        exit 1
    fi
    
    setup_runtime
    install_dependencies
    setup_database
    setup_environment
    validate_setup
    
    log_success "Setup completed successfully!"
    echo ""
    log_info "Next steps:"
    echo "  1. Configure your environment variables in .env.local"
    echo "  2. Run 'npm run dev' to start the development server"
    echo "  3. Visit http://localhost:3008 to access the dashboard"
    echo ""
    log_info "Useful commands:"
    echo "  - bun run pre-commit    # Run all quality checks"
    echo "  - bun run test          # Run unit tests"
    echo "  - bun run db:studio     # Open database GUI"
    echo ""
}

# Run main function
main "$@"