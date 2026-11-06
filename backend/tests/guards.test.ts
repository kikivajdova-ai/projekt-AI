// „Strážní“ testy: hlídají pravidla aplikace přímo ve zdrojácích, aby se nedala
// omylem porušit při budoucích úpravách (třeba když kód dopisuje AI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : files(p, ext);
    return ext.test(name) ? [p] : [];
  });
}

const sqlFiles = [...files(join(root, 'supabase'), /\.sql$/), ...files(join(root, 'sql'), /\.sql$/)];
const tsFiles = files(join(root, 'supabase', 'functions'), /\.ts$/);
const schemaFiles = files(join(root, 'supabase', 'functions', '_shared', 'db', 'schema'), /\.ts$/);
const read = (p: string) => readFileSync(p, 'utf8');

test('databáze nemá žádné triggery (nic se samo nenuluje ani netrestá)', () => {
  const testFiles = new Set(files(join(root, 'supabase', 'tests'), /\.sql$/));
  for (const f of sqlFiles.filter((f) => !testFiles.has(f))) {
    assert.doesNotMatch(read(f), /create\s+(or\s+replace\s+)?(constraint\s+)?trigger/i, relative(root, f));
  }
  for (const f of tsFiles) assert.doesNotMatch(read(f), /create\s+trigger/i, relative(root, f));
});

test('schéma neobsahuje počítadla sérií ani bodů (počítá se z událostí)', () => {
  for (const f of schemaFiles) {
    assert.doesNotMatch(read(f), /streak|serie|current_points|'points'|lives|hearts/i, relative(root, f));
  }
});

test('stav chvíle nemá žádnou hodnotu pro neúspěch', () => {
  const enums = read(join(root, 'supabase', 'functions', '_shared', 'domain', 'enums.ts'));
  const statusLine = enums.match(/ACTIVITY_STATUS = \[(.*?)\]/)?.[1] ?? '';
  assert.doesNotMatch(statusLine, /NESPLNENO|FAILED|MISSED|PROPADLO|ZMESKANO/i);
});

test('API nemá vyhledávání uživatelů ani žebříčky', () => {
  const api = read(join(root, 'supabase', 'functions', '_shared', 'api', 'app.ts'));
  const routes = [...api.matchAll(/app\.(get|post|patch|delete)\('([^']+)'/g)].map((m) => m[2]);
  assert.ok(routes.length > 20, 'načteny cesty API');
  for (const r of routes) assert.doesNotMatch(r, /search|hledat|lookup|find|leaderboard|zebricek|ranking|users\b/i, r);
  assert.doesNotMatch(api, /ilike|like\(/i, 'žádné textové hledání');
});

test('nová chvíle se v databázi vkládá jen jako JEN_JA', () => {
  const schema = read(join(root, 'supabase', 'functions', '_shared', 'db', 'schema', 'activities.ts'));
  assert.match(schema, /nový záznam je VŽDY soukromý[\s\S]*?for: 'insert'[\s\S]*?visibility\} = 'JEN_JA'/);
  const api = read(join(root, 'supabase', 'functions', '_shared', 'api', 'app.ts'));
  const momentSchema = api.match(/moment: z\.strictObject\(\{([\s\S]*?)\}\),/)?.[1] ?? '';
  assert.doesNotMatch(momentSchema, /visibility/, 'vstup pro novou chvíli nesmí přijímat viditelnost');
});

test('přátelé vidí jen splněné chvíle (RLS i dotaz feedu)', () => {
  const schema = read(join(root, 'supabase', 'functions', '_shared', 'db', 'schema', 'activities.ts'));
  const friendPolicies = [...schema.matchAll(/pgPolicy\('activities: (přátelé|skupina)[\s\S]*?\}\)/g)];
  assert.equal(friendPolicies.length, 2);
  for (const p of friendPolicies) assert.match(p[0], /status\} = 'SPLNENO'/);
  const service = read(join(root, 'supabase', 'functions', '_shared', 'services', 'activities.ts'));
  assert.match(service.slice(service.indexOf('export async function friendsFeed')), /eq\(activities\.status, 'SPLNENO'\)/);
});

test('nálada a stres: žádná politika pro app_system ani pro přátele', () => {
  const users = read(join(root, 'supabase', 'functions', '_shared', 'db', 'schema', 'users.ts'));
  const block = users.slice(users.indexOf("pgTable(\n  'wellbeing_checkins'"));
  assert.doesNotMatch(block, /appSystem|are_friends|is_group_member|visibility/);
  const grants = read(join(root, 'sql', 'granty.sql'));
  assert.doesNotMatch(grants, /wellbeing_checkins to app_system/);
});

test('telefon nemá přímý přístup k tabulkám', () => {
  const grants = read(join(root, 'sql', 'granty.sql'));
  assert.match(grants, /revoke all on all tables in schema public from anon, authenticated/);
  assert.doesNotMatch(grants, /to (anon|authenticated)\b/);
});

test('odpověď na pozvánku k odpočinku nemá pole pro vysvětlení', () => {
  const api = read(join(root, 'supabase', 'functions', '_shared', 'api', 'app.ts'));
  const answer = api.match(/restAnswer: z\.strictObject\(\{([^}]*)\}\)/)?.[1] ?? '';
  assert.equal(answer.trim(), 'odpoved: z.enum(REST_INVITE_ANSWER)');
  const schema = read(join(root, 'supabase', 'functions', '_shared', 'db', 'schema', 'interactions.ts'));
  assert.doesNotMatch(schema, /reason|duvod|message|text\(/i);
});

test('žádný service_role klíč ani tajemství v kódu', () => {
  for (const f of tsFiles) {
    const s = read(f);
    assert.doesNotMatch(s, /eyJ[A-Za-z0-9_-]{20,}\./, `JWT v ${relative(root, f)}`);
    assert.doesNotMatch(s, /-----BEGIN (RSA )?PRIVATE KEY-----/, relative(root, f));
  }
});

test('názvy RLS politik se vejdou do limitu PostgreSQL (63 bajtů)', () => {
  for (const f of schemaFiles) {
    for (const m of read(f).matchAll(/pgPolicy\('([^']+)'/g)) {
      assert.ok(new TextEncoder().encode(m[1]).length <= 63, `${m[1]} (${relative(root, f)})`);
    }
  }
});
