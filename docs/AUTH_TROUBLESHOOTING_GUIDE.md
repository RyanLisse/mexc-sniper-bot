# Authentication Troubleshooting Guide

## Overview

This comprehensive guide covers common authentication issues encountered in the MEXC Sniper Bot application using Supabase authentication. It provides step-by-step solutions, diagnostic tools, and preventive measures.

## Quick Diagnostic Tools

### 1. Authentication Status Checker
```bash
# Check current authentication status
curl -X GET "http://localhost:3008/api/health/auth" \
  -H "Content-Type: application/json"
```

### 2. Environment Validation
```bash
# Validate authentication environment
bun run scripts/validate-auth-environment.ts
```

### 3. User Status Checker
```bash
# Check specific user status
curl -X POST "http://localhost:3008/api/debug/user-status" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

## Common Authentication Issues

### 1. Email Confirmation Issues

#### Problem: "Please confirm your email address"
**Symptoms:**
- User signed up but cannot log in
- Email confirmation never received
- "Email not confirmed" error messages

**Causes:**
- Supabase email rate limits (2 emails/hour)
- Email delivery issues
- Incorrect email templates
- SMTP configuration problems

**Solutions:**

##### Quick Fix (Development)
```bash
# Use email bypass for development
bun run scripts/bypass-email-confirmation.ts --email user@example.com

# Or use API endpoint
curl -X POST "http://localhost:3008/api/admin/bypass-email-confirmation" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

##### Production Fix
```bash
# Configure custom SMTP (see SMTP_CONFIGURATION_GUIDE.md)
SUPABASE_SMTP_HOST=smtp.resend.com
SUPABASE_SMTP_USER=resend
SUPABASE_SMTP_PASS=re_your-api-key
```

##### Diagnostic Steps
```typescript
// Check user confirmation status
const checkUserConfirmation = async (email: string) => {
  const supabase = await createSupabaseServerClient()
  
  const { data: user, error } = await supabase
    .from('auth.users')
    .select('email_confirmed_at, email')
    .eq('email', email)
    .single()
    
  console.log('User confirmation status:', {
    email: user?.email,
    confirmed: !!user?.email_confirmed_at,
    confirmedAt: user?.email_confirmed_at,
  })
}
```

### 2. Rate Limit Errors

#### Problem: "Rate limit exceeded"
**Symptoms:**
- "Too many requests" errors
- Authentication failures during peak usage
- Email sending failures

**Causes:**
- Supabase rate limits exceeded
- Too many authentication attempts
- Insufficient SMTP configuration

**Solutions:**

##### Immediate Fix
```typescript
// Implement rate limit handling
const handleRateLimit = async (error: any) => {
  if (error.message?.includes('rate limit')) {
    // Show user-friendly message
    showRateLimitNotice()
    
    // Calculate retry time
    const retryAfter = extractRetryAfter(error)
    scheduleRetry(retryAfter)
  }
}
```

##### Long-term Solution
```bash
# Configure custom SMTP to bypass rate limits
# See SMTP_CONFIGURATION_GUIDE.md for detailed setup
```

##### Rate Limit Monitor
```typescript
// Monitor rate limit usage
const rateLimitMonitor = {
  requests: 0,
  resetTime: new Date(),
  
  checkLimit: () => {
    const now = new Date()
    if (now > this.resetTime) {
      this.requests = 0
      this.resetTime = new Date(now.getTime() + 3600000) // +1 hour
    }
    
    return this.requests < 100 // Adjust limit as needed
  },
  
  recordRequest: () => {
    this.requests++
  }
}
```

### 3. Session Management Issues

#### Problem: "User session expired" or "Invalid session"
**Symptoms:**
- User logged out unexpectedly
- Authentication state inconsistent
- "Session not found" errors

**Causes:**
- Session token expired
- Cookie configuration issues
- Server-client session mismatch

**Solutions:**

