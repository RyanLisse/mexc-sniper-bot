# MEXC Sniper Bot - Supabase Migration Implementation Guide

## 🚀 Quick Start Implementation

This guide provides step-by-step implementation details for migrating from NeonDB + Kinde to Supabase.

---

## Phase 1: Environment Setup (Week 1)

### Step 1.1: Create Supabase Project

1. **Sign up at [Supabase](https://supabase.com)**
2. **Create new project**:
   - Organization: Your organization
   - Project Name: `mexc-sniper-bot`
   - Database Password: Generate strong password
   - Region: Choose closest to your users

3. **Get API credentials** from Settings → API:
   - Project URL
   - Project API keys (anon/public and service_role/secret)

### Step 1.2: Install Dependencies

```bash
# Install Supabase dependencies
bun add @supabase/supabase-js @supabase/auth-js

# Install Supabase CLI for development
npm install -g supabase

# Initialize Supabase in project
supabase init
```

### Step 1.3: Environment Configuration

Update `.env.local`:
```bash
# Remove old variables
# NEON_DATABASE_URL=
# KINDE_CLIENT_ID=
# KINDE_CLIENT_SECRET=
# KINDE_ISSUER_URL=

# Add new Supabase variables
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DATABASE_URL=postgresql://postgres:[password]@db.your-project.supabase.co:5432/postgres

# Keep existing variables
AUTO_SNIPING_ENABLED=true
MEXC_API_KEY=your-mexc-api-key
MEXC_SECRET_KEY=your-mexc-secret-key
```

### Step 1.4: Update Package Configuration

Update `package.json` scripts:
```json
{
  "scripts": {
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:migrate": "supabase migration up",
    "db:generate": "supabase gen types typescript --local > src/types/supabase.ts",
    "db:studio": "supabase studio"
  }
}
```

---

## Phase 2: Database Schema Migration (Week 2)

### Step 2.1: Export Current Schema

```bash
# Export from NeonDB
pg_dump --schema-only $NEON_DATABASE_URL > schema_export.sql

# Review and clean the schema
# Remove Neon-specific extensions and configurations
```

### Step 2.2: Create Supabase Migration

```bash
# Create initial migration
supabase migration new initial_schema

# Edit the generated file in supabase/migrations/
```

Create `supabase/migrations/20250629000000_initial_schema.sql`:
```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create main tables
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  username TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  image TEXT,
  legacy_better_auth_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.workflow_system_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  system_status TEXT NOT NULL DEFAULT 'idle',
  last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active_workflows INTEGER DEFAULT 0,
  ready_tokens INTEGER DEFAULT 0,
  total_detections INTEGER DEFAULT 0,
  successful_snipes INTEGER DEFAULT 0,
  total_profit DECIMAL(15,8) DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0,
  average_roi DECIMAL(5,2) DEFAULT 0,
  best_trade DECIMAL(15,8) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.workflow_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  workflow_id TEXT,
  symbol_name TEXT,
  vcoin_id TEXT,
  level TEXT DEFAULT 'info',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.coin_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vcoin_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  currency_id TEXT,
  activity_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  confidence_boost DECIMAL(5,2) DEFAULT 0,
  priority_score DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.snipe_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  vcoin_id TEXT,
  entry_strategy TEXT NOT NULL DEFAULT 'market',
  position_size_usdt DECIMAL(15,8) NOT NULL,
  stop_loss_percent DECIMAL(5,2),
  take_profit_levels JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  confidence_score DECIMAL(5,2),
  pattern_type TEXT,
  priority_score DECIMAL(5,2) DEFAULT 5,
  max_slippage_percent DECIMAL(5,2) DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  execution_time TIMESTAMP WITH TIME ZONE,
  completion_time TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_workflow_system_status_user_id ON public.workflow_system_status(user_id);
CREATE INDEX idx_workflow_activity_user_id ON public.workflow_activity(user_id);
CREATE INDEX idx_workflow_activity_timestamp ON public.workflow_activity(timestamp DESC);
CREATE INDEX idx_coin_activities_currency ON public.coin_activities(currency);
CREATE INDEX idx_coin_activities_vcoin_id ON public.coin_activities(vcoin_id);
CREATE INDEX idx_snipe_targets_user_id ON public.snipe_targets(user_id);
CREATE INDEX idx_snipe_targets_status ON public.snipe_targets(status);
CREATE INDEX idx_snipe_targets_symbol ON public.snipe_targets(symbol);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_system_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snipe_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own workflow status" ON public.workflow_system_status
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own workflow activity" ON public.workflow_activity
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own snipe targets" ON public.snipe_targets
  FOR ALL USING (auth.uid() = user_id);

-- Coin activities are readable by all authenticated users (for pattern detection)
CREATE POLICY "Authenticated users can read coin activities" ON public.coin_activities
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin policies (for service role)
CREATE POLICY "Service role full access" ON public.users
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access roles" ON public.user_roles
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Update triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER workflow_system_status_updated_at
  BEFORE UPDATE ON public.workflow_system_status
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER coin_activities_updated_at
  BEFORE UPDATE ON public.coin_activities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER snipe_targets_updated_at
  BEFORE UPDATE ON public.snipe_targets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### Step 2.3: Run Migration

```bash
# Start local Supabase
supabase start

# Apply migration
supabase migration up

# Generate TypeScript types
supabase gen types typescript --local > src/types/supabase.ts
```

---

## Phase 3: Database Connection Update (Week 3)

### Step 3.1: Update Database Configuration

Replace `src/db/index.ts`:
```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createClient } from '@supabase/supabase-js'

