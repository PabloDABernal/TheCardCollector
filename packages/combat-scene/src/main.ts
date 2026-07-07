import Phaser from 'phaser';
import { HelloCombatScene } from './scenes/HelloCombatScene';

new Phaser.Game({
  type: Phaser.AUTO,
  width: 1080,
  height: 1920,
  parent: 'app',
  scene: [HelloCombatScene],
});
