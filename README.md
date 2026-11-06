# Odpočívat spolu

Gamifikovaná wellbeing aplikace, ve které se s kamarády navzájem motivujeme k odpočinku.
Tento repozitář obsahuje **backend** (databáze, pravidla přístupu, serverová logika)
a **části mobilní aplikace ve Flutteru**, které souvisejí s bezpečností a soukromím.

```
backend/                     server: Supabase (PostgreSQL) + Drizzle ORM + Edge Functions
  supabase/functions/_shared/
    domain/                  čistá logika bez databáze (body, stropy, čas, texty) – nejvíc testů
    db/schema/               tabulky a pravidla RLS (kdo vidí které řádky)
    services/                práce s daty (vždy jménem uživatele, nebo jako omezený systém)
    api/                     HTTP API (Hono) s kontrolou vstupů (zod)
  supabase/migrations/       SQL migrace (základ zabezpečení + generované z Drizzle)
  supabase/tests/            testy pravidel přímo v databázi (pgTAP)
  sql/granty.sql             kdo smí s kterou tabulkou a sloupcem pracovat
  tests/                     testy logiky a „strážní“ testy pravidel aplikace
web/                         webová aplikace s designem z plátna (ukázkový režim nebo napojení na Supabase)
app/                         Flutter: krizové kontakty, pozvánky, náhled sdílení, notifikace
design/                      klikací návrh obrazovek
docs/kdo-co-vidi.md          přehled viditelnosti všech údajů
PROJEKT.md                   deník projektu: rozhodnutí, stav, slabá místa
```

## Jak to funguje (v kostce)

- **Přihlášení** e-mailem a heslem přes Supabase Auth. Jméno je jen přezdívka v profilu.
- **Telefon nemá přímý přístup k databázi.** Všechno jde přes naše API (Edge Function `api`).
- API se k databázi připojuje účtem `app_api`, který sám nemá žádná práva. Pro každý
  požadavek si nasadí roli `app_user` (jedná za přihlášeného člověka, platí pravidla RLS)
  nebo `app_system` (úzce vymezené serverové úkoly). Když se zapomene, databáze nic nevydá.
- **Row Level Security (RLS)** je vrátný u každé tabulky: pustí člověka jen k řádkům, které
  vidět smí. Pravidla jsou napsaná přímo u tabulek v `backend/supabase/functions/_shared/db/schema/`.
- **Body se neukládají**, počítají se ze splněných chvil. Proto neexistuje série, která by
  šla vynulovat, a databáze nemá jediný trigger.

## Co budeš potřebovat

| Nástroj | K čemu | Instalace |
|---|---|---|
| Node.js 20 nebo novější | spouští testy a nástroje backendu | https://nodejs.org (verze LTS) |
| Docker Desktop | lokální Supabase na tvém počítači | https://www.docker.com/products/docker-desktop |
| Flutter SDK | mobilní aplikace | https://docs.flutter.dev/get-started/install |
| Účet Supabase | databáze v cloudu (region **EU – Frankfurt**) | https://supabase.com |
| Projekt Firebase | push notifikace | https://console.firebase.google.com |

**Terminál** je okno, kam se píšou příkazy: na Macu aplikace *Terminál*, na Windows
*PowerShell*, ve VS Code nabídka *Terminal → New Terminal*.

## Backend: první spuštění na tvém počítači

```bash
cd backend                      # přepni se do složky backendu
npm install                     # stáhne knihovny (vznikne složka node_modules a package-lock.json)
npm test                        # spustí testy logiky – měly by všechny projít
npx supabase init               # vytvoří supabase/config.toml (na otázky odpověz Enter)
```

Do souboru `backend/supabase/config.toml` doplň (nebo uprav) tyto řádky:

```toml
[auth]
minimum_password_length = 10

[auth.email]
enable_confirmations = true

[functions.dispatch]
verify_jwt = false   # tuhle funkci volá plánovač se svým tajemstvím, ne uživatel
```

Pak vygeneruj migrace ze schématu a spusť lokální databázi:

