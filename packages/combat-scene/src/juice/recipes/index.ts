import type { JuiceRecipeRegistry } from '../juice-recipe';
import { diceRoll } from './dice-roll';
import { cardFlip } from './card-flip';
import { hitImpact } from './hit-impact';
import { screenShake } from './screen-shake';
import { cooldownReady } from './cooldown-ready';

/** H2.5 spec §4 — registro id→implementación real (sustituye `STUB_RECIPE_REGISTRY` de H2.4).
 *  H2.10 añade `cooldownReady` (5º id). */
export const RECIPE_REGISTRY: JuiceRecipeRegistry = {
  diceRoll,
  cardFlip,
  hitImpact,
  screenShake,
  cooldownReady,
};
