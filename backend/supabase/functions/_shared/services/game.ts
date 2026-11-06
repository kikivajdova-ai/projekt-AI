// Herní stav a odznaky. Všechno se počítá z událostí v databázi (splněné chvíle,
// odeslaná povzbuzení). Telefon nemůže poslat „mám 50 bodů“, nemá kam.

import { and, eq } from 'drizzle-orm';
import { asSystem, asUser, type Tx } from '../db/client.ts';
import { activities, badges, pings, restInvitations, userBadges } from '../db/schema/index.ts';
import { BADGE_CATALOG, earnedBadges } from '../domain/badges.ts';
import type { BadgeCode } from '../domain/enums.ts';
import { computeGameState, type GameEvent } from '../domain/game.ts';
import { GAME_TEXT } from '../domain/labels.ts';
import { localDay } from '../domain/time.ts';
import { loadSettings } from './settings.ts';
import { enqueueNotification } from './notifications.ts';

/** Události jednoho člověka. Funguje v asUser (vlastní data) i v asSystem. */
export async function loadGameEvents(tx: Tx, userId: string): Promise<GameEvent[]> {
  const moments = await tx
    .select({
      id: activities.id,
      localDay: activities.localDay,
      category: activities.category,
      inviteStatus: restInvitations.status,
    })
    .from(activities)
    .leftJoin(restInvitations, eq(activities.restInvitationId, restInvitations.id))
    .where(and(eq(activities.userId, userId), eq(activities.status, 'SPLNENO')));

  const sent = await tx
    .select({ id: pings.id, localDay: pings.senderLocalDay })
    .from(pings)
    .where(eq(pings.senderId, userId));

  return [
    ...moments.map((m) => ({
      type: 'MOMENT' as const,
      id: m.id,
      localDay: m.localDay,
      category: m.category,
      joint: m.inviteStatus === 'PRIDAM_SE',
    })),
    ...sent.map((p) => ({ type: 'PING_SENT' as const, id: p.id, localDay: p.localDay })),
  ];
}

export async function getGameState(userId: string) {
  return asUser(userId, async (tx) => {
    const s = await loadSettings(tx, userId);
    // Vypnutá hra: žádná čísla, žádná připomínka, ať si ji zapne. Data zůstávají.
    if (!s.gameEnabled) return { hraZapnuta: false as const };

    const today = localDay(new Date(), s.timezone);
    const state = computeGameState(await loadGameEvents(tx, userId), today);
    const owned = await tx
      .select({ code: userBadges.badgeCode, awardedAt: userBadges.awardedAt, name: badges.name })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeCode, badges.code))
      .where(eq(userBadges.userId, userId));

    return {
      hraZapnuta: true as const,
      uroven: state.level,
      // Body posíláme kvůli zahradě a ukazateli úrovně; UI je nemá zobrazovat jako skóre.
      body: state.points,
      dalsiUrovenPri: state.nextLevelAt,
      chvilekTentoTyden: state.momentsThisWeek,
      tydnuSRytmem: state.rhythmWeeksTotal,
      zprava: state.welcomeBack ? GAME_TEXT.welcomeBack : state.dailyCapReached ? GAME_TEXT.dailyCap : null,
      odznaky: owned,
    };
  });
}

/**
 * Doplní odznaky, které si člověk zasloužil a ještě nemá. Idempotentní: při opakovaném
 * volání nic nezdvojí (primární klíč user_id + badge_code a ON CONFLICT DO NOTHING).
 * Volat PO dokončení transakce uživatele, aby systém viděl novou událost.
 */
export async function awardBadges(userId: string): Promise<BadgeCode[]> {
  const awarded = await asSystem(async (tx) => {
    const earned = earnedBadges(await loadGameEvents(tx, userId));
    if (earned.size === 0) return [];
    const inserted = await tx
      .insert(userBadges)
      .values([...earned].map((badgeCode) => ({ userId, badgeCode })))
      .onConflictDoNothing()
      .returning({ code: userBadges.badgeCode });
    return inserted.map((r) => r.code);
  });
  for (const code of awarded) await enqueueNotification(userId, 'ODZNAK', crypto.randomUUID());
  return awarded;
}

export function badgeAwardText(code: BadgeCode): string {
  return BADGE_CATALOG.find((b) => b.code === code)?.awardText ?? '';
}
