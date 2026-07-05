import type { NucleoInstance } from './nucleo';
import type { TurnState } from './turn';

/**
 * Slice de H1.3 de `CombatStateSnapshot` (architecture_stack.md §2.2). Historias
 * futuras EXTIENDEN esta misma interfaz con campos nuevos, nunca quitan `turn`/`nucleoPool`:
 *  - H1.4 añade cooldowns.
 *  - H1.6 añade `leaderDamage`/`scenarioPlot`.
 *  - H1.17 añade nivel/level-ups del Líder.
 *  - H1.18 la compone con el resto de estado (Energía, mano, mesa...).
 */
export interface CombatStateSnapshot {
  readonly turn: TurnState;
  readonly nucleoPool: readonly NucleoInstance[];
}
