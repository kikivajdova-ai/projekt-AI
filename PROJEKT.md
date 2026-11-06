# PROJEKT.md – deník projektu Odpočívat spolu

Tenhle soubor si čte každý nový chat (i člověk z týmu), aby věděl, co se staví a proč.
Nepatří sem žádná hesla ani klíče.

## Cíl aplikace

Gamifikovaná wellbeing aplikace: lidé si zaznamenávají odpočinkové chvíle, plní je
sami i s kamarády, povzbuzují se a mají společné cíle. Odpočinek místo výkonu,
bez tlaku, srovnávání a studu. Česky, pro uživatele v ČR (GDPR), bez věkového omezení.

## Zvolená varianta (6. 11. 2026)

**A) Supabase (PostgreSQL, region EU) + Drizzle ORM + Edge Functions (TypeScript, Hono, zod).**
Klient: **Flutter**. Přihlášení: **e-mail + heslo** (jméno = přezdívka).

Proč: pravidla RLS jsou u každé tabulky přímo ve schématu Drizzle, takže nevznikne tabulka
bez ochrany. Logika je v TypeScriptu nezávislá na databázi; jen tenká vrstva
(`migrations/20261106000000_zaklad.sql`, `sql/granty.sql`) je pro PostgreSQL, protože RLS
je vlastnost databáze.

Zamítnuto: **B) Supabase + Prisma** (RLS by bylo v ručním SQL odděleně od schématu),
**C) Firebase Data Connect** (silná vazba na Google, nejde o ORM, pravidla nejsou RLS).
Přihlášení samotným jménem bez e-mailu zamítnuto: zapomenuté heslo by nešlo obnovit.

### Klíčová architektonická rozhodnutí

| Rozhodnutí | Proč |
|---|---|
| Telefon nemá přímý přístup k tabulkám (anon/authenticated bez grantů) | všechno jde přes API, které hlídá náhled sdílení, limity a validaci |
| API se připojuje jako `app_api` bez práv, nasazuje `app_user` / `app_system` | zapomenutá role = žádná data (selže zavřeně) |
| Nový záznam jen `JEN_JA` (RLS politika pro insert) | soukromí jako výchozí stav vynucuje databáze |
| Přátelé/skupina vidí jen `SPLNENO` (RLS + filtr ve feedu) | neplnění nikdy není vidět |
| Stav „nesplněno“ neexistuje | co se neuloží, nejde ukázat |
| Body se neukládají, počítají se z událostí | nejde je zfalšovat, nic se nenuluje |
| Žádné triggery (hlídá test) | žádné automatické tresty |
| Nálada/stres v samostatné tabulce, jen vlastník, jen se souhlasem, app_system bez přístupu | údaje o zdraví (čl. 9 GDPR) |
| Součet skupinového cíle počítá app_system, ven jde jedno číslo | žádné žebříčky |
| Krizové kontakty napevno ve Flutteru | fungují i bez sítě a bez backendu |

## Jak projekt spustit a otestovat

Viz `README.md`. Krátce (ve složce `backend`):

```bash
npm install && npm test          # logika + strážní testy
npm run db:generate              # migrace ze schématu
npx supabase start && npx supabase db reset && npm run db:test   # testy RLS v databázi
```

## Herní pravidla

Jediné místo: `backend/supabase/functions/_shared/domain/config.ts` (verze pravidel 1).
Hodnoty jsou ze skillu `herni-mechaniky` (smycka-a-ekonomika.md).

| Akce | Body | Strop |
|---|---|---|
| Odpočinková chvíle | 10 | 2 denně (nad strop se uloží bez bodů) |
| Společná chvíle (přijatá pozvánka) | +5 | 1× denně |
| Odeslané povzbuzení | 2 | 5 týdně |
| Týden do rytmu (≥ 3 chvíle v rámci denního stropu) | 15 | 1× týdně, počítá se celkem, ne „v řadě“ |
| Návrat po pauze (≥ 14 dní) | 20 | 1× za 30 dní |

Den končí ve 4:00 místního času. Úrovně: `T(n) = round(50 × (n − 1)^1.4)`.
Odznaky: První chvilka, Návrat, Dobrý kamarád, Bez obrazovky, Spolu, Pestrost.
Simulace ekonomiky (`herni-mechaniky/scripts/simulace_ekonomiky.py`) zatím neběžela
nad touto implementací, viz otevřené otázky.

## Stav

Hotovo (verze 0.1):
- schéma 21 tabulek s RLS, role, pomocné funkce, granty po sloupcích, katalog odznaků,
- služby a API: profil, souhlasy, export a smazání účtu, pozvánky a přátelství, blokování,
  nahlášení s předáním podpoře, chvíle se sdílením přes náhled, feed přátel, nálada,
  skupiny a cíle, povzbuzení, pozvánky k odpočinku, fronta notifikací s nočním klidem, FCM,
- Flutter: krizové kontakty a panel pomoci, karta pozvánky, náhled sdílení, notifikace,
- testy: 35 testů logiky a strážních testů, 46 testů RLS v databázi (ověřeno na PostgreSQL 16).
- nezávislá kontrola (6. 11. 2026): opraveny všechny VYSOKÉ nálezy a část STŘEDNÍCH, viz níže.

