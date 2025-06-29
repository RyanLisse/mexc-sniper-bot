/**
 * Simplified Test Utilities
 *
 * Clean, maintainable test helper functions that replace
 * the complex utility systems with simple, focused implementations.
 */

// ============================================================================
// Test Utilities
// ============================================================================

export function initializeTestUtilities(): void {
  global.testUtils = {
    createTestUser: (overrides = {}) => ({
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }),

    createTestApiCredentials: (overrides = {}) => ({
      id: 'test-creds-id',
      userId: 'test-user-id',
      mexcApiKey: 'encrypted_test-api-key',
      mexcSecretKey: 'encrypted_test-secret-key',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }),

    waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

    generateTestId: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

    mockApiResponse: (data: any, status = 200) => ({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
      headers: new Headers({
        'content-type': 'application/json',
      }),
    }),
  };
}