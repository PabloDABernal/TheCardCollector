import { describe, it, expect } from 'vitest';
import { SeededRandomSource, createId, isOk, isErr, type AbilityId, type CoreCostRequirement, type NucleoColor } from '@collector/domain-shared';
import { CombatEngine } from './combat-engine';
import type { CombatCommandError } from './types/errors';

const ABILITY_ANY: AbilityId = createId<'AbilityId'>('AbilityId', 'ability-any');

function abilityCosts(extra: [AbilityId, CoreCostRequirement][] = []) {
  return new Map<AbilityId, CoreCostRequirement>([[ABILITY_ANY, { kind: 'ANY' }], ...extra]);
}

describe('CombatEngine — ciclo de turnos', () => {
  it('alterna turnOwner y turnNumber en cada END_TURN', () => {
    const engine = new CombatEngine({ randomSource: new SeededRandomSource(1), abilityCoreCosts: abilityCosts() });
    expect(engine.getSnapshot().turn).toEqual({ turnOwner: 'LEADER', turnNumber: 1 });

    const r1 = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(r1)).toBe(true);
    expect(engine.getSnapshot().turn).toEqual({ turnOwner: 'ENEMY', turnNumber: 2 });

    const r2 = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(r2)).toBe(true);
    expect(engine.getSnapshot().turn).toEqual({ turnOwner: 'LEADER', turnNumber: 3 });
  });

  it('respeta initialTurnOwner de la config', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: abilityCosts(),
      initialTurnOwner: 'ENEMY',
    });
    expect(engine.getSnapshot().turn.turnOwner).toBe('ENEMY');
  });
});

describe('CombatEngine — gasto de Núcleo', () => {
  it('gasto válido: elimina la ficha del pool y emite ABILITY_ACTIVATED', () => {
    const engine = new CombatEngine({ randomSource: new SeededRandomSource(5), abilityCoreCosts: abilityCosts(), poolSize: 6 });
    const before = engine.getSnapshot().nucleoPool;
    const target = before[0]!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: ABILITY_ANY,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: target.id,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([
        { type: 'ABILITY_ACTIVATED', abilityId: ABILITY_ANY, sourceId: 'leader', side: 'LEADER', nucleoSpent: target },
      ]);
    }
    const after = engine.getSnapshot().nucleoPool;
    expect(after).toHaveLength(before.length - 1);
    expect(after.find((n) => n.id === target.id)).toBeUndefined();
  });

  it('rechaza gastar un Núcleo inexistente', () => {
    const engine = new CombatEngine({ randomSource: new SeededRandomSource(1), abilityCoreCosts: abilityCosts(), poolSize: 6 });
    const fakeId = createId<'NucleoInstanceId'>('NucleoInstanceId', 'no-existe');

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: ABILITY_ANY,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: fakeId,
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('NUCLEO_NOT_FOUND');
    }
  });

  it('rechaza gastar dos veces el mismo Núcleo (ya gastado)', () => {
    const engine = new CombatEngine({ randomSource: new SeededRandomSource(1), abilityCoreCosts: abilityCosts(), poolSize: 6 });
    const target = engine.getSnapshot().nucleoPool[0]!;
    const command = {
      type: 'ACTIVATE_ABILITY' as const,
      abilityId: ABILITY_ANY,
      sourceId: 'leader',
      side: 'LEADER' as const,
      nucleoInstanceId: target.id,
    };

    expect(isOk(engine.dispatch(command))).toBe(true);
    const second = engine.dispatch(command);
    expect(isErr(second)).toBe(true);
    if (isErr(second)) {
      expect((second.error as CombatCommandError).code).toBe('NUCLEO_NOT_FOUND');
    }
  });

  it('rechaza color que no satisface el requisito, sin mutar el pool', () => {
    const engine = new CombatEngine({ randomSource: new SeededRandomSource(1), abilityCoreCosts: abilityCosts(), poolSize: 6 });
    const before = engine.getSnapshot().nucleoPool;
    const target = before[0]!;
    const mismatchedColors = (['AGRESION', 'CONTROL', 'DEFENSA', 'RECURSO', 'CAOS'] as NucleoColor[]).filter(
      (c) => c !== target.color
    );
    const ABILITY_MISMATCH: AbilityId = createId<'AbilityId'>('AbilityId', 'ability-mismatch');
    const costs = abilityCosts([[ABILITY_MISMATCH, { kind: 'COLOR', colors: mismatchedColors }]]);
    const engine2 = new CombatEngine({ randomSource: new SeededRandomSource(1), abilityCoreCosts: costs, poolSize: 6 });

    const result = engine2.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: ABILITY_MISMATCH,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: target.id,
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('NUCLEO_COLOR_MISMATCH');
    }
    expect(engine2.getSnapshot().nucleoPool).toEqual(before);
  });

  it('rechaza abilityId no registrado en abilityCoreCosts', () => {
    const engine = new CombatEngine({ randomSource: new SeededRandomSource(1), abilityCoreCosts: abilityCosts(), poolSize: 6 });
    const target = engine.getSnapshot().nucleoPool[0]!;
    const UNKNOWN: AbilityId = createId<'AbilityId'>('AbilityId', 'no-registrada');

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: UNKNOWN,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: target.id,
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('ABILITY_COST_UNKNOWN');
    }
  });

  it('rechaza activar una habilidad si `side` no coincide con el turnOwner actual', () => {
    const engine = new CombatEngine({ randomSource: new SeededRandomSource(1), abilityCoreCosts: abilityCosts(), poolSize: 6 });
    const target = engine.getSnapshot().nucleoPool[0]!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: ABILITY_ANY,
      sourceId: 'enemy',
      side: 'ENEMY', // turnOwner por defecto es 'LEADER'
      nucleoInstanceId: target.id,
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('NOT_YOUR_TURN');
    }
    expect(engine.getSnapshot().nucleoPool).toEqual([target, ...engine.getSnapshot().nucleoPool.slice(1)]);
  });
});

