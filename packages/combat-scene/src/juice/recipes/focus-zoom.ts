import type { JuiceRecipe } from '../juice-recipe';
import type { FocusController } from '../effects-director';
import { resolveFocusPosition, DEFAULT_FOCUS_ZOOM_LEVEL } from '../focus-shared';

export interface FocusZoomParams {
  /** Por defecto 1.25 (vision.md sugiere "hasta 1.3" — H5.4 usa un default más conservador). */
  readonly zoomLevel?: number;
  /** Por defecto 300. */
  readonly durationMs?: number;
}

const DEFAULT_DURATION_MS = 300;

/** H5.4 §4.1 — tween de `camera.zoom` a `zoomLevel`, con `camera.pan` simultáneo hacia la posición
 *  resuelta de `target.focusId` (o sin pan si no resuelve, zoom centrado en el punto de cámara
 *  actual). Implementado con `scene.cameras.main.zoomTo(...)`/`.pan(...)` (tween nativo de Phaser
 *  Camera, evita reinventar el tween manual).
 *
 *  `focusController` se recibe por consistencia de firma con el resto de recetas de foco (mismo
 *  patrón de inyección que `createRecipeRegistry`, spec §5) — esta receta standalone no necesita leer
 *  su estado interno (contador de referencias): resuelve la posición del `focusId` directamente
 *  contra la escena, mismo mecanismo de nombrado (`scene.children.getByName`) que `FocusController`
 *  usa internamente, sin duplicar esa lógica de más de una fuente de verdad. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ver comentario arriba (consistencia de firma)
export function createFocusZoomRecipe(_focusController: FocusController): JuiceRecipe<FocusZoomParams> {
  return {
    id: 'focusZoom',
    play(scene, target, params) {
      const zoomLevel = params.zoomLevel ?? DEFAULT_FOCUS_ZOOM_LEVEL;
      const durationMs = params.durationMs ?? DEFAULT_DURATION_MS;
      const position = resolveFocusPosition(scene, target.focusId);

      const zoomDone = new Promise<void>((resolve) => {
        scene.cameras.main.zoomTo(zoomLevel, durationMs, undefined, false, () => resolve());
      });
      if (!position) {
        return zoomDone;
      }
      const panDone = new Promise<void>((resolve) => {
        scene.cameras.main.pan(position.x, position.y, durationMs, undefined, false, () => resolve());
      });
      return Promise.all([zoomDone, panDone]).then(() => undefined);
    },
  };
}
