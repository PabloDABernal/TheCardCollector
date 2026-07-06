import type { RandomSource, AbilityId, CardId, CoreCostRequirement } from '@collector/domain-shared';
import type { PhaseDefinition } from '@collector/domain-catalog'; // NUEVO H1.17 — ver spec H1.17 §0.1
import type { CombatSide } from './turn';
import type { AbilityCooldownDefinition } from './cooldown';
import type { AbilityEffectDefinition } from './ability-effect';
import type { ContratiempoCardDefinition } from './contratiempo';
import type { AllyCardDefinition } from './ally';
import type { MinionDefinition, MinionDefinitionId } from './minion';

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

  /**
   * NUEVO en H1.6. Mapa OPCIONAL (a diferencia de `abilityCoreCosts`/`abilityCooldowns`,
   * que son obligatorios) — no toda habilidad tiene todavía un efecto numérico
   * modelado; una habilidad ausente de este mapa simplemente no muta
   * `leaderDamage`/`leaderShield`/`scenarioPlot` al activarse (comportamiento idéntico
   * a H1.3-H1.5). Si se omite por completo, equivale a un `Map` vacío. Toda clave
   * presente aquí DEBE existir también en `abilityCoreCosts`/`abilityCooldowns` — el
   * constructor lanza si no (ver combat-engine.ts, `validateAbilityEffectsConfig`).
   * Ver spec H1.6 §0.2.
   */
  readonly abilityEffects?: ReadonlyMap<AbilityId, AbilityEffectDefinition>;

  /**
   * NUEVO en H1.6. Valor inicial de `leaderShield` (GDD §2.8) al construir el motor.
   * Entero en `[0, LEADER_SHIELD_MAX]`; el constructor lanza si está fuera de rango o
   * no es entero. Por defecto `0` si se omite. Es el único mecanismo de esta historia
   * para poblar Escudo — no existe todavía ninguna habilidad/carta "Defensa X" que lo
   * genere en runtime (contenido futuro, no bloqueante — ver spec §0.1).
   */
  readonly initialLeaderShield?: number;

  /**
   * NUEVO H1.14. Habilidades (siempre `side: 'LEADER'`, validado en el constructor —
   * ver spec §0.2) que generan Combo al activarse con éxito. Default: `Set` vacío.
   */
  readonly abilityCombo?: ReadonlySet<AbilityId>;

  /**
   * NUEVO H1.14. Cartas CONTRATIEMPO jugables vía `PLAY_CONTRATIEMPO`. Default: `Map` vacío.
   */
  readonly contratiempoCards?: ReadonlyMap<CardId, ContratiempoCardDefinition>;

  /**
   * NUEVO H1.14. Energía inicial del Líder (decisions.md: "1"). Entero en
   * `[0, LEADER_ENERGY_MAX]`; el constructor lanza si está fuera de rango.
   */
  readonly initialLeaderEnergy?: number;

  /**
   * NUEVO H1.15. Cartas ALIADO jugables vía `PLAY_ALLY`. Default: `Map` vacío. Resuelto
   * externamente, igual patrón que `contratiempoCards` — ver spec H1.15 §0.1/§0.5.
   */
  readonly allyCards?: ReadonlyMap<CardId, AllyCardDefinition>;

  /**
   * NUEVO H1.16. Definiciones de Secuaz jugables vía `SUMMON_MINION`. Default: `Map`
   * vacío. Resuelto externamente, mismo patrón que `allyCards`/`contratiempoCards` —
   * ver spec H1.16 §0.1/§3.5. El constructor valida `planoAttackAmount`/
   * `specialActionAbilityId` (`validateMinionDefinitionsConfig`).
   */
  readonly minionDefinitions?: ReadonlyMap<MinionDefinitionId, MinionDefinition>;

  /**
   * NUEVO H1.17. Fases del Enemigo activo (GDD §3.4, `EnemyDefinition.phases`,
   * `domain-catalog`, H1.8/H1.10 — reutilizado tal cual, ver spec H1.17 §0.1). Default
   * `[]` (sin fases = ningún PHASE_CHANGED de origen ENEMY se emite nunca — ver §0.2).
   * Si alguna entrada usa `changeCondition.kind === 'HEALTH_BELOW_PERCENT'`,
   * `enemyMaxHealth` pasa a ser obligatorio (el constructor lanza si falta).
   */
  readonly enemyPhases?: readonly PhaseDefinition[];

  /**
   * NUEVO H1.17. Fases del Escenario activo (GDD §3.6, `ScenarioDefinition.phases`).
   * Default `[]`. `HEALTH_BELOW_PERCENT` no es una condición válida aquí — ya bloqueado
   * en origen por `parseScenarioDefinition` (H1.8); el constructor de `CombatEngine` lo
   * revalida localmente por defensividad (ver spec §3.2).
   */
  readonly scenarioPhases?: readonly PhaseDefinition[];

  /**
   * NUEVO H1.17. Mirror de `EnemyDefinition.maxHealth` — SOLO necesario para evaluar
   * `HEALTH_BELOW_PERCENT` (ver spec H1.17 §0.3). Obligatorio si y solo si alguna
   * entrada de `enemyPhases` usa ese `changeCondition.kind`; el constructor lanza si
   * falta en ese caso. Sin efecto alguno si ningún `enemyPhases` lo necesita.
   */
  readonly enemyMaxHealth?: number;

  /**
   * NUEVO H1.17. Valor inicial de `enemyDamage` (ver spec H1.17 §0.3 — "dato en
   * reposo", mismo tratamiento que `initialLeaderShield`, H1.6). Default `0`. Entero en
   * `[0, enemyMaxHealth]` (si `enemyMaxHealth` está definido; si no, solo se exige
   * entero >= 0). Ningún comando de esta historia lo muta en runtime.
   */
  readonly initialEnemyDamage?: number;

  /**
   * NUEVO H1.17. Valor inicial de `levelUpsSpent` (decisions.md: "contador único por
   * run" — permite que un combate posterior de la misma run arranque con Level-Ups ya
   * ganados en un combate/descanso previo). Default `0`. Entero en `[0,
   * LEADER_LEVEL_UPS_MAX]`; el constructor lanza si está fuera de rango.
   */
  readonly initialLeaderLevelUpsSpent?: number;
}
