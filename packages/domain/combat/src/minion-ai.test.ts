import { describe, it, expect } from 'vitest';
import { SeededRandomSource, createId } from '@collector/domain-shared';
import { selectActingMinions } from './minion-ai';
import type { MinionInPlay } from './types/minion';
import type { MinionBehaviorSpec } from './types/minion-behavior';

function minion(overrides: Partial<Omit<MinionInPlay, 'instanceId'>> & { instanceId: string }): MinionInPlay {
  const { instanceId, ...rest } = overrides;
  return {
    instanceId: createId<'CardInstanceId'>('CardInstanceId', instanceId),
    definitionId: 'def-a',
    passiveEffect: { kind: 'PLOT', amount: 0 },
    planoAttackAmount: 1,
    isDefensor: false,
    maxLife: 5,
    life: 5,
    ...rest,
  };
}

describe('selectActingMinions', () => {
  const rng = new SeededRandomSource(1);

  it('behavior undefined → [] siempre, aunque haya Secuaces en mesa', () => {
    const minions: MinionInPlay[] = [minion({ instanceId: 'm1' })];
    expect(selectActingMinions(undefined, minions, rng)).toEqual([]);
  });

  it('mesa vacía → [] con cualquier behavior', () => {
    const behavior: MinionBehaviorSpec = { criterion: { kind: 'ALL' } };
    expect(selectActingMinions(behavior, [], rng)).toEqual([]);
  });

  it('ALL → todas las instancias en mesa', () => {
    const minions: MinionInPlay[] = [minion({ instanceId: 'm1' }), minion({ instanceId: 'm2' })];
    const behavior: MinionBehaviorSpec = { criterion: { kind: 'ALL' } };
    expect(selectActingMinions(behavior, minions, rng)).toEqual(minions);
  });

  it('RANDOM_ONE → 1 instancia elegida por randomSource.pick', () => {
    const minions: MinionInPlay[] = [minion({ instanceId: 'm1' }), minion({ instanceId: 'm2' })];
    const behavior: MinionBehaviorSpec = { criterion: { kind: 'RANDOM_ONE' } };
    const result = selectActingMinions(behavior, minions, rng);
    expect(result).toHaveLength(1);
    expect(minions).toContain(result[0]);
  });

  it('SPECIFIC_DEFINITION → todas las instancias cuyo definitionId coincida (0, 1 o más)', () => {
    const minions: MinionInPlay[] = [
      minion({ instanceId: 'm1', definitionId: 'a' }),
      minion({ instanceId: 'm2', definitionId: 'b' }),
      minion({ instanceId: 'm3', definitionId: 'a' }),
    ];
    const behavior: MinionBehaviorSpec = { criterion: { kind: 'SPECIFIC_DEFINITION', minionDefinitionId: 'a' } };
    const result = selectActingMinions(behavior, minions, rng);
    expect(result.map((m) => m.instanceId)).toEqual([minions[0]!.instanceId, minions[2]!.instanceId]);

    const behaviorNone: MinionBehaviorSpec = { criterion: { kind: 'SPECIFIC_DEFINITION', minionDefinitionId: 'nope' } };
    expect(selectActingMinions(behaviorNone, minions, rng)).toEqual([]);
  });

  it('HIGHEST_PLANO_ATTACK → la instancia con planoAttackAmount máximo; sin empate', () => {
    const minions: MinionInPlay[] = [
      minion({ instanceId: 'm1', planoAttackAmount: 1 }),
      minion({ instanceId: 'm2', planoAttackAmount: 5 }),
      minion({ instanceId: 'm3', planoAttackAmount: 3 }),
    ];
    const behavior: MinionBehaviorSpec = { criterion: { kind: 'HIGHEST_PLANO_ATTACK' } };
    const result = selectActingMinions(behavior, minions, rng);
    expect(result).toEqual([minions[1]]);
  });

  it('HIGHEST_PLANO_ATTACK → empate se resuelve a UNA sola vía randomSource.pick (reproducible con semilla fija)', () => {
    const minions: MinionInPlay[] = [
      minion({ instanceId: 'm1', planoAttackAmount: 5 }),
      minion({ instanceId: 'm2', planoAttackAmount: 5 }),
    ];
    const behavior: MinionBehaviorSpec = { criterion: { kind: 'HIGHEST_PLANO_ATTACK' } };
    const resultA = selectActingMinions(behavior, minions, new SeededRandomSource(42));
    const resultB = selectActingMinions(behavior, minions, new SeededRandomSource(42));
    expect(resultA).toHaveLength(1);
    expect(resultA).toEqual(resultB);
  });

  it('HIGHEST_LIFE → la instancia con vida ACTUAL máxima', () => {
    const minions: MinionInPlay[] = [
      minion({ instanceId: 'm1', life: 2 }),
      minion({ instanceId: 'm2', life: 8 }),
      minion({ instanceId: 'm3', life: 4 }),
    ];
    const behavior: MinionBehaviorSpec = { criterion: { kind: 'HIGHEST_LIFE' } };
    expect(selectActingMinions(behavior, minions, rng)).toEqual([minions[1]]);
  });

  it('LOWEST_LIFE → la instancia con vida ACTUAL mínima', () => {
    const minions: MinionInPlay[] = [
      minion({ instanceId: 'm1', life: 2 }),
      minion({ instanceId: 'm2', life: 8 }),
      minion({ instanceId: 'm3', life: 4 }),
    ];
    const behavior: MinionBehaviorSpec = { criterion: { kind: 'LOWEST_LIFE' } };
    expect(selectActingMinions(behavior, minions, rng)).toEqual([minions[0]]);
  });

  it('HIGHEST_LIFE/LOWEST_LIFE con un único Secuaz en mesa → lo devuelve trivialmente', () => {
    const minions: MinionInPlay[] = [minion({ instanceId: 'm1', life: 3 })];
    expect(selectActingMinions({ criterion: { kind: 'HIGHEST_LIFE' } }, minions, rng)).toEqual(minions);
    expect(selectActingMinions({ criterion: { kind: 'LOWEST_LIFE' } }, minions, rng)).toEqual(minions);
  });
});
