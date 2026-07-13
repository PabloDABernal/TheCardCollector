import type { CSSProperties } from 'react';
import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { AbilityViewData } from '@collector/combat-scene';
import {
  SIDE_ACTION_RAIL_X,
  SIDE_ACTION_RAIL_Y,
  SIDE_ACTION_RAIL_GAP_PX,
  RAIL_CHIP_HALF_WIDTH_PX,
  RAIL_CHIP_HEIGHT_PX,
} from '@collector/combat-scene';
import { TYPE } from '../ui/design-tokens';
import { chipStyle } from './chip-style';
import { disabledReasonFor } from './CombatHud';
import { paidActionAvailabilityFor } from './paid-action-availability';

export interface SideActionRailProps {
  readonly bridge: CombatBridge;
  readonly snapshot: CombatStateSnapshot;
  readonly leaderAbilities: readonly AbilityViewData[]; // requerido por la firma de disabledReasonFor,
                                                          // no usado internamente por estas 2 categorías
}

function railChipStyle(enabled: boolean): CSSProperties {
  return {
    ...chipStyle(enabled),
    ...TYPE.labelUpper,
    width: RAIL_CHIP_HALF_WIDTH_PX * 2,
    minHeight: RAIL_CHIP_HEIGHT_PX,
    textAlign: 'center',
  };
}

/**
 * H5.7 §3 — sustituye funcionalmente a la fila de 4 botones retirada de `CombatHud.tsx` (H5.5
 * corrección), pero SOLO para las 2 categorías sin objetivo visual propio en mesa (Generar
 * Energía/Robar Carta) — decisions.md 2026-07-13 punto 2. Dispatch directo, sin ninguna máquina de
 * estados intermedia, mismo criterio que la franja "Paso previo (gratis)" de `CombatHud.tsx`.
 */
export function SideActionRail({ bridge, snapshot, leaderAbilities }: SideActionRailProps): JSX.Element {
  const avail = paidActionAvailabilityFor(snapshot, leaderAbilities);

  return (
    <div
      style={{
        position: 'absolute',
        left: SIDE_ACTION_RAIL_X,
        top: SIDE_ACTION_RAIL_Y,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: SIDE_ACTION_RAIL_GAP_PX - RAIL_CHIP_HEIGHT_PX,
        pointerEvents: 'auto',
      }}
    >
      <button
        disabled={!avail.canGenerateEnergy}
        title={disabledReasonFor('GENERATE_ENERGY', snapshot, leaderAbilities) ?? undefined}
        style={railChipStyle(avail.canGenerateEnergy)}
        onClick={() => bridge.dispatch({ type: 'GENERATE_ENERGY' })}
      >
        ⚡ Energía
      </button>
      <button
        disabled={!avail.canDrawCard}
        title={disabledReasonFor('DRAW_CARD', snapshot, leaderAbilities) ?? undefined}
        style={railChipStyle(avail.canDrawCard)}
        onClick={() => bridge.dispatch({ type: 'DRAW_CARD' })}
      >
        🂠 Robar
      </button>
    </div>
  );
}
