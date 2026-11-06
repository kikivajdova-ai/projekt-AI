-- =============================================================================
-- Základ zabezpečení. Ručně psaná migrace, která MUSÍ proběhnout před tabulkami
-- z drizzle-kit (proto má nejstarší časovou značku).
--
-- Obsahuje:
--   1) databázové role app_user / app_system / app_api,
--   2) pomocné funkce private.* používané v RLS politikách,
--   3) vypnutí výchozích práv pro anon/authenticated na nové tabulky.
--
-- Tahle migrace je jediná část projektu, která je napsaná přímo pro PostgreSQL.
-- Řádkové zabezpečení (RLS) je vlastnost databáze, ne ORM, takže jinak to nejde.
-- Veškerá ostatní logika je v TypeScriptu přes Drizzle.
--
-- ŽÁDNÉ TRIGGERY: databáze nemá jediný trigger (hlídá to test tests/guards.test.ts).
-- Nic se tedy samo nenuluje, nepropadá ani netrestá.
-- =============================================================================

create schema if not exists private;

-- ---------- 1) Role ----------------------------------------------------------
do $$
begin
  if not exists (select from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'app_system') then
    create role app_system nologin;
  end if;
  -- Účet, kterým se připojuje API. NOINHERIT = sám o sobě nemá žádná práva,
  -- musí si v transakci výslovně nasadit app_user nebo app_system.
  -- Heslo se NEnastavuje tady (nepatří do Gitu), viz README, krok „Heslo pro app_api“.
  if not exists (select from pg_roles where rolname = 'app_api') then
    create role app_api login noinherit;
  end if;
end
$$;

grant app_user to app_api;
grant app_system to app_api;

grant usage on schema public to app_user, app_system;
grant usage on schema private to app_user, app_system;

-- Aplikace v telefonu (anon/authenticated přes PostgREST) nesmí na nové tabulky vůbec.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges in schema private revoke all on functions from public;

-- ---------- 2) Pomocné funkce pro RLS -----------------------------------------
-- SECURITY DEFINER = funkce smí nahlédnout do tabulek, které volající sám nevidí
-- (např. jestli mě někdo blokuje), ale vrací jen ano/ne. search_path = '' brání
-- podvržení tabulek. Jazyk plpgsql, protože tabulky vzniknou až v další migraci.

-- Id přihlášeného člověka z JWT, které API nastaví v transakci (set_config).
create or replace function private.uid() returns uuid
language sql stable
set search_path = ''
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid
$$;

create or replace function private.are_friends(other uuid) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.friendships f
    where f.status = 'PRIJATO'
      and f.user_a = least(private.uid(), other)
      and f.user_b = greatest(private.uid(), other)
  );
end;
$$;

-- Přátelé NEBO rozpracovaná žádost (aby šlo vidět jméno toho, kdo žádá).
create or replace function private.is_connected(other uuid) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.friendships f
    where f.user_a = least(private.uid(), other)
      and f.user_b = greatest(private.uid(), other)
  );
end;
$$;

-- Blokuje mě ten člověk, nebo já jeho? Jeden z dvojice je VŽDY přihlášený člověk,
-- takže funkcí nejde zjišťovat bloky mezi cizími lidmi.
create or replace function private.is_blocked_with(other uuid) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.blocks bl
    where (bl.blocker_id = private.uid() and bl.blocked_id = other)
       or (bl.blocker_id = other and bl.blocked_id = private.uid())
  );
end;
$$;

-- Varianta pro serverový proces (app_system), který jedná mimo přihlášeného člověka.
create or replace function private.is_blocked_pair(a uuid, b uuid) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.blocks bl
    where (bl.blocker_id = a and bl.blocked_id = b)
       or (bl.blocker_id = b and bl.blocked_id = a)
  );
end;
$$;

