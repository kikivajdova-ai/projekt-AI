// Fronta notifikací s nočním klidem. Při zařazení se spočítá, kdy smí notifikace odejít;
// při odeslání se noční klid kontroluje znovu (nastavení se mohlo mezitím změnit).

import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import { asSystem, asUser } from '../db/client.ts';
import { notificationOutbox, pushTokens } from '../db/schema/index.ts';
import type { NotificationKind } from '../domain/enums.ts';
import { buildPushMessage, wantsNotification } from '../domain/notifications.ts';
import { nextAllowedSendTime, type QuietHours } from '../domain/time.ts';
import { loadSettings, type Settings } from './settings.ts';
import { sendPush, type PushResult } from '../push/fcm.ts';

function quiet(s: Settings): QuietHours {
  return { enabled: s.quietHoursEnabled, start: s.quietStart, end: s.quietEnd, timeZone: s.timezone };
}

/** Zařadí notifikaci do fronty. Volat MIMO transakci uživatele (po jejím dokončení). */
export async function enqueueNotification(recipientId: string, kind: NotificationKind, refId: string) {
  await asSystem(async (tx) => {
    const s = await loadSettings(tx, recipientId);
    if (!wantsNotification(kind, s)) return;
    await tx.insert(notificationOutbox).values({
      id: crypto.randomUUID(),
      recipientId,
      kind,
      refId,
      sendAfter: nextAllowedSendTime(new Date(), quiet(s)),
    });
  });
}

export async function registerPushToken(userId: string, token: string, platform: 'ANDROID' | 'IOS') {
  // Token se mohl dřív patřit jinému účtu na stejném telefonu -> nejdřív ho uvolní systém.
  await asSystem((tx) => tx.delete(pushTokens).where(eq(pushTokens.token, token)));
  await asUser(userId, (tx) => tx.insert(pushTokens).values({ token, userId, platform }).onConflictDoNothing());
}

export async function removePushToken(userId: string, token: string) {
  await asUser(userId, (tx) => tx.delete(pushTokens).where(eq(pushTokens.token, token)));
}

const MAX_ATTEMPTS = 5;

/** Jak dlouho si plánovač „drží“ vyzvednutou položku, než ji smí zkusit znovu. */
const LEASE_MS = 10 * 60_000;

/**
 * Odešle notifikace, kterým už skončil noční klid. Spouští plánovač (funkce dispatch).
 * 1) Krátká transakce položky vyzvedne a posune jim send_after (zámek na 10 minut),
 *    takže je souběžný běh nevezme podruhé.
 * 2) Odesílání do FCM běží MIMO transakci databáze.
 * 3) Výsledek každé položky se ukládá zvlášť; chyba jedné nezastaví ostatní
 *    a už odeslané se neodešlou znovu.
 */
export async function dispatchDueNotifications(limit = 100): Promise<{ sent: number; deferred: number; failed: number }> {
  const claimed = await asSystem(async (tx) => {
    const due = await tx
      .select()
      .from(notificationOutbox)
      .where(and(eq(notificationOutbox.status, 'CEKA'), lte(notificationOutbox.sendAfter, new Date())))
      .orderBy(asc(notificationOutbox.sendAfter))
      .limit(limit)
      .for('update', { skipLocked: true });
    if (due.length) {
      await tx
        .update(notificationOutbox)
        .set({ sendAfter: new Date(Date.now() + LEASE_MS) })
        .where(inArray(notificationOutbox.id, due.map((d) => d.id)));
    }
    return due;
  });

  let sent = 0;
  let deferred = 0;
  let failed = 0;
  for (const item of claimed) {
    try {
      const outcome = await processItem(item);
      if (outcome === 'sent') sent++;
      if (outcome === 'deferred') deferred++;
    } catch (e) {
      failed++;
      console.error('Notifikaci se nepodařilo zpracovat', (e as Error)?.name);
      await asSystem((tx) =>
        tx
          .update(notificationOutbox)
          .set(
            item.attempts + 1 >= MAX_ATTEMPTS
              ? { status: 'ZAHOZENO', attempts: item.attempts + 1 }
              : { attempts: item.attempts + 1, sendAfter: new Date(Date.now() + (item.attempts + 1) * 5 * 60_000) },
          )
          .where(eq(notificationOutbox.id, item.id)),
      ).catch(() => undefined);
    }
  }
  return { sent, deferred, failed };
}

type OutboxItem = typeof notificationOutbox.$inferSelect;

async function processItem(item: OutboxItem): Promise<'sent' | 'deferred' | 'dropped' | 'retry'> {
  const { settings, tokens } = await asSystem(async (tx) => ({
    settings: await loadSettings(tx, item.recipientId),
    tokens: await tx.select().from(pushTokens).where(eq(pushTokens.userId, item.recipientId)),
  }));

  const allowedAt = nextAllowedSendTime(new Date(), quiet(settings));
  if (allowedAt.getTime() > Date.now()) {
    await setItem(item.id, { sendAfter: allowedAt });
    return 'deferred';
  }
  if (!wantsNotification(item.kind, settings) || tokens.length === 0) {
    await setItem(item.id, { status: 'ZAHOZENO' });
    return 'dropped';
  }

  const message = buildPushMessage(item.kind, item.refId);
  const results: PushResult[] = await Promise.all(tokens.map((t) => sendPush(t.token, message)));
  const invalid = tokens.filter((_, i) => results[i] === 'INVALID_TOKEN').map((t) => t.token);
  if (invalid.length) await asSystem((tx) => tx.delete(pushTokens).where(inArray(pushTokens.token, invalid)));

  const attempts = item.attempts + 1;
  if (results.some((r) => r === 'OK')) {
    await setItem(item.id, { status: 'ODESLANO', sentAt: new Date(), attempts });
    return 'sent';
  }
  if (results.every((r) => r === 'INVALID_TOKEN') || attempts >= MAX_ATTEMPTS) {
    await setItem(item.id, { status: 'ZAHOZENO', attempts });
    return 'dropped';
  }
  await setItem(item.id, { attempts, sendAfter: new Date(Date.now() + attempts * 5 * 60_000) });
  return 'retry';
}

async function setItem(id: string, values: Partial<OutboxItem>) {
  await asSystem((tx) => tx.update(notificationOutbox).set(values).where(eq(notificationOutbox.id, id)));
}

/** Úklid: hotové položky fronty starší 30 dní (minimalizace dat). */
export async function cleanupOutbox() {
  await asSystem((tx) =>
    tx
      .delete(notificationOutbox)
      .where(
        and(
          inArray(notificationOutbox.status, ['ODESLANO', 'ZAHOZENO']),
          lte(notificationOutbox.createdAt, sql`now() - interval '30 days'`),
        ),
      ),
  );
}
