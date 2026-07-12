export type { JuiceTarget, JuiceStep, JuiceStepMode, JuiceRecipe, JuiceRecipeRegistry } from './juice-recipe';
export type { JuiceConfig } from './juice-config';
export { JUICE_CONFIG } from './juice-config';
export type { EffectsDirector, FocusController } from './effects-director';
export { createEffectsDirector, FOCUS_ID_LEADER, FOCUS_ID_ENEMY, FOCUS_ID_SCENARIO, MIN_BIG_MOMENT_HOLD_MS } from './effects-director';
export { createRecipeRegistry } from './recipes';
// NUEVO H5.3 §1 — clasificación dinámica de "momento grande" por cruce de umbral (Trama/vida).
export type { BigMomentClassifier } from './big-moment-classifier';
export { createBigMomentClassifier, LIFE_RATIO_THRESHOLDS } from './big-moment-classifier';
// NUEVO H5.4 §1 — sesión de foco reentrante-segura.
export { createFocusController } from './focus-controller';
// H2.8 spec §3.7/§6 — re-exportados desde el barrel para que `view/*` no navegue la estructura
// interna de `juice/recipes/` (Programmer eligió esta forma en vez de imports relativos por path).
export {
  resolveOrCreatePlaceholder,
  resolveOrCreateCardPlaceholder,
  PLACEHOLDER_POSITIONS,
  CARD_HAND_POSITION,
  DEFAULT_PLACEHOLDER_POSITION,
} from './recipes/placeholder';
