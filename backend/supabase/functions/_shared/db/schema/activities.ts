// Odpočinkové chvíle se štítkem viditelnosti.
//
// Tři pojistky soukromí, každá na jiné úrovni:
//  1. DATABÁZE: politika pro vložení dovolí jen visibility = 'JEN_JA'. Nový záznam
//     je tedy soukromý vždy, i kdyby někdo poslal požadavek mimo naši aplikaci.
//  2. DATABÁZE: přátelé a skupina vidí jen řádky se status = 'SPLNENO'.
//     Naplánované nebo nedokončené chvíle nevidí nikdo kromě autora.
//  3. API: ke změně viditelnosti je potřeba podepsaný token z náhledu (viz services).

import { sql } from 'drizzle-orm';
import { check, date, index, pgPolicy, pgTable, smallint, text, timestamp, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import {
  activityCategoryEnum,
  activityStatusEnum,
  appSystem,
  appUser,
  uid,
  visibilityEnum,
} from './common.ts';
import { users } from './users.ts';
import { groups } from './groups.ts';
import { restInvitations } from './interactions.ts';

/**
 * Vlastní chvilky, které si člověk sám pojmenuje („Koupel“, „Hra s kočkou“…).
 * Název vidí JEN autor. Když chvilku sdílí, ostatní uvidí obecné „Chvíle pro sebe“
 * (název může být osobní, proto z databáze ven k nikomu jinému nejde).
 */
export const customActivities = pgTable(
  'custom_activities',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 60 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('custom_activities_user_idx').on(t.userId),
    check('custom_activities_title_not_blank', sql`length(btrim(${t.title})) between 1 and 60`),
    pgPolicy('custom_activities: jen autor', {
      for: 'all',
      to: appUser,
      using: sql`${t.userId} = ${uid}`,
      withCheck: sql`${t.userId} = ${uid}`,
    }),
  ],
);

export const activities = pgTable(
  'activities',
  {
    /** Id vytváří telefon -> opakované odeslání téže chvíle se nezapočítá dvakrát. */
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: activityCategoryEnum('category').notNull(),
    status: activityStatusEnum('status').notNull().default('NAPLANOVANO'),
    visibility: visibilityEnum('visibility').notNull().default('JEN_JA'),
    /** Skupina, se kterou je chvíle sdílená (jen u CHILL_CREW). */
    crewId: uuid('crew_id').references(() => groups.id, { onDelete: 'set null' }),
    /** Společná chvíle vzniklá z přijaté pozvánky k odpočinku. */
    restInvitationId: uuid('rest_invitation_id').references(() => restInvitations.id, {
      onDelete: 'set null',
    }),
    /** Vlastní chvilka (kategorie je pak vždy JINE). Smazáním vlastní chvilky historie zůstane. */
    customActivityId: uuid('custom_activity_id').references(() => customActivities.id, { onDelete: 'set null' }),
    timezone: text('timezone').notNull(),
    localDay: date('local_day', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    sharedAt: timestamp('shared_at', { withTimezone: true }),
  },
  (t) => [
    index('activities_user_day_idx').on(t.userId, t.localDay),
    index('activities_feed_idx').on(t.status, t.visibility, t.completedAt),
    // Jedna přijatá pozvánka = jedna společná chvíle na člověka (bonus nejde opakovat).
    uniqueIndex('activities_one_per_invitation').on(t.userId, t.restInvitationId),
    check(
      'activities_crew_matches_visibility',
      sql`(${t.visibility} = 'CHILL_CREW') = (${t.crewId} is not null)`,
    ),
    check('activities_custom_is_jine', sql`${t.customActivityId} is null or ${t.category} = 'JINE'`),
    check(
      'activities_completed_has_time',
      sql`(${t.status} = 'SPLNENO') = (${t.completedAt} is not null)`,
    ),

    pgPolicy('activities: autor vidí všechny své', {
      for: 'select',
      to: appUser,
      using: sql`${t.userId} = ${uid}`,
    }),
    pgPolicy('activities: přátelé vidí jen SPLNĚNÉ sdílené s nimi', {
      for: 'select',
      to: appUser,
      using: sql`${t.status} = 'SPLNENO'
        and ${t.visibility} = 'PRATELE'
        and private.are_friends(${t.userId})
        and not private.is_blocked_with(${t.userId})`,
    }),
    pgPolicy('activities: skupina vidí jen SPLNĚNÉ a sdílené se skupinou', {
      for: 'select',
      to: appUser,
      using: sql`${t.status} = 'SPLNENO'
        and ${t.visibility} = 'CHILL_CREW'
        and private.is_group_member(${t.crewId})
        and private.is_user_in_group(${t.crewId}, ${t.userId})
        and not private.is_blocked_with(${t.userId})`,
    }),
    pgPolicy('activities: nový záznam je VŽDY soukromý', {
      for: 'insert',
      to: appUser,
      withCheck: sql`${t.userId} = ${uid}
        and ${t.visibility} = 'JEN_JA'
        and ${t.crewId} is null
        and (${t.restInvitationId} is null or private.is_party_to_accepted_invite(${t.restInvitationId}))
        and (${t.customActivityId} is null or exists (
          select 1 from public.custom_activities c where c.id = ${t.customActivityId} and c.user_id = ${uid}))`,
    }),
    pgPolicy('activities: mění jen autor, sdílí jen do své skupiny', {
      for: 'update',
      to: appUser,
      using: sql`${t.userId} = ${uid}`,
      withCheck: sql`${t.userId} = ${uid} and (${t.crewId} is null or private.is_group_member(${t.crewId}))`,
    }),
    pgPolicy('activities: mazat smí jen autor', {
      for: 'delete',
      to: appUser,
      using: sql`${t.userId} = ${uid}`,
    }),
    pgPolicy('activities: systém čte pro výpočet odznaků', {
      for: 'select',
      to: appSystem,
      using: sql`true`,
    }),
  ],
);

/**
 * Osobní cíl tohoto týdne (pro ty, kdo odpočívají sami). Jeden na týden, vidí ho jen autor.
 * Kategorie null = jakákoli chvilka. Nesplněný cíl nic nebere a nikde se nepřipomíná.
 */
export const personalGoals = pgTable(
  'personal_goals',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    weekStart: date('week_start', { mode: 'string' }).notNull(),
    category: activityCategoryEnum('category'),
    targetCount: smallint('target_count').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('personal_goals_one_per_week').on(t.userId, t.weekStart),
    check('personal_goals_target_range', sql`${t.targetCount} between 1 and 50`),
    check('personal_goals_week_is_monday', sql`extract(isodow from ${t.weekStart}) = 1`),
    pgPolicy('personal_goals: jen autor', {
      for: 'all',
      to: appUser,
      using: sql`${t.userId} = ${uid}`,
      withCheck: sql`${t.userId} = ${uid}`,
    }),
  ],
);
