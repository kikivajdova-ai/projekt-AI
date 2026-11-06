// Skupiny („Chill crew“) a společné cíle. Ven jde jen součet skupiny, nikdy čísla po lidech.

import { and, count, eq, inArray } from 'drizzle-orm';
import { asSystem, asUser, isPermissionError, isUniqueViolation } from '../db/client.ts';
import {
  activities,
  groupGoalContributions,
  groupGoals,
  groupInvitations,
  groupMembers,
  groups,
  users,
} from '../db/schema/index.ts';
import type { ActivityCategory } from '../domain/enums.ts';
import { presentGroupGoal } from '../domain/groupGoal.ts';
import { localDay, weekStart } from '../domain/time.ts';
import { AppError, forbidden, notFound } from '../errors.ts';
import { enqueueNotification } from './notifications.ts';
import { loadSettings } from './settings.ts';

export async function createGroup(userId: string, name: string) {
  const id = crypto.randomUUID();
  await asUser(userId, async (tx) => {
    await tx.insert(groups).values({ id, name: name.trim(), createdBy: userId });
    await tx.insert(groupMembers).values({ groupId: id, userId, role: 'ZAKLADATEL' });
  });
  return { id, nazev: name.trim() };
}

export async function inviteToGroup(userId: string, groupId: string, friendId: string) {
  const id = crypto.randomUUID();
  try {
    await asUser(userId, (tx) =>
      tx.insert(groupInvitations).values({ id, groupId, inviterId: userId, inviteeId: friendId }),
    );
  } catch (e) {
    if (isPermissionError(e)) throw forbidden('Tohohle kamaráda teď do skupiny pozvat nejde.');
    if (isUniqueViolation(e)) throw new AppError(409, 'UZ_POZVAN', 'Pozvánka už čeká na odpověď.');
    throw e;
  }
  await enqueueNotification(friendId, 'POZVANKA_DO_SKUPINY', id);
  return { id };
}

/** Odmítnutí = jen stav, žádné vysvětlování a žádné oznámení odesílateli. */
export async function answerGroupInvite(userId: string, invitationId: string, accept: boolean) {
  await asUser(userId, async (tx) => {
    const [inv] = await tx
      .update(groupInvitations)
      .set({ status: accept ? 'PRIJATO' : 'ODMITNUTO', respondedAt: new Date() })
      .where(
        and(
          eq(groupInvitations.id, invitationId),
          eq(groupInvitations.inviteeId, userId),
          eq(groupInvitations.status, 'CEKA'),
        ),
      )
      .returning();
    if (!inv) throw notFound('Pozvánka už není aktuální.');
    if (accept) {
      try {
        await tx.insert(groupMembers).values({ groupId: inv.groupId, userId, role: 'CLEN' });
      } catch (e) {
        if (isPermissionError(e)) throw new AppError(409, 'SKUPINA_PLNA', 'Skupina je už plná.');
        throw e;
      }
    }
  });
  return { stav: accept ? 'CLEN' : 'ODMITNUTO' };
}

/** Odchod ze skupiny je tichý. Nikdo nedostane oznámení. */
export async function leaveGroup(userId: string, groupId: string) {
  await asUser(userId, (tx) =>
    tx.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))),
  );
}

export async function createGoal(
  userId: string,
  groupId: string,
  input: { category: ActivityCategory; target: number },
) {
  const id = crypto.randomUUID();
  await asUser(userId, async (tx) => {
    const s = await loadSettings(tx, userId);
    try {
      await tx.insert(groupGoals).values({
        id,
        groupId,
        category: input.category,
        targetCount: input.target,
        weekStart: weekStart(localDay(new Date(), s.timezone)),
        createdBy: userId,
      });
    } catch (e) {
      if (isPermissionError(e)) throw forbidden('Cíl může založit jen člen skupiny.');
      throw e;
    }
  });
  return getGoalProgress(userId, id);
}

/**
 * Součet skupiny. 1) Jako uživatel ověříme, že cíl vidím (jsem člen – hlídá RLS).
 * 2) Jako systém spočítáme JEDNO číslo. Žádné rozpady po lidech nikdy neopustí databázi.
 */
export async function getGoalProgress(userId: string, goalId: string) {
  const goal = await asUser(userId, async (tx) => {
    const [g] = await tx.select().from(groupGoals).where(eq(groupGoals.id, goalId));
    return g;
  });
  if (!goal) throw notFound();

  const together = await asSystem(async (tx) => {
    const [{ n }] = await tx
      .select({ n: count() })
      .from(groupGoalContributions)
      .innerJoin(activities, eq(activities.id, groupGoalContributions.activityId))
      .where(and(eq(groupGoalContributions.goalId, goalId), eq(activities.status, 'SPLNENO')));
    return n;
  });

  return presentGroupGoal({ goalId, category: goal.category, together, target: goal.targetCount });
}

export async function listMyGroups(userId: string) {
  const mine = await asUser(userId, async (tx) => {
    const rows = await tx
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .innerJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, userId)));
    const ids = rows.map((r) => r.id);
    const goals = ids.length
      ? await tx.select({ id: groupGoals.id, groupId: groupGoals.groupId }).from(groupGoals).where(inArray(groupGoals.groupId, ids))
      : [];
    const members = ids.length
      ? await tx
          .select({ groupId: groupMembers.groupId, userId: groupMembers.userId, name: users.displayName })
          .from(groupMembers)
          .innerJoin(users, eq(users.id, groupMembers.userId))
          .where(inArray(groupMembers.groupId, ids))
      : [];
    return { rows, goals, members };
  });

  return Promise.all(
    mine.rows.map(async (g) => ({
      id: g.id,
      nazev: g.name,
      // Jména členů ano (je to skupina kamarádů), ale bez jakýchkoli čísel u jmen.
      // id kvůli blokování a nahlášení člena
      clenove: mine.members.filter((m) => m.groupId === g.id).map((m) => ({ id: m.userId, jmeno: m.name })),
      cile: await Promise.all(
        mine.goals.filter((x) => x.groupId === g.id).map((x) => getGoalProgress(userId, x.id)),
      ),
    })),
  );
}
