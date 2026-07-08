import type { JuiceRecipe } from '../juice-recipe';

/** H2.13 spec §1.5 — receta sin efecto visual, existe únicamente para llevar un `soundId` en
 *  eventos que ya no tienen ninguna receta visual mapeada (p.ej. `NUCLEO_POOL_ROLLED`, retirado de
 *  `JUICE_CONFIG` en H2.12). El propio sonido lo dispara `EffectsDirector` vía `step.soundId`, no
 *  esta receta — `play()` es un no-op puro que resuelve de inmediato. */
export const soundOnly: JuiceRecipe = {
  id: 'soundOnly',
  play(): Promise<void> {
    return Promise.resolve();
  },
};
