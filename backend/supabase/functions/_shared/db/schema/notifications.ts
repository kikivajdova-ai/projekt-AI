// Push tokeny zařízení a fronta notifikací (outbox).
// Fronta neobsahuje žádný text: obsah notifikace se skládá až při odeslání
// z bezpečných obecných vět (domain/notifications.ts). send_after respektuje noční klid.

import { sql } from 'drizzle-orm';
import { index, pgPolicy, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
  appSystem,
  appUser,
  notificationKindEnum,
  outboxStatusEnum,
  pushPlatformEnum,
  uid,
} from './common.ts';
import { users } from './users.ts';

export const pushTokens = pgTable(
  'push_tokens',
  {
    token: text('token').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: pushPlatformEnum('platform').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('push_tokens_user_idx').on(t.userId),
    pgPolicy('push_tokens: jen vlastník', {
      for: 'all',
      to: appUser,
      using: sql`${t.userId} = ${uid}`,
      withCheck: sql`${t.userId} = ${uid}`,
    }),
    pgPolicy('push_tokens: systém čte a maže neplatné', {
      for: 'all',
      to: appSystem,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
);

export const notificationOutbox = pgTable(
  'notification_outbox',
  {
    id: uuid('id').primaryKey(),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: notificationKindEnum('kind').notNull(),
    refId: uuid('ref_id').notNull(),
    sendAfter: timestamp('send_after', { withTimezone: true }).notNull(),
    status: outboxStatusEnum('status').notNull().default('CEKA'),
    attempts: smallint('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => [
    index('notification_outbox_due_idx').on(t.status, t.sendAfter),
    pgPolicy('notification_outbox: jen systém', {
      for: 'all',
      to: appSystem,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
);
