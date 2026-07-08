import { describe, it, expect } from 'vitest';
import { SeededRandomSource, createId, isOk, type AbilityId, type CoreCostRequirement } from '@collector/domain-shared';
import { CombatEngine } from './combat-engine';
import type { CombatEvent } from './types/events';
import type { CombatEngineConfig } from './types/config';
import type { AbilityCooldownDefinition } from './types/cooldown';
import type { AlternativeVictoryCondition } from './types/victory-condition';

const ABILITY_ANY: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-ability-any');

function costs(): Map<AbilityId, CoreCostRequirement> {
  return new Map([[ABILITY_ANY, { kind: 'ANY' } as CoreCostRequirement]]);
}

function cooldowns(): Map<AbilityId, AbilityCooldownDefinition> {
  return new Map([[ABILITY_ANY, { side: 'LEADER' as const, baseCooldown: 1 }]]);
}

function buildEngine(overrides: Partial<CombatEngineConfig> = {}): CombatEngine {
  return new CombatEngine({
    leaderMaxHealth: 100,
    enemyMaxHealth: 100,
    scenarioPlotDefeatThreshold: 999,
    leaderDeckCardIds: [],
    randomSource: new SeededRandomSource(1),
    abilityCoreCosts: costs(),
    abilityCooldowns: cooldowns(),
    ...overrides,
  });
}

function findCombatEnded(events: readonly CombatEvent[]) {
  return events.find((e) => e.type === 'COMBAT_ENDED') as Extract<CombatEvent, { type: 'COMBAT_ENDED' }> | undefined;
}

