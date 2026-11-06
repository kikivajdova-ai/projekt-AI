// Čtení proměnných prostředí tak, aby fungovalo v Deno (Edge Functions) i v Node (testy).
// Tajemství (hesla, klíče) jsou JEN tady, nikdy v kódu aplikace v telefonu.

type DenoLike = { env: { get(name: string): string | undefined } };

export function env(name: string): string | undefined {
  const deno = (globalThis as { Deno?: DenoLike }).Deno;
  if (deno) return deno.env.get(name);
  return (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env[name];
}

export function requireEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`Chybí proměnná prostředí ${name} (viz .env.example)`);
  return value;
}

/**
 * Připojení k databázi jako app_api. Buď celé APP_DB_URL, nebo jen APP_DB_PASSWORD:
 * adresu pooleru pak vezmeme ze SUPABASE_DB_URL (dodává ji Supabase) a vyměníme
 * uživatele postgres za app_api. Heslo tak nikdy není v kódu ani v Gitu.
 */
export function appDbUrl(): string {
  const full = env('APP_DB_URL');
  if (full) return full;
  const password = requireEnv('APP_DB_PASSWORD');
  const url = new URL(requireEnv('SUPABASE_DB_URL'));
  // pooler: uživatel "postgres.<ref>" -> "app_api.<ref>"; přímé připojení: "postgres" -> "app_api"
  url.username = url.username.replace(/^postgres/, 'app_api');
  url.password = password; // setter sám zakóduje speciální znaky
  return url.toString();
}

/** Klíč pro podpis náhledu sdílení: SHARE_PREVIEW_SECRET, jinak odvozený z tajného klíče projektu. */
export function sharePreviewSecret(): string {
  return env('SHARE_PREVIEW_SECRET') ?? `share-preview:${requireEnv('SUPABASE_SERVICE_ROLE_KEY')}`;
}

/** Adresa webové aplikace (pro CORS a pozvánkové odkazy). Výchozí je lokální vývoj. */
export function appOrigins(): string {
  return env('ALLOWED_ORIGIN') ?? 'http://localhost:3000';
}

export function inviteBaseUrl(): string {
  return env('APP_INVITE_BASE_URL') ?? `${appOrigins().split(',')[0].trim()}/#/pozvanka`;
}
