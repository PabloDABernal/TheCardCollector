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
import { rollPool, DEFAULT_NUCLEO_POOL_SIZE } from './nucleo-pool';

export class CombatEngine {
  private readonly randomSource: RandomSource;
  private readonly abilityCoreCosts: ReadonlyMap<AbilityId, CoreCostRequirement>;
  private readonly abilityCooldowns: ReadonlyMap<AbilityId, AbilityCooldownDefinition>;
  private readonly poolSize: number;
  private readonly eventBus: EventBus<CombatEvent>;

  private turnOwner: CombatSide;
  private turnNumber: number;
  private nucleoPool: NucleoInstance[];
  private nucleoIdCounter: number;
  /** CD restante actual por abilityId. Contiene una entrada por cada clave de
   *  `abilityCooldowns` desde la construcción (Calentamiento, GDD §2.5). */
  private remainingCooldowns: Map<AbilityId, number>;

  constructor(config: CombatEngineConfig) {
    this.randomSource = config.randomSource;
    this.abilityCoreCosts = config.abilityCoreCosts;
    this.abilityCooldowns = config.abilityCooldowns;
    this.validateAbilityCooldownsConfig();

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
    };
  }
}
