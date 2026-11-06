-- Přátelství vzniká hned po přijetí pozvánky (autor už nemusí nic potvrzovat).
-- Souhlas obou stran zůstává: autor vytvořil a poslal osobní odkaz, pozvaný ho přijal.
-- Odpovídá politikám v supabase/functions/_shared/db/schema/social.ts.

drop policy if exists "friendships: systém zakládá žádost po ověření pozvánky" on "public"."friendships";

create policy "friendships: systém zakládá po přijetí pozvánky" on "public"."friendships"
  as permissive for insert to app_system
  with check ("status" = 'PRIJATO' and "accepted_at" is not null and not private.is_blocked_pair("user_a", "user_b"));

create policy "friendships: systém potvrdí starší žádost" on "public"."friendships"
  as permissive for update to app_system
  using ("status" = 'CEKA')
  with check ("status" = 'PRIJATO' and "accepted_at" is not null and not private.is_blocked_pair("user_a", "user_b"));

grant update (status, accepted_at) on public.friendships to app_system;

-- Starší žádosti vznikly jen z přijatých pozvánek, takže je rovnou potvrdíme.
-- (Kromě dvojic, kde mezitím jeden druhého zablokoval.)
update public.friendships
   set status = 'PRIJATO', accepted_at = now()
 where status = 'CEKA' and not private.is_blocked_pair(user_a, user_b);