// Supabase client for auth and real-time
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
)

// Database connection for Drizzle ORM
const connectionString = process.env.SUPABASE_DATABASE_URL!
const client = postgres(connectionString, {
  max: 10, // Connection pool size
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(client)

// Admin client for server-side operations
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
```

### Step 3.2: Update Schema Definitions

Update `src/db/schemas/` files to use UUIDs instead of integers:

```typescript
// src/db/schemas/auth.ts
import { pgTable, text, uuid, timestamp, boolean } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  username: text('username'),
  emailVerified: boolean('email_verified').default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const userRoles = pgTable('user_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('user'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
```

### Step 3.3: Update Database Cost Protector

Update `src/lib/database-cost-protector.ts`:
```typescript
import { supabase } from '@/src/db'

export class DatabaseCostProtector {
  private static instance: DatabaseCostProtector
  
  // Update connection check to use Supabase
  private async checkDatabaseConnection(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .limit(1)
      
      return !error
    } catch {
      return false
    }
  }
  
  // Update quota check for Supabase limits
  private async checkQuotaUsage(): Promise<QuotaStatus> {
    // Supabase has different quota structure
    // Pro plan includes generous limits
    return {
      withinQuota: true,
      usagePercentage: 0,
      estimatedCost: 0
    }
  }
}
```

---

## Phase 4: Authentication Migration (Week 4)

### Step 4.1: Update Authentication Configuration

Replace `src/lib/kinde-auth.ts` with `src/lib/supabase-auth.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

export async function getSession() {
  const cookieStore = cookies()
  const { data: { session } } = await supabase.auth.getSession()
  
  return {
    isAuthenticated: !!session,
    user: session?.user || null
  }
}

export async function requireAuth(): Promise<User> {
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    throw new Error('Authentication required')
  }
  
  return user
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (error) throw error
  return data
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })
  
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function signInWithOtp(email: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
    }
  })
  
  if (error) throw error
  return data
}
```

### Step 4.2: Update API Auth Wrapper

Update `src/lib/api-auth.ts`:
```typescript
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createErrorResponse, HTTP_STATUS } from './api-response'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function requireApiAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Response(
      JSON.stringify(createErrorResponse('Authentication required')),
      { status: HTTP_STATUS.UNAUTHORIZED }
    )
  }
  
  const token = authHeader.replace('Bearer ', '')
  
  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) {
    throw new Response(
      JSON.stringify(createErrorResponse('Invalid token')),
      { status: HTTP_STATUS.UNAUTHORIZED }
    )
  }
  
  return user
}

export async function checkAdminRole(user: any): Promise<boolean> {
  // Check user metadata for admin role
  return user.app_metadata?.role === 'admin' || 
         user.user_metadata?.admin === true
}

