import type { ScenarioId } from '@collector/domain-shared';
import type { PhaseDefinition } from './phase';

/**
 * GDD §3.6: "Efectos variables por umbrales escalados (peores cuanto más alto)".
 * Modelado con `description` libre en vez de una unión de efectos ejecutables — el GDD
 * no especifica el mecanismo numérico exacto todavía (ver spec §0.7, punto 2, ambigüedad
 * declarada para Game Designer antes de H1.11).
 */
export interface ScenarioPlotThreshold {
  /** Contador de Trama mínimo (inclusive) a partir del cual se activa. */
  readonly atLeast: number;
  readonly description: string;
}

/** GDD §3.6: "pasivos siempre activos". Mismo tratamiento que `ScenarioPlotThreshold`. */
export interface ScenarioPassiveEffect {
  readonly description: string;
}

export interface ScenarioDefinition {
  readonly id: ScenarioId;
  readonly name: string;
  readonly plotThresholds: readonly ScenarioPlotThreshold[];
  readonly passives: readonly ScenarioPassiveEffect[];
  /** GDD §3.4 aplica también a Escenario (decisions.md: "Enemigos y Escenarios suelen
   *  tener 2 fases cada uno"). Reutiliza `PhaseDefinition`, pero con `changeCondition`
   *  restringido a `TURN_COUNT_AT_LEAST` | `SCENARIO_PLOT_AT_LEAST` — nunca
   *  `HEALTH_BELOW_PERCENT` (el Escenario no tiene vida) — ver §3.6. */
  readonly phases: readonly PhaseDefinition[];
  readonly universeSkin?: string;
}
