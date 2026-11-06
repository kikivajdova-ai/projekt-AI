// Přátelství přes pozvánku se souhlasem obou stran, blokování a nahlášení.
// Záměrně tu NENÍ žádná funkce typu „najdi uživatele podle jména“.

import { and, count, eq, gt, gte, isNull, or, sql } from 'drizzle-orm';
import { asSystem, asUser } from '../db/client.ts';
import { avatars, blocks, friendInvites, friendships, groupInvitations, reports, restInvitations, users } from '../db/schema/index.ts';
import { LIMITS } from '../domain/config.ts';
import type { ReportReason } from '../domain/enums.ts';
import { generateInviteToken, looksLikeInviteToken, sha256Hex } from '../domain/tokens.ts';
import { inviteBaseUrl } from '../env.ts';
import { AppError, notFound, tooMany } from '../errors.ts';
import { enqueueNotification } from './notifications.ts';
import { forwardReport } from './support.ts';

const pair = (x: string, y: string) => (x < y ? { userA: x, userB: y } : { userA: y, userB: x });
const pairWhere = (x: string, y: string) => {
  const p = pair(x, y);
  return and(eq(friendships.userA, p.userA), eq(friendships.userB, p.userB));
};

/** Stejná odpověď pro neplatnou, prošlou, použitou i „blokovanou“ pozvánku (nic neprozradí). */
const invalidInvite = () => new AppError(404, 'POZVANKA_NEPLATI', 'Tahle pozvánka už neplatí.');

export async function createFriendInvite(userId: string) {
  const { token, tokenHash } = await generateInviteToken();
  const expiresAt = new Date(Date.now() + LIMITS.friendInviteTtlHours * 3_600_000);
  const id = crypto.randomUUID();
  await asUser(userId, async (tx) => {
    const [{ n }] = await tx
      .select({ n: count() })
      .from(friendInvites)
      .where(
        and(
          eq(friendInvites.inviterId, userId),
          isNull(friendInvites.usedAt),
          isNull(friendInvites.revokedAt),
          gt(friendInvites.expiresAt, new Date()),
        ),
      );
    if (n >= LIMITS.maxActiveFriendInvites) throw tooMany('Máš hodně otevřených pozvánek. Některou zruš.');
    await tx.insert(friendInvites).values({ id, inviterId: userId, tokenHash, expiresAt });
  });
  // Token existuje jen v tomto odkazu; v databázi je jen jeho otisk.
  return { id, odkaz: `${inviteBaseUrl()}/${token}`, platiDo: expiresAt };
}

export async function revokeFriendInvite(userId: string, inviteId: string) {
  await asUser(userId, (tx) =>
    tx
      .update(friendInvites)
      .set({ revokedAt: new Date() })
      .where(and(eq(friendInvites.id, inviteId), eq(friendInvites.inviterId, userId))),
  );
}

async function findValidInvite(token: string, userId: string) {
  if (!looksLikeInviteToken(token)) return undefined;
  const tokenHash = await sha256Hex(token);
  return asSystem(async (tx) => {
    const [inv] = await tx
      .select({
        id: friendInvites.id,
        inviterId: friendInvites.inviterId,
        name: users.displayName,
        blocked: sql<boolean>`private.is_blocked_pair(${friendInvites.inviterId}, ${userId}::uuid)`,
      })
      .from(friendInvites)
      .innerJoin(users, eq(users.id, friendInvites.inviterId))
      .where(
        and(
          eq(friendInvites.tokenHash, tokenHash),
          isNull(friendInvites.usedAt),
          isNull(friendInvites.revokedAt),
          gt(friendInvites.expiresAt, new Date()),
        ),
      );
    return inv;
  });
}

/** Kdo mě zve? Vrací jen přezdívku. Pozvánka se tím NEpoužije. */
export async function previewFriendInvite(userId: string, token: string) {
  const inv = await findValidInvite(token, userId);
  // Blok vypadá stejně jako neplatná pozvánka: náhled nic neprozradí.
  if (!inv || inv.inviterId === userId || inv.blocked) throw invalidInvite();
  return { odKoho: inv.name };
}

/**
 * Přijetí pozvánky = druhé ANO. Autor řekl ANO tím, že osobní odkaz vytvořil a poslal,
 * pozvaný tím, že ho přijal. Přátelství tedy vzniká hned, bez dalšího potvrzování.
 */
export async function acceptFriendInvite(userId: string, token: string) {
  if (!looksLikeInviteToken(token)) throw invalidInvite();
  const tokenHash = await sha256Hex(token);

  const inviterId = await asSystem(async (tx) => {
    const [inv] = await tx
      .select()
      .from(friendInvites)
      .where(
        and(
          eq(friendInvites.tokenHash, tokenHash),
          isNull(friendInvites.usedAt),
          isNull(friendInvites.revokedAt),
          gt(friendInvites.expiresAt, new Date()),
        ),
      )
      .for('update');
    if (!inv || inv.inviterId === userId) throw invalidInvite();

    const blocked = await tx.execute(
      sql`select private.is_blocked_pair(${inv.inviterId}::uuid, ${userId}::uuid) as blocked`,
    );
    if ((blocked[0] as { blocked: boolean } | undefined)?.blocked) throw invalidInvite();

    await tx
      .update(friendInvites)
      .set({ usedAt: new Date(), usedBy: userId })
      .where(eq(friendInvites.id, inv.id));
    const now = new Date();
    const [existing] = await tx
      .select({ status: friendships.status })
      .from(friendships)
      .where(pairWhere(inv.inviterId, userId));
    if (!existing) {
      await tx
        .insert(friendships)
        .values({ ...pair(inv.inviterId, userId), requestedBy: userId, status: 'PRIJATO', acceptedAt: now });
    } else if (existing.status === 'CEKA') {
      // starší nepotvrzená žádost mezi stejnou dvojicí: pozvánka ji rovnou potvrdí
      await tx
        .update(friendships)
        .set({ status: 'PRIJATO', acceptedAt: now })
        .where(and(pairWhere(inv.inviterId, userId), eq(friendships.status, 'CEKA')));
    }
    return inv.inviterId;
  });

  await enqueueNotification(inviterId, 'ZADOST_O_PRATELSTVI', userId);
  return { stav: 'PRATELE' as const };
}

