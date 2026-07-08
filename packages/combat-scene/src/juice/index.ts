export type { JuiceTarget, JuiceStep, JuiceStepMode, JuiceRecipe, JuiceRecipeRegistry } from './juice-recipe';
export type { JuiceConfig } from './juice-config';
export { JUICE_CONFIG } from './juice-config';
export type { EffectsDirector } from './effects-director';
export { createEffectsDirector, FOCUS_ID_LEADER, FOCUS_ID_ENEMY, FOCUS_ID_SCENARIO } from './effects-director';
export { createRecipeRegistry } from './recipes';
// H2.8 spec §3.7/§6 — re-exportados desde el barrel para que `view/*` no navegue la estructura
// interna de `juice/recipes/` (Programmer eligió esta forma en vez de imports relativos por path).
export {
  resolveOrCreatePlaceholder,
  resolveOrCreateCardPlaceholder,
  PLACEHOLDER_POSITIONS,
  CARD_HAND_POSITION,
  DEFAULT_PLACEHOLDER_POSITION,
} from './recipes/placeholder';
