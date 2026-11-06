// Osobní cíl tohoto týdne: „Tento týden 3 z 5 procházek“. Jen pro autora.
// Počítá se ze splněných chvilek v týdnu (pondělí až neděle, den začíná ve 4:00).
// Nesplněný cíl se nikam nepřenáší a nic nebere; nový týden začíná s čistým štítem.

import { and, count, eq, gte, lt } from 'drizzle-orm';
import { asUser, type Tx } from '../db/client.ts';
import { activities, personalGoals } from '../db/schema/index.ts';
import type { ActivityCategory } from '../domain/enums.ts';
import { CATEGORY_GENITIVE_PLURAL } from '../domain/labels.ts';
import { addDays, localDay, weekStart } from '../domain/time.ts';
import { loadSettings } from './settings.ts';

const ANY_NOUN = (n: number) => (n === 1 ? 'chvilky' : 'chvilek');

async function thisWeek(tx: Tx, userId: string) {
  const s = await loadSettings(tx, userId);
  const start = weekStart(localDay(new Date(), s.timezone));
  return { start, end: addDays(start, 7) };
}

export function presentPersonalGoal(category: ActivityCategory | null, done: number, target: number) {
  const noun = category ? CATEGORY_GENITIVE_PLURAL[category] : ANY_NOUN(target);
  const reached = done >= target;
  return {
    category,
    hotovo: done,
    cil: target,
    splneno: reached,
    text: reached ? `Máš to! ${done} z ${target} ${noun} tento týden.` : `Tento týden ${done} z ${target} ${noun}`,
  };
}

export async function getPersonalGoal(userId: string) {
  return asUser(userId, async (tx) => {
    const { start, end } = await thisWeek(tx, userId);
    const [goal] = await tx
      .select()
      .from(personalGoals)
      .where(and(eq(personalGoals.userId, userId), eq(personalGoals.weekStart, start)));
    if (!goal) return { cil: null };
    const [{ n }] = await tx
      .select({ n: count() })
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          eq(activities.status, 'SPLNENO'),
          gte(activities.localDay, start),
          lt(activities.localDay, end),
          goal.category ? eq(activities.category, goal.category) : undefined,
        ),
      );
    return { cil: presentPersonalGoal(goal.category, n, goal.targetCount) };
  });
}

/** Nastaví (nebo změní) cíl na tento týden. */
export async function setPersonalGoal(userId: string, input: { category: ActivityCategory | null; target: number }) {
  await asUser(userId, async (tx) => {
    const { start } = await thisWeek(tx, userId);
    await tx
      .insert(personalGoals)
      .values({ id: crypto.randomUUID(), userId, weekStart: start, category: input.category, targetCount: input.target })
      .onConflictDoUpdate({
        target: [personalGoals.userId, personalGoals.weekStart],
        set: { category: input.category, targetCount: input.target },
      });
  });
  return getPersonalGoal(userId);
}

export async function deletePersonalGoal(userId: string) {
  await asUser(userId, async (tx) => {
    const { start } = await thisWeek(tx, userId);
    await tx
      .delete(personalGoals)
      .where(and(eq(personalGoals.userId, userId), eq(personalGoals.weekStart, start)));
  });
}
