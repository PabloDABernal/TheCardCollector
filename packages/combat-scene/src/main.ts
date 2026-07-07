import Phaser from 'phaser';
import { CombatScene, COMBAT_SCENE_VIEWPORT } from './scenes/CombatScene';
import { buildDefaultCombatBridge } from './build-default-combat-bridge';
import { createInputAdapter } from './input';

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

// H2.7 QA — `game.scene.add()` puede devolver `null` si se llama antes de que Phaser termine su
// arranque interno (asíncrono pese a que `new Phaser.Game(...)` parezca síncrono). Hay que esperar
// el evento READY del propio Game antes de tocar el SceneManager; solo entonces registrar el
// listener de CREATE (antes de `start()`, ya que init→preload→create corren síncronos cuando
// preload() no dispara carga asíncrona, como aquí) para no perder el evento.
game.events.once(Phaser.Core.Events.READY, () => {
  const scene = game.scene.add('CombatScene', CombatScene, false);
  if (!scene) {
    throw new Error('main.ts: game.scene.add() no devolvió la escena "CombatScene" recién añadida');
  }

  // H2.7 spec §4.2 — verificación visual manual complementaria, no gate de CI: un `Rectangle` de
  // prueba interactivo y un overlay de debug que muestra el último `PointerGesture` detectado, para
  // poder probar tap/drag/long-press sobre *algo* concreto antes de que H2.8 aporte sprites reales.
  // Se elimina del harness cuando H2.8 exista.
  scene.events.once(Phaser.Scenes.Events.CREATE, () => {
    const debugRect = scene.add.rectangle(
      COMBAT_SCENE_VIEWPORT.width / 2,
      COMBAT_SCENE_VIEWPORT.height / 2,
      300,
      300,
      0x3355ff,
    );
    debugRect.setInteractive().setData('targetId', 'debug-rect');

    const debugText = scene.add.text(16, 16, 'InputAdapter (H2.7): sin gestos todavía', {
      fontSize: '28px',
      color: '#ffffff',
    });

    const inputAdapter = createInputAdapter();
    inputAdapter.attach(scene);
    inputAdapter.subscribe((gesture) => {
      debugText.setText(`InputAdapter (H2.7): ${JSON.stringify(gesture)}`);
    });
  });

  void buildDefaultCombatBridge().then(({ bridge, boardContext }) => {
    game.scene.start('CombatScene', { bridge, boardContext });
  });
});
