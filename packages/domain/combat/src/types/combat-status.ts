/**
 * NUEVO H1.18. Ver spec §0.6. Estado terminal del combate — `CombatEngine` empieza
 * SIEMPRE en `'IN_PROGRESS'` (constructor) y transiciona a exactamente uno de los 2
 * `CombatOutcome` de forma irreversible (nunca vuelve a `'IN_PROGRESS'`). Una vez
 * terminal, `dispatch()` rechaza cualquier comando nuevo con `COMBAT_ALREADY_ENDED`
 * (ver types/errors.ts).
 */
export type CombatOutcome = 'VICTORY' | 'DEFEAT';

/** Motivo de derrota — presente solo cuando `status === 'DEFEAT'` (ver spec §0.6).
 *  NUEVO H1.8+H1.18: `'ALTERNATIVE'` cuando el desenlace vino de una
 *  `AlternativeVictoryCondition` con `outcome: 'DEFEAT'`. */
export type DefeatReason = 'LEADER_HEALTH' | 'SCENARIO_PLOT' | 'ALTERNATIVE';

/**
 * Campos que `CombatStateSnapshot` incorpora a nivel raíz (ver spec §0.6) — no viven
 * anidados en un sub-objeto, para consistencia con el resto del snapshot.
 */
export interface CombatStatusSnapshot {
  readonly status: 'IN_PROGRESS' | CombatOutcome;
  /** Presente solo si `status === 'DEFEAT'`. */
  readonly defeatReason?: DefeatReason;
}
