import { describe, it, expect } from 'vitest';
import { SeededRandomSource, createId, isOk, type AbilityId, type CoreCostRequirement, type CardId } from '@collector/domain-shared';
import type { PhaseDefinition } from '@collector/domain-catalog';
import { CombatEngine } from './combat-engine';
import type { CombatEvent } from './types/events';
import type { AbilityCooldownDefinition } from './types/cooldown';
import type { AbilityEffectDefinition } from './types/ability-effect';
import type { ContratiempoCardDefinition } from './types/contratiempo';

const ENEMY_PLOT: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-plot-h117');
const CARD_FULL_TURN: CardId = createId<'CardId'>('CardId', 'card-full-turn-h117');

function costs(ids: AbilityId[]): Map<AbilityId, CoreCostRequirement> {
  return new Map(ids.map((id) => [id, { kind: 'ANY' } as CoreCostRequirement]));
}

function cooldowns(entries: [AbilityId, AbilityCooldownDefinition][]): Map<AbilityId, AbilityCooldownDefinition> {
  return new Map(entries);
}

function effects(entries: [AbilityId, AbilityEffectDefinition][]): Map<AbilityId, AbilityEffectDefinition> {
  return new Map(entries);
}

function contratiempoCards(
  entries: [CardId, ContratiempoCardDefinition][]
): Map<CardId, ContratiempoCardDefinition> {
  return new Map(entries);
}

function eventTypes(events: readonly CombatEvent[]): string[] {
  return events.map((e) => e.type);
}

describe('CombatEngine — H1.17: PHASE_CHANGED por TURN_COUNT_AT_LEAST (Enemigo)', () => {
  it('tras 1 END_TURN que cruza el turno configurado, emite PHASE_CHANGED + LEADER_LEVELED_UP', () => {
    const enemyPhases: PhaseDefinition[] = [
      { phaseNumber: 1, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 2 } },
      { phaseNumber: 2, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 9999 } },
    ];
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      enemyPhases,
    });

    const result = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const types = eventTypes(result.value);
      const phaseChangedIndex = types.indexOf('PHASE_CHANGED');
      const leveledUpIndex = types.indexOf('LEADER_LEVELED_UP');
      expect(phaseChangedIndex).toBeGreaterThanOrEqual(0);
      expect(leveledUpIndex).toBe(phaseChangedIndex + 1);

      const phaseChanged = result.value[phaseChangedIndex] as Extract<CombatEvent, { type: 'PHASE_CHANGED' }>;
      expect(phaseChanged).toMatchObject({ source: 'ENEMY', fromPhaseNumber: 1, toPhaseNumber: 2 });

      const leveledUp = result.value[leveledUpIndex] as Extract<CombatEvent, { type: 'LEADER_LEVELED_UP' }>;
      expect(leveledUp).toMatchObject({ triggeredBy: 'ENEMY', levelAfter: 2, levelUpsSpentAfter: 1 });
    }

    const snapshot = engine.getSnapshot();
    expect(snapshot.enemyPhase).toEqual({ phaseNumber: 2, totalPhases: 2 });
    expect(snapshot.leaderState).toEqual({ level: 2, levelUpsSpent: 1 });
  });
});

describe('CombatEngine — H1.17: PHASE_CHANGED por SCENARIO_PLOT_AT_LEAST (Escenario)', () => {
  it('una habilidad PLOT de ENEMY que cruza el umbral configurado emite PHASE_CHANGED + LEADER_LEVELED_UP de source SCENARIO', () => {
    const scenarioPhases: PhaseDefinition[] = [
      { phaseNumber: 1, changeCondition: { kind: 'SCENARIO_PLOT_AT_LEAST', amount: 3 } },
      { phaseNumber: 2, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 9999 } },
    ];
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(2),
      abilityCoreCosts: costs([ENEMY_PLOT]),
      abilityCooldowns: cooldowns([[ENEMY_PLOT, { side: 'ENEMY', baseCooldown: 1 }]]),
      abilityEffects: effects([[ENEMY_PLOT, { kind: 'PLOT', amount: 3 }]]),
      initialTurnOwner: 'ENEMY',
      scenarioPhases,
    });
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_PLOT, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const types = eventTypes(result.value);
      expect(types).toContain('PHASE_CHANGED');
      expect(types).toContain('LEADER_LEVELED_UP');

      const phaseChanged = result.value.find((e) => e.type === 'PHASE_CHANGED') as Extract<
        CombatEvent, { type: 'PHASE_CHANGED' }
      >;
      expect(phaseChanged).toMatchObject({ source: 'SCENARIO', fromPhaseNumber: 1, toPhaseNumber: 2 });

      const leveledUp = result.value.find((e) => e.type === 'LEADER_LEVELED_UP') as Extract<
        CombatEvent, { type: 'LEADER_LEVELED_UP' }
      >;
      expect(leveledUp).toMatchObject({ triggeredBy: 'SCENARIO' });
    }

    expect(engine.getSnapshot().scenarioPhase).toEqual({ phaseNumber: 2, totalPhases: 2 });
  });
});

