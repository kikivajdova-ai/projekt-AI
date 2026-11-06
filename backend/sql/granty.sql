-- =============================================================================
-- Práva k tabulkám (granty). Skript scripts/vytvor-migrace.ts z tohoto souboru
-- po každém `drizzle-kit generate` vyrobí novou migraci. Všechny příkazy jsou
-- idempotentní (jdou spustit opakovaně se stejným výsledkem).
--
-- Dvě vrstvy ochrany, které se doplňují:
--   GRANT  = smí role s tabulkou/sloupcem vůbec pracovat?
--   RLS    = ke kterým ŘÁDKŮM se dostane? (politiky jsou ve schématu Drizzle)
-- U UPDATE povolujeme jen konkrétní sloupce, aby si nikdo nepřepsal např.
-- user_id nebo dvojici v přátelství na někoho jiného.
--
-- Role anon a authenticated (aplikace přímo přes PostgREST) nemají NIC.
-- =============================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from app_user, app_system;

-- users: přátelé vidí jen přezdívku
grant select, insert on public.users to app_user;
grant update (display_name) on public.users to app_user;
grant select on public.users to app_system;

-- user_settings: jen vlastník
grant select, insert on public.user_settings to app_user;
grant update (timezone, game_enabled, share_badges, receive_pings, receive_rest_invites,
              quiet_hours_enabled, quiet_start, quiet_end, updated_at)
  on public.user_settings to app_user;
grant select on public.user_settings to app_system;

-- consents
grant select, insert on public.consents to app_user;
grant update (granted_at, revoked_at) on public.consents to app_user;

-- wellbeing_checkins: nálada a stres. app_system sem NEMÁ žádný přístup.
grant select, insert, delete on public.wellbeing_checkins to app_user;

-- friend_invites
grant select, insert on public.friend_invites to app_user;
grant update (revoked_at) on public.friend_invites to app_user;
grant select on public.friend_invites to app_system;
grant update (used_at, used_by) on public.friend_invites to app_system;

-- friendships: uživatel nemůže vložit žádost sám (jen přes ověřenou pozvánku)
grant select, delete on public.friendships to app_user;
grant update (status, accepted_at) on public.friendships to app_user;
grant select, insert on public.friendships to app_system;
grant update (status, accepted_at) on public.friendships to app_system;

-- blocks
grant select, insert, delete on public.blocks to app_user;

-- reports: uživatel jen vkládá
grant insert on public.reports to app_user;
grant select on public.reports to app_system;
grant update (status, forwarded_at) on public.reports to app_system;

-- activities
grant select, insert, delete on public.activities to app_user;
grant update (status, completed_at, local_day, visibility, crew_id, shared_at) on public.activities to app_user;
grant select on public.activities to app_system;

-- custom_activities: vlastní chvilky, jen autor (systém k nim přístup nemá)
grant select, insert, delete on public.custom_activities to app_user;

-- personal_goals: osobní cíl týdne, jen autor
grant select, insert, delete on public.personal_goals to app_user;
grant update (category, target_count) on public.personal_goals to app_user;

-- groups a členství
grant select, insert on public.groups to app_user;
grant update (name) on public.groups to app_user;
grant select on public.groups to app_system;
grant select, insert, delete on public.group_members to app_user;
grant select, insert on public.group_invitations to app_user;
grant update (status, responded_at) on public.group_invitations to app_user;

-- skupinové cíle: uživatel vidí jen své příspěvky, součet počítá app_system
grant select, insert on public.group_goals to app_user;
grant select on public.group_goals to app_system;
grant select, insert, delete on public.group_goal_contributions to app_user;
grant select on public.group_goal_contributions to app_system;

-- odznaky: udílí jen app_system
grant select on public.badges to app_user, app_system;
grant select on public.user_badges to app_user;
grant select, insert on public.user_badges to app_system;

-- povzbuzení: žádný UPDATE (není co odpovídat ani „přečíst“)
grant select, insert, delete on public.pings to app_user;
grant select on public.pings to app_system;

-- pozvánky k odpočinku: odpověď = jen stav
grant select, insert on public.rest_invitations to app_user;
grant update (status, responded_at) on public.rest_invitations to app_user;
grant select on public.rest_invitations to app_system;

-- notifikace
grant select, insert, delete on public.push_tokens to app_user;
grant select, delete on public.push_tokens to app_system;
grant select, insert, delete on public.notification_outbox to app_system;
grant update (status, attempts, sent_at, send_after) on public.notification_outbox to app_system;