describe('CombatEngine — relanzado automático del pool', () => {
  it('al vaciarse el pool (poolSize 1), se relanza en el mismo dispatch y emite NUCLEO_POOL_ROLLED', () => {
    const engine = new CombatEngine({ randomSource: new SeededRandomSource(9), abilityCoreCosts: abilityCosts(), poolSize: 1 });
    const firstNucleo = engine.getSnapshot().nucleoPool[0]!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: ABILITY_ANY,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: firstNucleo.id,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]!.type).toBe('ABILITY_ACTIVATED');
      expect(result.value[1]!.type).toBe('NUCLEO_POOL_ROLLED');
      const secondEvent = result.value[1]!;
      if (secondEvent.type === 'NUCLEO_POOL_ROLLED') {
        expect(secondEvent.pool).toHaveLength(1);
        expect(secondEvent.pool[0]!.id).not.toBe(firstNucleo.id);
        expect(secondEvent.priorityTurnOwner).toBe('LEADER');
      }
    }
    expect(engine.getSnapshot().nucleoPool).toHaveLength(1);
    expect(engine.getSnapshot().nucleoPool[0]!.id).not.toBe(firstNucleo.id);
  });
});

describe('CombatEngine — regla "elige primero quien tenga turno tras el vaciado" (2 escenarios de vaciado)', () => {
  it('Escenario A: el vaciado ocurre y NO se ha llamado END_TURN → el mismo lado sigue eligiendo, el otro lado no puede', () => {
    const engine = new CombatEngine({ randomSource: new SeededRandomSource(3), abilityCoreCosts: abilityCosts(), poolSize: 1 });

    // Primer gasto: vacía el pool de 1 ficha y dispara el relanzado (misma turno de LEADER).
    const nucleo1 = engine.getSnapshot().nucleoPool[0]!;
    const r1 = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ABILITY_ANY, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: nucleo1.id });
    expect(isOk(r1)).toBe(true);

    // LEADER sigue teniendo el turno: puede gastar de inmediato del pool recién relanzado.
    const nucleo2 = engine.getSnapshot().nucleoPool[0]!;
    const r2 = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ABILITY_ANY, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: nucleo2.id });
    expect(isOk(r2)).toBe(true);

    // ENEMY intenta colarse antes de que LEADER llame END_TURN: rechazado.
    const nucleo3 = engine.getSnapshot().nucleoPool[0]!;
    const r3 = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ABILITY_ANY, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo3.id });
    expect(isErr(r3)).toBe(true);
    if (isErr(r3)) {
      expect((r3.error as CombatCommandError).code).toBe('NOT_YOUR_TURN');
    }
  });

  it('Escenario B: el vaciado ocurre en el turno de ENEMY; tras END_TURN, LEADER (el turno siguiente) elige primero del nuevo pool', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(11),
      abilityCoreCosts: abilityCosts(),
      poolSize: 1,
      initialTurnOwner: 'ENEMY',
    });

    // ENEMY vacía el único Núcleo del pool → relanzado inmediato, sigue siendo turno de ENEMY.
    const nucleoEnemy = engine.getSnapshot().nucleoPool[0]!;
    const rEnemy = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ABILITY_ANY, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleoEnemy.id });
    expect(isOk(rEnemy)).toBe(true);
    if (isOk(rEnemy)) {
      const refillEvent = rEnemy.value.find((e) => e.type === 'NUCLEO_POOL_ROLLED');
      expect(refillEvent && 'priorityTurnOwner' in refillEvent ? refillEvent.priorityTurnOwner : undefined).toBe('ENEMY');
    }

    // ENEMY termina su turno.
    const rEndTurn = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(rEndTurn)).toBe(true);
    expect(engine.getSnapshot().turn.turnOwner).toBe('LEADER');

    // ENEMY intenta gastar tras haber terminado su turno: rechazado.
    const staleNucleo = engine.getSnapshot().nucleoPool[0]!;
    const rEnemyLate = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ABILITY_ANY, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: staleNucleo.id });
    expect(isErr(rEnemyLate)).toBe(true);
    if (isErr(rEnemyLate)) {
      expect((rEnemyLate.error as CombatCommandError).code).toBe('NOT_YOUR_TURN');
    }

    // LEADER (el turno inmediatamente después del vaciado que ocurrió en el turno de ENEMY)
    // sí puede gastar del pool ya relanzado.
    const rLeader = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ABILITY_ANY, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: staleNucleo.id });
    expect(isOk(rLeader)).toBe(true);
  });
});
