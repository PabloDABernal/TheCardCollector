import type { RandomSource, AbilityId, CoreCostRequirement } from '@collector/domain-shared';
import type { CombatSide } from './turn';

export interface CombatEngineConfig {
  readonly randomSource: RandomSource;

  /**
   * Resuelto externamente (hoy: por quien instancia el motor en tests; en H1.18: por
   * el código de integración a partir de `CatalogLoader`, ver §0.2). Si una habilidad
   * no aparece en este mapa, `ACTIVATE_ABILITY` para ese `abilityId` falla con
   * `ABILITY_COST_UNKNOWN`.
   */
  readonly abilityCoreCosts: ReadonlyMap<AbilityId, CoreCostRequirement>;

  /** Placeholder no-definitivo si se omite — ver DEFAULT_NUCLEO_POOL_SIZE y nota §0.3. */
  readonly poolSize?: number;

  /** Por defecto 'LEADER' (GDD §2.2 describe el turno del jugador primero). */
  readonly initialTurnOwner?: CombatSide;
}
