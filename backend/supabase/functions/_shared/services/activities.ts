// Odpočinkové chvíle, náhled sdílení a feed přátel.

import { and, desc, eq, inArray, lt, ne } from 'drizzle-orm';
import { asUser, isPermissionError, isUniqueViolation, type Tx } from '../db/client.ts';
import {
  activities,
  customActivities,
  groupGoalContributions,
  groups,
  restInvitations,
  users,
} from '../db/schema/index.ts';
import type { ActivityCategory, Visibility } from '../domain/enums.ts';
import { LIMITS } from '../domain/config.ts';
import { CATEGORY_LABEL, GAME_TEXT } from '../domain/labels.ts';
import { localDay } from '../domain/time.ts';
import { signSharePreview, verifySharePreview } from '../domain/tokens.ts';
import { describeAudience, toSharedMomentView } from '../domain/visibility.ts';
import { sharePreviewSecret } from '../env.ts';
import { AppError, forbidden, notFound } from '../errors.ts';
import { awardBadges, badgeAwardText, getGameState } from './game.ts';
import { loadSettings } from './settings.ts';

export interface LogMomentInput {
  id: string;
  category: ActivityCategory;
  done: boolean;
  occurredAt?: Date;
  restInvitationId?: string;
  goalIds?: string[];
  /** Vlastní chvilka; kategorie je pak vždy JINE. */
  customActivityId?: string;
}

/** Čím odpovídáme autorovi o jeho vlastní chvíli. Název vlastní chvilky jen jemu. */
function ownView(a: typeof activities.$inferSelect, customTitle?: string | null) {
  return {
    id: a.id,
    category: a.category,
    customActivityId: a.customActivityId,
    label: customTitle ?? CATEGORY_LABEL[a.category],
    status: a.status,
    visibility: a.visibility,
    crewId: a.crewId,
    day: a.localDay,
  };
}

/**
 * Zapíše chvíli. Viditelnost se z požadavku vůbec nečte: nový záznam je vždy JEN_JA
 * (a databáze by jiný ani nepřijala). Stejné id odeslané znovu = žádný duplikát.
 */
export async function logMoment(userId: string, input: LogMomentInput) {
  const occurredAt = input.occurredAt ?? new Date();
  if (occurredAt.getTime() > Date.now() + 5 * 60_000) {
    throw new AppError(400, 'BUDOUCNOST', 'Chvilku z budoucnosti zapsat nejde.');
  }
  // Zpětně jde zapsat nanejvýš 2 dny (zapomenutý včerejšek ano, „nafarmení“ minulého měsíce ne).
  if (occurredAt.getTime() < Date.now() - LIMITS.maxBackdateHours * 3_600_000) {
    throw new AppError(400, 'MOC_STARE', 'Zapsat jde jen chvilku z dneška nebo ze dvou předchozích dnů.');
  }

  const activity = await asUser(userId, async (tx) => {
    const s = await loadSettings(tx, userId);

    let customTitle: string | null = null;
    if (input.customActivityId) {
      // RLS ukáže jen moje vlastní chvilky; cizí id = nenalezeno (a databáze by ho ani nevložila).
      const [c] = await tx
        .select({ title: customActivities.title })
        .from(customActivities)
        .where(eq(customActivities.id, input.customActivityId));
      if (!c) throw notFound('Tuhle vlastní chvilku jsme nenašli.');
      customTitle = c.title;
    }

    if (input.restInvitationId) {
      const [inv] = await tx
        .select({ status: restInvitations.status })
        .from(restInvitations)
        .where(eq(restInvitations.id, input.restInvitationId));
      if (inv?.status !== 'PRIDAM_SE') throw notFound('Tuhle společnou chvilku jsme nenašli.');
    }

    await insertOnce(() => tx
      .insert(activities)
      .values({
        id: input.id,
        userId,
        category: input.customActivityId ? 'JINE' : input.category,
        customActivityId: input.customActivityId ?? null,
        status: input.done ? 'SPLNENO' : 'NAPLANOVANO',
        visibility: 'JEN_JA',
        crewId: null,
        restInvitationId: input.restInvitationId ?? null,
        timezone: s.timezone,
        localDay: localDay(occurredAt, s.timezone),
        completedAt: input.done ? occurredAt : null,
      })
      .onConflictDoNothing({ target: activities.id }));

    const [row] = await tx.select().from(activities).where(eq(activities.id, input.id));
    // id existuje, ale patří někomu jinému (RLS ho neukáže) -> konflikt
    if (!row || row.userId !== userId) throw new AppError(409, 'KONFLIKT_ID', 'Zkus to prosím znovu.');

    const counted = row.status === 'SPLNENO' ? await contribute(tx, userId, row.id, input.goalIds ?? []) : [];
    // Nový záznam vzniká vždy jako „Jen já“ (hlídá RLS). Kdo si v nastavení vědomě zapnul
    // automatické sdílení s přáteli, tomu ho hned v téže transakci nasdílíme. Jen splněné chvilky;
    // přátelé uvidí druh chvilky a den, název vlastní chvilky ani nálada se nesdílí nikdy.
    let saved = row;
    if (row.status === 'SPLNENO' && s.autoShareFriends) {
      const [shared] = await tx
        .update(activities)
        .set({ visibility: 'PRATELE', crewId: null, sharedAt: new Date() })
        .where(and(eq(activities.id, row.id), eq(activities.userId, userId)))
        .returning();
      if (shared) saved = shared;
    }
    return { row: saved, counted, customTitle };
  });

  return afterMoment(userId, activity.row, activity.counted, activity.customTitle);
}

