// Kryptografie přes Web Crypto (je v Deno i v Node 20+), bez dalších knihoven.
//  - Pozvánkový token: dlouhý náhodný řetězec; v databázi je jen jeho otisk (hash),
//    takže ani únik databáze neprozradí platné pozvánky.
//  - Token náhledu sdílení: podpis HMAC dokazuje, že uživatel viděl náhled přesně toho,
//    co sdílí (stejná chvíle, stejné publikum) a že to bylo před chvílí.

import type { Visibility } from './enums.ts';

const enc = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Nový pozvánkový token (256 bitů náhody) a jeho otisk pro uložení do databáze. */
export async function generateInviteToken(): Promise<{ token: string; tokenHash: string }> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  return { token, tokenHash: await sha256Hex(token) };
}

export function looksLikeInviteToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export interface SharePreviewClaims {
  activityId: string;
  userId: string;
  visibility: Visibility;
  crewId: string | null;
}

function payload(c: SharePreviewClaims, exp: number): string {
  return [c.activityId, c.userId, c.visibility, c.crewId ?? '', String(exp)].join('|');
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error('SHARE_PREVIEW_SECRET musí mít aspoň 32 znaků');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function signSharePreview(
  secret: string,
  claims: SharePreviewClaims,
  ttlSeconds: number,
  now: Date = new Date(),
): Promise<string> {
  const exp = Math.floor(now.getTime() / 1000) + ttlSeconds;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload(claims, exp)));
  return `${exp}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySharePreview(
  secret: string,
  token: string,
  claims: SharePreviewClaims,
  now: Date = new Date(),
): Promise<boolean> {
  const [expRaw, sigRaw, extra] = token.split('.');
  if (!expRaw || !sigRaw || extra !== undefined || !/^\d+$/.test(expRaw)) return false;
  const exp = Number(expRaw);
  if (exp < Math.floor(now.getTime() / 1000)) return false;
  let sig: Uint8Array<ArrayBuffer>;
  try {
    sig = fromBase64Url(sigRaw);
  } catch {
    return false;
  }
  // subtle.verify porovnává v konstantním čase
  return crypto.subtle.verify('HMAC', await hmacKey(secret), sig, enc.encode(payload(claims, exp)));
}
