/**
 * Security Test Utilities
 * 
 * Common utilities for security testing across all test suites
 */

import crypto from 'crypto'
import { NextRequest } from 'next/server'

// ============================================================================
// Security Test Data Generators
// ============================================================================

export class SecurityTestDataGenerator {
  /**
   * Generate test JWT tokens with various security scenarios
   */
  static generateTestJWTTokens() {
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    
    return {
      valid: validToken,
      expired: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.expired',
      malformed: 'malformed.jwt.token',
      tampered: validToken.slice(0, -10) + 'tampered123',
      invalidSignature: validToken.slice(0, -5) + 'invalid',
      noSignature: validToken.split('.').slice(0, 2).join('.'),
      nullBytes: validToken + '\0\0\0',
      oversized: validToken + 'x'.repeat(10000)
    }
  }

  /**
   * Generate XSS payloads for testing
   */
  static generateXSSPayloads() {
    return [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(1)">',
      '"><script>alert(String.fromCharCode(88,83,83))</script>',
      '<svg onload="alert(1)">',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(1)">',
      '<input type="text" value="XSS" onfocus="alert(1)">',
      '<body onload="alert(1)">',
      '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
      '<object data="javascript:alert(1)">',
      '<link rel="stylesheet" href="javascript:alert(1)">',
      '<style>@import "javascript:alert(1)";</style>',
      '<div style="background:url(javascript:alert(1))">',
      '<base href="javascript:alert(1)//">',
      '<form action="javascript:alert(1)">',
      '<table background="javascript:alert(1)">',
      '<td background="javascript:alert(1)">',
      '<script>eval(String.fromCharCode(97,108,101,114,116,40,39,88,83,83,39,41))</script>'
    ]
  }

  /**
   * Generate SQL injection payloads
   */
  static generateSQLInjectionPayloads() {
    return [
      "' OR '1'='1",
      "' OR '1'='1' --",
      "' OR '1'='1' /*",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "' UNION SELECT username, password FROM users --",
      "admin'--",
      "admin' #",
      "admin'/*",
      "' or 1=1#",
      "' or 1=1--",
      "' or 1=1/*",
      "') or '1'='1--",
      "') or ('1'='1--",
      "1' OR '1'='1",
      "1' OR '1'='1' --",
      "1' OR '1'='1' /*",
      "1; DROP TABLE users",
      "1 UNION SELECT * FROM users",
      "1 UNION SELECT username, password FROM users"
    ]
  }

  /**
   * Generate path traversal payloads
   */
  static generatePathTraversalPayloads() {
    return [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '....//....//....//etc/passwd',
      '....\\\\....\\\\....\\\\windows\\system32\\config\\sam',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '%2e%2e%5c%2e%2e%5c%2e%2e%5cwindows%5csystem32%5cconfig%5csam',
      '..%252f..%252f..%252fetc%252fpasswd',
      '..%255c..%255c..%255cwindows%255csystem32%255cconfig%255csam',
      '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd',
      '..%c1%9c..%c1%9c..%c1%9cetc%c1%9cpasswd',
      '/var/www/../../etc/passwd',
      '/var/www/..\\..\\..\\etc/passwd',
      'C:\\inetpub\\wwwroot\\..\\..\\..\\windows\\system32\\config\\sam'
    ]
  }

  /**
   * Generate malicious file names
   */
  static generateMaliciousFilenames() {
    return [
      '../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      'con.txt',
      'aux.txt',
      'prn.txt',
      'nul.txt',
      'com1.txt',
      'com2.txt',
      'lpt1.txt',
      'lpt2.txt',
      '.htaccess',
      'web.config',
      'index.php',
      'shell.php',
      'cmd.exe',
      'powershell.exe',
      'bash',
      'sh',
      'rm -rf /',
      'del /f /q c:\\*.*',
      'format c:',
      'shutdown -s -t 0',
      'sudo rm -rf /',
      'rm -rf *',
      'del *.*',
      'attrib +h +s +r *.*',
      'cacls c:\\ /e /p everyone:f',
      'net user hacker password /add',
      'net localgroup administrators hacker /add'
    ]
  }

