# Webová aplikace Odpočívat spolu

Funguje v prohlížeči na počítači i v mobilu (jde si ji „přidat na plochu“).
Nepotřebuje žádné sestavování, jsou to čtyři soubory: `index.html`, `styles.css`, `api.js`, `app.js`.

- **Bez `config.js`** běží v **ukázkovém režimu**: data jsou jen v tvém prohlížeči, kamarádi jsou vymyšlení.
- **S `config.js`** se přihlašuje přes Supabase a všechno ukládá náš backend (pravidla RLS, soukromí, hra).

## A) Vyzkoušet hned (ukázkový režim)

Potřebuješ jen Node.js (https://nodejs.org, verze LTS). V terminálu:

```bash
cd web                     # složka s aplikací
npx serve -l 3000          # spustí malý webový server (poprvé se zeptá na instalaci, potvrď "y")
```

Otevři v prohlížeči **http://localhost:3000**. Zaregistruj se libovolným e-mailem a heslem
(v ukázce se nikam neposílají). Tlačítkem „Začít znovu“ nahoře vrátíš ukázku do začátku.

## B) Napojit na Supabase (skutečné účty a kamarádi)

Celé to zabere zhruba hodinu. Každý krok jde udělat zvlášť, nic se nerozbije.

### 1. Projekt v Supabase
1. Na https://supabase.com se přihlas a klikni **New project**.
2. Název třeba `odpocivat-spolu`, **Region: Central EU (Frankfurt)** (kvůli GDPR), vymysli heslo databáze a ulož si ho do správce hesel.
3. Počkej, až se projekt vytvoří (pár minut).

### 2. Nahrát databázi a backend
Ve složce `backend` (podrobnosti jsou v hlavním `README.md`):

```bash
npm install                                  # stáhne knihovny
npx supabase login                           # přihlášení v prohlížeči
npx supabase link --project-ref <id>         # <id> najdeš v adrese projektu: supabase.com/dashboard/project/<id>
npx supabase db push                         # vytvoří tabulky, pravidla RLS a role
```

V Supabase otevři **SQL Editor** a nastav heslo pro účet, kterým se k databázi připojuje API
(vymysli dlouhé náhodné heslo, nikam ho nepiš do kódu):

```sql
alter role app_api with password 'sem-dlouhe-nahodne-heslo';
```

### 3. Tajemství pro API a nasazení
Zkopíruj `backend/supabase/functions/.env.example` jako `.env` ve stejné složce a vyplň:

| Proměnná | Co tam patří |
|---|---|
| `APP_DB_URL` | Supabase → **Connect** → *Transaction pooler*; uživatele přepiš na `app_api.<id>` a heslo na to z kroku 2 |
| `SHARE_PREVIEW_SECRET`, `CRON_SECRET` | dva různé náhodné řetězce (aspoň 32 znaků) |
| `APP_INVITE_BASE_URL` | adresa aplikace + `#/pozvanka`, např. `http://localhost:3000/#/pozvanka` |
| `ALLOWED_ORIGIN` | adresa aplikace, např. `http://localhost:3000` (víc adres odděl čárkou) |
| `SUPPORT_WEBHOOK_URL`, `SUPPORT_WEBHOOK_SECRET`, `FCM_SERVICE_ACCOUNT_JSON` | zatím můžeš nechat prázdné |

```bash
npx supabase secrets set --env-file ./supabase/functions/.env
npx supabase functions deploy api
npx supabase functions deploy dispatch --no-verify-jwt
```

### 4. Přihlašování
V Supabase: **Authentication → Providers → Email** zapnout, minimální délka hesla 10, potvrzení e-mailu zapnout.
**Authentication → URL Configuration**: do *Site URL* a *Redirect URLs* dej adresu aplikace (`http://localhost:3000`).
**Settings → JWT Keys**: projekt musí používat nové asymetrické klíče (u nových projektů je to výchozí).

### 5. Propojit aplikaci
Zkopíruj `web/config.example.js` jako `web/config.js` a vyplň z **Settings → API**:

```js
window.APP_CONFIG = {
  supabaseUrl: 'https://<id>.supabase.co',
  supabaseAnonKey: '<anon / publishable klíč>',
};
```

Oba údaje jsou veřejné. **Klíč `service_role` sem nikdy nedávej.** Soubor `config.js` je v `.gitignore`.

Pak znovu `npx serve -l 3000` ve složce `web` a otevři http://localhost:3000. Ukázkový pruh nahoře zmizí.

### 6. Vyzkoušet s kamarádem
1. Zaregistruj se, potvrď e-mail a přihlas se.
2. **Přátelé → Pozvat kamaráda odkazem** → odkaz pošli (nebo ho otevři v anonymním okně a založ si druhý účet).
3. Druhý účet pozvánku přijme, první ji potvrdí. Teď jde posílat povzbuzení a zvát na chvilky „S kamarádem“.

## Když něco nejde

| Co vidíš | Co s tím |
|---|---|
| „Nejde se spojit se serverem“ | Funkce `api` není nasazená, nebo v `ALLOWED_ORIGIN` chybí adresa aplikace |
| „Přihlášení vypršelo“ hned po přihlášení | V Supabase zapni asymetrické JWT klíče (krok 4) |
| „Nejdřív si dokonči profil“ | Odhlas se a přihlas znovu, aplikace se zeptá na přezdívku |
| Cokoli s „permission denied“ v logu funkce | Pravidla fungují, je potřeba upravit pravidlo nebo grant. **Nikdy nevypínej RLS.** |

## Bezpečnost webové verze (vědomé kompromisy)
- Přihlášení (token) si supabase-js ukládá do úložiště prohlížeče. U mobilní aplikace ve Flutteru bude v zabezpečeném úložišti telefonu.
- Krizové linky jsou napevno v `app.js` a fungují i bez serveru a bez přihlášení.
- Veškerý text od uživatelů (přezdívky, názvy skupin) se před zobrazením escapuje, takže z něj nejde spustit kód.
