-- Tabulky, indexy a pravidla RLS. Vygenerováno ze schématu v supabase/functions/_shared/db/schema
-- (stejný obsah, jaký vyrobí drizzle-kit generate). Nasazeno do Supabase 6. 11. 2026.

create type "visibility" as enum ('JEN_JA', 'PRATELE', 'CHILL_CREW');
create type "activity_status" as enum ('NAPLANOVANO', 'SPLNENO');
create type "activity_category" as enum ('PROCHAZKA', 'CTENI', 'PAUZA', 'SPANEK', 'BEZ_TELEFONU', 'POHYB', 'TVORENI', 'JINE');
create type "friendship_status" as enum ('CEKA', 'PRIJATO');
create type "ping_kind" as enum ('MYSLIM_NA_TEBE', 'DEJ_SI_PAUZU', 'FANDIM_TI');
create type "rest_invite_status" as enum ('CEKA', 'PRIDAM_SE', 'TED_NE');
create type "group_role" as enum ('ZAKLADATEL', 'CLEN');
create type "group_invite_status" as enum ('CEKA', 'PRIJATO', 'ODMITNUTO');
create type "report_reason" as enum ('OBTEZOVANI', 'NEVHODNY_OBSAH', 'SPAM', 'BEZPECNOST_DITETE', 'JINE');
create type "report_status" as enum ('NOVE', 'PREDANO', 'VYRESENO');
create type "consent_type" as enum ('ZDRAVOTNI_UDAJE', 'PODMINKY');
create type "notification_kind" as enum ('POVZBUZENI', 'POZVANKA_K_ODPOCINKU', 'ODPOVED_NA_POZVANKU', 'ZADOST_O_PRATELSTVI', 'POZVANKA_DO_SKUPINY', 'ODZNAK');
create type "outbox_status" as enum ('CEKA', 'ODESLANO', 'ZAHOZENO');
create type "push_platform" as enum ('ANDROID', 'IOS');
create type "badge_code" as enum ('PRVNI_CHVILKA', 'NAVRAT', 'DOBRY_KAMARAD', 'BEZ_TELEFONU', 'SPOLU', 'PESTROST');
create table "public"."users" (
  "id" uuid primary key not null,
  "display_name" varchar(40) not null,
  "created_at" timestamptz not null default now(),
  constraint "users_display_name_not_blank" check (length(trim("display_name")) between 1 and 40)
);
create table "public"."user_settings" (
  "user_id" uuid primary key not null,
  "timezone" text not null default 'Europe/Prague',
  "game_enabled" boolean not null default true,
  "share_badges" boolean not null default false,
  "receive_pings" boolean not null default true,
  "receive_rest_invites" boolean not null default true,
  "quiet_hours_enabled" boolean not null default true,
  "quiet_start" time not null default '22:00',
  "quiet_end" time not null default '08:00',
  "updated_at" timestamptz not null default now()
);
create table "public"."consents" (
  "user_id" uuid not null,
  "type" "consent_type" not null,
  "granted_at" timestamptz not null default now(),
  "revoked_at" timestamptz,
  primary key ("user_id", "type")
);
create table "public"."wellbeing_checkins" (
  "id" uuid primary key not null,
  "user_id" uuid not null,
  "mood" smallint not null,
  "stress" smallint,
  "local_day" date not null,
  "created_at" timestamptz not null default now(),
  constraint "wellbeing_checkins_mood_range" check ("mood" between 1 and 5),
  constraint "wellbeing_checkins_stress_range" check ("stress" is null or "stress" between 1 and 5)
);
create table "public"."friend_invites" (
  "id" uuid primary key not null,
  "inviter_id" uuid not null,
  "token_hash" text not null unique,
  "expires_at" timestamptz not null,
  "revoked_at" timestamptz,
  "used_at" timestamptz,
  "used_by" uuid,
  "created_at" timestamptz not null default now()
);
create table "public"."friendships" (
  "user_a" uuid not null,
  "user_b" uuid not null,
  "requested_by" uuid not null,
  "status" "friendship_status" not null default 'CEKA',
  "created_at" timestamptz not null default now(),
  "accepted_at" timestamptz,
  primary key ("user_a", "user_b"),
  constraint "friendships_ordered_pair" check ("user_a" < "user_b"),
  constraint "friendships_requester_in_pair" check ("requested_by" in ("user_a", "user_b"))
);
create table "public"."blocks" (
  "blocker_id" uuid not null,
  "blocked_id" uuid not null,
  "created_at" timestamptz not null default now(),
  primary key ("blocker_id", "blocked_id"),
  constraint "blocks_not_self" check ("blocker_id" <> "blocked_id")
);
create table "public"."reports" (
  "id" uuid primary key not null,
  "reporter_id" uuid,
  "reported_user_id" uuid,
  "reason" "report_reason" not null,
  "details" varchar(1000),
  "context_type" varchar(32),
  "context_id" uuid,
  "status" "report_status" not null default 'NOVE',
  "created_at" timestamptz not null default now(),
  "forwarded_at" timestamptz
);
create table "public"."pings" (
  "id" uuid primary key not null,
  "sender_id" uuid not null,
  "recipient_id" uuid not null,
  "kind" "ping_kind" not null,
  "sender_local_day" date not null,
  "created_at" timestamptz not null default now()
);
create table "public"."rest_invitations" (
  "id" uuid primary key not null,
  "sender_id" uuid not null,
  "recipient_id" uuid not null,
  "category" "activity_category" not null,
  "status" "rest_invite_status" not null default 'CEKA',
  "sender_local_day" date not null,
  "expires_at" timestamptz not null,
  "created_at" timestamptz not null default now(),
  "responded_at" timestamptz
);
create table "public"."activities" (
  "id" uuid primary key not null,
  "user_id" uuid not null,
  "category" "activity_category" not null,
  "status" "activity_status" not null default 'NAPLANOVANO',
  "visibility" "visibility" not null default 'JEN_JA',
  "crew_id" uuid,
  "rest_invitation_id" uuid,
  "timezone" text not null,
  "local_day" date not null,
  "created_at" timestamptz not null default now(),
  "completed_at" timestamptz,
  "shared_at" timestamptz,
  constraint "activities_crew_matches_visibility" check (("visibility" = 'CHILL_CREW') = ("crew_id" is not null)),
  constraint "activities_completed_has_time" check (("status" = 'SPLNENO') = ("completed_at" is not null))
);
create table "public"."groups" (
  "id" uuid primary key not null,
  "name" varchar(40) not null,
  "created_by" uuid,
  "created_at" timestamptz not null default now(),
  constraint "groups_name_not_blank" check (length(trim("name")) between 1 and 40)
);
create table "public"."group_members" (
  "group_id" uuid not null,
  "user_id" uuid not null,
  "role" "group_role" not null default 'CLEN',
  "joined_at" timestamptz not null default now(),
  primary key ("group_id", "user_id")
);
create table "public"."group_invitations" (
  "id" uuid primary key not null,
  "group_id" uuid not null,
  "inviter_id" uuid not null,
  "invitee_id" uuid not null,
  "status" "group_invite_status" not null default 'CEKA',
  "created_at" timestamptz not null default now(),
  "responded_at" timestamptz
);
create table "public"."group_goals" (
  "id" uuid primary key not null,
  "group_id" uuid not null,
  "category" "activity_category" not null,
  "target_count" smallint not null,
  "week_start" date not null,
  "created_by" uuid,
  "created_at" timestamptz not null default now(),
  constraint "group_goals_one_per_week" unique ("group_id", "category", "week_start"),
  constraint "group_goals_target_range" check ("target_count" between 1 and 100),
  constraint "group_goals_week_is_monday" check (extract(isodow from "week_start") = 1)
);
create table "public"."group_goal_contributions" (
  "goal_id" uuid not null,
  "activity_id" uuid not null,
  "user_id" uuid not null,
  "created_at" timestamptz not null default now(),
  primary key ("goal_id", "activity_id")
);
create table "public"."badges" (
  "code" "badge_code" primary key not null,
  "name" varchar(60) not null,
  "description" text not null
);
create table "public"."user_badges" (
  "user_id" uuid not null,
  "badge_code" "badge_code" not null,
  "awarded_at" timestamptz not null default now(),
  primary key ("user_id", "badge_code")
);
create table "public"."push_tokens" (
  "token" text primary key not null,
  "user_id" uuid not null,
  "platform" "push_platform" not null,
  "created_at" timestamptz not null default now()
);
create table "public"."notification_outbox" (
  "id" uuid primary key not null,
  "recipient_id" uuid not null,
  "kind" "notification_kind" not null,
  "ref_id" uuid not null,
  "send_after" timestamptz not null,
  "status" "outbox_status" not null default 'CEKA',
  "attempts" smallint not null default 0,
  "created_at" timestamptz not null default now(),
  "sent_at" timestamptz
);
alter table "public"."users" add foreign key ("id") references "auth"."users"("id") on delete cascade;
alter table "public"."users" enable row level security;
create policy "users: vidím sebe, přátele, žádosti a spolučleny skupin" on "public"."users" as permissive for select to app_user using ("id" = (select private.uid()) or private.is_connected("id") or private.shares_group("id"));
create policy "users: založím jen svůj profil" on "public"."users" as permissive for insert to app_user with check ("id" = (select private.uid()));
create policy "users: měním jen svůj profil" on "public"."users" as permissive for update to app_user using ("id" = (select private.uid())) with check ("id" = (select private.uid()));
create policy "users: systém čte přezdívku (náhled pozvánky)" on "public"."users" as permissive for select to app_system using (true);
alter table "public"."user_settings" add foreign key ("user_id") references "public"."users"("id") on delete cascade;
alter table "public"."user_settings" enable row level security;
create policy "user_settings: jen vlastník" on "public"."user_settings" as permissive for all to app_user using ("user_id" = (select private.uid())) with check ("user_id" = (select private.uid()));
create policy "user_settings: systém čte (noční klid, časové pásmo)" on "public"."user_settings" as permissive for select to app_system using (true);
alter table "public"."consents" add foreign key ("user_id") references "public"."users"("id") on delete cascade;
alter table "public"."consents" enable row level security;
create policy "consents: jen vlastník" on "public"."consents" as permissive for all to app_user using ("user_id" = (select private.uid())) with check ("user_id" = (select private.uid()));
alter table "public"."wellbeing_checkins" add foreign key ("user_id") references "public"."users"("id") on delete cascade;
create index "wellbeing_checkins_user_idx" on "public"."wellbeing_checkins" ("user_id", "created_at");
alter table "public"."wellbeing_checkins" enable row level security;
create policy "wellbeing_checkins: čte jen vlastník" on "public"."wellbeing_checkins" as permissive for select to app_user using ("user_id" = (select private.uid()));
create policy "wellbeing_checkins: zápis jen vlastník se souhlasem" on "public"."wellbeing_checkins" as permissive for insert to app_user with check ("user_id" = (select private.uid()) and private.has_consent('ZDRAVOTNI_UDAJE'));
create policy "wellbeing_checkins: mazání jen vlastník" on "public"."wellbeing_checkins" as permissive for delete to app_user using ("user_id" = (select private.uid()));
alter table "public"."friend_invites" add foreign key ("inviter_id") references "public"."users"("id") on delete cascade;
alter table "public"."friend_invites" add foreign key ("used_by") references "public"."users"("id") on delete set null;
alter table "public"."friend_invites" enable row level security;
create policy "friend_invites: autor vidí, vytváří a ruší své" on "public"."friend_invites" as permissive for all to app_user using ("inviter_id" = (select private.uid())) with check ("inviter_id" = (select private.uid()));
create policy "friend_invites: systém ověřuje token" on "public"."friend_invites" as permissive for select to app_system using (true);
create policy "friend_invites: systém označí použití" on "public"."friend_invites" as permissive for update to app_system using ("used_at" is null and "revoked_at" is null) with check (true);
alter table "public"."friendships" add foreign key ("user_a") references "public"."users"("id") on delete cascade;
alter table "public"."friendships" add foreign key ("user_b") references "public"."users"("id") on delete cascade;
alter table "public"."friendships" add foreign key ("requested_by") references "public"."users"("id") on delete cascade;
create index "friendships_user_b_idx" on "public"."friendships" ("user_b");
alter table "public"."friendships" enable row level security;
create policy "friendships: vidí jen oba zúčastnění" on "public"."friendships" as permissive for select to app_user using ((select private.uid()) in ("user_a", "user_b"));
create policy "friendships: potvrdit smí jen ten, kdo žádost dostal" on "public"."friendships" as permissive for update to app_user using ((select private.uid()) in ("user_a", "user_b") and (select private.uid()) <> "requested_by" and "status" = 'CEKA') with check ((select private.uid()) in ("user_a", "user_b") and (select private.uid()) <> "requested_by" and "status" = 'PRIJATO');
create policy "friendships: zrušit smí kterýkoli z obou" on "public"."friendships" as permissive for delete to app_user using ((select private.uid()) in ("user_a", "user_b"));
create policy "friendships: systém zakládá žádost po ověření pozvánky" on "public"."friendships" as permissive for insert to app_system with check ("status" = 'CEKA' and not private.is_blocked_pair("user_a", "user_b"));
create policy "friendships: systém ověřuje existující vztah" on "public"."friendships" as permissive for select to app_system using (true);
alter table "public"."blocks" add foreign key ("blocker_id") references "public"."users"("id") on delete cascade;
alter table "public"."blocks" add foreign key ("blocked_id") references "public"."users"("id") on delete cascade;
alter table "public"."blocks" enable row level security;
create policy "blocks: jen ten, kdo blokuje" on "public"."blocks" as permissive for all to app_user using ("blocker_id" = (select private.uid())) with check ("blocker_id" = (select private.uid()));
alter table "public"."reports" add foreign key ("reporter_id") references "public"."users"("id") on delete set null;
alter table "public"."reports" add foreign key ("reported_user_id") references "public"."users"("id") on delete set null;
create index "reports_status_idx" on "public"."reports" ("status", "created_at");
alter table "public"."reports" enable row level security;
create policy "reports: nahlásit smí každý za sebe" on "public"."reports" as permissive for insert to app_user with check ("reporter_id" = (select private.uid()) and "status" = 'NOVE');
create policy "reports: systém čte a předává podpoře" on "public"."reports" as permissive for all to app_system using (true) with check (true);
alter table "public"."pings" add foreign key ("sender_id") references "public"."users"("id") on delete cascade;
alter table "public"."pings" add foreign key ("recipient_id") references "public"."users"("id") on delete cascade;
create index "pings_recipient_idx" on "public"."pings" ("recipient_id", "created_at");
create index "pings_sender_day_idx" on "public"."pings" ("sender_id", "sender_local_day");
alter table "public"."pings" enable row level security;
create policy "pings: vidí odesílatel a příjemce" on "public"."pings" as permissive for select to app_user using ((select private.uid()) in ("sender_id", "recipient_id"));
create policy "pings: jen kamarádovi, který příjem nevypnul" on "public"."pings" as permissive for insert to app_user with check ("sender_id" = (select private.uid())
        and "recipient_id" <> (select private.uid())
        and private.are_friends("recipient_id")
        and not private.is_blocked_with("recipient_id")
        and private.accepts_pings("recipient_id"));
