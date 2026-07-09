import type { CSSProperties } from 'react';
import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { AbilityViewData } from '@collector/combat-scene';
import { isAnyLeaderAbilityActivatable } from '@collector/combat-scene';
import {
  COLOR_BINDER,
  COLOR_FOIL,
  COLOR_RULE,
  COLOR_TEXT_DISABLED,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  RADIUS_CHIP,
  SPACING,
  TYPE,
} from '../ui/design-tokens';

export interface CombatHudProps {
  readonly snapshot: CombatStateSnapshot;
  readonly bridge: CombatBridge; // NUEVO H3.5 — dispatch directo de los controles de decisión de turno
  readonly onEndTurn: () => void;
  readonly leaderName: string; // NUEVO H2.14
  /** FIX Reviewer post-H3 (commit `cce72a3`) — las `baseAbilities` del Líder (mismo dato que
   *  `BoardViewContext.leaderAbilities`), necesarias para que "Activar Habilidad" compruebe
   *  disponibilidad por color real vía `isAnyLeaderAbilityActivatable`, en vez del agregado laxo
   *  anterior ("¿algún dado libre? Y ¿alguna habilidad en CD 0?" sin cruzarlos). */
  readonly leaderAbilities: readonly AbilityViewData[];
}

const LEADER_ENERGY_MAX = 5; // GDD §2.2 / decisions.md — tope de Energía, mismo valor que el motor
const LEADER_HAND_SIZE_MAX = 7; // decisions.md "Tope de mano: 7"

type ControlId = 'PLAY_CARD' | 'ACTIVATE_ABILITY' | 'GENERATE_ENERGY' | 'DRAW_CARD';

/** H4 spec §6 — helper puro, testeable, reutilizado por los 4 controles (Jugar Carta / Activar
 *  Habilidad / Generar Energía / Robar Carta): centraliza qué texto de motivo mostrar por control
 *  cuando está deshabilitado. `null` = disponible, sin tooltip. */
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

/** H4 spec §6 — helper visual único reutilizado por los 6 controles (2 gratis + 4 pagados + fin de
 *  turno), sustituye el `buttonBaseStyle`/`enabledStyle`/`disabledStyle` inline anterior por una
 *  función pura testeable, mismo criterio que `disabledReasonFor`. */
export function chipStyle(enabled: boolean): CSSProperties {
  return {
    ...TYPE.bodyMd,
    borderRadius: RADIUS_CHIP,
    padding: `${SPACING.xs}px ${SPACING.sm}px`,
    background: COLOR_BINDER,
    border: `1px solid ${enabled ? COLOR_RULE : 'rgba(58, 55, 68, 0.4)'}`,
    color: enabled ? COLOR_TEXT_PRIMARY : COLOR_TEXT_DISABLED,
    cursor: enabled ? 'pointer' : 'default',
  };
}

/**
 * "Chrome" no-juice sobre el canvas (`architecture_stack.md` §2.3) — vida/Trama/turno YA se
 * muestran vía `CombatBoardOverlay` (H4 §2, capa HTML sincronizada); este HUD React NO duplica ese
 * texto.
 *
 * decisions.md fija la estructura del turno del Líder como "paso previo gratis + 2 acciones": 5
 * controles visibles: Jugar Carta, Activar Habilidad, Generar Energía (pagada), Robar Carta
 * (pagada), más el paso previo gratuito (Robar/Energía gratis), visualmente distinto porque NO
 * consume ninguna de las 2 acciones del turno.
 *
 * Decisión de implementación (no trivial, documentada): "Jugar Carta" y "Activar Habilidad" no son
 * botones accionables desde este HUD — su gesto real ya vive en el canvas de Phaser (tap en una
 * carta de la mano / tap en un icono de habilidad, `gesture-command-translator.ts`). Aquí se
 * muestran como INDICADORES de disponibilidad (mismo criterio de estado activo/deshabilitado que
 * pide la spec), no como controles que despachen un comando por sí mismos — evita duplicar un
 * segundo mecanismo de selección de carta/objetivo/Núcleo fuera del tablero. "Generar Energía" y
 * "Robar Carta" (pagadas) SÍ son botones accionables aquí porque no requieren ninguna selección
 * adicional (sin objetivo, sin Núcleo) — igual que el paso previo gratuito.
 *
 * H4 spec §6 — rediseño de cromo sobre el sistema de diseño real: tipografía Staatliches/Manrope/
 * JetBrains Mono, paleta con nombre, contador de acciones destacado en `--foil`.
 */