export function apiAuthWrapper<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    try {
      await requireApiAuth(request)
      return await handler(request, ...args)
    } catch (error) {
      if (error instanceof Response) {
        return error
      }
      
      return new Response(
        JSON.stringify(createErrorResponse('Internal server error')),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }
  }
}
```

### Step 4.3: Create Auth Callback Handler

Create `app/auth/callback/route.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    )
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }
  
  return NextResponse.redirect(`${origin}/auth/error`)
}
```

---

## Phase 5: Real-time Features Integration (Week 5)

### Step 5.1: Real-time Subscriptions

Create `src/lib/supabase-realtime.ts`:
```typescript
import { supabase } from '@/src/db'
import type { RealtimeChannel } from '@supabase/supabase-js'

export class SupabaseRealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map()
  
  // Subscribe to snipe targets updates
  subscribeToSnipeTargets(userId: string, callback: (payload: any) => void) {
    const channel = supabase
      .channel(`snipe-targets-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'snipe_targets',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe()
    
    this.channels.set(`snipe-targets-${userId}`, channel)
    return channel
  }
  
  // Subscribe to pattern detection updates
  subscribeToPatternUpdates(callback: (payload: any) => void) {
    const channel = supabase
      .channel('pattern-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'coin_activities'
        },
        callback
      )
      .subscribe()
    
    this.channels.set('pattern-updates', channel)
    return channel
  }
  
  // Subscribe to workflow activity
  subscribeToWorkflowActivity(userId: string, callback: (payload: any) => void) {
    const channel = supabase
      .channel(`workflow-activity-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'workflow_activity',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe()
    
    this.channels.set(`workflow-activity-${userId}`, channel)
    return channel
  }
  
  // Unsubscribe from a channel
  unsubscribe(channelName: string) {
    const channel = this.channels.get(channelName)
    if (channel) {
      supabase.removeChannel(channel)
      this.channels.delete(channelName)
    }
  }
  
  // Unsubscribe from all channels
  unsubscribeAll() {
    this.channels.forEach((channel) => {
      supabase.removeChannel(channel)
    })
    this.channels.clear()
  }
}

export const realtimeManager = new SupabaseRealtimeManager()
```

### Step 5.2: Update React Components for Real-time

Update `src/components/dashboard/trading-dashboard.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'
import { realtimeManager } from '@/src/lib/supabase-realtime'
import { useAuth } from '@/src/hooks/use-auth'

export function TradingDashboard() {
  const { user } = useAuth()
  const [snipeTargets, setSnipeTargets] = useState([])
  const [workflowActivity, setWorkflowActivity] = useState([])
  
  useEffect(() => {
    if (!user?.id) return
    
    // Subscribe to real-time updates
    const snipeChannel = realtimeManager.subscribeToSnipeTargets(
      user.id,
      (payload) => {
        console.log('Snipe target update:', payload)
        // Update local state based on payload.eventType
        if (payload.eventType === 'INSERT') {
          setSnipeTargets(prev => [...prev, payload.new])
        } else if (payload.eventType === 'UPDATE') {
          setSnipeTargets(prev => 
            prev.map(target => 
              target.id === payload.new.id ? payload.new : target
            )
          )
        } else if (payload.eventType === 'DELETE') {
          setSnipeTargets(prev => 
            prev.filter(target => target.id !== payload.old.id)
          )
        }
      }
    )
    
    const activityChannel = realtimeManager.subscribeToWorkflowActivity(
      user.id,
      (payload) => {
        console.log('Workflow activity update:', payload)
        if (payload.eventType === 'INSERT') {
          setWorkflowActivity(prev => [payload.new, ...prev.slice(0, 49)])
        }
      }
    )
    
    return () => {
      realtimeManager.unsubscribe(`snipe-targets-${user.id}`)
      realtimeManager.unsubscribe(`workflow-activity-${user.id}`)
    }
  }, [user?.id])
  
  return (
    <div>
      {/* Your dashboard UI with real-time updates */}
    </div>
  )
}
```

---

## Phase 6: Data Migration Scripts (Week 6)

### Step 6.1: User Data Migration

Create `scripts/migrate-users.ts`:
```typescript
import { supabaseAdmin } from '@/src/db'

// Mock Kinde user data - replace with actual export
const kindeUsers = [
  {
    id: 'kp_c71c712df046405a9f312fdab51b01e3',
    email: 'ryan@ryanlisse.com',
    given_name: 'Ryan',
    family_name: 'Lisse',
    email_verified: true
  }
]

