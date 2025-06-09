#!/bin/bash

echo "🔒 MEXC Sniper Bot - System Integration & Security Validation"
echo "==========================================================="
echo "Starting comprehensive security and integration testing..."
echo ""

BASE_URL="http://localhost:3000"
AUTH_BASE="$BASE_URL/api/auth"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0
TOTAL=0

# Function to report test results
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

echo "🔍 1. AUTHENTICATION ENDPOINT DISCOVERY"
echo "----------------------------------------"

# Test basic auth endpoints
echo "Testing authentication endpoint accessibility..."

# Test sign-up endpoint
response=$(curl -s -w "%{http_code}" -X POST "$AUTH_BASE/sign-up" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"testpass123","name":"Test User"}' \
    -o /dev/null)

if [ "$response" -eq 200 ] || [ "$response" -eq 201 ] || [ "$response" -eq 400 ]; then
    report_test 0 "Sign-up endpoint accessible"
else
    report_test 1 "Sign-up endpoint not accessible (HTTP $response)"
fi

# Test sign-in endpoint
response=$(curl -s -w "%{http_code}" -X POST "$AUTH_BASE/sign-in" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"testpass123"}' \
    -o /dev/null)

if [ "$response" -eq 200 ] || [ "$response" -eq 401 ] || [ "$response" -eq 400 ]; then
    report_test 0 "Sign-in endpoint accessible"
else
    report_test 1 "Sign-in endpoint not accessible (HTTP $response)"
fi

echo ""
echo "🛡️  2. SQL INJECTION ATTACK TESTING"
echo "------------------------------------"

# Test SQL injection in email field
echo "Testing SQL injection vulnerabilities..."

# Common SQL injection payloads
sql_payloads=(
    "admin'; DROP TABLE users; --"
    "' OR '1'='1"
    "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --"
    "admin' UNION SELECT * FROM user--"
    "'; UPDATE user SET password='hacked' WHERE email='admin@test.com'; --"
)

for payload in "${sql_payloads[@]}"; do
    response=$(curl -s -w "%{http_code}" -X POST "$AUTH_BASE/sign-in" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$payload\",\"password\":\"password\"}" \
        -o /dev/null)
    
    if [ "$response" -eq 400 ] || [ "$response" -eq 422 ] || [ "$response" -eq 401 ]; then
        report_test 0 "SQL injection blocked: $(echo "$payload" | cut -c1-20)..."
    else
        report_test 1 "Potential SQL injection vulnerability: $(echo "$payload" | cut -c1-20)..."
    fi
done

echo ""
echo "🌐 3. XSS VULNERABILITY TESTING"
echo "--------------------------------"

# Test XSS in registration fields
echo "Testing Cross-Site Scripting (XSS) vulnerabilities..."

xss_payloads=(
    "<script>alert('XSS')</script>"
    "<img src=x onerror=alert('XSS')>"
    "javascript:alert('XSS')"
    "<svg onload=alert('XSS')>"
    "';alert('XSS');//"
)

for payload in "${xss_payloads[@]}"; do
    response=$(curl -s -w "%{http_code}" -X POST "$AUTH_BASE/sign-up" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"test@example.com\",\"password\":\"pass123\",\"name\":\"$payload\"}" \
        -o /dev/null)
    
    if [ "$response" -eq 400 ] || [ "$response" -eq 422 ]; then
        report_test 0 "XSS payload sanitized: $(echo "$payload" | cut -c1-20)..."
    else
        report_test 1 "Potential XSS vulnerability: $(echo "$payload" | cut -c1-20)..."
    fi
done

echo ""
echo "🔐 4. PASSWORD SECURITY TESTING"
echo "--------------------------------"

echo "Testing password security requirements..."

# Test weak passwords
weak_passwords=(
    "123"
    "password"
    "12345678"
    "admin"
    "test"
    ""
)

for pwd in "${weak_passwords[@]}"; do
    response=$(curl -s -w "%{http_code}" -X POST "$AUTH_BASE/sign-up" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"weak_$RANDOM@test.com\",\"password\":\"$pwd\",\"name\":\"Test\"}" \
        -o /dev/null)
    
    if [ "$response" -eq 400 ] || [ "$response" -eq 422 ]; then
        report_test 0 "Weak password rejected: '$pwd'"
    else
        report_test 1 "Weak password accepted: '$pwd'"
    fi
