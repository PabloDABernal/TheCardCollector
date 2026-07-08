import type { ScenarioId } from '@collector/domain-shared';
import type { PhaseDefinition } from './phase';
import type { DramaturgiaCardDefinition } from './dramaturgia-card';
import type { AlternativeVictoryCondition } from './victory-condition'; // NUEVO H1.8+H1.18

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
  /**
   * NUEVO H1.11. El mazo de Dramaturgia PROPIO de este Escenario (GDD §5.1: "8 cartas de
   * Escenario (4 tipos × 2 copias) + 2 únicas" = 10) MÁS, por convención de contenido (no
   * de tipo — ver spec H1.11 §0.1), las cartas "comunes" (GDD §5.3) que este Escenario
   * aporta al mazo total de 30. Reutiliza `DramaturgiaCardDefinition` (H1.10) TAL CUAL —
   * el icono ATTACK/PLOT dispara la misma rama de `decideEnemyAbility` (domain/combat,
   * H1.7) independientemente de si la carta salió del mazo del Enemigo o del Escenario
   * (el Escenario nunca tiene habilidades propias que ejecutar — decisions.md: "Trama la
   * recibe el Escenario; daño lo recibe el Líder — habilidades separadas del Enemigo").
   * Ensamblaje del mazo de combate de 30 cartas (shuffle/robo/descarte, y deduplicación
   * real de las comunes compartidas con Enemigo) es H1.18 — ver spec H1.11 §0.3/§0.4 para
   * la deuda de diseño explícita sobre la fuente única de las cartas comunes.
   */
  readonly dramaturgiaDeck: readonly DramaturgiaCardDefinition[];
  /** NUEVO H1.8+H1.18. Ver `EnemyDefinition.alternativeVictoryConditions`. */
  readonly alternativeVictoryConditions?: readonly AlternativeVictoryCondition[];
  readonly universeSkin?: string;
}
