-- Testy přístupových pravidel (RLS) přímo v databázi. Spuštění: `supabase test db`.
-- Každý test se přihlásí jako konkrétní člověk a zkusí, co smí a co ne.
-- Vše běží v transakci a na konci se vrátí zpět (rollback).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(46);

-- Test smí přepínat role (jen v této transakci)
grant app_user to postgres;
grant app_system to postgres;

-- Klára a Tom jsou přátelé, Cyril je cizí člověk.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'klara@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'tom@example.test'),
  ('33333333-3333-3333-3333-333333333333', 'cyril@example.test');
insert into public.users (id, display_name) values
  ('11111111-1111-1111-1111-111111111111', 'Klára'),
  ('22222222-2222-2222-2222-222222222222', 'Tom'),
  ('33333333-3333-3333-3333-333333333333', 'Cyril');
insert into public.user_settings (user_id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333');
insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-222222222222', 'PRIJATO', now());

-- Klářiny chvíle: splněná sdílená, naplánovaná sdílená, splněná soukromá
insert into public.activities (id, user_id, category, status, visibility, timezone, local_day, completed_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'PROCHAZKA', 'SPLNENO', 'PRATELE', 'Europe/Prague', '2026-11-06', now()),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'CTENI', 'NAPLANOVANO', 'PRATELE', 'Europe/Prague', '2026-11-06', null),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'PAUZA', 'SPLNENO', 'JEN_JA', 'Europe/Prague', '2026-11-06', now());

insert into public.consents (user_id, type) values ('11111111-1111-1111-1111-111111111111', 'ZDRAVOTNI_UDAJE');
insert into public.wellbeing_checkins (id, user_id, mood, stress, local_day) values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 2, 4, '2026-11-06');

-- ===================== jako TOM (kamarád) =====================
set local role app_user;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

select is((select count(*)::int from public.users where id = '11111111-1111-1111-1111-111111111111'), 1,
  'kamarád vidí přezdívku');
select is((select count(*)::int from public.user_settings where user_id = '11111111-1111-1111-1111-111111111111'), 0,
  'kamarád NEvidí nastavení (např. vypnutou hru)');
select is((select count(*)::int from public.activities where user_id = '11111111-1111-1111-1111-111111111111'), 1,
  'kamarád vidí jen splněnou a sdílenou chvíli');
select is((select id from public.activities where user_id = '11111111-1111-1111-1111-111111111111'),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid, '… a je to ta správná (ne naplánovaná, ne soukromá)');
select is((select count(*)::int from public.wellbeing_checkins), 0, 'kamarád NEvidí náladu');

select throws_ok(
  $$insert into public.activities (id, user_id, category, status, visibility, timezone, local_day)
    values ('aaaaaaaa-0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', 'PROCHAZKA', 'NAPLANOVANO', 'PRATELE', 'Europe/Prague', '2026-11-06')$$,
  '42501', null, 'nový záznam nejde vložit jako sdílený');
select lives_ok(
  $$insert into public.activities (id, user_id, category, status, visibility, timezone, local_day)
    values ('aaaaaaaa-0000-0000-0000-000000000011', '22222222-2222-2222-2222-222222222222', 'PROCHAZKA', 'NAPLANOVANO', 'JEN_JA', 'Europe/Prague', '2026-11-06')$$,
  'soukromý záznam vložit jde');
select throws_ok(
  $$insert into public.activities (id, user_id, category, status, visibility, timezone, local_day)
    values ('aaaaaaaa-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'PROCHAZKA', 'NAPLANOVANO', 'JEN_JA', 'Europe/Prague', '2026-11-06')$$,
  '42501', null, 'záznam za jiného člověka nejde vložit');
update public.activities set visibility = 'JEN_JA' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select visibility::text from public.activities where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'PRATELE', 'cizí chvíli nejde změnit (update proběhne naprázdno)');

select throws_ok(
  $$insert into public.friendships (user_a, user_b, requested_by)
    values ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222')$$,
  '42501', null, 'žádost o přátelství nejde vložit bez pozvánky');
select throws_ok(
  $$insert into public.user_badges (user_id, badge_code) values ('22222222-2222-2222-2222-222222222222', 'NAVRAT')$$,
  '42501', null, 'odznak si nejde udělit sám');
