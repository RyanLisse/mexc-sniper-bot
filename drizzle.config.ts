import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load environment variables from .env.local
config({ path: '.env.local' });

// Force PostgreSQL usage - Supabase only
const hasSupabaseConfig = process.env.DATABASE_URL?.startsWith('postgresql://') && 
  process.env.DATABASE_URL?.includes('supabase.co');

if (!hasSupabaseConfig) {
  throw new Error('DATABASE_URL must be configured with a Supabase PostgreSQL connection string');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
  // PostgreSQL specific optimizations
  tablesFilter: ['!pg_*', '!information_schema*'],
  breakpoints: true,
});