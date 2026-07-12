import type { JuiceRecipe } from '../juice-recipe';
import { COMBAT_SCENE_VIEWPORT } from '../../view/board-layout';
import { FOCUS_TARGET_ELEVATED_DEPTH } from '../focus-shared';

export interface FocusWhiteLensParams {
  /** Por defecto 100. */
  readonly durationMs?: number;
}

const WHITE = 0xffffff;
const START_ALPHA = 0.8;
const DEFAULT_DURATION_MS = 100;
/** Por encima de `FOCUS_TARGET_ELEVATED_DEPTH` (600) — se ve incluso durante un momento grande ya
 *  enfocado. */
const FOCUS_WHITE_LENS_DEPTH = FOCUS_TARGET_ELEVATED_DEPTH + 100;

/** H5.4 §4.4 — flash blanco de pantalla completa. Efecto puntual de "impacto", NO forma parte de la
 *  sesión de `FocusController` (no incrementa/decrementa su contador de referencias) — un flourish de
 *  un solo disparo, reutilizable en cualquier evento (grande o no) que quiera un golpe visual extra,
 *  análogo en espíritu al flash de tinte de `hitImpact` pero a pantalla completa. Singleton simple sin
 *  dependencia de `FocusController` (a diferencia de `focusZoom`/`focusBlur`/`unfocusReset`). */
export const focusWhiteLens: JuiceRecipe<FocusWhiteLensParams> = {
  id: 'focusWhiteLens',
  play(scene, _target, params) {
    const durationMs = params.durationMs ?? DEFAULT_DURATION_MS;
    const flash = scene.add.rectangle(
      COMBAT_SCENE_VIEWPORT.width / 2,
      COMBAT_SCENE_VIEWPORT.height / 2,
      COMBAT_SCENE_VIEWPORT.width,
      COMBAT_SCENE_VIEWPORT.height,
      WHITE,
    );
    flash.setAlpha(START_ALPHA);
    flash.setDepth(FOCUS_WHITE_LENS_DEPTH);

    return new Promise<void>((resolve) => {
      scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: durationMs,
        ease: 'Sine.easeIn',
        onComplete: () => {
          flash.destroy();
          resolve();
        },
      });
    });
  },
};