describe('CombatEngine — H1.17: HEALTH_BELOW_PERCENT vía initialEnemyDamage (dato en reposo)', () => {
  it('con enemyMaxHealth=60 e initialEnemyDamage=30 (50% restante), el primer dispatch() que evalúa ya cruza la fase', () => {
    const enemyPhases: PhaseDefinition[] = [
      { phaseNumber: 1, changeCondition: { kind: 'HEALTH_BELOW_PERCENT', percent: 50 } },
      { phaseNumber: 2, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 9999 } },
    ];
    const engine = new CombatEngine({ leaderMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(3),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      enemyPhases,
      enemyMaxHealth: 60,
      initialEnemyDamage: 30,
    });

    const result = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const types = eventTypes(result.value);
      expect(types).toContain('PHASE_CHANGED');
      expect(types).toContain('LEADER_LEVELED_UP');
    }

    const snapshot = engine.getSnapshot();
    expect(snapshot.enemyPhase).toEqual({ phaseNumber: 2, totalPhases: 2 });
    expect(snapshot.enemyDamage).toBe(30);
  });
});

describe('CombatEngine — H1.17: tope de 2 Level-Ups alcanzado — "no hace nada"', () => {
  it('con initialLeaderLevelUpsSpent=2, un cambio de fase adicional emite PHASE_CHANGED pero NO LEADER_LEVELED_UP; leaderState no cambia', () => {
    const enemyPhases: PhaseDefinition[] = [
      { phaseNumber: 1, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 2 } },
      { phaseNumber: 2, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 9999 } },
    ];
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(4),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      enemyPhases,
      initialLeaderLevelUpsSpent: 2,
    });

    expect(engine.getSnapshot().leaderState).toEqual({ level: 3, levelUpsSpent: 2 });

    const result = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const types = eventTypes(result.value);
      expect(types).toContain('PHASE_CHANGED');
      expect(types).not.toContain('LEADER_LEVELED_UP');
    }

    expect(engine.getSnapshot().leaderState).toEqual({ level: 3, levelUpsSpent: 2 });
  });
});

describe('CombatEngine — H1.17: Enemigo y Escenario cambian de fase en el mismo dispatch()', () => {
  it('ambos configurados con TURN_COUNT_AT_LEAST sobre el mismo turno: 2 PHASE_CHANGED, 2 LEADER_LEVELED_UP, orden ENEMY antes que SCENARIO', () => {
    const enemyPhases: PhaseDefinition[] = [
      { phaseNumber: 1, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 2 } },
      { phaseNumber: 2, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 9999 } },
    ];
    const scenarioPhases: PhaseDefinition[] = [
      { phaseNumber: 1, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 2 } },
      { phaseNumber: 2, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 9999 } },
    ];
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(5),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      enemyPhases,
      scenarioPhases,
    });

    const result = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const phaseChangedEvents = result.value.filter(
        (e) => e.type === 'PHASE_CHANGED'
      ) as Extract<CombatEvent, { type: 'PHASE_CHANGED' }>[];
      expect(phaseChangedEvents.map((e) => e.source)).toEqual(['ENEMY', 'SCENARIO']);

      const leveledUpEvents = result.value.filter(
        (e) => e.type === 'LEADER_LEVELED_UP'
      ) as Extract<CombatEvent, { type: 'LEADER_LEVELED_UP' }>[];
      expect(leveledUpEvents.map((e) => e.levelUpsSpentAfter)).toEqual([1, 2]);
      expect(leveledUpEvents.map((e) => e.triggeredBy)).toEqual(['ENEMY', 'SCENARIO']);
    }

    expect(engine.getSnapshot().leaderState).toEqual({ level: 3, levelUpsSpent: 2 });
  });
});

