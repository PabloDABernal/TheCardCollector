import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { AbilityViewData, ActionCategory, TurnDecisionFlow, TurnRevealStage } from '@collector/combat-scene';
import { isAnyLeaderAbilityActivatable } from '@collector/combat-scene';
import {
  COLOR_BINDER,
  COLOR_FOIL,
  COLOR_RULE,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  RADIUS_CHIP,
  SPACING,
  TYPE,
} from '../ui/design-tokens';
import { freeStepAvailabilityFor } from './free-step-availability';
import { chipStyle } from './chip-style';
import { useIsCompactViewport } from './use-is-compact-viewport';

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
  /** NUEVO H5.5 §3 — sustituye el dispatch directo de GENERATE_ENERGY/DRAW_CARD y añade el gating de
   *  PLAY_CARD/ACTIVATE_ABILITY (H5.2 §4: `TurnDecisionFlow` es el único punto de dispatch para las 4
   *  categorías a partir de esta historia). `null` mientras `CombatScene` no emitió `READY`. */
  readonly turnDecisionFlow: TurnDecisionFlow | null;
  readonly stage: TurnRevealStage;
}

const LEADER_ENERGY_MAX = 5; // GDD §2.2 / decisions.md — tope de Energía, mismo valor que el motor
const LEADER_HAND_SIZE_MAX = 7; // decisions.md "Tope de mano: 7"

/** H4 spec §3.2 — override de padding/fontSize aplicado DESPUÉS del spread de
 *  `enabledStyle`/`disabledStyle` en cada chip (el que va después gana en `style={{...a, ...b}}`).
 *  Referencia `var(--hud-chip-*)`, definidas con scope en `.combat-hud` (`CombatScreen.css`) y
 *  redefinidas dentro del `@media (max-width: 480px)` — el navegador recalcula estos valores sin
 *  que la especificidad del inline style entre en juego. */
const compactChipOverride = {
  padding: 'var(--hud-chip-padding-v) var(--hud-chip-padding-h)',
  fontSize: 'var(--hud-chip-font-size)',
};

// H5.2 spec §1 — mismo vocabulario que `ActionCategory` (`@collector/combat-scene`); unificado aquí
// (H5.5) en vez de mantener un tipo local duplicado.
type ControlId = ActionCategory;

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
 * H5.5 spec §3 — SUSTITUYE la decisión anterior de H4: "Jugar Carta"/"Activar Habilidad" dejaban de
 * ser botones accionables porque su gesto real vivía directamente en el canvas (tap en una carta de
 * mano / icono de habilidad), sin selección de categoría previa. Con la revelación progresiva de
 * H5.2, la elección de categoría es ahora un gesto EXPLÍCITO en el HUD — las 4 categorías (Jugar
 * Carta, Activar Habilidad, Generar Energía, Robar Carta) pasan a ser botones reales por igual en
 * fase `CATEGORY`, todos disparando `turnDecisionFlow.selectCategory(...)`. En fase `DETAIL`, la fila
 * de 4 controles se sustituye por una cabecera de contexto + botón "← Atrás".
 *
 * H4 spec §6 — rediseño de cromo sobre el sistema de diseño real: tipografía Staatliches/Manrope/
 * JetBrains Mono, paleta con nombre, contador de acciones destacado en `--foil`.
 */
export function CombatHud({ snapshot, bridge, onEndTurn, leaderName, leaderAbilities, turnDecisionFlow, stage }: CombatHudProps): JSX.Element {
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
        <span style={{ ...TYPE.displaySm, fontSize: 'var(--hud-title-size)', color: COLOR_TEXT_PRIMARY }}>
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

      {/* Paso previo gratuito — visualmente distinto de las 2 acciones pagadas (spec §6): no
          comparte el estado "gastado" de `actionsTakenThisTurn`, solo `leaderFreeStep`. Borde
          punteado `--rule` en vez del borde blanco sólido anterior (demasiado genérico/alto
          contraste sin relación con el sistema). */}
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

      {/* NUEVO H5.5 §3 — 2 acciones pagadas, ahora gobernadas por `stage` (revelación progresiva de
          H5.2). Fase CATEGORY: 4 botones reales, todos disparando `turnDecisionFlow.selectCategory`.
          Fase DETAIL: cabecera de contexto + "← Atrás" (`turnDecisionFlow.cancelDetail`). */}
      {stage.stage === 'CATEGORY' && (
        <div className="combat-hud-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--hud-gap)' }}>
          <button
            disabled={!canPlayCard}
            title={disabledReasonFor('PLAY_CARD', snapshot, leaderAbilities) ?? undefined}
            style={{ ...(canPlayCard ? enabledStyle : disabledStyle), ...compactChipOverride }}
            onClick={() => turnDecisionFlow?.selectCategory('PLAY_CARD')}
          >
            {isCompact ? 'Carta' : 'Jugar Carta'}
          </button>
          <button
            disabled={!canActivateAbility}
            title={disabledReasonFor('ACTIVATE_ABILITY', snapshot, leaderAbilities) ?? undefined}
            style={{ ...(canActivateAbility ? enabledStyle : disabledStyle), ...compactChipOverride }}
            onClick={() => turnDecisionFlow?.selectCategory('ACTIVATE_ABILITY')}
          >
            {isCompact ? 'Habilidad' : 'Activar Habilidad'}
          </button>
          <button
            disabled={!canGenerateEnergyPaid}
            title={disabledReasonFor('GENERATE_ENERGY', snapshot, leaderAbilities) ?? undefined}
            style={{ ...(canGenerateEnergyPaid ? enabledStyle : disabledStyle), ...compactChipOverride }}
            onClick={() => turnDecisionFlow?.selectCategory('GENERATE_ENERGY')}
          >
            {isCompact ? 'Energía' : 'Generar Energía'}
          </button>
          <button
            disabled={!canDrawCardPaid}
            title={disabledReasonFor('DRAW_CARD', snapshot, leaderAbilities) ?? undefined}
            style={{ ...(canDrawCardPaid ? enabledStyle : disabledStyle), ...compactChipOverride }}
            onClick={() => turnDecisionFlow?.selectCategory('DRAW_CARD')}
          >
            {isCompact ? 'Robar' : 'Robar Carta'}
          </button>
        </div>
      )}

      {stage.stage === 'DETAIL' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm }}>
          <span style={{ ...TYPE.labelUpper, color: COLOR_TEXT_SECONDARY }}>
            {stage.category === 'PLAY_CARD' ? 'Elige una carta' : 'Elige una habilidad'}
          </span>
          <button
            style={{ ...chipStyle(true), background: 'transparent' }}
            onClick={() => turnDecisionFlow?.cancelDetail()}
          >
            ← Atrás
          </button>
        </div>
      )}

      <button
        onClick={onEndTurn}
        disabled={snapshot.status !== 'IN_PROGRESS'}
        style={{
          ...(snapshot.status === 'IN_PROGRESS' ? enabledStyle : disabledStyle),
          ...compactChipOverride,
          marginTop: SPACING.sm,
        }}
      >
        Fin de turno
      </button>
    </div>
  );
}
