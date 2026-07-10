import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { TargetingPrompt } from '@collector/combat-scene';
import type { BoardViewContext, GestureCommandTranslatorHandle } from '@collector/combat-scene';
import { MINIONS_ROW_X_ORIGIN, MINIONS_ROW_Y, TILE_SEPARATION_PX } from '@collector/combat-scene';
import { CardTile, type CardTileData } from './CardTile';

export interface MinionRowProps {
  readonly snapshot: CombatStateSnapshot;
  readonly ctx: BoardViewContext;
  readonly gestureHandle: GestureCommandTranslatorHandle | null;
  /** NUEVO H4.x — resuelve el highlight `selected` cuando este Secuaz es un objetivo válido del
   *  targeting vigente (`AWAITING_ATTACK_TARGET`/`AWAITING_ATTACK_TARGET_FOR_ABILITY`). */
  readonly targetingPrompt: TargetingPrompt;
}

function validTargetIds(prompt: TargetingPrompt): readonly string[] {
  return prompt.kind === 'AWAITING_ATTACK_TARGET' || prompt.kind === 'AWAITING_ATTACK_TARGET_FOR_ABILITY'
    ? prompt.validTargetIds
    : [];
}

/**
 * NUEVO H4.x — sustituye a `minions-view.ts` (Phaser, ELIMINADO). Mapea `snapshot.minionsInPlay` a
 * `<CardTile size="board">`, usando `ctx.nameLookup.minionName(...)` para resolver el nombre legible
 * (fix del bug de ID crudo, ver spec H4_targeting_habilidades_y_ficha_personaje.md §2.1/§2.4).
 */
export function MinionRow({ snapshot, ctx, gestureHandle, targetingPrompt }: MinionRowProps): JSX.Element {
  const targetableIds = validTargetIds(targetingPrompt);

  return (
    <>
      {snapshot.minionsInPlay.map((minion, index) => {
        const cardTileData: CardTileData = {
          id: minion.instanceId,
          name: ctx.nameLookup.minionName(minion.definitionId), // FIX del ID crudo (bug confirmado)
          icon: 'SECUAZ',
          cost: null,
          boardLife: { current: minion.life, max: minion.maxLife },
          keywords: minion.isDefensor ? [{ keyword: 'DEFENSOR' }] : [],
        };

        return (
          <CardTile
            key={minion.instanceId}
            card={cardTileData}
            size="board"
            selected={targetableIds.includes(minion.instanceId)}
            style={{
              position: 'absolute',
              left: MINIONS_ROW_X_ORIGIN + index * TILE_SEPARATION_PX,
              top: MINIONS_ROW_Y,
              transform: 'translate(-50%, -50%)',
            }}
            {...(gestureHandle ? { onTap: () => gestureHandle.handleMinionTap(minion.instanceId) } : {})}
          />
        );
      })}
    </>
  );
}