  /**
   * Generate malicious API keys and tokens
   */
  static generateMaliciousAPIKeys() {
    return [
      'sk-' + '0'.repeat(48), // OpenAI-like format
      'xoxb-' + '0'.repeat(56), // Slack-like format
      'ghp_' + '0'.repeat(36), // GitHub-like format
      'glpat-' + '0'.repeat(20), // GitLab-like format
      'AIza' + '0'.repeat(35), // Google API-like format
      'AKIA' + '0'.repeat(16), // AWS-like format
      'sk_test_' + '0'.repeat(50), // Stripe-like format
      'pk_test_' + '0'.repeat(50), // Stripe-like format
      'rk_test_' + '0'.repeat(50), // Stripe-like format
      'whsec_' + '0'.repeat(50), // Stripe webhook-like format
      'Bearer ' + '0'.repeat(64), // Generic Bearer token
      'Basic ' + Buffer.from('admin:admin').toString('base64'), // Basic auth
      'api_key=' + '0'.repeat(32), // Generic API key
      'access_token=' + '0'.repeat(32), // Generic access token
      'auth_token=' + '0'.repeat(32), // Generic auth token
      'session_token=' + '0'.repeat(32), // Generic session token
      'jwt_token=' + '0'.repeat(32), // Generic JWT token
      'refresh_token=' + '0'.repeat(32), // Generic refresh token
      'client_secret=' + '0'.repeat(32), // Generic client secret
      'app_secret=' + '0'.repeat(32) // Generic app secret
    ]
  }