create policy "pings: příjemce může povzbuzení smazat" on "public"."pings" as permissive for delete to app_user using ("recipient_id" = (select private.uid()));
create policy "pings: systém čte pro odznaky" on "public"."pings" as permissive for select to app_system using (true);
alter table "public"."rest_invitations" add foreign key ("sender_id") references "public"."users"("id") on delete cascade;
alter table "public"."rest_invitations" add foreign key ("recipient_id") references "public"."users"("id") on delete cascade;
create unique index "rest_invitations_one_per_day" on "public"."rest_invitations" ("sender_id", "recipient_id", "sender_local_day");
create index "rest_invitations_recipient_idx" on "public"."rest_invitations" ("recipient_id", "status");
alter table "public"."rest_invitations" enable row level security;
create policy "rest_invitations: vidí odesílatel a pozvaný" on "public"."rest_invitations" as permissive for select to app_user using ((select private.uid()) in ("sender_id", "recipient_id"));
create policy "rest_invitations: jen kamaráda, který je nevypnul" on "public"."rest_invitations" as permissive for insert to app_user with check ("sender_id" = (select private.uid())
        and "recipient_id" <> (select private.uid())
        and "status" = 'CEKA'
        and private.are_friends("recipient_id")
        and not private.is_blocked_with("recipient_id")
        and private.accepts_rest_invites("recipient_id"));
