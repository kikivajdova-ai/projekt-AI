// Co přesně uvidí ostatní. Používá se pro náhled před sdílením i pro výstup do feedu přátel,
// takže náhled a skutečnost se nemůžou rozejít.

import type { ActivityCategory, Visibility } from './enums.ts';
import { CATEGORY_LABEL } from './labels.ts';
import type { LocalDay } from './time.ts';

/** Jediná pole, která o chvíli smí vidět přátelé. Nic víc (žádná nálada, poznámky, čas plánu). */
export interface SharedMomentView {
  id: string;
  authorName: string;
  category: ActivityCategory;
  label: string;
  day: LocalDay;
  visibility: Exclude<Visibility, 'JEN_JA'>;
  crewId: string | null;
}

export function toSharedMomentView(row: {
  id: string;
  authorName: string;
  category: ActivityCategory;
  localDay: LocalDay;
  visibility: Visibility;
  crewId: string | null;
}): SharedMomentView {
  if (row.visibility === 'JEN_JA') throw new Error('Soukromá chvíle nesmí do sdíleného výstupu');
  return {
    id: row.id,
    authorName: row.authorName,
    category: row.category,
    label: CATEGORY_LABEL[row.category],
    day: row.localDay,
    visibility: row.visibility,
    crewId: row.crewId,
  };
}

export function describeAudience(visibility: Visibility, crewName?: string): string {
  switch (visibility) {
    case 'JEN_JA':
      return 'Uvidíš jen ty.';
    case 'PRATELE':
      return 'Uvidí tvoji přátelé.';
    case 'CHILL_CREW':
      return `Uvidí členové skupiny ${crewName ?? ''}`.trim() + '.';
  }
}
