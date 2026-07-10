import type Phaser from 'phaser';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { CardInstanceId } from '@collector/domain-shared';
import { MINIONS_ROW_Y, ALLIES_ROW_Y, MINIONS_ROW_X_ORIGIN, ALLIES_ROW_X_ORIGIN, TILE_SEPARATION_PX } from './board-layout';

const ANCHOR_SIZE_PX = 96; // = GENERIC_PLACEHOLDER_SIZE (juice/recipes/placeholder.ts) — solo importa el nombre/posición

/**
 * NUEVO H4.x — sustituye a `minions-view.ts`/`allies-view.ts` (Phaser, ELIMINADOS — spec
 * H4_targeting_habilidades_y_ficha_personaje.md §2.2: el bug de nombre crudo y el tile visual sin
 * marco se resuelven migrando la parte VISIBLE a `MinionRow.tsx`/`AllyRow.tsx` (HTML, `CardTile`
 * `size="board"`, `apps/shell`). Este módulo conserva la ÚNICA responsabilidad que la migración a
 * HTML no puede cubrir: un game object de Phaser NOMBRADO por `instanceId`, en la posición correcta
 * de la fila (misma coordenada de viewport virtual que usa el tile HTML real), para que
 * `hitImpact`/`floatingNumber`/`cardFlip`/`minionDefeated` (juice, `resolveOrCreatePlaceholder`/
 * `resolveOrCreatePlaceholder`, `effects-director.ts` §`resolveJuiceTarget`) sigan animando/flasheando
 * EN el punto de pantalla del tile — no en el centro del viewport (`DEFAULT_PLACEHOLDER_POSITION`),
 * que es donde caerían sin esta ancla (regresión de "feel" no cubierta explícitamente por la spec de
 * la pieza 2, pero necesaria para no degradar el combate — decisions.md "el feel chulo del combate
 * por encima de la simplicidad de implementación"). SIEMPRE invisible (`alpha = 0`, sin `Text`) — el
 * único visual real es el `CardTile` HTML.
 */
export interface BoardAnchorsView {
  syncFromSnapshot(snapshot: CombatStateSnapshot): void;
}

export function createBoardAnchorsView(scene: Phaser.Scene): BoardAnchorsView {
  const anchorsByInstanceId = new Map<CardInstanceId, Phaser.GameObjects.Rectangle>();

  function resolveOrCreateInvisibleAnchor(instanceId: CardInstanceId, x: number, y: number): void {
    let anchor = anchorsByInstanceId.get(instanceId);
    if (!anchor) {
      // Reutiliza el mismo game object que `resolveOrCreatePlaceholder` habría creado bajo demanda
      // (mismo `setName`), para que la resolución por nombre de las recetas de juice lo encuentre
      // ANTES de crear uno propio a mitad de pantalla.
      anchor = scene.add.rectangle(x, y, ANCHOR_SIZE_PX, ANCHOR_SIZE_PX, 0x000000, 0);
      anchor.setName(instanceId);
      anchorsByInstanceId.set(instanceId, anchor);
    }
    anchor.setPosition(x, y);
  }

  return {
    syncFromSnapshot(snapshot: CombatStateSnapshot): void {
      const presentIds = new Set([
        ...snapshot.minionsInPlay.map((m) => m.instanceId),
        ...snapshot.alliesInPlay.map((a) => a.instanceId),
      ]);

      // Olvida las anclas de entidades que ya no están en mesa (derrotadas) — SIN destruir el game
      // object aquí: la receta `minionDefeated` (juice, fire-and-forget contra `subscribeSceneEvents`)
      // ya lo destruye tras su tween de fade+shrink (mismo criterio exacto que `minions-view.ts`
      // documentaba antes de ser eliminado — destruir aquí también arriesga un doble-destroy si esta
      // sincronización corre antes de que termine el tween).
      for (const instanceId of Array.from(anchorsByInstanceId.keys())) {
        if (!presentIds.has(instanceId)) {
          anchorsByInstanceId.delete(instanceId);
        }
      }

      snapshot.minionsInPlay.forEach((minion, index) => {
        resolveOrCreateInvisibleAnchor(minion.instanceId, MINIONS_ROW_X_ORIGIN + index * TILE_SEPARATION_PX, MINIONS_ROW_Y);
      });
      snapshot.alliesInPlay.forEach((ally, index) => {
        resolveOrCreateInvisibleAnchor(ally.instanceId, ALLIES_ROW_X_ORIGIN + index * TILE_SEPARATION_PX, ALLIES_ROW_Y);
      });
    },
  };
}
