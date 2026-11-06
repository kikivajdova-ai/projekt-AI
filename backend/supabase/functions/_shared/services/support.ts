// Předání nahlášení do interního systému podpory (např. helpdesk, Slack kanál týmu)
// přes webhook. Posíláme jen to, co člověk z podpory potřebuje k řešení.
// Nikdy sem nejdou záznamy nálady ani stresu.

import { and, asc, eq, isNull } from 'drizzle-orm';
import { asSystem } from '../db/client.ts';
import { reports } from '../db/schema/index.ts';
import { env } from '../env.ts';

export async function forwardReport(reportId: string): Promise<boolean> {
  const url = env('SUPPORT_WEBHOOK_URL');
  const secret = env('SUPPORT_WEBHOOK_SECRET');
  if (!url || !secret) {
    console.warn('SUPPORT_WEBHOOK_URL/SECRET nejsou nastavené, nahlášení čeká ve frontě');
    return false;
  }
  return asSystem(async (tx) => {
    const [r] = await tx
      .select()
      .from(reports)
      .where(and(eq(reports.id, reportId), isNull(reports.forwardedAt)))
      .for('update', { skipLocked: true });
    if (!r) return false;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-webhook-secret': secret },
      body: JSON.stringify({
        reportId: r.id,
        reason: r.reason,
        details: r.details,
        reporterId: r.reporterId,
        reportedUserId: r.reportedUserId,
        contextType: r.contextType,
        contextId: r.contextId,
        createdAt: r.createdAt,
        // Nahlášení týkající se bezpečnosti dítěte musí mít nejvyšší prioritu.
        priority: r.reason === 'BEZPECNOST_DITETE' ? 'URGENT' : 'NORMAL',
      }),
    });
    if (!res.ok) return false;
    await tx.update(reports).set({ status: 'PREDANO', forwardedAt: new Date() }).where(eq(reports.id, r.id));
    return true;
  });
}

/** Opakované předání nahlášení, která se nepodařilo poslat hned (spouští plánovač). */
export async function forwardPendingReports(limit = 50): Promise<number> {
  const pending = await asSystem((tx) =>
    tx
      .select({ id: reports.id })
      .from(reports)
      .where(and(eq(reports.status, 'NOVE'), isNull(reports.forwardedAt)))
      .orderBy(asc(reports.createdAt))
      .limit(limit),
  );
  let forwarded = 0;
  for (const { id } of pending) if (await forwardReport(id).catch(() => false)) forwarded++;
  return forwarded;
}
