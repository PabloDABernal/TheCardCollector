import Phaser from 'phaser';
import { JuiceSmokeScene } from './juice-smoke-scene';

/** Bootstrap standalone de `juice-smoke.html`, deliberadamente separado de `src/main.ts`
 *  (H2.5 spec §7) — no acopla la verificación visual manual al `HelloCombatScene` real. */
new Phaser.Game({
  // CANVAS (no WebGL/AUTO) — lectura de píxeles fiable en el sandbox de verificación visual
  // (evita "GPU stall due to ReadPixels" con el Chromium headless preinstalado del entorno).
  type: Phaser.CANVAS,
  width: 1080,
  height: 1920,
  parent: 'app',
  scene: [JuiceSmokeScene],
});
