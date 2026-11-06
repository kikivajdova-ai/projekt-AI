// České texty pro kategorie a výstupy. Texty jsou součást mechaniky: mluví o tom,
// co se podařilo, nikdy o tom, co chybí („zbývá“, „nesplněno“, „limit“ tu nenajdeš).

import type { ActivityCategory, Visibility } from './enums.ts';

export const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  PROCHAZKA: 'Procházka venku',
  CTENI: 'Čtení pro radost',
  PAUZA: 'Pauza na deset minut',
  SPANEK: 'Spánek navíc',
  BEZ_TELEFONU: 'Večer bez telefonu',
  POHYB: 'Protažení',
  TVORENI: 'Něco vytvořit',
  JINE: 'Chvilka pro sebe',
};

/** 2. pád množného čísla pro „Spolu 7 z 10 …“ (předložka „z“ vždy s 2. pádem). */
export const CATEGORY_GENITIVE_PLURAL: Record<ActivityCategory, string> = {
  PROCHAZKA: 'procházek',
  CTENI: 'chvilek se čtením',
  PAUZA: 'pauz',
  SPANEK: 'nocí se spánkem navíc',
  BEZ_TELEFONU: 'večerů bez telefonu',
  POHYB: 'protažení',
  TVORENI: 'chvilek tvoření',
  JINE: 'chvilek pro sebe',
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
  support: 'Je nám líto, že je to teď těžké. Když budeš chtít, ozvi se někomu blízkému.',
} as const;
