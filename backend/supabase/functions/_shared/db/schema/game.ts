// Odznaky za péči. Katalog (badges) plní migrace z domain/badges.ts (scripts/vytvor-migrace.mjs),
// udělené odznaky (user_badges) zapisuje jen app_system po výpočtu z událostí.
// Body ani úrovně se NEUKLÁDAJÍ: počítají se z událostí (viz domain/game.ts),
// takže v databázi neexistuje žádné počítadlo série, které by šlo vynulovat.

import { sql } from 'drizzle-orm';
import { pgPolicy, pgTable, primaryKey, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { appSystem, appUser, badgeCodeEnum, uid } from './common.ts';
import { users } from './users.ts';

export const badges = pgTable(
  'badges',
  {
    code: badgeCodeEnum('code').primaryKey(),
    name: varchar('name', { length: 60 }).notNull(),
    description: text('description').notNull(),
  },
  () => [
    pgPolicy('badges: katalog vidí každý přihlášený', {
      for: 'select',
      to: [appUser, appSystem],
      using: sql`true`,
    }),
  ],
);

export const userBadges = pgTable(
  'user_badges',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    badgeCode: badgeCodeEnum('badge_code')
      .notNull()
      .references(() => badges.code),
    awardedAt: timestamp('awarded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.badgeCode] }),
    pgPolicy('user_badges: vidím své', {
      for: 'select',
      to: appUser,
      using: sql`${t.userId} = ${uid}`,
    }),
    pgPolicy('user_badges: přátelé jen když je majitel sdílí', {
      for: 'select',
      to: appUser,
      using: sql`private.are_friends(${t.userId}) and private.shares_badges(${t.userId})`,
    }),
    pgPolicy('user_badges: uděluje jen systém', {
      for: 'insert',
      to: appSystem,
      withCheck: sql`true`,
    }),
    pgPolicy('user_badges: systém ví, co už je uděleno', {
      for: 'select',
      to: appSystem,
      using: sql`true`,
    }),
  ],
);
