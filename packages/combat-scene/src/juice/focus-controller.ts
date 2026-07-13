import type Phaser from 'phaser';
import { COMBAT_SCENE_VIEWPORT } from '../view/board-layout';
import {
  FOCUS_OVERLAY_ALPHA,
  FOCUS_TARGET_ELEVATED_DEPTH,
  FADE_IN_MS,
  FADE_OUT_MS,
  DEFAULT_FOCUS_ZOOM_LEVEL,
  resolveOrCreateFocusOverlay,
  resolveFocusPosition,
  resolveFocusTarget,
} from './focus-shared';
import type { FocusController } from './effects-director';

interface DepthCapable {
  readonly depth: number;
  setDepth(depth: number): unknown;
}

function supportsDepth(obj: object): obj is DepthCapable {
  return typeof (obj as Partial<DepthCapable>).setDepth === 'function';
}

function fadeOverlay(scene: Phaser.Scene, overlay: Phaser.GameObjects.Rectangle, toAlpha: number, durationMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    scene.tweens.add({
      targets: overlay,
      alpha: toAlpha,
      duration: durationMs,
      ease: 'Sine.easeOut',
      onComplete: () => resolve(),
    });
  });
}

function zoomAndPan(
  scene: Phaser.Scene,
  zoomLevel: number,
  position: { x: number; y: number } | null,
  durationMs: number,
): Promise<void> {
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
}

/**
 * H5.4 §1 — sesión de foco reentrante-segura (singleton por escena). `begin`/`end` llevan un contador
 * de referencias: solo la transición 0→1 anima el fade-in del overlay (transiciones N→N+1 solo
 * re-apuntan la cámara al nuevo `focusId`), y solo la transición 1→0 dispara el fade-out real.
 *
 * H5.6 §3.5 — en sesiones reentrantes con más de 1 foco activo (ej. `ABILITY_ACTIVATED` seguido de
 * `ENEMY_DAMAGED`/`MINION_DAMAGED` solapados), CADA llamada a `begin()` eleva su propio `focusId` por
 * encima del overlay (`FOCUS_TARGET_ELEVATED_DEPTH` > `FOCUS_OVERLAY_DEPTH`), no solo la primera —
 * de lo contrario el flash/número de daño del segundo evento queda oculto bajo el overlay oscuro
 * hasta el fade-out final. Se mantiene un mapa de todos los objetos elevados durante la sesión
 * (`elevatedTargets: focusId -> {target, originalDepth}`), y la transición final a 0 (`end()`)
 * restaura el depth original de TODOS ellos, no solo del primero.
 *
 * Factory con clausura — mismo patrón que `createTurnBannerRecipe` (H4): una instancia por
 * `CombatScene`, reutilizada entre invocaciones. `createEffectsDirector` recibe la instancia ya
 * construida (H5.3 §2.2, 5º parámetro) — nunca se instancia más de una vez por escena.
 */
export function createFocusController(): FocusController {
  let refCount = 0;
  const elevatedTargets = new Map<string, { target: DepthCapable; originalDepth: number }>();

  function elevate(scene: Phaser.Scene, focusId: string | undefined): void {
    if (focusId === undefined || elevatedTargets.has(focusId)) return;
    const target = resolveFocusTarget(scene, focusId);
    if (target && supportsDepth(target)) {
      elevatedTargets.set(focusId, { target, originalDepth: target.depth });
      target.setDepth(FOCUS_TARGET_ELEVATED_DEPTH);
    }
  }

  function restoreAllElevated(): void {
    for (const { target, originalDepth } of elevatedTargets.values()) {
      target.setDepth(originalDepth);
    }
    elevatedTargets.clear();
  }

  return {
    async begin(scene: Phaser.Scene, focusId: string | undefined): Promise<void> {
      refCount += 1;
      const position = resolveFocusPosition(scene, focusId);

      if (refCount > 1) {
        // Transición N→N+1 — repanea la cámara y eleva el nuevo focusId, sin reiniciar el fade-in
        // del overlay (que ya está visible desde la transición 0→1).
        elevate(scene, focusId);
        await zoomAndPan(scene, DEFAULT_FOCUS_ZOOM_LEVEL, position, FADE_IN_MS);
        return;
      }

      // Transición 0→1 — primer momento grande en curso.
      const overlay = resolveOrCreateFocusOverlay(scene);
      elevate(scene, focusId);

      await Promise.all([
        fadeOverlay(scene, overlay, FOCUS_OVERLAY_ALPHA, FADE_IN_MS),
        zoomAndPan(scene, DEFAULT_FOCUS_ZOOM_LEVEL, position, FADE_IN_MS),
      ]);
    },

    async end(scene: Phaser.Scene): Promise<void> {
      refCount = Math.max(0, refCount - 1);
      if (refCount > 0) {
        return; // otro momento grande sigue reclamando el foco
      }

      const overlay = resolveOrCreateFocusOverlay(scene);
      const center = { x: COMBAT_SCENE_VIEWPORT.width / 2, y: COMBAT_SCENE_VIEWPORT.height / 2 };
      await Promise.all([fadeOverlay(scene, overlay, 0, FADE_OUT_MS), zoomAndPan(scene, 1, center, FADE_OUT_MS)]);
      restoreAllElevated();
    },
  };
}
