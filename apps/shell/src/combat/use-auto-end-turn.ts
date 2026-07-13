import { useEffect, useRef } from 'react';
import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { AbilityViewData } from '@collector/combat-scene';
import { paidActionAvailabilityFor } from './paid-action-availability';

/**
 * H5.9 §3.2 — fin de turno automático: retira el botón manual "Fin de turno" (H5.5 corrección §5).
 * Termina el turno del Líder al agotar sus 2 acciones (`actionsTaken >= actionsAllowed`) — condición
 * literal del encargo del Director Creativo. También cubre `noLegalActionLeft` (adición del Architect,
 * decisions.md/H5.9 §3.2 y §5): caso borde de deadlock donde la cuota de acciones NO está agotada pero
 * ninguna de las 4 acciones pagadas es ejecutable (Energía al tope + mano llena + mazo vacío + toda
 * habilidad en cooldown/sin Núcleo). Sin esta segunda condición, retirar el botón manual dejaría al
 * jugador sin ninguna vía de escape en ese caso infrecuente pero posible.
 */
export function useAutoEndTurn(
  bridge: CombatBridge,
  snapshot: CombatStateSnapshot,
  leaderAbilities: readonly AbilityViewData[],
): void {
  const dispatchedForTurnRef = useRef<number | null>(null);

  useEffect(() => {
    const isLeaderTurn = snapshot.turn.turnOwner === 'LEADER' && snapshot.status === 'IN_PROGRESS';
    if (!isLeaderTurn) return;
    if (dispatchedForTurnRef.current === snapshot.turn.turnNumber) return; // ya disparado este turno

    const actionsExhausted = snapshot.actions.actionsTaken >= snapshot.actions.actionsAllowed;
    const availability = paidActionAvailabilityFor(snapshot, leaderAbilities);
    const noLegalActionLeft = !availability.anyAvailable;

    if (actionsExhausted || noLegalActionLeft) {
      dispatchedForTurnRef.current = snapshot.turn.turnNumber;
      bridge.dispatch({ type: 'END_TURN' });
    }
  }, [bridge, snapshot, leaderAbilities]);
}
