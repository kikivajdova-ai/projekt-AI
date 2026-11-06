// Vlastní chvilky: člověk si napíše, co mu dělá dobře, a na domovské obrazovce
// se mu objeví jako další úkol. Název vidí jen on sám (hlídá to RLS).

import { asc, count, eq } from 'drizzle-orm';
import { asUser } from '../db/client.ts';
import { customActivities } from '../db/schema/index.ts';
import { LIMITS } from '../domain/config.ts';
import { tooMany } from '../errors.ts';

export async function listCustomActivities(userId: string) {
  return asUser(userId, async (tx) => {
    const rows = await tx
      .select({ id: customActivities.id, nazev: customActivities.title })
      .from(customActivities)
      .where(eq(customActivities.userId, userId))
      .orderBy(asc(customActivities.createdAt));
    return rows;
  });
}

export async function createCustomActivity(userId: string, title: string) {
  const nazev = title.trim().replace(/\s+/g, ' ');
  const id = crypto.randomUUID();
  await asUser(userId, async (tx) => {
    const [{ n }] = await tx
      .select({ n: count() })
      .from(customActivities)
      .where(eq(customActivities.userId, userId));
    if (n >= LIMITS.maxCustomActivities) {
      throw tooMany('Vlastních chvilek už máš hodně. Některou odeber a pak přidej novou.');
    }
    await tx.insert(customActivities).values({ id, userId, title: nazev });
  });
  return { id, nazev };
}

/** Odebrání z nabídky. Už zapsané chvilky zůstanou (v zahradě nic nezmizí). */
export async function deleteCustomActivity(userId: string, id: string) {
  await asUser(userId, (tx) => tx.delete(customActivities).where(eq(customActivities.id, id)));
}
