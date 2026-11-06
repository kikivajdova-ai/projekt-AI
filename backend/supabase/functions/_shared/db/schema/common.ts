// Společné stavební kameny schématu: databázové role, výčty a pomocné SQL výrazy.
//
// JAK FUNGUJE OCHRANA DAT (Row Level Security):
//  - Aplikace v telefonu NEMÁ přímý přístup k tabulkám (role anon/authenticated nemají
//    žádná práva, viz sql/granty.sql). Všechno jde přes naše API (Edge Function).
//  - API se k databázi připojuje jako `app_api`, který sám nemá práva k ničemu.
//    Pro každý požadavek si v transakci „nasadí“ roli:
//      app_user   = jedná za přihlášeného člověka; RLS pustí jen k jeho řádkům,
//      app_system = úzce vymezené serverové úkoly (pozvánky, odznaky, součet skupiny).
//  - Kdo se zapomene přepnout, nedostane nic (selže to „zavřeně“, ne „otevřeně“).
//  - Pomocné funkce private.* jsou v migraci 20261106000000_zaklad.sql.

import { sql } from 'drizzle-orm';
import { pgEnum, pgRole } from 'drizzle-orm/pg-core';
import {
  ACTIVITY_CATEGORY,
  ACTIVITY_STATUS,
  BADGE_CODE,
  CONSENT_TYPE,
  FRIENDSHIP_STATUS,
  GROUP_INVITE_STATUS,
  GROUP_ROLE,
  NOTIFICATION_KIND,
  OUTBOX_STATUS,
  PING_KIND,
  PUSH_PLATFORM,
  REPORT_REASON,
  REPORT_STATUS,
  REST_INVITE_STATUS,
  VISIBILITY,
} from '../../domain/enums.ts';

// Role vznikají v migraci `zaklad`, drizzle-kit je jen používá (.existing()).
export const appUser = pgRole('app_user').existing();
export const appSystem = pgRole('app_system').existing();

/** Id přihlášeného člověka z ověřeného JWT. (select …) = Postgres ho spočítá jednou za dotaz. */
export const uid = sql`(select private.uid())`;

export const visibilityEnum = pgEnum('visibility', VISIBILITY);
export const activityStatusEnum = pgEnum('activity_status', ACTIVITY_STATUS);
export const activityCategoryEnum = pgEnum('activity_category', ACTIVITY_CATEGORY);
export const friendshipStatusEnum = pgEnum('friendship_status', FRIENDSHIP_STATUS);
export const pingKindEnum = pgEnum('ping_kind', PING_KIND);
export const restInviteStatusEnum = pgEnum('rest_invite_status', REST_INVITE_STATUS);
export const groupRoleEnum = pgEnum('group_role', GROUP_ROLE);
export const groupInviteStatusEnum = pgEnum('group_invite_status', GROUP_INVITE_STATUS);
export const reportReasonEnum = pgEnum('report_reason', REPORT_REASON);
export const reportStatusEnum = pgEnum('report_status', REPORT_STATUS);
export const consentTypeEnum = pgEnum('consent_type', CONSENT_TYPE);
export const notificationKindEnum = pgEnum('notification_kind', NOTIFICATION_KIND);
export const outboxStatusEnum = pgEnum('outbox_status', OUTBOX_STATUS);
export const pushPlatformEnum = pgEnum('push_platform', PUSH_PLATFORM);
export const badgeCodeEnum = pgEnum('badge_code', BADGE_CODE);
