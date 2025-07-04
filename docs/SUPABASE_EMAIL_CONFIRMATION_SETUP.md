# Supabase Email Confirmation Setup Guide

This guide explains how to configure Supabase to bypass email confirmation for testing and development.

## Quick Fixes Summary

### 1. **Environment Variables** ✅ FIXED
Updated `.env.local` with proper Supabase keys:
- `SUPABASE_ANON_KEY`: Updated with valid key
- `SUPABASE_SERVICE_ROLE_KEY`: Updated with valid service role key

### 2. **Test User Creation** ✅ ALREADY CONFIGURED
The `/api/test-users` endpoint already bypasses email confirmation:
```typescript
email_confirm: true, // Skip email confirmation for test users
```

### 3. **Utilities Created** ✅ NEW
Created scripts for managing email confirmation:
- `scripts/bypass-email-confirmation.ts`
- `scripts/test-auth-verification.ts`

### 4. **Makefile Commands** ✅ NEW
Added convenient commands:
```bash
make auth-verify                # Verify auth setup
make auth-bypass-email EMAIL=user@example.com  # Bypass specific user
make auth-bypass-all            # Bypass all unconfirmed users
make auth-check-status          # Check status
make auth-setup-testing         # Complete setup
```

## Supabase Dashboard Configuration

### Option 1: Disable Email Confirmation (Recommended for Development)

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**: `wisobxvkyjzlvhipctrl`
3. **Navigate to**: Authentication > Settings
4. **Find**: "Confirm email" toggle
5. **Disable**: Turn OFF email confirmation
6. **Save**: Click "Save"

### Option 2: Configure Email Templates (For Production)

If you need email confirmation in production but want to bypass in development:

1. **Go to**: Authentication > Email Templates
2. **Configure**: Confirmation email template
3. **Set**: Custom redirect URLs for development

### Option 3: Environment-Specific Settings

Use different Supabase projects for development and production:

```bash
# Development (.env.local)
SUPABASE_URL="https://wisobxvkyjzlvhipctrl.supabase.co"  # Dev project
SUPABASE_ANON_KEY="your-dev-anon-key"

# Production (.env.production)
SUPABASE_URL="https://your-prod-project.supabase.co"     # Prod project
SUPABASE_ANON_KEY="your-prod-anon-key"
```

## Testing Your Setup

### Step 1: Verify Configuration
```bash
make auth-verify
```

### Step 2: Check Current Status
```bash
make auth-check-status
```

### Step 3: Bypass Email for Test User
```bash
make auth-bypass-email EMAIL=ryan@ryanlisse.com
```

### Step 4: Complete Setup
```bash
make auth-setup-testing
```

## Troubleshooting

### Common Issues

#### 1. "placeholder_service_role_key" Error
**Problem**: Service role key is still placeholder
**Solution**: Update `.env.local` with actual service role key from Supabase dashboard

#### 2. "User creation failed" Error
**Problem**: Service role key doesn't have admin permissions
**Solution**: Verify you're using the service role key (not anon key)

#### 3. "Email already registered" Error
**Problem**: User already exists but email not confirmed
**Solution**: Use bypass script to confirm existing user:
```bash
make auth-bypass-email EMAIL=existing@user.com
```

#### 4. "Network request failed" Error
**Problem**: Supabase connection issues
**Solution**: Check network and project status

### Manual Verification

You can manually check user status in Supabase Dashboard:
1. Go to Authentication > Users
2. Find your test user
3. Check "Email Confirmed" column
4. If "No", click user → "Send email confirmation" or use scripts

## Security Notes

⚠️ **Important**: Only bypass email confirmation in development/testing environments.

### Safe Practices:
- Use separate Supabase projects for dev/prod
- Never disable email confirmation in production
- Use environment variables to control behavior
- Regularly audit user accounts

### Environment Detection:
The system automatically detects test environments:
```typescript
const isTestEnvironment = 
  process.env.NODE_ENV === 'test' ||
  process.env.PLAYWRIGHT_TEST === 'true' ||
  request.headers.get('x-test-environment')
```

## Usage Examples

### Create Test User with Bypass
```bash
# Create new test user
make auth-create-test-user EMAIL=newuser@test.com

# Or use script directly
bun run scripts/bypass-email-confirmation.ts --create-test-user --email newuser@test.com
```

### Confirm Existing User
```bash
# Confirm specific user
bun run scripts/bypass-email-confirmation.ts --email user@example.com

# Confirm all unconfirmed users
bun run scripts/bypass-email-confirmation.ts --confirm-all
```

### Check Status
```bash
# Check all users
bun run scripts/bypass-email-confirmation.ts --check-status

# Check specific user
bun run scripts/bypass-email-confirmation.ts --check-status --email user@example.com
```

## Integration with Tests

### Playwright Tests
```typescript
// In test setup
await fetch('/api/test-users', {
  method: 'POST',
  headers: { 'x-test-environment': 'true' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'Testing2025!'
  })
});
```

### Unit Tests
```typescript
// Mock bypassed confirmation
const mockUser = {
  email_confirmed_at: '2024-01-01T00:00:00Z',
  email: 'test@example.com'
};
```

## Next Steps

1. **Run verification**: `make auth-verify`
2. **Fix any failing tests**: Follow error messages
3. **Test authentication flow**: Visit `/auth` page
4. **Update Supabase dashboard**: Disable email confirmation for dev
5. **Document team setup**: Share this guide with team

## Support

If you encounter issues:
1. Check Supabase dashboard for project status
2. Verify environment variables
3. Run diagnostic scripts
4. Check network connectivity
5. Review Supabase logs in dashboard