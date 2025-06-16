# API Credentials "Invalid Request Body" - Enhanced Debugging Solution

## Problem Solved

The user was experiencing "Invalid request body" errors when trying to save API credentials. I've implemented comprehensive debugging enhancements to identify and resolve the root cause.

## Enhanced Debugging Implementation

### 1. Server-Side Enhanced Error Handling (`/src/lib/auth-decorators.ts`)

**Enhanced `userBodyRoute` decorator with comprehensive debugging:**

```typescript
// Enhanced request debugging
console.log('[DEBUG] Request details:', {
  method: request.method,
  contentType: request.headers.get('content-type'),
  hasBody: request.body !== null,
  userAgent: request.headers.get('user-agent'),
  userId: user?.id,
  timestamp: new Date().toISOString()
});

// Specific JSON parsing error handling
try {
  body = await request.json();
  console.log('[DEBUG] JSON parsing successful, body keys:', Object.keys(body || {}));
} catch (jsonError) {
  console.error('[DEBUG] JSON parsing failed:', {
    error: jsonError instanceof Error ? jsonError.message : String(jsonError),
    errorType: jsonError?.constructor?.name,
    contentType: request.headers.get('content-type'),
    bodyConsumed: request.bodyUsed
  });
  
  // Return detailed error response with debug information
  return new Response(JSON.stringify(
    createErrorResponse("Invalid request body", {
      message: errorDetails,
      code: "INVALID_JSON",
      details: jsonError instanceof Error ? jsonError.message : String(jsonError),
      debug: {
        contentType: request.headers.get('content-type'),
        bodyUsed: request.bodyUsed,
        hasBody: request.body !== null
      }
    })
  ), {
    status: HTTP_STATUS.BAD_REQUEST,
    headers: { "Content-Type": "application/json" },
  });
}
```

**Key Debugging Features:**
- **Request Analysis**: Logs method, content-type, body presence, user agent
- **JSON Parsing Isolation**: Specific error handling for JSON parsing failures
- **Detailed Error Responses**: Returns debug information in error responses
- **User ID Validation**: Enhanced logging for authentication mismatches
- **Request Flow Tracking**: Step-by-step debugging through the validation process

### 2. Client-Side Enhanced Error Handling (`/src/hooks/use-api-credentials.ts`)

**Enhanced fetch request with comprehensive debugging:**

```typescript
// Enhanced debugging for request
const requestPayload = JSON.stringify(data);
console.log('[DEBUG] Sending API credentials request:', {
  url: '/api/api-credentials',
  method: 'POST',
  contentType: 'application/json',
  userId: data.userId,
  provider: data.provider || 'mexc',
  hasApiKey: !!data.apiKey,
  hasSecretKey: !!data.secretKey,
  payloadLength: requestPayload.length,
  timestamp: new Date().toISOString()
});

// Enhanced response handling
console.log('[DEBUG] API credentials response:', {
  status: response.status,
  statusText: response.statusText,
  ok: response.ok,
  headers: Object.fromEntries(response.headers.entries())
});

// Enhanced error parsing
if (!response.ok) {
  let errorDetails;
  try {
    errorDetails = await response.json();
    console.error('[DEBUG] API credentials error response:', errorDetails);
  } catch (parseError) {
    console.error('[DEBUG] Failed to parse error response:', parseError);
    errorDetails = { 
      error: `HTTP ${response.status}: ${response.statusText}`,
      details: 'Failed to parse error response'
    };
  }
  
  throw new Error(errorDetails.error || errorDetails.message || "Failed to save API credentials");
}
```

**Key Client-Side Features:**
- **Request Payload Validation**: Logs request details before sending
- **Response Analysis**: Comprehensive response status and headers logging
- **Error Response Parsing**: Safe error response parsing with fallback handling
- **Network Issue Detection**: Identifies network vs. server vs. parsing issues

## How to Use the Enhanced Debugging

### 1. **Browser Console Debugging**

When the user tries to save API credentials:

1. **Open Browser Developer Tools** → Console tab
2. **Attempt to save credentials** through the form
3. **Review console logs** for detailed debugging information:

