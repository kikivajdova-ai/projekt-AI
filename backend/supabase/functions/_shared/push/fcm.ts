// Odeslání push notifikace přes Firebase Cloud Messaging (HTTP v1).
// Do FCM jde jen bezpečná zpráva z buildPushMessage (obecný text, žádná jména ani nálada).
// Na Androidu navíc visibility PRIVATE: zamčená obrazovka ukáže jen „Odpočívat spolu“.

import { importPKCS8, SignJWT } from 'jose';
import type { SafePushMessage } from '../domain/notifications.ts';
import { env } from '../env.ts';

export type PushResult = 'OK' | 'INVALID_TOKEN' | 'RETRY';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cachedToken: { value: string; expiresAt: number } | undefined;

function serviceAccount(): ServiceAccount | undefined {
  const raw = env('FCM_SERVICE_ACCOUNT_JSON');
  return raw ? (JSON.parse(raw) as ServiceAccount) : undefined;
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const key = await importPKCS8(sa.private_key, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`FCM přihlášení selhalo (${res.status})`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

export async function sendPush(deviceToken: string, msg: SafePushMessage): Promise<PushResult> {
  const sa = serviceAccount();
  if (!sa) {
    console.warn('FCM_SERVICE_ACCOUNT_JSON není nastavené, notifikace se neodesílá');
    return 'RETRY';
  }
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await accessToken(sa)}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title: msg.title, body: msg.body },
        data: msg.data,
        android: {
          priority: 'NORMAL',
          notification: { visibility: 'PRIVATE', channel_id: 'odpocivat_spolu_obecne' },
        },
        apns: { payload: { aps: { sound: 'default' } } },
      },
    }),
  });
  if (res.ok) return 'OK';
  // 404 = UNREGISTERED (aplikace odinstalovaná / token neplatný). 400 může být i naše chyba,
  // proto token nemažeme a jen zkusíme znovu.
  if (res.status === 404) return 'INVALID_TOKEN';
  // Záměrně nelogujeme tělo odpovědi ani token zařízení.
  console.warn(`FCM odpověď ${res.status}`);
  return 'RETRY';
}
