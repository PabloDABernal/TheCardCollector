import type Phaser from 'phaser';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { CardInstanceId } from '@collector/domain-shared';
import { resolveOrCreateCardPlaceholder } from '../juice';
import { MINIONS_ROW_Y, TILE_SEPARATION_PX } from './board-layout';

const MINIONS_ROW_X_ORIGIN = 200;

export interface MinionsView {
  /** Análogo exacto de `AlliesView.syncFromSnapshot` para `MinionInPlay`/`minionsInPlay`
   *  (`MINIONS_ROW_Y`), mostrando `isDefensor` como una etiqueta de texto adicional. Nunca destruye
   *  tiles de Secuaz. */
  syncFromSnapshot(snapshot: CombatStateSnapshot): void;
}

interface MinionTileEntry {
  readonly rect: Phaser.GameObjects.Rectangle;
  readonly text: Phaser.GameObjects.Text;
}

export function createMinionsView(scene: Phaser.Scene): MinionsView {
  const tilesByInstanceId = new Map<CardInstanceId, MinionTileEntry>();

  return {
    syncFromSnapshot(snapshot: CombatStateSnapshot): void {
      snapshot.minionsInPlay.forEach((minion, index) => {
        const x = MINIONS_ROW_X_ORIGIN + index * TILE_SEPARATION_PX;
        const y = MINIONS_ROW_Y;

        // Reutiliza `resolveOrCreateCardPlaceholder` (misma razón que `allies-view.ts` — evita el
        // duplicado de `name` si `MINION_SUMMONED` ya disparó `cardFlip` antes del primer
        // `syncFromSnapshot`).
        const rect = resolveOrCreateCardPlaceholder(scene, minion.instanceId);
        rect.setName(minion.instanceId);
        rect.setPosition(x, y);
        rect.setInteractive().setData('targetId', minion.instanceId);

        let entry = tilesByInstanceId.get(minion.instanceId);
        if (!entry) {
          const text = scene.add.text(x, y, '', {
            fontSize: '14px',
            color: '#ffffff',
            align: 'center',
          });
          text.setOrigin(0.5, 0.5);
          // NUEVO §3.9.6 — nombrado por convención `${instanceId}-label` para que la receta
          // `minionDefeated` (juice/recipes/minion-defeated.ts) pueda destruirlo junto al rect
          // principal cuando el Secuaz muere, sin dejarlo huérfano en pantalla.
          text.setName(`${minion.instanceId}-label`);
          entry = { rect, text };
          tilesByInstanceId.set(minion.instanceId, entry);
        }

        entry.text.setPosition(x, y);
        const defensorLabel = minion.isDefensor ? ' (Defensor)' : '';
        // NUEVO §3.9 — vida propia del Secuaz, mismo formato que `allies-view.ts` ("Vida X/Y").
        entry.text.setText(`${minion.definitionId}${defensorLabel}\nVida ${minion.life}/${minion.maxLife}`);
      });
    },
  };
}
