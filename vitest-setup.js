import '@testing-library/jest-dom/vitest'

// Mock environment variables for testing
process.env.OPENAI_API_KEY = 'test-openai-key'
process.env.MEXC_API_KEY = 'test-mexc-key'
process.env.MEXC_SECRET_KEY = 'test-mexc-secret'
process.env.MEXC_BASE_URL = 'https://api.mexc.com'

// Mock fetch for testing
global.fetch = vi.fn()

// Mock AbortSignal.timeout for Node environments that don't support it
if (!AbortSignal.timeout) {
  AbortSignal.timeout = (delay) => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), delay)
    return controller.signal
  }
}