describe('CombatEngine — H1.8+H1.18: condiciones de victoria/derrota alternativas', () => {
  it('SCENARIO_PLOT_AT_MOST outcome VICTORY: se cumple ya en el estado inicial (scenarioPlot=0) y termina en el primer dispatch que evalúa', () => {
    const condition: AlternativeVictoryCondition = { kind: 'SCENARIO_PLOT_AT_MOST', amount: 0, outcome: 'VICTORY' };
    const engine = buildEngine({ alternativeVictoryConditions: [condition] });
    const result = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const ended = findCombatEnded(result.value);
      expect(ended).toBeDefined();
      expect(ended!.outcome).toBe('VICTORY');
      expect(ended!.alternativeConditionKind).toBe('SCENARIO_PLOT_AT_MOST');
    }
    expect(engine.getSnapshot().status).toBe('VICTORY');
  });

  it('SCENARIO_PLOT_AT_MOST outcome DEFEAT: idéntico disparo pero como derrota, defeatReason ALTERNATIVE', () => {
    const condition: AlternativeVictoryCondition = { kind: 'SCENARIO_PLOT_AT_MOST', amount: 0, outcome: 'DEFEAT' };
    const engine = buildEngine({ alternativeVictoryConditions: [condition] });
    const result = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const ended = findCombatEnded(result.value);
      expect(ended!.outcome).toBe('DEFEAT');
      expect(ended!.defeatReason).toBe('ALTERNATIVE');
    }
    expect(engine.getSnapshot().defeatReason).toBe('ALTERNATIVE');
  });

  it('TURN_COUNT_AT_LEAST outcome VICTORY: se cumple al alcanzar el turno indicado', () => {
    const condition: AlternativeVictoryCondition = { kind: 'TURN_COUNT_AT_LEAST', turn: 3, outcome: 'VICTORY' };
    const engine = buildEngine({ alternativeVictoryConditions: [condition] });

    const r1 = engine.dispatch({ type: 'END_TURN' }); // turnNumber 2
    expect(engine.getSnapshot().status).toBe('IN_PROGRESS');
    expect(isOk(r1)).toBe(true);

    const r2 = engine.dispatch({ type: 'END_TURN' }); // turnNumber 3 -> cumple
    expect(isOk(r2)).toBe(true);
    if (isOk(r2)) {
      const ended = findCombatEnded(r2.value);
      expect(ended).toBeDefined();
      expect(ended!.outcome).toBe('VICTORY');
    }
  });

  it('TURN_COUNT_AT_LEAST outcome DEFEAT: enrage — se cumple al alcanzar el turno indicado', () => {
    const condition: AlternativeVictoryCondition = { kind: 'TURN_COUNT_AT_LEAST', turn: 2, outcome: 'DEFEAT' };
    const engine = buildEngine({ alternativeVictoryConditions: [condition] });
    const result = engine.dispatch({ type: 'END_TURN' }); // turnNumber 2
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const ended = findCombatEnded(result.value);
      expect(ended!.outcome).toBe('DEFEAT');
    }
  });

  it('ENEMY_DAMAGE_AT_LEAST outcome VICTORY: se cumple cuando enemyDamage alcanza el umbral (antes del enemyMaxHealth por defecto)', () => {
    const condition: AlternativeVictoryCondition = { kind: 'ENEMY_DAMAGE_AT_LEAST', amount: 5, outcome: 'VICTORY' };
    // enemyMaxHealth (100, default) nunca se alcanza con initialEnemyDamage=5 — la única
    // forma de terminar el combate en el primer dispatch es la condición alternativa.
    const engine = buildEngine({ alternativeVictoryConditions: [condition], initialEnemyDamage: 5 });
    const result = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const ended = findCombatEnded(result.value);
      expect(ended).toBeDefined();
      expect(ended!.outcome).toBe('VICTORY');
      expect(ended!.alternativeConditionKind).toBe('ENEMY_DAMAGE_AT_LEAST');
    }
  });

  it('ENEMY_DAMAGE_AT_LEAST outcome DEFEAT', () => {
    const condition: AlternativeVictoryCondition = { kind: 'ENEMY_DAMAGE_AT_LEAST', amount: 5, outcome: 'DEFEAT' };
    const engine = buildEngine({ alternativeVictoryConditions: [condition], initialEnemyDamage: 5 });
    const result = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const ended = findCombatEnded(result.value);
      expect(ended!.outcome).toBe('DEFEAT');
    }
  });

  it('precedencia: una condición alternativa que se cumple en el mismo tick que una condición por defecto — la alternativa gana', () => {
    // scenarioPlot arranca en 0; SCENARIO_PLOT_AT_MOST 0 VICTORY se cumple de inmediato,
    // ANTES de que enemyMaxHealth/leaderMaxHealth puedan siquiera evaluarse por defecto.
    const condition: AlternativeVictoryCondition = { kind: 'SCENARIO_PLOT_AT_MOST', amount: 0, outcome: 'VICTORY' };
    const engine = buildEngine({ leaderMaxHealth: 1, alternativeVictoryConditions: [condition] });
    const result = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const ended = findCombatEnded(result.value);
      expect(ended!.outcome).toBe('VICTORY'); // no DEFEAT por LEADER_HEALTH, aunque leaderMaxHealth sea 1
      expect(ended!.alternativeConditionKind).toBe('SCENARIO_PLOT_AT_MOST');
    }
  });

  it('sin alternativas configuradas (omitido): se comporta EXACTAMENTE igual que H1.18 original (test de regresión)', () => {
    const engine = buildEngine({ enemyMaxHealth: 1, initialEnemyDamage: 1 });
    const result = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const ended = findCombatEnded(result.value);
      expect(ended).toBeDefined();
      expect(ended!.outcome).toBe('VICTORY');
      expect(ended!.alternativeConditionKind).toBeUndefined();
    }
  });

  it('sin alternativas configuradas (array vacío explícito): mismo comportamiento por defecto', () => {
    const engine = buildEngine({ enemyMaxHealth: 1, initialEnemyDamage: 1, alternativeVictoryConditions: [] });
    const result = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const ended = findCombatEnded(result.value);
      expect(ended!.outcome).toBe('VICTORY');
      expect(ended!.alternativeConditionKind).toBeUndefined();
    }
  });

  it('primera condición que se cumple gana (orden del array): Enemigo antes que Escenario', () => {
    const enemyCondition: AlternativeVictoryCondition = { kind: 'TURN_COUNT_AT_LEAST', turn: 2, outcome: 'VICTORY' };
    const scenarioCondition: AlternativeVictoryCondition = { kind: 'TURN_COUNT_AT_LEAST', turn: 2, outcome: 'DEFEAT' };
    const engine = buildEngine({ alternativeVictoryConditions: [enemyCondition, scenarioCondition] });
    const result = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const ended = findCombatEnded(result.value);
      expect(ended!.outcome).toBe('VICTORY'); // la primera del array (simula "Enemigo") gana
    }
  });
});
