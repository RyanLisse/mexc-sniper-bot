import { defineConfig } from 'drizzle-kit';

export default defineConfig(
  process.env.TURSO_DATABASE_URL
    ? {
        schema: './src/db/schema.ts',
        out: './src/db/migrations',
        dialect: 'turso',
        dbCredentials: {
          url: process.env.TURSO_DATABASE_URL,
          authToken: process.env.TURSO_AUTH_TOKEN!,
        },
        verbose: true,
        strict: true,
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
      }
);