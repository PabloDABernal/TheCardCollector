import type Phaser from 'phaser';
import { resolveOrCreatePlaceholder } from './placeholder';
import type { JuiceRecipe } from '../juice-recipe';

const PUNCH_LEG_1_MS = 40;
const PUNCH_LEG_2_MS = 60;
const PUNCH_LEG_3_MS = 60;
const FLASH_COLOR = 0xffffff;
const FLASH_REVERT_DELAY_MS = 80;
const DEFAULT_HITSTOP_DURATION_MS = 60;
const DEFAULT_PLACEHOLDER_FILL_COLOR = 0x808080;

export interface HitImpactParams {
  /** Si `false`, omite el hitStop. Por defecto `true` (spec §3.3). */
  readonly hitStop?: boolean;
  /** Duración del hitStop en ms. Por defecto 60. */
  readonly hitStopDurationMs?: number;
}

interface TintCapableGameObject {
  setTintFill(color: number): unknown;
  clearTint(): unknown;
}

function supportsTintFill(gameObject: object): gameObject is TintCapableGameObject {
  return (
    typeof (gameObject as Partial<TintCapableGameObject>).setTintFill === 'function' &&
    typeof (gameObject as Partial<TintCapableGameObject>).clearTint === 'function'
  );
}

/** H2.5 spec §3.3 — flash de tinte en paralelo al punch: preferir `setTintFill`/`clearTint` si el
 *  game object los expone (H2.8 con `Sprite` real); si no (placeholder `Rectangle` de H2.5), simular
 *  el flash alternando `fillColor` a blanco y de vuelta. */
function flashTint(scene: Phaser.Scene, gameObject: Phaser.GameObjects.Rectangle): void {
  if (supportsTintFill(gameObject)) {
    gameObject.setTintFill(FLASH_COLOR);
    scene.time.delayedCall(FLASH_REVERT_DELAY_MS, () => {
      gameObject.clearTint();
    });
    return;
  }

  const originalFillColor = gameObject.fillColor ?? DEFAULT_PLACEHOLDER_FILL_COLOR;
  gameObject.setFillStyle(FLASH_COLOR);
  scene.time.delayedCall(FLASH_REVERT_DELAY_MS, () => {
    gameObject.setFillStyle(originalFillColor);
  });
}

/** H2.5 spec §3.3 punto 4 — hitStop embebido: pausa `scene.tweens.timeScale` (no `scene.time`,
 *  para que el propio temporizador de reanudación no se autocongele) durante `durationMs`,
 *  reanudado vía `setTimeout` de JavaScript plano. Se ejecuta ANTES de lanzar el punch. */
function applyHitStop(scene: Phaser.Scene, durationMs: number): void {
  scene.tweens.timeScale = 0;
  setTimeout(() => {
    scene.tweens.timeScale = 1;
  }, durationMs);
}

/** H2.5 spec §3.3 — punch de escala (`1→1.1→0.95→1`, ~160ms < 200ms) + flash de tinte, con
 *  `hitStop` opcional embebido. Dispara con `LEADER_DAMAGED`, `ENEMY_DAMAGED`,
 *  `SCENARIO_PLOT_CHANGED`, `ALLY_DAMAGED`. */
export const hitImpact: JuiceRecipe<HitImpactParams> = {
  id: 'hitImpact',
  play(scene, target, params) {
    const gameObject = resolveOrCreatePlaceholder(scene, target.focusId);

    if (params.hitStop !== false) {
      applyHitStop(scene, params.hitStopDurationMs ?? DEFAULT_HITSTOP_DURATION_MS);
    }

    flashTint(scene, gameObject);

    return new Promise<void>((resolve) => {
      scene.tweens.chain({
        targets: gameObject,
        tweens: [
          { scale: 1.1, duration: PUNCH_LEG_1_MS, ease: 'Sine.easeOut' },
          { scale: 0.95, duration: PUNCH_LEG_2_MS, ease: 'Sine.easeInOut' },
          { scale: 1, duration: PUNCH_LEG_3_MS, ease: 'Sine.easeIn' },
        ],
        onComplete: () => resolve(),
      });
    });
  },
};