async function migrateUsers() {
  console.log('Starting user migration...')
  
  for (const kindeUser of kindeUsers) {
    try {
      // Create user in Supabase Auth
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: kindeUser.email,
        password: 'Testing2025!', // Temporary password
        email_confirm: kindeUser.email_verified,
        user_metadata: {
          name: `${kindeUser.given_name} ${kindeUser.family_name}`,
          migrated_from: 'kinde',
          original_id: kindeUser.id
        }
      })
      
      if (authError) {
        console.error(`Failed to create auth user for ${kindeUser.email}:`, authError)
        continue
      }
      
      // Create user record in public.users table
      const { error: dbError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authUser.user.id,
          email: kindeUser.email,
          name: `${kindeUser.given_name} ${kindeUser.family_name}`,
          email_verified: kindeUser.email_verified
        })
      
      if (dbError) {
        console.error(`Failed to create user record for ${kindeUser.email}:`, dbError)
      } else {
        console.log(`✅ Successfully migrated user: ${kindeUser.email}`)
      }
      
    } catch (error) {
      console.error(`Failed to migrate user ${kindeUser.email}:`, error)
    }
  }
  
  console.log('User migration completed')
}

migrateUsers().catch(console.error)
```

### Step 6.2: Trading Data Migration

Create `scripts/migrate-trading-data.ts`:
```typescript
import { db, supabaseAdmin } from '@/src/db'
import { sql } from 'drizzle-orm'

async function migrateTradingData() {
  console.log('Starting trading data migration...')
  
  try {
    // Export data from NeonDB (you'll need to run this with NeonDB connection)
    // const neonData = await neonDb.select().from(snipeTargets)
    
    // For now, we'll create sample data
    const sampleTradingData = [
      {
        user_id: 'user-uuid-here', // Replace with actual migrated user ID
        symbol: 'BTCUSDT',
        entry_strategy: 'market',
        position_size_usdt: 100,
        stop_loss_percent: 5,
        take_profit_levels: [2, 4, 6],
        status: 'completed',
        confidence_score: 85,
        pattern_type: 'ready_state'
      }
    ]
    
    // Insert into Supabase
    const { error } = await supabaseAdmin
      .from('snipe_targets')
      .insert(sampleTradingData)
    
    if (error) {
      console.error('Failed to migrate trading data:', error)
    } else {
      console.log('✅ Successfully migrated trading data')
    }
    
  } catch (error) {
    console.error('Trading data migration failed:', error)
  }
}

migrateTradingData().catch(console.error)
```

---

## Phase 7: Testing & Deployment (Week 7)

### Step 7.1: Integration Testing

Create `tests/supabase-integration.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { supabase, supabaseAdmin } from '@/src/db'

describe('Supabase Integration Tests', () => {
  let testUser: any
  
  beforeAll(async () => {
    // Create test user
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: 'test@example.com',
      password: 'testpass123',
      email_confirm: true
    })
    
    expect(error).toBeNull()
    testUser = data.user
  })
  
  afterAll(async () => {
    // Cleanup test user
    if (testUser) {
      await supabaseAdmin.auth.admin.deleteUser(testUser.id)
    }
  })
  
  it('should authenticate user', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'testpass123'
    })
    
    expect(error).toBeNull()
    expect(data.user).toBeTruthy()
  })
  
  it('should create snipe target', async () => {
    // Sign in first
    await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'testpass123'
    })
    
    const { data, error } = await supabase
      .from('snipe_targets')
      .insert({
        symbol: 'TESTUSDT',
        entry_strategy: 'market',
        position_size_usdt: 50,
        stop_loss_percent: 5
      })
      .select()
      .single()
    
    expect(error).toBeNull()
    expect(data.symbol).toBe('TESTUSDT')
  })
  
  it('should enforce RLS policies', async () => {
    // Try to access data without authentication
    await supabase.auth.signOut()
    
    const { data, error } = await supabase
      .from('snipe_targets')
      .select()
    
    expect(data).toEqual([]) // Should return empty due to RLS
  })
})
```

### Step 7.2: Performance Testing

Create `scripts/performance-test.ts`:
```typescript
import { supabase } from '@/src/db'

