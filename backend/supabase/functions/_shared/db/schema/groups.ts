// Skupiny („Chill crew“) a společné cíle.
//
// Do skupiny se nejde dostat bez souhlasu: člen pozve KAMARÁDA (ne cizího člověka),
// pozvaný musí přijmout. Max. 8 členů (kontroluje private.can_join_group).
//
// Skupinový cíl: příspěvky (group_goal_contributions) vidí každý jen své.
// Součet celé skupiny spočítá app_system a API vrátí JEN číslo („Spolu 7 z 10“).
// Z databáze se tedy přes naše role nedá vyčíst, kdo kolik přispěl -> žádné žebříčky.

import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  pgPolicy,
  pgTable,
  primaryKey,
  smallint,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  activityCategoryEnum,
  appSystem,
  appUser,
  groupInviteStatusEnum,
  groupRoleEnum,
  uid,
} from './common.ts';
import { users } from './users.ts';
import { activities } from './activities.ts';

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 40 }).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('groups_name_not_blank', sql`length(trim(${t.name})) between 1 and 40`),
    pgPolicy('groups: vidí jen členové', {
      for: 'select',
      to: appUser,
      using: sql`private.is_group_member(${t.id})`,
    }),
    pgPolicy('groups: založit může kdokoli za sebe', {
      for: 'insert',
      to: appUser,
      withCheck: sql`${t.createdBy} = ${uid}`,
    }),
    pgPolicy('groups: přejmenovat smí zakladatel, dokud je členem', {
      for: 'update',
      to: appUser,
      using: sql`${t.createdBy} = ${uid} and private.is_group_member(${t.id})`,
      withCheck: sql`${t.createdBy} = ${uid}`,
    }),
  ],
);

export const groupMembers = pgTable(
  'group_members',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: groupRoleEnum('role').notNull().default('CLEN'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index('group_members_user_idx').on(t.userId),
    pgPolicy('group_members: členové vidí členy své skupiny', {
      for: 'select',
      to: appUser,
      using: sql`private.is_group_member(${t.groupId})`,
    }),
    pgPolicy('group_members: vstup jen s pozvánkou nebo jako zakladatel', {
      for: 'insert',
      to: appUser,
      withCheck: sql`${t.userId} = ${uid} and private.can_join_group(${t.groupId}, ${t.role}::text)`,
    }),
    pgPolicy('group_members: odejít smí každý tiše sám', {
      for: 'delete',
      to: appUser,
      using: sql`${t.userId} = ${uid}`,
    }),
  ],
);

export const groupInvitations = pgTable(
  'group_invitations',
  {
    id: uuid('id').primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    inviterId: uuid('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    inviteeId: uuid('invitee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: groupInviteStatusEnum('status').notNull().default('CEKA'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('group_invitations_one_pending')
      .on(t.groupId, t.inviteeId)
      .where(sql`${t.status} = 'CEKA'`),
    pgPolicy('group_invitations: vidí odesílatel a pozvaný', {
      for: 'select',
      to: appUser,
      using: sql`${uid} in (${t.inviterId}, ${t.inviteeId})`,
    }),
    pgPolicy('group_invitations: pozvat smí člen jen svého kamaráda', {
      for: 'insert',
      to: appUser,
      withCheck: sql`${t.inviterId} = ${uid}
        and ${t.status} = 'CEKA'
        and private.is_group_member(${t.groupId})
        and private.are_friends(${t.inviteeId})
        and not private.is_blocked_with(${t.inviteeId})
        and not private.has_block_in_group(${t.groupId}, ${t.inviteeId})`,
    }),
    pgPolicy('group_invitations: odpovědět smí jen pozvaný', {
      for: 'update',
      to: appUser,
      using: sql`${t.inviteeId} = ${uid} and ${t.status} = 'CEKA'`,
      withCheck: sql`${t.inviteeId} = ${uid} and ${t.status} in ('PRIJATO', 'ODMITNUTO')`,
    }),
  ],
);

export const groupGoals = pgTable(
  'group_goals',
  {
    id: uuid('id').primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    category: activityCategoryEnum('category').notNull(),
    targetCount: smallint('target_count').notNull(),
    /** Pondělí týdne, ke kterému cíl patří. Cíl je týdenní, ne trvalý závazek. */
    weekStart: date('week_start', { mode: 'string' }).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('group_goals_one_per_week').on(t.groupId, t.category, t.weekStart),
    check('group_goals_target_range', sql`${t.targetCount} between 1 and 100`),
    check('group_goals_week_is_monday', sql`extract(isodow from ${t.weekStart}) = 1`),
    pgPolicy('group_goals: vidí členové', {
      for: 'select',
      to: appUser,
      using: sql`private.is_group_member(${t.groupId})`,
    }),
    pgPolicy('group_goals: založit smí člen', {
      for: 'insert',
      to: appUser,
      withCheck: sql`${t.createdBy} = ${uid} and private.is_group_member(${t.groupId})`,
    }),
    pgPolicy('group_goals: systém čte pro součet', {
      for: 'select',
      to: appSystem,
      using: sql`true`,
    }),
  ],
);

export const groupGoalContributions = pgTable(
  'group_goal_contributions',
  {
    goalId: uuid('goal_id')
      .notNull()
      .references(() => groupGoals.id, { onDelete: 'cascade' }),
    activityId: uuid('activity_id')
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.goalId, t.activityId] }),
    pgPolicy('group_goal_contributions: každý vidí jen své příspěvky', {
      for: 'select',
      to: appUser,
      using: sql`${t.userId} = ${uid}`,
    }),
    pgPolicy('contributions: jen vlastní splněná chvíle z týdne cíle', {
      for: 'insert',
      to: appUser,
      withCheck: sql`${t.userId} = ${uid} and private.can_contribute(${t.goalId}, ${t.activityId})`,
    }),
    pgPolicy('group_goal_contributions: příspěvek jde vzít zpět', {
      for: 'delete',
      to: appUser,
      using: sql`${t.userId} = ${uid}`,
    }),
    pgPolicy('group_goal_contributions: systém počítá jen součet', {
      for: 'select',
      to: appSystem,
      using: sql`true`,
    }),
  ],
);
