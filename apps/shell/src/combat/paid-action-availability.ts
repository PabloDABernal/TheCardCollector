import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { AbilityViewData } from '@collector/combat-scene';
import { isAnyLeaderAbilityActivatable } from '@collector/combat-scene';

const LEADER_ENERGY_MAX = 5; // GDD §2.2 / decisions.md — tope de Energía, mismo valor que el motor
const LEADER_HAND_SIZE_MAX = 7; // decisions.md "Tope de mano: 7"

/** H5.5 spec (corrección 2026-07-13) §7 — helper puro compartido, extraído de lo que antes vivía
 *  inline y duplicado dentro de `CombatHud.tsx` (mismo criterio de extracción que
 *  `free-step-availability.ts`, H4 §1.3). Consumido por `SideActionRail` (H5.7) y por
 *  `useAutoEndTurn` (H5.9, `anyAvailable` para detectar deadlock). */
export interface PaidActionAvailability {
  readonly canPlayCard: boolean;
  readonly canActivateAbility: boolean;
  readonly canGenerateEnergy: boolean;
  readonly canDrawCard: boolean;
  /** `true` si CUALQUIERA de las 4 anteriores es `true`. */
  readonly anyAvailable: boolean;
}

export function paidActionAvailabilityFor(
  snapshot: CombatStateSnapshot,
  leaderAbilities: readonly AbilityViewData[],
): PaidActionAvailability {
  const isLeaderTurn = snapshot.turn.turnOwner === 'LEADER' && snapshot.status === 'IN_PROGRESS';
  const hasActionsRemaining = snapshot.actions.actionsTaken < snapshot.actions.actionsAllowed;
  const canAct = isLeaderTurn && hasActionsRemaining;

  const handEmpty = snapshot.leaderHand.length === 0;
  const handFull = snapshot.leaderHand.length >= LEADER_HAND_SIZE_MAX;
  const deckEmpty = snapshot.leaderDeckRemaining === 0;
  const energyAtMax = snapshot.leaderEnergy >= LEADER_ENERGY_MAX;

  const canPlayCard = canAct && !handEmpty;
  // FIX Reviewer post-H3 (commit `cce72a3`) — cruza color de dado libre real contra `coreCost` de
  // cada habilidad lista, mismo criterio que `gesture-command-translator.ts` (`satisfiesCoreCost`).
  const canActivateAbility = canAct && isAnyLeaderAbilityActivatable(snapshot, leaderAbilities);
  const canGenerateEnergy = canAct && !energyAtMax;
  const canDrawCard = canAct && !handFull && !deckEmpty;

  return {
    canPlayCard,
    canActivateAbility,
    canGenerateEnergy,
    canDrawCard,
    anyAvailable: canPlayCard || canActivateAbility || canGenerateEnergy || canDrawCard,
  };
}
