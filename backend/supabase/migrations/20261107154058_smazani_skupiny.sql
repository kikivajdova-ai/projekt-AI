-- Smazání skupiny. Smí jen zakladatel, který je stále členem; skupina zmizí všem.
-- Chvilky sdílené do skupiny se nemažou: vrátí se jejich autorům jako soukromé
-- (jinak by porušily kontrolu activities_crew_matches_visibility).
-- Členství, pozvánky, výzvy i příspěvky smaže kaskáda.

create or replace function private.delete_group(gid uuid) returns boolean
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if gid is null or not exists (
    select 1 from public.groups g
    join public.group_members gm on gm.group_id = g.id and gm.user_id = private.uid()
    where g.id = gid and g.created_by = private.uid()
  ) then
    return false;
  end if;

  update public.activities
     set visibility = 'JEN_JA', crew_id = null, shared_at = null
   where crew_id = gid;

  delete from public.groups where id = gid;
  return true;
end;
$$;

revoke all on function private.delete_group(uuid) from public;
grant execute on function private.delete_group(uuid) to app_user;