create policy "rest_invitations: odpovídá jen pozvaný, jen stavem" on "public"."rest_invitations" as permissive for update to app_user using ("recipient_id" = (select private.uid()) and "status" = 'CEKA') with check ("recipient_id" = (select private.uid()) and "status" in ('PRIDAM_SE', 'TED_NE'));
create policy "rest_invitations: systém čte (společné chvíle)" on "public"."rest_invitations" as permissive for select to app_system using (true);
alter table "public"."activities" add foreign key ("user_id") references "public"."users"("id") on delete cascade;
alter table "public"."activities" add foreign key ("crew_id") references "public"."groups"("id") on delete set null;
alter table "public"."activities" add foreign key ("rest_invitation_id") references "public"."rest_invitations"("id") on delete set null;
create index "activities_user_day_idx" on "public"."activities" ("user_id", "local_day");
create index "activities_feed_idx" on "public"."activities" ("status", "visibility", "completed_at");
create unique index "activities_one_per_invitation" on "public"."activities" ("user_id", "rest_invitation_id");
alter table "public"."activities" enable row level security;
create policy "activities: autor vidí všechny své" on "public"."activities" as permissive for select to app_user using ("user_id" = (select private.uid()));
create policy "activities: přátelé vidí jen SPLNĚNÉ sdílené s nimi" on "public"."activities" as permissive for select to app_user using ("status" = 'SPLNENO'
        and "visibility" = 'PRATELE'
        and private.are_friends("user_id")
        and not private.is_blocked_with("user_id"));
