import {
  createEventBus,
  ok,
  err,
  satisfiesCoreCost,
  createId,
  type EventBus,
  type Unsubscribe,
  type NucleoInstanceId,
  type RandomSource,
  type AbilityId,
  type CardId,
  type CardInstanceId,
  type CoreCostRequirement,
  type NucleoColor,
} from '@collector/domain-shared';
import type { CombatCommand } from './types/commands';
import type { CombatEvent } from './types/events';
import type { CombatCommandResult } from './types/errors';
import type { CombatStateSnapshot } from './types/snapshot';
import type { CombatEngineConfig } from './types/config';
import type { CombatSide } from './types/turn';
import type { NucleoInstance, NucleoDie } from './types/nucleo';
import type { AbilityCooldownDefinition, AbilityCooldownSnapshot } from './types/cooldown';
import { ABILITY_BASE_COOLDOWN_MIN } from './types/cooldown';
import type { AbilityEffectDefinition } from './types/ability-effect'; // NUEVO H1.6
import { LEADER_SHIELD_MAX } from './types/ability-effect'; // NUEVO H1.6
import { resolveAbilityUmbral } from './umbral'; // NUEVO H1.6 — conecta H1.5 con mutación real (spec §0.2)
import type { UmbralFormula } from './types/umbral';
import { rollFixedDice, rollExtraDie, rerollAllDice, countAvailableDice, DEFAULT_NUCLEO_TABLE_MAX_DICE } from './nucleo-table'; // MODIFICADO H3.4
import { baseActionsForSide, COMBO_MAX_BONUS_ACTIONS_PER_TURN } from './types/action'; // NUEVO H1.14
import { LEADER_ENERGY_MAX, LEADER_ENERGY_INITIAL_DEFAULT } from './types/energy'; // NUEVO H1.14
import type {
  ContratiempoCardDefinition,
  UndoableEnemyActionLogEntry,
} from './types/contratiempo'; // NUEVO H1.14
import type { AllyCardDefinition, AllyInPlay } from './types/ally'; // NUEVO H1.15
import type { MinionDefinition, MinionDefinitionId, MinionInPlay } from './types/minion'; // NUEVO H1.16
import {
  poolHasValidNucleo,
  decideEnemyNucleoToSpend,
  derivePlayerColorsFromLeaderAbilities,
  decideEnemyAbility, // NUEVO H1.18
  validateEnemyAbilityAiProfiles, // NUEVO H1.18
} from './enemy-ai'; // NUEVO H1.16, reusa H1.7
import type { EnemyAbilityAiProfile, EnemyAbilityCandidate, DramaturgiaCardIcon } from './types/enemy-ai'; // NUEVO H1.18, reusa H1.7
import type { PhaseDefinition, PhaseChangeCondition, DramaturgiaCardDefinition } from '@collector/domain-catalog'; // NUEVO H1.17 — ver spec H1.17 §0.1; DramaturgiaCardDefinition MODIFICADO H1.16
import { LEADER_LEVEL_BASE, LEADER_LEVEL_UPS_MAX } from './types/leader-state'; // NUEVO H1.17
import type { PlayableCardDefinition, PlayableCardEffectDefinition } from './types/playable-card'; // NUEVO H1.18
import type { CombatOutcome, DefeatReason } from './types/combat-status'; // NUEVO H1.18
import { selectActingMinions } from './minion-ai'; // NUEVO H1.16 (rediseño)
import type { AttackTarget } from './types/combat-target'; // NUEVO §3.9.2
import type { AlternativeVictoryCondition } from './types/victory-condition'; // NUEVO H1.8+H1.18
import { LEADER_INITIAL_HAND_SIZE, LEADER_HAND_SIZE_MAX } from './types/hand'; // NUEVO H3.6
import type { LeaderFreeStepState } from './types/turn-phase'; // NUEVO H3.6

/**
 * NUEVO H1.16 — fuente mínima común para armar `LEADER_DAMAGED`/`ALLY_DAMAGED`/
 * `SCENARIO_PLOT_CHANGED` sin depender de un `ACTIVATE_ABILITY` completo (ver spec
 * H1.16 §4.4, nota de refactor). `abilityId` está ausente para un ataque plano/pasivo
 * de Secuaz (sin habilidad de catálogo detrás).
 */
interface AbilityActionSource {
  readonly abilityId?: AbilityId;
  readonly sourceId: string;
  readonly side: CombatSide;
}

export class CombatEngine {
  private readonly randomSource: RandomSource;
  private readonly abilityCoreCosts: ReadonlyMap<AbilityId, CoreCostRequirement>;
  private readonly abilityCooldowns: ReadonlyMap<AbilityId, AbilityCooldownDefinition>;
  private readonly abilityEffects: ReadonlyMap<AbilityId, AbilityEffectDefinition>; // NUEVO H1.6
  private readonly tableMaxDice: number; // MODIFICADO H3.4 — antes poolSize
  private readonly eventBus: EventBus<CombatEvent>;

  private turnOwner: CombatSide;
  private turnNumber: number;
  private nucleoTable: NucleoDie[]; // MODIFICADO H3.4 — antes nucleoPool: NucleoInstance[]
  private nucleoIdCounter: number;
  /** CD restante actual por abilityId. Contiene una entrada por cada clave de
   *  `abilityCooldowns` desde la construcción (Calentamiento, GDD §2.5). */
  private remainingCooldowns: Map<AbilityId, number>;

  // NUEVO H1.6 — ver spec §0.5, §0.1, §0.4 respectivamente.
  private leaderDamage: number;
  private leaderShield: number;
  private scenarioPlot: number;

  // NUEVO H1.14 — ver spec §0.1/§0.2/§0.4.
  private readonly abilityCombo: ReadonlySet<AbilityId>;
  private readonly contratiempoCards: ReadonlyMap<CardId, ContratiempoCardDefinition>;

  private leaderEnergy: number;

  private actionsTakenThisTurn: number;
  private actionsAllowedThisTurn: number;
  private comboBonusGrantedThisTurn: boolean;
  private abilityIdsActivatedThisTurn: Set<AbilityId>;

  private currentEnemyTurnLog: UndoableEnemyActionLogEntry[];
  private previousEnemyTurnLog: UndoableEnemyActionLogEntry[];

  // NUEVO H1.15 — ver spec H1.15 §0.1/§0.2/§0.3.
  private readonly allyCards: ReadonlyMap<CardId, AllyCardDefinition>;
  private alliesInPlay: AllyInPlay[];
  private activeDamageRedirectTargetId: CardInstanceId | null;
  private cardInstanceIdCounter: number;

  // NUEVO H1.16 — ver spec H1.16 §0.1/§0.3/§4.1.
  private readonly minionDefinitions: ReadonlyMap<MinionDefinitionId, MinionDefinition>;
  private minionsInPlay: MinionInPlay[];
  private minionActionResolvedThisEnemyTurn: boolean;
  private minionInstanceIdCounter: number;

  // NUEVO H3.6 — ver spec §2.
  private leaderHand: CardId[];
  private leaderDeckDrawPile: CardId[];
  private readonly handSizeMax: number;
  private leaderFreeStepTakenThisTurn: boolean;

  // NUEVO H1.8+H1.18 — ver spec §4.
  private readonly alternativeVictoryConditions: readonly AlternativeVictoryCondition[];

  // NUEVO H1.17 — ver spec H1.17 §0.1/§0.3.
  private readonly enemyPhases: readonly PhaseDefinition[];
  private readonly scenarioPhases: readonly PhaseDefinition[];
  private readonly enemyMaxHealth: number; // NUEVO H1.18 — pasa de opcional a obligatorio, ver spec §0.3
  private enemyPhaseIndex: number; // 0-based, índice dentro de enemyPhases
  private scenarioPhaseIndex: number; // 0-based, índice dentro de scenarioPhases
  private enemyDamage: number; // "dato en reposo", ver §0.3

  // NUEVO H1.17 — ver spec §0.6. `level` se deriva de este único contador.
  private leaderLevelUpsSpent: number;

  // NUEVO H1.18 — ver spec H1.18 §0.1/§0.3.
  private readonly playableCards: ReadonlyMap<CardId, PlayableCardDefinition>;
  private readonly leaderMaxHealth: number;
  private readonly scenarioPlotDefeatThreshold: number;

  // NUEVO H1.18 — ver spec H1.18 §0.5/§0.6.
  private readonly enemyAbilityAiProfiles: ReadonlyMap<AbilityId, EnemyAbilityAiProfile>;
  private readonly enemyAiEnabled: boolean;
  private dramaturgiaDrawPile: DramaturgiaCardDefinition[]; // MODIFICADO H1.16 — antes DramaturgiaCardIcon[]
  private dramaturgiaDiscardPile: DramaturgiaCardDefinition[];
  private currentEnemyDramaturgiaCard: DramaturgiaCardDefinition | undefined; // NUEVO H1.16 (rediseño)

  private combatStatus: 'IN_PROGRESS' | CombatOutcome;
  private defeatReason: DefeatReason | undefined;

  constructor(config: CombatEngineConfig) {
    this.randomSource = config.randomSource;
    this.abilityCoreCosts = config.abilityCoreCosts;
    this.abilityCooldowns = config.abilityCooldowns;
    this.validateAbilityCooldownsConfig();

    this.abilityEffects = config.abilityEffects ?? new Map(); // NUEVO H1.6
    this.validateAbilityEffectsConfig(); // NUEVO H1.6

    this.tableMaxDice = config.tableMaxDice ?? DEFAULT_NUCLEO_TABLE_MAX_DICE;
    this.turnOwner = config.initialTurnOwner ?? 'LEADER';
    this.turnNumber = 1;
    this.nucleoIdCounter = 0;
    this.eventBus = createEventBus<CombatEvent>();

    // Calentamiento (GDD §2.5): todas las habilidades arrancan "como recién usadas",
    // es decir, con su CD restante en el máximo (= su CD base).
    this.remainingCooldowns = new Map<AbilityId, number>();
    for (const [abilityId, def] of this.abilityCooldowns) {
      this.remainingCooldowns.set(abilityId, def.baseCooldown);
    }

    // NUEVO H1.6 — estado inicial de daño/Trama/escudo. `leaderDamage`/`scenarioPlot`
    // SIEMPRE arrancan en 0 (ningún config knob para ellos, ver spec §0.4/§0.5).
    this.leaderDamage = 0;
    this.scenarioPlot = 0;
    const initialLeaderShield = config.initialLeaderShield ?? 0;
    this.validateInitialLeaderShield(initialLeaderShield); // NUEVO H1.6
    this.leaderShield = initialLeaderShield;

    // NUEVO H1.14 — resuelto igual que abilityCoreCosts/abilityCooldowns/abilityEffects.
    this.abilityCombo = config.abilityCombo ?? new Set();
    this.validateAbilityComboConfig();

    this.contratiempoCards = config.contratiempoCards ?? new Map();
    this.validateContratiempoCardsConfig();

    // NUEVO H1.15 — ver spec H1.15 §0.1/§4.2. Orden respecto a los campos de H1.14 no
    // importa — no hay dependencia entre ellos.
    this.allyCards = config.allyCards ?? new Map();
    this.validateAllyCardsConfig();
    this.alliesInPlay = [];
    this.activeDamageRedirectTargetId = null;
    this.cardInstanceIdCounter = 0;

    // NUEVO H1.16 — orden respecto a los campos de H1.14/H1.15 irrelevante, sin
    // dependencias cruzadas (ver spec H1.16 §4.1).
    this.minionDefinitions = config.minionDefinitions ?? new Map();
    this.validateMinionDefinitionsConfig();
    this.minionsInPlay = [];
    this.minionActionResolvedThisEnemyTurn = false;
    this.minionInstanceIdCounter = 0;

    // NUEVO H3.6 — ver spec §2.8/§2.9. Baraja el mazo de robo del Líder y reparte la
    // mano inicial (5, o menos si el mazo tiene menos de 5). Sin evento (constructor).
    this.handSizeMax = config.handSizeMax ?? LEADER_HAND_SIZE_MAX;
    const initialHandSize = config.initialHandSize ?? LEADER_INITIAL_HAND_SIZE;
    this.leaderDeckDrawPile = this.shuffle([...config.leaderDeckCardIds]);
    this.leaderHand = [];
    for (let i = 0; i < initialHandSize && this.leaderDeckDrawPile.length > 0; i++) {
      this.leaderHand.push(this.leaderDeckDrawPile.pop() as CardId);
    }
    this.leaderFreeStepTakenThisTurn = false;

    // NUEVO H1.17 — ver spec H1.17 §0.1/§0.2/§0.3. Orden respecto a los campos de
    // H1.14/H1.15/H1.16 irrelevante, sin dependencias cruzadas.
    this.enemyPhases = config.enemyPhases ?? [];
    this.scenarioPhases = config.scenarioPhases ?? [];
    this.enemyMaxHealth = config.enemyMaxHealth;
    this.validateEnemyMaxHealth(); // NUEVO H1.18 — ver spec §0.3, ahora incondicional
    this.validateEnemyPhasesConfig();
    this.validateScenarioPhasesConfig();
    this.enemyPhaseIndex = 0;
    this.scenarioPhaseIndex = 0;

    const initialEnemyDamage = config.initialEnemyDamage ?? 0;
    this.validateInitialEnemyDamage(initialEnemyDamage);
    this.enemyDamage = initialEnemyDamage;

    const initialLevelUpsSpent = config.initialLeaderLevelUpsSpent ?? 0;
    this.validateInitialLeaderLevelUpsSpent(initialLevelUpsSpent);
    this.leaderLevelUpsSpent = initialLevelUpsSpent;

    const initialEnergy = config.initialLeaderEnergy ?? LEADER_ENERGY_INITIAL_DEFAULT;
    this.validateInitialLeaderEnergy(initialEnergy);
    this.leaderEnergy = initialEnergy;

    // NUEVO H1.14 — el límite de acciones del PRIMER turno se calcula ya aquí, antes de
    // cualquier dispatch (igual que el primer tick de cooldowns, H1.4).
    this.actionsTakenThisTurn = 0;
    this.actionsAllowedThisTurn = baseActionsForSide(this.turnOwner);
    this.comboBonusGrantedThisTurn = false;
    this.abilityIdsActivatedThisTurn = new Set();
    this.currentEnemyTurnLog = [];
    this.previousEnemyTurnLog = [];

    // NUEVO H3.4 — 5 dados fijos, uno por color, todos AVAILABLE. Sin dados EXTRA
    // iniciales en el contenido de juguete (ver spec §1.5).
    this.nucleoTable = rollFixedDice(this.randomSource, () => this.nextNucleoId());

    // GDD §2.2 paso 2 ("Cooldowns propios bajan en 1") se aplica también en el
    // primerísimo turno de la partida (turnNumber=1, antes de cualquier acción) — no
    // es exclusivo de los turnos posteriores a un END_TURN. No emite evento (constructor,
    // sin subscriptores todavía) — solo se refleja en getSnapshot(), igual que la
    // tirada inicial del pool (ver H1.3 §5.3).
    this.tickCooldownsForSide(this.turnOwner);

    // NUEVO H1.18 — ver spec §0.1/§0.3/§0.5/§0.6. Orden respecto a los campos de
    // H1.14/H1.15/H1.16/H1.17 irrelevante, sin dependencias cruzadas entre sí.
    this.playableCards = config.playableCards ?? new Map();
    this.validatePlayableCardsConfig();

    this.leaderMaxHealth = config.leaderMaxHealth;
    this.validateLeaderMaxHealth();

    this.scenarioPlotDefeatThreshold = config.scenarioPlotDefeatThreshold;
    this.validateScenarioPlotDefeatThreshold();

    this.enemyAbilityAiProfiles = config.enemyAbilityAiProfiles ?? new Map();
    const dramaturgiaDeckRaw = config.dramaturgiaDeck ?? [];
    this.enemyAiEnabled = this.enemyAbilityAiProfiles.size > 0 || dramaturgiaDeckRaw.length > 0;
    this.validateEnemyAiConfig(dramaturgiaDeckRaw);

    this.dramaturgiaDrawPile = this.enemyAiEnabled ? this.shuffle([...dramaturgiaDeckRaw]) : [];
    this.dramaturgiaDiscardPile = [];
    this.currentEnemyDramaturgiaCard = undefined; // NUEVO H1.16 (rediseño)

    // NUEVO H1.8+H1.18 — ver spec §4.3.
    this.alternativeVictoryConditions = config.alternativeVictoryConditions ?? [];

    this.combatStatus = 'IN_PROGRESS';
    this.defeatReason = undefined;
  }

