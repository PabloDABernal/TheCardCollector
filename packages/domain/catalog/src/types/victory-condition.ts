/**
 * NUEVO H1.8+H1.18. Mirror estructural de `@collector/domain-combat`'s
 * `AlternativeVictoryCondition` — catalog no puede importar combat.
 *
 * Vocabulario CERRADO para el MVP.
 */
export type AlternativeVictoryCondition =
  | { readonly kind: 'SCENARIO_PLOT_AT_MOST'; readonly amount: number; readonly outcome: 'VICTORY' | 'DEFEAT' }
  | { readonly kind: 'TURN_COUNT_AT_LEAST'; readonly turn: number; readonly outcome: 'VICTORY' | 'DEFEAT' }
  | { readonly kind: 'ENEMY_DAMAGE_AT_LEAST'; readonly amount: number; readonly outcome: 'VICTORY' | 'DEFEAT' };
