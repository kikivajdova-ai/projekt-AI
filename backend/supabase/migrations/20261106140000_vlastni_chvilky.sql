-- Vlastní chvilky: člověk si sám pojmenuje, co mu dělá dobře.
-- Název vidí jen autor; při sdílení ostatní uvidí obecné „Chvíle pro sebe“.
-- Odpovídá supabase/functions/_shared/db/schema/activities.ts.

create table "public"."custom_activities" (
  "id" uuid primary key,
  "user_id" uuid not null references "public"."users"("id") on delete cascade,
  "title" varchar(60) not null,
  "created_at" timestamp with time zone not null default now(),
  constraint "custom_activities_title_not_blank" check (length(btrim("title")) between 1 and 60)
);
create index "custom_activities_user_idx" on "public"."custom_activities" ("user_id");
alter table "public"."custom_activities" enable row level security;
create policy "custom_activities: jen autor" on "public"."custom_activities"
  as permissive for all to app_user
  using ("user_id" = (select private.uid()))
  with check ("user_id" = (select private.uid()));

alter table "public"."activities"
  add column "custom_activity_id" uuid references "public"."custom_activities"("id") on delete set null;
alter table "public"."activities"
  add constraint "activities_custom_is_jine" check ("custom_activity_id" is null or "category" = 'JINE');

-- Vložit chvilku s vlastní chvilkou jde jen s VLASTNÍ vlastní chvilkou.
drop policy "activities: nový záznam je VŽDY soukromý" on "public"."activities";
create policy "activities: nový záznam je VŽDY soukromý" on "public"."activities"
  as permissive for insert to app_user
  with check ("user_id" = (select private.uid())
    and "visibility" = 'JEN_JA'
    and "crew_id" is null
    and ("rest_invitation_id" is null or private.is_party_to_accepted_invite("rest_invitation_id"))
    and ("custom_activity_id" is null or exists (
      select 1 from public.custom_activities c
       where c.id = "custom_activity_id" and c.user_id = (select private.uid()))));

-- Telefon (anon/authenticated) k tabulce nesmí; jen naše API jako app_user.
revoke all on public.custom_activities from anon, authenticated, public;
grant select, insert, delete on public.custom_activities to app_user;
