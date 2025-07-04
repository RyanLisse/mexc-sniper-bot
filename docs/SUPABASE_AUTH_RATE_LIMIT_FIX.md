# Supabase Auth Rate Limit Fix

## Issue Analysis

The authentication system is failing due to Supabase's strict rate limits:
- **Email Signup/Recovery**: 2 emails per hour (very restrictive)
- **Email Verification**: Limited verification requests
- **Rate limiting** causing authentication failures during development

## Solutions Implemented

### 1. Email Bypass for Development

**File**: `/scripts/bypass-email-confirmation.ts`
- Bypass email confirmation for test users
- Use service role key to directly confirm users
- Only works in development environment

**Usage**:
```bash
bun run scripts/bypass-email-confirmation.ts --email ryan@ryanlisse.com
```

### 2. API Endpoint for Email Bypass

**File**: `/app/api/admin/bypass-email-confirmation/route.ts`
- HTTP API to bypass email confirmation
- POST endpoint with email parameter
- Development environment only

**Usage**:
```bash
curl -X POST "http://localhost:3008/api/admin/bypass-email-confirmation" \
  -H "Content-Type: application/json" \
  -d '{"email":"ryan@ryanlisse.com"}'
```

### 3. Environment Configuration Cleanup

**Updated**: `/src/config/environment/variables.ts`
- Removed NextAuth references
- Added SMTP configuration variables
- Prepared for custom email provider

### 4. Rate Limit Workarounds

#### Option A: Custom SMTP (Recommended)
Configure custom SMTP in Supabase dashboard:
1. Go to Authentication > Settings > SMTP Settings
2. Configure custom provider (Resend, SendGrid, etc.)
3. This bypasses Supabase's 2 emails/hour limit

#### Option B: Development Bypass
Use our email confirmation bypass tools during development:
```bash
# Create test user with confirmed email
bun run scripts/bypass-email-confirmation.ts --create-test-user --email test@example.com

# Bypass existing user
bun run scripts/bypass-email-confirmation.ts --email ryan@ryanlisse.com
```

## Next Steps

### 1. Configure Custom SMTP
```bash
# Add to .env.local
SUPABASE_SMTP_HOST=smtp.resend.com
SUPABASE_SMTP_PORT=587
SUPABASE_SMTP_USER=resend
SUPABASE_SMTP_PASS=re_your-api-key
```

### 2. Update Supabase Dashboard
1. Visit: https://supabase.com/dashboard/project/wisobxvkyjzlvhipctrl/auth/settings
2. Configure SMTP settings
3. Enable custom email provider

### 3. Test Authentication Flow
```bash
# Start dev server
make dev

# Test bypass API
curl -X POST "http://localhost:3008/api/admin/bypass-email-confirmation" \
  -H "Content-Type: application/json" \
  -d '{"email":"ryan@ryanlisse.com"}'

# Test login at http://localhost:3008/auth
```

## Rate Limit Reference

From Supabase docs:
- **Email endpoints**: 2 emails/hour (signup, recover)
- **OTP endpoints**: 360/hour
- **Verification**: 360/hour
- **Token refresh**: 1800/hour
- **MFA challenges**: 15/minute
- **Anonymous sign-ins**: 30/hour

## Production Considerations

1. **Custom SMTP Required**: Supabase's email limits are too restrictive for production
2. **Rate Limit Monitoring**: Implement client-side rate limit handling
3. **Graceful Degradation**: Show appropriate messages when rate limited
4. **Email Provider**: Use Resend, SendGrid, or similar for reliable email delivery

## Files Modified

- ✅ `/src/config/environment/variables.ts` - Removed NextAuth references
- ✅ `/scripts/bypass-email-confirmation.ts` - Email bypass utility
- ✅ `/app/api/admin/bypass-email-confirmation/route.ts` - API endpoint
- ✅ `/docs/SUPABASE_AUTH_RATE_LIMIT_FIX.md` - This documentation

## Testing Status

- ✅ Email bypass scripts working
- ✅ API endpoint functional
- ✅ Development server stable
- ✅ Rate limit detection and handling implemented
- ✅ User experience improvements for rate limit scenarios
- ⚠️ Need custom SMTP configuration for production-ready email
- ⚠️ Rate limit mitigation needed for high-volume testing

## Rate Limit Handling System

### Client-Side Rate Limit Detection
The system now includes intelligent rate limit detection in the authentication components:

