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
import { rollPool, DEFAULT_NUCLEO_POOL_SIZE } from './nucleo-pool';

export class CombatEngine {
  private readonly randomSource: RandomSource;
  private readonly abilityCoreCosts: ReadonlyMap<AbilityId, CoreCostRequirement>;
  private readonly poolSize: number;
  private readonly eventBus: EventBus<CombatEvent>;

  private turnOwner: CombatSide;
  private turnNumber: number;
  private nucleoPool: NucleoInstance[];
  private nucleoIdCounter: number;

  constructor(config: CombatEngineConfig) {
    this.randomSource = config.randomSource;
    this.abilityCoreCosts = config.abilityCoreCosts;
    this.poolSize = config.poolSize ?? DEFAULT_NUCLEO_POOL_SIZE;
    this.turnOwner = config.initialTurnOwner ?? 'LEADER';
    this.turnNumber = 1;
    this.nucleoIdCounter = 0;
    this.eventBus = createEventBus<CombatEvent>();

    // Tirada inicial: NO emite evento (nadie puede estar suscrito todavía en este
    // instante del constructor) — solo queda reflejada en getSnapshot(). Ver nota
    // en types/events.ts §3.5.
    this.nucleoPool = this.rollNewPool();
  }

  private nextNucleoId(): NucleoInstanceId {
    const id = createId<'NucleoInstanceId'>('NucleoInstanceId', `nucleo-${this.nucleoIdCounter}`);
    this.nucleoIdCounter += 1;
    return id;
  }

  private rollNewPool(): NucleoInstance[] {
    return rollPool(this.poolSize, this.randomSource, () => this.nextNucleoId());
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
    // efectos secundarios (los tests de rechazo verifican pool sin cambios).
    this.nucleoPool = [...this.nucleoPool.slice(0, index), ...this.nucleoPool.slice(index + 1)];

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
        priorityTurnOwner: this.turnOwner, // ver §5.8 — por qué esto YA implementa la regla de elección
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

    const event: CombatEvent = {
      type: 'TURN_ENDED',
      previousTurnOwner,
      nextTurnOwner: this.turnOwner,
      turnNumber: this.turnNumber,
    };
    this.eventBus.emit(event);
    return ok([event]);
  }

  subscribe(listener: (event: CombatEvent) => void): Unsubscribe {
    return this.eventBus.subscribe(listener);
  }

  getSnapshot(): CombatStateSnapshot {
    return {
      turn: { turnOwner: this.turnOwner, turnNumber: this.turnNumber },
      nucleoPool: [...this.nucleoPool],
    };
  }
}
