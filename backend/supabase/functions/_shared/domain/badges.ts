// Odznaky za péči. Udělují se za konkrétní události (návrat po pauze, podpora kamaráda,
// den bez telefonu…), nikdy za čas v aplikaci, počet otevření, počty úkolů ani počet přátel.

import type { BadgeCode } from './enums.ts';
import { GAME_RULES } from './config.ts';
import { comebackDays, type GameEvent, type MomentEvent } from './game.ts';

export interface BadgeDefinition {
  code: BadgeCode;
  name: string;
  description: string;
  /** Text po získání, laskavý a bez tlaku. */
  awardText: string;
}

export const BADGE_CATALOG: readonly BadgeDefinition[] = [
  {
    code: 'PRVNI_CHVILKA',
    name: 'První chvilka',
    description: 'Za první odpočinkovou chvíli.',
    awardText: 'Tvoje první chvilka. Tady začíná tvoje zahrada.',
  },
  {
    code: 'NAVRAT',
    name: 'Návrat',
    description: 'Za návrat po pauze. Pauza není prohra.',
    awardText: 'Nový odznak: Návrat. Je dobré tě vidět.',
  },
  {
    code: 'DOBRY_KAMARAD',
    name: 'Dobrý kamarád',
    description: 'Za první povzbuzení kamaráda.',
    awardText: 'Nový odznak: Dobrý kamarád. Někomu jsi udělal(a) radost.',
  },
  {
    code: 'BEZ_TELEFONU',
    name: 'Bez obrazovky',
    description: 'Za den nebo večer bez telefonu.',
    awardText: 'Nový odznak: Bez obrazovky. Krásný čas jen pro tebe.',
  },
  {
    code: 'SPOLU',
    name: 'Spolu',
    description: 'Za první společnou chvíli s kamarádem.',
    awardText: 'Nový odznak: Spolu. Odpočívat spolu je víc.',
  },
  {
    code: 'PESTROST',
    name: 'Pestrost',
    description: 'Za vyzkoušení pěti různých druhů odpočinku.',
    awardText: 'Nový odznak: Pestrost. Odpočinek má mnoho podob.',
  },
] as const;

/** Které odznaky si člověk svými událostmi zasloužil. Server je pak jen doplní (bez duplicit). */
export function earnedBadges(events: GameEvent[]): Set<BadgeCode> {
  const moments = events.filter((e): e is MomentEvent => e.type === 'MOMENT');
  const earned = new Set<BadgeCode>();

  if (moments.length > 0) earned.add('PRVNI_CHVILKA');
  if (comebackDays(moments).length > 0) earned.add('NAVRAT');
  if (events.some((e) => e.type === 'PING_SENT')) earned.add('DOBRY_KAMARAD');
  if (moments.some((m) => m.category === 'BEZ_TELEFONU')) earned.add('BEZ_TELEFONU');
  if (moments.some((m) => m.joint)) earned.add('SPOLU');
  if (new Set(moments.map((m) => m.category)).size >= GAME_RULES.varietyBadgeCategories) {
    earned.add('PESTROST');
  }
  return earned;
}
