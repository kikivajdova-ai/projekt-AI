-- Volitelné automatické sdílení nových splněných chvilek s přáteli.
-- Výchozí stav je VYPNUTO; zapnout jde jen vědomě v nastavení (Já -> Nastavení).
-- Nový záznam dál vzniká jako „Jen já“ (politika insert se nemění), sdílení provede API hned potom.

alter table public.user_settings
  add column auto_share_friends boolean not null default false;

grant update (auto_share_friends) on public.user_settings to app_user;
