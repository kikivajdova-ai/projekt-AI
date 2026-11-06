// Ověření přihlášení: každý požadavek nese přístupový token (JWT) ze Supabase Auth.
// Ověřujeme podpis přes veřejné klíče projektu (JWKS), vydavatele i platnost.
// Id uživatele bereme JEN z ověřeného tokenu, nikdy z těla požadavku.

import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { MiddlewareHandler } from 'hono';
import { requireEnv } from '../env.ts';
import { AppError } from '../errors.ts';

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function keySet() {
  jwks ??= createRemoteJWKSet(new URL(`${requireEnv('SUPABASE_URL')}/auth/v1/.well-known/jwks.json`));
  return jwks;
}

export type AuthEnv = { Variables: { userId: string } };

export const requireUser: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new AppError(401, 'NEPRIHLASEN', 'Přihlas se prosím.');
  try {
    const { payload } = await jwtVerify(token, keySet(), {
      issuer: `${requireEnv('SUPABASE_URL')}/auth/v1`,
      audience: 'authenticated',
    });
    if (payload.role !== 'authenticated' || typeof payload.sub !== 'string') throw new Error('role');
    c.set('userId', payload.sub);
  } catch {
    throw new AppError(401, 'NEPRIHLASEN', 'Přihlášení vypršelo, přihlas se prosím znovu.');
  }
  await next();
};
