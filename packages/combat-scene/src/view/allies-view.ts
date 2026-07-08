import type Phaser from 'phaser';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { CardInstanceId } from '@collector/domain-shared';
import { resolveOrCreateCardPlaceholder } from '../juice';
import { ALLIES_ROW_Y, TILE_SEPARATION_PX } from './board-layout';

const ALLIES_ROW_X_ORIGIN = 200;

export interface AlliesView {
  /** Por cada AllyInPlay del snapshot: si no existe un game object con `name === instanceId`
   *  (mismo mecanismo de búsqueda que `resolveOrCreatePlaceholder`, reutilizado), se crea en la
   *  siguiente posición libre de la fila (`ALLIES_ROW_Y`); si ya existe, solo se reposiciona a su
   *  índice actual (por si el orden se hubiera alterado, defensivo) y se actualiza su texto de vida.
   *  Nunca se llama `.destroy()` sobre un tile de Aliado. */
  syncFromSnapshot(snapshot: CombatStateSnapshot): void;
}

interface AllyTileEntry {
  readonly rect: Phaser.GameObjects.Rectangle;
  readonly text: Phaser.GameObjects.Text;
}

export function createAlliesView(scene: Phaser.Scene): AlliesView {
  const tilesByInstanceId = new Map<CardInstanceId, AllyTileEntry>();

  return {
    syncFromSnapshot(snapshot: CombatStateSnapshot): void {
      snapshot.alliesInPlay.forEach((ally, index) => {
        const x = ALLIES_ROW_X_ORIGIN + index * TILE_SEPARATION_PX;
        const y = ALLIES_ROW_Y;

        // Reutiliza `resolveOrCreateCardPlaceholder` (misma función que `card-flip.ts` usa como
        // fallback) para que, si `ALLY_ENTERED_PLAY` ya disparó `cardFlip` sobre este `instanceId`
        // ANTES del primer `syncFromSnapshot`, no se cree un segundo game object con el mismo
        // `name` — se reutiliza el placeholder ya existente (spec §3.4 nota de reutilización).
        const rect = resolveOrCreateCardPlaceholder(scene, ally.instanceId);
        rect.setName(ally.instanceId);
        rect.setPosition(x, y);
        rect.setInteractive().setData('targetId', ally.instanceId);

        let entry = tilesByInstanceId.get(ally.instanceId);
        if (!entry) {
          const text = scene.add.text(x, y, '', {
            fontSize: '14px',
            color: '#ffffff',
            align: 'center',
          });
          text.setOrigin(0.5, 0.5);
          entry = { rect, text };
          tilesByInstanceId.set(ally.instanceId, entry);
        }

        entry.text.setPosition(x, y);
        const berserkerLabel = ally.isBerserker ? ' (Berserker)' : '';
        entry.text.setText(`${ally.cardId}\nVida ${ally.life}/${ally.maxLife}${berserkerLabel}`);
      });
    },
  };
}
