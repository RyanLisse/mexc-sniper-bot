# Fetch Mocking Guide for MEXC API Tests

## Problem Summary

The error "Cannot read properties of undefined (reading 'headers')" was occurring because test files had incomplete fetch mocks that were missing the `headers` property. The MEXC API client expects to access `response.headers.forEach()` for rate limiting analysis.

## Fixed Files

The following files were updated to include proper headers in their fetch mocks:

1. **`/tests/unit/enhanced-mexc-credential-validation.test.ts`**
   - Fixed 4 instances of missing or incorrectly structured headers
   - Changed `new Map()` to `new Headers()` for proper Headers API compatibility

2. **`/src/services/unified-mexc-service.test.ts`**
   - Fixed 3 instances of missing headers in fetch mocks

3. **`/tests/setup/vitest-setup.js`**
   - Added new helper functions for consistent fetch mocking

## How to Properly Mock Fetch Responses

### ✅ Correct Way (Use Helper Functions)

```javascript
// Option 1: Use the global testUtils helper
const mockResponse = global.testUtils.mockApiResponse({
  permissions: ["spot"],
  accountType: "SPOT"
});
global.fetch = vi.fn().mockResolvedValue(mockResponse);

// Option 2: Use MEXC-specific helper (includes rate limiting headers)
const mockResponse = global.testUtils.mockMexcApiResponse({
  permissions: ["spot"],
  accountType: "SPOT"
});
global.fetch = vi.fn().mockResolvedValue(mockResponse);

// Option 3: Manual (when you need custom headers)
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: new Headers({
    'content-type': 'application/json',
    'x-ratelimit-remaining': '100'
  }),
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data))
});
```

### ❌ Incorrect Ways (Will Cause Errors)

```javascript
// Missing headers entirely
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(data)
});

// Using Map instead of Headers
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  headers: new Map([["content-type", "application/json"]]),
  json: () => Promise.resolve(data)
});

// Missing required properties
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(data)
  // Missing: status, statusText, headers
});
```

## Validation Helper

Use the validation helper to catch issues early:

```javascript
const mockResponse = {
  ok: true,
  json: () => Promise.resolve(data)
  // This will throw an error about missing headers
};

// This will throw an error explaining what's missing
global.testUtils.validateFetchMock(mockResponse);
```

## Why Headers Are Required

The MEXC API client (`/src/services/mexc-api-client.ts`) processes response headers for:

1. **Rate Limiting Analysis**: Extracts headers like `x-ratelimit-remaining`
2. **Performance Monitoring**: Records response metadata
3. **Error Handling**: Includes headers in error objects for debugging

The client code specifically calls:
```javascript
response.headers.forEach((value, key) => {
  responseHeaders[key] = value;
});
```

If `response.headers` is undefined or doesn't have a `forEach` method, this will fail.

## Best Practices

1. **Always use the helper functions** from `global.testUtils`
2. **Include realistic headers** that match what MEXC API returns
3. **Test both success and error responses** with proper headers
4. **Use the validation helper** during development to catch issues early

## Common Headers for MEXC API

```javascript
{
  'content-type': 'application/json',
  'x-ratelimit-remaining': '100',
  'x-ratelimit-limit': '1000',
  'x-ratelimit-reset': '1640995200',
  'server': 'nginx',
  'access-control-allow-origin': '*'
}
```

## Testing Checklist

Before writing new tests that use fetch:

- [ ] Use `global.testUtils.mockApiResponse()` or `mockMexcApiResponse()`
- [ ] Include all required properties: `ok`, `status`, `statusText`, `headers`, `json`, `text`
- [ ] Use `new Headers({...})` for manual mocks
- [ ] Test both success and error scenarios
- [ ] Run `global.testUtils.validateFetchMock()` if creating custom mocks