import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { AbilityViewData } from '@collector/combat-scene';
import { isAnyLeaderAbilityActivatable } from '@collector/combat-scene';
import {
  COLOR_BINDER,
  COLOR_FOIL,
  COLOR_RULE,
  COLOR_TEXT_SECONDARY,
  RADIUS_CHIP,
  SPACING,
  TYPE,
} from '../ui/design-tokens';
import { freeStepAvailabilityFor } from './free-step-availability';
import { chipStyle } from './chip-style';
import { useIsCompactViewport } from './use-is-compact-viewport';
import { LEADER_ENERGY_MAX, LEADER_HAND_SIZE_MAX } from './paid-action-availability';

export interface CombatHudProps {
  readonly snapshot: CombatStateSnapshot;
  readonly bridge: CombatBridge;
  readonly leaderName: string; // NUEVO H2.14
  /** FIX Reviewer post-H3 (commit `cce72a3`) — conservada por paridad de contrato aunque
   *  `CombatHud` ya no calcula disponibilidad de "Activar Habilidad" internamente (H5.5 corrección
   *  2026-07-13 §5: ese cálculo vive ahora en `paid-action-availability.ts`, compartido con
   *  `SideActionRail`/H5.9 — `CombatHud` perdió los 4 botones de acción que la necesitaban). */
  readonly leaderAbilities: readonly AbilityViewData[];
}

/** H4 spec §3.2 — override de padding/fontSize aplicado DESPUÉS del spread de
 *  `enabledStyle`/`disabledStyle` en cada chip (el que va después gana en `style={{...a, ...b}}`).
 *  Referencia `var(--hud-chip-*)`, definidas con scope en `.combat-hud` (`CombatScreen.css`) y
 *  redefinidas dentro del `@media (max-width: 480px)` — el navegador recalcula estos valores sin
 *  que la especificidad del inline style entre en juego. */
const compactChipOverride = {
  padding: 'var(--hud-chip-padding-v) var(--hud-chip-padding-h)',
  fontSize: 'var(--hud-chip-font-size)',
};

/** H5.5 corrección 2026-07-13 §0 — vocabulario propio (antes reutilizaba `ActionCategory` de
 *  `@collector/combat-scene`, retirado junto a `TurnDecisionFlow`). Mismos 4 conceptos de dominio,
 *  ya no ligados a ninguna máquina de estados de categoría. */
export type ControlId = 'PLAY_CARD' | 'ACTIVATE_ABILITY' | 'GENERATE_ENERGY' | 'DRAW_CARD';

/** H4 spec §6 — helper puro, testeable, reutilizado por `SideActionRail` (H5.7, Generar Energía/
 *  Robar Carta) y por `useAutoEndTurn` (H5.9, textos de deadlock): centraliza qué texto de motivo
 *  mostrar por control cuando está deshabilitado. `null` = disponible, sin tooltip. */
export function disabledReasonFor(
  control: ControlId,
  snapshot: CombatStateSnapshot,
  leaderAbilities: readonly AbilityViewData[],
): string | null {
  const isLeaderTurn = snapshot.turn.turnOwner === 'LEADER' && snapshot.status === 'IN_PROGRESS';
  if (!isLeaderTurn) {
    return 'No es tu turno';
  }

  const hasActionsRemaining = snapshot.actions.actionsTaken < snapshot.actions.actionsAllowed;
  if (!hasActionsRemaining) {
    return 'Sin acciones restantes este turno';
  }

  switch (control) {
    case 'PLAY_CARD':
      return snapshot.leaderHand.length === 0 ? 'Sin cartas en mano' : null;
    case 'ACTIVATE_ABILITY':
      return isAnyLeaderAbilityActivatable(snapshot, leaderAbilities)
        ? null
        : 'Sin Núcleos disponibles o habilidades en cooldown';
    case 'GENERATE_ENERGY':
      return snapshot.leaderEnergy >= LEADER_ENERGY_MAX ? `Energía al máximo (${LEADER_ENERGY_MAX}/${LEADER_ENERGY_MAX})` : null;
    case 'DRAW_CARD':
      if (snapshot.leaderHand.length >= LEADER_HAND_SIZE_MAX) {
        return `Mano al máximo (${LEADER_HAND_SIZE_MAX}/${LEADER_HAND_SIZE_MAX})`;
      }
      return snapshot.leaderDeckRemaining === 0 ? 'Mazo vacío' : null;
    default:
      return null;
  }
}

