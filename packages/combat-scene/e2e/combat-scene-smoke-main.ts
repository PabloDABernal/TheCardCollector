import Phaser from 'phaser';
import type { CombatBridge } from '@collector/combat-bridge';
import { CombatScene, COMBAT_SCENE_VIEWPORT } from '../src/scenes/CombatScene';
import { buildDefaultCombatBridge } from '../src/build-default-combat-bridge';

declare global {
  interface Window {
    __combatBridge?: CombatBridge;
  }
}

/**
 * H2.6 spec §5.3 — bootstrap standalone de `combat-scene-smoke.html`, deliberadamente separado de
 * `src/main.ts` (mismo criterio que `juice-smoke-main.ts`, H2.5): reusa la `CombatScene`/
 * `buildDefaultCombatBridge` reales de producción (a diferencia de `juice-smoke-scene.ts`, que usaba una
 * escena mínima ad-hoc), pero expone temporalmente `window.__combatBridge` — SOLO en este harness de
 * verificación visual manual, nunca en `src/main.ts` — para que `combat-scene-smoke.spec.ts` pueda
 * disparar comandos reales contra el `CombatBridge` (drenar el pool de Núcleos hasta forzar un reroll)
 * sin necesitar un `InputAdapter` real (H2.7, todavía no existe).
 */
const game = new Phaser.Game({
  // CANVAS (no WebGL/AUTO) — lectura de píxeles fiable en el sandbox de verificación visual (evita
  // "GPU stall due to ReadPixels" con el Chromium headless preinstalado del entorno, mismo criterio que
  // `juice-smoke-main.ts`, H2.5).
  type: Phaser.CANVAS,
  width: COMBAT_SCENE_VIEWPORT.width,
  height: COMBAT_SCENE_VIEWPORT.height,
  parent: 'app',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: COMBAT_SCENE_VIEWPORT.width,
    height: COMBAT_SCENE_VIEWPORT.height,
  },
  scene: [],
});

game.scene.add('CombatScene', CombatScene);

void buildDefaultCombatBridge().then((bridge) => {
  window.__combatBridge = bridge;
  game.scene.start('CombatScene', { bridge });
});
