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
