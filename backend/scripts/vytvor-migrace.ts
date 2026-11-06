// Po `drizzle-kit generate` vytvoří migraci s granty a katalogem odznaků.
// Spouští se automaticky přes `npm run db:generate`.
//
// Proč zvlášť: drizzle-kit umí tabulky a RLS politiky, ale ne GRANT příkazy
// a data. Migrace dostane časovou značku „teď“, takže poběží až po tabulkách.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BADGE_CATALOG } from '../supabase/functions/_shared/domain/badges.ts';

const root = join(import.meta.dirname, '..');
const migrationsDir = join(root, 'supabase', 'migrations');

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

const latest = readdirSync(migrationsDir)
  .filter((f) => /^\d{14}_.+\.sql$/.test(f))
  .sort()
  .at(-1);

let ts = timestamp();
if (latest && latest.slice(0, 14) >= ts) ts = String(BigInt(latest.slice(0, 14)) + 1n);

const grants = readFileSync(join(root, 'sql', 'granty.sql'), 'utf8');
const catalog = BADGE_CATALOG.map(
  (b) => `  (${quote(b.code)}, ${quote(b.name)}, ${quote(b.description)})`,
).join(',\n');

const content = `-- Vygenerováno skriptem scripts/vytvor-migrace.ts – needitovat ručně.
${grants}
-- Katalog odznaků (zdroj: supabase/functions/_shared/domain/badges.ts)
insert into public.badges (code, name, description) values
${catalog}
on conflict (code) do update set name = excluded.name, description = excluded.description;
`;

const file = join(migrationsDir, `${ts}_granty_a_katalog.sql`);
writeFileSync(file, content);
console.log(`Vytvořena migrace ${file}`);