```bash
npm run db:generate             # z TypeScript schématu vyrobí SQL migrace + granty a katalog odznaků
npx supabase start              # spustí lokální Supabase v Dockeru (poprvé to chvíli trvá)
npx supabase db reset           # vytvoří databázi ze všech migrací
npm run db:test                 # testy pravidel RLS přímo v databázi (39 testů)
```

### Heslo pro `app_api`

Heslo se nikdy nepíše do migrací ani do Gitu. Nastav ho v SQL editoru (lokálně
http://127.0.0.1:54323, v cloudu *SQL Editor* v Supabase):

```sql
alter role app_api with password 'sem-dej-dlouhe-nahodne-heslo';
```

Pak zkopíruj `backend/supabase/functions/.env.example` na `.env` ve stejné složce,
vyplň hodnoty a spusť API:

```bash
npm run functions:serve         # API poběží na http://127.0.0.1:54321/functions/v1/api
```

## Backend: nasazení do Supabase (cloud)

```bash
npx supabase login                          # přihlášení v prohlížeči
npx supabase link --project-ref <id>        # propojí složku s projektem
npx supabase db push                        # nahraje migrace
npx supabase secrets set --env-file ./supabase/functions/.env
npx supabase functions deploy api
npx supabase functions deploy dispatch
```

V nastavení projektu Supabase ještě:

1. **Authentication → Providers → Email**: zapnout heslo, potvrzení e-mailu, min. délka 10.
2. **Authentication → Attack Protection**: zapnout CAPTCHA a kontrolu uniklých hesel (pokud je k dispozici).
3. **Integrations → Cron**: úloha každých 5 minut, HTTP POST na
   `https://<id>.supabase.co/functions/v1/dispatch` s hlavičkou `x-cron-secret: <CRON_SECRET>`.
4. **Advisors → Security Advisor**: nesmí hlásit tabulku bez RLS.
5. Doporučení: v **Settings → API** odebrat schéma `public` z vystavených schémat (aplikace ho nepotřebuje).
6. **Settings → JWT Keys**: projekt musí používat asymetrické podpisové klíče (JWKS). API ověřuje
   tokeny přes `/.well-known/jwks.json`; se starým sdíleným tajemstvím (HS256) ověření selže.

## Webová aplikace

Nejrychlejší způsob, jak aplikaci spustit: `cd web && npx serve -l 3000` a otevřít http://localhost:3000.
Bez nastavení běží v ukázkovém režimu, napojení na Supabase popisuje `web/README.md`.

## Mobilní aplikace (Flutter)

Ve složce `app/` jsou hotové části: krizové kontakty, karta pozvánky k odpočinku,
náhled sdílení, nastavení notifikací a klient API. Kostru projektu pro Android a iPhone vytvoříš takto:

```bash
cd app
flutter create . --project-name odpocivat_spolu --platforms android,ios   # doplní složky android/ a ios/
flutter pub get                 # stáhne knihovny
flutter test                    # testy krizových kontaktů
dart pub global activate flutterfire_cli && flutterfire configure        # propojí Firebase (notifikace)
flutter run                     # spustí aplikaci v emulátoru nebo na připojeném telefonu
```

Aplikaci pro iPhone jde sestavit jen na Macu (nebo přes cloudovou službu).

## Užitečné příkazy

| Příkaz (ve složce `backend`) | Co dělá |
|---|---|
| `npm test` | testy logiky a strážní testy (bez databáze) |
| `npm run db:test` | testy pravidel RLS v lokální databázi |
| `npm run typecheck` | kontrola typů TypeScriptu |
| `npm run lint` | kontrola stylu kódu |
| `npm run db:generate` | po změně schématu vyrobí nové migrace |

## Když je potíž

- **„permission denied“ / „violates row-level security policy“**: pravidla fungují. Uprav
  pravidlo nebo grant, **nikdy nevypínej RLS**.
- **Migrace granty selže, že tabulka neexistuje**: nejdřív `drizzle-kit generate`, pak skript
  (obojí dělá `npm run db:generate`).