Hotovo navíc: webová aplikace (`web/`) s designem z plátna, ukázkový režim i napojení na API; prokliknutá automatickým testem v prohlížeči (registrace, chvilka sám i s kamarádem, zahrada, přátelé, blokování, sdílení s náhledem, vypnutá hra, nálada, pomoc).

Na řadě: Flutter verze se stejnými obrazovkami; `npm install` + typová kontrola služeb, vygenerovat a commitnout migrace, spustit `npm run db:test`, rozhodnout otevřené otázky (hlavně nezletilí).

## Známá slabá místa

Opraveno po nezávislé kontrole: opakované odeslání povzbuzení posílalo další notifikace;
blokování šlo obejít přes skupinu a člena skupiny / odesílatele povzbuzení nešlo zablokovat
(chybělo id); odesílání notifikací drželo transakci přes volání FCM; skupina viděla chvíle
člověka i po jeho odchodu; zpětné zapisování chvil bez omezení (farmení bodů a odznaku
Návrat); opakovaný bonus za jednu pozvánku; dokončená chvíle se počítala ke dni založení;
tiché selhání příspěvku ke skupinovému cíli; náhled pozvánky prozrazoval blok; funkce
prozrazující blok mezi libovolnými lidmi; souběh při vstupu do plné skupiny; neúplný export;
Flutter notifikace (studený start, odhlášení, duplicitní posluchače).

Odloženo:

| Slabé místo | Závažnost | Odkud vím | Jak opravit |
|---|---|---|---|
| Kód služeb a API (Drizzle, Hono, zod, jose) nešel přeložit ani spustit, knihovny nebyly k dispozici | vysoká | neověřeno | `npm install`, `npm run typecheck`, ruční průchod API lokálně |
| Odesílatel může nepřímo poznat, že kamarád vypnul povzbuzení/pozvánky (limity se mu nepočítají, nedoručené pozvánky chybí v seznamu) | střední | nezávislý kontrolor | ukládat řádek s příznakem „nedoručeno“ |
| Po odmítnutí pozvánky do skupiny jde zvát znovu bez omezení | střední | nezávislý kontrolor | odstup např. 7 dní po odmítnutí |
| Ve skupině o 2 lidech prozradí součet i příspěvek druhého | střední | můj úsudek | součet ukazovat až od 3 členů, nebo to v UI říct |
| Feed přátel a výpočet hry čtou celou historii, s růstem dat se zpomalí | střední | kontrolor + můj úsudek | omezit feed na id přátel, hru počítat jen za posledních N týdnů + uložený souhrn |
| Limity (povzbuzení, nahlášení) se kontrolují a pak zapisují: souběžné požadavky je mohou mírně překročit | nízká | nezávislý kontrolor | kontrola v databázi nebo zámek |
| Kdo zná cizí FCM token, může si ho „přesunout“ na sebe | nízká | nezávislý kontrolor | ověřovat token přes FCM / vázat na instalaci |
| Odvolání souhlasu se zdravotními údaji nesmaže staré záznamy, jen zastaví nové | nízká | nezávislý kontrolor | nabídnout při odvolání smazání |
| Token náhledu sdílení je UX pojistka, ne bezpečnostní hranice (klient může náhled zavolat sám) | nízká | nezávislý kontrolor | vědomě ponecháno; podstatné je, že nový záznam je vždy soukromý |
| Pomocné funkce accepts_pings/shares_badges jde volat s libovolným id (prozradí nastavení) | nízká | nezávislý kontrolor | dostupné jen přes SQL jako app_user, ne přes API; vázat na přátelství |
| Migrace z drizzle-kit nejsou v repozitáři, testy RLS běžely nad SQL z náhradního generátoru | střední | ověřeno | `npm run db:generate`, commitnout migrace, `npm run db:test` |
| Webová verze ukládá přihlašovací token do úložiště prohlížeče (localStorage) | nízká | můj úsudek | u Flutteru zabezpečené úložiště; na webu zvážit kratší relace |
| Napojení webu na skutečné API zatím neběželo (bez Supabase projektu) | vysoká | neověřeno | projít `web/README.md`, krok B |
| API ověřuje tokeny jen přes JWKS (asymetrické klíče) | nízká | můj úsudek | zapnout JWT Signing Keys v Supabase |

## Otevřené otázky (rozhoduje tým)

1. **Nezletilí:** minimální věk 15+, nebo režim pro mladší se souhlasem rodiče? (skill `bezpecnost-aplikace`, nezletili.md). Zatím není věk vůbec ověřován.
2. **Osobní týdenní cíl** (kolik chvil = „týden do rytmu“) je zatím pevně 3 pro všechny. Pokud má jít nastavit, je potřeba uložit historii změn, aby se starší týdny zpětně nepřepočítaly dolů.
3. **Změny bodových pravidel** se teď projeví zpětně (body se přepočítávají z historie). Pravidlo „nové hodnoty platí od data změny“ vyžaduje verzování pravidel podle data.
4. **Interní systém podpory:** kam přesně posílat webhook nahlášení (helpdesk, Slack…) a kdo je bude číst.
5. **DPIA a zásady ochrany osobních údajů:** před spuštěním konzultovat s právníkem/pověřencem.
