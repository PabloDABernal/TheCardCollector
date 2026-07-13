import type Phaser from 'phaser';
import { COMBAT_SCENE_VIEWPORT } from '../view/board-layout';

/** H5.4 §2.1/§4 — nombre estable del overlay de oscurecimiento (`scene.children.getByName`),
 *  compartido entre `FocusController` (`focus-controller.ts`) y las recetas standalone
 *  (`focus-blur.ts`/`unfocus-reset.ts`) para que ambos caminos operen sobre el MISMO game object en
 *  vez de crear dos overlays independientes ("no doble fuente de verdad" — spec §4). */
export const FOCUS_OVERLAY_NAME = 'focus-overlay';

export const FOCUS_OVERLAY_COLOR = 0x0a0a0c; // ≈ --ink
export const FOCUS_OVERLAY_ALPHA = 0.7; // deja ~30% de opacidad visible al resto del tablero
export const FOCUS_OVERLAY_DEPTH = 500; // por debajo de turnBanner (BANNER_DEPTH=1000, H4), por
                                         // encima del tablero normal (paneles/roles/dados, todos <100)
export const FOCUS_TARGET_ELEVATED_DEPTH = 600; // el objeto en foco sube por encima del overlay
export const FADE_IN_MS = 300; // vision.md "fade overlay oscuro sobre tablero (duration ~300ms)"
export const FADE_OUT_MS = 200; // backlog H5.4 "unfocusReset ~200ms"
export const DEFAULT_FOCUS_ZOOM_LEVEL = 1.25; // vision.md sugiere "hasta 1.3" — 1.25 más conservador

/** Crea (si no existe) o reutiliza el `Rectangle` de oscurecimiento a pantalla completa, `alpha`
 *  inicial 0, fijo respecto a cámara (`setScrollFactor(0)` — importante porque `focusZoom` mueve la
 *  cámara, el overlay no debe desplazarse con ella). */
export function resolveOrCreateFocusOverlay(scene: Phaser.Scene): Phaser.GameObjects.Rectangle {
  const existing = scene.children.getByName(FOCUS_OVERLAY_NAME) as Phaser.GameObjects.Rectangle | null;
  if (existing) return existing;

  const overlay = scene.add.rectangle(
    COMBAT_SCENE_VIEWPORT.width / 2,
    COMBAT_SCENE_VIEWPORT.height / 2,
    COMBAT_SCENE_VIEWPORT.width,
    COMBAT_SCENE_VIEWPORT.height,
    FOCUS_OVERLAY_COLOR,
  );
  overlay.setAlpha(0);
  overlay.setDepth(FOCUS_OVERLAY_DEPTH);
  overlay.setScrollFactor(0);
  overlay.setName(FOCUS_OVERLAY_NAME);
  return overlay;
}

/** H5.4 §2.2 — resuelve la posición de pantalla de un `focusId`, SIN crear un placeholder si no se
 *  encuentra (a diferencia de `resolveOrCreatePlaceholder`, `placeholder.ts`) — el foco no debe
 *  generar un rectángulo gris fantasma en el centro del viewport si `focusId` no resuelve a nada
 *  conocido; en ese caso, simplemente no se hace pan (zoom se aplica centrado en el viewport actual).
 *  Reutiliza `scene.children.getByName(focusId)`, el mismo mecanismo de nombrado ya usado por
 *  `role-view.ts` (Líder/Enemigo/Escenario), `board-anchors-view.ts` (Secuaz/Aliado por instanceId) y
 *  `nucleo-table-view.ts` (dado por `NucleoInstanceId`, H5.1 §4). */
export function resolveFocusPosition(scene: Phaser.Scene, focusId: string | undefined): { x: number; y: number } | null {
  if (focusId === undefined) return null;
  const obj = scene.children.getByName(focusId) as Phaser.GameObjects.Rectangle | null;
  return obj ? { x: obj.x, y: obj.y } : null;
}

/** Resuelve el game object nombrado por `focusId`, sin castear a `Rectangle` (usado para leer/ajustar
 *  `depth`, que cualquier `GameObject` expone). */
export function resolveFocusTarget(scene: Phaser.Scene, focusId: string | undefined): Phaser.GameObjects.GameObject | null {
  if (focusId === undefined) return null;
  return scene.children.getByName(focusId) as Phaser.GameObjects.GameObject | null;
}
