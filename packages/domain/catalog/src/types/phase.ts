/**
 * Condición de cambio de fase (GDD §3.4: "Cambios según vida, turnos o condiciones").
 * Compartida por `EnemyDefinition`/`ScenarioDefinition` — ver validación específica por
 * colección en §3.5/§3.6 (Scenario no admite `HEALTH_BELOW_PERCENT`, no tiene vida).
 */
export type PhaseChangeCondition =
  | { readonly kind: 'HEALTH_BELOW_PERCENT'; readonly percent: number } // 0 < percent < 100
  | { readonly kind: 'TURN_COUNT_AT_LEAST'; readonly turn: number } // turn >= 1
  | { readonly kind: 'SCENARIO_PLOT_AT_LEAST'; readonly amount: number }; // amount >= 0

/**
 * Una fase con su condición de activación. `phaseNumber` es 1-based y debe ser
 * secuencial sin huecos ni duplicados dentro de una misma definición (validado en
 * `parseEnemyDefinition`/`parseScenarioDefinition`, §3.5/§3.6). Sin tope superior fijo —
 * ver spec §0.6.
 */
export interface PhaseDefinition {
  readonly phaseNumber: number;
  readonly changeCondition: PhaseChangeCondition;
}
