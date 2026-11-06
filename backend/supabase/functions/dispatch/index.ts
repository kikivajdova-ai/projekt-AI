// Edge Function `dispatch`: spouští ji plánovač (Supabase Cron) každých pár minut.
// Odešle notifikace, kterým skončil noční klid, a předá nahlášení podpoře.
// Chráněná sdíleným tajemstvím CRON_SECRET (není to uživatelský endpoint).

import { cleanupOutbox, dispatchDueNotifications } from '../_shared/services/notifications.ts';
import { forwardPendingReports } from '../_shared/services/support.ts';
import { requireEnv } from '../_shared/env.ts';

async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (req.method !== 'POST' || !(await safeEqual(provided, requireEnv('CRON_SECRET')))) {
    return new Response('Not found', { status: 404 });
  }
  const notifications = await dispatchDueNotifications();
  const reports = await forwardPendingReports();
  await cleanupOutbox();
  return Response.json({ notifications, reports });
});
