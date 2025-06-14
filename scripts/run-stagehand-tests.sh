#!/bin/bash

# MEXC Sniper Bot - Stagehand E2E Test Runner
# Comprehensive test runner for Stagehand E2E tests with environment setup and validation

set -e

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
TEST_SUITE="all"
HEADLESS=true
VERBOSE=false
CLEANUP=true
DEV_SERVER_PORT=3008
TIMEOUT=60

# Function to display usage
usage() {
    echo -e "${BLUE}MEXC Sniper Bot - Stagehand E2E Test Runner${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -s, --suite SUITE     Test suite to run (auth|dashboard|patterns|api|integration|all)"
    echo "  -h, --headed          Run tests in headed mode (visible browser)"
    echo "  -v, --verbose         Enable verbose logging"
    echo "  -n, --no-cleanup      Skip cleanup after tests"
    echo "  -p, --port PORT       Development server port (default: 3008)"
    echo "  -t, --timeout TIMEOUT Test timeout in seconds (default: 60)"
    echo "  --help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                           # Run all tests"
    echo "  $0 -s auth -h               # Run auth tests in headed mode"
    echo "  $0 -s patterns -v           # Run pattern tests with verbose logging"
    echo "  $0 --suite integration      # Run integration tests only"
    echo ""
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${BLUE}Checking prerequisites...${NC}"
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Error: Node.js is not installed${NC}"
        exit 1
    fi
    
    # Check if bun is installed
    if ! command -v bun &> /dev/null; then
        echo -e "${RED}Error: Bun is not installed${NC}"
        exit 1
    fi
    
    # Check if required environment variables are set
    if [ -z "$OPENAI_API_KEY" ]; then
        echo -e "${YELLOW}Warning: OPENAI_API_KEY not set. Stagehand tests may fail.${NC}"
        echo -e "${YELLOW}Please set OPENAI_API_KEY in your .env.local file.${NC}"
    fi
    
    # Check if .env.local exists
    if [ ! -f ".env.local" ]; then
        echo -e "${YELLOW}Warning: .env.local not found. Creating from template...${NC}"
        if [ -f ".env.stagehand.example" ]; then
            cp .env.stagehand.example .env.local
            echo -e "${YELLOW}Please configure .env.local with your API keys and settings.${NC}"
        fi
    fi
    
    echo -e "${GREEN}✓ Prerequisites checked${NC}"
}

# Function to setup test environment
setup_environment() {
    echo -e "${BLUE}Setting up test environment...${NC}"
    
    # Set environment variables for Stagehand
    export NODE_ENV=test
    export PLAYWRIGHT_TEST=true
    export STAGEHAND_HEADLESS=$HEADLESS
    export STAGEHAND_VERBOSE=$VERBOSE
    export STAGEHAND_TIMEOUT=$((TIMEOUT * 1000))
    
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}Environment variables:${NC}"
        echo "  NODE_ENV=$NODE_ENV"
        echo "  PLAYWRIGHT_TEST=$PLAYWRIGHT_TEST"
        echo "  STAGEHAND_HEADLESS=$STAGEHAND_HEADLESS"
        echo "  STAGEHAND_VERBOSE=$STAGEHAND_VERBOSE"
        echo "  STAGEHAND_TIMEOUT=$STAGEHAND_TIMEOUT"
    fi
    
    echo -e "${GREEN}✓ Environment setup complete${NC}"
}

# Function to kill processes on ports
kill_ports() {
    echo -e "${BLUE}Cleaning up ports...${NC}"
    
    # Kill processes on common development ports
    pkill -f "next dev" 2>/dev/null || true
    pkill -f "inngest" 2>/dev/null || true
    pkill -f "playwright" 2>/dev/null || true
    pkill -f "stagehand" 2>/dev/null || true
    
    # Kill specific ports
    lsof -ti:$DEV_SERVER_PORT | xargs kill -9 2>/dev/null || true
    lsof -ti:8288 | xargs kill -9 2>/dev/null || true
    
    sleep 2
    echo -e "${GREEN}✓ Ports cleaned${NC}"
}

