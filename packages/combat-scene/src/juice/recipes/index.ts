import type { JuiceRecipeRegistry } from '../juice-recipe';
import { diceRoll } from './dice-roll';
import { cardFlip } from './card-flip';
import { hitImpact } from './hit-impact';
import { screenShake } from './screen-shake';

/** H2.5 spec §4 — registro id→implementación real (sustituye `STUB_RECIPE_REGISTRY` de H2.4).
 *  `JUICE_CONFIG`/`EffectsDirector` no cambian: mismos 4 ids. */
export const RECIPE_REGISTRY: JuiceRecipeRegistry = {
  diceRoll,
  cardFlip,
  hitImpact,
  screenShake,
};
