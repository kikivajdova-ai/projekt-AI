// Povzbuzení jedním klepnutím a pozvánky k odpočinku.
//
// Když příjemce povzbuzení vypnul nebo odesílatele blokuje, odesílatel dostane stejnou
// odpověď „odesláno“, jako by se nic nestalo. Vypnutí ani blokování se tak nedozví.

import { and, count, desc, eq, gt, or } from 'drizzle-orm';
import { asUser, isPermissionError, isUniqueViolation, type Tx } from '../db/client.ts';
import { friendships, pings, restInvitations, users } from '../db/schema/index.ts';
import { LIMITS } from '../domain/config.ts';
import type { ActivityCategory, PingKind, RestInviteAnswer } from '../domain/enums.ts';
import { CATEGORY_LABEL } from '../domain/labels.ts';
import { localDay } from '../domain/time.ts';
import { AppError, forbidden, notFound, tooMany } from '../errors.ts';
import { awardBadges } from './game.ts';
import { enqueueNotification } from './notifications.ts';
import { loadSettings } from './settings.ts';

const PING_TEXT: Record<PingKind, string> = {
  MYSLIM_NA_TEBE: 'Myslím na tebe.',
  DEJ_SI_PAUZU: 'Dej si dnes pauzu.',
  FANDIM_TI: 'Fandím ti.',
};

async function assertFriends(tx: Tx, userId: string, otherId: string) {
  const [a, b] = userId < otherId ? [userId, otherId] : [otherId, userId];
  const [f] = await tx
    .select({ status: friendships.status })
    .from(friendships)
    .where(and(eq(friendships.userA, a), eq(friendships.userB, b)));
  if (f?.status !== 'PRIJATO') throw forbidden('Tohle jde jen mezi přáteli.');
}

/**
 * Vloží řádek v savepointu; porušení RLS (blok, vypnutý příjem) tiše spolkne.
 * Vrací true jen tehdy, když OPRAVDU vznikl nový řádek (opakované id = false),
 * takže opakované odeslání téhož povzbuzení nepošle další notifikaci.
 */
async function insertSilently(tx: Tx, insert: (sp: Tx) => Promise<unknown[]>): Promise<boolean> {
  try {
    return await tx.transaction(async (sp) => (await insert(sp)).length > 0);
  } catch (e) {
    if (isPermissionError(e)) return false;
    throw e;
  }
}

export async function sendPing(userId: string, input: { id: string; recipientId: string; kind: PingKind }) {
  const delivered = await asUser(userId, async (tx) => {
    await assertFriends(tx, userId, input.recipientId);
    const s = await loadSettings(tx, userId);
    const today = localDay(new Date(), s.timezone);

    const [{ total }] = await tx
      .select({ total: count() })
      .from(pings)
      .where(and(eq(pings.senderId, userId), eq(pings.senderLocalDay, today)));
    const [{ toFriend }] = await tx
      .select({ toFriend: count() })
      .from(pings)
      .where(
        and(eq(pings.senderId, userId), eq(pings.recipientId, input.recipientId), eq(pings.senderLocalDay, today)),
      );
    if (total >= LIMITS.pingsPerDayTotal || toFriend >= LIMITS.pingsPerDayToSameFriend) {
      throw tooMany('Pro dnešek už jsi povzbuzení poslal(a) dost. Kamarád ví, že na něj myslíš.');
    }

    return insertSilently(tx, (sp) =>
      sp
        .insert(pings)
        .values({ id: input.id, senderId: userId, recipientId: input.recipientId, kind: input.kind, senderLocalDay: today })
        .onConflictDoNothing({ target: pings.id })
        .returning({ id: pings.id }),
    );
  });

  if (delivered) {
    await enqueueNotification(input.recipientId, 'POVZBUZENI', input.id);
    await awardBadges(userId);
  }
  // Stejná odpověď v obou případech. Žádná možnost odpovědi ani „přečteno“.
  return { odeslano: true };
}

