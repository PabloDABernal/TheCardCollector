import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatStateSnapshot } from '@collector/domain-combat';

export interface CombatHudProps {
  readonly snapshot: CombatStateSnapshot;
  readonly bridge: CombatBridge; // NUEVO H3.5 — dispatch directo de los controles de decisión de turno
  readonly onEndTurn: () => void;
  readonly leaderName: string; // NUEVO H2.14
}

const LEADER_ENERGY_MAX = 5; // GDD §2.2 / decisions.md — tope de Energía, mismo valor que el motor
const LEADER_HAND_SIZE_MAX = 7; // decisions.md "Tope de mano: 7"

/**
 * "Chrome" no-juice sobre el canvas (`architecture_stack.md` §2.3) — vida/Trama/turno YA se
 * muestran dentro del canvas vía `role-view.ts` (H2.8); este HUD React NO duplica ese texto.
 *
 * NUEVO H3.5 (spec §6, "5 controles + paso previo") — decisions.md fija la estructura del turno del
 * Líder como "paso previo gratis + 2 acciones", y esta historia amplía H3.5 de 3 a 5 controles
 * visibles: Jugar Carta, Activar Habilidad, Generar Energía (pagada), Robar Carta (pagada), más el
 * paso previo gratuito (Robar/Energía gratis), visualmente distinto porque NO consume ninguna de
 * las 2 acciones del turno.
 *
 * Decisión de implementación (no trivial, documentada): "Jugar Carta" y "Activar Habilidad" no son
 * botones accionables desde este HUD — su gesto real ya vive en el canvas de Phaser (tap en una
 * carta de la mano / tap en un icono de habilidad, `gesture-command-translator.ts`). Aquí se
 * muestran como INDICADORES de disponibilidad (mismo criterio de estado activo/deshabilitado que
 * pide la spec), no como controles que despachen un comando por sí mismos — evita duplicar un
 * segundo mecanismo de selección de carta/objetivo/Núcleo fuera del tablero. "Generar Energía" y
 * "Robar Carta" (pagadas) SÍ son botones accionables aquí porque no requieren ninguna selección
 * adicional (sin objetivo, sin Núcleo) — igual que el paso previo gratuito.
 */
export function CombatHud({ snapshot, bridge, onEndTurn, leaderName }: CombatHudProps): JSX.Element {
  const isLeaderTurn = snapshot.turn.turnOwner === 'LEADER' && snapshot.status === 'IN_PROGRESS';
  const hasActionsRemaining = snapshot.actions.actionsTaken < snapshot.actions.actionsAllowed;
  const canAct = isLeaderTurn && hasActionsRemaining;

  const handEmpty = snapshot.leaderHand.length === 0;
  const handFull = snapshot.leaderHand.length >= LEADER_HAND_SIZE_MAX;
  const deckEmpty = snapshot.leaderDeckRemaining === 0;
  const energyAtMax = snapshot.leaderEnergy >= LEADER_ENERGY_MAX;
  const hasAvailableDie = snapshot.nucleoTable.some((die) => die.status === 'AVAILABLE');
  const hasAbilityReady = snapshot.cooldowns.some((cd) => cd.side === 'LEADER' && cd.remaining === 0);

  const canPlayCard = canAct && !handEmpty;
  const canActivateAbility = canAct && hasAvailableDie && hasAbilityReady;
  const canGenerateEnergyPaid = canAct && !energyAtMax;
  const canDrawCardPaid = canAct && !handFull && !deckEmpty;

  const freeStepAvailable = isLeaderTurn && !snapshot.leaderFreeStep.takenThisTurn;
  const canFreeDraw = freeStepAvailable && !handFull && !deckEmpty;
  const canFreeGenerate = freeStepAvailable && !energyAtMax;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }} className="combat-hud">
      <p>Líder: {leaderName}</p>

      {/* Paso previo gratuito — visualmente distinto de las 2 acciones pagadas (spec §6): no
          comparte el estado "gastado" de `actionsTakenThisTurn`, solo `leaderFreeStep`. */}
      <div className="combat-hud-free-step" style={{ border: '1px dashed #ffffff', padding: '4px', margin: '4px 0' }}>
        <span>Paso previo (gratis)</span>
        <button
          disabled={!canFreeDraw}
          onClick={() => bridge.dispatch({ type: 'DRAW_OR_GENERATE', action: 'draw' })}
        >
          Robar carta (gratis)
        </button>
        <button
          disabled={!canFreeGenerate}
          onClick={() => bridge.dispatch({ type: 'DRAW_OR_GENERATE', action: 'generate' })}
        >
          Generar energía (gratis)
        </button>
      </div>

      {/* 2 acciones pagadas — 4 opciones, decisions.md "Estructura del turno del jugador". */}
      <div className="combat-hud-actions">
        <span aria-disabled={!canPlayCard} style={{ opacity: canPlayCard ? 1 : 0.4 }}>
          Jugar Carta
        </span>
        <span aria-disabled={!canActivateAbility} style={{ opacity: canActivateAbility ? 1 : 0.4 }}>
          Activar Habilidad
        </span>
        <button disabled={!canGenerateEnergyPaid} onClick={() => bridge.dispatch({ type: 'GENERATE_ENERGY' })}>
          Generar Energía
        </button>
        <button disabled={!canDrawCardPaid} onClick={() => bridge.dispatch({ type: 'DRAW_CARD' })}>
          Robar Carta
        </button>
      </div>

      <button onClick={onEndTurn} disabled={snapshot.status !== 'IN_PROGRESS'}>
        Fin de turno
      </button>
    </div>
  );
}
