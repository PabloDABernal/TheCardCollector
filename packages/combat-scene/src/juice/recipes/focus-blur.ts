import type { JuiceRecipe } from '../juice-recipe';
import type { FocusController } from '../effects-director';
import { resolveOrCreateFocusOverlay, FOCUS_OVERLAY_ALPHA, FADE_IN_MS } from '../focus-shared';

export interface FocusBlurParams {
  /** Por defecto 300 (`FADE_IN_MS`). */
  readonly durationMs?: number;
}

/** H5.4 §4.2 — crea/reutiliza el overlay de oscurecimiento (mismo game object nombrado que
 *  `FocusController` resuelve internamente, `focus-shared.ts`) y anima su fade-in. Uso independiente
 *  del `FocusController.begin()` automático: llamar a esta receta manualmente mientras
 *  `EffectsDirector` YA tiene una sesión de foco activa es un no-op visual (el overlay ya está a
 *  alpha completo), comportamiento esperado, no un bug. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- consistencia de firma con createRecipeRegistry (§5)
export function createFocusBlurRecipe(_focusController: FocusController): JuiceRecipe<FocusBlurParams> {
  return {
    id: 'focusBlur',
    play(scene, _target, params) {
      const durationMs = params.durationMs ?? FADE_IN_MS;
      const overlay = resolveOrCreateFocusOverlay(scene);

      return new Promise<void>((resolve) => {
        scene.tweens.add({
          targets: overlay,
          alpha: FOCUS_OVERLAY_ALPHA,
          duration: durationMs,
          ease: 'Sine.easeOut',
          onComplete: () => resolve(),
        });
      });
    },
  };
}