export function CombatHud({ snapshot, bridge, onEndTurn, leaderName, leaderAbilities }: CombatHudProps): JSX.Element {
  const isLeaderTurn = snapshot.turn.turnOwner === 'LEADER' && snapshot.status === 'IN_PROGRESS';
  const hasActionsRemaining = snapshot.actions.actionsTaken < snapshot.actions.actionsAllowed;
  const canAct = isLeaderTurn && hasActionsRemaining;

  const handEmpty = snapshot.leaderHand.length === 0;
  const handFull = snapshot.leaderHand.length >= LEADER_HAND_SIZE_MAX;
  const deckEmpty = snapshot.leaderDeckRemaining === 0;
  const energyAtMax = snapshot.leaderEnergy >= LEADER_ENERGY_MAX;

  const canPlayCard = canAct && !handEmpty;
  // FIX Reviewer post-H3 (commit `cce72a3`) — antes era un agregado laxo ("¿algún dado libre? Y
  // ¿alguna habilidad en CD 0?") que no cruzaba color de dado contra `coreCost` de la habilidad
  // concreta lista. `isAnyLeaderAbilityActivatable` reutiliza el mismo criterio que
  // `gesture-command-translator.ts` (`satisfiesCoreCost`) para que el indicador nunca muestre
  // activo un estado que el tap real rechazaría.
  const canActivateAbility = canAct && isAnyLeaderAbilityActivatable(snapshot, leaderAbilities);
  const canGenerateEnergyPaid = canAct && !energyAtMax;
  const canDrawCardPaid = canAct && !handFull && !deckEmpty;

  const freeStepAvailable = isLeaderTurn && !snapshot.leaderFreeStep.takenThisTurn;
  const canFreeDraw = freeStepAvailable && !handFull && !deckEmpty;
  const canFreeGenerate = freeStepAvailable && !energyAtMax;

  const enabledStyle = chipStyle(true);
  const disabledStyle = chipStyle(false);

  return (
    <div
      className="combat-hud"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        background: COLOR_BINDER,
        borderBottom: `2px solid ${COLOR_RULE}`,
        padding: SPACING.md,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.sm,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ ...TYPE.displaySm, color: COLOR_TEXT_PRIMARY }}>{leaderName}</span>
        <span style={{ ...TYPE.dataLg, color: COLOR_FOIL }}>
          {snapshot.actions.actionsTaken}/{snapshot.actions.actionsAllowed}
          <span style={{ ...TYPE.labelUpper, color: COLOR_TEXT_SECONDARY, marginLeft: SPACING.xs }}>
            Acciones
          </span>
        </span>
      </div>

      {/* Paso previo gratuito — visualmente distinto de las 2 acciones pagadas (spec §6): no
          comparte el estado "gastado" de `actionsTakenThisTurn`, solo `leaderFreeStep`. Borde
          punteado `--rule` en vez del borde blanco sólido anterior (demasiado genérico/alto
          contraste sin relación con el sistema). */}
      <div
        className="combat-hud-free-step"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: SPACING.sm,
          alignItems: 'center',
          border: `1px dashed ${COLOR_RULE}`,
          borderRadius: RADIUS_CHIP,
          padding: SPACING.xs,
        }}
      >
        <span style={{ ...TYPE.labelUpper, color: COLOR_TEXT_SECONDARY }}>Paso previo (gratis)</span>
        <button
          disabled={!canFreeDraw}
          title={!canFreeDraw ? (handFull ? 'Mano al máximo' : deckEmpty ? 'Mazo vacío' : 'No es tu turno') : undefined}
          style={canFreeDraw ? enabledStyle : disabledStyle}
          onClick={() => bridge.dispatch({ type: 'DRAW_OR_GENERATE', action: 'draw' })}
        >
          Robar carta (gratis)
        </button>
        <button
          disabled={!canFreeGenerate}
          title={!canFreeGenerate ? (energyAtMax ? `Energía al máximo (${LEADER_ENERGY_MAX}/${LEADER_ENERGY_MAX})` : 'No es tu turno') : undefined}
          style={canFreeGenerate ? enabledStyle : disabledStyle}
          onClick={() => bridge.dispatch({ type: 'DRAW_OR_GENERATE', action: 'generate' })}
        >
          Generar energía (gratis)
        </button>
      </div>

      {/* 2 acciones pagadas — 4 opciones, decisions.md "Estructura del turno del jugador". */}
      <div className="combat-hud-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm }}>
        <span
          aria-disabled={!canPlayCard}
          title={disabledReasonFor('PLAY_CARD', snapshot, leaderAbilities) ?? undefined}
          style={canPlayCard ? enabledStyle : disabledStyle}
        >
          Jugar Carta
        </span>
        <span
          aria-disabled={!canActivateAbility}
          title={disabledReasonFor('ACTIVATE_ABILITY', snapshot, leaderAbilities) ?? undefined}
          style={canActivateAbility ? enabledStyle : disabledStyle}
        >
          Activar Habilidad
        </span>
        <button
          disabled={!canGenerateEnergyPaid}
          title={disabledReasonFor('GENERATE_ENERGY', snapshot, leaderAbilities) ?? undefined}
          style={canGenerateEnergyPaid ? enabledStyle : disabledStyle}
          onClick={() => bridge.dispatch({ type: 'GENERATE_ENERGY' })}
        >
          Generar Energía
        </button>
        <button
          disabled={!canDrawCardPaid}
          title={disabledReasonFor('DRAW_CARD', snapshot, leaderAbilities) ?? undefined}
          style={canDrawCardPaid ? enabledStyle : disabledStyle}
          onClick={() => bridge.dispatch({ type: 'DRAW_CARD' })}
        >
          Robar Carta
        </button>
      </div>

      <button
        onClick={onEndTurn}
        disabled={snapshot.status !== 'IN_PROGRESS'}
        style={{
          ...(snapshot.status === 'IN_PROGRESS' ? enabledStyle : disabledStyle),
          marginTop: SPACING.sm,
        }}
      >
        Fin de turno
      </button>
    </div>
  );
}
