// Připojení k databázi přes Drizzle ORM.
//
// Z celého kódu vedou k datům jen DVĚ cesty a obě běží v transakci se „nasazenou“ rolí:
//   asUser(userId, fn)  -> role app_user + id člověka z ověřeného JWT -> platí RLS
//   asSystem(fn)        -> role app_system, jen úzce vymezená práva (viz sql/granty.sql)
// Účet app_api, kterým se připojujeme, sám nemá žádná práva. Když by někdo omylem
// spustil dotaz mimo tyto dvě funkce, databáze ho odmítne (selže „zavřeně“).

import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index.ts';
import { requireEnv } from '../env.ts';

export type Database = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let database: Database | undefined;

function db(): Database {
  if (!database) {
    // APP_DB_URL = připojení jako app_api (NE postgres ani service_role).
    // prepare: false je nutné pro pooler Supabase v režimu transakcí (port 6543).
    const client = postgres(requireEnv('APP_DB_URL'), { prepare: false, max: 5 });
    database = drizzle(client, { schema });
  }
  return database;
}

/** Spustí `fn` jménem přihlášeného člověka. Databáze mu ukáže jen to, co smí vidět. */
export async function asUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID_RE.test(userId)) throw new Error('Neplatné id uživatele');
  return db().transaction(async (tx) => {
    const claims = JSON.stringify({ sub: userId, role: 'authenticated' });
    // Hodnoty jdou jako parametry dotazu, ne slepením řetězců (ochrana proti SQL injection).
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${claims}, true), set_config('request.jwt.claim.sub', ${userId}, true)`,
    );
    await tx.execute(sql`set local role app_user`);
    return fn(tx);
  });
}

/** Spustí `fn` jako serverový proces s úzkými právy (žádný přístup k náladě a stresu). */
export async function asSystem<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db().transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true)`);
    await tx.execute(sql`set local role app_system`);
    return fn(tx);
  });
}

/** Postgres kód 42501 = porušení oprávnění / RLS politiky. */
export function isPermissionError(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === '42501' || e?.cause?.code === '42501';
}

/** Postgres kód 23505 = porušení unikátnosti (např. druhá pozvánka týž den). */
export function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}
