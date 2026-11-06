import { defineConfig } from 'drizzle-kit';

// drizzle-kit čte schéma v TypeScriptu a vyrábí z něj SQL migrace (tabulky + RLS politiky).
// `entities.roles.provider: 'supabase'` = nesahej na role, které spravuje Supabase.
export default defineConfig({
  dialect: 'postgresql',
  schema: './supabase/functions/_shared/db/schema/index.ts',
  out: './supabase/migrations',
  migrations: { prefix: 'supabase' },
  entities: { roles: { provider: 'supabase' } },
  dbCredentials: {
    // Jen pro `drizzle-kit studio/check`. Migrace se nasazují přes Supabase CLI.
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  },
  strict: true,
  verbose: true,
});
