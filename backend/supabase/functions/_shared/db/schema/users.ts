// Profily, nastavení, souhlasy a citlivé záznamy nálady.
//
// Profil je rozdělený na dvě tabulky záměrně:
//  - `users` = to málo, co smí vidět přátelé (přezdívka). Nic jiného tu není.
//  - `user_settings` = jen vlastník (např. vypnutá hra – „vypnutí ostatní nevidí“).
// RLS totiž hlídá řádky, ne sloupce; kdyby bylo nastavení v `users`, přátelé by ho viděli.
//
// NEEXISTUJE politika, která by dovolila číst profil cizího člověka. Globální vyhledávání
// proto nejde postavit ani obejitím API – databáze cizí profily prostě nevydá.

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  pgPolicy,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uuid,
  date,
  varchar,
  index,
} from 'drizzle-orm/pg-core';
import { authUsers } from 'drizzle-orm/supabase';
import { appSystem, appUser, consentTypeEnum, uid } from './common.ts';

export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    displayName: varchar('display_name', { length: 40 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('users_display_name_not_blank', sql`length(trim(${t.displayName})) between 1 and 40`),
    pgPolicy('users: vidím sebe, přátele, žádosti a spolučleny skupin', {
      for: 'select',
      to: appUser,
      using: sql`${t.id} = ${uid} or private.is_connected(${t.id}) or private.shares_group(${t.id})`,
    }),
    pgPolicy('users: založím jen svůj profil', {
      for: 'insert',
      to: appUser,
      withCheck: sql`${t.id} = ${uid}`,
    }),
    pgPolicy('users: měním jen svůj profil', {
      for: 'update',
      to: appUser,
      using: sql`${t.id} = ${uid}`,
      withCheck: sql`${t.id} = ${uid}`,
    }),
    pgPolicy('users: systém čte přezdívku (náhled pozvánky)', {
      for: 'select',
      to: appSystem,
      using: sql`true`,
    }),
  ],
);

export const userSettings = pgTable(
  'user_settings',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    timezone: text('timezone').notNull().default('Europe/Prague'),
    gameEnabled: boolean('game_enabled').notNull().default(true),
    shareBadges: boolean('share_badges').notNull().default(false),
    receivePings: boolean('receive_pings').notNull().default(true),
    receiveRestInvites: boolean('receive_rest_invites').notNull().default(true),
    // Noční klid je ve výchozím stavu ZAPNUTÝ.
    quietHoursEnabled: boolean('quiet_hours_enabled').notNull().default(true),
    quietStart: time('quiet_start').notNull().default('22:00'),
    quietEnd: time('quiet_end').notNull().default('08:00'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    pgPolicy('user_settings: jen vlastník', {
      for: 'all',
      to: appUser,
      using: sql`${t.userId} = ${uid}`,
      withCheck: sql`${t.userId} = ${uid}`,
    }),
    pgPolicy('user_settings: systém čte (noční klid, časové pásmo)', {
      for: 'select',
      to: appSystem,
      using: sql`true`,
    }),
  ],
);

/** Výslovné souhlasy (GDPR čl. 9 pro údaje o zdraví). Odvolání = vyplněné revoked_at. */
export const consents = pgTable(
  'consents',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: consentTypeEnum('type').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.type] }),
    pgPolicy('consents: jen vlastník', {
      for: 'all',
      to: appUser,
      using: sql`${t.userId} = ${uid}`,
      withCheck: sql`${t.userId} = ${uid}`,
    }),
  ],
);

/**
 * Nálada a stres = údaje o zdraví. Nejpřísnější tabulka v databázi:
 *  - čte a zapisuje JEN vlastník, žádná výjimka pro přátele, skupiny ani app_system,
 *  - nemá sloupec viditelnosti, takže nejde sdílet ani omylem,
 *  - zápis projde, jen když existuje platný výslovný souhlas,
 *  - nemá žádný volný text (minimalizace dat).
 */
export const wellbeingCheckins = pgTable(
  'wellbeing_checkins',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mood: smallint('mood').notNull(),
    stress: smallint('stress'),
    localDay: date('local_day', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('wellbeing_checkins_user_idx').on(t.userId, t.createdAt),
    check('wellbeing_checkins_mood_range', sql`${t.mood} between 1 and 5`),
    check('wellbeing_checkins_stress_range', sql`${t.stress} is null or ${t.stress} between 1 and 5`),
    pgPolicy('wellbeing_checkins: čte jen vlastník', {
      for: 'select',
      to: appUser,
      using: sql`${t.userId} = ${uid}`,
    }),
    pgPolicy('wellbeing_checkins: zápis jen vlastník se souhlasem', {
      for: 'insert',
      to: appUser,
      withCheck: sql`${t.userId} = ${uid} and private.has_consent('ZDRAVOTNI_UDAJE')`,
    }),
    pgPolicy('wellbeing_checkins: mazání jen vlastník', {
      for: 'delete',
      to: appUser,
      using: sql`${t.userId} = ${uid}`,
    }),
  ],
);
