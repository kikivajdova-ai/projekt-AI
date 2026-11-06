// Přátelství jen přes pozvánku a se souhlasem obou stran, blokování a nahlášení.
//
// Jak vzniká přátelství (oba souhlasí s KONKRÉTNÍM člověkem):
//  1. Klára vytvoří pozvánku (friend_invites) a pošle odkaz Tomovi.
//  2. Tom odkaz otevře, uvidí „Klára tě zve“ a potvrdí -> vznikne žádost (CEKA).
//  3. Klára uvidí „Tom chce být tvůj kamarád“ a potvrdí -> PRIJATO.
// Aplikace nemá jak poslat žádost bez pozvánky: role app_user nemá právo vložit
// řádek do friendships (vkládá jen app_system po ověření tokenu).

import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  appSystem,
  appUser,
  friendshipStatusEnum,
  reportReasonEnum,
  reportStatusEnum,
  uid,
} from './common.ts';
import { users } from './users.ts';

export const friendInvites = pgTable(
  'friend_invites',
  {
    id: uuid('id').primaryKey(),
    inviterId: uuid('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Jen otisk (SHA-256) tokenu. Samotný token zná jen ten, kdo dostal odkaz. */
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    usedAt: timestamp('used_at', { withTimezone: true }),
    usedBy: uuid('used_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    pgPolicy('friend_invites: autor vidí, vytváří a ruší své', {
      for: 'all',
      to: appUser,
      using: sql`${t.inviterId} = ${uid}`,
      withCheck: sql`${t.inviterId} = ${uid}`,
    }),
    pgPolicy('friend_invites: systém ověřuje token', {
      for: 'select',
      to: appSystem,
      using: sql`true`,
    }),
    pgPolicy('friend_invites: systém označí použití', {
      for: 'update',
      to: appSystem,
      using: sql`${t.usedAt} is null and ${t.revokedAt} is null`,
      withCheck: sql`true`,
    }),
  ],
);

export const friendships = pgTable(
  'friendships',
  {
    /** Dvojice je uložená vždy jako (menší id, větší id), takže nejde vytvořit duplicitně. */
    userA: uuid('user_a')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userB: uuid('user_b')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: friendshipStatusEnum('status').notNull().default('CEKA'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userA, t.userB] }),
    index('friendships_user_b_idx').on(t.userB),
    check('friendships_ordered_pair', sql`${t.userA} < ${t.userB}`),
    check('friendships_requester_in_pair', sql`${t.requestedBy} in (${t.userA}, ${t.userB})`),
    pgPolicy('friendships: vidí jen oba zúčastnění', {
      for: 'select',
      to: appUser,
      using: sql`${uid} in (${t.userA}, ${t.userB})`,
    }),
    pgPolicy('friendships: potvrdit smí jen ten, kdo žádost dostal', {
      for: 'update',
      to: appUser,
      using: sql`${uid} in (${t.userA}, ${t.userB}) and ${uid} <> ${t.requestedBy} and ${t.status} = 'CEKA'`,
      withCheck: sql`${uid} in (${t.userA}, ${t.userB}) and ${uid} <> ${t.requestedBy} and ${t.status} = 'PRIJATO'`,
    }),
    pgPolicy('friendships: zrušit smí kterýkoli z obou', {
      for: 'delete',
      to: appUser,
      using: sql`${uid} in (${t.userA}, ${t.userB})`,
    }),
    pgPolicy('friendships: systém zakládá žádost po ověření pozvánky', {
      for: 'insert',
      to: appSystem,
      withCheck: sql`${t.status} = 'CEKA' and not private.is_blocked_pair(${t.userA}, ${t.userB})`,
    }),
    pgPolicy('friendships: systém ověřuje existující vztah', {
      for: 'select',
      to: appSystem,
      using: sql`true`,
    }),
  ],
);

/** Blokování. Řádek vidí jen ten, kdo blokoval; blokovaný se to z databáze nedozví. */
export const blocks = pgTable(
  'blocks',
  {
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    check('blocks_not_self', sql`${t.blockerId} <> ${t.blockedId}`),
    pgPolicy('blocks: jen ten, kdo blokuje', {
      for: 'all',
      to: appUser,
      using: sql`${t.blockerId} = ${uid}`,
      withCheck: sql`${t.blockerId} = ${uid}`,
    }),
  ],
);

/**
 * Nahlášení. Uživatel smí jen vložit (nevidí ani svá nahlášení, aby tabulka nešla
 * zneužít ke zjišťování). Předání do interního systému podpory dělá app_system.
 * Po smazání účtu nahlášení zůstává (bezpečnost), jen bez vazby na smazaný účet.
 */
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey(),
    reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    reportedUserId: uuid('reported_user_id').references(() => users.id, { onDelete: 'set null' }),
    reason: reportReasonEnum('reason').notNull(),
    details: varchar('details', { length: 1000 }),
    /** Volitelně: o jaký obsah jde (např. 'ping', 'rest_invitation', 'activity') a jeho id. */
    contextType: varchar('context_type', { length: 32 }),
    contextId: uuid('context_id'),
    status: reportStatusEnum('status').notNull().default('NOVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    forwardedAt: timestamp('forwarded_at', { withTimezone: true }),
  },
  (t) => [
    index('reports_status_idx').on(t.status, t.createdAt),
    pgPolicy('reports: nahlásit smí každý za sebe', {
      for: 'insert',
      to: appUser,
      withCheck: sql`${t.reporterId} = ${uid} and ${t.status} = 'NOVE'`,
    }),
    pgPolicy('reports: systém čte a předává podpoře', {
      for: 'all',
      to: appSystem,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
);
