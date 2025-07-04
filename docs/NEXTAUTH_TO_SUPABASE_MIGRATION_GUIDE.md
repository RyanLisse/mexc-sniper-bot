# NextAuth to Supabase Migration Guide

## Overview

This guide documents the complete migration from NextAuth.js to Supabase authentication in the MEXC Sniper Bot project. The migration was implemented to provide better email handling, rate limit management, and modern authentication flows.

## Migration Timeline

- **Phase 1**: Supabase setup and basic authentication
- **Phase 2**: Email bypass implementation for development
- **Phase 3**: Rate limit handling and user experience improvements
- **Phase 4**: Production SMTP configuration
- **Phase 5**: Legacy cleanup and documentation

## Before vs After

### Before (NextAuth)
```typescript
// NextAuth configuration
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import GoogleProvider from 'next-auth/providers/google'

export default NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub,
      },
    }),
  },
})
```

### After (Supabase)
```typescript
// Supabase authentication provider
import { createSupabaseServerClient } from '@/src/lib/supabase-auth'
import { useSupabaseAuth } from '@/src/components/auth/supabase-auth-provider'

// Modern authentication with rate limit handling
const { user, session, signIn, signOut, isLoading } = useSupabaseAuth()
```

## Key Migration Changes

### 1. Authentication Provider Migration

#### Removed NextAuth Files
- `pages/api/auth/[...nextauth].ts` - NextAuth API routes
- `lib/nextauth.ts` - NextAuth configuration
- `providers/nextauth-provider.tsx` - NextAuth provider components

#### Added Supabase Files
- `lib/supabase-auth.ts` - Supabase server client
- `lib/supabase-browser-client.ts` - Supabase browser client
- `components/auth/supabase-auth-provider.tsx` - Supabase auth provider
- `components/auth/supabase-auth-ui.tsx` - Authentication UI components

### 2. Environment Variables Migration

#### Old NextAuth Variables
```bash
# Removed NextAuth variables
NEXTAUTH_URL=http://localhost:3008
NEXTAUTH_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

#### New Supabase Variables
```bash
# Added Supabase variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional SMTP configuration
SUPABASE_SMTP_HOST=smtp.resend.com
SUPABASE_SMTP_PORT=587
SUPABASE_SMTP_USER=resend
SUPABASE_SMTP_PASS=re_your-api-key
```

### 3. Database Schema Changes

#### User Table Migration
```sql
-- NextAuth user table structure
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  image TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Supabase auth.users table (managed by Supabase)
-- No custom user table needed for basic authentication
-- Custom user data stored in public.profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  trading_preferences JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4. Session Management Migration

#### Before (NextAuth)
```typescript
// NextAuth session handling
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/nextauth'

export async function getSession() {
  return await getServerSession(authOptions)
}

// Client-side session
import { useSession } from 'next-auth/react'
const { data: session, status } = useSession()
```

#### After (Supabase)
```typescript
// Supabase session handling
import { createSupabaseServerClient } from '@/src/lib/supabase-auth'

export async function getSession() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// Client-side session
import { useSupabaseAuth } from '@/src/components/auth/supabase-auth-provider'
const { user, session, isLoading } = useSupabaseAuth()
```

### 5. Authentication Flow Migration

#### Sign In Flow
```typescript
// Before (NextAuth)
import { signIn } from 'next-auth/react'
await signIn('google', { callbackUrl: '/dashboard' })

// After (Supabase)
import { useSupabaseAuth } from '@/src/components/auth/supabase-auth-provider'
const { signInWithProvider } = useSupabaseAuth()
await signInWithProvider('google')
```

#### Sign Out Flow
```typescript
// Before (NextAuth)
import { signOut } from 'next-auth/react'
await signOut({ callbackUrl: '/auth' })

// After (Supabase)
import { useSupabaseAuth } from '@/src/components/auth/supabase-auth-provider'
const { signOut } = useSupabaseAuth()
await signOut()
```

## Migration Steps

### Step 1: Supabase Project Setup
1. Create a new Supabase project at https://supabase.com
2. Configure authentication settings
3. Set up OAuth providers (Google, GitHub, etc.)
4. Configure email templates
5. Set up Row Level Security (RLS) policies

### Step 2: Install Supabase Dependencies
```bash
# Remove NextAuth dependencies
bun remove next-auth @next-auth/prisma-adapter

# Install Supabase dependencies
bun add @supabase/supabase-js @supabase/auth-helpers-nextjs
```