##### Session Refresh
```typescript
// Implement automatic session refresh
const refreshSession = async () => {
  const supabase = getSupabaseBrowserClient()
  
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession()
    
    if (error) {
      console.error('Session refresh failed:', error)
      // Redirect to login
      window.location.href = '/auth'
    } else {
      console.log('Session refreshed successfully')
    }
  } catch (error) {
    console.error('Session refresh error:', error)
  }
}
```

##### Session Validation
```typescript
// Validate session on critical operations
const validateSession = async () => {
  const supabase = getSupabaseBrowserClient()
  
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (!session || error) {
    // Session invalid, redirect to login
    window.location.href = '/auth'
    return false
  }
  
  // Check if session is close to expiring
  const expiresAt = session.expires_at * 1000
  const now = Date.now()
  
  if (expiresAt - now < 300000) { // 5 minutes
    await refreshSession()
  }
  
  return true
}
```

### 4. OAuth Provider Issues

#### Problem: "OAuth authentication failed"
**Symptoms:**
- Google/GitHub sign-in fails
- Redirect loop during OAuth flow
- "Invalid OAuth state" errors

**Causes:**
- Incorrect OAuth provider configuration
- Mismatched redirect URLs
- Missing OAuth scopes

**Solutions:**

##### OAuth Configuration Check
```typescript
// Verify OAuth provider settings
const checkOAuthConfig = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    redirectUri: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    scopes: ['email', 'profile']
  },
  
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    redirectUri: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    scopes: ['user:email']
  }
}
```

##### OAuth Debug Information
```typescript
// Log OAuth flow for debugging
const debugOAuthFlow = (provider: string, data: any) => {
  console.log(`OAuth ${provider} flow:`, {
    timestamp: new Date().toISOString(),
    provider,
    data,
    redirectUri: window.location.href,
  })
}
```

### 5. Environment Configuration Issues

#### Problem: "Supabase client not initialized"
**Symptoms:**
- Application crashes on authentication
- "Cannot read properties of undefined" errors
- Missing environment variables warnings

**Causes:**
- Missing or incorrect environment variables
- Supabase client initialization errors
- Environment variable loading issues

**Solutions:**

##### Environment Validation Script
```typescript
// scripts/validate-auth-environment.ts
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]

const validateEnvironment = () => {
  const missing = requiredEnvVars.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing)
    process.exit(1)
  }
  
  console.log('✅ All required environment variables present')
}

validateEnvironment()
```

##### Environment Loading Check
```typescript
// Check environment variables are loaded correctly
const checkEnvVars = () => {
  const vars = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
  
  console.log('Environment variables:', {
    supabaseUrl: vars.supabaseUrl ? '✅ Present' : '❌ Missing',
    supabaseAnonKey: vars.supabaseAnonKey ? '✅ Present' : '❌ Missing',
    serviceRoleKey: vars.serviceRoleKey ? '✅ Present' : '❌ Missing',
  })
  
  return Object.values(vars).every(Boolean)
}
```

### 6. Database Connection Issues

#### Problem: "Database connection failed"
**Symptoms:**
- User data not saving
- Authentication works but user profile missing
- Database timeout errors

**Causes:**
- Database connection pool exhaustion
- Network connectivity issues
- RLS (Row Level Security) policy issues

**Solutions:**

##### Database Health Check
```typescript
// Check database connectivity
const checkDatabaseHealth = async () => {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Test simple query
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
    
    if (error) {
      console.error('Database health check failed:', error)
      return false
    }
    
    console.log('✅ Database connection healthy')
    return true
  } catch (error) {
    console.error('Database health check error:', error)
    return false
  }
}
```

##### RLS Policy Check
```sql
-- Check RLS policies for profiles table
SELECT * FROM information_schema.table_privileges 
WHERE table_name = 'profiles';

-- Check current user permissions
SELECT current_user, current_setting('role');
```

## Diagnostic Procedures

### 1. Authentication Flow Debugging

