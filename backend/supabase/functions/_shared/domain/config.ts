// Herní pravidla a limity na JEDNOM místě (požadavek skillu app-coding / herni-mechaniky).
// Hodnoty pocházejí z návrhu ve skillu `herni-mechaniky` (smycka-a-ekonomika.md).
// Po každé změně bodů nebo stropů spusť simulaci ekonomiky z toho skillu.

export const GAME_RULES = {
  /** Verze pravidel. Při změně hodnot zvyš a zapiš do PROJEKT.md (viz známá slabá místa). */
  version: 1,

  /** Den končí ve 4:00 místního času, aby se večerní odpočinek po půlnoci počítal ke správnému dni. */
  dayStartHour: 4,

  moment: { points: 10, maxCountedPerDay: 2 },
  /** Společná chvíle (přijatá pozvánka k odpočinku): bonus navíc, 1× denně. */
  jointBonus: { points: 5, maxPerDay: 1 },
  /** Odeslané povzbuzení: body jen do malého týdenního stropu, ať se péče nezmění v klikání. */
  pingSent: { points: 2, maxCountedPerWeek: 5 },
  /** Týden do rytmu: týden, ve kterém měl člověk aspoň `momentsNeeded` chvil. */
  weeklyRhythm: { points: 15, momentsNeeded: 3 },
  /** Návrat po pauze: chvíle po aspoň 14 dnech bez záznamu. Max 1× za 30 dní. */
  comeback: { points: 20, minGapDays: 14, cooldownDays: 30 },

  /** Křivka úrovní: T(n) = round(base × (n − 1) ^ exponent). Úroveň nikdy neklesá. */
  levels: { base: 50, exponent: 1.4 },

  /** Pestrost: kolik různých druhů odpočinku dá odznak. */
  varietyBadgeCategories: 5,
} as const;

/** Nejnižší hodnota škály nálady. Výběr této hodnoty vypne herní prvky a nabídne pomoc. */
export const MOOD_MIN = 1;
export const MOOD_MAX = 5;

export const LIMITS = {
  friendInviteTtlHours: 72,
  maxActiveFriendInvites: 10,
  pingsPerDayTotal: 20,
  pingsPerDayToSameFriend: 3,
  /** Pozvánka k odpočinku: 1 denně stejnému kamarádovi vynucuje i unikátní index v databázi. */
  restInvitesPerDayTotal: 5,
  restInviteTtlHours: 12,
  reportsPerDay: 20,
  groupMaxMembers: 8,
  sharePreviewTtlSeconds: 600,
  /** Jak staré chvíle jde zapsat zpětně (proti „farmení“ bodů a odznaku Návrat). */
  maxBackdateHours: 48,
  /** Kolik vlastních chvilek si jde vytvořit (přehlednost domovské obrazovky). */
  maxCustomActivities: 12,
} as const;

export const NOTIFICATION_DEFAULTS = {
  quietHoursEnabled: true,
  quietStart: '22:00',
  quietEnd: '08:00',
  timezone: 'Europe/Prague',
} as const;