describe('CombatEngine — H1.17: sin fases configuradas (compatibilidad hacia atrás)', () => {
  it('enemyPhases/scenarioPhases omitidos: ningún PHASE_CHANGED/LEADER_LEVELED_UP, leaderState en su valor inicial', () => {
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(6),
      abilityCoreCosts: costs([ENEMY_PLOT]),
      abilityCooldowns: cooldowns([[ENEMY_PLOT, { side: 'ENEMY', baseCooldown: 1 }]]),
      abilityEffects: effects([[ENEMY_PLOT, { kind: 'PLOT', amount: 5 }]]),
      initialTurnOwner: 'ENEMY',
    });

    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const r1 = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_PLOT, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });
    expect(isOk(r1)).toBe(true);
    if (isOk(r1)) {
      const types = eventTypes(r1.value);
      expect(types).not.toContain('PHASE_CHANGED');
      expect(types).not.toContain('LEADER_LEVELED_UP');
    }

    const r2 = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(r2)).toBe(true);
    if (isOk(r2)) {
      const types = eventTypes(r2.value);
      expect(types).not.toContain('PHASE_CHANGED');
      expect(types).not.toContain('LEADER_LEVELED_UP');
    }

    const snapshot = engine.getSnapshot();
    expect(snapshot.leaderState).toEqual({ level: 1, levelUpsSpent: 0 });
    expect(snapshot.enemyPhase).toEqual({ phaseNumber: 0, totalPhases: 0 });
    expect(snapshot.scenarioPhase).toEqual({ phaseNumber: 0, totalPhases: 0 });
  });
});

describe('CombatEngine — H1.17: Contratiempo NO revierte una fase ya cambiada (checkpoint permanente)', () => {
  it('un PLAY_CONTRATIEMPO FULL_TURN que rebobina scenarioPlot por debajo del umbral no revierte scenarioPhase/leaderState', () => {
    const scenarioPhases: PhaseDefinition[] = [
      { phaseNumber: 1, changeCondition: { kind: 'SCENARIO_PLOT_AT_LEAST', amount: 3 } },
      { phaseNumber: 2, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 9999 } },
    ];
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [CARD_FULL_TURN],
      randomSource: new SeededRandomSource(7),
      abilityCoreCosts: costs([ENEMY_PLOT]),
      abilityCooldowns: cooldowns([[ENEMY_PLOT, { side: 'ENEMY', baseCooldown: 1 }]]),
      abilityEffects: effects([[ENEMY_PLOT, { kind: 'PLOT', amount: 3 }]]),
      contratiempoCards: contratiempoCards([[CARD_FULL_TURN, { energyCost: 2, undoScope: 'FULL_TURN' }]]),
      scenarioPhases,
      initialLeaderEnergy: 2,
    });

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_PLOT, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });
    expect(engine.getSnapshot().scenarioPlot).toBe(3);
    expect(engine.getSnapshot().scenarioPhase).toEqual({ phaseNumber: 2, totalPhases: 2 });
    expect(engine.getSnapshot().leaderState).toEqual({ level: 2, levelUpsSpent: 1 });

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    const result = engine.dispatch({ type: 'PLAY_CONTRATIEMPO', cardId: CARD_FULL_TURN, sourceId: 'leader' });
    expect(isOk(result)).toBe(true);

    const snapshot = engine.getSnapshot();
    expect(snapshot.scenarioPlot).toBe(0); // Contratiempo SÍ revierte scenarioPlot
    // ... pero la fase/Level-Up ya cruzados permanecen — checkpoint permanente.
    expect(snapshot.scenarioPhase).toEqual({ phaseNumber: 2, totalPhases: 2 });
    expect(snapshot.leaderState).toEqual({ level: 2, levelUpsSpent: 1 });
  });
});

