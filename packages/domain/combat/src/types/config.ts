import type { RandomSource, AbilityId, CoreCostRequirement } from '@collector/domain-shared';
import type { CombatSide } from './turn';
import type { AbilityCooldownDefinition } from './cooldown';

export interface CombatEngineConfig {
  readonly randomSource: RandomSource;

  /**
   * Resuelto externamente (hoy: por quien instancia el motor en tests; en H1.18: por
   * el código de integración a partir de `CatalogLoader`, ver §0.2). Si una habilidad
   * no aparece en este mapa, `ACTIVATE_ABILITY` para ese `abilityId` falla con
   * `ABILITY_COST_UNKNOWN`.
   */
  readonly abilityCoreCosts: ReadonlyMap<AbilityId, CoreCostRequirement>;

  /**
   * NUEVO en H1.4. Resuelto externamente igual que `abilityCoreCosts` (H1.3 §0.2; H1.8
   * todavía no existe). El constructor de `CombatEngine` EXIGE que las claves de este
   * mapa coincidan EXACTAMENTE con las de `abilityCoreCosts` (toda habilidad con coste
   * conocido debe tener CD rastreado, y viceversa) — lanza `Error` si no coinciden.
   * Ver combat-engine.ts, `validateAbilityCooldownsConfig`.
   */
  readonly abilityCooldowns: ReadonlyMap<AbilityId, AbilityCooldownDefinition>;

  /** Placeholder no-definitivo si se omite — ver DEFAULT_NUCLEO_POOL_SIZE y nota §0.3. */
  readonly poolSize?: number;

  /** Por defecto 'LEADER' (GDD §2.2 describe el turno del jugador primero). */
  readonly initialTurnOwner?: CombatSide;
}
