// Práce s místním časem uživatele. Bez knihoven: Intl API je v Deno (Edge Functions) i v Node.
// „Místní den“ je řetězec YYYY-MM-DD; den končí ve 4:00 (GAME_RULES.dayStartHour).

import { GAME_RULES } from './config.ts';

export type LocalDay = string; // 'YYYY-MM-DD'

interface WallClock {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/** Ověří, že jde o platné jméno časového pásma (např. 'Europe/Prague'). */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function wallClock(instant: Date, timeZone: string): WallClock {
  const parts = formatter(timeZone).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dayFromUtcDate(d: Date): LocalDay {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function parseDay(day: LocalDay): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(day: LocalDay, days: number): LocalDay {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + days);
  return dayFromUtcDate(d);
}

export function daysBetween(from: LocalDay, to: LocalDay): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
}

/** Místní „herní“ den: před 4:00 ráno se počítá ještě předchozí den. */
export function localDay(
  instant: Date,
  timeZone: string,
  dayStartHour: number = GAME_RULES.dayStartHour,
): LocalDay {
  const c = wallClock(instant, timeZone);
  const day = `${c.year}-${pad(c.month)}-${pad(c.day)}`;
  return c.hour < dayStartHour ? addDays(day, -1) : day;
}

/** Pondělí týdne, do kterého místní den patří (týden začíná v pondělí). */
export function weekStart(day: LocalDay): LocalDay {
  const dow = parseDay(day).getUTCDay(); // 0 = neděle
  const sinceMonday = (dow + 6) % 7;
  return addDays(day, -sinceMonday);
}

function parseHHMM(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error(`Neplatný čas: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export interface QuietHours {
  enabled: boolean;
  start: string; // 'HH:MM'
  end: string; // 'HH:MM'
  timeZone: string;
}

/** Je teď noční klid? Zvládá i interval přes půlnoc (22:00–08:00). */
export function isInQuietHours(now: Date, q: QuietHours): boolean {
  if (!q.enabled) return false;
  const start = parseHHMM(q.start);
  const end = parseHHMM(q.end);
  if (start === end) return false;
  const c = wallClock(now, q.timeZone);
  const minutes = c.hour * 60 + c.minute;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/** Posun časového pásma (v minutách) v daném okamžiku, např. +60 pro Prahu v zimě. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const c = wallClock(instant, timeZone);
  const asUtc = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute);
  return Math.round((asUtc - Math.floor(instant.getTime() / 60_000) * 60_000) / 60_000);
}

/** Převede místní čas (den + HH:MM) v daném pásmu na skutečný okamžik. */
export function zonedToInstant(day: LocalDay, hhmm: string, timeZone: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const minutes = parseHHMM(hhmm);
  const naive = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  let guess = naive - offsetMinutes(new Date(naive), timeZone) * 60_000;
  // druhý průchod opraví případy kolem přechodu letního času
  guess = naive - offsetMinutes(new Date(guess), timeZone) * 60_000;
  return new Date(guess);
}

/**
 * Kdy smí odejít notifikace: hned, nebo až skončí noční klid.
 * Notifikace se v nočním klidu nezahazuje, jen počká do rána.
 */
export function nextAllowedSendTime(now: Date, q: QuietHours): Date {
  if (!isInQuietHours(now, q)) return now;
  const c = wallClock(now, q.timeZone);
  const today = `${c.year}-${pad(c.month)}-${pad(c.day)}`;
  const endToday = zonedToInstant(today, q.end, q.timeZone);
  return endToday.getTime() > now.getTime() ? endToday : zonedToInstant(addDays(today, 1), q.end, q.timeZone);
}