describe('CombatEngine — H1.17: cascada de 3+ fases en el mismo dispatch() (genericidad)', () => {
  it('un único incremento grande de scenarioPlot cruza 2 umbrales a la vez: 2 PHASE_CHANGED (1→2, 2→3) y 2 LEADER_LEVELED_UP', () => {
    const scenarioPhases: PhaseDefinition[] = [
      { phaseNumber: 1, changeCondition: { kind: 'SCENARIO_PLOT_AT_LEAST', amount: 2 } },
      { phaseNumber: 2, changeCondition: { kind: 'SCENARIO_PLOT_AT_LEAST', amount: 5 } },
      { phaseNumber: 3, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 9999 } },
    ];
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(8),
      abilityCoreCosts: costs([ENEMY_PLOT]),
      abilityCooldowns: cooldowns([[ENEMY_PLOT, { side: 'ENEMY', baseCooldown: 1 }]]),
      abilityEffects: effects([[ENEMY_PLOT, { kind: 'PLOT', amount: 10 }]]),
      initialTurnOwner: 'ENEMY',
      scenarioPhases,
    });
    const nucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_PLOT, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const phaseChangedEvents = result.value.filter(
        (e) => e.type === 'PHASE_CHANGED'
      ) as Extract<CombatEvent, { type: 'PHASE_CHANGED' }>[];
      expect(phaseChangedEvents).toHaveLength(2);
      expect(phaseChangedEvents.map((e) => [e.fromPhaseNumber, e.toPhaseNumber])).toEqual([
        [1, 2],
        [2, 3],
      ]);

      const leveledUpEvents = result.value.filter(
        (e) => e.type === 'LEADER_LEVELED_UP'
      ) as Extract<CombatEvent, { type: 'LEADER_LEVELED_UP' }>[];
      expect(leveledUpEvents).toHaveLength(2);
      expect(leveledUpEvents.map((e) => e.levelUpsSpentAfter)).toEqual([1, 2]);
    }

    expect(engine.getSnapshot().scenarioPhase).toEqual({ phaseNumber: 3, totalPhases: 3 });
    expect(engine.getSnapshot().leaderState).toEqual({ level: 3, levelUpsSpent: 2 });
  });
});

describe('CombatEngine — H1.17: validación de configuración (fallos rápidos del constructor)', () => {
  it('lanza si enemyMaxHealth está ausente (H1.18 §0.3: pasó de opcional-condicional a obligatorio siempre)', () => {
    // NUEVO H1.18 — reemplaza el test de H1.17 "sin enemyMaxHealth" condicionado a
    // HEALTH_BELOW_PERCENT: la validación `needsMaxHealth` se elimina (spec §0.3) y
    // `enemyMaxHealth` pasa a ser SIEMPRE obligatorio (necesario para la condición de
    // victoria) — se usa un cast para forzar en runtime la ausencia del campo que TS ya
    // no permite omitir.
    expect(() => new CombatEngine({
      leaderMaxHealth: 100,
      scenarioPlotDefeatThreshold: 999,
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      enemyPhases: [
        { phaseNumber: 1, changeCondition: { kind: 'HEALTH_BELOW_PERCENT', percent: 50 } },
        { phaseNumber: 2, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 9999 } },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)).toThrow();
  });

  it('lanza si scenarioPhases incluye HEALTH_BELOW_PERCENT (el Escenario no tiene vida)', () => {
    expect(() => new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      scenarioPhases: [
        { phaseNumber: 1, changeCondition: { kind: 'HEALTH_BELOW_PERCENT', percent: 50 } },
        { phaseNumber: 2, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 9999 } },
      ],
    })).toThrow();
  });

  it('lanza si phaseNumber no es secuencial (huecos)', () => {
    expect(() => new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      enemyPhases: [
        { phaseNumber: 1, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 2 } },
        { phaseNumber: 3, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 9999 } },
      ],
    })).toThrow();
  });

  it('lanza si initialLeaderLevelUpsSpent excede LEADER_LEVEL_UPS_MAX (2)', () => {
    expect(() => new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      initialLeaderLevelUpsSpent: 3,
    })).toThrow();
  });

  it('lanza si initialEnemyDamage excede enemyMaxHealth', () => {
    expect(() => new CombatEngine({ leaderMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      enemyMaxHealth: 60,
      initialEnemyDamage: 61,
    })).toThrow();
  });
});