  /**
   * Invariantes de configuración de CD — fallan rápido en el constructor en vez de
   * comportarse de forma confusa en runtime:
   *  1. Las claves de `abilityCooldowns` deben coincidir EXACTAMENTE con las de
   *     `abilityCoreCosts` (toda habilidad con coste conocido tiene CD rastreado, y
   *     viceversa).
   *  2. Todo `baseCooldown` debe ser un entero >= `ABILITY_BASE_COOLDOWN_MIN` (GDD
   *     §2.5, "CD mínimo = 1, nunca 0" — ver §0.3 de la spec: esto es sobre el CD BASE
   *     de catálogo, nunca sobre el CD restante en runtime).
   */
  private validateAbilityCooldownsConfig(): void {
    const costKeys = new Set(this.abilityCoreCosts.keys());
    const cooldownKeys = new Set(this.abilityCooldowns.keys());

    for (const key of costKeys) {
      if (!cooldownKeys.has(key)) {
        throw new Error(
          `CombatEngine: abilityId "${String(key)}" está en abilityCoreCosts pero no en abilityCooldowns`
        );
      }
    }
    for (const [key, def] of this.abilityCooldowns) {
      if (!costKeys.has(key)) {
        throw new Error(
          `CombatEngine: abilityId "${String(key)}" está en abilityCooldowns pero no en abilityCoreCosts`
        );
      }
      if (!Number.isInteger(def.baseCooldown) || def.baseCooldown < ABILITY_BASE_COOLDOWN_MIN) {
        throw new Error(
          `CombatEngine: abilityCooldowns["${String(key)}"].baseCooldown debe ser un entero >= ${ABILITY_BASE_COOLDOWN_MIN} (GDD §2.5, "CD mínimo = 1, nunca 0"), recibido ${def.baseCooldown}`
        );
      }
    }
  }

  /**
   * NUEVO H1.6. Invariantes de configuración de `abilityEffects` — fallan rápido en el
   * constructor (mismo estilo que `validateAbilityCooldownsConfig`):
   *  1. Toda clave de `abilityEffects` DEBE existir en `abilityCoreCosts` (que ya
   *     garantiza, por `validateAbilityCooldownsConfig`, que también existe en
   *     `abilityCooldowns`).
   *  2. Toda entrada `kind: 'ATTACK'` DEBE pertenecer a una habilidad cuyo
   *     `abilityCooldowns[...].side` sea `'ENEMY'` — ver spec §0.5 (el Líder nunca es
   *     origen de un efecto ATTACK en esta historia; no existe `enemyHealth`).
   *  3. Ningún `amount` de `ADD`/`MULTIPLY` (en `ATTACK.formula` o `PLOT.amount`) puede
   *     ser negativo — "modificadores negativos" son una capa futura fuera de alcance
   *     (GDD §12, ver `types/umbral.ts`), y un `amount` negativo rompería el invariante
   *     `leaderShield ∈ [0, LEADER_SHIELD_MAX]`/`leaderDamage >= 0` en runtime (hallado
   *     por QA durante H1.6).
   */
  private validateAbilityEffectsConfig(): void {
    const costKeys = new Set(this.abilityCoreCosts.keys());
    for (const [abilityId, effect] of this.abilityEffects) {
      if (!costKeys.has(abilityId)) {
        throw new Error(
          `CombatEngine: abilityId "${String(abilityId)}" está en abilityEffects pero no en abilityCoreCosts/abilityCooldowns`
        );
      }
      if (effect.kind === 'ATTACK') {
        const def = this.abilityCooldowns.get(abilityId) as AbilityCooldownDefinition;
        if (def.side !== 'ENEMY') {
          throw new Error(
            `CombatEngine: abilityEffects["${String(abilityId)}"] es de tipo ATTACK pero su dueño (abilityCooldowns.side) es "${def.side}" — H1.6 solo modela daño Enemigo→Líder (GDD §3.7), ver spec H1.6 §0.5`
          );
        }
        this.validateUmbralFormulaNonNegative(`abilityEffects["${String(abilityId)}"]`, effect.formula.baseFormula);
        if (effect.formula.bonusFormula) {
          this.validateUmbralFormulaNonNegative(`abilityEffects["${String(abilityId)}"]`, effect.formula.bonusFormula);
        }
      } else if (effect.amount < 0) {
        throw new Error(
          `CombatEngine: abilityEffects["${String(abilityId)}"] (PLOT) tiene amount negativo (${effect.amount}) — modificadores negativos son una capa futura fuera de alcance (GDD §12)`
        );
      }
    }
  }

  /** Ver `validateAbilityEffectsConfig`, invariante 3. NUEVO H1.18: `label` generalizado
   *  (antes tomaba un `AbilityId` directamente) para que `validatePlayableCardsConfig`
   *  reutilice la misma función con un label de `playableCards["..."]`. */
  private validateUmbralFormulaNonNegative(label: string, formula: UmbralFormula): void {
    if (formula.kind !== 'VALUE' && formula.amount < 0) {
      throw new Error(
        `CombatEngine: ${label} tiene una fórmula ${formula.kind} con amount negativo (${formula.amount}) — modificadores negativos son una capa futura fuera de alcance (GDD §12)`
      );
    }
  }

