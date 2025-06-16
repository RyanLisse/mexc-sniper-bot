import { defineConfig } from 'drizzle-kit';

// Determine if we have NeonDB configuration
const hasNeonConfig = process.env.DATABASE_URL?.startsWith('postgresql://');

// Use SQLite as fallback for development if no NeonDB config
const useSQLite = !hasNeonConfig || process.env.FORCE_SQLITE === 'true';

export default defineConfig(
  useSQLite
    ? {
        schema: './src/db/schema.ts',
        out: './src/db/migrations',
        dialect: 'sqlite',
        dbCredentials: {
          url: 'file:./mexc_sniper.db',
        },
        verbose: true,
        strict: true,
        // SQLite specific optimizations
        tablesFilter: ['!sqlite_*'],
        breakpoints: true,
      }
    : {
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
      }
);