/**
 * "Chrome" no-juice sobre el canvas (`architecture_stack.md` §2.3) — vida/Trama/turno YA se
 * muestran vía `CombatBoardOverlay` (H4 §2, capa HTML sincronizada); este HUD React NO duplica ese
 * texto.
 *
 * H5.5 corrección 2026-07-13 §5 — simplificado: la fila de 4 botones de categoría (Jugar Carta/
 * Activar Habilidad/Generar Energía/Robar Carta) y el botón "Fin de turno" (H5.9) se RETIRAN por
 * completo. Jugar Carta/Activar Habilidad vuelven a ser tap directo sobre el objeto en el tablero
 * (`HandCardRow`/`AbilityRow`, `CombatBoardOverlay.tsx`, sin gating de categoría). Generar Energía/
 * Robar Carta se mueven a `SideActionRail` (H5.7), anclado a la mesa de Núcleos. Lo que queda aquí:
 * nombre del Líder (H5.7 §1 — peso visual reducido), contador de acciones, franja de paso previo
 * gratuito (sin cambio, H4).
 */
export function CombatHud({ snapshot, bridge, leaderName }: CombatHudProps): JSX.Element {
  const handFull = snapshot.leaderHand.length >= LEADER_HAND_SIZE_MAX;
  const deckEmpty = snapshot.leaderDeckRemaining === 0;
  const energyAtMax = snapshot.leaderEnergy >= LEADER_ENERGY_MAX;

  // H4 spec §1.3 — extraído a `freeStepAvailabilityFor` (reutilizado también por `TurnStartModal`).
  const freeStep = freeStepAvailabilityFor(snapshot);
  const canFreeDraw = freeStep.canDraw;
  const canFreeGenerate = freeStep.canGenerate;

  const enabledStyle = chipStyle(true);
  const disabledStyle = chipStyle(false);

  // H4 spec §4 — solo gobierna qué TEXTO se renderiza; tamaños/paddings ya responden vía CSS var().
  const isCompact = useIsCompactViewport();

  return (
    <div
      className="combat-hud"
      style={{
        background: COLOR_BINDER,
        borderBottom: `2px solid ${COLOR_RULE}`,
        padding: 'var(--hud-padding-v) var(--hud-padding-h)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--hud-gap)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        {/* H5.7 §1 — nombre del Líder baja de TYPE.displaySm/COLOR_TEXT_PRIMARY (titular) a
            TYPE.labelUpper/COLOR_TEXT_SECONDARY (misma jerarquía que el resto de etiquetas
            secundarias del HUD, ej. "Acciones"). */}
        <span style={{ ...TYPE.labelUpper, fontSize: 'var(--hud-title-size)', color: COLOR_TEXT_SECONDARY }}>
          {leaderName}
        </span>
        <span style={{ ...TYPE.dataLg, fontSize: 'var(--hud-counter-size)', color: COLOR_FOIL }}>
          {snapshot.actions.actionsTaken}/{snapshot.actions.actionsAllowed}
          <span
            style={{
              ...TYPE.labelUpper,
              fontSize: 'var(--hud-label-size)',
              color: COLOR_TEXT_SECONDARY,
              marginLeft: SPACING.xs,
            }}
          >
            Acciones
          </span>
        </span>
      </div>

      {/* Paso previo gratuito — visualmente distinto de las 2 acciones pagadas: no comparte el
          estado "gastado" de `actionsTakenThisTurn`, solo `leaderFreeStep`. Borde punteado `--rule`. */}
      <div
        className="combat-hud-free-step"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--hud-gap)',
          alignItems: 'center',
          border: `1px dashed ${COLOR_RULE}`,
          borderRadius: RADIUS_CHIP,
          padding: 'var(--hud-padding-h)',
        }}
      >
        <span style={{ ...TYPE.labelUpper, fontSize: 'var(--hud-label-size)', color: COLOR_TEXT_SECONDARY }}>
          {isCompact ? 'Gratis' : 'Paso previo (gratis)'}
        </span>
        <button
          disabled={!canFreeDraw}
          title={!canFreeDraw ? (handFull ? 'Mano al máximo' : deckEmpty ? 'Mazo vacío' : 'No es tu turno') : undefined}
          style={{ ...(canFreeDraw ? enabledStyle : disabledStyle), ...compactChipOverride }}
          onClick={() => bridge.dispatch({ type: 'DRAW_OR_GENERATE', action: 'draw' })}
        >
          {isCompact ? 'Robar' : 'Robar carta (gratis)'}
        </button>
        <button
          disabled={!canFreeGenerate}
          title={!canFreeGenerate ? (energyAtMax ? `Energía al máximo (${LEADER_ENERGY_MAX}/${LEADER_ENERGY_MAX})` : 'No es tu turno') : undefined}
          style={{ ...(canFreeGenerate ? enabledStyle : disabledStyle), ...compactChipOverride }}
          onClick={() => bridge.dispatch({ type: 'DRAW_OR_GENERATE', action: 'generate' })}
        >
          {isCompact ? '+1 Energía' : 'Generar energía (gratis)'}
        </button>
      </div>
    </div>
  );
}
