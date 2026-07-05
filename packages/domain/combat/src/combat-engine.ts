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
import { rollPool, DEFAULT_NUCLEO_POOL_SIZE } from './nucleo-pool';

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
      }
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
    command: Extract<CombatCommand, { type: 'ACTIVATE_ABILITY' }>,
    effectDef: Extract<AbilityEffectDefinition, { kind: 'ATTACK' }>,
    nucleo: NucleoInstance
  ): CombatEvent {
    const resolution = resolveAbilityUmbral(effectDef.formula, nucleo.value);
    const rawAmount = resolution.baseResolvedValue;

    const shieldBefore = this.leaderShield;
    const absorbedByShield = Math.min(shieldBefore, rawAmount);
    this.leaderShield = shieldBefore - absorbedByShield;

    const excess = rawAmount - absorbedByShield;
    const appliedDamage = shieldBefore === 0 || effectDef.arrollar === true ? excess : 0;
    this.leaderDamage += appliedDamage;

    return {
      type: 'LEADER_DAMAGED',
      abilityId: command.abilityId,
      sourceId: command.sourceId,
      side: command.side,
      nucleoSpent: nucleo,
      rawAmount,
      absorbedByShield,
      appliedDamage,
      leaderShieldAfter: this.leaderShield,
      leaderDamageAfter: this.leaderDamage,
    };
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
    command: Extract<CombatCommand, { type: 'ACTIVATE_ABILITY' }>,
    effectDef: Extract<AbilityEffectDefinition, { kind: 'PLOT' }>
  ): CombatEvent {
    const ownerDef = this.abilityCooldowns.get(command.abilityId) as AbilityCooldownDefinition;
    const direction: 'INCREASE' | 'DECREASE' = ownerDef.side === 'ENEMY' ? 'INCREASE' : 'DECREASE';
    const rawAmount = effectDef.amount;
    const appliedDelta = direction === 'INCREASE' ? rawAmount : -rawAmount;
    this.scenarioPlot = Math.max(0, this.scenarioPlot + appliedDelta);

    return {
      type: 'SCENARIO_PLOT_CHANGED',
      abilityId: command.abilityId,
      sourceId: command.sourceId,
      side: command.side,
      direction,
      rawAmount,
      appliedDelta,
      scenarioPlotAfter: this.scenarioPlot,
    };
  }

  dispatch(command: CombatCommand): CombatCommandResult {
    switch (command.type) {
      case 'ACTIVATE_ABILITY':
        return this.handleActivateAbility(command);
      case 'END_TURN':
        return this.handleEndTurn();
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
    this.nucleoPool = [...this.nucleoPool.slice(0, index), ...this.nucleoPool.slice(index + 1)];

    // NUEVO en H1.4 — activar la habilidad la manda a cooldown completo otra vez
    // (GDD §2.5: "como recién usada"). Siempre resetea a su CD BASE, nunca a un valor
    // parcial, sin importar cuánto tiempo llevara disponible.
    const def = this.abilityCooldowns.get(command.abilityId) as AbilityCooldownDefinition;
    this.remainingCooldowns.set(command.abilityId, def.baseCooldown);

    const events: CombatEvent[] = [];

    const activated: CombatEvent = {
      type: 'ABILITY_ACTIVATED',
      abilityId: command.abilityId,
      sourceId: command.sourceId,
      side: command.side,
      nucleoSpent: nucleo,
    };
    events.push(activated);
    this.eventBus.emit(activated);

    // NUEVO H1.6 — se resuelve el efecto (si lo hay) INMEDIATAMENTE después de
    // ABILITY_ACTIVATED, y ANTES de comprobar si el pool quedó vacío (orden elegido
    // para que el efecto de ESTA activación siempre aparezca antes que un eventual
    // relanzado de pool causado por ella).
    const effectDef = this.abilityEffects.get(command.abilityId);
    if (effectDef) {
      const effectEvent =
        effectDef.kind === 'ATTACK'
          ? this.applyAttackEffect(command, effectDef, nucleo)
          : this.applyPlotEffect(command, effectDef);
      events.push(effectEvent);
      this.eventBus.emit(effectEvent);
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

    return ok(events);
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
    };
  }
}