#### Step-by-Step Debug Process
```typescript
// Comprehensive authentication debug
const debugAuthFlow = async (email: string) => {
  console.log('🔍 Starting authentication debug for:', email)
  
  // 1. Check environment
  const envValid = checkEnvVars()
  console.log('Environment valid:', envValid)
  
  // 2. Check Supabase client
  const supabase = getSupabaseBrowserClient()
  console.log('Supabase client:', !!supabase)
  
  // 3. Check user existence
  const { data: user, error: userError } = await supabase
    .from('auth.users')
    .select('*')
    .eq('email', email)
    .single()
  
  console.log('User exists:', !!user, userError)
  
  // 4. Check session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  console.log('Session valid:', !!session, sessionError)
  
  // 5. Check database connectivity
  const dbHealth = await checkDatabaseHealth()
  console.log('Database healthy:', dbHealth)
  
  return {
    environment: envValid,
    supabaseClient: !!supabase,
    userExists: !!user,
    sessionValid: !!session,
    databaseHealthy: dbHealth,
  }
}
```

### 2. Network Debugging

#### Network Connectivity Check
```typescript
// Check network connectivity to Supabase
const checkSupabaseConnectivity = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Content-Type': 'application/json',
      },
    })
    
    console.log('Supabase connectivity:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    })
    
    return response.ok
  } catch (error) {
    console.error('Supabase connectivity error:', error)
    return false
  }
}
```

### 3. Browser State Debugging

#### Browser Storage Check
```typescript
// Check browser storage for auth data
const checkBrowserStorage = () => {
  const localStorage = window.localStorage
  const sessionStorage = window.sessionStorage
  
  // Check for Supabase auth data
  const supabaseKeys = Object.keys(localStorage)
    .filter(key => key.includes('supabase'))
  
  console.log('Supabase storage keys:', supabaseKeys)
  
  supabaseKeys.forEach(key => {
    const value = localStorage.getItem(key)
    try {
      const parsed = JSON.parse(value || '{}')
      console.log(`${key}:`, parsed)
    } catch {
      console.log(`${key}:`, value)
    }
  })
  
  // Check cookies
  const cookies = document.cookie.split(';')
    .filter(cookie => cookie.includes('supabase'))
  
  console.log('Supabase cookies:', cookies)
}
```

## Error Reference

### Common Error Messages and Solutions

#### "Invalid API key"
**Error**: `Invalid API key`
**Cause**: Wrong or expired Supabase API key
**Solution**: 
1. Check API key in Supabase dashboard
2. Update environment variables
3. Restart development server

#### "Row Level Security policy violation"
**Error**: `new row violates row-level security policy`
**Cause**: RLS policy preventing data access
**Solution**:
1. Review RLS policies
2. Ensure proper user context
3. Update policies if needed

#### "JWT expired"
**Error**: `JWT expired`
**Cause**: Session token has expired
**Solution**:
1. Implement automatic session refresh
2. Redirect to login page
3. Clear expired session data

#### "Email rate limit exceeded"
**Error**: `Email rate limit exceeded`
**Cause**: Supabase email rate limits
**Solution**:
1. Configure custom SMTP
2. Use development bypass
3. Implement rate limit handling

## Recovery Procedures

### 1. User Account Recovery

#### Reset User State
```typescript
// Reset user account state
const resetUserState = async (email: string) => {
  const supabase = await createSupabaseServerClient()
  
  // 1. Confirm email if needed
  const { error: confirmError } = await supabase.auth.admin.updateUserById(
    userId,
    { email_confirm: true }
  )
  
  // 2. Reset password
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email)
  
  // 3. Clear sessions
  const { error: signOutError } = await supabase.auth.admin.signOut(userId)
  
  console.log('User reset results:', {
    confirmError,
    resetError,
    signOutError,
  })
}
```

### 2. System Recovery

#### Clear Authentication Cache
```typescript
// Clear all authentication-related caches
const clearAuthCache = () => {
  // Clear localStorage
  Object.keys(localStorage)
    .filter(key => key.includes('supabase'))
    .forEach(key => localStorage.removeItem(key))
  
  // Clear sessionStorage
  Object.keys(sessionStorage)
    .filter(key => key.includes('supabase'))
    .forEach(key => sessionStorage.removeItem(key))
  
  // Clear cookies (if possible)
  document.cookie.split(';')
    .filter(cookie => cookie.includes('supabase'))
    .forEach(cookie => {
      const [name] = cookie.split('=')
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    })
  
  console.log('✅ Authentication cache cleared')
}
```