create policy "activities: skupina vidí jen SPLNĚNÉ a sdílené se skupinou" on "public"."activities" as permissive for select to app_user using ("status" = 'SPLNENO'
        and "visibility" = 'CHILL_CREW'
        and private.is_group_member("crew_id")
        and private.is_user_in_group("crew_id", "user_id")
        and not private.is_blocked_with("user_id"));
create policy "activities: nový záznam je VŽDY soukromý" on "public"."activities" as permissive for insert to app_user with check ("user_id" = (select private.uid())
        and "visibility" = 'JEN_JA'
        and "crew_id" is null
        and ("rest_invitation_id" is null or private.is_party_to_accepted_invite("rest_invitation_id")));
create policy "activities: mění jen autor, sdílí jen do své skupiny" on "public"."activities" as permissive for update to app_user using ("user_id" = (select private.uid())) with check ("user_id" = (select private.uid()) and ("crew_id" is null or private.is_group_member("crew_id")));
create policy "activities: mazat smí jen autor" on "public"."activities" as permissive for delete to app_user using ("user_id" = (select private.uid()));
create policy "activities: systém čte pro výpočet odznaků" on "public"."activities" as permissive for select to app_system using (true);
alter table "public"."groups" add foreign key ("created_by") references "public"."users"("id") on delete set null;
alter table "public"."groups" enable row level security;
create policy "groups: vidí jen členové" on "public"."groups" as permissive for select to app_user using (private.is_group_member("id"));
create policy "groups: založit může kdokoli za sebe" on "public"."groups" as permissive for insert to app_user with check ("created_by" = (select private.uid()));
create policy "groups: systém čte název pro pozvaného" on "public"."groups" as permissive for select to app_system using (true);
create policy "groups: přejmenovat smí zakladatel, dokud je členem" on "public"."groups" as permissive for update to app_user using ("created_by" = (select private.uid()) and private.is_group_member("id")) with check ("created_by" = (select private.uid()));
alter table "public"."group_members" add foreign key ("group_id") references "public"."groups"("id") on delete cascade;
alter table "public"."group_members" add foreign key ("user_id") references "public"."users"("id") on delete cascade;
create index "group_members_user_idx" on "public"."group_members" ("user_id");
alter table "public"."group_members" enable row level security;
create policy "group_members: členové vidí členy své skupiny" on "public"."group_members" as permissive for select to app_user using (private.is_group_member("group_id"));
create policy "group_members: vstup jen s pozvánkou nebo jako zakladatel" on "public"."group_members" as permissive for insert to app_user with check ("user_id" = (select private.uid()) and private.can_join_group("group_id", "role"::text));
create policy "group_members: odejít smí každý tiše sám" on "public"."group_members" as permissive for delete to app_user using ("user_id" = (select private.uid()));
alter table "public"."group_invitations" add foreign key ("group_id") references "public"."groups"("id") on delete cascade;
alter table "public"."group_invitations" add foreign key ("inviter_id") references "public"."users"("id") on delete cascade;
alter table "public"."group_invitations" add foreign key ("invitee_id") references "public"."users"("id") on delete cascade;
create unique index "group_invitations_one_pending" on "public"."group_invitations" ("group_id", "invitee_id") where "status" = 'CEKA';
alter table "public"."group_invitations" enable row level security;
create policy "group_invitations: vidí odesílatel a pozvaný" on "public"."group_invitations" as permissive for select to app_user using ((select private.uid()) in ("inviter_id", "invitee_id"));
create policy "group_invitations: pozvat smí člen jen svého kamaráda" on "public"."group_invitations" as permissive for insert to app_user with check ("inviter_id" = (select private.uid())
        and "status" = 'CEKA'
        and private.is_group_member("group_id")
        and private.are_friends("invitee_id")
        and not private.is_blocked_with("invitee_id")
        and not private.has_block_in_group("group_id", "invitee_id"));