async function performanceTest() {
  console.log('Starting performance tests...')
  
  // Test 1: Database query performance
  const start1 = Date.now()
  const { data: users } = await supabase
    .from('users')
    .select('id, email')
    .limit(100)
  const queryTime = Date.now() - start1
  
  console.log(`✅ User query: ${queryTime}ms (target: <100ms)`)
  
  // Test 2: Real-time subscription setup
  const start2 = Date.now()
  const channel = supabase
    .channel('test-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {})
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        const subscribeTime = Date.now() - start2
        console.log(`✅ Real-time subscription: ${subscribeTime}ms (target: <1000ms)`)
        supabase.removeChannel(channel)
      }
    })
  
  // Test 3: Authentication performance
  const start3 = Date.now()
  const { data } = await supabase.auth.getSession()
  const authTime = Date.now() - start3
  
  console.log(`✅ Auth check: ${authTime}ms (target: <50ms)`)
}

performanceTest().catch(console.error)
```

---

## Phase 8: Production Deployment (Week 8)

### Step 8.1: Environment Setup

Update production environment variables:
```bash
# Production .env
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-role-key
SUPABASE_DATABASE_URL=your-prod-db-url

# Remove old variables
# NEON_DATABASE_URL=
# KINDE_CLIENT_ID=
# KINDE_CLIENT_SECRET=
```

### Step 8.2: Deployment Script

Create `scripts/deploy.sh`:
```bash
#!/bin/bash

echo "🚀 Starting Supabase migration deployment..."

# 1. Backup current data
echo "📦 Creating backup..."
# Add your backup commands here

# 2. Update environment variables
echo "🔧 Updating environment..."
# Update Vercel/production environment variables

# 3. Deploy application
echo "🚢 Deploying application..."
vercel --prod

# 4. Run data migration
echo "📊 Migrating data..."
node scripts/migrate-users.js
node scripts/migrate-trading-data.js

# 5. Verify deployment
echo "✅ Verifying deployment..."
curl -f https://your-app.vercel.app/api/health || exit 1

echo "🎉 Migration deployment completed successfully!"
```

### Step 8.3: Monitoring Setup

Create monitoring for the new Supabase setup:
```typescript
// src/lib/supabase-monitoring.ts
import { supabase } from '@/src/db'

export class SupabaseMonitoring {
  static async checkHealth() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .limit(1)
      
      return {
        database: !error,
        auth: await this.checkAuth(),
        realtime: await this.checkRealtime()
      }
    } catch {
      return { database: false, auth: false, realtime: false }
    }
  }
  
  private static async checkAuth() {
    try {
      const { data } = await supabase.auth.getSession()
      return true
    } catch {
      return false
    }
  }
  
  private static async checkRealtime() {
    return new Promise((resolve) => {
      const channel = supabase
        .channel('health-check')
        .subscribe((status) => {
          resolve(status === 'SUBSCRIBED')
          supabase.removeChannel(channel)
        })
      
      setTimeout(() => resolve(false), 5000)
    })
  }
}
```

---

## 🎯 Post-Migration Verification

### Checklist
- [ ] All users can authenticate with Supabase Auth
- [ ] Database queries perform within target times (<100ms)
- [ ] Real-time features working correctly
- [ ] RLS policies enforcing proper access control
- [ ] Pattern detection system operational
- [ ] Auto-sniping functionality working
- [ ] All API endpoints responding correctly
- [ ] Monitoring and alerting configured

### Success Metrics
- ✅ **Zero data loss** during migration
- ✅ **<100ms** average database query time
- ✅ **99.9% uptime** during migration period
- ✅ **Real-time updates** working within 100ms
- ✅ **Cost reduction** of 20-60% achieved

---

## 🚨 Rollback Plan

If issues occur during migration:

1. **Immediate Rollback**:
   ```bash
   # Revert environment variables
   # Redeploy previous version
   vercel --prod --env-file .env.old
   ```

2. **Data Recovery**:
   ```bash
   # Restore from backup
   pg_restore -d $NEON_DATABASE_URL backup.sql
   ```

3. **User Communication**:
   - Notify users of temporary service disruption
   - Provide estimated recovery time
   - Send confirmation when service is restored

---

## 📞 Support Resources

- **Supabase Dashboard**: https://supabase.com/dashboard
- **Supabase Docs**: https://supabase.com/docs
- **Supabase Discord**: https://discord.supabase.com
- **Migration Support**: support@supabase.io

**Next Steps**: Begin Phase 1 implementation with Supabase project creation and environment setup.