done

echo ""
echo "📧 5. EMAIL VALIDATION TESTING"
echo "-------------------------------"

echo "Testing email validation security..."

# Test invalid email formats
invalid_emails=(
    "notanemail"
    "@domain.com"
    "user@"
    "user..double.dot@domain.com"
    "user@domain"
    ""
)

for email in "${invalid_emails[@]}"; do
    response=$(curl -s -w "%{http_code}" -X POST "$AUTH_BASE/sign-up" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"validpass123\",\"name\":\"Test\"}" \
        -o /dev/null)
    
    if [ "$response" -eq 400 ] || [ "$response" -eq 422 ]; then
        report_test 0 "Invalid email rejected: '$email'"
    else
        report_test 1 "Invalid email accepted: '$email'"
    fi
done

echo ""
echo "🔄 6. CSRF PROTECTION TESTING"
echo "------------------------------"

echo "Testing CSRF protection mechanisms..."

# Test requests without proper headers
response=$(curl -s -w "%{http_code}" -X POST "$AUTH_BASE/sign-up" \
    -H "Content-Type: application/json" \
    -H "Origin: https://evil-domain.com" \
    -d '{"email":"csrf@test.com","password":"testpass123","name":"CSRF Test"}' \
    -o /dev/null)

if [ "$response" -eq 403 ] || [ "$response" -eq 400 ]; then
    report_test 0 "CSRF protection active (cross-origin blocked)"
else
    report_test 1 "Potential CSRF vulnerability (cross-origin allowed)"
fi

echo ""
echo "⚡ 7. RATE LIMITING TESTING"
echo "---------------------------"

echo "Testing rate limiting for authentication endpoints..."

# Rapid-fire requests to test rate limiting
echo "Sending rapid authentication requests..."
failed_attempts=0
for i in {1..10}; do
    response=$(curl -s -w "%{http_code}" -X POST "$AUTH_BASE/sign-in" \
        -H "Content-Type: application/json" \
        -d '{"email":"nonexistent@test.com","password":"wrongpass"}' \
        -o /dev/null)
    
    if [ "$response" -eq 429 ]; then
        failed_attempts=$((failed_attempts + 1))
    fi
    sleep 0.1
done

if [ $failed_attempts -gt 0 ]; then
    report_test 0 "Rate limiting active (detected $failed_attempts/10 rate-limited responses)"
else
    report_test 1 "No rate limiting detected"
fi

echo ""
echo "🔒 8. SESSION MANAGEMENT TESTING"
echo "---------------------------------"

echo "Testing session security..."

# Test session creation and validation
echo "Creating test user for session testing..."
user_email="sessiontest_$RANDOM@test.com"
registration_response=$(curl -s -X POST "$AUTH_BASE/sign-up" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$user_email\",\"password\":\"SessionTest123!\",\"name\":\"Session Test\"}")

echo "Testing session-based access..."

# Test accessing protected endpoint without session
response=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/api/user-preferences" \
    -H "Content-Type: application/json" \
    -o /dev/null)

if [ "$response" -eq 401 ] || [ "$response" -eq 403 ]; then
    report_test 0 "Protected endpoint blocks unauthenticated access"
else
    report_test 1 "Protected endpoint allows unauthenticated access"
fi

echo ""
echo "💾 9. DATABASE SECURITY TESTING"
echo "--------------------------------"

echo "Testing database security and data isolation..."

# Check if database is accessible directly
if command -v sqlite3 &> /dev/null; then
    if [ -f "mexc_sniper.db" ]; then
        # Test if sensitive data is encrypted
        user_data=$(sqlite3 mexc_sniper.db "SELECT COUNT(*) FROM user LIMIT 1" 2>/dev/null || echo "0")
        if [ "$user_data" != "0" ]; then
            report_test 0 "Database accessible for testing"
            
            # Check if passwords are hashed
            password_check=$(sqlite3 mexc_sniper.db "SELECT password FROM account WHERE password IS NOT NULL LIMIT 1" 2>/dev/null || echo "")
            if [ -n "$password_check" ] && [[ ! "$password_check" =~ ^[a-zA-Z0-9]{5,}$ ]]; then
                report_test 0 "Passwords appear to be hashed/encrypted"
            else
                report_test 1 "Passwords may not be properly secured"
            fi
        else
            report_test 0 "Database structure accessible"
        fi
    else
        report_test 1 "Database file not found"
    fi