**File**: `/src/components/auth/rate-limit-notice.tsx`
- Displays user-friendly rate limit messages
- Shows remaining time until rate limit resets
- Provides bypass options for development
- Automatically detects rate limit responses

### User Experience Improvements
- **Rate Limit Notice**: Clear messaging when rate limits are hit
- **Bypass Options**: Development-only bypass for testing
- **Retry Logic**: Automatic retry with exponential backoff
- **Status Indicators**: Visual feedback for authentication states

### Production Rate Limit Mitigation
```typescript
// Rate limit handling in auth provider
const handleRateLimit = (error: any) => {
  if (error.message?.includes('rate limit')) {
    // Show rate limit notice
    setRateLimitNotice(true);
    // Calculate reset time
    const resetTime = calculateResetTime(error);
    setRateLimitResetTime(resetTime);
  }
};
```

## SMTP Configuration for Production

### Recommended SMTP Providers

#### 1. Resend (Recommended)
```bash
# Add to .env.local
SUPABASE_SMTP_HOST=smtp.resend.com
SUPABASE_SMTP_PORT=587
SUPABASE_SMTP_USER=resend
SUPABASE_SMTP_PASS=re_your-api-key
```

#### 2. SendGrid
```bash
# Add to .env.local
SUPABASE_SMTP_HOST=smtp.sendgrid.net
SUPABASE_SMTP_PORT=587
SUPABASE_SMTP_USER=apikey
SUPABASE_SMTP_PASS=your-sendgrid-api-key
```

#### 3. Mailgun
```bash
# Add to .env.local
SUPABASE_SMTP_HOST=smtp.mailgun.org
SUPABASE_SMTP_PORT=587
SUPABASE_SMTP_USER=postmaster@your-domain.mailgun.org
SUPABASE_SMTP_PASS=your-mailgun-password
```

### Supabase Dashboard Configuration
1. Navigate to Authentication > Settings > SMTP Settings
2. Enable "Enable custom SMTP"
3. Configure your SMTP provider details
4. Set up email templates if needed
5. Test the configuration

## Advanced Configuration

### Environment-Based Email Handling
```typescript
// Different email strategies per environment
const emailStrategy = {
  development: 'bypass', // Use bypass for development
  staging: 'custom-smtp', // Use custom SMTP for staging
  production: 'custom-smtp' // Use custom SMTP for production
};
```

### Rate Limit Monitoring
```typescript
// Track rate limit usage
const rateLimitMonitor = {
  emailsSent: 0,
  lastReset: new Date(),
  remainingEmails: 2,
  resetInterval: 3600000 // 1 hour
};
```

## Troubleshooting Common Issues

### 1. "Rate limit exceeded" Error
**Cause**: Too many email requests in short timeframe
**Solution**: 
- Use custom SMTP provider
- Implement email bypass for development
- Add rate limit handling in frontend

### 2. "Invalid SMTP credentials" Error
**Cause**: Incorrect SMTP configuration
**Solution**:
- Verify SMTP provider credentials
- Check Supabase dashboard SMTP settings
- Test SMTP connection independently

### 3. "Email not received" Issue
**Cause**: Email delivery problems
**Solution**:
- Check spam/junk folders
- Verify email templates
- Test with different email providers
- Use email bypass for development

## Developer Workflow

### 1. Development Setup
```bash
# Use email bypass for development
make auth-bypass-email EMAIL=test@example.com
```

### 2. Testing Authentication
```bash
# Test auth flow with bypass
curl -X POST "http://localhost:3008/api/admin/bypass-email-confirmation" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### 3. Production Deployment
```bash
# Ensure SMTP is configured
# Deploy with custom SMTP settings
vercel --prod
```

## Monitoring and Maintenance

### Rate Limit Monitoring
- Monitor Supabase auth dashboard for rate limit metrics
- Set up alerts for rate limit breaches
- Track email delivery success rates

### Performance Metrics
- Authentication success rate
- Email delivery time
- Rate limit reset frequency
- User experience impact

## Security Considerations

### Email Bypass Security
- Only enable bypass in development/testing
- Use environment detection for bypass activation
- Never expose bypass endpoints in production
- Implement proper access controls

### SMTP Security
- Use secure SMTP connections (TLS/SSL)
- Rotate SMTP credentials regularly
- Monitor for suspicious email activity
- Implement email rate limiting on SMTP provider side