-- Je mezi `person` a kterýmkoli členem skupiny blok? (blokování nejde obejít přes skupinu)
create or replace function private.has_block_in_group(gid uuid, person uuid) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.group_members gm
    join public.blocks bl
      on (bl.blocker_id = gm.user_id and bl.blocked_id = person)
      or (bl.blocker_id = person and bl.blocked_id = gm.user_id)
    where gm.group_id = gid
  );
end;
$$;

-- Je konkrétní člověk (např. autor sdílené chvíle) stále členem skupiny?
create or replace function private.is_user_in_group(gid uuid, person uuid) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return gid is not null and exists (
    select 1 from public.group_members gm where gm.group_id = gid and gm.user_id = person
  );
end;
$$;

create or replace function private.is_group_member(gid uuid) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return gid is not null and exists (
    select 1 from public.group_members gm
    where gm.group_id = gid and gm.user_id = private.uid()
  );
end;
$$;

create or replace function private.shares_group(other uuid) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.group_members me
    join public.group_members them on them.group_id = me.group_id
    where me.user_id = private.uid() and them.user_id = other
  );
end;
$$;

-- Vstup do skupiny: zakladatel do právě založené prázdné skupiny, ostatní jen
-- s přijatou pozvánkou. Max. 8 členů.
create or replace function private.can_join_group(gid uuid, member_role text) returns boolean
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  member_count integer;
begin
  -- zámek skupiny: dva současné vstupy nepřekročí limit 8 členů
  perform 1 from public.groups g where g.id = gid for update;
  select count(*) into member_count from public.group_members where group_id = gid;
  if member_count >= 8 or private.has_block_in_group(gid, private.uid()) then
    return false;
  end if;

  if member_role = 'ZAKLADATEL' then
    return member_count = 0 and exists (
      select 1 from public.groups g where g.id = gid and g.created_by = private.uid()
    );
  end if;

  return member_role = 'CLEN' and exists (
    select 1 from public.group_invitations gi
    where gi.group_id = gid
      and gi.invitee_id = private.uid()
      and gi.status = 'PRIJATO'
  );
end;
$$;

create or replace function private.accepts_pings(recipient uuid) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return coalesce(
    (select s.receive_pings from public.user_settings s where s.user_id = recipient),
    false
  );
end;
$$;

create or replace function private.accepts_rest_invites(recipient uuid) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return coalesce(
    (select s.receive_rest_invites from public.user_settings s where s.user_id = recipient),
    false
  );
end;
$$;

create or replace function private.shares_badges(owner_id uuid) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return coalesce(
    (select s.share_badges and s.game_enabled from public.user_settings s where s.user_id = owner_id),
    false
  );
end;
$$;

create or replace function private.has_consent(consent text) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.consents c
    where c.user_id = private.uid()
      and c.type::text = consent
      and c.revoked_at is null
  );
end;
$$;

-- Příspěvek ke skupinovému cíli: vlastní SPLNĚNÁ chvíle správného druhu,
-- z týdne cíle, a člověk je členem skupiny.
create or replace function private.can_contribute(goal uuid, activity uuid) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.group_goals g
    join public.group_members gm on gm.group_id = g.group_id and gm.user_id = private.uid()
    join public.activities a on a.id = activity
    where g.id = goal
      and a.user_id = private.uid()
      and a.status = 'SPLNENO'
      and a.category = g.category
      and a.local_day between g.week_start and g.week_start + 6
  );
end;
$$;

-- Společná chvíle: jen z pozvánky, kterou člověk poslal nebo dostal a která byla přijata.
create or replace function private.is_party_to_accepted_invite(invitation uuid) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.rest_invitations r
    where r.id = invitation
      and r.status = 'PRIDAM_SE'
      and private.uid() in (r.sender_id, r.recipient_id)
  );
end;
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to app_user, app_system;
-- Dotaz na blok mezi DVĚMA libovolnými lidmi smí jen serverový proces.
revoke execute on function private.is_blocked_pair(uuid, uuid) from app_user;