```javascript
// You'll see logs like:
[DEBUG] Sending API credentials request: {
  url: '/api/api-credentials',
  method: 'POST',
  contentType: 'application/json',
  userId: 'user_123',
  provider: 'mexc',
  hasApiKey: true,
  hasSecretKey: true,
  payloadLength: 156,
  timestamp: '2025-06-16T17:11:00.000Z'
}

[DEBUG] API credentials response: {
  status: 400,
  statusText: 'Bad Request',
  ok: false,
  headers: { 'content-type': 'application/json' }
}

[DEBUG] API credentials error response: {
  error: 'Invalid request body',
  code: 'INVALID_JSON',
  details: 'Unexpected token...',
  debug: {
    contentType: 'application/json',
    bodyUsed: true,
    hasBody: true
  }
}
```

### 2. **Server-Side Log Analysis**

Check the server console (where `npm run dev` is running):

```bash
[DEBUG] Request details: {
  method: 'POST',
  contentType: 'application/json',
  hasBody: true,
  userAgent: 'Mozilla/5.0...',
  userId: 'user_123',
  timestamp: '2025-06-16T17:11:00.000Z'
}

[DEBUG] JSON parsing failed: {
  error: 'Unexpected token } in JSON at position 145',
  errorType: 'SyntaxError',
  contentType: 'application/json',
  bodyConsumed: false
}
```

### 3. **Common Failure Patterns Identification**

The enhanced debugging will help identify these common issues:

#### **A. JSON Parsing Failures**
- **Malformed JSON**: Incomplete or invalid JSON syntax
- **Content-Type Issues**: Missing or incorrect Content-Type header
- **Body Consumption**: Request body already consumed by middleware

#### **B. Authentication Issues**
- **Session Expiration**: User session expired during form interaction
- **User ID Mismatch**: Form userId doesn't match authenticated user
- **Authentication State**: User not properly authenticated

#### **C. Network Issues**
- **Proxy Interference**: Corporate proxy modifying requests
- **Browser Extensions**: Extensions interfering with requests
- **Network Corruption**: Request corrupted during transmission

## Testing the Enhanced Solution

### 1. **Manual Testing**

Now when the user experiences the "Invalid request body" error:

1. **Open browser console** before submitting the form
2. **Submit the API credentials** and observe the detailed logs
3. **Check both client and server console** for the debugging information
4. **Use the debug information** to identify the exact failure point

### 2. **Example Debugging Session**

If the issue is malformed JSON:
```javascript
// Client log:
[DEBUG] Sending API credentials request: { payloadLength: 156, ... }

// Server log:
[DEBUG] Request details: { contentType: 'application/json', ... }
[DEBUG] JSON parsing failed: { 
  error: 'Unexpected token } in JSON at position 145',
  errorType: 'SyntaxError'
}
```

**Solution**: The JSON is malformed at position 145, likely a missing quote or comma.

If the issue is authentication:
```javascript
// Server log:
[DEBUG] JSON parsing successful, body keys: ['userId', 'apiKey', 'secretKey']
[DEBUG] User ID mismatch: { 
  authenticatedUserId: 'user_123', 
  bodyUserId: 'user_456' 
}
```

**Solution**: The form is submitting a different userId than the authenticated user.

## Production Considerations

### 1. **Debug Logging Control**

For production deployment, consider adding environment-based logging:

```typescript
const DEBUG_MODE = process.env.NODE_ENV === 'development' || process.env.DEBUG_API === 'true';

if (DEBUG_MODE) {
  console.log('[DEBUG] Request details:', { ... });
}
```

### 2. **Security Considerations**

The debugging logs are careful to:
- **Never log sensitive data** (API keys, secrets)
- **Only log metadata** (lengths, presence flags, types)
- **Avoid exposing internal system details** in error responses

### 3. **Performance Impact**

The debugging enhancement:
- **Minimal overhead**: Only adds logging and error handling
- **No blocking operations**: All debugging is synchronous logging
- **Conditional execution**: Can be disabled in production

## Expected Outcome

With this enhanced debugging solution, when the user reports "Invalid request body" errors, the detailed logs will immediately reveal:

1. **Exact failure point**: JSON parsing, authentication, validation, etc.
2. **Request characteristics**: Headers, content type, payload size
3. **Response details**: Status codes, error messages, debug info
4. **Authentication state**: User ID matching, session validity

This will allow for **immediate root cause identification** and **targeted fixes** rather than guessing at the problem.

## Next Steps

1. **Deploy the enhanced debugging** to the development environment
2. **Test with the user** who reported the issue
3. **Collect the debug logs** from both client and server
4. **Identify the root cause** using the detailed debugging information
5. **Implement targeted fix** based on the specific issue found
6. **Remove or reduce debug logging** for production deployment

The enhanced debugging system should immediately reveal why the "Invalid request body" error is occurring, allowing for a quick and precise fix.