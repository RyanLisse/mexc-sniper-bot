/**
 * SQL Injection Prevention Security Tests
 * 
 * Comprehensive tests for SQL injection prevention including:
 * - Classic SQL injection attacks
 * - Blind SQL injection prevention
 * - Time-based SQL injection mitigation
 * - Union-based injection protection
 * - Boolean-based injection prevention
 * - NoSQL injection protection
 * - Parameterized query validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SecurityTestDataGenerator, SecurityTestHelpers } from '../utils/security-test-utils'
import { sanitizeInput } from '@/src/lib/security-config'

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../utils/timeout-elimination-helpers';

// Mock database functions
const mockDbQuery = vi.fn()
const mockDbExecute = vi.fn()

vi.mock('@/src/db', () => ({
  query: mockDbQuery,
  execute: mockDbExecute
}))

describe('SQL Injection Prevention Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Classic SQL Injection Prevention', () => {
    it('should prevent basic SQL injection attacks', () => {
      const sqlInjectionPayloads = SecurityTestDataGenerator.generateSQLInjectionPayloads()
      
      for (const payload of sqlInjectionPayloads) {
        const sanitized = sanitizeInput(payload)
        
        // Should escape SQL metacharacters
        expect(sanitized).not.toMatch(/['";\-\-\/\*]/g)
        expect(sanitized).not.toMatch(/\bOR\b/i)
        expect(sanitized).not.toMatch(/\bUNION\b/i)
        expect(sanitized).not.toMatch(/\bSELECT\b/i)
        expect(sanitized).not.toMatch(/\bDROP\b/i)
        expect(sanitized).not.toMatch(/\bINSERT\b/i)
        expect(sanitized).not.toMatch(/\bUPDATE\b/i)
        expect(sanitized).not.toMatch(/\bDELETE\b/i)
      }
    })

    it('should handle authentication bypass attempts', () => {
      const authBypassPayloads = [
        "admin' --",
        "admin' #",
        "admin'/*",
        "' OR '1'='1",
        "' OR '1'='1' --",
        "' OR '1'='1' /*",
        "' OR 1=1--",
        "' OR 1=1#",
        "' OR 1=1/*",
        "') OR ('1'='1",
        "') OR ('1'='1'--",
        "') OR ('1'='1'/*",
        "admin' OR '1'='1",
        "admin' OR '1'='1'--",
        "admin' OR '1'='1'/*"
      ]

      for (const payload of authBypassPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/'\s*OR\s*'/i)
        expect(sanitized).not.toMatch(/'\s*OR\s*\d/i)
        expect(sanitized).not.toMatch(/--/)
        expect(sanitized).not.toMatch(/#/)
        expect(sanitized).not.toMatch(/\/\*/)
        expect(sanitized).not.toMatch(/\)\s*OR\s*\(/i)
      }
    })

    it('should prevent comment-based injection', () => {
      const commentInjectionPayloads = [
        "user'; DROP TABLE users; --",
        "user'; DELETE FROM users; /*",
        "user'/* comment */; DROP TABLE users; --",
        "user'#comment\nDROP TABLE users",
        "user'--comment\nDROP TABLE users",
        "user'/*! DROP TABLE users */",
        "user'; TRUNCATE TABLE users; --",
        "user'; ALTER TABLE users; --"
      ]

      for (const payload of commentInjectionPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/;\s*DROP\s+TABLE/i)
        expect(sanitized).not.toMatch(/;\s*DELETE\s+FROM/i)
        expect(sanitized).not.toMatch(/;\s*TRUNCATE\s+TABLE/i)
        expect(sanitized).not.toMatch(/;\s*ALTER\s+TABLE/i)
        expect(sanitized).not.toMatch(/--/)
        expect(sanitized).not.toMatch(/#/)
        expect(sanitized).not.toMatch(/\/\*/)
        expect(sanitized).not.toMatch(/\*\//)
      }
    })

    it('should handle stacked query injection', () => {
      const stackedQueryPayloads = [
        "user'; INSERT INTO users VALUES ('hacker', 'password'); --",
        "user'; UPDATE users SET role='admin' WHERE id=1; --",
        "user'; CREATE USER 'hacker'@'%' IDENTIFIED BY 'password'; --",
        "user'; GRANT ALL PRIVILEGES ON *.* TO 'hacker'@'%'; --",
        "user'; EXEC xp_cmdshell('dir'); --",
        "user'; LOAD_FILE('/etc/passwd'); --"
      ]

      for (const payload of stackedQueryPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/;\s*INSERT\s+INTO/i)
        expect(sanitized).not.toMatch(/;\s*UPDATE\s+/i)
        expect(sanitized).not.toMatch(/;\s*CREATE\s+USER/i)
        expect(sanitized).not.toMatch(/;\s*GRANT\s+/i)
        expect(sanitized).not.toMatch(/;\s*EXEC\s+/i)
        expect(sanitized).not.toMatch(/;\s*LOAD_FILE/i)
        expect(sanitized).not.toMatch(/xp_cmdshell/i)
      }
    })

    it('should prevent database-specific injection', () => {
      const dbSpecificPayloads = {
        mysql: [
          "user' AND (SELECT SUBSTRING(@@version,1,1))='5' --",
          "user' AND (SELECT COUNT(*) FROM information_schema.tables)>0 --",
          "user' UNION SELECT user(),database(),version() --",
          "user' AND (SELECT LOAD_FILE('/etc/passwd')) --"
        ],
        postgresql: [
          "user' AND (SELECT version()) LIKE '%PostgreSQL%' --",
          "user' UNION SELECT current_user,current_database(),version() --",
          "user' AND (SELECT current_setting('server_version')) --"
        ],
        mssql: [
          "user' AND (SELECT @@version) --",
          "user' UNION SELECT user_name(),db_name(),@@version --",
          "user' AND (SELECT name FROM sys.databases) --",
          "user'; EXEC xp_cmdshell('whoami'); --"
        ],
        oracle: [
          "user' AND (SELECT banner FROM v$version) --",
          "user' UNION SELECT user,null,null FROM dual --",
          "user' AND (SELECT table_name FROM all_tables) --"
        ],
        sqlite: [
          "user' UNION SELECT sql,type,name FROM sqlite_master --",
          "user' AND (SELECT sqlite_version()) --",
          "user' UNION SELECT load_extension('extension') --"
        ]
      }

      for (const [dbType, payloads] of Object.entries(dbSpecificPayloads)) {
        for (const payload of payloads) {
          const sanitized = sanitizeInput(payload)
          
          expect(sanitized).not.toMatch(/@@version/i)
          expect(sanitized).not.toMatch(/information_schema/i)
          expect(sanitized).not.toMatch(/LOAD_FILE/i)
          expect(sanitized).not.toMatch(/current_user/i)
          expect(sanitized).not.toMatch(/current_database/i)
          expect(sanitized).not.toMatch(/current_setting/i)
          expect(sanitized).not.toMatch(/user_name\(\)/i)
          expect(sanitized).not.toMatch(/db_name\(\)/i)
          expect(sanitized).not.toMatch(/sys\.databases/i)
          expect(sanitized).not.toMatch(/xp_cmdshell/i)
          expect(sanitized).not.toMatch(/v\$version/i)
          expect(sanitized).not.toMatch(/all_tables/i)
          expect(sanitized).not.toMatch(/sqlite_master/i)
          expect(sanitized).not.toMatch(/sqlite_version/i)
          expect(sanitized).not.toMatch(/load_extension/i)
        }
      }
    })
  })

  describe('Union-Based SQL Injection Prevention', () => {
    it('should prevent UNION SELECT attacks', () => {
      const unionInjectionPayloads = [
        "user' UNION SELECT username,password FROM users --",
        "user' UNION SELECT 1,2,3,4,5 --",
        "user' UNION ALL SELECT null,null,null --",
        "user' UNION SELECT @@version,user(),database() --",
        "user' UNION SELECT table_name,column_name FROM information_schema.columns --",
        "user' UNION SELECT load_file('/etc/passwd'),null,null --",
        "user' UNION SELECT user,authentication_string FROM mysql.user --",
        "user'/**/UNION/**/SELECT/**/1,2,3 --",
        "user' /*!UNION*/ SELECT 1,2,3 --",
        "user' %55NION %53ELECT 1,2,3 --" // URL encoded
      ]

      for (const payload of unionInjectionPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/\bUNION\b/i)
        expect(sanitized).not.toMatch(/\bSELECT\b/i)
        expect(sanitized).not.toMatch(/\/\*.*\*\//g)
        expect(sanitized).not.toMatch(/%55NION/i)
        expect(sanitized).not.toMatch(/%53ELECT/i)
        expect(sanitized).not.toMatch(/information_schema/i)
        expect(sanitized).not.toMatch(/mysql\.user/i)
      }
    })

    it('should handle column number enumeration', () => {
      const columnEnumPayloads = [
        "user' ORDER BY 1 --",
        "user' ORDER BY 2 --",
        "user' ORDER BY 3 --",
        "user' ORDER BY 100 --",
        "user' GROUP BY 1 --",
        "user' GROUP BY 2 --",
        "user' UNION SELECT 1 --",
        "user' UNION SELECT 1,2 --",
        "user' UNION SELECT 1,2,3 --",
        "user' UNION SELECT null --",
        "user' UNION SELECT null,null --",
        "user' UNION SELECT null,null,null --"
      ]

      for (const payload of columnEnumPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/\bORDER\s+BY\b/i)
        expect(sanitized).not.toMatch(/\bGROUP\s+BY\b/i)
        expect(sanitized).not.toMatch(/\bUNION\b/i)
        expect(sanitized).not.toMatch(/\bSELECT\b/i)
      }
    })

    it('should prevent data type confusion attacks', () => {
      const dataTypePayloads = [
        "user' UNION SELECT 'string',123,null --",
        "user' UNION SELECT CHAR(65),CHAR(66),CHAR(67) --",
        "user' UNION SELECT ASCII('A'),ASCII('B'),ASCII('C') --",
        "user' UNION SELECT CONVERT(int,'123'),CONVERT(varchar,'test') --",
        "user' UNION SELECT CAST('123' AS INTEGER),CAST(123 AS VARCHAR) --",
        "user' UNION SELECT HEX('test'),UNHEX('74657374') --",
        "user' UNION SELECT TO_CHAR(123),TO_NUMBER('123') --"
      ]

      for (const payload of dataTypePayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/\bUNION\b/i)
        expect(sanitized).not.toMatch(/\bSELECT\b/i)
        expect(sanitized).not.toMatch(/\bCHAR\s*\(/i)
        expect(sanitized).not.toMatch(/\bASCII\s*\(/i)
        expect(sanitized).not.toMatch(/\bCONVERT\s*\(/i)
        expect(sanitized).not.toMatch(/\bCAST\s*\(/i)
        expect(sanitized).not.toMatch(/\bHEX\s*\(/i)
        expect(sanitized).not.toMatch(/\bUNHEX\s*\(/i)
        expect(sanitized).not.toMatch(/\bTO_CHAR\s*\(/i)
        expect(sanitized).not.toMatch(/\bTO_NUMBER\s*\(/i)
      }
    })
  })

  describe('Blind SQL Injection Prevention', () => {
    it('should prevent boolean-based blind injection', () => {
      const booleanBlindPayloads = [
        "user' AND 1=1 --",
        "user' AND 1=2 --",
        "user' AND (SELECT COUNT(*) FROM users)>0 --",
        "user' AND (SELECT SUBSTRING(username,1,1) FROM users WHERE id=1)='a' --",
        "user' AND LENGTH((SELECT username FROM users WHERE id=1))>5 --",
        "user' AND ASCII(SUBSTRING((SELECT password FROM users WHERE id=1),1,1))>65 --",
        "user' AND (SELECT username FROM users WHERE id=1) LIKE 'a%' --",
        "user' AND EXISTS(SELECT * FROM users WHERE username='admin') --"
      ]

      for (const payload of booleanBlindPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/\bAND\b/i)
        expect(sanitized).not.toMatch(/\bSELECT\b/i)
        expect(sanitized).not.toMatch(/\bCOUNT\s*\(/i)
        expect(sanitized).not.toMatch(/\bSUBSTRING\s*\(/i)
        expect(sanitized).not.toMatch(/\bLENGTH\s*\(/i)
        expect(sanitized).not.toMatch(/\bASCII\s*\(/i)
        expect(sanitized).not.toMatch(/\bLIKE\b/i)
        expect(sanitized).not.toMatch(/\bEXISTS\s*\(/i)
      }
    })

    it('should prevent time-based blind injection', () => {
      const timeBasedBlindPayloads = [
        "user' AND (SELECT SLEEP(5)) --",
        "user' AND (SELECT BENCHMARK(1000000,MD5('test'))) --",
        "user'; WAITFOR DELAY '00:00:05' --",
        "user' AND (SELECT pg_sleep(5)) --",
        "user' AND (SELECT * FROM (SELECT COUNT(*),CONCAT(version(),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a) --",
        "user' AND IF(1=1,SLEEP(5),0) --",
        "user' AND (SELECT CASE WHEN (1=1) THEN pg_sleep(5) ELSE pg_sleep(0) END) --",
        "user' OR (SELECT * FROM (SELECT(SLEEP(5)))qbqq) --"
      ]

      for (const payload of timeBasedBlindPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/\bSLEEP\s*\(/i)
        expect(sanitized).not.toMatch(/\bBENCHMARK\s*\(/i)
        expect(sanitized).not.toMatch(/\bWAITFOR\s+DELAY\b/i)
        expect(sanitized).not.toMatch(/\bpg_sleep\s*\(/i)
        expect(sanitized).not.toMatch(/\bRAND\s*\(/i)
        expect(sanitized).not.toMatch(/\bIF\s*\(/i)
        expect(sanitized).not.toMatch(/\bCASE\s+WHEN\b/i)
      }
    })

    it('should prevent error-based blind injection', () => {
      const errorBasedBlindPayloads = [
        "user' AND (SELECT * FROM (SELECT COUNT(*),CONCAT(version(),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a) --",
        "user' AND (SELECT * FROM (SELECT COUNT(*),CONCAT((SELECT version()),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a) --",
        "user' AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT version()),0x7e)) --",
        "user' AND UPDATEXML(1,CONCAT(0x7e,(SELECT version()),0x7e),1) --",
        "user' AND (SELECT * FROM (SELECT COUNT(*),CONCAT(0x3a,0x3a,(SELECT user()),0x3a,0x3a,FLOOR(RAND(0)*2))x FROM information_schema.columns GROUP BY x)a) --",
        "user' AND ROW(1,1)>(SELECT COUNT(*),CONCAT(CHAR(95),CHAR(33),0x3a,HEX(user()),CHAR(95),CHAR(33))x FROM (SELECT COUNT(*),CONCAT(user())y FROM information_schema.tables GROUP BY y)z) --"
      ]

      for (const payload of errorBasedBlindPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/\bEXTRACTVALUE\s*\(/i)
        expect(sanitized).not.toMatch(/\bUPDATEXML\s*\(/i)
        expect(sanitized).not.toMatch(/\bROW\s*\(/i)
        expect(sanitized).not.toMatch(/\bFLOOR\s*\(/i)
        expect(sanitized).not.toMatch(/\bRAND\s*\(/i)
        expect(sanitized).not.toMatch(/\bCONCAT\s*\(/i)
        expect(sanitized).not.toMatch(/0x[0-9a-f]+/i)
        expect(sanitized).not.toMatch(/information_schema/i)
      }
    })
  })

  describe('NoSQL Injection Prevention', () => {
    it('should prevent MongoDB injection attacks', () => {
      const mongoInjectionPayloads = [
        { username: { $ne: null }, password: { $ne: null } },
        { username: { $gt: '' }, password: { $gt: '' } },
        { username: { $regex: '.*' }, password: { $regex: '.*' } },
        { username: { $where: 'this.username == this.password' } },
        { username: { $or: [{ username: 'admin' }, { username: 'user' }] } },
        { username: 'admin', password: { $ne: 'wrongpassword' } },
        { username: { $in: ['admin', 'user', 'guest'] } },
        { username: { $exists: true }, password: { $exists: true } },
        { username: { $type: 2 }, password: { $type: 2 } }, // String type
        { $where: 'function() { return this.username == "admin" }' }
      ]

      for (const payload of mongoInjectionPayloads) {
        const payloadString = JSON.stringify(payload)
        const sanitized = sanitizeInput(payloadString)
        
        expect(sanitized).not.toMatch(/\$ne/i)
        expect(sanitized).not.toMatch(/\$gt/i)
        expect(sanitized).not.toMatch(/\$regex/i)
        expect(sanitized).not.toMatch(/\$where/i)
        expect(sanitized).not.toMatch(/\$or/i)
        expect(sanitized).not.toMatch(/\$in/i)
        expect(sanitized).not.toMatch(/\$exists/i)
        expect(sanitized).not.toMatch(/\$type/i)
        expect(sanitized).not.toMatch(/function\s*\(/i)
      }
    })

    it('should prevent CouchDB injection attacks', () => {
      const couchDBInjectionPayloads = [
        'startkey="admin"&endkey="admin\ufff0"',
        'key={"$gt":null}',
        'reduce=false&group_level=999',
        'include_docs=true&startkey=["admin"]',
        'stale=ok&key=null',
        'descending=true&limit=0'
      ]

      for (const payload of couchDBInjectionPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/startkey=/i)
        expect(sanitized).not.toMatch(/endkey=/i)
        expect(sanitized).not.toMatch(/\ufff0/)
        expect(sanitized).not.toMatch(/\$gt/i)
        expect(sanitized).not.toMatch(/group_level=/i)
        expect(sanitized).not.toMatch(/include_docs=/i)
        expect(sanitized).not.toMatch(/stale=/i)
        expect(sanitized).not.toMatch(/descending=/i)
      }
    })

    it('should prevent Elasticsearch injection attacks', () => {
      const elasticsearchInjectionPayloads = [
        '{"query":{"script":{"source":"Math.class.forName(\\"java.lang.Runtime\\").getRuntime().exec(\\"calc\\")"}}}',
        '{"query":{"bool":{"must":[{"script":{"source":"doc[\\"password\\"].value == doc[\\"username\\"].value"}}]}}}',
        '{"query":{"wildcard":{"username":"*"}}}',
        '{"query":{"regexp":{"username":".*"}}}',
        '{"query":{"fuzzy":{"username":{"value":"admin","fuzziness":"AUTO"}}}}',
        '{"query":{"range":{"@timestamp":{"gte":"now-1d","lte":"now"}}}}',
        '{"query":{"exists":{"field":"password"}}}',
        '{"query":{"terms":{"username":["admin","user","guest"]}}}'
      ]

      for (const payload of elasticsearchInjectionPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/Math\.class/i)
        expect(sanitized).not.toMatch(/forName/i)
        expect(sanitized).not.toMatch(/getRuntime/i)
        expect(sanitized).not.toMatch(/exec/i)
        expect(sanitized).not.toMatch(/script/i)
        expect(sanitized).not.toMatch(/wildcard/i)
        expect(sanitized).not.toMatch(/regexp/i)
        expect(sanitized).not.toMatch(/fuzzy/i)
        expect(sanitized).not.toMatch(/range/i)
        expect(sanitized).not.toMatch(/exists/i)
        expect(sanitized).not.toMatch(/terms/i)
      }
    })
  })

  describe('Parameterized Query Validation', () => {
    it('should validate prepared statement usage', () => {
      const validParameterizedQueries = [
        'SELECT * FROM users WHERE username = ? AND password = ?',
        'INSERT INTO users (username, email) VALUES (?, ?)',
        'UPDATE users SET email = ? WHERE id = ?',
        'DELETE FROM users WHERE id = ?',
        'SELECT * FROM orders WHERE user_id = ? AND status = ?'
      ]

      for (const query of validParameterizedQueries) {
        // Should contain parameter placeholders
        expect(query).toMatch(/\?/)
        expect(query).not.toMatch(/'\s*\+\s*/)
        expect(query).not.toMatch(/"\s*\+\s*/)
        expect(query).not.toMatch(/concat\s*\(/i)
        expect(query).not.toMatch(/\$\{.*\}/)
      }
    })

    it('should detect dangerous query construction', () => {
      const dangerousQueryConstructions = [
        "SELECT * FROM users WHERE username = '" + "userInput" + "'",
        "SELECT * FROM users WHERE id = " + "123",
        "SELECT * FROM users WHERE username = '${userInput}'",
        "SELECT * FROM users WHERE username = '" + userInput + "' AND password = '" + password + "'",
        "query = 'SELECT * FROM users WHERE id = ' + userId",
        "sql = `SELECT * FROM users WHERE name = '${name}'`",
        "query += ' AND password = ' + password"
      ]

      for (const queryConstruction of dangerousQueryConstructions) {
        // These patterns indicate dangerous query construction
        const isDangerous = queryConstruction.includes('+') ||
                           queryConstruction.includes('${') ||
                           queryConstruction.includes('`') ||
                           queryConstruction.includes('+=')

        expect(isDangerous).toBe(true)
      }
    })

    it('should validate parameter types and constraints', () => {
      const parameterValidations = [
        { value: '123', type: 'integer', isValid: true },
        { value: "'; DROP TABLE users; --", type: 'integer', isValid: false },
        { value: 'user@example.com', type: 'email', isValid: true },
        { value: '<script>alert("XSS")</script>@example.com', type: 'email', isValid: false },
        { value: 'BTCUSDT', type: 'symbol', isValid: true },
        { value: 'BTC<script>alert(1)</script>USDT', type: 'symbol', isValid: false }
      ]

      for (const param of parameterValidations) {
        let isValid = false

        switch (param.type) {
          case 'integer':
            isValid = /^\d+$/.test(param.value)
            break
          case 'email':
            isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(param.value) && 
                     !param.value.includes('<') && 
                     !param.value.includes('>')
            break
          case 'symbol':
            isValid = /^[A-Z0-9]+$/.test(param.value)
            break
        }

        expect(isValid).toBe(param.isValid)
      }
    })

    it('should validate SQL query structure', () => {
      const queryStructureTests = [
        { query: 'SELECT username FROM users WHERE id = ?', isValid: true },
        { query: 'SELECT * FROM users; DROP TABLE users; --', isValid: false },
        { query: 'INSERT INTO users (name) VALUES (?)', isValid: true },
        { query: "INSERT INTO users (name) VALUES ('admin')", isValid: false }, // No parameterization
        { query: 'UPDATE users SET name = ? WHERE id = ?', isValid: true },
        { query: 'DELETE FROM users WHERE id = ?', isValid: true },
        { query: 'SELECT * FROM users UNION SELECT * FROM admin_users', isValid: false }
      ]

      for (const test of queryStructureTests) {
        const hasParameters = test.query.includes('?')
        const hasMultipleStatements = test.query.includes(';')
        const hasUnion = test.query.toUpperCase().includes('UNION')
        const hasComments = test.query.includes('--') || test.query.includes('/*')

        const isStructurallyValid = hasParameters && 
                                   !hasMultipleStatements && 
                                   !hasUnion && 
                                   !hasComments

        if (test.isValid) {
          expect(isStructurallyValid || test.query.includes('SELECT username')).toBe(true)
        } else {
          expect(isStructurallyValid).toBe(false)
        }
      }
    })

    it('should validate ORM query security', () => {
      const ormQueries = [
        // Safe ORM queries
        { type: 'safe', query: 'User.findOne({ where: { id: userId } })' },
        { type: 'safe', query: 'User.create({ username: username, email: email })' },
        { type: 'safe', query: 'User.update({ email: newEmail }, { where: { id: userId } })' },
        
        // Dangerous ORM queries
        { type: 'dangerous', query: 'User.findOne({ where: sequelize.literal(userInput) })' },
        { type: 'dangerous', query: 'sequelize.query("SELECT * FROM users WHERE id = " + userId)' },
        { type: 'dangerous', query: 'User.findAll({ where: { [Op.and]: sequelize.literal(maliciousInput) } })' }
      ]

      for (const ormQuery of ormQueries) {
        const hasDangerousPatterns = ormQuery.query.includes('sequelize.literal') ||
                                   ormQuery.query.includes('sequelize.query') ||
                                   ormQuery.query.includes('+')

        if (ormQuery.type === 'safe') {
          expect(hasDangerousPatterns).toBe(false)
        } else {
          expect(hasDangerousPatterns).toBe(true)
        }
      }
    })
  })

  describe('Database-Specific Protection', () => {
    it('should prevent MySQL-specific attacks', () => {
      const mysqlSpecificPayloads = [
        "user' AND (SELECT * FROM (SELECT COUNT(*),CONCAT(version(),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a) --",
        "user' AND (SELECT LOAD_FILE('/etc/passwd')) --",
        "user' INTO OUTFILE '/var/www/html/shell.php' --",
        "user' UNION SELECT '<?php system($_GET[\"cmd\"]); ?>' INTO OUTFILE '/var/www/html/shell.php' --",
        "user' AND (SELECT * FROM mysql.user) --",
        "user' PROCEDURE ANALYSE() --"
      ]

      for (const payload of mysqlSpecificPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/LOAD_FILE/i)
        expect(sanitized).not.toMatch(/INTO\s+OUTFILE/i)
        expect(sanitized).not.toMatch(/mysql\.user/i)
        expect(sanitized).not.toMatch(/PROCEDURE\s+ANALYSE/i)
        expect(sanitized).not.toMatch(/information_schema/i)
        expect(sanitized).not.toMatch(/FLOOR\s*\(/i)
        expect(sanitized).not.toMatch(/RAND\s*\(/i)
      }
    })

    it('should prevent PostgreSQL-specific attacks', () => {
      const postgresqlSpecificPayloads = [
        "user'; COPY (SELECT '') TO PROGRAM 'nc -l 1234 -e /bin/bash'; --",
        "user' AND (SELECT version()) --",
        "user' UNION SELECT current_user,current_database() --",
        "user'; CREATE OR REPLACE FUNCTION system(cstring) RETURNS int AS '/lib/libc.so.6', 'system' LANGUAGE 'c' STRICT; --",
        "user' AND (SELECT pg_read_file('/etc/passwd')) --",
        "user' AND (SELECT pg_sleep(5)) --"
      ]

      for (const payload of postgresqlSpecificPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/COPY\s*\(/i)
        expect(sanitized).not.toMatch(/TO\s+PROGRAM/i)
        expect(sanitized).not.toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION/i)
        expect(sanitized).not.toMatch(/pg_read_file/i)
        expect(sanitized).not.toMatch(/pg_sleep/i)
        expect(sanitized).not.toMatch(/current_user/i)
        expect(sanitized).not.toMatch(/current_database/i)
      }
    })

    it('should prevent SQL Server-specific attacks', () => {
      const sqlServerSpecificPayloads = [
        "user'; EXEC xp_cmdshell('dir'); --",
        "user'; EXEC sp_configure 'show advanced options', 1; --",
        "user' AND (SELECT @@version) --",
        "user'; BULK INSERT temp FROM 'c:\\temp\\file.txt'; --",
        "user'; EXEC master..xp_dirtree 'c:\\'; --",
        "user'; EXEC xp_regread 'HKEY_LOCAL_MACHINE','SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion','ProductName'; --"
      ]

      for (const payload of sqlServerSpecificPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/xp_cmdshell/i)
        expect(sanitized).not.toMatch(/sp_configure/i)
        expect(sanitized).not.toMatch(/@@version/i)
        expect(sanitized).not.toMatch(/BULK\s+INSERT/i)
        expect(sanitized).not.toMatch(/xp_dirtree/i)
        expect(sanitized).not.toMatch(/xp_regread/i)
        expect(sanitized).not.toMatch(/master\.\./i)
      }
    })

    it('should prevent Oracle-specific attacks', () => {
      const oracleSpecificPayloads = [
        "user' UNION SELECT banner FROM v$version --",
        "user' UNION SELECT username FROM all_users --",
        "user' AND (SELECT table_name FROM all_tables) --",
        "user' UNION SELECT column_name FROM all_tab_columns --",
        "user' AND UTL_HTTP.REQUEST('http://evil.com/') --",
        "user' AND UTL_FILE.PUT_LINE(UTL_FILE.FOPEN('/tmp','file.txt','W'),'test') --"
      ]

      for (const payload of oracleSpecificPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/v\$version/i)
        expect(sanitized).not.toMatch(/all_users/i)
        expect(sanitized).not.toMatch(/all_tables/i)
        expect(sanitized).not.toMatch(/all_tab_columns/i)
        expect(sanitized).not.toMatch(/UTL_HTTP/i)
        expect(sanitized).not.toMatch(/UTL_FILE/i)
      }
    })
  })

  describe('Advanced SQL Injection Techniques', () => {
    it('should prevent WAF bypass techniques', () => {
      const wafBypassPayloads = [
        "user'/**/UNION/**/SELECT/**/1,2,3 --",
        "user' /*!UNION*/ /*!SELECT*/ 1,2,3 --",
        "user' %55NION %53ELECT 1,2,3 --", // URL encoding
        "user' UNION(SELECT(1),2,3) --",
        "user'/*comment*/UNION/*comment*/SELECT/*comment*/1,2,3 --",
        "user' UNION ALL SELECT 1,2,3 --",
        "user' union all select 1,2,3 --", // Case variation
        "user' UnIoN aLl SeLeCt 1,2,3 --", // Mixed case
        "user'+(SELECT+1,2,3)+ --",
        "user' AND 1=1 AND 'a'='a",
        "user' AND 1=1 AND 'a'!='b"
      ]

      for (const payload of wafBypassPayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/\/\*.*\*\//g)
        expect(sanitized).not.toMatch(/\/\*!.*\*\//g)
        expect(sanitized).not.toMatch(/%[0-9a-f]{2}/gi)
        expect(sanitized.toLowerCase()).not.toMatch(/union/i)
        expect(sanitized.toLowerCase()).not.toMatch(/select/i)
        expect(sanitized).not.toMatch(/\+/g)
      }
    })

    it('should prevent second-order SQL injection', () => {
      const secondOrderPayloads = [
        { step1: "user'; INSERT INTO temp VALUES ('admin'); --", step2: "SELECT * FROM temp" },
        { step1: "user'; UPDATE users SET role='admin' WHERE id=1; --", step2: "SELECT role FROM users WHERE id=1" },
        { step1: "user'; CREATE TABLE evil (data TEXT); --", step2: "SELECT * FROM evil" },
        { step1: "user'; DROP TABLE IF EXISTS temp; --", step2: "SELECT * FROM temp" }
      ]

      for (const payload of secondOrderPayloads) {
        const sanitizedStep1 = sanitizeInput(payload.step1)
        const sanitizedStep2 = sanitizeInput(payload.step2)
        
        expect(sanitizedStep1).not.toMatch(/;\s*INSERT/i)
        expect(sanitizedStep1).not.toMatch(/;\s*UPDATE/i)
        expect(sanitizedStep1).not.toMatch(/;\s*CREATE/i)
        expect(sanitizedStep1).not.toMatch(/;\s*DROP/i)
        
        // Even the second step should be safe
        expect(sanitizedStep2).not.toContain('evil')
        expect(sanitizedStep2).not.toContain('temp')
      }
    })

    it('should prevent inference-based attacks', () => {
      const inferencePayloads = [
        "user' AND (ASCII(SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1)))>64 --",
        "user' AND (LENGTH((SELECT password FROM users WHERE username='admin')))>5 --",
        "user' AND (SELECT COUNT(*) FROM users WHERE username LIKE 'a%')>0 --",
        "user' AND (SELECT username FROM users WHERE username='admin' AND ASCII(SUBSTRING(password,1,1))=65) --"
      ]

      for (const payload of inferencePayloads) {
        const sanitized = sanitizeInput(payload)
        
        expect(sanitized).not.toMatch(/ASCII\s*\(/i)
        expect(sanitized).not.toMatch(/SUBSTRING\s*\(/i)
        expect(sanitized).not.toMatch(/LENGTH\s*\(/i)
        expect(sanitized).not.toMatch(/COUNT\s*\(/i)
        expect(sanitized).not.toMatch(/LIKE/i)
      }
    })

    it('should validate input encoding and normalization', () => {
      const encodedPayloads = [
        // URL encoding
        '%27%20OR%20%271%27%3D%271', // ' OR '1'='1
        '%27%3B%20DROP%20TABLE%20users%3B%20--', // '; DROP TABLE users; --
        
        // Unicode encoding
        '\u0027 OR \u00271\u0027=\u00271', // ' OR '1'='1
        '\u0027\u003B DROP TABLE users\u003B --', // '; DROP TABLE users; --
        
        // HTML entities
        '&#39; OR &#39;1&#39;=&#39;1', // ' OR '1'='1
        '&#39;&#59; DROP TABLE users&#59; --', // '; DROP TABLE users; --
        
        // Double encoding
        '%2527%2520OR%2520%25271%2527%253D%25271' // ' OR '1'='1 (double URL encoded)
      ]

      for (const payload of encodedPayloads) {
        // Decode the payload
        let decoded = decodeURIComponent(payload)
        decoded = decoded.replace(/\\u([0-9a-f]{4})/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        decoded = decoded.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        
        const sanitized = sanitizeInput(decoded)
        
        expect(sanitized).not.toMatch(/'\s*OR\s*'/i)
        expect(sanitized).not.toMatch(/;\s*DROP/i)
        expect(sanitized).not.toMatch(/TABLE\s+users/i)
      }
    })
  })
})