export async function listReceivedPings(userId: string) {
  return asUser(userId, async (tx) => {
    const rows = await tx
      .select({ id: pings.id, kind: pings.kind, createdAt: pings.createdAt, from: users.displayName, fromId: pings.senderId })
      .from(pings)
      .innerJoin(users, eq(users.id, pings.senderId))
      .where(eq(pings.recipientId, userId))
      .orderBy(desc(pings.createdAt))
      .limit(30);
    // odKohoId: aby šlo odesílatele jedním klepnutím zablokovat nebo nahlásit
    return rows.map((r) => ({ id: r.id, odKoho: r.from, odKohoId: r.fromId, text: PING_TEXT[r.kind], kdy: r.createdAt }));
  });
}

export async function sendRestInvite(
  userId: string,
  input: { id: string; recipientId: string; category: ActivityCategory },
) {
  const delivered = await asUser(userId, async (tx) => {
    await assertFriends(tx, userId, input.recipientId);
    const s = await loadSettings(tx, userId);
    const today = localDay(new Date(), s.timezone);

    const [{ total }] = await tx
      .select({ total: count() })
      .from(restInvitations)
      .where(and(eq(restInvitations.senderId, userId), eq(restInvitations.senderLocalDay, today)));
    if (total >= LIMITS.restInvitesPerDayTotal) throw tooMany();

    try {
      return await insertSilently(tx, (sp) =>
        sp.insert(restInvitations).values({
          id: input.id,
          senderId: userId,
          recipientId: input.recipientId,
          category: input.category,
          senderLocalDay: today,
          expiresAt: new Date(Date.now() + LIMITS.restInviteTtlHours * 3_600_000),
        })
        .onConflictDoNothing({ target: restInvitations.id })
        .returning({ id: restInvitations.id }),
      );
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new AppError(409, 'DNES_UZ_POZVANO', 'Dnes už jsi tohohle kamaráda pozval(a). Zkus to zase zítra.');
      }
      throw e;
    }
  });
  if (delivered) await enqueueNotification(input.recipientId, 'POZVANKA_K_ODPOCINKU', input.id);
  return { odeslano: true };
}

/**
 * Odpověď na pozvánku: JEN stav. Žádný důvod, žádný text. „Teď ne“ odesílatel uvidí
 * neutrálně a nedostane o něm žádnou notifikaci.
 */
export async function answerRestInvite(userId: string, invitationId: string, answer: RestInviteAnswer) {
  const row = await asUser(userId, async (tx) => {
    const [r] = await tx
      .update(restInvitations)
      .set({ status: answer, respondedAt: new Date() })
      .where(
        and(
          eq(restInvitations.id, invitationId),
          eq(restInvitations.recipientId, userId),
          eq(restInvitations.status, 'CEKA'),
          gt(restInvitations.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!r) throw notFound('Tahle pozvánka už není aktuální.');
    return r;
  });
  if (answer === 'PRIDAM_SE') await enqueueNotification(row.senderId, 'ODPOVED_NA_POZVANKU', row.id);
  return { stav: answer };
}

/** Neutrální popisky stavů pro odesílatele. Nikdy „odmítl(a)“ ani „ignoruje“. */
function senderStatusLabel(status: string, expired: boolean): string {
  if (status === 'PRIDAM_SE') return 'Přidá se';
  if (status === 'TED_NE') return 'Tentokrát to nevyjde';
  return expired ? 'Pozvánka skončila' : 'Pozvánka odeslána';
}

export async function listRestInvites(userId: string) {
  return asUser(userId, async (tx) => {
    const rows = await tx
      .select()
      .from(restInvitations)
      .where(or(eq(restInvitations.senderId, userId), eq(restInvitations.recipientId, userId)))
      .orderBy(desc(restInvitations.createdAt))
      .limit(30);
    const now = Date.now();
    const result = [];
    for (const r of rows) {
      const incoming = r.recipientId === userId;
      const otherId = incoming ? r.senderId : r.recipientId;
      const [other] = await tx.select({ name: users.displayName }).from(users).where(eq(users.id, otherId));
      const expired = r.expiresAt.getTime() < now;
      result.push({
        id: r.id,
        smer: incoming ? 'PRICHOZI' : 'ODESLANA',
        kdo: other?.name ?? '',
        kdoId: otherId,
        text: incoming
          ? `${CATEGORY_LABEL[r.category]}: přidáš se?`
          : `${CATEGORY_LABEL[r.category]}`,
        muzesOdpovedet: incoming && r.status === 'CEKA' && !expired,
        stav: incoming ? r.status : senderStatusLabel(r.status, expired),
      });
    }
    return result;
  });
}
