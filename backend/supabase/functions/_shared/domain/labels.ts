// České texty pro kategorie a výstupy. Texty jsou součást mechaniky: mluví o tom,
// co se podařilo, nikdy o tom, co chybí („zbývá“, „nesplněno“, „limit“ tu nenajdeš).

import type { ActivityCategory, Visibility } from './enums.ts';

export const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  PROCHAZKA: 'Procházka',
  CTENI: 'Čtení',
  PAUZA: 'Pauza',
  SPANEK: 'Spánek navíc',
  BEZ_TELEFONU: 'Večer bez telefonu',
  POHYB: 'Pohyb',
  TVORENI: 'Tvoření',
  JINE: 'Chvíle pro sebe',
};

/** 2. pád množného čísla pro „Spolu 7 z 10 …“ (předložka „z“ vždy s 2. pádem). */
export const CATEGORY_GENITIVE_PLURAL: Record<ActivityCategory, string> = {
  PROCHAZKA: 'procházek',
  CTENI: 'chvil se čtením',
  PAUZA: 'pauz',
  SPANEK: 'chvil spánku navíc',
  BEZ_TELEFONU: 'večerů bez telefonu',
  POHYB: 'chvil pohybu',
  TVORENI: 'chvil tvoření',
  JINE: 'chvil pro sebe',
};

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  JEN_JA: 'Jen já',
  PRATELE: 'Přátelé',
  CHILL_CREW: 'Skupina',
};

export const GAME_TEXT = {
  dailyCap: 'Na dnešek máš hotovo. Užij si zbytek dne.',
  welcomeBack: 'Vítej zpátky. Tvoje zahrada na tebe počkala.',
  momentSaved: 'Chvilka pro tebe je zapsaná.',
  support: 'Je nám líto, že je to teď těžké. Pomoc je na dosah.',
} as const;