## Prevention Strategies

### 1. Proactive Monitoring

#### Authentication Health Monitor
```typescript
// Monitor authentication system health
const authHealthMonitor = {
  checkInterval: 60000, // 1 minute
  
  async check() {
    const checks = {
      environment: checkEnvVars(),
      database: await checkDatabaseHealth(),
      supabase: await checkSupabaseConnectivity(),
    }
    
    const allHealthy = Object.values(checks).every(Boolean)
    
    if (!allHealthy) {
      console.warn('Authentication health check failed:', checks)
      // Send alert or notification
    }
    
    return checks
  },
  
  start() {
    setInterval(() => this.check(), this.checkInterval)
  }
}
```

### 2. Error Handling

#### Comprehensive Error Handler
```typescript
// Centralized authentication error handler
const handleAuthError = (error: any, context: string) => {
  console.error(`Authentication error in ${context}:`, error)
  
  // Categorize error
  const errorType = categorizeError(error)
  
  switch (errorType) {
    case 'rate_limit':
      showRateLimitNotice()
      break
    case 'session_expired':
      redirectToLogin()
      break
    case 'email_not_confirmed':
      showEmailConfirmationPrompt()
      break
    case 'network_error':
      showNetworkErrorMessage()
      break
    default:
      showGenericErrorMessage()
  }
  
  // Log for debugging
  logError(error, context)
}

const categorizeError = (error: any): string => {
  const message = error.message?.toLowerCase() || ''
  
  if (message.includes('rate limit')) return 'rate_limit'
  if (message.includes('jwt') || message.includes('session')) return 'session_expired'
  if (message.includes('email') && message.includes('confirm')) return 'email_not_confirmed'
  if (message.includes('network') || message.includes('fetch')) return 'network_error'
  
  return 'unknown'
}
```

### 3. Testing Strategy

#### Authentication Test Suite
```typescript
// Comprehensive authentication tests
describe('Authentication System', () => {
  test('should handle email confirmation', async () => {
    const result = await testEmailConfirmation('test@example.com')
    expect(result.success).toBe(true)
  })
  
  test('should handle rate limits gracefully', async () => {
    const result = await testRateLimitHandling()
    expect(result.gracefulDegradation).toBe(true)
  })
  
  test('should maintain session persistence', async () => {
    const result = await testSessionPersistence()
    expect(result.persistent).toBe(true)
  })
  
  test('should handle network failures', async () => {
    const result = await testNetworkFailure()
    expect(result.recovered).toBe(true)
  })
})
```

## Support Resources

### 1. Log Collection

#### Authentication Logs
```typescript
// Collect authentication logs for support
const collectAuthLogs = () => {
  const logs = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    userAgent: navigator.userAgent,
    url: window.location.href,
    
    // Environment check
    envVars: checkEnvVars(),
    
    // Browser state
    localStorage: Object.keys(localStorage).filter(k => k.includes('supabase')),
    cookies: document.cookie.split(';').filter(c => c.includes('supabase')),
    
    // Recent errors
    recentErrors: getRecentErrors(),
    
    // System info
    systemInfo: {
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
    }
  }
  
  return logs
}
```

### 2. Contact Information

For additional support:
- **Documentation**: Review all authentication guides
- **GitHub Issues**: Create detailed issue reports
- **Supabase Support**: For Supabase-specific issues
- **Development Team**: Internal escalation path

## Conclusion

This troubleshooting guide covers the most common authentication issues and their solutions. Remember to:

1. **Check environment variables first** - Most issues are configuration-related
2. **Use diagnostic tools** - Leverage the provided scripts and checks
3. **Monitor proactively** - Implement health checks and monitoring
4. **Test thoroughly** - Use the test suite to catch issues early
5. **Document issues** - Keep detailed logs for future reference

When in doubt, start with the quick diagnostic tools and work through the solutions systematically. Most authentication issues can be resolved by following these procedures.