### Step 3: Environment Configuration
```bash
# Update .env.local with Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Step 4: Create Supabase Client Configuration
```typescript
// lib/supabase-auth.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}
```

### Step 5: Implement Authentication Provider
```typescript
// components/auth/supabase-auth-provider.tsx
export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <SupabaseAuthContext.Provider value={{ user, session, isLoading }}>
      {children}
    </SupabaseAuthContext.Provider>
  )
}
```

### Step 6: Create Authentication UI Components
```typescript
// components/auth/supabase-auth-ui.tsx
export function SupabaseAuthUI() {
  const { signIn, signUp, signInWithProvider } = useSupabaseAuth()

  return (
    <div className="auth-container">
      <form onSubmit={handleEmailSignIn}>
        <input type="email" placeholder="Email" />
        <input type="password" placeholder="Password" />
        <button type="submit">Sign In</button>
      </form>
      
      <button onClick={() => signInWithProvider('google')}>
        Sign in with Google
      </button>
      
      <button onClick={() => signInWithProvider('github')}>
        Sign in with GitHub
      </button>
    </div>
  )
}
```

### Step 7: Update API Routes
```typescript
// app/api/auth/callback/route.ts
import { createSupabaseServerClient } from '@/src/lib/supabase-auth'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      return NextResponse.redirect(new URL('/auth/error', request.url))
    }
  }

  return NextResponse.redirect(new URL('/dashboard', request.url))
}
```

### Step 8: Implement Rate Limit Handling
```typescript
// components/auth/rate-limit-notice.tsx
export function RateLimitNotice({ error, resetTime }: RateLimitNoticeProps) {
  const timeRemaining = resetTime - Date.now()
  
  return (
    <div className="rate-limit-notice">
      <h3>Rate Limit Reached</h3>
      <p>Please wait {Math.ceil(timeRemaining / 60000)} minutes before trying again.</p>
      {isDevelopment && (
        <button onClick={handleBypass}>
          Bypass for Development
        </button>
      )}
    </div>
  )
}
```

### Step 9: Update Middleware
```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  return response
}
```

### Step 10: Clean Up Legacy Code
```bash
# Remove NextAuth files
rm -rf pages/api/auth/[...nextauth].ts
rm -rf lib/nextauth.ts
rm -rf providers/nextauth-provider.tsx

# Remove NextAuth dependencies from package.json
# Update import statements throughout the codebase
```

## Testing the Migration

### 1. Authentication Flow Testing
```bash
# Test sign up flow
curl -X POST "http://localhost:3008/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test sign in flow
curl -X POST "http://localhost:3008/api/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 2. Rate Limit Testing
```bash
# Test rate limit bypass
curl -X POST "http://localhost:3008/api/admin/bypass-email-confirmation" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### 3. Session Management Testing
```typescript
// Test session persistence
const { user, session } = useSupabaseAuth()
console.log('User:', user)
console.log('Session:', session)
```

## Migration Benefits

### 1. Improved Email Handling
- Custom SMTP configuration
- Rate limit bypass for development
- Better email delivery reliability

### 2. Enhanced User Experience
- Rate limit notifications
- Automatic retry mechanisms
- Better error handling

### 3. Modern Authentication Stack
- Real-time session management
- Better TypeScript support
- Improved security features

### 4. Development Productivity
- Email bypass for testing
- Better development tools
- Simplified configuration

## Post-Migration Tasks

### 1. Database Cleanup
```sql
-- Remove NextAuth tables if no longer needed
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS verification_tokens;
```

### 2. Environment Cleanup
```bash
# Remove old NextAuth environment variables
# Update deployment configurations
# Update CI/CD pipelines
```

### 3. Documentation Updates
- Update README.md with new auth instructions
- Update API documentation
- Update deployment guides

## Troubleshooting

### Common Issues During Migration

#### 1. "Invalid JWT" Errors
**Cause**: Mixing NextAuth and Supabase sessions
**Solution**: Clear browser cookies and localStorage

#### 2. "User not found" Errors
**Cause**: User data not migrated properly
**Solution**: Verify user data migration and RLS policies

#### 3. Rate Limit Issues
**Cause**: Supabase email rate limits
**Solution**: Implement custom SMTP or use bypass for development

#### 4. OAuth Redirect Issues
**Cause**: Incorrect redirect URLs
**Solution**: Update OAuth provider configurations

## Best Practices

### 1. Environment Management
- Use separate Supabase projects for dev/staging/prod
- Implement proper environment variable validation
- Use secure environment variable storage

### 2. Security Considerations
- Implement proper RLS policies
- Use environment detection for development features
- Regularly rotate API keys and secrets

### 3. Performance Optimization
- Implement proper session caching
- Use connection pooling for database operations
- Optimize authentication flows

### 4. Testing Strategy
- Test all authentication flows
- Implement comprehensive E2E tests
- Test rate limit scenarios

## Conclusion

The migration from NextAuth to Supabase provides a more robust, scalable, and developer-friendly authentication solution. The new system offers better email handling, rate limit management, and modern authentication flows that align with the project's requirements.

Key improvements include:
- Eliminated email rate limit issues with custom SMTP
- Improved developer experience with bypass mechanisms
- Better user experience with rate limit notifications
- Modern authentication stack with real-time capabilities
- Comprehensive documentation and troubleshooting guides

The migration is complete and the system is ready for production use with proper SMTP configuration.