// Záznamy nálady a stresu = údaje o zdraví. Jen vlastník, jen s výslovným souhlasem,
// bez herních prvků. Nejnižší nálada spustí nabídku pomoci (jediný spouštěč; texty
// aplikace nečte ani nevyhodnocuje).

import { and, desc, eq } from 'drizzle-orm';
import { asUser, isPermissionError } from '../db/client.ts';
import { wellbeingCheckins } from '../db/schema/index.ts';
import { MOOD_MIN } from '../domain/config.ts';
import { GAME_TEXT } from '../domain/labels.ts';
import { localDay } from '../domain/time.ts';
import { AppError } from '../errors.ts';
import { loadSettings } from './settings.ts';

export async function createCheckin(userId: string, input: { id: string; mood: number; stress?: number }) {
  try {
    await asUser(userId, async (tx) => {
      const s = await loadSettings(tx, userId);
      await tx
        .insert(wellbeingCheckins)
        .values({
          id: input.id,
          userId,
          mood: input.mood,
          stress: input.stress ?? null,
          localDay: localDay(new Date(), s.timezone),
        })
        .onConflictDoNothing();
    });
  } catch (e) {
    if (isPermissionError(e)) {
      throw new AppError(403, 'CHYBI_SOUHLAS', 'Abychom mohli náladu ukládat, potřebujeme tvůj souhlas.');
    }
    throw e;
  }
  const offerSupport = input.mood === MOOD_MIN;
  // Záměrně: žádné body, odznaky ani oslavy. Herní vrstva o náladě vůbec neví.
  return { ulozeno: true, nabidnoutPomoc: offerSupport, zprava: offerSupport ? GAME_TEXT.support : null };
}

export async function listCheckins(userId: string, limit = 400) {
  return asUser(userId, (tx) =>
    tx
      .select({ id: wellbeingCheckins.id, mood: wellbeingCheckins.mood, stress: wellbeingCheckins.stress, day: wellbeingCheckins.localDay })
      .from(wellbeingCheckins)
      .where(eq(wellbeingCheckins.userId, userId))
      .orderBy(desc(wellbeingCheckins.createdAt))
      .limit(limit),
  );
}

export async function deleteCheckin(userId: string, id: string) {
  await asUser(userId, (tx) =>
    tx.delete(wellbeingCheckins).where(and(eq(wellbeingCheckins.id, id), eq(wellbeingCheckins.userId, userId))),
  );
}
