import type { JuiceRecipeRegistry } from '../juice-recipe';
import { diceRollStub, cardFlipStub, hitImpactStub, screenShakeStub } from './stub-recipes';

/** H2.4 spec §5 — registro id→implementación stub. H2.5 sustituye este archivo para exportar
 *  un `RECIPE_REGISTRY` real con los mismos 4 ids; `JUICE_CONFIG`/`EffectsDirector` no cambian. */
export const STUB_RECIPE_REGISTRY: JuiceRecipeRegistry = {
  diceRoll: diceRollStub,
  cardFlip: cardFlipStub,
  hitImpact: hitImpactStub,
  screenShake: screenShakeStub,
};
