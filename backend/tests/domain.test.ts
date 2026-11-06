// Testy doménové logiky. Spuštění: npm test (používá vestavěný node:test přes tsx).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeGameState,
  levelForPoints,
  pointsForLevel,
  type GameEvent,
  type MomentEvent,
} from '../supabase/functions/_shared/domain/game.ts';
import { earnedBadges } from '../supabase/functions/_shared/domain/badges.ts';
import { presentGroupGoal } from '../supabase/functions/_shared/domain/groupGoal.ts';
import { buildPushMessage, wantsNotification } from '../supabase/functions/_shared/domain/notifications.ts';
import {
  addDays,
  isInQuietHours,
  localDay,
  nextAllowedSendTime,
  weekStart,
} from '../supabase/functions/_shared/domain/time.ts';
import {
  generateInviteToken,
  looksLikeInviteToken,
  sha256Hex,
  signSharePreview,
  verifySharePreview,
} from '../supabase/functions/_shared/domain/tokens.ts';
import { describeAudience, toSharedMomentView } from '../supabase/functions/_shared/domain/visibility.ts';
import { NOTIFICATION_KIND } from '../supabase/functions/_shared/domain/enums.ts';

let seq = 0;
const m = (day: string, extra: Partial<MomentEvent> = {}): MomentEvent => ({
  type: 'MOMENT',
  id: `m-${String(++seq).padStart(5, '0')}`,
  localDay: day,
  category: 'PROCHAZKA',
  joint: false,
  ...extra,
});

// ---------- čas ----------

test('den končí ve 4:00 místního času (Praha)', () => {
  // 2026-11-07 02:30 v Praze = 01:30 UTC (zimní čas, +1)
  assert.equal(localDay(new Date('2026-11-07T01:30:00Z'), 'Europe/Prague'), '2026-11-06');
  // 04:00 v Praze = 03:00 UTC -> už nový den
  assert.equal(localDay(new Date('2026-11-07T03:00:00Z'), 'Europe/Prague'), '2026-11-07');
  assert.equal(localDay(new Date('2026-11-07T02:59:00Z'), 'Europe/Prague'), '2026-11-06');
});

test('změna časového pásma: stejný okamžik je v různých pásmech jiný herní den', () => {
  const instant = new Date('2026-11-06T23:30:00Z'); // 00:30 dne 7. 11. v Praze
  assert.equal(localDay(instant, 'Europe/Prague'), '2026-11-06');
  assert.equal(localDay(instant, 'America/New_York'), '2026-11-06'); // 18:30 v NY
  assert.equal(localDay(instant, 'Asia/Tokyo'), '2026-11-07'); // 08:30 v Tokiu
});

test('týden začíná v pondělí', () => {
  assert.equal(weekStart('2026-11-06'), '2026-11-02'); // pátek -> pondělí
  assert.equal(weekStart('2026-11-08'), '2026-11-02'); // neděle -> pondělí
  assert.equal(weekStart('2026-11-09'), '2026-11-09'); // pondělí
});

test('noční klid přes půlnoc a odložení notifikace do rána', () => {
  const q = { enabled: true, start: '22:00', end: '08:00', timeZone: 'Europe/Prague' };
  const at2330 = new Date('2026-11-06T22:30:00Z'); // 23:30 Praha
  assert.equal(isInQuietHours(at2330, q), true);
  assert.equal(nextAllowedSendTime(at2330, q).toISOString(), '2026-11-07T07:00:00.000Z'); // 8:00 Praha

  const at0300 = new Date('2026-11-07T02:00:00Z'); // 03:00 Praha
  assert.equal(nextAllowedSendTime(at0300, q).toISOString(), '2026-11-07T07:00:00.000Z');

  const noon = new Date('2026-11-06T11:00:00Z');
  assert.equal(isInQuietHours(noon, q), false);
  assert.equal(nextAllowedSendTime(noon, q), noon);

  assert.equal(isInQuietHours(at2330, { ...q, enabled: false }), false);
});

test('noční klid v létě (jiný posun pásma)', () => {
  const q = { enabled: true, start: '22:00', end: '08:00', timeZone: 'Europe/Prague' };
  const summer = new Date('2026-07-01T21:00:00Z'); // 23:00 Praha (+2)
  assert.equal(nextAllowedSendTime(summer, q).toISOString(), '2026-07-02T06:00:00.000Z');
});

// ---------- body, stropy, úrovně ----------

test('křivka úrovní odpovídá tabulce z herního návrhu', () => {
  assert.deepEqual(
    [2, 3, 5, 10, 15, 20].map(pointsForLevel),
    [50, 132, 348, 1084, 2012, 3085],
  );
  assert.equal(levelForPoints(0), 1);
  assert.equal(levelForPoints(49), 1);
  assert.equal(levelForPoints(50), 2);
});