  /**
   * Generate test user data for security testing
   */
  static generateTestUsers() {
    return {
      validUser: {
        id: 'test-user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      adminUser: {
        id: 'admin-user-456',
        email: 'admin@example.com',
        username: 'adminuser',
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      inactiveUser: {
        id: 'inactive-user-789',
        email: 'inactive@example.com',
        username: 'inactiveuser',
        role: 'user',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      maliciousUser: {
        id: '<script>alert("XSS")</script>',
        email: 'malicious@"><script>alert(1)</script>.com',
        username: 'admin\'--',
        role: 'superadmin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }
  }

  /**
   * Generate test MEXC API credentials
   */
  static generateTestMEXCCredentials() {
    return {
      validCredentials: {
        apiKey: 'mx0test' + crypto.randomBytes(16).toString('hex'),
        secretKey: crypto.randomBytes(32).toString('hex'),
        passphrase: 'testpassphrase'
      },
      invalidCredentials: {
        apiKey: 'invalid-key',
        secretKey: 'invalid-secret',
        passphrase: 'invalid-passphrase'
      },
      maliciousCredentials: {
        apiKey: '<script>alert("XSS")</script>',
        secretKey: 'DROP TABLE users; --',
        passphrase: '../../../etc/passwd'
      },
      emptyCredentials: {
        apiKey: '',
        secretKey: '',
        passphrase: ''
      },
      nullCredentials: {
        apiKey: null,
        secretKey: null,
        passphrase: null
      }
    }
  }
}

// ============================================================================
// Security Test Helpers
// ============================================================================

export class SecurityTestHelpers {
  /**
   * Create a mock NextRequest for testing
   */
  static createMockRequest(options: {
    method?: string
    url?: string
    headers?: Record<string, string>
    body?: any
    ip?: string
  } = {}): NextRequest {
    const {
      method = 'GET',
      url = 'http://localhost:3000/api/test',
      headers = {},
      body = null,
      ip = '127.0.0.1'
    } = options

    const request = new NextRequest(url, {
      method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Test)',
        'X-Forwarded-For': ip,
        'Content-Type': 'application/json',
        ...headers
      },
      body: body ? JSON.stringify(body) : null
    })

    return request
  }

  /**
   * Simulate rate limiting attacks
   */
  static async simulateRateLimitAttack(
    endpoint: string,
    requestCount: number = 100,
    concurrency: number = 10
  ): Promise<Array<{ status: number; response: any }>> {
    const requests = []
    
    for (let i = 0; i < requestCount; i++) {
      const request = fetch(endpoint, {
        method: 'GET',
        headers: {
          'User-Agent': `AttackBot-${i}`,
          'X-Forwarded-For': `192.168.1.${i % 255}`
        }
      }).then(async (res) => ({
        status: res.status,
        response: await res.json().catch(() => ({}))
      }))

      requests.push(request)

      // Control concurrency
      if (requests.length >= concurrency) {
        await Promise.all(requests.splice(0, concurrency))
      }
    }

    // Wait for remaining requests
    return Promise.all(requests)
  }

  /**
   * Test for timing attacks on authentication
   */
  static async testTimingAttacks(
    endpoint: string,
    validCredentials: any,
    invalidCredentials: any,
    iterations: number = 100
  ): Promise<{ averageValidTime: number; averageInvalidTime: number; timingDifference: number }> {
    const validTimes: number[] = []
    const invalidTimes: number[] = []

    // Test valid credentials
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validCredentials)
      })
      const end = performance.now()
      validTimes.push(end - start)
    }

    // Test invalid credentials
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidCredentials)
      })
      const end = performance.now()
      invalidTimes.push(end - start)
    }

    const averageValidTime = validTimes.reduce((a, b) => a + b, 0) / validTimes.length
    const averageInvalidTime = invalidTimes.reduce((a, b) => a + b, 0) / invalidTimes.length
    const timingDifference = Math.abs(averageValidTime - averageInvalidTime)

    return {
      averageValidTime,
      averageInvalidTime,
      timingDifference
    }
  }

  /**
   * Generate secure random strings for testing
   */
  static generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex')
  }

  /**
   * Hash data for comparison testing
   */
  static hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  /**
   * Simulate common attack patterns
   */
  static getCommonAttackPatterns() {
    return {
      headers: {
        'X-Forwarded-For': '127.0.0.1, 192.168.1.1, 10.0.0.1',
        'X-Real-IP': '127.0.0.1',
        'X-Originating-IP': '127.0.0.1',
        'X-Forwarded-Host': 'evil.com',
        'X-Remote-IP': '127.0.0.1',
        'X-Remote-Addr': '127.0.0.1',
        'X-ProxyUser-Ip': '127.0.0.1',
        'X-Original-URL': '/admin',
        'X-Rewrite-URL': '/admin',
        'X-HTTP-Method-Override': 'DELETE',
        'X-HTTP-Method': 'DELETE',
        'X-Method-Override': 'DELETE',
        'User-Agent': 'sqlmap/1.0-dev-nongit-20200219 (http://sqlmap.org)',
        'Referer': 'http://evil.com',
        'Origin': 'http://evil.com'
      },
      queryParams: {
        'debug': 'true',
        'admin': 'true',
        'test': 'true',
        'dev': 'true',
        'trace': 'true',
        'profile': 'true',
        '__debug__': 'true',
        '__test__': 'true',
        '__admin__': 'true'
      },
      cookies: {
        'admin': 'true',
        'debug': 'true',
        'test': 'true',
        'isAdmin': 'true',
        'role': 'admin',
        'privilege': 'admin',
        '__test__': 'true',
        '__debug__': 'true'
      }
    }
  }

  /**
   * Validate security headers
   */
  static validateSecurityHeaders(headers: Headers): {
    isSecure: boolean
    issues: string[]
    recommendations: string[]
  } {
    const issues: string[] = []
    const recommendations: string[] = []

    // Check for essential security headers
    if (!headers.get('Content-Security-Policy')) {
      issues.push('Missing Content-Security-Policy header')
      recommendations.push('Add CSP header to prevent XSS attacks')
    }

    if (!headers.get('X-Frame-Options')) {
      issues.push('Missing X-Frame-Options header')
      recommendations.push('Add X-Frame-Options to prevent clickjacking')
    }

    if (!headers.get('X-Content-Type-Options')) {
      issues.push('Missing X-Content-Type-Options header')
      recommendations.push('Add X-Content-Type-Options: nosniff')
    }

    if (!headers.get('Strict-Transport-Security')) {
      issues.push('Missing Strict-Transport-Security header')
      recommendations.push('Add HSTS header for HTTPS enforcement')
    }

    if (!headers.get('X-XSS-Protection')) {
      issues.push('Missing X-XSS-Protection header')
      recommendations.push('Add X-XSS-Protection: 1; mode=block')
    }

    if (!headers.get('Referrer-Policy')) {
      issues.push('Missing Referrer-Policy header')
      recommendations.push('Add Referrer-Policy for privacy protection')
    }

    return {
      isSecure: issues.length === 0,
      issues,
      recommendations
    }
  }

  /**
   * Test for sensitive data exposure
   */
  static checkForSensitiveDataExposure(data: any): {
    exposedData: string[]
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  } {
    const exposedData: string[] = []
    const dataString = JSON.stringify(data).toLowerCase()

    // Check for various sensitive data patterns
    const sensitivePatterns = [
      { pattern: /password/i, type: 'password' },
      { pattern: /secret/i, type: 'secret' },
      { pattern: /token/i, type: 'token' },
      { pattern: /key/i, type: 'key' },
      { pattern: /api[_-]?key/i, type: 'api_key' },
      { pattern: /access[_-]?token/i, type: 'access_token' },
      { pattern: /refresh[_-]?token/i, type: 'refresh_token' },
      { pattern: /jwt/i, type: 'jwt' },
      { pattern: /bearer/i, type: 'bearer_token' },
      { pattern: /basic/i, type: 'basic_auth' },
      { pattern: /session/i, type: 'session' },
      { pattern: /cookie/i, type: 'cookie' },
      { pattern: /database/i, type: 'database' },
      { pattern: /db/i, type: 'database' },
      { pattern: /connection/i, type: 'connection' },
      { pattern: /config/i, type: 'config' },
      { pattern: /env/i, type: 'environment' },
      { pattern: /private/i, type: 'private_data' },
      { pattern: /confidential/i, type: 'confidential' },
      { pattern: /internal/i, type: 'internal' },
      { pattern: /admin/i, type: 'admin' },
      { pattern: /root/i, type: 'root' },
      { pattern: /sudo/i, type: 'sudo' },
      { pattern: /credit[_-]?card/i, type: 'credit_card' },
      { pattern: /ssn/i, type: 'ssn' },
      { pattern: /social[_-]?security/i, type: 'ssn' },
      { pattern: /bank/i, type: 'bank' },
      { pattern: /account/i, type: 'account' },
      { pattern: /email/i, type: 'email' },
      { pattern: /phone/i, type: 'phone' },
      { pattern: /address/i, type: 'address' }
    ]

    for (const { pattern, type } of sensitivePatterns) {
      if (pattern.test(dataString)) {
        exposedData.push(type)
      }
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    
    if (exposedData.includes('password') || exposedData.includes('secret') || exposedData.includes('api_key')) {
      riskLevel = 'critical'
    } else if (exposedData.includes('token') || exposedData.includes('key') || exposedData.includes('admin')) {
      riskLevel = 'high'
    } else if (exposedData.includes('session') || exposedData.includes('config') || exposedData.includes('database')) {
      riskLevel = 'medium'
    }

    return {
      exposedData: [...new Set(exposedData)], // Remove duplicates
      riskLevel
    }
  }
}

