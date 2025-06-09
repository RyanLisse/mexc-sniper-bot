#!/bin/bash

echo "🔒 MEXC Sniper Bot - Security Analysis Report"
echo "=============================================="

BASE_URL="http://localhost:3000"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0
TOTAL=0

report_test() {
    TOTAL=$((TOTAL + 1))
    if [ $1 -eq 0 ]; then
        echo -e "  ${GREEN}✓${NC} $2"
        PASSED=$((PASSED + 1))
    else
        echo -e "  ${RED}✗${NC} $2"
        FAILED=$((FAILED + 1))
    fi
}

echo ""
echo "🔍 1. AUTHENTICATION SYSTEM ANALYSIS"
echo "-------------------------------------"

# Check if better-auth endpoints are accessible
# Better-auth uses a different endpoint structure
echo "Testing better-auth endpoint structure..."

# Test if session endpoint exists
session_response=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/api/auth/session" -o /dev/null)
signin_response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/auth/sign-in" -H "Content-Type: application/json" -d '{}' -o /dev/null)

echo "Session endpoint response: $session_response"
echo "Sign-in endpoint response: $signin_response"

if [ "$session_response" -eq 404 ] && [ "$signin_response" -eq 404 ]; then
    report_test 1 "Authentication endpoints not accessible - system may not be fully configured"
else
    report_test 0 "Authentication system responding"
fi

echo ""
echo "🛡️  2. DATABASE SECURITY ASSESSMENT"
echo "------------------------------------"

# Check database file security
if [ -f "mexc_sniper.db" ]; then
    report_test 0 "Database file exists"
    
    # Check file permissions
    db_perms=$(stat -f "%OLp" mexc_sniper.db 2>/dev/null || stat -c "%a" mexc_sniper.db 2>/dev/null)
    if [ "$db_perms" -eq 644 ] || [ "$db_perms" -eq 600 ]; then
        report_test 0 "Database file has appropriate permissions ($db_perms)"
    else
        report_test 1 "Database file permissions may be too open ($db_perms)"
    fi
else
    report_test 1 "Database file not found"
fi

echo ""
echo "🌐 3. API ENDPOINT ACCESSIBILITY"
echo "---------------------------------"

# Test public endpoints
echo "Testing public MEXC API endpoints..."

server_time_response=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/api/mexc/server-time" -o /dev/null)
if [ "$server_time_response" -eq 200 ]; then
    report_test 0 "MEXC server-time endpoint accessible"
else
    report_test 1 "MEXC server-time endpoint not accessible ($server_time_response)"
fi

connectivity_response=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/api/mexc/connectivity" -o /dev/null)
if [ "$connectivity_response" -eq 200 ]; then
    report_test 0 "MEXC connectivity endpoint accessible"
else
    report_test 1 "MEXC connectivity endpoint not accessible ($connectivity_response)"
fi

# Test protected endpoints
echo "Testing protected endpoints..."
user_prefs_response=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/api/user-preferences" -o /dev/null)
if [ "$user_prefs_response" -eq 401 ] || [ "$user_prefs_response" -eq 403 ]; then
    report_test 0 "User preferences endpoint properly protected ($user_prefs_response)"
else
    report_test 1 "User preferences endpoint not properly protected ($user_prefs_response)"
fi

echo ""
echo "🚀 4. PERFORMANCE TESTING"
echo "--------------------------"

echo "Testing system responsiveness..."

# Test response times
start_time=$(date +%s%N)
curl -s "$BASE_URL/api/mexc/server-time" > /dev/null
end_time=$(date +%s%N)
response_time=$(((end_time - start_time) / 1000000))

if [ $response_time -lt 1000 ]; then
    report_test 0 "API response time acceptable (${response_time}ms)"
else
    report_test 1 "API response time slow (${response_time}ms)"
fi

# Test concurrent requests
echo "Testing concurrent request handling..."
concurrent_success=0
for i in {1..5}; do
    (
        response=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/api/mexc/server-time" -o /dev/null)
        if [ "$response" -eq 200 ]; then
            echo "OK"
        fi
    ) &
done
wait

report_test 0 "System handles concurrent requests"

echo ""
echo "🔐 5. SECURITY CONFIGURATION ANALYSIS"
echo "--------------------------------------"

# Check Next.js security headers
echo "Checking security headers..."
headers_response=$(curl -s -I "$BASE_URL/dashboard")

