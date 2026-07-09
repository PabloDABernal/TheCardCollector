/**
 * NUEVO H1.8+H1.18 (condiciones alternativas). Mirror estructural de
 * `@collector/domain-catalog`'s `AlternativeVictoryCondition` — mismo patrón de
 * duplicación por dirección de dependencia que `minion-behavior.ts` (`catalog` nunca
 * importa `combat`).
 *
 * Vocabulario CERRADO para el MVP — extender esta unión (y su evaluación en
 * `combat-engine.ts`, `isAlternativeConditionMet`) es la única forma de añadir un nuevo
 * `kind`; nunca texto libre interpretado en runtime.
 */
export type AlternativeVictoryCondition =
  | { readonly kind: 'SCENARIO_PLOT_AT_MOST'; readonly amount: number; readonly outcome: 'VICTORY' | 'DEFEAT' }
  | { readonly kind: 'TURN_COUNT_AT_LEAST'; readonly turn: number; readonly outcome: 'VICTORY' | 'DEFEAT' }
  | { readonly kind: 'ENEMY_DAMAGE_AT_LEAST'; readonly amount: number; readonly outcome: 'VICTORY' | 'DEFEAT' };
