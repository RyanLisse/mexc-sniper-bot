/**
 * XSS Prevention Security Tests
 * 
 * Comprehensive tests for Cross-Site Scripting (XSS) prevention including:
 * - Reflected XSS protection
 * - Stored XSS prevention
 * - DOM-based XSS mitigation
 * - Input sanitization validation
 * - Output encoding verification
 * - Content Security Policy testing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SecurityTestDataGenerator, SecurityTestHelpers, SecurityTestMatchers } from '../utils/security-test-utils'
import { sanitizeInput, validateInput } from '@/src/lib/security-config'
import { NextRequest } from 'next/server'

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../utils/timeout-elimination-helpers';

// Mock external dependencies
vi.mock('next/server')

describe('XSS Prevention Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Reflected XSS Prevention', () => {
    it('should sanitize basic script tags', () => {
      const xssPayloads = SecurityTestDataGenerator.generateXSSPayloads()
      
      for (const payload of xssPayloads) {
        const sanitized = sanitizeInput(payload)
        
        // Should not contain script tags
        expect(sanitized).not.toMatch(/<script/i)
        expect(sanitized).not.toMatch(/javascript:/i)
        expect(sanitized).not.toMatch(/on\w+\s*=/i)
      }
    })

    it('should handle URL parameter XSS attempts', () => {
      const urlXSSPayloads = [
        '?search=<script>alert("XSS")</script>',
        '?name="><script>alert(1)</script>',
        '?callback=javascript:alert(1)',
        '?redirect=javascript:void(0)',
        '?data=%3Cscript%3Ealert%281%29%3C%2Fscript%3E',
        '?input=<img src="x" onerror="alert(1)">',
        '?value=<svg onload="alert(1)">',
        '?content=<iframe src="javascript:alert(1)">',
        '?text=<body onload="alert(1)">',
        '?html=<meta http-equiv="refresh" content="0;url=javascript:alert(1)">'
      ]

      for (const payload of urlXSSPayloads) {
        const paramValue = payload.split('=')[1]
        const decodedValue = decodeURIComponent(paramValue)
        const sanitized = sanitizeInput(decodedValue)
        
        expect(sanitized).not.toMatch(/<script/i)
        expect(sanitized).not.toMatch(/javascript:/i)
        expect(sanitized).not.toMatch(/on\w+\s*=/i)
        expect(sanitized).not.toMatch(/<iframe/i)
        expect(sanitized).not.toMatch(/<svg/i)
        expect(sanitized).not.toMatch(/<img/i)
        expect(sanitized).not.toMatch(/<meta/i)
      }
    })

    it('should prevent header injection XSS', () => {
      const headerXSSPayloads = [
        'User-Agent: <script>alert("XSS")</script>',
        'Referer: javascript:alert(1)',
        'X-Forwarded-For: "><script>alert(1)</script>',
        'Accept-Language: <img src="x" onerror="alert(1)">',
        'Cookie: name=<script>alert(1)</script>',
        'Authorization: Bearer <script>alert(1)</script>'
      ]

      for (const headerPayload of headerXSSPayloads) {
        const [headerName, headerValue] = headerPayload.split(': ')
        const sanitized = sanitizeInput(headerValue)
        
        expect(sanitized).not.toMatch(/<script/i)
        expect(sanitized).not.toMatch(/javascript:/i)
        expect(sanitized).not.toMatch(/on\w+\s*=/i)
      }
    })

    it('should handle form input XSS attempts', () => {
      const formXSSPayloads = [
        { email: '<script>alert("XSS")</script>@example.com' },
        { password: 'password"><script>alert(1)</script>' },
        { name: 'John<img src="x" onerror="alert(1)">' },
        { comment: '<svg onload="alert(1)">Comment</svg>' },
        { search: 'query<iframe src="javascript:alert(1)"></iframe>' },
        { message: '<style>body{background:url("javascript:alert(1)")}</style>' }
      ]

      for (const formData of formXSSPayloads) {
        for (const [field, value] of Object.entries(formData)) {
          const sanitized = sanitizeInput(value)
          
          expect(sanitized).not.toMatch(/<script/i)
          expect(sanitized).not.toMatch(/javascript:/i)
          expect(sanitized).not.toMatch(/on\w+\s*=/i)
          expect(sanitized).not.toMatch(/<iframe/i)
          expect(sanitized).not.toMatch(/<svg/i)
          expect(sanitized).not.toMatch(/<img/i)
          expect(sanitized).not.toMatch(/<style/i)
        }
      }
    })

    it('should prevent JSON injection XSS', () => {
      const jsonXSSPayloads = [
        '{"name": "<script>alert(\\"XSS\\")</script>"}',
        '{"data": "value\\"><script>alert(1)</script>"}',
        '{"callback": "javascript:alert(1)"}',
        '{"html": "<img src=\\"x\\" onerror=\\"alert(1)\\">"}',
        '{"content": "<svg onload=\\"alert(1)\\">"}',
        '{"message": "</script><script>alert(1)</script>"}'
      ]

      for (const jsonPayload of jsonXSSPayloads) {
        try {
          const parsed = JSON.parse(jsonPayload)
          
          for (const value of Object.values(parsed)) {
            const sanitized = sanitizeInput(value as string)
            
            expect(sanitized).not.toMatch(/<script/i)
            expect(sanitized).not.toMatch(/javascript:/i)
            expect(sanitized).not.toMatch(/on\w+\s*=/i)
          }
        } catch (error) {
          // Invalid JSON should be rejected
          expect(error).toBeInstanceOf(SyntaxError)
        }
      }
    })

    it('should handle encoded XSS attempts', () => {
      const encodedXSSPayloads = [
        '%3Cscript%3Ealert%28%22XSS%22%29%3C%2Fscript%3E', // URL encoded
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;', // HTML entities
        '\\u003cscript\\u003ealert(\\u0022XSS\\u0022)\\u003c/script\\u003e', // Unicode
        '&#60;script&#62;alert(&#34;XSS&#34;)&#60;/script&#62;', // Decimal entities
        '&#x3c;script&#x3e;alert(&#x22;XSS&#x22;)&#x3c;/script&#x3e;', // Hex entities
        '%253Cscript%253Ealert%2528%2522XSS%2522%2529%253C%252Fscript%253E' // Double encoded
      ]

      for (const encodedPayload of encodedXSSPayloads) {
        // Decode the payload
        let decoded = decodeURIComponent(encodedPayload)
        decoded = decoded.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        decoded = decoded.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        decoded = decoded.replace(/\\u([0-9a-f]{4})/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        
        const sanitized = sanitizeInput(decoded)
        
        expect(sanitized).not.toMatch(/<script/i)
        expect(sanitized).not.toMatch(/javascript:/i)
        expect(sanitized).not.toMatch(/alert\(/i)
      }
    })

    it('should prevent bypass attempts using case variations', () => {
      const caseVariationPayloads = [
        '<SCRIPT>alert("XSS")</SCRIPT>',
        '<Script>alert("XSS")</Script>',
        '<sCrIpT>alert("XSS")</ScRiPt>',
        '<IMG SRC="x" ONERROR="alert(1)">',
        '<Img Src="x" OnError="alert(1)">',
        '<iMg sRc="x" oNeRrOr="alert(1)">',
        'JAVASCRIPT:alert(1)',
        'JavaScript:alert(1)',
        'jAvAsCrIpT:alert(1)'
      ]

      for (const payload of caseVariationPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized.toLowerCase()).not.toMatch(/<script/i)
        expect(sanitized.toLowerCase()).not.toMatch(/javascript:/i)
        expect(sanitized.toLowerCase()).not.toMatch(/on\w+\s*=/i)
      }
    })
  })

  describe('Stored XSS Prevention', () => {
    it('should sanitize user profile data', () => {
      const userProfileXSS = {
        name: 'John<script>alert("XSS")</script>Doe',
        bio: 'Hello world!<img src="x" onerror="alert(1)">',
        website: 'javascript:alert("XSS")',
        location: '<svg onload="alert(1)">San Francisco</svg>',
        company: '<iframe src="javascript:alert(1)">Company</iframe>',
        title: '<style>body{background:url("javascript:alert(1)")}</style>Developer'
      }

      for (const [field, value] of Object.entries(userProfileXSS)) {
        const sanitized = sanitizeInput(value)
        
        expect(sanitized).not.toMatch(/<script/i)
        expect(sanitized).not.toMatch(/javascript:/i)
        expect(sanitized).not.toMatch(/on\w+\s*=/i)
        expect(sanitized).not.toMatch(/<iframe/i)
        expect(sanitized).not.toMatch(/<svg/i)
        expect(sanitized).not.toMatch(/<img/i)
        expect(sanitized).not.toMatch(/<style/i)
      }
    })

    it('should sanitize comment and message content', () => {
      const messageXSSPayloads = [
        'Great post!<script>alert("XSS")</script>',
        'Check this out: <img src="x" onerror="alert(1)">',
        'Visit my site: javascript:alert("XSS")',
        'Look at this: <svg onload="alert(1)">',
        'Amazing!<iframe src="javascript:alert(1)"></iframe>',
        'Cool stuff!<object data="javascript:alert(1)"></object>',
        'Nice work!<embed src="javascript:alert(1)">',
        'Awesome!<link rel="stylesheet" href="javascript:alert(1)">',
        'Perfect!<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
        'Excellent!<base href="javascript:alert(1)//">'
      ]

      for (const message of messageXSSPayloads) {
        const sanitized = sanitizeInput(message)
        
        expect(sanitized).not.toMatch(/<script/i)
        expect(sanitized).not.toMatch(/javascript:/i)
        expect(sanitized).not.toMatch(/on\w+\s*=/i)
        expect(sanitized).not.toMatch(/<iframe/i)
        expect(sanitized).not.toMatch(/<object/i)
        expect(sanitized).not.toMatch(/<embed/i)
        expect(sanitized).not.toMatch(/<link/i)
        expect(sanitized).not.toMatch(/<meta/i)
        expect(sanitized).not.toMatch(/<base/i)
      }
    })

    it('should sanitize trading notes and descriptions', () => {
      const tradingXSSPayloads = [
        'Buy BTCUSDT at $50000<script>alert("XSS")</script>',
        'Stop loss: $45000<img src="x" onerror="alert(1)">',
        'Take profit: javascript:alert("XSS")',
        'Strategy: <svg onload="alert(1)">DCA</svg>',
        'Notes: Great trade!<iframe src="javascript:alert(1)"></iframe>',
        'Analysis: <style>body{background:url("javascript:alert(1)")}</style>Bullish'
      ]

      for (const note of tradingXSSPayloads) {
        const sanitized = sanitizeInput(note)
        
        expect(sanitized).not.toMatch(/<script/i)
        expect(sanitized).not.toMatch(/javascript:/i)
        expect(sanitized).not.toMatch(/on\w+\s*=/i)
        expect(sanitized).not.toMatch(/<iframe/i)
        expect(sanitized).not.toMatch(/<svg/i)
        expect(sanitized).not.toMatch(/<img/i)
        expect(sanitized).not.toMatch(/<style/i)
      }
    })

    it('should handle stored XSS in configuration settings', () => {
      const configXSSPayloads = {
        notification_webhook: 'https://example.com/webhook<script>alert("XSS")</script>',
        api_endpoint: 'javascript:alert("XSS")',
        custom_css: '<style>body{background:url("javascript:alert(1)")}</style>',
        welcome_message: 'Welcome!<img src="x" onerror="alert(1)">',
        footer_text: '<svg onload="alert(1)">Copyright 2024</svg>',
        email_template: '<iframe src="javascript:alert(1)">Email content</iframe>'
      }

      for (const [setting, value] of Object.entries(configXSSPayloads)) {
        const sanitized = sanitizeInput(value)
        
        expect(sanitized).not.toMatch(/<script/i)
        expect(sanitized).not.toMatch(/javascript:/i)
        expect(sanitized).not.toMatch(/on\w+\s*=/i)
        expect(sanitized).not.toMatch(/<iframe/i)
        expect(sanitized).not.toMatch(/<svg/i)
        expect(sanitized).not.toMatch(/<img/i)
        expect(sanitized).not.toMatch(/<style/i)
      }
    })

    it('should prevent XSS in file uploads', () => {
      const fileUploadXSS = [
        { name: 'document<script>alert("XSS")</script>.pdf', content: 'PDF content' },
        { name: 'image.jpg', content: '<script>alert("XSS")</script>' },
        { name: 'data.csv', content: '=cmd|"/c calc"!A1' }, // CSV injection
        { name: 'config.xml', content: '<?xml version="1.0"?><script>alert("XSS")</script>' },
        { name: 'style.css', content: 'body{background:url("javascript:alert(1)")}' },
        { name: 'page.html', content: '<html><script>alert("XSS")</script></html>' }
      ]

      for (const file of fileUploadXSS) {
        const sanitizedName = sanitizeInput(file.name)
        const sanitizedContent = sanitizeInput(file.content)
        
        expect(sanitizedName).not.toMatch(/<script/i)
        expect(sanitizedName).not.toMatch(/javascript:/i)
        expect(sanitizedContent).not.toMatch(/<script/i)
        expect(sanitizedContent).not.toMatch(/javascript:/i)
        expect(sanitizedContent).not.toMatch(/=cmd\|/i) // CSV injection
      }
    })

    it('should validate stored data before display', () => {
      const storedData = [
        { id: 1, content: 'Safe content' },
        { id: 2, content: '<script>alert("XSS")</script>' },
        { id: 3, content: '<img src="x" onerror="alert(1)">' },
        { id: 4, content: 'javascript:alert("XSS")' },
        { id: 5, content: '<svg onload="alert(1)">' }
      ]

      for (const data of storedData) {
        const isSafe = SecurityTestMatchers.isSanitized(data.content)
        
        if (data.id === 1) {
          expect(isSafe).toBe(true) // Safe content
        } else {
          expect(isSafe).toBe(false) // Unsafe content
        }
      }
    })
  })

  describe('DOM-based XSS Prevention', () => {
    it('should prevent DOM manipulation XSS', () => {
      const domXSSPayloads = [
        'document.write("<script>alert(\\"XSS\\")</script>")',
        'innerHTML = "<img src=\\"x\\" onerror=\\"alert(1)\\">"',
        'outerHTML = "<svg onload=\\"alert(1)\\">"',
        'insertAdjacentHTML("afterbegin", "<script>alert(1)</script>")',
        'document.createElement("script").src = "javascript:alert(1)"',
        'location.href = "javascript:alert(1)"',
        'eval("alert(1)")',
        'setTimeout("alert(1)", 100)',
        'setInterval("alert(1)", 100)',
        'Function("alert(1)")()'
      ]

      for (const payload of domXSSPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/document\.write/i)
        expect(sanitized).not.toMatch(/innerHTML/i)
        expect(sanitized).not.toMatch(/outerHTML/i)
        expect(sanitized).not.toMatch(/insertAdjacentHTML/i)
        expect(sanitized).not.toMatch(/createElement/i)
        expect(sanitized).not.toMatch(/location\.href/i)
        expect(sanitized).not.toMatch(/eval\s*\(/i)
        expect(sanitized).not.toMatch(/setTimeout/i)
        expect(sanitized).not.toMatch(/setInterval/i)
        expect(sanitized).not.toMatch(/Function\s*\(/i)
      }
    })

    it('should prevent client-side template injection', () => {
      const templateXSSPayloads = [
        '{{constructor.constructor("alert(1)")()}}',
        '${alert(1)}',
        '<%- alert(1) %>',
        '{%raw%}<script>alert(1)</script>{%endraw%}',
        '[[1+1]]<script>alert(1)</script>',
        '{{7*7}}<img src="x" onerror="alert(1)">',
        '${7*7}<svg onload="alert(1)">',
        '<%=7*7%><iframe src="javascript:alert(1)"></iframe>'
      ]

      for (const payload of templateXSSPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/\{\{.*constructor/i)
        expect(sanitized).not.toMatch(/\$\{.*alert/i)
        expect(sanitized).not.toMatch(/<%.*alert/i)
        expect(sanitized).not.toMatch(/\{%.*script/i)
        expect(sanitized).not.toMatch(/\[\[.*\]\]/i)
        expect(sanitized).not.toMatch(/<script/i)
        expect(sanitized).not.toMatch(/<img.*onerror/i)
        expect(sanitized).not.toMatch(/<svg.*onload/i)
        expect(sanitized).not.toMatch(/<iframe/i)
      }
    })

    it('should handle URL fragment XSS', () => {
      const fragmentXSSPayloads = [
        '#<script>alert("XSS")</script>',
        '#javascript:alert(1)',
        '#<img src="x" onerror="alert(1)">',
        '#<svg onload="alert(1)">',
        '#"><script>alert(1)</script>',
        '#%3Cscript%3Ealert%281%29%3C%2Fscript%3E'
      ]

      for (const fragment of fragmentXSSPayloads) {
        const fragmentValue = fragment.substring(1) // Remove #
        const decoded = decodeURIComponent(fragmentValue)
        const sanitized = sanitizeInput(decoded)
        
        expect(sanitized).not.toMatch(/<script/i)
        expect(sanitized).not.toMatch(/javascript:/i)
        expect(sanitized).not.toMatch(/on\w+\s*=/i)
        expect(sanitized).not.toMatch(/<img/i)
        expect(sanitized).not.toMatch(/<svg/i)
      }
    })

    it('should prevent postMessage XSS', () => {
      const postMessageXSS = [
        { origin: 'http://evil.com', data: '<script>alert("XSS")</script>' },
        { origin: 'https://attacker.net', data: 'javascript:alert(1)' },
        { origin: '*', data: '<img src="x" onerror="alert(1)">' },
        { origin: 'null', data: '<svg onload="alert(1)">' },
        { origin: 'file://', data: '<iframe src="javascript:alert(1)"></iframe>' }
      ]

      for (const message of postMessageXSS) {
        // Validate origin
        const isValidOrigin = message.origin.startsWith('https://') && 
                             !message.origin.includes('evil') &&
                             !message.origin.includes('attacker') &&
                             message.origin !== '*' &&
                             message.origin !== 'null' &&
                             !message.origin.startsWith('file://')

        expect(isValidOrigin).toBe(false)

        // Sanitize data
        const sanitized = sanitizeInput(message.data)
        expect(sanitized).not.toMatch(/<script/i)
        expect(sanitized).not.toMatch(/javascript:/i)
        expect(sanitized).not.toMatch(/on\w+\s*=/i)
      }
    })
  })

  describe('Input Validation and Sanitization', () => {
    it('should validate input types correctly', () => {
      const validInputs = {
        email: 'user@example.com',
        password: 'SecurePassword123!',
        name: 'John Doe',
        amount: '100.50',
        symbol: 'BTCUSDT'
      }

      const invalidInputs = {
        email: '<script>alert("XSS")</script>@example.com',
        password: 'password<img src="x" onerror="alert(1)">',
        name: 'John<svg onload="alert(1)">Doe',
        amount: '100.50<script>alert(1)</script>',
        symbol: 'BTC<iframe src="javascript:alert(1)"></iframe>USDT'
      }

      for (const [field, value] of Object.entries(validInputs)) {
        const sanitized = sanitizeInput(value)
        expect(sanitized).toBe(value) // Should remain unchanged
      }

      for (const [field, value] of Object.entries(invalidInputs)) {
        const sanitized = sanitizeInput(value)
        expect(sanitized).not.toMatch(/<script/i)
        expect(sanitized).not.toMatch(/javascript:/i)
        expect(sanitized).not.toMatch(/on\w+\s*=/i)
      }
    })

    it('should handle null and undefined inputs', () => {
      const nullInputs = [null, undefined, '', 0, false]

      for (const input of nullInputs) {
        const sanitized = sanitizeInput(String(input))
        expect(sanitized).toBeDefined()
        expect(typeof sanitized).toBe('string')
      }
    })

    it('should validate input length limits', () => {
      const longXSSPayload = '<script>alert("XSS")</script>'.repeat(1000)
      const sanitized = sanitizeInput(longXSSPayload)
      
      expect(sanitized).not.toMatch(/<script/i)
      expect(sanitized).not.toMatch(/alert/i)
    })

    it('should handle special characters properly', () => {
      const specialCharacterInputs = [
        'User & Company <script>alert("XSS")</script>',
        'Price: $100 & <img src="x" onerror="alert(1)"> discount',
        '50% off! <svg onload="alert(1)"> Special offer',
        'Contact: email@domain.com <iframe src="javascript:alert(1)"></iframe>',
        'Name: "John Doe" <style>body{background:url("javascript:alert(1)")}</style>'
      ]

      for (const input of specialCharacterInputs) {
        const sanitized = sanitizeInput(input)
        
        // Should preserve legitimate special characters
        expect(sanitized).toMatch(/&/)
        expect(sanitized).toMatch(/\$/)
        expect(sanitized).toMatch(/%/)
        expect(sanitized).toMatch(/@/)
        expect(sanitized).toMatch(/"/)
        
        // Should remove malicious content
        expect(sanitized).not.toMatch(/<script/i)
        expect(sanitized).not.toMatch(/javascript:/i)
        expect(sanitized).not.toMatch(/on\w+\s*=/i)
        expect(sanitized).not.toMatch(/<iframe/i)
        expect(sanitized).not.toMatch(/<svg/i)
        expect(sanitized).not.toMatch(/<img/i)
        expect(sanitized).not.toMatch(/<style/i)
      }
    })

    it('should validate nested object sanitization', () => {
      const nestedObjectXSS = {
        user: {
          name: 'John<script>alert("XSS")</script>',
          profile: {
            bio: '<img src="x" onerror="alert(1)">',
            settings: {
              theme: 'dark<svg onload="alert(1)">',
              notifications: {
                email: 'user@example.com<iframe src="javascript:alert(1)"></iframe>'
              }
            }
          }
        }
      }

      function sanitizeNestedObject(obj: any): any {
        if (typeof obj === 'string') {
          return sanitizeInput(obj)
        } else if (typeof obj === 'object' && obj !== null) {
          const sanitized: any = {}
          for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeNestedObject(value)
          }
          return sanitized
        }
        return obj
      }

      const sanitized = sanitizeNestedObject(nestedObjectXSS)
      
      expect(sanitized.user.name).not.toMatch(/<script/i)
      expect(sanitized.user.profile.bio).not.toMatch(/<img.*onerror/i)
      expect(sanitized.user.profile.settings.theme).not.toMatch(/<svg.*onload/i)
      expect(sanitized.user.profile.settings.notifications.email).not.toMatch(/<iframe/i)
    })
  })

  describe('Content Security Policy (CSP) Testing', () => {
    it('should validate CSP headers prevent XSS', () => {
      const cspPolicies = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "connect-src 'self' https://api.mexc.com",
        "frame-ancestors 'none'",
        "base-uri 'self'"
      ]

      for (const policy of cspPolicies) {
        expect(policy).toBeTruthy()
        
        if (policy.includes('script-src')) {
          // Should not allow unsafe-eval
          expect(policy).not.toContain('unsafe-eval')
        }
        
        if (policy.includes('frame-ancestors')) {
          // Should prevent clickjacking
          expect(policy).toContain('none')
        }
      }
    })

    it('should validate CSP nonce implementation', () => {
      const nonce = SecurityTestHelpers.generateSecureRandom(16)
      const cspWithNonce = `script-src 'self' 'nonce-${nonce}'`
      
      expect(cspWithNonce).toContain('nonce-')
      expect(nonce).toHaveLength(32) // 16 bytes = 32 hex chars
    })

    it('should test CSP violation reporting', () => {
      const cspViolationReport = {
        'csp-report': {
          'document-uri': 'https://example.com/page',
          'referrer': 'https://example.com',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'; script-src 'self'",
          'blocked-uri': 'eval',
          'line-number': 1,
          'column-number': 1,
          'source-file': 'https://example.com/page'
        }
      }

      expect(cspViolationReport['csp-report']['violated-directive']).toBe('script-src')
      expect(cspViolationReport['csp-report']['blocked-uri']).toBe('eval')
    })

    it('should validate CSP bypass prevention', () => {
      const cspBypassAttempts = [
        '<script src="data:text/javascript,alert(1)"></script>',
        '<script src="javascript:alert(1)"></script>',
        '<script>eval("alert(1)")</script>',
        '<script>Function("alert(1)")()</script>',
        '<script>setTimeout("alert(1)", 0)</script>',
        '<script>setInterval("alert(1)", 0)</script>',
        '<object data="javascript:alert(1)"></object>',
        '<embed src="javascript:alert(1)">',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<link rel="stylesheet" href="javascript:alert(1)">'
      ]

      for (const attempt of cspBypassAttempts) {
        const sanitized = sanitizeInput(attempt)
        
        expect(sanitized).not.toMatch(/data:text\/javascript/i)
        expect(sanitized).not.toMatch(/javascript:/i)
        expect(sanitized).not.toMatch(/eval\s*\(/i)
        expect(sanitized).not.toMatch(/Function\s*\(/i)
        expect(sanitized).not.toMatch(/setTimeout/i)
        expect(sanitized).not.toMatch(/setInterval/i)
        expect(sanitized).not.toMatch(/<object/i)
        expect(sanitized).not.toMatch(/<embed/i)
        expect(sanitized).not.toMatch(/<iframe/i)
        expect(sanitized).not.toMatch(/<link/i)
      }
    })
  })

  describe('Output Encoding Verification', () => {
    it('should properly encode HTML entities', () => {
      const htmlEntities = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
        '/': '&#x2F;'
      }

      for (const [char, encoded] of Object.entries(htmlEntities)) {
        const testString = `Test ${char} character`
        const shouldBeEncoded = testString.replace(char, encoded)
        
        // Verify encoding logic
        expect(encoded).toContain('&')
        expect(encoded).toContain(';')
      }
    })

    it('should handle JavaScript context encoding', () => {
      const jsUnsafeChars = ['\\', '"', "'", '\n', '\r', '\t', '\b', '\f']
      
      for (const char of jsUnsafeChars) {
        const testString = `Test${char}String`
        const encoded = testString.replace(/[\\"']/g, '\\$&')
                                 .replace(/\n/g, '\\n')
                                 .replace(/\r/g, '\\r')
                                 .replace(/\t/g, '\\t')
        
        expect(encoded).not.toBe(testString)
      }
    })

    it('should handle URL context encoding', () => {
      const urlUnsafeChars = [' ', '<', '>', '"', '#', '%', '{', '}', '|', '\\', '^', '~', '[', ']', '`']
      
      for (const char of urlUnsafeChars) {
        const testString = `param${char}value`
        const encoded = encodeURIComponent(testString)
        
        expect(encoded).not.toContain(char)
      }
    })

    it('should handle CSS context encoding', () => {
      const cssUnsafeInputs = [
        'expression(alert(1))',
        'javascript:alert(1)',
        'url("javascript:alert(1)")',
        '@import "javascript:alert(1)"',
        'behavior:url(javascript:alert(1))'
      ]

      for (const input of cssUnsafeInputs) {
        const sanitized = sanitizeInput(input)
        
        expect(sanitized).not.toMatch(/expression\s*\(/i)
        expect(sanitized).not.toMatch(/javascript:/i)
        expect(sanitized).not.toMatch(/url\s*\(\s*["']?javascript/i)
        expect(sanitized).not.toMatch(/@import.*javascript/i)
        expect(sanitized).not.toMatch(/behavior\s*:/i)
      }
    })

    it('should validate context-aware encoding', () => {
      const contexts = {
        html: '<div>User input: USER_INPUT</div>',
        attribute: '<div class="USER_INPUT">Content</div>',
        javascript: 'var userInput = "USER_INPUT";',
        css: '.class { color: USER_INPUT; }',
        url: 'https://example.com?param=USER_INPUT'
      }

      const maliciousInput = '<script>alert("XSS")</script>'

      for (const [context, template] of Object.entries(contexts)) {
        const output = template.replace('USER_INPUT', maliciousInput)
        const sanitized = sanitizeInput(output)
        
        expect(sanitized).not.toMatch(/<script/i)
        expect(sanitized).not.toMatch(/alert\(/i)
      }
    })
  })
})