select throws_ok(
  $$insert into public.wellbeing_checkins (id, user_id, mood, local_day)
    values ('cccccccc-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 3, '2026-11-06')$$,
  '42501', null, 'bez souhlasu nejde ukládat náladu');
select lives_ok(
  $$insert into public.pings (id, sender_id, recipient_id, kind, sender_local_day)
    values ('dddddddd-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'MYSLIM_NA_TEBE', '2026-11-06')$$,
  'kamarádovi jde poslat povzbuzení');
select throws_ok(
  $$update public.pings set kind = 'FANDIM_TI' where id = 'dddddddd-0000-0000-0000-000000000001'$$,
  '42501', null, 'na povzbuzení nejde „odpovědět“ ani ho měnit');

-- ===================== jako CYRIL (cizí) =====================
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

select is((select count(*)::int from public.users where id <> '33333333-3333-3333-3333-333333333333'), 0,
  'cizí člověk nevidí žádný jiný profil (není co vyhledávat)');
select is((select count(*)::int from public.activities), 0, 'cizí člověk nevidí žádné chvíle');
select throws_ok(
  $$insert into public.pings (id, sender_id, recipient_id, kind, sender_local_day)
    values ('dddddddd-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'DEJ_SI_PAUZU', '2026-11-06')$$,
  '42501', null, 'cizí člověk nemůže poslat povzbuzení');

-- ===================== skupina a společný cíl =====================
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select lives_ok($$insert into public.groups (id, name, created_by)
  values ('eeeeeeee-0000-0000-0000-000000000001', 'Chill crew', '22222222-2222-2222-2222-222222222222')$$,
  'Tom založí skupinu');
select lives_ok($$insert into public.group_members (group_id, user_id, role)
  values ('eeeeeeee-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'ZAKLADATEL')$$,
  'zakladatel vstoupí do své skupiny');
select throws_ok($$insert into public.group_invitations (id, group_id, inviter_id, invitee_id)
  values ('eeeeeeee-0000-0000-0000-000000000010', 'eeeeeeee-0000-0000-0000-000000000001',
          '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333')$$,
  '42501', null, 'do skupiny nejde pozvat cizího člověka');
select lives_ok($$insert into public.group_invitations (id, group_id, inviter_id, invitee_id)
  values ('eeeeeeee-0000-0000-0000-000000000011', 'eeeeeeee-0000-0000-0000-000000000001',
          '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')$$,
  'kamarádku pozvat jde');
select lives_ok($$insert into public.group_goals (id, group_id, category, target_count, week_start, created_by)
  values ('eeeeeeee-0000-0000-0000-000000000020', 'eeeeeeee-0000-0000-0000-000000000001', 'PROCHAZKA', 10,
          '2026-11-02', '22222222-2222-2222-2222-222222222222')$$,
  'člen založí týdenní cíl');

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select throws_ok($$insert into public.group_members (group_id, user_id, role)
  values ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'CLEN')$$,
  '42501', null, 'bez přijaté pozvánky do skupiny vstoupit nejde');
select lives_ok($$update public.group_invitations set status = 'PRIJATO', responded_at = now()
  where id = 'eeeeeeee-0000-0000-0000-000000000011'$$, 'Klára pozvánku přijme');
select lives_ok($$insert into public.group_members (group_id, user_id, role)
  values ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'CLEN')$$,
  'po přijetí do skupiny vstoupí');
select lives_ok($$insert into public.group_goal_contributions (goal_id, activity_id, user_id)
  values ('eeeeeeee-0000-0000-0000-000000000020', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111')$$,
  'splněná procházka z týdne cíle se započítá');
select throws_ok($$insert into public.group_goal_contributions (goal_id, activity_id, user_id)
  values ('eeeeeeee-0000-0000-0000-000000000020', 'aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'nesplněná chvíle se do cíle započítat nedá');

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select is((select count(*)::int from public.group_goal_contributions), 0,
  'člen skupiny nevidí, kdo kolik přispěl (žádné žebříčky)');
select lives_ok($$insert into public.rest_invitations (id, sender_id, recipient_id, category, sender_local_day, expires_at)
  values ('ffffffff-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
          '11111111-1111-1111-1111-111111111111', 'PROCHAZKA', '2026-11-06', now() + interval '12 hours')$$,
  'Tom pozve Kláru na procházku');
select throws_ok($$insert into public.rest_invitations (id, sender_id, recipient_id, category, sender_local_day, expires_at)
  values ('ffffffff-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
          '11111111-1111-1111-1111-111111111111', 'CTENI', '2026-11-06', now() + interval '12 hours')$$,
  '23505', null, 'druhá pozvánka stejnému kamarádovi týž den neprojde');

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select lives_ok($$update public.rest_invitations set status = 'TED_NE', responded_at = now()
  where id = 'ffffffff-0000-0000-0000-000000000001'$$, 'Klára odmítne jedním stavem');

-- sdílení se skupinou a odchod ze skupiny
select lives_ok($$update public.activities set visibility = 'CHILL_CREW', crew_id = 'eeeeeeee-0000-0000-0000-000000000001'
  where id = 'aaaaaaaa-0000-0000-0000-000000000003'$$, 'Klára sdílí chvíli se svou skupinou');
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select is((select count(*)::int from public.activities where id = 'aaaaaaaa-0000-0000-0000-000000000003'), 1,
  'člen skupiny sdílenou chvíli vidí');
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
delete from public.group_members where user_id = '11111111-1111-1111-1111-111111111111';
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select is((select count(*)::int from public.activities where id = 'aaaaaaaa-0000-0000-0000-000000000003'), 0,
  'po odchodu autorky ze skupiny ji skupina už nevidí');
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select is((select count(*)::int from public.groups where id = 'eeeeeeee-0000-0000-0000-000000000001'), 0,
  'kdo ze skupiny odešel, skupinu nevidí');

-- obejití bloku přes skupinu: Klára (zpět ve skupině) blokuje Cyrila, Tom ho zkusí pozvat
reset role;
insert into public.group_members (group_id, user_id, role) values
  ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'CLEN');
insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values
  ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
   '33333333-3333-3333-3333-333333333333', 'PRIJATO', now());
insert into public.blocks (blocker_id, blocked_id) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333');
set local role app_user;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select throws_ok($$insert into public.group_invitations (id, group_id, inviter_id, invitee_id)
  values ('eeeeeeee-0000-0000-0000-000000000012', 'eeeeeeee-0000-0000-0000-000000000001',
          '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333')$$,
  '42501', null, 'blokovaného nejde přes kamaráda dostat do skupiny');
reset role;
insert into public.group_invitations (id, group_id, inviter_id, invitee_id, status) values
  ('eeeeeeee-0000-0000-0000-000000000013', 'eeeeeeee-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'PRIJATO');
set local role app_user;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select throws_ok($$insert into public.group_members (group_id, user_id, role)
  values ('eeeeeeee-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'CLEN')$$,
  '42501', null, 'ani s přijatou pozvánkou nevstoupí do skupiny, kde ho někdo blokuje');
select throws_ok($$select private.is_blocked_pair('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333')$$,
  '42501', null, 'zablokovaný nezjistí blok voláním pomocné funkce');
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

reset role;
select is((select count(*)::int from public.group_goal_contributions where goal_id = 'eeeeeeee-0000-0000-0000-000000000020'), 1,
  'součet skupiny (počítá server) = 1');
set local role app_user;

-- ===================== blokování =====================
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
insert into public.blocks (blocker_id, blocked_id) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select is((select count(*)::int from public.blocks), 0, 'blokovaný nevidí, že je blokovaný');
select is((select count(*)::int from public.activities where user_id = '11111111-1111-1111-1111-111111111111'), 0,
  'blokovaný už nevidí sdílené chvíle');
select throws_ok(
  $$insert into public.pings (id, sender_id, recipient_id, kind, sender_local_day)
    values ('dddddddd-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'FANDIM_TI', '2026-11-06')$$,
  '42501', null, 'blokovaný nemůže poslat povzbuzení');

-- ===================== app_system =====================
reset role;
set local role app_system;
select throws_ok($$select count(*) from public.wellbeing_checkins$$, '42501', null,
  'ani serverový proces nemá přístup k náladě');

-- ===================== aplikace přímo přes PostgREST =====================
reset role;
set local role authenticated;
select throws_ok($$select count(*) from public.activities$$, '42501', null,
  'telefon nemá přímý přístup k tabulkám (jen přes API)');
reset role;
set local role anon;
select throws_ok($$select count(*) from public.users$$, '42501', null, 'nepřihlášený nevidí nic');
reset role;

-- ===================== struktura =====================
select is((select count(*)::int from pg_trigger t
           join pg_class c on c.oid = t.tgrelid
           join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and not t.tgisinternal), 0,
  'v databázi nejsou žádné triggery');

select * from finish();
rollback;
