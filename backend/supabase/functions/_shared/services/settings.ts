import { eq } from 'drizzle-orm';
import type { Tx } from '../db/client.ts';
import { userSettings } from '../db/schema/index.ts';
import { NOTIFICATION_DEFAULTS } from '../domain/config.ts';
import { AppError } from '../errors.ts';

export interface Settings {
  timezone: string;
  gameEnabled: boolean;
  shareBadges: boolean;
  receivePings: boolean;
  receiveRestInvites: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  autoShareFriends: boolean;
}

/** Nastavení uživatele. Funguje v asUser (vlastní) i asSystem (kvůli nočnímu klidu příjemce). */
export async function loadSettings(tx: Tx, userId: string): Promise<Settings> {
  const [row] = await tx.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  if (!row) throw new AppError(409, 'CHYBI_PROFIL', 'Nejdřív si dokonči profil.');
  return {
    timezone: row.timezone ?? NOTIFICATION_DEFAULTS.timezone,
    gameEnabled: row.gameEnabled,
    shareBadges: row.shareBadges,
    receivePings: row.receivePings,
    receiveRestInvites: row.receiveRestInvites,
    quietHoursEnabled: row.quietHoursEnabled,
    // Postgres vrací time jako 'HH:MM:SS'
    quietStart: row.quietStart.slice(0, 5),
    quietEnd: row.quietEnd.slice(0, 5),
    autoShareFriends: row.autoShareFriends,
  };
}
