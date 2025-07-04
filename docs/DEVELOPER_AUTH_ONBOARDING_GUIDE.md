# Developer Onboarding Guide - Supabase Authentication

## Welcome to MEXC Sniper Bot Authentication System

This guide will get you up and running with the Supabase authentication system in under 30 minutes. Follow these steps to set up your development environment and understand the authentication architecture.

## Quick Start Checklist

- [ ] Clone repository and install dependencies
- [ ] Set up Supabase project and get credentials
- [ ] Configure environment variables
- [ ] Set up email bypass for development
- [ ] Test authentication flow
- [ ] Understand architecture and patterns
- [ ] Review security guidelines

## Prerequisites

### Required Tools
- **Node.js 20.11+** (check with `node --version`)
- **Bun** (preferred) or npm package manager
- **Git** for version control
- **Modern browser** (Chrome, Firefox, Safari, Edge)

### Required Accounts
- **Supabase Account** (free tier sufficient)
- **Email Provider** (Gmail, Outlook, etc. for testing)
- **GitHub Account** (for OAuth testing, optional)

## Step 1: Repository Setup (5 minutes)

### Clone and Install
```bash
# Clone the repository
git clone https://github.com/your-org/mexc-sniper-bot.git
cd mexc-sniper-bot

# Install dependencies with Bun (recommended)
bun install

# Or with npm if you prefer
npm install
```

### Verify Installation
```bash
# Check if everything installed correctly
bun run type-check
bun run lint

# Should see no errors
```

## Step 2: Supabase Project Setup (10 minutes)

### Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Choose organization (create one if needed)
5. Fill in project details:
   - **Name**: `mexc-sniper-bot-dev` (or similar)
   - **Database Password**: Generate strong password
   - **Region**: Choose closest to your location
6. Click "Create new project"
7. Wait for project to be ready (2-3 minutes)

### Get Project Credentials
1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (starts with `https://`)
   - **Anon (public) key** (starts with `eyJ`)
   - **Service role key** (starts with `eyJ`, different from anon key)