test('denní strop: přesně na stropu a nad ním', () => {
  const two = computeGameState([m('2026-11-06'), m('2026-11-06')], '2026-11-06');
  assert.equal(two.points, 20);
  assert.equal(two.dailyCapReached, true);

  const three = computeGameState([m('2026-11-06'), m('2026-11-06'), m('2026-11-06')], '2026-11-06');
  assert.equal(three.points, 20, 'třetí chvíle se uloží, ale bez bodů');
  assert.equal(three.rhythmWeeksTotal, 0, 'rytmus nejde splnit za jediný den');
  assert.equal(three.momentsThisWeek, 3, 'člověk ale vidí všechny své chvíle');

  const one = computeGameState([m('2026-11-06')], '2026-11-06');
  assert.equal(one.dailyCapReached, false);
});

test('duplicitní událost se započítá jen jednou (idempotence)', () => {
  const e = m('2026-11-06');
  const state = computeGameState([e, e, { ...e }], '2026-11-06');
  assert.equal(state.points, 10);
});

test('společná chvíle: bonus 1× denně', () => {
  const s = computeGameState(
    [m('2026-11-06', { joint: true }), m('2026-11-06', { joint: true })],
    '2026-11-06',
  );
  assert.equal(s.points, 20 + 5);
});

test('povzbuzení: body jen do týdenního stropu', () => {
  const pings: GameEvent[] = Array.from({ length: 8 }, (_, i) => ({
    type: 'PING_SENT',
    id: `p-${i}`,
    localDay: '2026-11-03',
  }));
  assert.equal(computeGameState(pings, '2026-11-06').points, 10);
});

test('týdenní rytmus se počítá celkem, vynechaný týden nic nenuluje', () => {
  const weekA = ['2026-10-05', '2026-10-06', '2026-10-07'].map((d) => m(d));
  const weekB = ['2026-10-19', '2026-10-20', '2026-10-21'].map((d) => m(d)); // týden 12.10. vynechán
  const s = computeGameState([...weekA, ...weekB], '2026-10-21');
  assert.equal(s.rhythmWeeksTotal, 2);
});

test('pokrok nikdy neklesá: přidání pauzy nesníží body ani rytmus', () => {
  const history = ['2026-10-05', '2026-10-06', '2026-10-07'].map((d) => m(d));
  const before = computeGameState(history, '2026-10-07');
  const monthLater = computeGameState(history, '2026-11-30');
  assert.equal(monthLater.points, before.points);
  assert.equal(monthLater.rhythmWeeksTotal, before.rhythmWeeksTotal);
  assert.equal(monthLater.level, before.level);
});

test('návrat po pauze: přesně 14 dní ano, 13 dní ne', () => {
  const after14 = computeGameState([m('2026-10-01'), m('2026-10-15')], '2026-10-15');
  assert.equal(after14.points, 10 + 10 + 20);
  assert.equal(after14.welcomeBack, true);

  const after13 = computeGameState([m('2026-10-01'), m('2026-10-14')], '2026-10-14');
  assert.equal(after13.points, 20);
  assert.equal(after13.welcomeBack, false);
});

test('návrat po pauze se ocení nejvýš 1× za 30 dní', () => {
  const s = computeGameState(
    [m('2026-01-01'), m('2026-01-15'), m('2026-01-30')], // dva návraty jen 15 dní od sebe
    '2026-01-30',
  );
  assert.equal(s.points, 30 + 20);
});

test('vypnutá a znovu zapnutá hra: stav se přepočítá ze stejných událostí beze ztráty', () => {
  const events = [m('2026-11-02'), m('2026-11-03'), m('2026-11-04')];
  const a = computeGameState(events, '2026-11-04');
  const b = computeGameState(events, '2026-11-04');
  assert.deepEqual(a, b);
});

// ---------- odznaky ----------

test('odznaky za péči z konkrétních událostí', () => {
  const badges = earnedBadges([
    m('2026-10-01'),
    m('2026-10-20', { category: 'BEZ_TELEFONU', joint: true }),
    { type: 'PING_SENT', id: 'p1', localDay: '2026-10-20' },
  ]);
  assert.deepEqual(
    [...badges].sort(),
    ['BEZ_TELEFONU', 'DOBRY_KAMARAD', 'NAVRAT', 'PRVNI_CHVILKA', 'SPOLU'].sort(),
  );
});

test('pestrost až od pěti různých druhů', () => {
  const four = ['PROCHAZKA', 'CTENI', 'PAUZA', 'SPANEK'] as const;
  assert.equal(earnedBadges(four.map((c) => m('2026-11-01', { category: c }))).has('PESTROST'), false);
  const five = [...four, 'TVORENI'] as const;
  assert.equal(earnedBadges(five.map((c) => m('2026-11-01', { category: c }))).has('PESTROST'), true);
});

