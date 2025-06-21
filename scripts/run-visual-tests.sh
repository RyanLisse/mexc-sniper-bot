#!/bin/bash

# MEXC Sniper Bot - Visual Testing Suite Runner
# This script runs the comprehensive visual test suites with proper configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required dependencies are available
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v bun &> /dev/null; then
        print_error "Bun is not installed. Please install Bun first."
        exit 1
    fi
    
    if ! command -v playwright &> /dev/null; then
        print_warning "Playwright CLI not found globally, using npx..."
    fi
    
    print_success "Dependencies check completed"
}

# Install Playwright browsers if needed
install_browsers() {
    print_status "Installing Playwright browsers..."
    bun playwright install
    print_success "Playwright browsers installed"
}

# Function to run specific test suite
run_test_suite() {
    local test_file=$1
    local description=$2
    
    print_status "Running $description..."
    echo "Test file: $test_file"
    
    # Run the test with proper configuration
    bun playwright test "$test_file" \
        --config=playwright.config.ts \
        --reporter=html \
        --timeout=90000 \
        --workers=1
    
    if [ $? -eq 0 ]; then
        print_success "$description completed successfully"
    else
        print_error "$description failed"
        return 1
    fi
}

# Main execution
main() {
    echo "=========================================="
    echo "MEXC Sniper Bot - Visual Testing Suite"
    echo "=========================================="
    
    check_dependencies
    
    # Ask user about browser installation
    read -p "Do you want to install/update Playwright browsers? (y/N): " install_browsers_choice
    if [[ $install_browsers_choice =~ ^[Yy]$ ]]; then
        install_browsers
    fi
    
    # Set test environment
    export PLAYWRIGHT_TEST=true
    export TEST_ENVIRONMENT=test
    export NODE_ENV=test
    
    print_status "Starting visual test suites..."
    
    # Array of test files and descriptions
    declare -a tests=(
        "tests/e2e/settings-configuration-visual.spec.ts:Settings & Configuration Visual Tests"
        "tests/e2e/safety-monitoring-visual.spec.ts:Safety & Monitoring Visual Tests"
        "tests/e2e/advanced-trading-features-visual.spec.ts:Advanced Trading Features Visual Tests"
        "tests/e2e/authentication-workflow-visual.spec.ts:Authentication & Workflow Visual Tests"
    )
    
    # Ask user which tests to run
    echo
    print_status "Available test suites:"
    echo "1. Settings & Configuration Visual Tests"
    echo "2. Safety & Monitoring Visual Tests"
    echo "3. Advanced Trading Features Visual Tests"
    echo "4. Authentication & Workflow Visual Tests"
    echo "5. All new visual tests"
    echo "6. All existing visual tests (autosniping-dashboard, autosniping-performance)"
    echo "7. Complete visual test suite (all tests)"
    echo
    
    read -p "Select test suite to run (1-7): " test_choice
    
    failed_tests=()
    
    case $test_choice in
        1)
            run_test_suite "tests/e2e/settings-configuration-visual.spec.ts" "Settings & Configuration Visual Tests" || failed_tests+=("Settings & Configuration")
            ;;
        2)
            run_test_suite "tests/e2e/safety-monitoring-visual.spec.ts" "Safety & Monitoring Visual Tests" || failed_tests+=("Safety & Monitoring")
            ;;
        3)
            run_test_suite "tests/e2e/advanced-trading-features-visual.spec.ts" "Advanced Trading Features Visual Tests" || failed_tests+=("Advanced Trading Features")
            ;;
        4)
            run_test_suite "tests/e2e/authentication-workflow-visual.spec.ts" "Authentication & Workflow Visual Tests" || failed_tests+=("Authentication & Workflow")
            ;;
        5)
            print_status "Running all new visual tests..."
            for test_info in "${tests[@]}"; do
                IFS=':' read -r test_file test_desc <<< "$test_info"
                run_test_suite "$test_file" "$test_desc" || failed_tests+=("$test_desc")
            done
            ;;
        6)
            print_status "Running existing visual tests..."
            run_test_suite "tests/e2e/autosniping-dashboard-visual.spec.ts" "Autosniping Dashboard Visual Tests" || failed_tests+=("Autosniping Dashboard")
            run_test_suite "tests/e2e/autosniping-performance-visual.spec.ts" "Autosniping Performance Visual Tests" || failed_tests+=("Autosniping Performance")
            ;;
        7)
            print_status "Running complete visual test suite..."
            # Run existing tests
            run_test_suite "tests/e2e/autosniping-dashboard-visual.spec.ts" "Autosniping Dashboard Visual Tests" || failed_tests+=("Autosniping Dashboard")
            run_test_suite "tests/e2e/autosniping-performance-visual.spec.ts" "Autosniping Performance Visual Tests" || failed_tests+=("Autosniping Performance")
            # Run new tests
            for test_info in "${tests[@]}"; do
                IFS=':' read -r test_file test_desc <<< "$test_info"
                run_test_suite "$test_file" "$test_desc" || failed_tests+=("$test_desc")
            done
            ;;
        *)
            print_error "Invalid selection"
            exit 1
            ;;
    esac
    
    # Summary
    echo
    echo "=========================================="
    echo "Visual Testing Summary"
    echo "=========================================="
    
    if [ ${#failed_tests[@]} -eq 0 ]; then
        print_success "All selected tests passed!"
    else
        print_error "Some tests failed:"
        for failed_test in "${failed_tests[@]}"; do
            echo "  - $failed_test"
        done
    fi
    
    # Provide information about reports
    echo
    print_status "Test reports generated:"
    echo "  - HTML Report: playwright-report/index.html"
    echo "  - JSON Report: playwright-report/results.json"
    echo "  - JUnit Report: playwright-report/junit.xml"
    echo
    print_status "To view the HTML report, run:"
    echo "  bun playwright show-report"
    
    # Exit with appropriate code
    if [ ${#failed_tests[@]} -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main "$@"