// ============================================================================
// Security Test Matchers
// ============================================================================

export class SecurityTestMatchers {
  /**
   * Check if response contains security headers
   */
  static hasSecurityHeaders(response: Response): boolean {
    const requiredHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection'
    ]

    return requiredHeaders.every(header => response.headers.has(header))
  }

  /**
   * Check if response is properly sanitized
   */
  static isSanitized(response: any): boolean {
    const responseString = JSON.stringify(response)
    
    // Check for common XSS patterns
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /<link/i,
      /<meta/i,
      /<style/i,
      /<img[^>]*onerror/i,
      /<svg[^>]*onload/i
    ]

    return !xssPatterns.some(pattern => pattern.test(responseString))
  }

  /**
   * Check if response contains sensitive data
   */
  static containsSensitiveData(response: any): boolean {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /api[_-]?key/i,
      /access[_-]?token/i,
      /refresh[_-]?token/i
    ]

    const responseString = JSON.stringify(response)
    return sensitivePatterns.some(pattern => pattern.test(responseString))
  }

  /**
   * Check if error response is secure (doesn't leak internal info)
   */
  static isSecureError(response: any): boolean {
    const responseString = JSON.stringify(response).toLowerCase()
    
    // Check for information leakage patterns
    const leakagePatterns = [
      /stack trace/i,
      /internal error/i,
      /database error/i,
      /sql error/i,
      /connection refused/i,
      /timeout/i,
      /localhost/i,
      /127\.0\.0\.1/i,
      /192\.168\./i,
      /10\.0\./i,
      /file not found/i,
      /permission denied/i,
      /access denied/i,
      /unauthorized/i,
      /forbidden/i,
      /server error/i,
      /exception/i,
      /debug/i,
      /trace/i,
      /development/i,
      /staging/i,
      /test/i,
      /env/i,
      /config/i,
      /settings/i,
      /environment/i,
      /variable/i,
      /secret/i,
      /password/i,
      /token/i,
      /key/i,
      /credential/i,
      /auth/i,
      /session/i,
      /cookie/i,
      /header/i,
      /request/i,
      /response/i,
      /payload/i,
      /body/i,
      /param/i,
      /query/i,
      /form/i,
      /input/i,
      /field/i,
      /value/i,
      /data/i,
      /json/i,
      /xml/i,
      /html/i,
      /javascript/i,
      /script/i,
      /code/i,
      /function/i,
      /method/i,
      /class/i,
      /object/i,
      /array/i,
      /string/i,
      /number/i,
      /boolean/i,
      /null/i,
      /undefined/i,
      /nan/i,
      /infinity/i
    ]

    return !leakagePatterns.some(pattern => pattern.test(responseString))
  }
}

