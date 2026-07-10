import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { BoardViewContext } from '@collector/combat-scene';
import { ALLIES_ROW_X_ORIGIN, ALLIES_ROW_Y, TILE_SEPARATION_PX } from '@collector/combat-scene';
import { CardTile, type CardTileData } from './CardTile';

export interface AllyRowProps {
  readonly snapshot: CombatStateSnapshot;
  readonly ctx: BoardViewContext;
}

/**
 * NUEVO H4.x — sustituye a `allies-view.ts` (Phaser, ELIMINADO). Espejo exacto de `MinionRow`, usando
 * `ally.cardId` + `ctx.nameLookup.cardName(...)` + `isBerserker` (fix del bug de ID crudo, ver spec
 * H4_targeting_habilidades_y_ficha_personaje.md §2.1/§2.4). Sin `onTap` — el jugador nunca elige a su
 * propio Aliado como objetivo de ataque (decisions.md, "Vida de Secuaz" §1: solo Secuaces enemigos son
 * targeteables).
 */
export function AllyRow({ snapshot, ctx }: AllyRowProps): JSX.Element {
  return (
    <>
      {snapshot.alliesInPlay.map((ally, index) => {
        const cardTileData: CardTileData = {
          id: ally.instanceId,
          name: ctx.nameLookup.cardName(ally.cardId), // FIX del ID crudo (bug confirmado)
          icon: 'ALIADO',
          cost: null,
          boardLife: { current: ally.life, max: ally.maxLife },
          keywords: ally.isBerserker ? [{ keyword: 'BERSERKER' }] : [],
        };

        return (
          <CardTile
            key={ally.instanceId}
            card={cardTileData}
            size="board"
            style={{
              position: 'absolute',
              left: ALLIES_ROW_X_ORIGIN + index * TILE_SEPARATION_PX,
              top: ALLIES_ROW_Y,
              transform: 'translate(-50%, -50%)',
            }}
          />
        );
      })}
    </>
  );
}
