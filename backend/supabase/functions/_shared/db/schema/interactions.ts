// Povzbuzení jedním klepnutím a pozvánky k odpočinku.
//
// Povzbuzení (pings): jen připravený druh zprávy, ŽÁDNÝ text, žádný sloupec pro odpověď,
// žádné „přečteno“. Architektura odpověď neumožňuje, takže na příjemce nevzniká tlak.
//
// Pozvánky k odpočinku: odpověď je jen stav PRIDAM_SE / TED_NE. Tabulka nemá žádný
// sloupec pro důvod odmítnutí, takže vysvětlování ani nejde uložit.

import { sql } from 'drizzle-orm';
import { date, index, pgPolicy, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import {
  activityCategoryEnum,
  appSystem,
  appUser,
  pingKindEnum,
  restInviteStatusEnum,
  uid,
} from './common.ts';
import { users } from './users.ts';

export const pings = pgTable(
  'pings',
  {
    id: uuid('id').primaryKey(),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: pingKindEnum('kind').notNull(),
    senderLocalDay: date('sender_local_day', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('pings_recipient_idx').on(t.recipientId, t.createdAt),
    index('pings_sender_day_idx').on(t.senderId, t.senderLocalDay),
    pgPolicy('pings: vidí odesílatel a příjemce', {
      for: 'select',
      to: appUser,
      using: sql`${uid} in (${t.senderId}, ${t.recipientId})`,
    }),
    pgPolicy('pings: jen kamarádovi, který příjem nevypnul', {
      for: 'insert',
      to: appUser,
      withCheck: sql`${t.senderId} = ${uid}
        and ${t.recipientId} <> ${uid}
        and private.are_friends(${t.recipientId})
        and not private.is_blocked_with(${t.recipientId})
        and private.accepts_pings(${t.recipientId})`,
    }),
    pgPolicy('pings: příjemce může povzbuzení smazat', {
      for: 'delete',
      to: appUser,
      using: sql`${t.recipientId} = ${uid}`,
    }),
    pgPolicy('pings: systém čte pro odznaky', {
      for: 'select',
      to: appSystem,
      using: sql`true`,
    }),
  ],
);

export const restInvitations = pgTable(
  'rest_invitations',
  {
    id: uuid('id').primaryKey(),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: activityCategoryEnum('category').notNull(),
    status: restInviteStatusEnum('status').notNull().default('CEKA'),
    senderLocalDay: date('sender_local_day', { mode: 'string' }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (t) => [
    // Nejvýš 1 pozvánka denně od stejného člověka stejnému kamarádovi (ochrana před nátlakem).
    uniqueIndex('rest_invitations_one_per_day').on(t.senderId, t.recipientId, t.senderLocalDay),
    index('rest_invitations_recipient_idx').on(t.recipientId, t.status),
    pgPolicy('rest_invitations: vidí odesílatel a pozvaný', {
      for: 'select',
      to: appUser,
      using: sql`${uid} in (${t.senderId}, ${t.recipientId})`,
    }),
    pgPolicy('rest_invitations: jen kamaráda, který je nevypnul', {
      for: 'insert',
      to: appUser,
      withCheck: sql`${t.senderId} = ${uid}
        and ${t.recipientId} <> ${uid}
        and ${t.status} = 'CEKA'
        and private.are_friends(${t.recipientId})
        and not private.is_blocked_with(${t.recipientId})
        and private.accepts_rest_invites(${t.recipientId})`,
    }),
    pgPolicy('rest_invitations: odpovídá jen pozvaný, jen stavem', {
      for: 'update',
      to: appUser,
      using: sql`${t.recipientId} = ${uid} and ${t.status} = 'CEKA'`,
      withCheck: sql`${t.recipientId} = ${uid} and ${t.status} in ('PRIDAM_SE', 'TED_NE')`,
    }),
    pgPolicy('rest_invitations: systém čte (společné chvíle)', {
      for: 'select',
      to: appSystem,
      using: sql`true`,
    }),
  ],
);
