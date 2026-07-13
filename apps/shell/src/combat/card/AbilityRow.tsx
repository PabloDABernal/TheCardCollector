import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { AbilityViewData, GestureCommandTranslatorHandle } from '@collector/combat-scene';
import { LEADER_POSITION, ENEMY_POSITION, ABILITY_ICON_SEPARATION_PX } from '@collector/combat-scene';
import { AbilityTile, type AbilityTileData } from './AbilityTile';

export interface AbilityRowProps {
  readonly snapshot: CombatStateSnapshot;
  readonly abilities: readonly AbilityViewData[];
  readonly side: 'LEADER' | 'ENEMY';
  readonly rowY: number;
  readonly interactive: boolean;
  readonly gestureHandle?: GestureCommandTranslatorHandle; // solo requerido si interactive === true
  /** NUEVO H5.5 §4.1 — por defecto `true` (retrocompatible: el uso de Enemigo no lo pasa, sigue
   *  siempre visible). `false` oculta la fila completa (no renderiza nada, mismo criterio que
   *  `HandCardRow` en `CombatBoardOverlay.tsx`: "oculto", no "atenuado"). Prop en vez de que el
   *  padre condicione el montaje (`{condition && <AbilityRow .../>}`) porque `AbilityRow` mantiene
   *  internamente el estado de `AbilityTile`/popover de long-press — desmontar/remontar el
   *  componente completo en cada transición de fase perdería ese estado interno de forma más
   *  disruptiva que ocultarlo. */
  readonly visible?: boolean;
}

/** H4_componente_carta.md §2/§6 — sustituye `ability-cooldown-view.ts` (Phaser). Mapea
 *  `ctx.leaderAbilities`/`ctx.enemyAbilities` a `<AbilityTile>`, misma fila horizontal centrada que
 *  la vista Phaser retirada calculaba (`LEADER_POSITION`/`ENEMY_POSITION` + `rowY` +
 *  `ABILITY_ICON_SEPARATION_PX`). */
export function AbilityRow({ snapshot, abilities, side, rowY, interactive, gestureHandle, visible = true }: AbilityRowProps): JSX.Element | null {
  if (!visible) return null;

  const centerX = side === 'LEADER' ? LEADER_POSITION.x : ENEMY_POSITION.x;
  const startX = centerX - ((abilities.length - 1) * ABILITY_ICON_SEPARATION_PX) / 2;

  return (
    <>
      {abilities.map((ability, index) => {
        const x = startX + index * ABILITY_ICON_SEPARATION_PX;
        const cooldown = snapshot.cooldowns.find((c) => c.abilityId === ability.abilityId);
        const remaining = cooldown ? cooldown.remaining : ability.baseCooldown;

        const tileData: AbilityTileData = {
          abilityId: ability.abilityId,
          name: ability.name,
          coreCost: ability.coreCost,
          baseCooldown: ability.baseCooldown,
          remaining,
          ...(ability.ruleText !== undefined ? { ruleText: ability.ruleText } : {}),
        };

        return (
          <div
            key={ability.abilityId}
            style={{
              position: 'absolute',
              left: x,
              top: rowY,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto',
            }}
          >
            <AbilityTile
              ability={tileData}
              interactive={interactive}
              {...(interactive && gestureHandle
                ? { onTap: () => gestureHandle.handleAbilityTap(ability.abilityId) }
                : {})}
            />
          </div>
        );
      })}
    </>
  );
}