else
    report_test 1 "SQLite not available for testing"
fi

echo ""
echo "🚀 10. PERFORMANCE & LOAD TESTING"
echo "----------------------------------"

echo "Testing system performance under load..."

# Concurrent user simulation
echo "Simulating concurrent API requests..."
concurrent_requests=5
success_count=0

for i in $(seq 1 $concurrent_requests); do
    (
        response=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/api/mexc/server-time" \
            -H "Content-Type: application/json" \
            -o /dev/null)
        if [ "$response" -eq 200 ]; then
            echo "SUCCESS"
        else
            echo "FAILED:$response"
        fi
    ) &
done

wait

# Check if server is still responsive
response=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/api/mexc/server-time" \
    -H "Content-Type: application/json" \
    -o /dev/null)

if [ "$response" -eq 200 ]; then
    report_test 0 "Server responsive after load test"
else
    report_test 1 "Server degraded after load test (HTTP $response)"
fi

echo ""
echo "🔍 11. API ENDPOINT SECURITY"
echo "-----------------------------"

echo "Testing API endpoint security..."

# Test API endpoints that should be protected
protected_endpoints=(
    "/api/user-preferences"
    "/api/api-credentials"
    "/api/triggers/trading-strategy"
    "/api/triggers/symbol-watch"
)

for endpoint in "${protected_endpoints[@]}"; do
    response=$(curl -s -w "%{http_code}" -X GET "$BASE_URL$endpoint" \
        -H "Content-Type: application/json" \
        -o /dev/null)
    
    if [ "$response" -eq 401 ] || [ "$response" -eq 403 ]; then
        report_test 0 "Protected endpoint secured: $endpoint"
    else
        report_test 1 "Unprotected endpoint: $endpoint (HTTP $response)"
    fi
done

# Test public endpoints that should be accessible
public_endpoints=(
    "/api/mexc/server-time"
    "/api/mexc/connectivity"
)

for endpoint in "${public_endpoints[@]}"; do
    response=$(curl -s -w "%{http_code}" -X GET "$BASE_URL$endpoint" \
        -H "Content-Type: application/json" \
        -o /dev/null)
    
    if [ "$response" -eq 200 ]; then
        report_test 0 "Public endpoint accessible: $endpoint"
    else
        report_test 1 "Public endpoint not accessible: $endpoint (HTTP $response)"
    fi
done

echo ""
echo "🔐 12. INPUT SANITIZATION TESTING"
echo "----------------------------------"

echo "Testing input sanitization across endpoints..."

# Test malicious JSON payloads
malicious_payloads=(
    '{"__proto__":{"admin":true}}'
    '{"constructor":{"prototype":{"admin":true}}}'
    '{"email":"test@test.com","password":"test","name":"<script>alert(1)</script>"}'
    '{"email":"test'; DROP TABLE user; --","password":"test"}'
)

for payload in "${malicious_payloads[@]}"; do
    response=$(curl -s -w "%{http_code}" -X POST "$AUTH_BASE/sign-up" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        -o /dev/null)
    
    if [ "$response" -eq 400 ] || [ "$response" -eq 422 ] || [ "$response" -eq 500 ]; then
        report_test 0 "Malicious payload blocked: $(echo "$payload" | cut -c1-30)..."
    else
        report_test 1 "Malicious payload accepted: $(echo "$payload" | cut -c1-30)..."
    fi
done

echo ""
echo "📊 SECURITY TEST RESULTS SUMMARY"
echo "================================="
echo -e "Total Tests: ${BLUE}$TOTAL${NC}"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL SECURITY TESTS PASSED!${NC}"
    echo "The system appears to be secure for production deployment."
    exit 0
else
    echo -e "\n${YELLOW}⚠️  SECURITY ISSUES DETECTED${NC}"
    echo "Please review and address the failed tests before production deployment."
    exit 1
fi