import type { JuiceRecipe } from '../juice-recipe';
import type { FocusController } from '../effects-director';
import { COMBAT_SCENE_VIEWPORT } from '../../view/board-layout';
import { resolveOrCreateFocusOverlay, FADE_OUT_MS } from '../focus-shared';

export interface UnfocusResetParams {
  /** Por defecto 200 (`FADE_OUT_MS`). */
  readonly durationMs?: number;
}

/** H5.4 §4.3 — fade-out del overlay + `camera.zoomTo(1, durationMs)` + `camera.pan` de vuelta al
 *  centro neutro del viewport. Receta standalone de composición manual — la restauración del `depth`
 *  original del último objeto elevado es responsabilidad exclusiva de `FocusController.end()` (único
 *  que rastrea "cuál fue el último objeto elevado"), no de esta receta suelta. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- consistencia de firma con createRecipeRegistry (§5)
export function createUnfocusResetRecipe(_focusController: FocusController): JuiceRecipe<UnfocusResetParams> {
  return {
    id: 'unfocusReset',
    play(scene, _target, params) {
      const durationMs = params.durationMs ?? FADE_OUT_MS;
      const overlay = resolveOrCreateFocusOverlay(scene);

      const fadeDone = new Promise<void>((resolve) => {
        scene.tweens.add({
          targets: overlay,
          alpha: 0,
          duration: durationMs,
          ease: 'Sine.easeIn',
          onComplete: () => resolve(),
        });
      });
      const zoomDone = new Promise<void>((resolve) => {
        scene.cameras.main.zoomTo(1, durationMs, undefined, false, () => resolve());
      });
      const panDone = new Promise<void>((resolve) => {
        scene.cameras.main.pan(
          COMBAT_SCENE_VIEWPORT.width / 2,
          COMBAT_SCENE_VIEWPORT.height / 2,
          durationMs,
          undefined,
          false,
          () => resolve(),
        );
      });

      return Promise.all([fadeDone, zoomDone, panDone]).then(() => undefined);
    },
  };
}
