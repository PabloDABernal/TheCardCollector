import Phaser from 'phaser';
import { CombatScene, COMBAT_SCENE_VIEWPORT } from './scenes/CombatScene';
import { buildDefaultCombatBridge } from './build-default-combat-bridge';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: COMBAT_SCENE_VIEWPORT.width,
  height: COMBAT_SCENE_VIEWPORT.height,
  parent: 'app',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: COMBAT_SCENE_VIEWPORT.width,
    height: COMBAT_SCENE_VIEWPORT.height,
  },
  scene: [], // deliberadamente vacío: CombatScene se añade/arranca a mano abajo, para poder pasarle
             // `CombatSceneInitData` en el `start()` (Phaser no permite inyectar `data` de init a una
             // escena listada directamente en `scene: [...]` de la config del Game).
});

game.scene.add('CombatScene', CombatScene);

void buildDefaultCombatBridge().then((bridge) => {
  game.scene.start('CombatScene', { bridge });
});
