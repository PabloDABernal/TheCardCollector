import type { JuiceRecipe } from '../juice-recipe';

/** H2.4 spec §5 — receta stub que cumple `JuiceRecipe` pero no toca Phaser de verdad (sin
 *  tweens, sin partículas, sin `Camera.shake()`). Solo registra la llamada y retorna una
 *  `Promise` ya resuelta, para demostrar end-to-end que el mapeo evento→receta funciona.
 *  H2.5 sustituye este archivo entero, manteniendo los mismos 4 ids exportados por
 *  `recipes/index.ts`. */
function createStubRecipe(id: string): JuiceRecipe {
  return {
    id,
    play(_scene, target, params) {
      // Deliberado: sin tweens/partículas/shake real — demuestra el mapeo evento→receta
      // end-to-end (criterio de aceptación de H2.4).
      console.debug(`[juice:stub] ${id}`, { eventType: target.event.type, focusId: target.focusId, params });
      return Promise.resolve();
    },
  };
}

export const diceRollStub = createStubRecipe('diceRoll');
export const cardFlipStub = createStubRecipe('cardFlip');
export const hitImpactStub = createStubRecipe('hitImpact');
export const screenShakeStub = createStubRecipe('screenShake');