// ---------- skupinový cíl ----------

test('skupinový cíl vrací jen součet a pozitivní text', () => {
  const p = presentGroupGoal({ goalId: 'g', category: 'PROCHAZKA', together: 7, target: 10 });
  assert.equal(p.text, 'Spolu 7 z 10 procházek');
  assert.deepEqual(Object.keys(p).sort(), ['category', 'goalId', 'reached', 'target', 'text', 'together']);
  for (const together of [0, 3, 10, 12]) {
    const t = presentGroupGoal({ goalId: 'g', category: 'PAUZA', together, target: 10 }).text;
    assert.doesNotMatch(t, /zbývá|nesplněn|chybí|limit|ještě/i);
  }
});

// ---------- notifikace ----------

test('push zprávy jsou bezpečné pro zamčenou obrazovku', () => {
  const sensitive = /nálad|stres|úzkost|procházk|tom|klár|myslím na tebe|dej si pauzu/i;
  for (const kind of NOTIFICATION_KIND) {
    const msg = buildPushMessage(kind, '7c6c3f47-8f0a-4a39-9d8e-6f3d6d1b2a10');
    assert.deepEqual(Object.keys(msg).sort(), ['body', 'data', 'title']);
    assert.deepEqual(Object.keys(msg.data).sort(), ['refId', 'type']);
    assert.doesNotMatch(msg.body, sensitive);
  }
  assert.throws(() => buildPushMessage('POVZBUZENI', 'Tom ti píše: je mi hrozně'));
});

test('vypnutá hra = žádná notifikace o odznaku', () => {
  const prefs = { receivePings: true, receiveRestInvites: true, gameEnabled: false };
  assert.equal(wantsNotification('ODZNAK', prefs), false);
  assert.equal(wantsNotification('POVZBUZENI', { ...prefs, receivePings: false }), false);
});

// ---------- tokeny ----------

test('pozvánkový token je dlouhý, náhodný a ukládá se jen jeho otisk', async () => {
  const a = await generateInviteToken();
  const b = await generateInviteToken();
  assert.notEqual(a.token, b.token);
  assert.equal(looksLikeInviteToken(a.token), true);
  assert.equal(a.tokenHash, await sha256Hex(a.token));
  assert.notEqual(a.tokenHash, a.token);
});

test('token náhledu sdílení: platí jen pro stejnou chvíli, publikum a čas', async () => {
  const secret = 'x'.repeat(40);
  const claims = { activityId: 'a1', userId: 'u1', visibility: 'PRATELE' as const, crewId: null };
  const now = new Date('2026-11-06T10:00:00Z');
  const token = await signSharePreview(secret, claims, 600, now);

  assert.equal(await verifySharePreview(secret, token, claims, now), true);
  assert.equal(
    await verifySharePreview(secret, token, { ...claims, visibility: 'CHILL_CREW', crewId: 'g1' }, now),
    false,
    'náhled pro přátele nesmí odemknout sdílení jinam',
  );
  assert.equal(await verifySharePreview(secret, token, { ...claims, activityId: 'a2' }, now), false);
  assert.equal(await verifySharePreview(secret, token, claims, new Date('2026-11-06T10:11:00Z')), false);
  assert.equal(await verifySharePreview(secret, 'nesmysl', claims, now), false);
  assert.equal(await verifySharePreview('y'.repeat(40), token, claims, now), false);
});

// ---------- viditelnost ----------

test('soukromá chvíle se nikdy nedostane do sdíleného výstupu', () => {
  assert.throws(() =>
    toSharedMomentView({
      id: 'a',
      authorName: 'Klára',
      category: 'CTENI',
      localDay: '2026-11-06',
      visibility: 'JEN_JA',
      crewId: null,
    }),
  );
  assert.equal(describeAudience('CHILL_CREW', 'Chill crew'), 'Uvidí členové skupiny Chill crew.');
});

test('addDays přes konec měsíce', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});

import { validateAvatar } from '../supabase/functions/_shared/domain/avatar.ts';

test('profilová fotka: jen skutečný malý JPEG/PNG/WebP', () => {
  const png = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).toString('base64');
  assert.equal(validateAvatar(png), png);
  // tvrdí PNG, ale data jsou SVG
  const fake = 'data:image/png;base64,' + Buffer.from('<svg onload=alert(1)>').toString('base64');
  assert.throws(() => validateAvatar(fake));
  assert.throws(() => validateAvatar('data:image/svg+xml;base64,PHN2Zz4='));
  assert.throws(() => validateAvatar('javascript:alert(1)'));
  const big = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(160_000)]).toString('base64');
  assert.throws(() => validateAvatar(big));
});