export async function completeMoment(userId: string, activityId: string, goalIds: string[] = []) {
  const activity = await asUser(userId, async (tx) => {
    const s = await loadSettings(tx, userId);
    const now = new Date();
    // Den se přepočítá na den SPLNĚNÍ (kvůli stropům a týdennímu cíli skupiny).
    const [row] = await tx
      .update(activities)
      .set({ status: 'SPLNENO', completedAt: now, localDay: localDay(now, s.timezone) })
      .where(and(eq(activities.id, activityId), eq(activities.userId, userId), eq(activities.status, 'NAPLANOVANO')))
      .returning();
    const result = row ?? (await tx.select().from(activities).where(eq(activities.id, activityId)))[0];
    if (!result || result.userId !== userId) throw notFound();
    const counted = result.status === 'SPLNENO' ? await contribute(tx, userId, activityId, goalIds) : [];
    return { row: result, counted };
  });
  return afterMoment(userId, activity.row, activity.counted);
}

/**
 * Započítá chvíli do skupinových cílů. Každý cíl zvlášť v savepointu: když jeden
 * neprojde (jiný druh odpočinku, jiný týden, už nejsem ve skupině), chvíle se i tak uloží.
 */
async function contribute(tx: Tx, userId: string, activityId: string, goalIds: string[]): Promise<string[]> {
  const counted: string[] = [];
  for (const goalId of new Set(goalIds)) {
    try {
      await tx.transaction((sp) =>
        sp.insert(groupGoalContributions).values({ goalId, activityId, userId }).onConflictDoNothing(),
      );
      counted.push(goalId);
    } catch (e) {
      if (!isPermissionError(e)) throw e;
    }
  }
  // Aplikace pozná, kam se chvíle opravdu započítala (nic se tiše neztratí).
  return counted;
}

/** Jedna přijatá pozvánka = jedna společná chvíle na člověka. */
async function insertOnce(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError(409, 'UZ_ZAPSANO', 'Tuhle společnou chvilku už máš zapsanou.');
    throw e;
  }
}

async function afterMoment(
  userId: string,
  activity: typeof activities.$inferSelect,
  countedGoals: string[] = [],
  customTitle: string | null = null,
) {
  if (activity.status !== 'SPLNENO') {
    return { chvile: ownView(activity, customTitle), zprava: GAME_TEXT.momentSaved, zapocitanoDoCilu: [] };
  }
  const newBadges = await awardBadges(userId);
  const game = await getGameState(userId);
  return {
    chvile: ownView(activity, customTitle),
    zapocitanoDoCilu: countedGoals,
    zprava: game.hraZapnuta && game.zprava ? game.zprava : GAME_TEXT.momentSaved,
    hra: game,
    noveOdznaky: game.hraZapnuta ? newBadges.map((code) => ({ code, text: badgeAwardText(code) })) : [],
  };
}

interface ShareTarget {
  visibility: Visibility;
  crewId: string | null;
}