# Function to start development server
start_dev_server() {
    echo -e "${BLUE}Starting development server on port $DEV_SERVER_PORT...${NC}"
    
    # Start the development server in background
    bun run dev &
    DEV_SERVER_PID=$!
    
    # Wait for server to be ready
    echo -e "${YELLOW}Waiting for server to start...${NC}"
    for i in {1..30}; do
        if curl -s "http://localhost:$DEV_SERVER_PORT" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Development server is ready${NC}"
            return 0
        fi
        sleep 2
        echo -n "."
    done
    
    echo -e "${RED}Error: Development server failed to start${NC}"
    exit 1
}

# Function to run specific test suite
run_test_suite() {
    local suite=$1
    echo -e "${BLUE}Running $suite test suite...${NC}"
    
    local test_command=""
    local test_path=""
    
    case $suite in
        "auth")
            test_command="test:stagehand:auth"
            test_path="tests/stagehand/auth"
            ;;
        "dashboard")
            test_command="test:stagehand:dashboard"
            test_path="tests/stagehand/dashboard"
            ;;
        "patterns")
            test_command="test:stagehand:patterns"
            test_path="tests/stagehand/patterns"
            ;;
        "api")
            test_command="test:stagehand:api"
            test_path="tests/stagehand/api"
            ;;
        "integration")
            test_command="test:stagehand:integration"
            test_path="tests/stagehand/integration"
            ;;
        "all")
            test_command="test:stagehand"
            test_path="tests/stagehand"
            ;;
        *)
            echo -e "${RED}Error: Unknown test suite '$suite'${NC}"
            echo -e "${YELLOW}Available suites: auth, dashboard, patterns, api, integration, all${NC}"
            exit 1
            ;;
    esac
    
    # Run the tests
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}Running command: bun run $test_command${NC}"
        echo -e "${BLUE}Test path: $test_path${NC}"
    fi
    
    if bun run $test_command; then
        echo -e "${GREEN}✓ $suite tests passed${NC}"
        return 0
    else
        echo -e "${RED}✗ $suite tests failed${NC}"
        return 1
    fi
}

# Function to cleanup
cleanup() {
    if [ "$CLEANUP" = true ]; then
        echo -e "${BLUE}Cleaning up...${NC}"
        
        # Kill development server
        if [ ! -z "$DEV_SERVER_PID" ]; then
            kill $DEV_SERVER_PID 2>/dev/null || true
        fi
        
        # Kill ports
        kill_ports
        
        echo -e "${GREEN}✓ Cleanup complete${NC}"
    fi
}

# Function to generate test report
generate_report() {
    echo -e "${BLUE}Generating test report...${NC}"
    
    # Check if playwright report exists
    if [ -d "playwright-report" ]; then
        echo -e "${GREEN}✓ Playwright report available at: playwright-report/index.html${NC}"
    fi
    
    # Check if test screenshots exist
    if [ -d "test-screenshots" ]; then
        local screenshot_count=$(find test-screenshots -name "stagehand-*.png" 2>/dev/null | wc -l)
        if [ $screenshot_count -gt 0 ]; then
            echo -e "${GREEN}✓ $screenshot_count Stagehand test screenshots available in test-screenshots/${NC}"
        fi
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--suite)
            TEST_SUITE="$2"
            shift 2
            ;;
        -h|--headed)
            HEADLESS=false
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -n|--no-cleanup)
            CLEANUP=false
            shift
            ;;
        -p|--port)
            DEV_SERVER_PORT="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown option '$1'${NC}"
            usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    echo -e "${BLUE}MEXC Sniper Bot - Stagehand E2E Test Runner${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
    
    # Setup trap for cleanup
    trap cleanup EXIT
    
    # Run the test pipeline
    check_prerequisites
    setup_environment
    kill_ports
    start_dev_server
    
    # Run tests
    local test_result=0
    run_test_suite "$TEST_SUITE" || test_result=$?
    
    # Generate report
    generate_report
    
    # Final status
    if [ $test_result -eq 0 ]; then
        echo ""
        echo -e "${GREEN}🎉 All Stagehand tests completed successfully!${NC}"
        echo -e "${GREEN}============================================${NC}"
    else
        echo ""
        echo -e "${RED}❌ Some Stagehand tests failed${NC}"
        echo -e "${RED}=============================${NC}"
        exit $test_result
    fi
}

# Run main function
main "$@"
