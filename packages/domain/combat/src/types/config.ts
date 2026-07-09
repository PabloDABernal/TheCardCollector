import type { RandomSource, AbilityId, CardId, CoreCostRequirement } from '@collector/domain-shared';
import type { PhaseDefinition } from '@collector/domain-catalog'; // NUEVO H1.17 — ver spec H1.17 §0.1
import type { CombatSide } from './turn';
import type { AbilityCooldownDefinition } from './cooldown';
import type { AbilityEffectDefinition } from './ability-effect';
import type { ContratiempoCardDefinition } from './contratiempo';
import type { AllyCardDefinition } from './ally';
import type { MinionDefinition, MinionDefinitionId } from './minion';
import type { PlayableCardDefinition } from './playable-card'; // NUEVO H1.18
import type { EnemyAbilityAiProfile } from './enemy-ai'; // NUEVO H1.18
import type { DramaturgiaCardDefinition } from '@collector/domain-catalog'; // MODIFICADO H1.16 — carta completa, no solo icono
import type { AlternativeVictoryCondition } from './victory-condition'; // NUEVO H1.8+H1.18

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

  /** NUEVO H3.4. Tope duro de dados simultáneos en mesa (5 fijos + extras hasta este
   *  tope). Default `DEFAULT_NUCLEO_TABLE_MAX_DICE` (10). Sustituye a `poolSize`
   *  (ELIMINADO — ya no hay "tamaño de pool" configurable, son 5 fijos + extras). */
  readonly tableMaxDice?: number;

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

  /** NUEVO §3.10.3. Tope duro de `minionsInPlay.length`. Default
   *  `DEFAULT_MAX_MINIONS_IN_PLAY` (3). Exceder el tope es no-op silencioso —
   *  `SUMMON_MINION` emite `MINION_SUMMON_SKIPPED` en vez de mutar `minionsInPlay`. */
  readonly maxMinionsInPlay?: number;

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
   * Mirror de `EnemyDefinition.maxHealth`. Hasta H1.17 era opcional-condicional (solo
   * necesario para evaluar `HEALTH_BELOW_PERCENT`) — NUEVO H1.18: pasa a ser
   * OBLIGATORIO siempre, porque la condición de victoria (`enemyDamage >=
   * enemyMaxHealth`, ver spec H1.18 §0.3/§0.6) lo necesita en todo momento, no solo
   * cuando hay fases de esa condición. El constructor sigue validando el mismo rango,
   * entero en `(0, 100]` (GDD §3.4).
   */
  readonly enemyMaxHealth: number;

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

  /**
   * NUEVO H1.18. Cartas EVENTO/EQUIPO jugables vía `PLAY_CARD` — ver spec §0.1. Default
   * `Map` vacío — sin PLAY_CARD jugable si se omite. Resuelto externamente, mismo patrón
   * que `allyCards`/`contratiempoCards`.
   */
  readonly playableCards?: ReadonlyMap<CardId, PlayableCardDefinition>;

  /**
   * NUEVO H1.18. Vida máxima del Líder (mirror de `LeaderDefinition.maxHealth`, ver spec
   * §0.3) — OBLIGATORIO, sin default: la condición de derrota (`leaderDamage >=
   * leaderMaxHealth`) lo necesita siempre. Entero en `(0, 100]`, mismo criterio que
   * `enemyMaxHealth`.
   */
  readonly leaderMaxHealth: number;

  /**
   * NUEVO H1.18. "Umbral final" de Trama ya resuelto externamente como
   * `Math.max(...scenario.plotThresholds.map(t => t.atLeast))` (ver spec §0.4) —
   * OBLIGATORIO, entero > 0. El motor no interpreta la forma cruda de
   * `ScenarioDefinition.plotThresholds`, solo consume este valor ya resuelto.
   */
  readonly scenarioPlotDefeatThreshold: number;

  /**
   * NUEVO H1.18. Perfiles de IA de las habilidades del Enemigo (ver spec §0.5) —
   * activa el turno de IA automático de `handleEndTurn` si y solo si este mapa Y
   * `dramaturgiaDeck` son ambos no-vacíos. Default `Map` vacío.
   */
  readonly enemyAbilityAiProfiles?: ReadonlyMap<AbilityId, EnemyAbilityAiProfile>;

  /**
   * NUEVO H1.18. MODIFICADO H1.16 (rediseño de Secuaces): pasa de solo-icono a la carta
   * COMPLETA — `RESOLVE_MINION_ACTION` necesita leer `minionBehavior` en el momento de
   * resolución. Se copia y baraja una vez en el constructor. Default `[]`.
   */
  readonly dramaturgiaDeck?: readonly DramaturgiaCardDefinition[];

  /**
   * NUEVO H3.6. IDs de TODAS las cartas jugables del Líder (unión de playableCards +
   * allyCards + contratiempoCards) de las que se compone el mazo de robo de este
   * combate. Se baraja UNA VEZ en el constructor (mismo `shuffle` Fisher-Yates ya usado
   * para `dramaturgiaDeck`). OBLIGATORIO — sin mazo no hay mano inicial.
   */
  readonly leaderDeckCardIds: readonly CardId[];

  /** NUEVO H3.6. Default `LEADER_INITIAL_HAND_SIZE` (5). */
  readonly initialHandSize?: number;

  /** NUEVO H3.6. Default `LEADER_HAND_SIZE_MAX` (7). */
  readonly handSizeMax?: number;

  /**
   * NUEVO H1.8+H1.18. Condiciones de victoria/derrota alternativas — merge de
   * `EnemyDefinition.alternativeVictoryConditions` + `ScenarioDefinition.
   * alternativeVictoryConditions` (Enemigo primero). Default `[]`.
   */
  readonly alternativeVictoryConditions?: readonly AlternativeVictoryCondition[];
}
