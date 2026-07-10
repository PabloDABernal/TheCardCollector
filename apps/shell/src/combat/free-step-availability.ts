import type { CombatStateSnapshot } from '@collector/domain-combat';

const LEADER_ENERGY_MAX = 5; // GDD §2.2 / decisions.md — tope de Energía, mismo valor que el motor
const LEADER_HAND_SIZE_MAX = 7; // decisions.md "Tope de mano: 7"

/** H4 spec §1.3 — helper puro extraído de `CombatHud.tsx` (evitaba una tercera copia de la misma
 *  lógica cuando `TurnStartModal` la necesitó también, mismo criterio que `disabledReasonFor`). */
export interface FreeStepAvailability {
  readonly available: boolean; // isLeaderTurn && !takenThisTurn
  readonly canDraw: boolean; // available && !handFull && !deckEmpty
  readonly canGenerate: boolean; // available && !energyAtMax
  readonly handFull: boolean;
  readonly deckEmpty: boolean;
  readonly energyAtMax: boolean;
}

export function freeStepAvailabilityFor(snapshot: CombatStateSnapshot): FreeStepAvailability {
  const isLeaderTurn = snapshot.turn.turnOwner === 'LEADER' && snapshot.status === 'IN_PROGRESS';
  const handFull = snapshot.leaderHand.length >= LEADER_HAND_SIZE_MAX;
  const deckEmpty = snapshot.leaderDeckRemaining === 0;
  const energyAtMax = snapshot.leaderEnergy >= LEADER_ENERGY_MAX;

  const available = isLeaderTurn && !snapshot.leaderFreeStep.takenThisTurn;

  return {
    available,
    canDraw: available && !handFull && !deckEmpty,
    canGenerate: available && !energyAtMax,
    handFull,
    deckEmpty,
    energyAtMax,
  };
}
