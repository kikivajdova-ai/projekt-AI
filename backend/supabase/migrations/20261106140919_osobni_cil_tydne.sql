-- Osobní cíl tohoto týdne (pro ty, kdo odpočívají sami). Vidí ho jen autor.
-- Odpovídá supabase/functions/_shared/db/schema/activities.ts (personalGoals).

create table "public"."personal_goals" (
  "id" uuid primary key,
  "user_id" uuid not null references "public"."users"("id") on delete cascade,
  "week_start" date not null,
  "category" "public"."activity_category",
  "target_count" smallint not null,
  "created_at" timestamp with time zone not null default now(),
  constraint "personal_goals_one_per_week" unique ("user_id", "week_start"),
  constraint "personal_goals_target_range" check ("target_count" between 1 and 50),
  constraint "personal_goals_week_is_monday" check (extract(isodow from "week_start") = 1)
);
alter table "public"."personal_goals" enable row level security;
create policy "personal_goals: jen autor" on "public"."personal_goals"
  as permissive for all to app_user
  using ("user_id" = (select private.uid()))
  with check ("user_id" = (select private.uid()));

revoke all on public.personal_goals from anon, authenticated, public;
grant select, insert, delete on public.personal_goals to app_user;
grant update (category, target_count) on public.personal_goals to app_user;
