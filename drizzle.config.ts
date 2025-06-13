import { defineConfig } from 'drizzle-kit';

// Determine if we're in production or using Railway
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';
const hasTursoConfig = process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN;

// Use Turso in production environments or when explicitly configured
const useTurso = (isProduction || isRailway || hasTursoConfig) && !process.env.FORCE_SQLITE;

export default defineConfig(
  useTurso
    ? {
        schema: './src/db/schema.ts',
        out: './src/db/migrations',
        dialect: 'turso',
        dbCredentials: {
          url: process.env.TURSO_DATABASE_URL!,
          authToken: process.env.TURSO_AUTH_TOKEN!,
        },
        verbose: true,
        strict: true,
        // Enable better table introspection
        tablesFilter: ['!libsql_*', '!_litestream_*', '!sqlite_*'],
        // Breakpoints for safer migrations
        breakpoints: true,
      }
    : {
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
);