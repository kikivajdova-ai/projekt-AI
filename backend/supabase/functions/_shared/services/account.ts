// Profil, nastavení, souhlasy, export a smazání účtu (GDPR čl. 15, 17, 20).
//
// Registrace a přihlášení (e-mail + heslo) řeší Supabase Auth přímo z aplikace.
// Po prvním přihlášení si aplikace zavolá createProfile s přezdívkou. Profil se
// zakládá takhle, ne triggerem: databáze nemá žádné triggery.

import { and, eq, or } from 'drizzle-orm';
import { asUser } from '../db/client.ts';
import {
  activities,
  blocks,
  consents,
  friendInvites,
  friendships,
  groupGoalContributions,
  groupInvitations,
  groupMembers,
  pushTokens,
  pings,
  restInvitations,
  userBadges,
  userSettings,
  users,
  wellbeingCheckins,
} from '../db/schema/index.ts';
import type { ConsentType } from '../domain/enums.ts';
import { isValidTimeZone } from '../domain/time.ts';
import { requireEnv } from '../env.ts';
import { AppError } from '../errors.ts';
import { loadSettings, type Settings } from './settings.ts';

export async function createProfile(userId: string, input: { displayName: string; timezone?: string }) {
  const timezone = input.timezone && isValidTimeZone(input.timezone) ? input.timezone : 'Europe/Prague';
  await asUser(userId, async (tx) => {
    await tx.insert(users).values({ id: userId, displayName: input.displayName.trim() }).onConflictDoNothing();
    // Výchozí nastavení: noční klid ZAPNUTÝ, odznaky NEsdílené (viz schéma).
    await tx.insert(userSettings).values({ userId, timezone }).onConflictDoNothing();
  });
  return getMe(userId);
}

export async function getMe(userId: string) {
  return asUser(userId, async (tx) => {
    const [me] = await tx.select().from(users).where(eq(users.id, userId));
    if (!me) return { profil: null };
    const own = await tx.select().from(consents).where(eq(consents.userId, userId));
    return {
      profil: { id: me.id, prezdivka: me.displayName },
      nastaveni: await loadSettings(tx, userId),
      souhlasy: own.map((c) => ({ typ: c.type, platny: c.revokedAt === null })),
    };
  });
}

export async function updateDisplayName(userId: string, displayName: string) {
  await asUser(userId, (tx) => tx.update(users).set({ displayName: displayName.trim() }).where(eq(users.id, userId)));
}

export async function updateSettings(userId: string, patch: Partial<Settings>) {
  if (patch.timezone && !isValidTimeZone(patch.timezone)) {
    throw new AppError(400, 'PASMO', 'Neznámé časové pásmo.');
  }
  await asUser(userId, (tx) =>
    tx
      .update(userSettings)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId)),
  );
  return getMe(userId);
}

/** Souhlas jde odvolat stejně snadno, jako se uděluje. */
export async function setConsent(userId: string, type: ConsentType, granted: boolean) {
  await asUser(userId, async (tx) => {
    if (granted) {
      await tx
        .insert(consents)
        .values({ userId, type })
        .onConflictDoUpdate({
          target: [consents.userId, consents.type],
          set: { grantedAt: new Date(), revokedAt: null },
        });
    } else {
      await tx
        .update(consents)
        .set({ revokedAt: new Date() })
        .where(and(eq(consents.userId, userId), eq(consents.type, type)));
    }
  });
  return getMe(userId);
}

/** Export všech vlastních dat (čl. 15 a 20 GDPR). Jen data, která patří tomuto člověku. */
export async function exportData(userId: string) {
  return asUser(userId, async (tx) => ({
    vygenerovano: new Date().toISOString(),
    profil: await tx.select().from(users).where(eq(users.id, userId)),
    nastaveni: await tx.select().from(userSettings).where(eq(userSettings.userId, userId)),
    souhlasy: await tx.select().from(consents).where(eq(consents.userId, userId)),
    nalada: await tx.select().from(wellbeingCheckins).where(eq(wellbeingCheckins.userId, userId)),
    chvile: await tx.select().from(activities).where(eq(activities.userId, userId)),
    odznaky: await tx.select().from(userBadges).where(eq(userBadges.userId, userId)),
    pratelstvi: await tx
      .select()
      .from(friendships)
      .where(or(eq(friendships.userA, userId), eq(friendships.userB, userId))),
    blokovani: await tx.select().from(blocks).where(eq(blocks.blockerId, userId)),
    skupiny: await tx.select().from(groupMembers).where(eq(groupMembers.userId, userId)),
    pozvankyDoSkupin: await tx
      .select()
      .from(groupInvitations)
      .where(or(eq(groupInvitations.inviterId, userId), eq(groupInvitations.inviteeId, userId))),
    prispevkyKCilum: await tx.select().from(groupGoalContributions).where(eq(groupGoalContributions.userId, userId)),
    pozvankyPratel: await tx
      .select({ id: friendInvites.id, vytvoreno: friendInvites.createdAt, platiDo: friendInvites.expiresAt })
      .from(friendInvites)
      .where(eq(friendInvites.inviterId, userId)),
    zarizeni: await tx
      .select({ platforma: pushTokens.platform, pridano: pushTokens.createdAt })
      .from(pushTokens)
      .where(eq(pushTokens.userId, userId)),
    // Nahlášení, která člověk podal, smí číst jen podpora; na vyžádání je vydá tým (čl. 15 GDPR).
    povzbuzeni: await tx
      .select()
      .from(pings)
      .where(or(eq(pings.senderId, userId), eq(pings.recipientId, userId))),
    pozvankyKOdpocinku: await tx
      .select()
      .from(restInvitations)
      .where(or(eq(restInvitations.senderId, userId), eq(restInvitations.recipientId, userId))),
  }));
}

/**
 * Smazání účtu (čl. 17 GDPR). Smaže uživatele v Supabase Auth; díky ON DELETE CASCADE
 * zmizí všechna jeho data ve všech tabulkách včetně push tokenů a fronty notifikací.
 * Nahlášení zůstanou bez vazby na účet (bezpečnost ostatních).
 * Service role klíč je jen tady na serveru, nikdy v aplikaci.
 */
export async function deleteAccount(userId: string) {
  const res = await fetch(`${requireEnv('SUPABASE_URL')}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      apikey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      authorization: `Bearer ${requireEnv('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
  });
  if (!res.ok) throw new AppError(500, 'SMAZANI_SELHALO', 'Účet se nepodařilo smazat. Zkus to prosím znovu.');
  return { smazano: true };
}