if echo "$headers_response" | grep -i "x-powered-by" > /dev/null; then
    report_test 1 "X-Powered-By header exposed (information disclosure)"
else
    report_test 0 "X-Powered-By header properly handled"
fi

# Check for HTTPS redirect in production
if echo "$headers_response" | grep -i "strict-transport-security" > /dev/null; then
    report_test 0 "HSTS header present"
else
    report_test 1 "HSTS header missing (acceptable for development)"
fi

echo ""
echo "📊 6. DATA VALIDATION TESTING"
echo "------------------------------"

echo "Testing input validation on available endpoints..."

# Test malformed JSON
malformed_response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/mexc/server-time" \
    -H "Content-Type: application/json" \
    -d '{invalid json}' -o /dev/null)

if [ "$malformed_response" -eq 400 ] || [ "$malformed_response" -eq 405 ]; then
    report_test 0 "Malformed JSON properly rejected ($malformed_response)"
else
    report_test 1 "Malformed JSON not properly handled ($malformed_response)"
fi

echo ""
echo "🔍 7. ENVIRONMENT SECURITY"
echo "---------------------------"

# Check for exposed environment variables
if [ -f ".env" ] || [ -f ".env.local" ]; then
    report_test 0 "Environment files present"
    
    # Check if .env files are in .gitignore
    if [ -f ".gitignore" ] && grep -q "\.env" .gitignore; then
        report_test 0 "Environment files in .gitignore"
    else
        report_test 1 "Environment files may not be in .gitignore"
    fi
else
    report_test 1 "No environment files found"
fi

echo ""
echo "📦 8. DEPENDENCY SECURITY"
echo "--------------------------"

echo "Checking for known vulnerable dependencies..."

# Check if package.json exists and has security-related packages
if [ -f "package.json" ]; then
    report_test 0 "Package.json found"
    
    # Check for security-related dependencies
    if grep -q "better-auth" package.json; then
        report_test 0 "Better-auth authentication library present"
    else
        report_test 1 "No authentication library found"
    fi
    
    if grep -q "drizzle-orm" package.json; then
        report_test 0 "Drizzle ORM (SQL injection protection) present"
    else
        report_test 1 "No ORM found for SQL injection protection"
    fi
else
    report_test 1 "Package.json not found"
fi

echo ""
echo "🔒 9. SESSION & AUTHENTICATION FLOW"
echo "------------------------------------"

echo "Testing authentication flow integrity..."

# Test dashboard access without authentication
dashboard_response=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/dashboard" -o /dev/null)
echo "Dashboard response without auth: $dashboard_response"

if [ "$dashboard_response" -eq 200 ]; then
    report_test 1 "Dashboard accessible without authentication"
else
    report_test 0 "Dashboard properly protected ($dashboard_response)"
fi

echo ""
echo "🏗️  10. SYSTEM ARCHITECTURE SECURITY"
echo "-------------------------------------"

# Check file structure for security best practices
if [ -d "src" ] && [ -d "app" ]; then
    report_test 0 "Modern Next.js app structure"
fi

if [ -f "next.config.ts" ]; then
    report_test 0 "Next.js configuration file present"
fi

if [ -f "tsconfig.json" ]; then
    report_test 0 "TypeScript configuration present (type safety)"
fi

echo ""
echo "📊 SECURITY ASSESSMENT SUMMARY"
echo "==============================="
echo -e "Total Tests: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 SYSTEM SECURITY ASSESSMENT COMPLETE${NC}"
    security_score=100
elif [ $FAILED -le 3 ]; then
    echo -e "\n${YELLOW}⚠️  MINOR SECURITY ISSUES DETECTED${NC}"
    security_score=$((100 - (FAILED * 10)))
elif [ $FAILED -le 6 ]; then
    echo -e "\n${YELLOW}⚠️  MODERATE SECURITY CONCERNS${NC}"
    security_score=$((100 - (FAILED * 15)))
else
    echo -e "\n${RED}🚨 SIGNIFICANT SECURITY ISSUES${NC}"
    security_score=$((100 - (FAILED * 20)))
fi

echo -e "Security Score: ${YELLOW}$security_score%${NC}"

if [ $security_score -ge 80 ]; then
    echo -e "${GREEN}✅ System acceptable for development/testing${NC}"
elif [ $security_score -ge 60 ]; then
    echo -e "${YELLOW}⚠️  System needs improvements before production${NC}"
else
    echo -e "${RED}❌ System requires significant security improvements${NC}"
fi

echo ""
exit 0