### Configure Authentication Settings
1. Go to **Authentication** → **Settings**
2. **Site URL**: Set to `http://localhost:3008`
3. **Redirect URLs**: Add `http://localhost:3008/auth/callback`
4. **Email Confirmation**: Keep enabled for now (we'll bypass in development)

## Step 3: Environment Configuration (5 minutes)

### Create Environment File
Create a `.env.local` file in the project root:

```bash
# Copy example environment file
cp .env.example .env.local
```

### Configure Supabase Credentials
Add your Supabase credentials to `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Development Configuration
NODE_ENV=development
DEBUG=true

# Optional: MEXC API (for full functionality)
MEXC_API_KEY=your-mexc-api-key
MEXC_SECRET_KEY=your-mexc-secret-key

# Optional: OpenAI (for AI features)
OPENAI_API_KEY=your-openai-api-key
```

### Validate Environment
```bash
# Check if environment variables are loaded correctly
bun run scripts/validate-auth-environment.ts

# Should show all green checkmarks
```

## Step 4: Database Setup (3 minutes)

### Run Database Migrations
```bash
# Initialize database with required tables
bun run db:migrate

# Verify database setup
bun run db:studio
# Opens Drizzle Studio at http://localhost:3007
```

### Verify Database Connection
```bash
# Test database connectivity
bun run scripts/test-database-connection.ts

# Should show successful connection
```

## Step 5: Development Environment (5 minutes)

### Start Development Servers
```bash
# Terminal 1: Start Next.js development server
bun run dev

# Terminal 2: Start Inngest development server (optional)
bun run dev:inngest
```

### Verify Servers
- **Main App**: http://localhost:3008
- **Inngest Dashboard**: http://localhost:8288 (if running)

### Test Basic Functionality
1. Open http://localhost:3008
2. Navigate to `/auth` page
3. Should see authentication form
4. Try creating an account (email confirmation will be needed)

## Step 6: Email Bypass Setup (Development Only)

### Understanding Email Bypass
During development, Supabase's email rate limits (2 emails/hour) can be problematic. We've implemented bypass mechanisms for development.

### Set Up Email Bypass
```bash
# Test email bypass functionality
curl -X POST "http://localhost:3008/api/admin/bypass-email-confirmation-demo" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Should return success response
```

### Create Test User with Bypass
```bash
# Create and confirm test user
bun run scripts/bypass-email-confirmation.ts \
  --create-test-user \
  --email developer@example.com \
  --password Testing2025!
```

### Test Authentication Flow
1. Go to http://localhost:3008/auth
2. Try signing up with `developer@example.com`
3. Use the bypass API to confirm the email
4. Sign in and verify you reach the dashboard

## Step 7: Understanding the Architecture

### Authentication Flow
```
User Registration/Login
          ↓
    Supabase Auth
          ↓
   Email Confirmation
          ↓
     Session Creation
          ↓
    Dashboard Access
```

### Key Components

#### 1. Authentication Provider
**File**: `src/components/auth/supabase-auth-provider.tsx`
- Manages authentication state
- Handles session persistence
- Provides auth context to components

#### 2. Auth UI Components
**File**: `src/components/auth/supabase-auth-ui.tsx`
- Sign in/up forms
- OAuth provider buttons
- Error handling and validation

#### 3. Server-Side Auth
**File**: `src/lib/supabase-auth.ts`
- Server-side Supabase client
- Session validation
- Protected route handling

#### 4. Client-Side Auth
**File**: `src/lib/supabase-browser-client.ts`
- Browser-only Supabase client
- Real-time session updates
- Client-side authentication actions

### Authentication Hooks

#### useSupabaseAuth Hook
```typescript
import { useSupabaseAuth } from '@/src/components/auth/supabase-auth-provider'

function MyComponent() {
  const { 
    user,           // Current user object
    session,        // Current session
    isLoading,      // Loading state
    signIn,         // Sign in function
    signOut,        // Sign out function
    signUp          // Sign up function
  } = useSupabaseAuth()
  
  if (isLoading) return <div>Loading...</div>
  if (!user) return <div>Please sign in</div>
  
  return <div>Welcome, {user.email}!</div>
}
```

#### Server-Side Session
```typescript
import { createSupabaseServerClient } from '@/src/lib/supabase-auth'

export async function getServerSideProps() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return { redirect: { destination: '/auth', permanent: false } }
  }
  
  return { props: { user: session.user } }
}
```

## Step 8: Development Workflows

### Daily Development
```bash
# Start development environment
make dev

# Run tests while developing
bun run test:watch

# Check code quality
bun run lint
bun run type-check
```

### Creating New Authentication Features
1. **Understand the pattern**: Review existing components
2. **Use hooks**: Leverage `useSupabaseAuth` for state
3. **Handle errors**: Implement proper error handling
4. **Test thoroughly**: Write tests for new functionality
5. **Document changes**: Update relevant documentation

### Testing Authentication
```bash
# Run authentication-specific tests
bun run test src/components/auth/
bun run test src/lib/supabase-auth.test.ts

# Run E2E authentication tests
bun run test:e2e tests/e2e/auth-flow.spec.ts
```

## Step 9: Common Development Patterns

### Protected Routes
```typescript
// app/dashboard/page.tsx
import { createSupabaseServerClient } from '@/src/lib/supabase-auth'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    redirect('/auth')
  }
  
  return <div>Protected Dashboard Content</div>
}
```

### API Route Protection
```typescript
// app/api/protected/route.ts
import { createSupabaseServerClient } from '@/src/lib/supabase-auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (!session || error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Protected logic here
  return NextResponse.json({ data: 'Protected data' })
}
```

### Client-Side Protection
```typescript
// components/protected-component.tsx
import { useSupabaseAuth } from '@/src/components/auth/supabase-auth-provider'

export function ProtectedComponent() {
  const { user, isLoading } = useSupabaseAuth()
  
  if (isLoading) return <div>Loading...</div>
  
  if (!user) {
    return (
      <div>
        <p>Please sign in to access this content</p>
        <a href="/auth">Sign In</a>
      </div>
    )
  }
  
  return <div>Protected content for {user.email}</div>
}
```

## Step 10: Development Tools

### Useful Commands
```bash
# Authentication debugging
bun run scripts/debug-auth.ts --email user@example.com

# Clear authentication cache
bun run scripts/clear-auth-cache.ts

# Test email bypass
bun run scripts/test-email-bypass.ts

# Validate environment
bun run scripts/validate-environment.ts
```

### Browser Development Tools
1. **Application Tab**: Check localStorage and cookies for Supabase data
2. **Network Tab**: Monitor auth requests
3. **Console**: Check for auth-related errors

### Supabase Dashboard Tools
1. **Authentication**: View users and sessions
2. **Logs**: Debug authentication issues
3. **SQL Editor**: Query user data directly

## Step 11: Testing Your Setup

### Comprehensive Test
```bash
# Run the complete test suite
bun run test:auth-complete

# This will test:
# - Environment configuration
# - Database connectivity
# - Email bypass functionality
# - Authentication flows
# - Session management
```

### Manual Testing Checklist
- [ ] Sign up with new email
- [ ] Use email bypass to confirm account
- [ ] Sign in successfully
- [ ] Navigate to dashboard
- [ ] Sign out
- [ ] Sign in again
- [ ] Test with different browsers
- [ ] Test OAuth providers (if configured)

## Troubleshooting

### Common Issues

#### "Supabase client not initialized"
**Solution**: Check environment variables are loaded correctly
```bash
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
```

#### "Email not confirmed" Error
**Solution**: Use email bypass for development
```bash
bun run scripts/bypass-email-confirmation.ts --email your-email@example.com
```

#### "Rate limit exceeded"
**Solution**: Wait an hour or use different email address

#### Database Connection Issues
**Solution**: Check database URL and restart development server

### Getting Help
1. **Check logs**: Look in browser console and terminal
2. **Review documentation**: Check other auth guides
3. **Use diagnostic tools**: Run validation scripts
4. **Ask team**: Create issue or ask in team chat

## Security Guidelines

### Development Security
- ✅ Use `.env.local` for sensitive data
- ✅ Never commit credentials to git
- ✅ Use email bypass only in development
- ✅ Rotate credentials regularly
- ❌ Don't use production credentials in development
- ❌ Don't share credentials in chat/email

### Code Security
- ✅ Validate user input
- ✅ Use proper error handling
- ✅ Implement rate limiting
- ✅ Follow principle of least privilege
- ❌ Don't log sensitive data
- ❌ Don't expose internal errors to users

## Next Steps

### After Successful Setup
1. **Explore codebase**: Understand existing patterns
2. **Read documentation**: Review other guides
3. **Start contributing**: Pick up development tasks
4. **Learn advanced features**: Dive deeper into Supabase

### Recommended Reading
- [SMTP Configuration Guide](SMTP_CONFIGURATION_GUIDE.md)
- [Authentication Troubleshooting](AUTH_TROUBLESHOOTING_GUIDE.md)
- [Migration Guide](NEXTAUTH_TO_SUPABASE_MIGRATION_GUIDE.md)
- [Rate Limit Fix Guide](SUPABASE_AUTH_RATE_LIMIT_FIX.md)

### Development Workflow
```bash
# Daily startup
make dev

# Before committing
bun run lint
bun run type-check
bun run test

# Before creating PR
bun run test:all
bun run build
```

## Conclusion

You should now have a fully functional development environment with:
- ✅ Supabase authentication configured
- ✅ Email bypass working for development
- ✅ Database connected and migrated
- ✅ Development servers running
- ✅ Tests passing
- ✅ Understanding of architecture

**Welcome to the team! You're ready to start developing with the MEXC Sniper Bot authentication system.**

## Quick Reference

### Essential URLs
- **Development App**: http://localhost:3008
- **Auth Page**: http://localhost:3008/auth
- **Dashboard**: http://localhost:3008/dashboard
- **Database Studio**: http://localhost:3007
- **Supabase Dashboard**: https://supabase.com/dashboard

### Key Files
- `src/components/auth/supabase-auth-provider.tsx` - Auth context
- `src/lib/supabase-auth.ts` - Server-side client
- `src/lib/supabase-browser-client.ts` - Client-side client
- `app/api/auth/callback/route.ts` - Auth callback handler
- `.env.local` - Environment configuration

### Essential Commands
```bash
bun run dev                    # Start development
bun run test:auth             # Test authentication
bun run scripts/bypass-email  # Bypass email confirmation
make auth-verify              # Verify auth setup
```

Happy coding! 🚀