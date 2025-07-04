# Security Test Suite

This directory contains comprehensive security tests for the MEXC Sniper Bot application.

## Test Categories

### 1. Authentication & Authorization (`auth/`)
- JWT token validation and security
- Session management security
- Privilege escalation prevention
- Multi-factor authentication testing
- Rate limiting for auth endpoints

### 2. API Security (`api/`)
- Endpoint authorization validation
- CORS policy testing
- API key security validation
- Request/response validation
- Unauthorized access prevention

### 3. Input Validation (`input-validation/`)
- XSS (Cross-Site Scripting) prevention
- SQL injection protection
- Command injection prevention
- Path traversal protection
- Malicious payload detection

### 4. Encryption (`encryption/`)
- Cryptographic implementation validation
- Key rotation testing
- Secure storage verification
- Encryption/decryption integrity
- Key management security

### 5. Trading Security (`trading/`)
- MEXC API credential protection
- Transaction integrity verification
- Portfolio access control
- Trading authorization validation
- Risk management security

### 6. Vulnerability Assessment (`vulnerability/`)
- Dependency vulnerability scanning
- Security compliance validation
- Automated security checks
- Configuration security audit
- Security best practices verification

### 7. Infrastructure Security (`infrastructure/`)
- Security headers validation
- Rate limiting testing
- HTTPS enforcement
- Database security
- Environment variable protection

## Running Security Tests

```bash
# Run all security tests
make test-security

# Run specific security test categories
bun test tests/security/auth/
bun test tests/security/api/
bun test tests/security/input-validation/
bun test tests/security/encryption/
bun test tests/security/trading/
bun test tests/security/vulnerability/
bun test tests/security/infrastructure/

# Run with coverage
COVERAGE=true bun test tests/security/
```

## Security Test Guidelines

1. **Zero Trust**: Assume all inputs are malicious until proven otherwise
2. **Defense in Depth**: Test multiple layers of security controls
3. **Real-world Scenarios**: Use actual attack vectors and payloads
4. **Compliance**: Ensure tests cover regulatory requirements
5. **Performance**: Security tests should not significantly impact performance

## Test Data Security

- Never use real credentials in tests
- Use secure test data generators
- Sanitize all test outputs
- Rotate test keys regularly
- Follow data minimization principles

## Reporting

Security test results are automatically aggregated and reported to:
- Test coverage reports
- Security compliance dashboards
- Vulnerability management systems
- Audit logging systems