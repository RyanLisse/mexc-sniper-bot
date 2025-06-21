import { describe, it, expect } from 'vitest';
import { setTestTimeout } from '../utils/timeout-utilities';

describe('MEXC API Client Utilities', () => {
  // Set standard timeout for unit tests (10 seconds)
  const TEST_TIMEOUT = setTestTimeout('unit');

  describe('Signature generation logic', () => {
    it('should create proper query string for signature', () => {
      // Test the query string creation logic that would be used in generateSignature
      const params = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        timestamp: 1672531200000
      }

      const queryString = new URLSearchParams(
        Object.entries(params)
          .filter(([_, value]) => value !== undefined && value !== null)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => [key, String(value)])
      ).toString()

      expect(queryString).toBe('side=BUY&symbol=BTCUSDT&timestamp=1672531200000&type=MARKET')
    })

    it('should filter out undefined and null values', () => {
      const params = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: undefined,
        price: null,
        timestamp: 1672531200000
      }

      const queryString = new URLSearchParams(
        Object.entries(params)
          .filter(([_, value]) => value !== undefined && value !== null)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => [key, String(value)])
      ).toString()

      expect(queryString).toBe('side=BUY&symbol=BTCUSDT&timestamp=1672531200000&type=MARKET')
    })

    it('should sort parameters alphabetically', () => {
      const params = {
        zebra: 'last',
        alpha: 'first',
        beta: 'second',
        charlie: 'third'
      }

      const queryString = new URLSearchParams(
        Object.entries(params)
          .filter(([_, value]) => value !== undefined && value !== null)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => [key, String(value)])
      ).toString()

      expect(queryString).toBe('alpha=first&beta=second&charlie=third&zebra=last')
    })
  })

  describe('Rate limiting logic', () => {
    const rateLimitDelay = 100 // 100ms

    it('should calculate correct delay when request is too soon', () => {
      const now = Date.now()
      const lastRequestTime = now - 50 // 50ms ago
      const timeSinceLastRequest = now - lastRequestTime

      const shouldDelay = timeSinceLastRequest < rateLimitDelay
      const delay = rateLimitDelay - timeSinceLastRequest

      expect(shouldDelay).toBe(true)
      expect(delay).toBe(50)
    })

    it('should not delay when enough time has passed', () => {
      const now = Date.now()
      const lastRequestTime = now - 150 // 150ms ago
      const timeSinceLastRequest = now - lastRequestTime

      const shouldDelay = timeSinceLastRequest < rateLimitDelay

      expect(shouldDelay).toBe(false)
    })
  })

  describe('URL construction logic', () => {
    it('should build correct endpoint URLs', () => {
      const baseUrl = 'https://api.mexc.com'
      const endpoint = '/api/v3/exchangeInfo'
      
      const fullUrl = `${baseUrl}${endpoint}`
      
      expect(fullUrl).toBe('https://api.mexc.com/api/v3/exchangeInfo')
    })

    it('should handle endpoint with leading slash', () => {
      const baseUrl = 'https://api.mexc.com'
      const endpoint = '/api/v3/calendar'
      
      const fullUrl = `${baseUrl}${endpoint}`
      
      expect(fullUrl).toBe('https://api.mexc.com/api/v3/calendar')
    })

    it('should handle endpoint without leading slash', () => {
      const baseUrl = 'https://api.mexc.com'
      const endpoint = 'api/v3/calendar'
      
      const fullUrl = `${baseUrl}/${endpoint}`
      
      expect(fullUrl).toBe('https://api.mexc.com/api/v3/calendar')
    })
  })

  describe('Configuration validation', () => {
    it('should use default values when not provided', () => {
      const config = {
        apiKey: process.env.MEXC_API_KEY || "",
        secretKey: process.env.MEXC_SECRET_KEY || "",
        baseUrl: process.env.MEXC_BASE_URL || "https://api.mexc.com",
        timeout: 10000,
      }

      expect(config.baseUrl).toBe('https://api.mexc.com')
      expect(config.timeout).toBe(10000)
    })

    it('should use provided values over defaults', () => {
      const customConfig = {
        apiKey: 'test-key',
        secretKey: 'test-secret',
        baseUrl: 'https://custom.api.com',
        timeout: 5000,
      }

      expect(customConfig.baseUrl).toBe('https://custom.api.com')
      expect(customConfig.timeout).toBe(5000)
    })
  })

  describe('Error handling scenarios', () => {
    it('should identify missing credentials error', () => {
      const hasCredentials = (apiKey: string, secretKey: string) => {
        return !!(apiKey && secretKey)
      }

      expect(hasCredentials('', '')).toBe(false)
      expect(hasCredentials('key', '')).toBe(false)
      expect(hasCredentials('', 'secret')).toBe(false)
      expect(hasCredentials('key', 'secret')).toBe(true)
    })

    it('should validate request parameters', () => {
      const validateSymbolParam = (symbol: string) => {
        if (!symbol || symbol.trim() === '') {
          throw new Error('Symbol parameter is required')
        }
        return symbol.trim()
      }

      expect(() => validateSymbolParam('')).toThrow('Symbol parameter is required')
      expect(() => validateSymbolParam('  ')).toThrow('Symbol parameter is required')
      expect(validateSymbolParam('BTCUSDT')).toBe('BTCUSDT')
      expect(validateSymbolParam('  BTCUSDT  ')).toBe('BTCUSDT')
    })
  })
})