// ============================================================================
// Security Test Constants
// ============================================================================

export const SECURITY_TEST_CONSTANTS = {
  RATE_LIMIT_THRESHOLDS: {
    LOW: 10,
    MEDIUM: 50,
    HIGH: 100,
    CRITICAL: 500
  },
  RESPONSE_TIME_LIMITS: {
    FAST: 100,
    NORMAL: 500,
    SLOW: 1000,
    TIMEOUT: 5000
  },
  PAYLOAD_SIZE_LIMITS: {
    SMALL: 1024,
    MEDIUM: 10240,
    LARGE: 102400,
    MASSIVE: 1048576
  },
  SECURITY_HEADERS: {
    REQUIRED: [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection'
    ],
    RECOMMENDED: [
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'Referrer-Policy',
      'Permissions-Policy'
    ]
  },
  COMMON_PORTS: [
    22, 23, 25, 53, 80, 110, 143, 443, 993, 995, 1433, 1521, 2049, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 9200, 11211, 27017, 50000
  ],
  SENSITIVE_FILE_EXTENSIONS: [
    '.env', '.config', '.ini', '.cfg', '.conf', '.properties', '.settings', '.json', '.xml', '.yml', '.yaml', '.toml', '.key', '.pem', '.crt', '.p12', '.pfx', '.jks', '.keystore', '.truststore', '.db', '.sqlite', '.sqlite3', '.mdb', '.accdb', '.sql', '.bak', '.backup', '.dump', '.log', '.txt', '.csv', '.xls', '.xlsx', '.doc', '.docx', '.pdf', '.zip', '.tar', '.gz', '.bz2', '.rar', '.7z'
  ]
} as const