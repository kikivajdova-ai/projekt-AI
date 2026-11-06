// Výpočet herního stavu z uložených událostí. Body se nikde neukládají: jediný zdroj
// pravdy jsou splněné chvíle a odeslaná povzbuzení v databázi. Díky tomu:
//  - stav nejde zfalšovat z telefonu,
//  - neexistuje žádné počítadlo série, které by šlo vynulovat,
//  - vypnutí a znovuzapnutí hry nic nemaže (stav se jen přepočítá).

import type { ActivityCategory } from './enums.ts';
import { GAME_RULES } from './config.ts';
import { daysBetween, weekStart, type LocalDay } from './time.ts';

export interface MomentEvent {
  type: 'MOMENT';
  /** Unikátní id z telefonu: stejná chvíle odeslaná dvakrát se započítá jednou. */
  id: string;
  localDay: LocalDay;
  category: ActivityCategory;
  /** Chvíle strávená spolu díky přijaté pozvánce k odpočinku. */
  joint: boolean;
}

export interface PingSentEvent {
  type: 'PING_SENT';
  id: string;
  localDay: LocalDay;
}

export type GameEvent = MomentEvent | PingSentEvent;

export interface GameState {
  points: number;
  level: number;
  /** Celkový počet bodů pro další úroveň (UI ukazuje zahradu, ne čísla). */
  nextLevelAt: number;
  momentsThisWeek: number;
  /** Kolik týdnů celkem měl člověk aspoň N chvil. Počítá se celkem, NE „v řadě“, nic se nenuluje. */
  rhythmWeeksTotal: number;
  /** Dnes už jsou chvíle za body vyčerpané -> laskavé „Na dnešek máš hotovo“. */
  dailyCapReached: boolean;
  /** Poslední chvíle byla návratem po pauze -> uvítání „Vítej zpátky“. */
  welcomeBack: boolean;
}

/** Celkové body potřebné pro úroveň n (úroveň 1 = 0 bodů). */
export function pointsForLevel(n: number): number {
  if (n <= 1) return 0;
  const { base, exponent } = GAME_RULES.levels;
  return Math.round(base * Math.pow(n - 1, exponent));
}

export function levelForPoints(points: number): number {
  let level = 1;
  while (pointsForLevel(level + 1) <= points) level++;
  return level;
}

function dedupe<T extends { id: string }>(events: T[]): T[] {
  const seen = new Set<string>();
  return events.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

/** Seřadí deterministicky: podle dne, pak podle id (stejný vstup = vždy stejný výsledek). */
function sortByDay<T extends { localDay: LocalDay; id: string }>(events: T[]): T[] {
  return [...events].sort((a, b) =>
    a.localDay === b.localDay ? a.id.localeCompare(b.id) : a.localDay.localeCompare(b.localDay),
  );
}

/** Dny, ve kterých nastal návrat po pauze (s ohledem na 30denní odstup mezi oceněními). */
export function comebackDays(moments: MomentEvent[]): LocalDay[] {
  const days = [...new Set(sortByDay(dedupe(moments)).map((m) => m.localDay))];
  const result: LocalDay[] = [];
  const { minGapDays, cooldownDays } = GAME_RULES.comeback;
  for (let i = 1; i < days.length; i++) {
    const gap = daysBetween(days[i - 1], days[i]);
    const last = result[result.length - 1];
    if (gap >= minGapDays && (!last || daysBetween(last, days[i]) >= cooldownDays)) {
      result.push(days[i]);
    }
  }
  return result;
}

export function computeGameState(events: GameEvent[], today: LocalDay): GameState {
  const unique = dedupe(events);
  const moments = sortByDay(unique.filter((e): e is MomentEvent => e.type === 'MOMENT'));
  const pings = sortByDay(unique.filter((e): e is PingSentEvent => e.type === 'PING_SENT'));
  const R = GAME_RULES;

  let points = 0;

  // 1) Odpočinkové chvíle se stropem za den + bonus za společnou chvíli
  const countedPerDay = new Map<LocalDay, number>();
  const jointPerDay = new Map<LocalDay, number>();
  /** Chvíle do týdenního rytmu: jen ty v rámci denního stropu, jinak by šel rytmus „nafarmit“ za jeden den. */
  const countedPerWeek = new Map<LocalDay, number>();
  /** Všechny chvíle týdne (pro zobrazení člověku, včetně těch nad strop). */
  const momentsPerWeek = new Map<LocalDay, number>();
  for (const m of moments) {
    const week = weekStart(m.localDay);
    momentsPerWeek.set(week, (momentsPerWeek.get(week) ?? 0) + 1);
    const counted = countedPerDay.get(m.localDay) ?? 0;
    if (counted < R.moment.maxCountedPerDay) {
      points += R.moment.points;
      countedPerDay.set(m.localDay, counted + 1);
      countedPerWeek.set(week, (countedPerWeek.get(week) ?? 0) + 1);
    }
    const joint = jointPerDay.get(m.localDay) ?? 0;
    if (m.joint && joint < R.jointBonus.maxPerDay) {
      points += R.jointBonus.points;
      jointPerDay.set(m.localDay, joint + 1);
    }
  }

  // 2) Povzbuzení se stropem za týden
  const pingsPerWeek = new Map<LocalDay, number>();
  for (const p of pings) {
    const week = weekStart(p.localDay);
    const n = pingsPerWeek.get(week) ?? 0;
    if (n < R.pingSent.maxCountedPerWeek) {
      points += R.pingSent.points;
      pingsPerWeek.set(week, n + 1);
    }
  }

  // 3) Týdenní rytmus: počítá se každý týden zvlášť, vynechaný týden nic neruší
  let rhythmWeeksTotal = 0;
  for (const n of countedPerWeek.values()) {
    if (n >= R.weeklyRhythm.momentsNeeded) rhythmWeeksTotal++;
  }
  points += rhythmWeeksTotal * R.weeklyRhythm.points;

  // 4) Návrat po pauze je ocenění, ne ostuda
  const comebacks = comebackDays(moments);
  points += comebacks.length * R.comeback.points;

  const level = levelForPoints(points);
  const lastMomentDay = moments.length ? moments[moments.length - 1].localDay : undefined;

  return {
    points,
    level,
    nextLevelAt: pointsForLevel(level + 1),
    momentsThisWeek: momentsPerWeek.get(weekStart(today)) ?? 0,
    rhythmWeeksTotal,
    dailyCapReached: (countedPerDay.get(today) ?? 0) >= R.moment.maxCountedPerDay,
    welcomeBack: lastMomentDay !== undefined && comebacks.includes(lastMomentDay),
  };
}
