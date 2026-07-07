import type Phaser from 'phaser';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import { NUCLEO_POOL_ROW_Y, TILE_SEPARATION_PX } from './board-layout';
import { NUCLEO_COLOR_HEX } from './nucleo-colors';

const NUCLEO_DIE_SIZE = 64;
const NUCLEO_POOL_X_ORIGIN = 200;

export interface NucleoPoolView {
  /** Destruye TODOS los tiles de dado previos y crea uno nuevo por cada NucleoInstance de
   *  `snapshot.nucleoPool` — seguro porque ningún otro subsistema mantiene una referencia viva a
   *  estos tiles entre llamadas (spec §1.2/§3.6: `diceRoll` no los toca, crea los suyos propios). */
  syncFromSnapshot(snapshot: CombatStateSnapshot): void;
}

/** Cada tile: `Rectangle` 64×64 coloreado por `NUCLEO_COLOR_HEX[nucleo.color]` + `Text` con
 *  `nucleo.value` + `setInteractive().setData('targetId', nucleo.id)` (spec §1.1; sin `setName`,
 *  §1.2 — `NUCLEO_POOL_ROLLED` no lleva `focusId`, así que ningún juice necesita `getByName` sobre
 *  un Núcleo individual). */
export function createNucleoPoolView(scene: Phaser.Scene): NucleoPoolView {
  let dieRects: Phaser.GameObjects.Rectangle[] = [];
  let dieTexts: Phaser.GameObjects.Text[] = [];

  return {
    syncFromSnapshot(snapshot: CombatStateSnapshot): void {
      for (const rect of dieRects) {
        rect.destroy();
      }
      for (const text of dieTexts) {
        text.destroy();
      }
      dieRects = [];
      dieTexts = [];

      snapshot.nucleoPool.forEach((nucleo, index) => {
        const x = NUCLEO_POOL_X_ORIGIN + index * TILE_SEPARATION_PX;
        const y = NUCLEO_POOL_ROW_Y;

        const rect = scene.add.rectangle(x, y, NUCLEO_DIE_SIZE, NUCLEO_DIE_SIZE, NUCLEO_COLOR_HEX[nucleo.color]);
        rect.setInteractive().setData('targetId', nucleo.id);
        dieRects.push(rect);

        const text = scene.add.text(x, y, `${nucleo.value}`, {
          fontSize: '24px',
          color: '#ffffff',
          align: 'center',
        });
        text.setOrigin(0.5, 0.5);
        dieTexts.push(text);
      });
    },
  };
}
