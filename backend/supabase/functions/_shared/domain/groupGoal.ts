// Skupinový cíl: ven jde POUZE agregovaný součet skupiny („Spolu 7 z 10“).
// Žádné příspěvky po lidech, žádné pořadí, žádné „X zatím nepřispěl“.

import type { ActivityCategory } from './enums.ts';
import { CATEGORY_GENITIVE_PLURAL } from './labels.ts';

export interface GroupGoalProgress {
  goalId: string;
  category: ActivityCategory;
  together: number;
  target: number;
  reached: boolean;
  text: string;
}

export function presentGroupGoal(input: {
  goalId: string;
  category: ActivityCategory;
  together: number;
  target: number;
}): GroupGoalProgress {
  const together = Math.max(0, Math.floor(input.together));
  const reached = together >= input.target;
  const noun = CATEGORY_GENITIVE_PLURAL[input.category];
  const text = reached
    ? `Spolu jste to dali! ${together} z ${input.target} ${noun}.`
    : `Spolu ${together} z ${input.target} ${noun}`;
  // Vědomě vracíme jen tato pole. Funkce nemá vstup s údaji o jednotlivcích,
  // takže z ní žebříček nejde ani omylem poskládat.
  return { goalId: input.goalId, category: input.category, together, target: input.target, reached, text };
}