  /**
   * NUEVO H1.6. `initialLeaderShield` debe ser un entero en [0, LEADER_SHIELD_MAX]
   * (GDD §2.8, "Tope global de escudo del Líder: 5" — ver spec §0.1/§2.1).
   */
  private validateInitialLeaderShield(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > LEADER_SHIELD_MAX) {
      throw new Error(
        `CombatEngine: initialLeaderShield debe ser un entero entre 0 y ${LEADER_SHIELD_MAX} (GDD §2.8), recibido ${value}`
      );
    }
  }

  /** Ver spec H1.14 §0.2: toda habilidad con Combo debe ser del Líder. */
  private validateAbilityComboConfig(): void {
    for (const abilityId of this.abilityCombo) {
      const def = this.abilityCooldowns.get(abilityId);
      if (!def) {
        throw new Error(
          `CombatEngine: abilityId "${String(abilityId)}" está en abilityCombo pero no en abilityCooldowns`
        );
      }
      if (def.side !== 'LEADER') {
        throw new Error(
          `CombatEngine: abilityId "${String(abilityId)}" está en abilityCombo con side "${def.side}" — Combo (GDD §2.6) extiende las 2 acciones del Líder (GDD §2.1); el Enemigo tiene 1 acción fija (GDD §3.4) sin 3ª acción, ver spec H1.14 §0.2`
        );
      }
    }
  }

  private validateContratiempoCardsConfig(): void {
    for (const [cardId, def] of this.contratiempoCards) {
      if (!Number.isInteger(def.energyCost) || def.energyCost < 0) {
        throw new Error(
          `CombatEngine: contratiempoCards["${String(cardId)}"].energyCost debe ser un entero >= 0, recibido ${def.energyCost}`
        );
      }
    }
  }

  /**
   * NUEVO H1.15. Invariantes de configuración de `allyCards` — mismo estilo que
   * `validateContratiempoCardsConfig`. Ver spec H1.15 §3.6.
   */
  private validateAllyCardsConfig(): void {
    for (const [cardId, def] of this.allyCards) {
      if (!Number.isInteger(def.energyCost) || def.energyCost < 0) {
        throw new Error(
          `CombatEngine: allyCards["${String(cardId)}"].energyCost debe ser un entero >= 0, recibido ${def.energyCost}`
        );
      }
      if (!Number.isInteger(def.life) || def.life < 1) {
        throw new Error(
          `CombatEngine: allyCards["${String(cardId)}"].life debe ser un entero >= 1, recibido ${def.life}`
        );
      }
      for (const abilityId of def.abilityIds ?? []) {
        const cdDef = this.abilityCooldowns.get(abilityId);
        if (!cdDef) {
          throw new Error(
            `CombatEngine: allyCards["${String(cardId)}"].abilityIds incluye "${String(abilityId)}" que no está en abilityCooldowns`
          );
        }
        if (cdDef.side !== 'LEADER') {
          throw new Error(
            `CombatEngine: allyCards["${String(cardId)}"].abilityIds incluye "${String(abilityId)}" con side "${cdDef.side}" — las habilidades de un Aliado del jugador son siempre side 'LEADER' (turn.ts: "sourceId distintos dentro del mismo lado")`
          );
        }
      }
    }
  }

  /** NUEVO H1.15 — primer uso real de `CardInstanceId` (H1.1). */
  private nextCardInstanceId(): CardInstanceId {
    const id = createId<'CardInstanceId'>('CardInstanceId', `ally-${this.cardInstanceIdCounter}`);
    this.cardInstanceIdCounter += 1;
    return id;
  }

  /** NUEVO H1.16 — mismo patrón que `nextCardInstanceId` (H1.15), contador propio. */
  private nextMinionInstanceId(): CardInstanceId {
    const id = createId<'CardInstanceId'>('CardInstanceId', `minion-${this.minionInstanceIdCounter}`);
    this.minionInstanceIdCounter += 1;
    return id;
  }

  /**
   * NUEVO H1.16. Invariantes de configuración de `minionDefinitions` — mismo estilo que
   * `validateAllyCardsConfig`. Ver spec H1.16 §3.5.
   */
  private validateMinionDefinitionsConfig(): void {
    for (const [minionDefinitionId, def] of this.minionDefinitions) {
      if (!Number.isInteger(def.planoAttackAmount) || def.planoAttackAmount < 0) {
        throw new Error(
          `CombatEngine: minionDefinitions["${String(minionDefinitionId)}"].planoAttackAmount debe ser un entero >= 0, recibido ${def.planoAttackAmount}`
        );
      }
      // NUEVO §3.9.1 (decisions.md, "Vida de Secuaz") — a diferencia de NucleoValue, un
      // Secuaz de 0 de vida está muerto por definición: no se permite 0.
      if (!Number.isInteger(def.maxLife) || def.maxLife < 1) {
        throw new Error(
          `CombatEngine: minionDefinitions["${String(minionDefinitionId)}"].maxLife debe ser un entero >= 1, recibido ${def.maxLife}`
        );
      }
      if (def.specialActionAbilityId !== undefined) {
        const cdDef = this.abilityCooldowns.get(def.specialActionAbilityId);
        if (!cdDef) {
          throw new Error(
            `CombatEngine: minionDefinitions["${String(minionDefinitionId)}"].specialActionAbilityId "${String(def.specialActionAbilityId)}" no está en abilityCooldowns`
          );
        }
        if (cdDef.side !== 'ENEMY') {
          throw new Error(
            `CombatEngine: minionDefinitions["${String(minionDefinitionId)}"].specialActionAbilityId "${String(def.specialActionAbilityId)}" tiene side "${cdDef.side}" — la acción especial de un Secuaz siempre es side 'ENEMY' (turn.ts: "sourceId distintos dentro del mismo lado")`
          );
        }
      }
    }
  }

  /**
   * NUEVO H1.17. Invariantes de `enemyPhases` — mismo estilo defensivo que
   * `validateAbilityCooldownsConfig`; revalida localmente lo que
   * `parseEnemyDefinition` ya garantiza en origen (ver spec H1.17 §3.2).
   */
  private validateEnemyPhasesConfig(): void {
    if (this.enemyPhases.length === 0) return; // sin fases = sin tracking, válido (§0.2)

    const phaseNumbers = this.enemyPhases.map((p) => p.phaseNumber);
    const expected = phaseNumbers.map((_, i) => i + 1);
    if (phaseNumbers.some((n, i) => n !== expected[i])) {
      throw new Error(
        `CombatEngine: enemyPhases.phaseNumber debe ser una secuencia 1..N sin huecos ni duplicados, recibido [${phaseNumbers.join(', ')}]`
      );
    }

  }

  /**
   * NUEVO H1.18. `enemyMaxHealth` pasa de opcional-condicional (H1.17,
   * `needsMaxHealth`) a OBLIGATORIO siempre — la condición de victoria (§0.3/§0.6) lo
   * necesita en todo momento, no solo cuando `enemyPhases` incluye
   * `HEALTH_BELOW_PERCENT`. Mismo rango que antes: entero en (0, 100] (GDD §3.4).
   */
  private validateEnemyMaxHealth(): void {
    if (!Number.isInteger(this.enemyMaxHealth) || this.enemyMaxHealth <= 0 || this.enemyMaxHealth > 100) {
      throw new Error(
        `CombatEngine: enemyMaxHealth debe ser un entero en (0, 100] (GDD §3.4, "ningún enemigo supera 100HP"), recibido ${this.enemyMaxHealth}`
      );
    }
  }

  /** NUEVO H1.18 — mismo criterio que `validateEnemyMaxHealth` (ver spec §0.3). */
  private validateLeaderMaxHealth(): void {
    if (!Number.isInteger(this.leaderMaxHealth) || this.leaderMaxHealth <= 0 || this.leaderMaxHealth > 100) {
      throw new Error(
        `CombatEngine: leaderMaxHealth debe ser un entero en (0, 100] (GDD §3.4, mismo tope que enemyMaxHealth), recibido ${this.leaderMaxHealth}`
      );
    }
  }

  /** NUEVO H1.18 — ver spec §0.4. */
  private validateScenarioPlotDefeatThreshold(): void {
    if (!Number.isInteger(this.scenarioPlotDefeatThreshold) || this.scenarioPlotDefeatThreshold <= 0) {
      throw new Error(
        `CombatEngine: scenarioPlotDefeatThreshold debe ser un entero > 0, recibido ${this.scenarioPlotDefeatThreshold}`
      );
    }
  }

  /**
   * NUEVO H1.18. Invariantes de `playableCards` — mismo estilo que
   * `validateContratiempoCardsConfig`/`validateAllyCardsConfig`. Ver spec §3.2.
   */
  private validatePlayableCardsConfig(): void {
    for (const [cardId, def] of this.playableCards) {
      if (!Number.isInteger(def.energyCost) || def.energyCost < 0) {
        throw new Error(
          `CombatEngine: playableCards["${String(cardId)}"].energyCost debe ser un entero >= 0, recibido ${def.energyCost}`
        );
      }
      if (def.effect?.kind === 'ATTACK_ENEMY') {
        this.validateUmbralFormulaNonNegative(`playableCards["${String(cardId)}"]`, def.effect.formula.baseFormula);
        if (def.effect.formula.bonusFormula) {
          this.validateUmbralFormulaNonNegative(`playableCards["${String(cardId)}"]`, def.effect.formula.bonusFormula);
        }
      } else if ((def.effect?.kind === 'PLOT' || def.effect?.kind === 'SHIELD') && def.effect.amount < 0) {
        throw new Error(
          `CombatEngine: playableCards["${String(cardId)}"] (${def.effect.kind}) tiene amount negativo (${def.effect.amount})`
        );
      }
    }
  }

  /**
   * NUEVO H1.18. Ver spec §0.5 — "IA a medias" es un error de configuración: o ambos
   * campos están poblados, o ninguno.
   */
  private validateEnemyAiConfig(dramaturgiaDeckRaw: readonly DramaturgiaCardDefinition[]): void {
    if ((this.enemyAbilityAiProfiles.size > 0) !== (dramaturgiaDeckRaw.length > 0)) {
      throw new Error(
        'CombatEngine: enemyAbilityAiProfiles y dramaturgiaDeck deben proveerse juntos o ninguno (spec H1.18 §0.5) — IA a medias no es un estado válido'
      );
    }
    if (this.enemyAbilityAiProfiles.size > 0) {
      validateEnemyAbilityAiProfiles(this.enemyAbilityAiProfiles, this.abilityCooldowns);
    }
  }

  /**
   * NUEVO H1.17. Invariantes de `scenarioPhases` — el Escenario no tiene vida, por lo
   * que `HEALTH_BELOW_PERCENT` no es una condición válida aquí (ver spec H1.17 §3.2).
   */
  private validateScenarioPhasesConfig(): void {
    if (this.scenarioPhases.length === 0) return;

    const phaseNumbers = this.scenarioPhases.map((p) => p.phaseNumber);
    const expected = phaseNumbers.map((_, i) => i + 1);
    if (phaseNumbers.some((n, i) => n !== expected[i])) {
      throw new Error(
        `CombatEngine: scenarioPhases.phaseNumber debe ser una secuencia 1..N sin huecos ni duplicados, recibido [${phaseNumbers.join(', ')}]`
      );
    }

    if (this.scenarioPhases.some((p) => p.changeCondition.kind === 'HEALTH_BELOW_PERCENT')) {
      throw new Error(
        'CombatEngine: scenarioPhases no admite HEALTH_BELOW_PERCENT — el Escenario no tiene vida (GDD §3.6)'
      );
    }
  }

  /** NUEVO H1.17 — ver spec §0.3, mismo estilo que `validateInitialLeaderShield`. */
  private validateInitialEnemyDamage(value: number): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`CombatEngine: initialEnemyDamage debe ser un entero >= 0, recibido ${value}`);
    }
    if (this.enemyMaxHealth !== undefined && value > this.enemyMaxHealth) {
      throw new Error(
        `CombatEngine: initialEnemyDamage (${value}) no puede exceder enemyMaxHealth (${this.enemyMaxHealth})`
      );
    }
  }

  /** NUEVO H1.17 — ver spec §0.6. */
  private validateInitialLeaderLevelUpsSpent(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > LEADER_LEVEL_UPS_MAX) {
      throw new Error(
        `CombatEngine: initialLeaderLevelUpsSpent debe ser un entero entre 0 y ${LEADER_LEVEL_UPS_MAX}, recibido ${value}`
      );
    }
  }

  /** Ver spec H1.14 §0 nota de estado del repo — mismo estilo que validateInitialLeaderShield (H1.6). */
  private validateInitialLeaderEnergy(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > LEADER_ENERGY_MAX) {
      throw new Error(
        `CombatEngine: initialLeaderEnergy debe ser un entero entre 0 y ${LEADER_ENERGY_MAX} (decisions.md, "Energía inicial del Líder: 1"), recibido ${value}`
      );
    }
  }

  /** NUEVO H3.6 — elimina UNA sola copia de `cardId` de `leaderHand` (nunca todas las
   *  copias si el jugador lleva duplicados — `Array.filter` con `!==` borraría todas). */
  private removeOneFromHand(cardId: CardId): void {
    const idx = this.leaderHand.indexOf(cardId);
    if (idx === -1) return;
    this.leaderHand = [...this.leaderHand.slice(0, idx), ...this.leaderHand.slice(idx + 1)];
  }

  private nextNucleoId(): NucleoInstanceId {
    const id = createId<'NucleoInstanceId'>('NucleoInstanceId', `nucleo-${this.nucleoIdCounter}`);
    this.nucleoIdCounter += 1;
    return id;
  }

  /** NUEVO H3.4. Añade un dado EXTRA de `color` a la mesa si no se excede el tope
   *  (`tableMaxDice`) — si se excede, el intento se ignora silenciosamente (decisions.md:
   *  "Intentos de añadir dados que exceden el tope se ignoran"), sin ser un error de
   *  comando. */
  private addExtraNucleoDie(color: NucleoColor, events: CombatEvent[]): void {
    if (this.nucleoTable.length >= this.tableMaxDice) {
      const skipped: CombatEvent = { type: 'NUCLEO_DIE_ADD_SKIPPED', color, reason: 'TABLE_AT_MAX' };
      events.push(skipped);
      this.eventBus.emit(skipped);
      return;
    }
    const die = rollExtraDie(color, this.randomSource, () => this.nextNucleoId());
    this.nucleoTable = [...this.nucleoTable, die];
    const added: CombatEvent = {
      type: 'NUCLEO_DIE_ADDED',
      color,
      dieId: die.id,
      tableSizeAfter: this.nucleoTable.length,
    };
    events.push(added);
    this.eventBus.emit(added);
  }

  /** NUEVO H3.4. Reroll colectivo si el último dado AVAILABLE de la mesa acaba de
   *  gastarse — reemplaza el "relanzado de pool vacío" de H1.3. */
  private maybeRerollNucleoTable(events: CombatEvent[]): void {
    if (countAvailableDice(this.nucleoTable) !== 0) return;
    this.nucleoTable = rerollAllDice(this.nucleoTable, this.randomSource);
    const rerolled: CombatEvent = {
      type: 'NUCLEO_TABLE_REROLLED',
      dice: [...this.nucleoTable],
      priorityTurnOwner: this.turnOwner,
    };
    events.push(rerolled);
    this.eventBus.emit(rerolled);
  }

  /** NUEVO H1.18 — Fisher-Yates in-place con `RandomSource` (determinista con
   *  `SeededRandomSource` en tests, ver spec §3.3). Usado para barajar el mazo de
   *  Dramaturgia (constructor + reciclado, §0.5.3). */
  private shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.randomSource.nextInt(0, i + 1);
      const tmp = items[i] as T;
      items[i] = items[j] as T;
      items[j] = tmp;
    }
    return items;
  }

  /**
   * Descuenta en 1 (saturado en 0) el CD restante de TODAS las habilidades cuyo
   * `AbilityCooldownDefinition.side` sea exactamente `side` — nunca las del otro lado.
   * Implementación literal de "cooldowns propios" (GDD §2.2 paso 2) / "cuando te
   * vuelve a tocar" (decisions.md) — ver §0.2 de esta spec.
   */
  private tickCooldownsForSide(side: CombatSide): void {
    for (const [abilityId, def] of this.abilityCooldowns) {
      if (def.side !== side) continue;
      const current = this.remainingCooldowns.get(abilityId) ?? 0;
      this.remainingCooldowns.set(abilityId, Math.max(0, current - 1));
    }
  }

  /** Construye el array de snapshot de CD, opcionalmente filtrado por lado. Orden
   *  estable = orden de inserción de `abilityCooldowns` (Map preserva orden). */
  private buildCooldownSnapshot(filterSide?: CombatSide): AbilityCooldownSnapshot[] {
    const result: AbilityCooldownSnapshot[] = [];
    for (const [abilityId, def] of this.abilityCooldowns) {
      if (filterSide !== undefined && def.side !== filterSide) continue;
      result.push({
        abilityId,
        side: def.side,
        baseCooldown: def.baseCooldown,
        remaining: this.remainingCooldowns.get(abilityId) ?? 0,
      });
    }
    return result;
  }

  /**
   * NUEVO H1.6. Resuelve un efecto ATTACK (GDD §3.4/§2.8/§3.7): calcula el daño bruto
   * vía `resolveAbilityUmbral` (H1.5) con el valor del Núcleo gastado, lo hace pasar
   * primero por `leaderShield` (absorción automática e incondicional, sin
   * `CombatCommand` de por medio — ver spec §0.1). Si NO había ninguna ficha de Escudo
   * activa (`shieldBefore === 0`), no hay nada que "exceda" — el daño es normal y pasa
   * completo a `leaderDamage`, sin necesitar Arrollar (no hay Escudo del que "arrollar
   * por encima"). Si SÍ había Escudo activo y no bastó para absorber todo el golpe, el
   * exceso sobre esas fichas solo pasa a `leaderDamage` si la habilidad tiene
   * `arrollar: true` (GDD §2.8: "sin Arrollar por defecto [...] el exceso se pierde").
   * Muta `this.leaderShield`/`this.leaderDamage`.
   */
  private applyAttackEffect(
    source: AbilityActionSource,
    effectDef: Extract<AbilityEffectDefinition, { kind: 'ATTACK' }>,
    nucleo: NucleoInstance
  ): CombatEvent {
    const resolution = resolveAbilityUmbral(effectDef.formula, nucleo.value);
    const rawAmount = resolution.baseResolvedValue;

    const target = this.resolveDamageTarget(); // NUEVO H1.15
    if (target) {
      return this.applyAttackEffectToAlly(source, effectDef, nucleo, rawAmount, target);
    }
    return this.applyAttackEffectToLeader(source, effectDef, nucleo, rawAmount);
  }

  /** H1.6 sin cambios de comportamiento — solo renombrada/extraída para separar la rama
   *  nueva de Aliados (ver spec H1.15 §4.4). NUEVO H1.16: `source`/`nucleo` generalizados
   *  (ver spec H1.16 §4.4 nota de refactor) para admitir el ataque plano/pasivo de
   *  Secuaz, sin habilidad de catálogo ni Núcleo real detrás. */
  private applyAttackEffectToLeader(
    source: AbilityActionSource,
    effectDef: { readonly arrollar?: boolean },
    nucleo: NucleoInstance | null,
    rawAmount: number
  ): CombatEvent {
    const shieldBefore = this.leaderShield;
    const absorbedByShield = Math.min(shieldBefore, rawAmount);
    this.leaderShield = shieldBefore - absorbedByShield;

    const excess = rawAmount - absorbedByShield;
    const appliedDamage = shieldBefore === 0 || effectDef.arrollar === true ? excess : 0;
    this.leaderDamage += appliedDamage;

    return {
      type: 'LEADER_DAMAGED',
      // NUEVO H1.16 — `exactOptionalPropertyTypes`: solo se incluye la clave si hay
      // abilityId real detrás (ver AbilityActionSource).
      ...(source.abilityId !== undefined ? { abilityId: source.abilityId } : {}),
      sourceId: source.sourceId,
      side: source.side,
      nucleoSpent: nucleo,
      rawAmount,
      absorbedByShield,
      appliedDamage,
      leaderShieldAfter: this.leaderShield,
      leaderDamageAfter: this.leaderDamage,
    };
  }

  /** NUEVO H1.15 — ver spec §0.4 sobre por qué el Escudo no interviene aquí. NUEVO
   *  H1.16: `source`/`nucleo` generalizados, ver comentario en `applyAttackEffectToLeader`. */
  private applyAttackEffectToAlly(
    source: AbilityActionSource,
    effectDef: { readonly arrollar?: boolean },
    nucleo: NucleoInstance | null,
    rawAmount: number,
    target: AllyInPlay
  ): CombatEvent {
    const allyLifeBefore = target.life;
    const absorbedByAlly = Math.min(allyLifeBefore, rawAmount);
    const allyLifeAfter = allyLifeBefore - absorbedByAlly;

    this.alliesInPlay = this.alliesInPlay.map((a) =>
      a.instanceId === target.instanceId ? { ...a, life: allyLifeAfter } : a
    );
    if (allyLifeAfter === 0 && this.activeDamageRedirectTargetId === target.instanceId) {
      this.activeDamageRedirectTargetId = null;
    }

    const excess = rawAmount - absorbedByAlly;
    const appliedDamageToLeader = effectDef.arrollar === true ? excess : 0;
    this.leaderDamage += appliedDamageToLeader;

    return {
      type: 'ALLY_DAMAGED',
      // NUEVO H1.16 — ver comentario equivalente en `applyAttackEffectToLeader`.
      ...(source.abilityId !== undefined ? { abilityId: source.abilityId } : {}),
      sourceId: source.sourceId,
      side: source.side,
      nucleoSpent: nucleo,
      allyInstanceId: target.instanceId,
      rawAmount,
      absorbedByAlly,
      allyLifeBefore,
      allyLifeAfter,
      allyDied: allyLifeAfter === 0,
      excess,
      appliedDamageToLeader,
      leaderDamageAfter: this.leaderDamage,
    };
  }

  /** NUEVO H1.15 — ver spec H1.15 §0.4. Determina a quién golpea un Ataque del Enemigo
   *  AHORA MISMO. */
  private resolveDamageTarget(): AllyInPlay | null {
    const berserker = this.alliesInPlay.find((a) => a.isBerserker && a.life > 0);
    if (berserker) return berserker;

    if (this.activeDamageRedirectTargetId !== null) {
      const target = this.alliesInPlay.find(
        (a) => a.instanceId === this.activeDamageRedirectTargetId && a.life > 0
      );
      if (target) return target;
      // Referencia obsoleta (el Aliado murió por otra vía, o ya no existe) — se limpia.
      this.activeDamageRedirectTargetId = null;
    }

    return null;
  }

  /**
   * NUEVO H1.6. Resuelve un efecto PLOT (GDD §3.6/§12): magnitud fija
   * (`effectDef.amount`, NO alimentada por Núcleo — ver spec §0.3), dirección derivada
   * del `side` dueño de la habilidad (`ENEMY` → sube, `LEADER` → baja — spec §0.4).
   * Satura `scenarioPlot` en 0 por abajo. Nunca toca `leaderShield`/`leaderDamage`
   * (GDD §3.6: "el daño de Trama es inabsorbible" — es, además, conceptualmente otra
   * cosa que "daño").
   */
  private applyPlotEffect(
    source: AbilityActionSource & { readonly abilityId: AbilityId },
    effectDef: Extract<AbilityEffectDefinition, { kind: 'PLOT' }>
  ): CombatEvent {
    const ownerDef = this.abilityCooldowns.get(source.abilityId) as AbilityCooldownDefinition;
    const direction: 'INCREASE' | 'DECREASE' = ownerDef.side === 'ENEMY' ? 'INCREASE' : 'DECREASE';
    const rawAmount = effectDef.amount;
    const appliedDelta = direction === 'INCREASE' ? rawAmount : -rawAmount;
    this.scenarioPlot = Math.max(0, this.scenarioPlot + appliedDelta);

    return {
      type: 'SCENARIO_PLOT_CHANGED',
      abilityId: source.abilityId,
      sourceId: source.sourceId,
      side: source.side,
      direction,
      rawAmount,
      appliedDelta,
      scenarioPlotAfter: this.scenarioPlot,
    };
  }

  /**
   * NUEVO H1.17. Evalúa la condición de cambio de fase de `condition` contra el estado
   * actual del motor (ver spec H1.17 §0.3).
   */
  private isPhaseChangeConditionMet(condition: PhaseChangeCondition): boolean {
    switch (condition.kind) {
      case 'TURN_COUNT_AT_LEAST':
        return this.turnNumber >= condition.turn;
      case 'SCENARIO_PLOT_AT_LEAST':
        return this.scenarioPlot >= condition.amount;
      case 'HEALTH_BELOW_PERCENT': {
        const maxHealth = this.enemyMaxHealth as number; // garantizado por validateEnemyPhasesConfig
        const remainingPercent = ((maxHealth - this.enemyDamage) / maxHealth) * 100;
        return remainingPercent <= condition.percent;
      }
    }
  }

  /**
   * NUEVO H1.17. Intenta avanzar la fase de `source` mientras la condición de la fase
   * ACTUAL se cumpla y haya una fase siguiente (bucle genérico, no asume número de
   * fases — ver spec H1.17 §0.3). Emite un `PHASE_CHANGED` por cada transición y llama
   * a `tryGrantLevelUp` inmediatamente después de cada uno.
   */
  private tryAdvancePhase(source: 'ENEMY' | 'SCENARIO', events: CombatEvent[]): void {
    const phases = source === 'ENEMY' ? this.enemyPhases : this.scenarioPhases;

    let index = source === 'ENEMY' ? this.enemyPhaseIndex : this.scenarioPhaseIndex;
    while (index < phases.length - 1) {
      const condition = (phases[index] as PhaseDefinition).changeCondition;
      if (!this.isPhaseChangeConditionMet(condition)) break;

      const fromPhaseNumber = (phases[index] as PhaseDefinition).phaseNumber;
      index += 1;
      const toPhaseNumber = (phases[index] as PhaseDefinition).phaseNumber;

      if (source === 'ENEMY') {
        this.enemyPhaseIndex = index;
      } else {
        this.scenarioPhaseIndex = index;
      }

      const phaseChanged: CombatEvent = {
        type: 'PHASE_CHANGED',
        source,
        fromPhaseNumber,
        toPhaseNumber,
      };
      events.push(phaseChanged);
      this.eventBus.emit(phaseChanged);

      this.tryGrantLevelUp(source, events);
    }
  }

  /**
   * NUEVO H1.17. Registra un Level-Up si todavía no se alcanzó el tope (ver spec
   * H1.17 §0.4/§0.5). No aplica ningún `LevelUpEffectSpec` — el motor solo cuenta.
   */
  private tryGrantLevelUp(source: 'ENEMY' | 'SCENARIO', events: CombatEvent[]): void {
    if (this.leaderLevelUpsSpent >= LEADER_LEVEL_UPS_MAX) {
      return; // §0.5 — "no hace nada", sin evento, sin mutación
    }

    this.leaderLevelUpsSpent += 1;
    const event: CombatEvent = {
      type: 'LEADER_LEVELED_UP',
      triggeredBy: source,
      levelAfter: LEADER_LEVEL_BASE + this.leaderLevelUpsSpent,
      levelUpsSpentAfter: this.leaderLevelUpsSpent,
    };
    events.push(event);
    this.eventBus.emit(event);
  }

  /**
   * NUEVO H1.17. Punto único de evaluación llamado tras cualquier mutación de
   * `turnNumber`/`scenarioPlot`/`enemyDamage` (ver spec H1.17 §0.3, "puntos de
   * evaluación"). Enemigo y Escenario se evalúan de forma independiente y secuencial,
   * Enemigo primero.
   */
  private evaluateAndApplyPhaseChanges(events: CombatEvent[]): void {
    this.tryAdvancePhase('ENEMY', events);
    this.tryAdvancePhase('SCENARIO', events);
  }

  /**
   * NUEVO H1.18. Punto único de evaluación de estado terminal (ver spec §0.6),
   * llamado como ÚLTIMO paso (después de `evaluateAndApplyPhaseChanges`) en todo
   * handler que pueda mutar `leaderDamage`/`scenarioPlot`/`enemyDamage`. No re-evalúa
   * ni re-emite si el combate ya terminó. Orden de precedencia (derrota antes que
   * victoria) es arbitrario pero determinista — ver spec §0.6.
   */
  private evaluateAndApplyCombatEnd(events: CombatEvent[]): void {
    if (this.combatStatus !== 'IN_PROGRESS') return;

    // NUEVO H1.8+H1.18 — las condiciones alternativas se evalúan ANTES que las
    // condiciones por defecto (ver spec §4.4), en el orden en que aparecen (Enemigo
    // primero, luego Escenario, ensamblados así en catalog-adapter.ts). Dentro de las
    // alternativas, la primera que se cumple gana.
    for (const condition of this.alternativeVictoryConditions) {
      if (this.isAlternativeConditionMet(condition)) {
        this.finalizeCombat(condition.outcome, events, condition.kind);
        return;
      }
    }

    // Lógica por defecto — SIN CAMBIOS respecto a H1.18 original.
    let outcome: CombatOutcome;
    let defeatReason: DefeatReason | undefined;
    if (this.leaderDamage >= this.leaderMaxHealth) {
      outcome = 'DEFEAT';
      defeatReason = 'LEADER_HEALTH';
    } else if (this.scenarioPlot >= this.scenarioPlotDefeatThreshold) {
      outcome = 'DEFEAT';
      defeatReason = 'SCENARIO_PLOT';
    } else if (this.enemyDamage >= this.enemyMaxHealth) {
      outcome = 'VICTORY';
    } else {
      return; // sigue en curso, no emite nada
    }
    this.finalizeCombat(outcome, events, undefined, defeatReason);
  }

  /** NUEVO H1.8+H1.18 — ver spec §4.4. */
  private isAlternativeConditionMet(condition: AlternativeVictoryCondition): boolean {
    switch (condition.kind) {
      case 'SCENARIO_PLOT_AT_MOST':
        return this.scenarioPlot <= condition.amount;
      case 'TURN_COUNT_AT_LEAST':
        return this.turnNumber >= condition.turn;
      case 'ENEMY_DAMAGE_AT_LEAST':
        return this.enemyDamage >= condition.amount;
    }
  }

  /** NUEVO H1.8+H1.18 — extraído de la cola final de `evaluateAndApplyCombatEnd`,
   *  centraliza la mutación de `combatStatus`/`defeatReason` y la emisión de
   *  `COMBAT_ENDED`, parametrizado por si el desenlace vino de una condición
   *  alternativa. */
  private finalizeCombat(
    outcome: CombatOutcome,
    events: CombatEvent[],
    alternativeConditionKind?: AlternativeVictoryCondition['kind'],
    defeatReason?: DefeatReason
  ): void {
    this.combatStatus = outcome;
    this.defeatReason = alternativeConditionKind !== undefined ? 'ALTERNATIVE' : defeatReason;
    const event: CombatEvent = {
      type: 'COMBAT_ENDED',
      outcome,
      ...(this.defeatReason !== undefined ? { defeatReason: this.defeatReason } : {}),
      ...(alternativeConditionKind !== undefined ? { alternativeConditionKind } : {}),
    };
    events.push(event);
    this.eventBus.emit(event);
  }

  /**
   * NUEVO H1.16 (extraído de `handleActivateAbility`, ver spec §4.4 punto 2 —
   * "reutilizar, no duplicar"). Ejecuta el núcleo compartido de una activación de
   * habilidad YA VALIDADA por el caller: gasta el `nucleo` indicado (ya elegido),
   * resetea su CD a `baseCooldown`, resuelve `abilityEffects` (si los hay) y arma la
   * entrada de log de Contratiempo correspondiente (`origin: 'ABILITY'` construido por
   * el caller, no aquí). Usado tanto por `handleActivateAbility` (Enemigo/Líder mismos)
   * como por `handleResolveMinionAction` (acción especial de Secuaz, `side: 'ENEMY'`
   * fijo, `sourceId` = `instanceId` del Secuaz elegido). NO incrementa
   * `actionsTakenThisTurn`/`abilityIdsActivatedThisTurn` ni evalúa Combo ni relanza el
   * pool — esas 3 cosas siguen siendo responsabilidad exclusiva de cada caller (ver
   * spec §4.4), para no alterar el orden de eventos ya cubierto por tests H1.14.
   */
  private executeAbilityEffect(
    abilityId: AbilityId,
    sourceId: string,
    side: CombatSide,
    nucleo: NucleoInstance
  ): {
    events: CombatEvent[];
    effectLogEntry?: UndoableEnemyActionLogEntry['effect'];
    cooldownBefore: number;
  } {
    const events: CombatEvent[] = [];

    // MODIFICADO H3.4 — gastar un dado cambia su status a SPENT, nunca lo elimina de la mesa.
    this.nucleoTable = this.nucleoTable.map((d) => (d.id === nucleo.id ? { ...d, status: 'SPENT' as const } : d));

    const def = this.abilityCooldowns.get(abilityId) as AbilityCooldownDefinition;
    const cooldownBefore = this.remainingCooldowns.get(abilityId) ?? 0;
    this.remainingCooldowns.set(abilityId, def.baseCooldown);

    const activated: CombatEvent = {
      type: 'ABILITY_ACTIVATED',
      abilityId,
      sourceId,
      side,
      nucleoSpent: nucleo,
    };
    events.push(activated);
    this.eventBus.emit(activated);

    let effectLogEntry: UndoableEnemyActionLogEntry['effect'] | undefined;
    const effectDef = this.abilityEffects.get(abilityId);
    if (effectDef) {
      if (effectDef.kind === 'ATTACK') {
        const leaderDamageBefore = this.leaderDamage;
        const leaderShieldBefore = this.leaderShield;
        const effectEvent = this.applyAttackEffect({ abilityId, sourceId, side }, effectDef, nucleo);
        events.push(effectEvent);
        this.eventBus.emit(effectEvent);

        if (effectEvent.type === 'ALLY_DAMAGED') {
          effectLogEntry = {
            kind: 'ATTACK',
            target: 'ALLY',
            allyInstanceId: effectEvent.allyInstanceId,
            allyLifeBefore: effectEvent.allyLifeBefore,
            allyLifeAfter: effectEvent.allyLifeAfter,
            leaderDamageBefore,
            leaderDamageAfter: this.leaderDamage,
          };
        } else {
          effectLogEntry = {
            kind: 'ATTACK',
            target: 'LEADER',
            leaderDamageBefore,
            leaderDamageAfter: this.leaderDamage,
            leaderShieldBefore,
            leaderShieldAfter: this.leaderShield,
          };
        }
      } else {
        const scenarioPlotBefore = this.scenarioPlot;
        const effectEvent = this.applyPlotEffect({ abilityId, sourceId, side }, effectDef);
        events.push(effectEvent);
        this.eventBus.emit(effectEvent);
        effectLogEntry = { kind: 'PLOT', scenarioPlotBefore, scenarioPlotAfter: this.scenarioPlot };
      }
    }

    return { events, effectLogEntry, cooldownBefore };
  }

  dispatch(command: CombatCommand): CombatCommandResult {
    // NUEVO H1.18 — ver spec §0.6. Rechaza cualquier comando una vez el combate llegó a
    // un estado terminal (VICTORY/DEFEAT) — primera línea, antes de cualquier otra
    // validación de comando.
    if (this.combatStatus !== 'IN_PROGRESS') {
      return err({ code: 'COMBAT_ALREADY_ENDED', status: this.combatStatus });
    }

    switch (command.type) {
      case 'ACTIVATE_ABILITY':
        return this.handleActivateAbility(command);
      case 'END_TURN':
        return this.handleEndTurn();
      case 'PLAY_CONTRATIEMPO':
        return this.handlePlayContratiempo(command);
      case 'PLAY_ALLY':
        return this.handlePlayAlly(command);
      case 'SET_DAMAGE_REDIRECT':
        return this.handleSetDamageRedirect(command);
      case 'SUMMON_MINION':
        return this.handleSummonMinion(command);
      case 'RESOLVE_MINION_ACTION':
        return this.handleResolveMinionAction(command);
      case 'PLAY_CARD':
        return this.handlePlayCard(command);
      case 'DRAW_OR_GENERATE':
        return this.handleDrawOrGenerate(command);
      case 'DRAW_CARD':
        return this.handleDrawCard();
      case 'GENERATE_ENERGY':
        return this.handleGenerateEnergy();
    }
  }

  /** NUEVO H3.6 — ver spec §2.5. Roba 1 carta (tope de mano: `handSizeMax`). No-op sin
   *  error si el mazo está vacío o la mano ya está al tope (decisions.md). */
  private executeDrawCard(): CombatEvent {
    if (this.leaderHand.length >= this.handSizeMax) {
      return { type: 'LEADER_HAND_DRAW_SKIPPED', reason: 'HAND_FULL' };
    }
    if (this.leaderDeckDrawPile.length === 0) {
      return { type: 'LEADER_HAND_DRAW_SKIPPED', reason: 'DECK_EMPTY' };
    }
    const cardId = this.leaderDeckDrawPile.pop() as CardId;
    this.leaderHand = [...this.leaderHand, cardId];
    return {
      type: 'LEADER_HAND_CARD_DRAWN',
      cardId,
      handSizeAfter: this.leaderHand.length,
      deckRemainingAfter: this.leaderDeckDrawPile.length,
    };
  }

  /** NUEVO H3.6 — ver spec §2.5. Genera +1 Energía (tope 5). No-op sin error si ya al
   *  tope. */
  private executeGenerateEnergy(): CombatEvent {
    if (this.leaderEnergy >= LEADER_ENERGY_MAX) {
      return { type: 'ENERGY_GENERATE_SKIPPED', reason: 'ENERGY_AT_MAX' };
    }
    this.leaderEnergy += 1;
    return { type: 'ENERGY_GENERATED', amount: 1, leaderEnergyAfter: this.leaderEnergy };
  }

  /** NUEVO H3.6 — ver spec §2.6. Paso previo GRATIS del turno del Líder, máximo 1 vez
   *  por turno. */
  private handleDrawOrGenerate(
    command: Extract<CombatCommand, { type: 'DRAW_OR_GENERATE' }>
  ): CombatCommandResult {
    if (this.turnOwner !== 'LEADER') {
      return err({ code: 'NOT_YOUR_TURN', expected: 'LEADER', actual: this.turnOwner });
    }
    if (this.leaderFreeStepTakenThisTurn) {
      return err({ code: 'FREE_STEP_ALREADY_TAKEN' });
    }

    this.leaderFreeStepTakenThisTurn = true; // se consume SIEMPRE, incluso si el efecto es no-op
    const effectEvent = command.action === 'draw' ? this.executeDrawCard() : this.executeGenerateEnergy();

    const wrapperEvent: CombatEvent = {
      type: 'FREE_STEP_RESOLVED',
      action: command.action,
      outcome: effectEvent.type.endsWith('SKIPPED') ? 'SKIPPED' : 'APPLIED',
    };

    const events = [effectEvent, wrapperEvent];
    for (const e of events) this.eventBus.emit(e);
    return ok(events);
  }

  /** NUEVO H3.6 — ver spec §2.6. Versión PAGADA de "Robar Carta" — 1 de las 2 acciones. */
  private handleDrawCard(): CombatCommandResult {
    if (this.turnOwner !== 'LEADER') {
      return err({ code: 'NOT_YOUR_TURN', expected: 'LEADER', actual: this.turnOwner });
    }
    if (this.actionsTakenThisTurn >= this.actionsAllowedThisTurn) {
      return err({
        code: 'NO_ACTIONS_REMAINING',
        side: this.turnOwner,
        actionsTaken: this.actionsTakenThisTurn,
        actionsAllowed: this.actionsAllowedThisTurn,
      });
    }

    this.actionsTakenThisTurn += 1;
    const effectEvent = this.executeDrawCard();
    this.eventBus.emit(effectEvent);
    return ok([effectEvent]);
  }

  /** NUEVO H3.6 — ver spec §2.6/decisions.md ("Robar carta y Generar Energía como acción
   *  pagada: mismo efecto que la versión gratuita"). Versión PAGADA de "Generar
   *  Energía" — 1 de las 2 acciones. */
  private handleGenerateEnergy(): CombatCommandResult {
    if (this.turnOwner !== 'LEADER') {
      return err({ code: 'NOT_YOUR_TURN', expected: 'LEADER', actual: this.turnOwner });
    }
    if (this.actionsTakenThisTurn >= this.actionsAllowedThisTurn) {
      return err({
        code: 'NO_ACTIONS_REMAINING',
        side: this.turnOwner,
        actionsTaken: this.actionsTakenThisTurn,
        actionsAllowed: this.actionsAllowedThisTurn,
      });
    }

    this.actionsTakenThisTurn += 1;
    const effectEvent = this.executeGenerateEnergy();
    this.eventBus.emit(effectEvent);
    return ok([effectEvent]);
  }

  private handleActivateAbility(
    command: Extract<CombatCommand, { type: 'ACTIVATE_ABILITY' }>
  ): CombatCommandResult {
    const requirement = this.abilityCoreCosts.get(command.abilityId);
    if (!requirement) {
      return err({ code: 'ABILITY_COST_UNKNOWN', abilityId: command.abilityId });
    }

    if (command.side !== this.turnOwner) {
      return err({ code: 'NOT_YOUR_TURN', expected: this.turnOwner, actual: command.side });
    }

    // NUEVO H1.14 — ver spec §0.1/§3.4.
    if (this.actionsTakenThisTurn >= this.actionsAllowedThisTurn) {
      return err({
        code: 'NO_ACTIONS_REMAINING',
        side: this.turnOwner,
        actionsTaken: this.actionsTakenThisTurn,
        actionsAllowed: this.actionsAllowedThisTurn,
      });
    }

    // NUEVO H1.14 — ver spec §0.3.
    if (this.abilityIdsActivatedThisTurn.has(command.abilityId)) {
      return err({ code: 'ABILITY_ALREADY_ACTIVATED_THIS_TURN', abilityId: command.abilityId });
    }

    // NUEVO en H1.4 — ver §3.4 de esta spec para la justificación del orden.
    const remaining = this.remainingCooldowns.get(command.abilityId) ?? 0;
    if (remaining > 0) {
      return err({ code: 'ABILITY_ON_COOLDOWN', abilityId: command.abilityId, remaining });
    }

    const die = this.nucleoTable.find((d) => d.id === command.nucleoInstanceId);
    if (!die) {
      return err({ code: 'NUCLEO_NOT_FOUND', nucleoInstanceId: command.nucleoInstanceId });
    }
    if (die.status === 'SPENT') {
      return err({ code: 'NUCLEO_ALREADY_SPENT', nucleoInstanceId: command.nucleoInstanceId });
    }

    // NUEVO H3.4 — `nucleoSpent` en los eventos sigue siendo `NucleoInstance` puro (sin
    // `kind`/`status`), nunca el `NucleoDie` completo de mesa (ver spec §1.2).
    const nucleo: NucleoInstance = { id: die.id, color: die.color, value: die.value };
    if (!satisfiesCoreCost(requirement, nucleo.color)) {
      return err({
        code: 'NUCLEO_COLOR_MISMATCH',
        nucleoInstanceId: command.nucleoInstanceId,
        requirement,
        actualColor: nucleo.color,
      });
    }

    // Solo a partir de aquí se muta estado — ninguna validación previa debe tener
    // efectos secundarios.

    // NUEVO H1.14
    this.actionsTakenThisTurn += 1;
    this.abilityIdsActivatedThisTurn.add(command.abilityId);

    // NUEVO H1.16 — porción compartida con `handleResolveMinionAction` (ver spec §4.4
    // punto 2 y `executeAbilityEffect`): gasta Núcleo, resetea CD, resuelve
    // `abilityEffects` y arma `effectLogEntry`. Sin cambio de comportamiento para este
    // camino (Líder/Enemigo mismos).
    const { events, effectLogEntry, cooldownBefore: cooldownBeforeThisActivation } = this.executeAbilityEffect(
      command.abilityId,
      command.sourceId,
      command.side,
      nucleo
    );

    // NUEVO H1.14
    if (command.side === 'ENEMY') {
      this.currentEnemyTurnLog.push({
        origin: 'ABILITY', // NUEVO H1.16
        abilityId: command.abilityId,
        sourceId: command.sourceId,
        cooldownBefore: cooldownBeforeThisActivation,
        ...(effectLogEntry ? { effect: effectLogEntry } : {}),
      });
    }

    // NUEVO H1.14 — Combo (GDD §2.6, ver spec §0.2). Se evalúa DESPUÉS del efecto para que
    // COMBO_TRIGGERED sea el último evento de esta activación.
    if (this.abilityCombo.has(command.abilityId) && !this.comboBonusGrantedThisTurn) {
      this.comboBonusGrantedThisTurn = true;
      this.actionsAllowedThisTurn += COMBO_MAX_BONUS_ACTIONS_PER_TURN;
      const comboEvent: CombatEvent = {
        type: 'COMBO_TRIGGERED',
        abilityId: command.abilityId,
        side: command.side,
        sourceId: command.sourceId,
        actionsAllowedThisTurn: this.actionsAllowedThisTurn,
      };
      events.push(comboEvent);
      this.eventBus.emit(comboEvent);
    }

    this.maybeRerollNucleoTable(events); // MODIFICADO H3.4

    // NUEVO H1.17 — ver spec §0.3, punto de evaluación 2.
    this.evaluateAndApplyPhaseChanges(events);
    this.evaluateAndApplyCombatEnd(events); // NUEVO H1.18

    return ok(events);
  }

  private handleEndTurn(): CombatCommandResult {
    const previousTurnOwner = this.turnOwner;
    this.turnOwner = previousTurnOwner === 'LEADER' ? 'ENEMY' : 'LEADER';
    this.turnNumber += 1;

    const events: CombatEvent[] = [];

    const turnEnded: CombatEvent = {
      type: 'TURN_ENDED',
      previousTurnOwner,
      nextTurnOwner: this.turnOwner,
      turnNumber: this.turnNumber,
    };
    events.push(turnEnded);
    this.eventBus.emit(turnEnded);

    // NUEVO en H1.4 — al empezar el turno de `this.turnOwner` (el lado que RECIBE el
    // turno), SOLO sus propias habilidades bajan CD en 1 (ver §0.2 de esta spec). Este
    // es el único punto del motor donde se descuenta CD — nunca dentro de
    // handleActivateAbility — así que una eventual 3ª acción de Combo (H1.14, fuera de
    // alcance) dentro del mismo turno nunca adelanta el descuento.
    this.tickCooldownsForSide(this.turnOwner);
    const cooldownsTicked: CombatEvent = {
      type: 'COOLDOWNS_TICKED',
      side: this.turnOwner,
      cooldowns: this.buildCooldownSnapshot(this.turnOwner),
    };
    events.push(cooldownsTicked);
    this.eventBus.emit(cooldownsTicked);

    // NUEVO H1.14 — reinicia el conteo de acciones para el lado que RECIBE el turno
    // (GDD §2.1/§3.4): el bonus de Combo NUNCA persiste entre turnos (GDD §2.6: "este turno").
    this.actionsTakenThisTurn = 0;
    this.actionsAllowedThisTurn = baseActionsForSide(this.turnOwner);
    this.comboBonusGrantedThisTurn = false;
    this.abilityIdsActivatedThisTurn = new Set();

    // NUEVO H1.14 — ventana de Contratiempo (GDD §2.7, "1 turno atrás"; ver spec §0.4).
    if (previousTurnOwner === 'LEADER') {
      // El Líder ya tuvo su oportunidad de jugar Contratiempo sobre el turno de Enemigo
      // anterior; esa ventana se cierra ahora, sin importar si se usó o no.
      this.previousEnemyTurnLog = [];
      this.currentEnemyTurnLog = [];
    } else {
      // previousTurnOwner === 'ENEMY': se congela lo acumulado durante SU turno como la
      // ventana disponible para el próximo turno de Líder.
      this.previousEnemyTurnLog = this.currentEnemyTurnLog;
      this.currentEnemyTurnLog = [];
    }

    // NUEVO H1.16 — reset simétrico al de arriba (ver spec §0.3).
    this.minionActionResolvedThisEnemyTurn = false;

    // NUEVO H3.6 — el paso previo gratuito es EXCLUSIVO del turno del Líder, se resetea
    // únicamente cuando el turno entrante es 'LEADER' (nunca para 'ENEMY').
    if (this.turnOwner === 'LEADER') {
      this.leaderFreeStepTakenThisTurn = false;
    }

    // NUEVO H1.16 (rediseño) — limpia la carta de Dramaturgia del turno de Enemigo
    // anterior antes de que empiece uno nuevo, evita que RESOLVE_MINION_ACTION fuera de
    // secuencia lea la carta de un turno pasado.
    if (this.turnOwner === 'ENEMY') {
      this.currentEnemyDramaturgiaCard = undefined;
    }

    // NUEVO H1.16 — presencia pasiva de Secuaces (GDD §3.8), leída y aplicada cada vez
    // que el turno que EMPIEZA es de Enemigo (ver spec §0.7). Se aplica DESPUÉS de la
    // ventana de Contratiempo de arriba para que quede dentro del `currentEnemyTurnLog`
    // recién vaciado de ESTE turno de Enemigo (revertible en el PRÓXIMO END_TURN del
    // Líder).
    if (this.turnOwner === 'ENEMY') {
      const attackAmount = this.minionsInPlay.reduce(
        (sum, m) => sum + (m.passiveEffect.kind === 'ATTACK' ? m.passiveEffect.amount : 0),
        0
      );
      const plotAmount = this.minionsInPlay.reduce(
        (sum, m) => sum + (m.passiveEffect.kind === 'PLOT' ? m.passiveEffect.amount : 0),
        0
      );
      const arrollarAny = this.minionsInPlay.some(
        (m) => m.passiveEffect.kind === 'ATTACK' && m.passiveEffect.arrollar === true
      );

      if (attackAmount > 0) {
        const target = this.resolveDamageTarget(); // NUEVO H1.15
        const effectDef = { arrollar: arrollarAny };
        const source: AbilityActionSource = { sourceId: 'minion-passive', side: 'ENEMY' };
        const leaderDamageBefore = this.leaderDamage;
        const leaderShieldBefore = this.leaderShield;
        const effectEvent = target
          ? this.applyAttackEffectToAlly(source, effectDef, null, attackAmount, target)
          : this.applyAttackEffectToLeader(source, effectDef, null, attackAmount);
        events.push(effectEvent);
        this.eventBus.emit(effectEvent);

        const effectLogEntry: UndoableEnemyActionLogEntry['effect'] =
          effectEvent.type === 'ALLY_DAMAGED'
            ? {
                kind: 'ATTACK',
                target: 'ALLY',
                allyInstanceId: effectEvent.allyInstanceId,
                allyLifeBefore: effectEvent.allyLifeBefore,
                allyLifeAfter: effectEvent.allyLifeAfter,
                leaderDamageBefore,
                leaderDamageAfter: this.leaderDamage,
              }
            : {
                kind: 'ATTACK',
                target: 'LEADER',
                leaderDamageBefore,
                leaderDamageAfter: this.leaderDamage,
                leaderShieldBefore,
                leaderShieldAfter: this.leaderShield,
              };
        this.currentEnemyTurnLog.push({
          origin: 'MINION_PASSIVE',
          sourceId: 'minion-passive',
          effect: effectLogEntry,
        });
      }

      if (plotAmount > 0) {
        const scenarioPlotBefore = this.scenarioPlot;
        this.scenarioPlot = Math.max(0, this.scenarioPlot + plotAmount);
        this.currentEnemyTurnLog.push({
          origin: 'MINION_PASSIVE',
          sourceId: 'minion-passive',
          effect: { kind: 'PLOT', scenarioPlotBefore, scenarioPlotAfter: this.scenarioPlot },
        });
      }

      const passiveEvent: CombatEvent = {
        type: 'MINION_PASSIVE_EFFECTS_APPLIED',
        minionCount: this.minionsInPlay.length,
        attackAmount,
        plotAmount,
        leaderDamageAfter: this.leaderDamage,
        scenarioPlotAfter: this.scenarioPlot,
      };
      events.push(passiveEvent);
      this.eventBus.emit(passiveEvent);
    }

    // NUEVO H1.17 — ver spec §0.3, punto de evaluación 1.
    this.evaluateAndApplyPhaseChanges(events);
    this.evaluateAndApplyCombatEnd(events); // NUEVO H1.18

    // NUEVO H1.18 — turno de IA automático (§0.5/§0.5.1/§0.5.2). Solo si la IA está
    // habilitada (enemyAbilityAiProfiles + dramaturgiaDeck ambos poblados) Y el turno
    // que ACABA de abrir es el del Enemigo (nunca se dispara para el cierre LEADER de
    // la propia recursión, ver guarda anti-recursión infinita §0.5.2). `enemyAiEnabled`
    // en el propio guard exterior (no solo dentro de `runAutomaticEnemyTurn`) es lo que
    // preserva EXACTAMENTE el comportamiento de H1.3-H1.17 cuando la IA no está
    // configurada — sin él, `handleEndTurn` recursaría igual (turnOwner seguiría siendo
    // ENEMY tras un `runAutomaticEnemyTurn` no-op) y devolvería el turno al Líder
    // incondicionalmente, rompiendo los ~200 tests que simulan el turno de Enemigo a mano.
    if (this.enemyAiEnabled && this.turnOwner === 'ENEMY' && this.combatStatus === 'IN_PROGRESS') {
      this.runAutomaticEnemyTurn(events);
      if (this.combatStatus === 'IN_PROGRESS') {
        const closingResult = this.handleEndTurn(); // recursión — flip ENEMY → LEADER
        if (closingResult.ok) events.push(...closingResult.value);
      }
    }

    return ok(events);
  }

  private handlePlayContratiempo(
    command: Extract<CombatCommand, { type: 'PLAY_CONTRATIEMPO' }>
  ): CombatCommandResult {
    const def = this.contratiempoCards.get(command.cardId);
    if (!def) {
      return err({ code: 'CONTRATIEMPO_CARD_UNKNOWN', cardId: command.cardId });
    }

    // NUEVO H3.6 — ver spec §2.7.
    if (!this.leaderHand.includes(command.cardId)) {
      return err({ code: 'CARD_NOT_IN_HAND', cardId: command.cardId });
    }

    // Contratiempo es exclusivo del Líder (GDD §2.7) — ver comentario en types/commands.ts.
    if (this.turnOwner !== 'LEADER') {
      return err({ code: 'NOT_YOUR_TURN', expected: 'LEADER', actual: this.turnOwner });
    }

    if (this.actionsTakenThisTurn >= this.actionsAllowedThisTurn) {
      return err({
        code: 'NO_ACTIONS_REMAINING',
        side: this.turnOwner,
        actionsTaken: this.actionsTakenThisTurn,
        actionsAllowed: this.actionsAllowedThisTurn,
      });
    }

    if (this.leaderEnergy < def.energyCost) {
      return err({
        code: 'CONTRATIEMPO_INSUFFICIENT_ENERGY',
        cardId: command.cardId,
        required: def.energyCost,
        available: this.leaderEnergy,
      });
    }

    if (this.previousEnemyTurnLog.length === 0) {
      return err({ code: 'CONTRATIEMPO_NOTHING_TO_UNDO', cardId: command.cardId });
    }

    // Mutación.
    this.leaderEnergy -= def.energyCost;
    this.actionsTakenThisTurn += 1;
    this.removeOneFromHand(command.cardId); // NUEVO H3.6

    // NUEVO H1.16 — FIX del bug #25 (QA H1.14, ver spec §0.4): antes de esta historia,
    // el bucle sobrescribía cada contador con el "antes" de la ÚLTIMA entrada de su tipo
    // en vez de acumular al de la PRIMERA — código muerto mientras
    // `revertedEntries.length <= 1` (cierto hasta H1.15), pero `RESOLVE_MINION_ACTION`
    // (H1.16 §0.3) puede generar una 2ª entrada ATTACK/PLOT de side ENEMY en el mismo
    // turno. "Primera entrada de cada contador gana" es equivalente a revertir la suma
    // completa de deltas SIN necesidad de sumarlos explícitamente, porque
    // `entry[i].xBefore === entry[i-1].xAfter` para toda `i > 0` dentro de esta ventana
    // (invariante estructural: son mutaciones consecutivas del mismo turno de Enemigo).
    // Se generaliza a N entradas, no solo 2.
    let leaderDamageReverted = false;
    let leaderShieldReverted = false;
    let scenarioPlotReverted = false;
    const allyLifeReverted = new Set<CardInstanceId>();

    const revertedEntries = [...this.previousEnemyTurnLog];
    for (const entry of revertedEntries) {
      // NUEVO H1.16 — el guard `entry.origin === 'ABILITY'` evita tocar
      // `remainingCooldowns` para entradas `MINION_PLANO_ATTACK`/`MINION_PASSIVE`, que no
      // tienen `abilityId`/`cooldownBefore` (sin habilidad de catálogo detrás).
      if (def.undoScope === 'FULL_TURN' && entry.origin === 'ABILITY') {
        this.remainingCooldowns.set(entry.abilityId as AbilityId, entry.cooldownBefore as number);
      }
      if (!entry.effect) continue;

      if (entry.effect.kind === 'ATTACK') {
        // El daño SIEMPRE se revierte, en ambos alcances — GDD: "algunas revierten solo
        // el daño" ya implica que el daño se revierte también en FULL_TURN.
        if (!leaderDamageReverted) {
          this.leaderDamage = entry.effect.leaderDamageBefore;
          leaderDamageReverted = true;
        }
        if (entry.effect.target === 'LEADER') {
          if (!leaderShieldReverted) {
            this.leaderShield = entry.effect.leaderShieldBefore;
            leaderShieldReverted = true;
          }
        } else if (!allyLifeReverted.has(entry.effect.allyInstanceId)) {
          // target === 'ALLY' — NUEVO H1.15, ver spec H1.15 §0.7. Caso borde H1.16 §0.4:
          // si el MISMO Aliado es golpeado 2 veces en el turno, solo la PRIMERA aparición
          // revierte su vida (a la de ANTES del primer golpe) — la 2ª se ignora.
          allyLifeReverted.add(entry.effect.allyInstanceId);
          const allyEffect = entry.effect;
          this.alliesInPlay = this.alliesInPlay.map((a) =>
            a.instanceId === allyEffect.allyInstanceId ? { ...a, life: allyEffect.allyLifeBefore } : a
          );
        }
      } else if (def.undoScope === 'FULL_TURN' && !scenarioPlotReverted) {
        // Trama SOLO se revierte en alcance FULL_TURN — DAMAGE_ONLY nunca la toca.
        this.scenarioPlot = entry.effect.scenarioPlotBefore;
        scenarioPlotReverted = true;
      }
    }

    // GDD §2.7: "Lo cancelado se descarta" — consumo de un solo uso, ver spec §0.4.
    this.previousEnemyTurnLog = [];

    const playedEvent: CombatEvent = {
      type: 'CONTRATIEMPO_PLAYED',
      cardId: command.cardId,
      sourceId: command.sourceId,
      undoScope: def.undoScope,
      energySpent: def.energyCost,
      leaderEnergyAfter: this.leaderEnergy,
      revertedEntries,
      leaderDamageAfter: this.leaderDamage,
      leaderShieldAfter: this.leaderShield,
      scenarioPlotAfter: this.scenarioPlot,
    };
    const events: CombatEvent[] = [playedEvent];
    this.eventBus.emit(playedEvent);

    // NUEVO H1.18 — defensivo: revertir daño nunca sube un contador, pero se llama por
    // consistencia y para no dejar un hueco silencioso (ver spec §0.6).
    this.evaluateAndApplyCombatEnd(events);

    return ok(events);
  }

  /** NUEVO H1.15 — ver spec H1.15 §3.4/§4.7. */
  private handlePlayAlly(
    command: Extract<CombatCommand, { type: 'PLAY_ALLY' }>
  ): CombatCommandResult {
    const def = this.allyCards.get(command.cardId);
    if (!def) {
      return err({ code: 'ALLY_CARD_UNKNOWN', cardId: command.cardId });
    }

    // NUEVO H3.6 — ver spec §2.7.
    if (!this.leaderHand.includes(command.cardId)) {
      return err({ code: 'CARD_NOT_IN_HAND', cardId: command.cardId });
    }

    if (this.turnOwner !== 'LEADER') {
      return err({ code: 'NOT_YOUR_TURN', expected: 'LEADER', actual: this.turnOwner });
    }

    if (this.actionsTakenThisTurn >= this.actionsAllowedThisTurn) {
      return err({
        code: 'NO_ACTIONS_REMAINING',
        side: this.turnOwner,
        actionsTaken: this.actionsTakenThisTurn,
        actionsAllowed: this.actionsAllowedThisTurn,
      });
    }

    if (this.leaderEnergy < def.energyCost) {
      return err({
        code: 'ALLY_INSUFFICIENT_ENERGY',
        cardId: command.cardId,
        required: def.energyCost,
        available: this.leaderEnergy,
      });
    }

    // Mutación.
    this.leaderEnergy -= def.energyCost;
    this.actionsTakenThisTurn += 1;
    this.removeOneFromHand(command.cardId); // NUEVO H3.6

    const instanceId = this.nextCardInstanceId();
    const ally: AllyInPlay = {
      instanceId,
      cardId: command.cardId,
      isBerserker: def.isBerserker,
      maxLife: def.life,
      life: def.life,
    };
    this.alliesInPlay = [...this.alliesInPlay, ally];

    // Calentamiento (GDD §2.5) de las habilidades propias del Aliado, si las tiene.
    for (const abilityId of def.abilityIds ?? []) {
      const cdDef = this.abilityCooldowns.get(abilityId);
      if (cdDef) this.remainingCooldowns.set(abilityId, cdDef.baseCooldown);
    }

    const event: CombatEvent = {
      type: 'ALLY_ENTERED_PLAY',
      cardId: command.cardId,
      sourceId: command.sourceId,
      allyInstanceId: instanceId,
      maxLife: def.life,
      isBerserker: def.isBerserker,
      leaderEnergyAfter: this.leaderEnergy,
    };
    this.eventBus.emit(event);

    return ok([event]);
  }

  /** NUEVO H1.15 — ver spec H1.15 §0.3/§3.5/§4.8. */
  private handleSetDamageRedirect(
    command: Extract<CombatCommand, { type: 'SET_DAMAGE_REDIRECT' }>
  ): CombatCommandResult {
    if (command.targetAllyInstanceId !== null) {
      const target = this.alliesInPlay.find(
        (a) => a.instanceId === command.targetAllyInstanceId && a.life > 0
      );
      if (!target) {
        return err({
          code: 'REDIRECT_TARGET_NOT_FOUND',
          targetAllyInstanceId: command.targetAllyInstanceId,
        });
      }
    }

    // Mutación — sin tocar acciones/Energía/Núcleo (ver spec §0.3).
    this.activeDamageRedirectTargetId = command.targetAllyInstanceId;

    const forcedByBerserker = this.alliesInPlay.some((a) => a.isBerserker && a.life > 0);
    const event: CombatEvent = {
      type: 'DAMAGE_REDIRECT_SET',
      targetAllyInstanceId: command.targetAllyInstanceId,
      forcedByBerserker,
    };
    this.eventBus.emit(event);

    return ok([event]);
  }

  /** NUEVO H1.16 — ver spec H1.16 §0.3/§4.3. */
  private handleSummonMinion(
    command: Extract<CombatCommand, { type: 'SUMMON_MINION' }>
  ): CombatCommandResult {
    const def = this.minionDefinitions.get(command.minionDefinitionId);
    if (!def) {
      return err({ code: 'MINION_DEFINITION_UNKNOWN', minionDefinitionId: command.minionDefinitionId });
    }

    if (this.turnOwner !== 'ENEMY') {
      return err({ code: 'NOT_YOUR_TURN', expected: 'ENEMY', actual: this.turnOwner });
    }

    // Mutación — sin coste de acción/Núcleo/Energía (ver spec §0.3).
    const instanceId = this.nextMinionInstanceId();
    const minion: MinionInPlay = {
      instanceId,
      definitionId: command.minionDefinitionId,
      passiveEffect: def.passiveEffect,
      planoAttackAmount: def.planoAttackAmount,
      isDefensor: def.isDefensor,
      maxLife: def.maxLife, // NUEVO §3.9.1
      life: def.maxLife, // NUEVO §3.9.1 — sin Secuaces que entren a mesa ya heridos en el MVP
      // NUEVO H1.16 — `exactOptionalPropertyTypes`: solo se incluye la clave si la
      // definición declara una acción especial.
      ...(def.specialActionAbilityId !== undefined ? { specialActionAbilityId: def.specialActionAbilityId } : {}),
    };
    this.minionsInPlay = [...this.minionsInPlay, minion];

    const event: CombatEvent = {
      type: 'MINION_SUMMONED',
      minionDefinitionId: command.minionDefinitionId,
      sourceId: command.sourceId,
      instanceId,
      isDefensor: def.isDefensor,
    };
    this.eventBus.emit(event);

    return ok([event]);
  }

  /** MODIFICADO H1.16 (rediseño) — ver spec §3.6. QUÉ Secuaz(ces) actúan lo decide
   *  `selectActingMinions` a partir del `minionBehavior` de la carta de Dramaturgia
   *  robada este turno de Enemigo — el motor ya no elige al azar entre todos los
   *  Secuaces válidos. */
  private handleResolveMinionAction(
    command: Extract<CombatCommand, { type: 'RESOLVE_MINION_ACTION' }>
  ): CombatCommandResult {
    void command;

    if (this.turnOwner !== 'ENEMY') {
      return err({ code: 'NOT_YOUR_TURN', expected: 'ENEMY', actual: this.turnOwner });
    }

    if (this.minionActionResolvedThisEnemyTurn) {
      return err({ code: 'MINION_ACTION_ALREADY_RESOLVED_THIS_TURN' });
    }

    this.minionActionResolvedThisEnemyTurn = true;

    if (this.minionsInPlay.length === 0) {
      const event: CombatEvent = { type: 'MINION_ACTION_SKIPPED', reason: 'NO_MINIONS_IN_PLAY' };
      this.eventBus.emit(event);
      return ok([event]);
    }

    const behavior = this.currentEnemyDramaturgiaCard?.minionBehavior;
    const actors = selectActingMinions(behavior, this.minionsInPlay, this.randomSource);

    if (actors.length === 0) {
      // NUEVO H1.16 (rediseño) — la carta de Dramaturgia de este turno no menciona
      // Secuaces (o su criterio no resolvió a ninguno).
      const event: CombatEvent = { type: 'MINION_ACTION_SKIPPED', reason: 'NOT_SPECIFIED_BY_DRAMATURGIA' };
      this.eventBus.emit(event);
      return ok([event]);
    }

    const events: CombatEvent[] = [];
    for (const minion of actors) {
      // Un Secuaz puede haber muerto por una acción anterior en este mismo `for` (por
      // ejemplo un efecto ATTACK que redirige daño de forma inesperada) — defensivo,
      // se salta si ya no está en mesa.
      if (!this.minionsInPlay.some((m) => m.instanceId === minion.instanceId)) continue;

      events.push(...this.resolveOneMinionAction(minion));
      if (this.combatStatus !== 'IN_PROGRESS') break; // NUEVO H1.18 — parada de cascada
    }

    return ok(events);
  }

  /**
   * NUEVO H1.16 (rediseño) — extraído del cuerpo original de `handleResolveMinionAction`
   * (H1.16 primera versión) para UN Secuaz ya elegido por `selectActingMinions`: acción
   * especial si CD/Núcleo listos, si no plano attack. Sin cambio de comportamiento por
   * Secuaz individual respecto a la versión original.
   */
  private resolveOneMinionAction(minion: MinionInPlay): CombatEvent[] {
    const availableDice = this.nucleoTable.filter((d) => d.status === 'AVAILABLE'); // NUEVO H3.4

    const canUseSpecial =
      minion.specialActionAbilityId !== undefined &&
      (this.remainingCooldowns.get(minion.specialActionAbilityId) ?? 0) === 0 &&
      this.abilityCoreCosts.has(minion.specialActionAbilityId) &&
      poolHasValidNucleo(this.abilityCoreCosts.get(minion.specialActionAbilityId) as CoreCostRequirement, availableDice);

    if (canUseSpecial) {
      const abilityId = minion.specialActionAbilityId as AbilityId;
      const requirement = this.abilityCoreCosts.get(abilityId) as CoreCostRequirement;
      const playerColors = derivePlayerColorsFromLeaderAbilities(this.abilityCoreCosts, this.abilityCooldowns);
      const nucleoDecision = decideEnemyNucleoToSpend(requirement, availableDice, playerColors, this.randomSource);

      const { events: sharedEvents, effectLogEntry, cooldownBefore } = this.executeAbilityEffect(
        abilityId,
        minion.instanceId,
        'ENEMY',
        nucleoDecision.nucleo
      );
      const events: CombatEvent[] = [...sharedEvents];

      this.currentEnemyTurnLog.push({
        origin: 'ABILITY',
        abilityId,
        sourceId: minion.instanceId,
        cooldownBefore,
        ...(effectLogEntry ? { effect: effectLogEntry } : {}),
      });

      this.maybeRerollNucleoTable(events); // MODIFICADO H3.4

      const resolvedEvent: CombatEvent = {
        type: 'MINION_ACTION_RESOLVED',
        instanceId: minion.instanceId,
        mechanism: 'SPECIAL_ACTION',
      };
      events.push(resolvedEvent);
      this.eventBus.emit(resolvedEvent);

      this.evaluateAndApplyPhaseChanges(events); // NUEVO H1.17
      this.evaluateAndApplyCombatEnd(events); // NUEVO H1.18

      return events;
    }

    const events: CombatEvent[] = [];

    const target = this.resolveDamageTarget(); // NUEVO H1.15
    const effectDef = { arrollar: false };
    const source: AbilityActionSource = { sourceId: minion.instanceId, side: 'ENEMY' };
    const leaderDamageBefore = this.leaderDamage;
    const leaderShieldBefore = this.leaderShield;
    const effectEvent = target
      ? this.applyAttackEffectToAlly(source, effectDef, null, minion.planoAttackAmount, target)
      : this.applyAttackEffectToLeader(source, effectDef, null, minion.planoAttackAmount);
    events.push(effectEvent);
    this.eventBus.emit(effectEvent);

    const effectLogEntry: UndoableEnemyActionLogEntry['effect'] =
      effectEvent.type === 'ALLY_DAMAGED'
        ? {
            kind: 'ATTACK',
            target: 'ALLY',
            allyInstanceId: effectEvent.allyInstanceId,
            allyLifeBefore: effectEvent.allyLifeBefore,
            allyLifeAfter: effectEvent.allyLifeAfter,
            leaderDamageBefore,
            leaderDamageAfter: this.leaderDamage,
          }
        : {
            kind: 'ATTACK',
            target: 'LEADER',
            leaderDamageBefore,
            leaderDamageAfter: this.leaderDamage,
            leaderShieldBefore,
            leaderShieldAfter: this.leaderShield,
          };

    this.currentEnemyTurnLog.push({
      origin: 'MINION_PLANO_ATTACK',
      sourceId: minion.instanceId,
      effect: effectLogEntry,
    });

    const resolvedEvent: CombatEvent = {
      type: 'MINION_ACTION_RESOLVED',
      instanceId: minion.instanceId,
      mechanism: 'PLANO_ATTACK',
    };
    events.push(resolvedEvent);
    this.eventBus.emit(resolvedEvent);

    this.evaluateAndApplyPhaseChanges(events); // NUEVO H1.17
    this.evaluateAndApplyCombatEnd(events); // NUEVO H1.18

    return events;
  }

  /**
   * NUEVO H1.18 — ver spec §0.1/§3.5. Baja una carta EVENTO/EQUIPO de `playableCards`
   * (sin mano ni mazo). Exclusivo del Líder, consume 1 acción + Energía. Reutiliza
   * `resolveAbilityUmbral` (H1.5) tal cual para el efecto `ATTACK_ENEMY`.
   */
  private handlePlayCard(
    command: Extract<CombatCommand, { type: 'PLAY_CARD' }>
  ): CombatCommandResult {
    const def = this.playableCards.get(command.cardId);
    if (!def) {
      return err({ code: 'PLAY_CARD_UNKNOWN', cardId: command.cardId });
    }

    // NUEVO H3.6 — ver spec §2.7.
    if (!this.leaderHand.includes(command.cardId)) {
      return err({ code: 'CARD_NOT_IN_HAND', cardId: command.cardId });
    }

    if (this.turnOwner !== 'LEADER') {
      return err({ code: 'NOT_YOUR_TURN', expected: 'LEADER', actual: this.turnOwner });
    }

    if (this.actionsTakenThisTurn >= this.actionsAllowedThisTurn) {
      return err({
        code: 'NO_ACTIONS_REMAINING',
        side: this.turnOwner,
        actionsTaken: this.actionsTakenThisTurn,
        actionsAllowed: this.actionsAllowedThisTurn,
      });
    }

    if (this.leaderEnergy < def.energyCost) {
      return err({
        code: 'PLAY_CARD_INSUFFICIENT_ENERGY',
        cardId: command.cardId,
        required: def.energyCost,
        available: this.leaderEnergy,
      });
    }

    let die: NucleoDie | undefined;
    let resolvedTarget: AttackTarget | undefined;
    if (def.effect?.kind === 'ATTACK_ENEMY') {
      if (!command.nucleoInstanceId) {
        return err({ code: 'PLAY_CARD_NUCLEO_REQUIRED', cardId: command.cardId });
      }
      const found = this.nucleoTable.find((d) => d.id === command.nucleoInstanceId);
      if (!found) {
        return err({ code: 'NUCLEO_NOT_FOUND', nucleoInstanceId: command.nucleoInstanceId });
      }
      if (found.status === 'SPENT') {
        return err({ code: 'NUCLEO_ALREADY_SPENT', nucleoInstanceId: command.nucleoInstanceId });
      }
      die = found;

      // NUEVO §3.9.3 — targeting explícito Enemigo/Secuaz.
      if (!command.target) {
        return err({ code: 'PLAY_CARD_TARGET_REQUIRED', cardId: command.cardId });
      }

      const liveDefensores = this.minionsInPlay.filter((m) => m.isDefensor);
      if (liveDefensores.length > 0) {
        const targetsAllowedDefensor =
          command.target.kind === 'MINION' &&
          liveDefensores.some((m) => m.instanceId === (command.target as Extract<AttackTarget, { kind: 'MINION' }>).minionInstanceId);
        if (!targetsAllowedDefensor) {
          return err({
            code: 'MUST_TARGET_DEFENSOR',
            cardId: command.cardId,
            defensorInstanceIds: liveDefensores.map((m) => m.instanceId),
          });
        }
      }

      if (command.target.kind === 'MINION') {
        const minion = this.minionsInPlay.find((m) => m.instanceId === (command.target as Extract<AttackTarget, { kind: 'MINION' }>).minionInstanceId);
        if (!minion) {
          return err({ code: 'ATTACK_TARGET_NOT_FOUND', minionInstanceId: command.target.minionInstanceId });
        }
      }

      resolvedTarget = command.target;
    }

    // Mutación — desde aquí ninguna validación previa debe tener efectos secundarios.
    this.leaderEnergy -= def.energyCost;
    this.actionsTakenThisTurn += 1;
    this.removeOneFromHand(command.cardId); // NUEVO H3.6

    const events: CombatEvent[] = [];
    const playedEvent: CombatEvent = {
      type: 'CARD_PLAYED',
      cardId: command.cardId,
      sourceId: command.sourceId,
      leaderEnergyAfter: this.leaderEnergy,
    };
    events.push(playedEvent);
    this.eventBus.emit(playedEvent);

    if (die) {
      // MODIFICADO H3.4 — gastar un dado cambia su status a SPENT, nunca lo elimina de la mesa.
      const spentId = die.id;
      this.nucleoTable = this.nucleoTable.map((d) => (d.id === spentId ? { ...d, status: 'SPENT' as const } : d));
    }

    // NUEVO H3.4 — ver comentario equivalente en handleActivateAbility.
    const nucleo: NucleoInstance | undefined = die ? { id: die.id, color: die.color, value: die.value } : undefined;
    this.applyPlayableCardEffect(command, def.effect, nucleo, resolvedTarget, events);

    this.maybeRerollNucleoTable(events); // MODIFICADO H3.4

    this.evaluateAndApplyPhaseChanges(events);
    this.evaluateAndApplyCombatEnd(events); // NUEVO H1.18

    return ok(events);
  }

  /** NUEVO H1.18 — extraído de `handlePlayCard` para mantenerlo legible. Resuelve el
   *  efecto (si lo hay) de una carta ya validada/pagada. */
  private applyPlayableCardEffect(
    command: Extract<CombatCommand, { type: 'PLAY_CARD' }>,
    effect: PlayableCardEffectDefinition | undefined,
    nucleo: NucleoInstance | undefined,
    resolvedTarget: AttackTarget | undefined,
    events: CombatEvent[]
  ): void {
    if (!effect) return;

    if (effect.kind === 'ATTACK_ENEMY') {
      const resolution = resolveAbilityUmbral(effect.formula, (nucleo as NucleoInstance).value);
      const rawAmount = resolution.baseResolvedValue;

      if (resolvedTarget?.kind === 'MINION') {
        // NUEVO §3.9.3 — camino Secuaz.
        const minion = this.minionsInPlay.find((m) => m.instanceId === resolvedTarget.minionInstanceId) as MinionInPlay;
        const lifeBefore = minion.life;
        const lifeAfter = Math.max(0, lifeBefore - rawAmount);
        const excess = Math.max(0, rawAmount - lifeBefore);
        const died = lifeAfter <= 0;
        const appliedDamageToEnemy = died && effect.arrollar === true ? excess : 0;

        if (died) {
          // decisions.md punto 3: "sale de mesa de inmediato".
          this.minionsInPlay = this.minionsInPlay.filter((m) => m.instanceId !== minion.instanceId);
        } else {
          this.minionsInPlay = this.minionsInPlay.map((m) =>
            m.instanceId === minion.instanceId ? { ...m, life: lifeAfter } : m
          );
        }
        this.enemyDamage += appliedDamageToEnemy;

        const dmgEvent: CombatEvent = {
          type: 'MINION_DAMAGED',
          cardId: command.cardId,
          sourceId: command.sourceId,
          nucleoSpent: nucleo as NucleoInstance,
          minionInstanceId: minion.instanceId,
          rawAmount,
          lifeBefore,
          lifeAfter,
          died,
          excess,
          appliedDamageToEnemy,
          enemyDamageAfter: this.enemyDamage,
        };
        events.push(dmgEvent);
        this.eventBus.emit(dmgEvent);

        if (died) {
          const defeatedEvent: CombatEvent = {
            type: 'MINION_DEFEATED',
            instanceId: minion.instanceId,
            definitionId: minion.definitionId,
            cause: 'PLAYER_ATTACK',
          };
          events.push(defeatedEvent);
          this.eventBus.emit(defeatedEvent);
        }
        return;
      }

      // Camino EXISTENTE (target ENEMY), sin cambios de comportamiento.
      this.enemyDamage += rawAmount;
      const dmgEvent: CombatEvent = {
        type: 'ENEMY_DAMAGED',
        cardId: command.cardId,
        sourceId: command.sourceId,
        nucleoSpent: nucleo as NucleoInstance,
        rawAmount,
        bonusActivated: resolution.bonusActivated,
        ...(resolution.bonusResolvedValue !== undefined ? { bonusResolvedValue: resolution.bonusResolvedValue } : {}),
        enemyDamageAfter: this.enemyDamage,
      };
      events.push(dmgEvent);
      this.eventBus.emit(dmgEvent);
    } else if (effect.kind === 'ADD_NUCLEO_DIE') {
      // NUEVO H3.4 — `PLAY_CARD` sigue teniendo éxito completo aunque el efecto de
      // añadir dado se ignore por tope (decisions.md).
      this.addExtraNucleoDie(effect.color, events);
    } else if (effect.kind === 'PLOT') {
      // TRAMA_X siempre DECREASE (§0.1.1) — exclusivo del Líder, satura en 0.
      this.scenarioPlot = Math.max(0, this.scenarioPlot - effect.amount);
      const plotEvent: CombatEvent = {
        type: 'SCENARIO_PLOT_CHANGED',
        // Sin abilityId — este cambio de Trama viene de una carta, no de una habilidad
        // de catálogo (ver spec §3.5, nota de implementación).
        sourceId: command.sourceId,
        side: 'LEADER',
        direction: 'DECREASE',
        rawAmount: effect.amount,
        appliedDelta: -effect.amount,
        scenarioPlotAfter: this.scenarioPlot,
      };
      events.push(plotEvent);
      this.eventBus.emit(plotEvent);
    } else {
      // effect.kind === 'SHIELD' — DEFENSA_X, cierra deuda de H1.6 §0.1.
      const leaderShieldBefore = this.leaderShield;
      this.leaderShield = Math.min(LEADER_SHIELD_MAX, this.leaderShield + effect.amount);
      const shieldEvent: CombatEvent = {
        type: 'LEADER_SHIELD_GAINED',
        cardId: command.cardId,
        sourceId: command.sourceId,
        rawAmount: effect.amount,
        leaderShieldBefore,
        leaderShieldAfter: this.leaderShield,
      };
      events.push(shieldEvent);
      this.eventBus.emit(shieldEvent);
    }
  }

  /**
   * NUEVO H1.18 — ver spec §0.5/§3.6. Decide Y ejecuta la acción del turno de Enemigo
   * (Capa 1+2 de IA, H1.7) reutilizando el mismo camino interno que
   * `ACTIVATE_ABILITY`/`RESOLVE_MINION_ACTION`. Solo se invoca cuando `enemyAiEnabled`
   * es `true` — no-op en caso contrario (comportamiento idéntico a H1.3-H1.17).
   */
  private runAutomaticEnemyTurn(events: CombatEvent[]): void {
    if (!this.enemyAiEnabled) return;

    const icon = this.drawDramaturgiaCard(events);
    const candidates = this.buildEnemyAbilityCandidates();
    const availableDice = this.nucleoTable.filter((d) => d.status === 'AVAILABLE'); // MODIFICADO H3.4
    const decision = decideEnemyAbility(icon, candidates, availableDice, this.randomSource);

    const requirement = this.abilityCoreCosts.get(decision.abilityId) as CoreCostRequirement;
    const playerColors = derivePlayerColorsFromLeaderAbilities(this.abilityCoreCosts, this.abilityCooldowns);
    const nucleoDecision = decideEnemyNucleoToSpend(requirement, availableDice, playerColors, this.randomSource);

    const abilityResult = this.handleActivateAbility({
      type: 'ACTIVATE_ABILITY',
      abilityId: decision.abilityId,
      sourceId: 'enemy',
      side: 'ENEMY',
      nucleoInstanceId: nucleoDecision.nucleo.id,
    });
    // handleActivateAbility no puede fallar aquí por construcción: decideEnemyAbility/
    // decideEnemyNucleoToSpend ya garantizan CD listo + Núcleo válido (mismas
    // invariantes que H1.7 ya probó exhaustivamente) — si lanzara, sería un bug de
    // contenido (perfil de IA mal formado), no un caso de juego a manejar aquí.
    if (abilityResult.ok) events.push(...abilityResult.value);

    if (this.combatStatus !== 'IN_PROGRESS') return; // NUEVO H1.18 — parada de cascada (§0.6)

    if (this.minionsInPlay.length > 0) {
      const minionResult = this.handleResolveMinionAction({ type: 'RESOLVE_MINION_ACTION' });
      if (minionResult.ok) events.push(...minionResult.value);
    }
  }

  /**
   * NUEVO H1.18 — ver spec §0.5.3. Roba 1 carta de Dramaturgia de la pila privada,
   * reciclando la pila de descarte (barajada) si la de robo está vacía.
   */
  private drawDramaturgiaCard(events: CombatEvent[]): DramaturgiaCardIcon {
    if (this.dramaturgiaDrawPile.length === 0) {
      this.dramaturgiaDrawPile = this.shuffle(this.dramaturgiaDiscardPile);
      this.dramaturgiaDiscardPile = [];
      const reshuffled: CombatEvent = {
        type: 'DRAMATURGIA_DECK_RESHUFFLED',
        deckSize: this.dramaturgiaDrawPile.length,
      };
      events.push(reshuffled);
      this.eventBus.emit(reshuffled);
    }
    const card = this.dramaturgiaDrawPile.pop() as DramaturgiaCardDefinition;
    this.dramaturgiaDiscardPile.push(card);
    this.currentEnemyDramaturgiaCard = card; // NUEVO H1.16 (rediseño)
    const drawn: CombatEvent = { type: 'DRAMATURGIA_CARD_DRAWN', icon: card.icon };
    events.push(drawn);
    this.eventBus.emit(drawn);
    return card.icon;
  }

  /** NUEVO H1.18 — ensambla la vista `EnemyAbilityCandidate[]` que pide `decideEnemyAbility`
   *  (H1.7) a partir de `enemyAbilityAiProfiles` + `abilityCoreCosts`/`abilityCooldowns`/
   *  `remainingCooldowns` ya existentes. */
  private buildEnemyAbilityCandidates(): EnemyAbilityCandidate[] {
    const result: EnemyAbilityCandidate[] = [];
    for (const [abilityId, aiProfile] of this.enemyAbilityAiProfiles) {
      const coreCost = this.abilityCoreCosts.get(abilityId) as CoreCostRequirement;
      const cooldownDef = this.abilityCooldowns.get(abilityId) as AbilityCooldownDefinition;
      result.push({
        abilityId,
        coreCost,
        baseCooldown: cooldownDef.baseCooldown,
        remainingCooldown: this.remainingCooldowns.get(abilityId) ?? 0,
        aiProfile,
      });
    }
    return result;
  }

  subscribe(listener: (event: CombatEvent) => void): Unsubscribe {
    return this.eventBus.subscribe(listener);
  }

  getSnapshot(): CombatStateSnapshot {
    return {
      turn: { turnOwner: this.turnOwner, turnNumber: this.turnNumber },
      nucleoTable: [...this.nucleoTable],
      cooldowns: this.buildCooldownSnapshot(),
      leaderDamage: this.leaderDamage, // NUEVO H1.6
      leaderShield: this.leaderShield, // NUEVO H1.6
      scenarioPlot: this.scenarioPlot, // NUEVO H1.6
      leaderEnergy: this.leaderEnergy, // NUEVO H1.14
      actions: {
        side: this.turnOwner,
        actionsTaken: this.actionsTakenThisTurn,
        actionsAllowed: this.actionsAllowedThisTurn,
        comboBonusGranted: this.comboBonusGrantedThisTurn,
      }, // NUEVO H1.14
      undoableLastEnemyTurn: [...this.previousEnemyTurnLog], // NUEVO H1.14
      alliesInPlay: [...this.alliesInPlay], // NUEVO H1.15
      activeDamageRedirectTargetId: this.activeDamageRedirectTargetId, // NUEVO H1.15
      minionsInPlay: [...this.minionsInPlay], // NUEVO H1.16
      leaderState: {
        level: LEADER_LEVEL_BASE + this.leaderLevelUpsSpent,
        levelUpsSpent: this.leaderLevelUpsSpent,
      }, // NUEVO H1.17
      enemyPhase:
        this.enemyPhases.length === 0
          ? { phaseNumber: 0, totalPhases: 0 }
          : {
              phaseNumber: (this.enemyPhases[this.enemyPhaseIndex] as PhaseDefinition).phaseNumber,
              totalPhases: this.enemyPhases.length,
            }, // NUEVO H1.17
      scenarioPhase:
        this.scenarioPhases.length === 0
          ? { phaseNumber: 0, totalPhases: 0 }
          : {
              phaseNumber: (this.scenarioPhases[this.scenarioPhaseIndex] as PhaseDefinition).phaseNumber,
              totalPhases: this.scenarioPhases.length,
            }, // NUEVO H1.17
      enemyDamage: this.enemyDamage, // NUEVO H1.17
      status: this.combatStatus, // NUEVO H1.18
      ...(this.defeatReason !== undefined ? { defeatReason: this.defeatReason } : {}), // NUEVO H1.18
      leaderHand: [...this.leaderHand], // NUEVO H3.6
      leaderDeckRemaining: this.leaderDeckDrawPile.length, // NUEVO H3.6
      leaderFreeStep: { takenThisTurn: this.leaderFreeStepTakenThisTurn }, // NUEVO H3.6
    };
  }
}
