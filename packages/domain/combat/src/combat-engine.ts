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
} from '@collector/domain-shared';
import type { CombatCommand } from './types/commands';
import type { CombatEvent } from './types/events';
import type { CombatCommandResult } from './types/errors';
import type { CombatStateSnapshot } from './types/snapshot';
import type { CombatEngineConfig } from './types/config';
import type { CombatSide } from './types/turn';
import type { NucleoInstance } from './types/nucleo';
import type { AbilityCooldownDefinition, AbilityCooldownSnapshot } from './types/cooldown';
import { ABILITY_BASE_COOLDOWN_MIN } from './types/cooldown';
import type { AbilityEffectDefinition } from './types/ability-effect'; // NUEVO H1.6
import { LEADER_SHIELD_MAX } from './types/ability-effect'; // NUEVO H1.6
import { resolveAbilityUmbral } from './umbral'; // NUEVO H1.6 — conecta H1.5 con mutación real (spec §0.2)
import type { UmbralFormula } from './types/umbral';
import { rollPool, DEFAULT_NUCLEO_POOL_SIZE } from './nucleo-pool';
import { baseActionsForSide, COMBO_MAX_BONUS_ACTIONS_PER_TURN } from './types/action'; // NUEVO H1.14
import { LEADER_ENERGY_MAX, LEADER_ENERGY_INITIAL_DEFAULT } from './types/energy'; // NUEVO H1.14
import type {
  ContratiempoCardDefinition,
  UndoableEnemyActionLogEntry,
} from './types/contratiempo'; // NUEVO H1.14
import type { AllyCardDefinition, AllyInPlay } from './types/ally'; // NUEVO H1.15
import type { MinionDefinition, MinionDefinitionId, MinionInPlay } from './types/minion'; // NUEVO H1.16
import { poolHasValidNucleo, decideEnemyNucleoToSpend, derivePlayerColorsFromLeaderAbilities } from './enemy-ai'; // NUEVO H1.16, reusa H1.7

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
  private readonly poolSize: number;
  private readonly eventBus: EventBus<CombatEvent>;

  private turnOwner: CombatSide;
  private turnNumber: number;
  private nucleoPool: NucleoInstance[];
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

  constructor(config: CombatEngineConfig) {
    this.randomSource = config.randomSource;
    this.abilityCoreCosts = config.abilityCoreCosts;
    this.abilityCooldowns = config.abilityCooldowns;
    this.validateAbilityCooldownsConfig();

    this.abilityEffects = config.abilityEffects ?? new Map(); // NUEVO H1.6
    this.validateAbilityEffectsConfig(); // NUEVO H1.6

    this.poolSize = config.poolSize ?? DEFAULT_NUCLEO_POOL_SIZE;
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

    this.nucleoPool = this.rollNewPool();

    // GDD §2.2 paso 2 ("Cooldowns propios bajan en 1") se aplica también en el
    // primerísimo turno de la partida (turnNumber=1, antes de cualquier acción) — no
    // es exclusivo de los turnos posteriores a un END_TURN. No emite evento (constructor,
    // sin subscriptores todavía) — solo se refleja en getSnapshot(), igual que la
    // tirada inicial del pool (ver H1.3 §5.3).
    this.tickCooldownsForSide(this.turnOwner);
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
        this.validateUmbralFormulaNonNegative(abilityId, effect.formula.baseFormula);
        if (effect.formula.bonusFormula) {
          this.validateUmbralFormulaNonNegative(abilityId, effect.formula.bonusFormula);
        }
      } else if (effect.amount < 0) {
        throw new Error(
          `CombatEngine: abilityEffects["${String(abilityId)}"] (PLOT) tiene amount negativo (${effect.amount}) — modificadores negativos son una capa futura fuera de alcance (GDD §12)`
        );
      }
    }
  }

  /** Ver `validateAbilityEffectsConfig`, invariante 3. */
  private validateUmbralFormulaNonNegative(abilityId: AbilityId, formula: UmbralFormula): void {
    if (formula.kind !== 'VALUE' && formula.amount < 0) {
      throw new Error(
        `CombatEngine: abilityEffects["${String(abilityId)}"] tiene una fórmula ${formula.kind} con amount negativo (${formula.amount}) — modificadores negativos son una capa futura fuera de alcance (GDD §12)`
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

  /** Ver spec H1.14 §0 nota de estado del repo — mismo estilo que validateInitialLeaderShield (H1.6). */
  private validateInitialLeaderEnergy(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > LEADER_ENERGY_MAX) {
      throw new Error(
        `CombatEngine: initialLeaderEnergy debe ser un entero entre 0 y ${LEADER_ENERGY_MAX} (decisions.md, "Energía inicial del Líder: 1"), recibido ${value}`
      );
    }
  }

  private nextNucleoId(): NucleoInstanceId {
    const id = createId<'NucleoInstanceId'>('NucleoInstanceId', `nucleo-${this.nucleoIdCounter}`);
    this.nucleoIdCounter += 1;
    return id;
  }

  private rollNewPool(): NucleoInstance[] {
    return rollPool(this.poolSize, this.randomSource, () => this.nextNucleoId());
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

    const index = this.nucleoPool.findIndex((n) => n.id === nucleo.id);
    this.nucleoPool = [...this.nucleoPool.slice(0, index), ...this.nucleoPool.slice(index + 1)];

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
    }
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

    const index = this.nucleoPool.findIndex((n) => n.id === command.nucleoInstanceId);
    if (index === -1) {
      return err({ code: 'NUCLEO_NOT_FOUND', nucleoInstanceId: command.nucleoInstanceId });
    }

    const nucleo = this.nucleoPool[index] as NucleoInstance;
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

    if (this.nucleoPool.length === 0) {
      this.nucleoPool = this.rollNewPool();
      const refilled: CombatEvent = {
        type: 'NUCLEO_POOL_ROLLED',
        pool: [...this.nucleoPool],
        priorityTurnOwner: this.turnOwner,
      };
      events.push(refilled);
      this.eventBus.emit(refilled);
    }

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

    return ok(events);
  }

  private handlePlayContratiempo(
    command: Extract<CombatCommand, { type: 'PLAY_CONTRATIEMPO' }>
  ): CombatCommandResult {
    const def = this.contratiempoCards.get(command.cardId);
    if (!def) {
      return err({ code: 'CONTRATIEMPO_CARD_UNKNOWN', cardId: command.cardId });
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
    const events = [playedEvent];
    this.eventBus.emit(playedEvent);

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

  /** NUEVO H1.16 — ver spec H1.16 §0.3/§4.4. Decide Y ejecuta la acción del turno de
   *  los Secuaces (selección aleatoria con filtro de validez incluida). */
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

    // 1. Candidatos de acción especial: CD listo y Núcleo válido (GDD §3.8, "aleatorio
    //    con filtro de validez — entre los que pueden ejecutar su acción").
    const specialCandidates = this.minionsInPlay.filter((m) => {
      if (!m.specialActionAbilityId) return false;
      const remaining = this.remainingCooldowns.get(m.specialActionAbilityId) ?? 0;
      if (remaining !== 0) return false;
      const requirement = this.abilityCoreCosts.get(m.specialActionAbilityId);
      if (!requirement) return false;
      return poolHasValidNucleo(requirement, this.nucleoPool);
    });

    if (specialCandidates.length > 0) {
      const chosen = this.randomSource.pick(specialCandidates);
      const abilityId = chosen.specialActionAbilityId as AbilityId;
      const requirement = this.abilityCoreCosts.get(abilityId) as CoreCostRequirement;
      const playerColors = derivePlayerColorsFromLeaderAbilities(this.abilityCoreCosts, this.abilityCooldowns);
      const nucleoDecision = decideEnemyNucleoToSpend(requirement, this.nucleoPool, playerColors, this.randomSource);

      const { events: sharedEvents, effectLogEntry, cooldownBefore } = this.executeAbilityEffect(
        abilityId,
        chosen.instanceId,
        'ENEMY',
        nucleoDecision.nucleo
      );
      const events: CombatEvent[] = [...sharedEvents];

      this.currentEnemyTurnLog.push({
        origin: 'ABILITY',
        abilityId,
        sourceId: chosen.instanceId,
        cooldownBefore,
        ...(effectLogEntry ? { effect: effectLogEntry } : {}),
      });

      if (this.nucleoPool.length === 0) {
        this.nucleoPool = this.rollNewPool();
        const refilled: CombatEvent = {
          type: 'NUCLEO_POOL_ROLLED',
          pool: [...this.nucleoPool],
          priorityTurnOwner: this.turnOwner,
        };
        events.push(refilled);
        this.eventBus.emit(refilled);
      }

      this.minionActionResolvedThisEnemyTurn = true;

      const resolvedEvent: CombatEvent = {
        type: 'MINION_ACTION_RESOLVED',
        instanceId: chosen.instanceId,
        mechanism: 'SPECIAL_ACTION',
      };
      events.push(resolvedEvent);
      this.eventBus.emit(resolvedEvent);

      return ok(events);
    }

    if (this.minionsInPlay.length > 0) {
      const chosen = this.randomSource.pick(this.minionsInPlay);
      const events: CombatEvent[] = [];

      const target = this.resolveDamageTarget(); // NUEVO H1.15
      const effectDef = { arrollar: false };
      const source: AbilityActionSource = { sourceId: chosen.instanceId, side: 'ENEMY' };
      const leaderDamageBefore = this.leaderDamage;
      const leaderShieldBefore = this.leaderShield;
      const effectEvent = target
        ? this.applyAttackEffectToAlly(source, effectDef, null, chosen.planoAttackAmount, target)
        : this.applyAttackEffectToLeader(source, effectDef, null, chosen.planoAttackAmount);
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
        sourceId: chosen.instanceId,
        effect: effectLogEntry,
      });

      this.minionActionResolvedThisEnemyTurn = true;

      const resolvedEvent: CombatEvent = {
        type: 'MINION_ACTION_RESOLVED',
        instanceId: chosen.instanceId,
        mechanism: 'PLANO_ATTACK',
      };
      events.push(resolvedEvent);
      this.eventBus.emit(resolvedEvent);

      return ok(events);
    }

    // minionsInPlay vacío — no es un error (ver spec §0.3 punto 4).
    const skippedEvent: CombatEvent = { type: 'MINION_ACTION_SKIPPED', reason: 'NO_MINIONS_IN_PLAY' };
    this.eventBus.emit(skippedEvent);
    return ok([skippedEvent]);
  }

  subscribe(listener: (event: CombatEvent) => void): Unsubscribe {
    return this.eventBus.subscribe(listener);
  }

  getSnapshot(): CombatStateSnapshot {
    return {
      turn: { turnOwner: this.turnOwner, turnNumber: this.turnNumber },
      nucleoPool: [...this.nucleoPool],
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
    };
  }
}
