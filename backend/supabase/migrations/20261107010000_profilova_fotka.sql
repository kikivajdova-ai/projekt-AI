-- Profilová fotka (malý čtverec jako data URL; jen JPEG/PNG/WebP, nikdy SVG).
-- Vidí ji jen autor a jeho potvrzení přátelé. Odpovídá db/schema/users.ts (avatars).

create table public.avatars (
  user_id uuid primary key references public.users(id) on delete cascade,
  image text not null,
  updated_at timestamp with time zone not null default now(),
  constraint avatars_image_format check (image ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' and length(image) <= 220000)
);
alter table public.avatars enable row level security;
create policy "avatars: autor spravuje svou" on public.avatars
  as permissive for all to app_user
  using (user_id = (select private.uid()))
  with check (user_id = (select private.uid()));
create policy "avatars: přátelé vidí" on public.avatars
  as permissive for select to app_user
  using (private.are_friends(user_id) and not private.is_blocked_with(user_id));

revoke all on public.avatars from anon, authenticated, public;
grant select, insert, delete on public.avatars to app_user;
grant update (image, updated_at) on public.avatars to app_user;