create policy "group_invitations: odpovědět smí jen pozvaný" on "public"."group_invitations" as permissive for update to app_user using ("invitee_id" = (select private.uid()) and "status" = 'CEKA') with check ("invitee_id" = (select private.uid()) and "status" in ('PRIJATO', 'ODMITNUTO'));
alter table "public"."group_goals" add foreign key ("group_id") references "public"."groups"("id") on delete cascade;
alter table "public"."group_goals" add foreign key ("created_by") references "public"."users"("id") on delete set null;
alter table "public"."group_goals" enable row level security;
create policy "group_goals: vidí členové" on "public"."group_goals" as permissive for select to app_user using (private.is_group_member("group_id"));
create policy "group_goals: založit smí člen" on "public"."group_goals" as permissive for insert to app_user with check ("created_by" = (select private.uid()) and private.is_group_member("group_id"));
create policy "group_goals: systém čte pro součet" on "public"."group_goals" as permissive for select to app_system using (true);
alter table "public"."group_goal_contributions" add foreign key ("goal_id") references "public"."group_goals"("id") on delete cascade;
alter table "public"."group_goal_contributions" add foreign key ("activity_id") references "public"."activities"("id") on delete cascade;
alter table "public"."group_goal_contributions" add foreign key ("user_id") references "public"."users"("id") on delete cascade;
alter table "public"."group_goal_contributions" enable row level security;
create policy "group_goal_contributions: každý vidí jen své příspěvky" on "public"."group_goal_contributions" as permissive for select to app_user using ("user_id" = (select private.uid()));
create policy "contributions: jen vlastní splněná chvíle z týdne cíle" on "public"."group_goal_contributions" as permissive for insert to app_user with check ("user_id" = (select private.uid()) and private.can_contribute("goal_id", "activity_id"));
create policy "group_goal_contributions: příspěvek jde vzít zpět" on "public"."group_goal_contributions" as permissive for delete to app_user using ("user_id" = (select private.uid()));
create policy "group_goal_contributions: systém počítá jen součet" on "public"."group_goal_contributions" as permissive for select to app_system using (true);
alter table "public"."badges" enable row level security;
create policy "badges: katalog vidí každý přihlášený" on "public"."badges" as permissive for select to app_user, app_system using (true);
alter table "public"."user_badges" add foreign key ("user_id") references "public"."users"("id") on delete cascade;
alter table "public"."user_badges" add foreign key ("badge_code") references "public"."badges"("code");
alter table "public"."user_badges" enable row level security;
create policy "user_badges: vidím své" on "public"."user_badges" as permissive for select to app_user using ("user_id" = (select private.uid()));
create policy "user_badges: přátelé jen když je majitel sdílí" on "public"."user_badges" as permissive for select to app_user using (private.are_friends("user_id") and private.shares_badges("user_id"));
create policy "user_badges: uděluje jen systém" on "public"."user_badges" as permissive for insert to app_system with check (true);
create policy "user_badges: systém ví, co už je uděleno" on "public"."user_badges" as permissive for select to app_system using (true);
alter table "public"."push_tokens" add foreign key ("user_id") references "public"."users"("id") on delete cascade;
create index "push_tokens_user_idx" on "public"."push_tokens" ("user_id");
alter table "public"."push_tokens" enable row level security;
create policy "push_tokens: jen vlastník" on "public"."push_tokens" as permissive for all to app_user using ("user_id" = (select private.uid())) with check ("user_id" = (select private.uid()));
create policy "push_tokens: systém čte a maže neplatné" on "public"."push_tokens" as permissive for all to app_system using (true) with check (true);
alter table "public"."notification_outbox" add foreign key ("recipient_id") references "public"."users"("id") on delete cascade;
create index "notification_outbox_due_idx" on "public"."notification_outbox" ("status", "send_after");
alter table "public"."notification_outbox" enable row level security;
create policy "notification_outbox: jen systém" on "public"."notification_outbox" as permissive for all to app_system using (true) with check (true);