/** Druhé ANO: potvrdí jen ten, kdo žádost dostal (hlídá to i RLS). */
export async function confirmFriend(userId: string, otherId: string) {
  await asUser(userId, async (tx) => {
    const rows = await tx
      .update(friendships)
      .set({ status: 'PRIJATO', acceptedAt: new Date() })
      .where(and(pairWhere(userId, otherId), eq(friendships.status, 'CEKA'), eq(friendships.requestedBy, otherId)))
      .returning({ a: friendships.userA });
    if (rows.length === 0) throw notFound('Žádost jsme nenašli.');
  });
  return { stav: 'PRATELE' as const };
}

/** Zrušení přátelství nebo odmítnutí žádosti. Druhá strana nedostane žádné oznámení. */
export async function removeFriend(userId: string, otherId: string) {
  await asUser(userId, (tx) => tx.delete(friendships).where(pairWhere(userId, otherId)));
}

export async function listFriends(userId: string) {
  return asUser(userId, async (tx) => {
    const rows = await tx
      .select({
        userA: friendships.userA,
        userB: friendships.userB,
        status: friendships.status,
        requestedBy: friendships.requestedBy,
      })
      .from(friendships)
      .where(or(eq(friendships.userA, userId), eq(friendships.userB, userId)));

    const result = [];
    for (const f of rows) {
      const otherId = f.userA === userId ? f.userB : f.userA;
      const [other] = await tx.select({ name: users.displayName }).from(users).where(eq(users.id, otherId));
      // RLS pustí fotku jen potvrzeným přátelům; u čekajících žádostí tu bude null.
      const [pic] = await tx.select({ image: avatars.image }).from(avatars).where(eq(avatars.userId, otherId));
      result.push({
        id: otherId,
        jmeno: other?.name ?? '',
        fotka: pic?.image ?? null,
        stav:
          f.status === 'PRIJATO' ? 'PRATELE' : f.requestedBy === userId ? 'CEKA_NA_NI_NEJ' : 'CEKA_NA_TEBE',
      });
    }
    return result;
  });
}

/**
 * Blokování: zruší přátelství, otevřené pozvánky mezi oběma a zabrání dalšímu kontaktu.
 * Blokovaný nedostane žádné oznámení.
 */
export async function blockUser(userId: string, targetId: string) {
  if (userId === targetId) throw new AppError(400, 'SAM_SEBE', 'Sám sebe zablokovat nejde.');
  await asUser(userId, async (tx) => {
    await tx.insert(blocks).values({ blockerId: userId, blockedId: targetId }).onConflictDoNothing();
    await tx.delete(friendships).where(pairWhere(userId, targetId));
    // Otevřené pozvánky do skupin od blokovaného mi už nepřijdou na řadu
    await tx
      .update(groupInvitations)
      .set({ status: 'ODMITNUTO', respondedAt: new Date() })
      .where(
        and(
          eq(groupInvitations.inviteeId, userId),
          eq(groupInvitations.inviterId, targetId),
          eq(groupInvitations.status, 'CEKA'),
        ),
      );
    await tx
      .update(restInvitations)
      .set({ status: 'TED_NE', respondedAt: new Date() })
      .where(
        and(
          eq(restInvitations.recipientId, userId),
          eq(restInvitations.senderId, targetId),
          eq(restInvitations.status, 'CEKA'),
        ),
      );
  });
}

export async function unblockUser(userId: string, targetId: string) {
  // Odblokování NEobnoví přátelství; k tomu je potřeba nová pozvánka.
  await asUser(userId, (tx) =>
    tx.delete(blocks).where(and(eq(blocks.blockerId, userId), eq(blocks.blockedId, targetId))),
  );
}

export interface ReportInput {
  reportedUserId?: string;
  reason: ReportReason;
  details?: string;
  contextType?: 'ping' | 'rest_invitation' | 'activity' | 'group' | 'profile';
  contextId?: string;
  alsoBlock?: boolean;
}

/** Nahlášení jde do interního systému podpory, kde ho řeší člověk z týmu. */
export async function reportUser(userId: string, input: ReportInput) {
  const id = crypto.randomUUID();
  // Uživatel svá nahlášení číst nesmí (ani kvůli limitu), proto počítá systém.
  const [{ n }] = await asSystem((tx) =>
    tx
      .select({ n: count() })
      .from(reports)
      .where(and(eq(reports.reporterId, userId), gte(reports.createdAt, sql`now() - interval '1 day'`))),
  );
  if (n >= LIMITS.reportsPerDay) throw tooMany();
  await asUser(userId, async (tx) => {
    await tx.insert(reports).values({
      id,
      reporterId: userId,
      reportedUserId: input.reportedUserId ?? null,
      reason: input.reason,
      details: input.details ?? null,
      contextType: input.contextType ?? null,
      contextId: input.contextId ?? null,
    });
  });
  if (input.alsoBlock && input.reportedUserId) await blockUser(userId, input.reportedUserId);
  // Nejlepší snaha hned; když podpora neodpoví, zkusí to znovu plánovač (dispatch).
  await forwardReport(id).catch(() => undefined);
  return { prijato: true, text: 'Díky. Nahlášení si přečte člověk z našeho týmu.' };
}