/** Náhled: přesně to, co uvidí ostatní, + podepsaný token platný 10 minut. */
export async function sharePreview(userId: string, activityId: string, target: ShareTarget) {
  return asUser(userId, async (tx) => {
    const [a] = await tx
      .select()
      .from(activities)
      .where(and(eq(activities.id, activityId), eq(activities.userId, userId)));
    if (!a) throw notFound();
    const [me] = await tx.select({ name: users.displayName }).from(users).where(eq(users.id, userId));

    let crewName: string | undefined;
    if (target.visibility === 'CHILL_CREW') {
      if (!target.crewId) throw new AppError(400, 'CHYBI_SKUPINA', 'Vyber skupinu.');
      const [g] = await tx.select({ name: groups.name }).from(groups).where(eq(groups.id, target.crewId));
      if (!g) throw forbidden('Sdílet jde jen se skupinou, ve které jsi.');
      crewName = g.name;
    }

    const nahled =
      target.visibility === 'JEN_JA'
        ? null
        : toSharedMomentView({
            id: a.id,
            authorName: me?.name ?? '',
            category: a.category,
            localDay: a.localDay,
            visibility: target.visibility,
            crewId: target.crewId,
          });

    const previewToken = await signSharePreview(
      sharePreviewSecret(),
      { activityId, userId, visibility: target.visibility, crewId: target.crewId },
      LIMITS.sharePreviewTtlSeconds,
    );
    return {
      nahled,
      publikum: describeAudience(target.visibility, crewName),
      poznamka: a.status === 'SPLNENO' ? null : 'Ostatní ji uvidí, až ji označíš jako hotovou.',
      previewToken,
    };
  });
}

/** Sdílení až po náhledu: bez platného tokenu z náhledu se viditelnost nezmění. */
export async function share(userId: string, activityId: string, target: ShareTarget & { previewToken: string }) {
  if (target.visibility === 'JEN_JA') return unshare(userId, activityId);
  const ok = await verifySharePreview(sharePreviewSecret(), target.previewToken, {
    activityId,
    userId,
    visibility: target.visibility,
    crewId: target.crewId,
  });
  if (!ok) throw new AppError(400, 'NAHLED_NEPLATNY', 'Podívej se prosím znovu na náhled, než to nasdílíš.');

  return asUser(userId, async (tx) => {
    try {
      const [row] = await tx
        .update(activities)
        .set({ visibility: target.visibility, crewId: target.crewId, sharedAt: new Date() })
        .where(and(eq(activities.id, activityId), eq(activities.userId, userId)))
        .returning();
      if (!row) throw notFound();
      return { chvile: ownView(row) };
    } catch (e) {
      if (isPermissionError(e)) throw forbidden('Sdílet jde jen se skupinou, ve které jsi.');
      throw e;
    }
  });
}

/** Zrušení sdílení platí okamžitě pro všechny (je to stav v databázi, ne v telefonu). */
export async function unshare(userId: string, activityId: string) {
  return asUser(userId, async (tx) => {
    const [row] = await tx
      .update(activities)
      .set({ visibility: 'JEN_JA', crewId: null, sharedAt: null })
      .where(and(eq(activities.id, activityId), eq(activities.userId, userId)))
      .returning();
    if (!row) throw notFound();
    return { chvile: ownView(row) };
  });
}

export async function deleteMoment(userId: string, activityId: string) {
  await asUser(userId, (tx) =>
    tx.delete(activities).where(and(eq(activities.id, activityId), eq(activities.userId, userId))),
  );
}

export async function listOwnMoments(userId: string, limit = 50) {
  return asUser(userId, async (tx) => {
    const rows = await tx
      .select({ a: activities, title: customActivities.title })
      .from(activities)
      .leftJoin(customActivities, eq(customActivities.id, activities.customActivityId))
      .where(eq(activities.userId, userId))
      .orderBy(desc(activities.createdAt))
      .limit(limit);
    return rows.map((r) => ownView(r.a, r.title));
  });
}

/**
 * Feed přátel a skupin: VÝHRADNĚ splněné chvíle. Filtr status = 'SPLNENO' je tady
 * i v RLS politice (dvojitá pojistka). Vrací jen bezpečná pole (SharedMomentView).
 * Neexistuje varianta, která by ukázala, co kdo neudělal.
 */
export async function friendsFeed(userId: string, opts: { before?: Date; limit?: number } = {}) {
  const limit = Math.min(opts.limit ?? 30, 50);
  return asUser(userId, async (tx) => {
    const rows = await tx
      .select({
        id: activities.id,
        category: activities.category,
        localDay: activities.localDay,
        visibility: activities.visibility,
        crewId: activities.crewId,
        authorName: users.displayName,
      })
      .from(activities)
      .innerJoin(users, eq(users.id, activities.userId))
      .where(
        and(
          ne(activities.userId, userId),
          eq(activities.status, 'SPLNENO'),
          inArray(activities.visibility, ['PRATELE', 'CHILL_CREW']),
          opts.before ? lt(activities.completedAt, opts.before) : undefined,
        ),
      )
      .orderBy(desc(activities.completedAt))
      .limit(limit);
    return rows.map(toSharedMomentView);
  });
}
