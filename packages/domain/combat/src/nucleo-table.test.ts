import { describe, it, expect } from 'vitest';
import { SeededRandomSource, ALL_NUCLEO_COLORS, createId, type NucleoInstanceId } from '@collector/domain-shared';
import {
  rollFixedDice,
  rollExtraDie,
  rerollAllDice,
  countAvailableDice,
  NUCLEO_VALUE_MIN,
  NUCLEO_VALUE_MAX,
  FIXED_NUCLEO_DICE_COUNT,
} from './nucleo-table';
import type { NucleoDie } from './types/nucleo';

function makeIdCounter(): () => NucleoInstanceId {
  let n = 0;
  return () => createId<'NucleoInstanceId'>('NucleoInstanceId', `nucleo-${n++}`);
}

describe('rollFixedDice', () => {
  it('siempre genera exactamente 5 dados, uno por cada color de ALL_NUCLEO_COLORS, en ese orden', () => {
    const rng = new SeededRandomSource(1);
    const dice = rollFixedDice(rng, makeIdCounter());
    expect(dice).toHaveLength(FIXED_NUCLEO_DICE_COUNT);
    expect(dice.map((d) => d.color)).toEqual(ALL_NUCLEO_COLORS);
  });

  it('todos los dados generados están AVAILABLE, kind FIXED, valor en [1,4]', () => {
    const rng = new SeededRandomSource(2);
    const dice = rollFixedDice(rng, makeIdCounter());
    for (const die of dice) {
      expect(die.kind).toBe('FIXED');
      expect(die.status).toBe('AVAILABLE');
      expect(die.value).toBeGreaterThanOrEqual(NUCLEO_VALUE_MIN);
      expect(die.value).toBeLessThanOrEqual(NUCLEO_VALUE_MAX);
    }
  });

  it('es reproducible con la misma semilla', () => {
    const a = rollFixedDice(new SeededRandomSource(42), makeIdCounter());
    const b = rollFixedDice(new SeededRandomSource(42), makeIdCounter());
    expect(a).toEqual(b);
  });
});

describe('rollExtraDie', () => {
  it('genera un dado del color pedido, kind EXTRA, AVAILABLE', () => {
    const rng = new SeededRandomSource(3);
    const die = rollExtraDie('CAOS', rng, makeIdCounter());
    expect(die.color).toBe('CAOS');
    expect(die.kind).toBe('EXTRA');
    expect(die.status).toBe('AVAILABLE');
    expect(die.value).toBeGreaterThanOrEqual(NUCLEO_VALUE_MIN);
    expect(die.value).toBeLessThanOrEqual(NUCLEO_VALUE_MAX);
  });
});

describe('rerollAllDice', () => {
  it('conserva id/color/kind, cambia value, y fuerza AVAILABLE en todos (mezcla previa AVAILABLE/SPENT)', () => {
    const rng = new SeededRandomSource(5);
    const before: NucleoDie[] = [
      { id: createId<'NucleoInstanceId'>('NucleoInstanceId', 'a'), color: 'AGRESION', value: 1, kind: 'FIXED', status: 'SPENT' },
      { id: createId<'NucleoInstanceId'>('NucleoInstanceId', 'b'), color: 'CAOS', value: 2, kind: 'EXTRA', status: 'AVAILABLE' },
    ];
    const after = rerollAllDice(before, rng);
    expect(after).toHaveLength(2);
    for (let i = 0; i < before.length; i++) {
      expect(after[i]!.id).toBe(before[i]!.id);
      expect(after[i]!.color).toBe(before[i]!.color);
      expect(after[i]!.kind).toBe(before[i]!.kind);
      expect(after[i]!.status).toBe('AVAILABLE');
      expect(after[i]!.value).toBeGreaterThanOrEqual(NUCLEO_VALUE_MIN);
      expect(after[i]!.value).toBeLessThanOrEqual(NUCLEO_VALUE_MAX);
    }
  });
});

describe('countAvailableDice', () => {
  it('cuenta solo los AVAILABLE en una mezcla', () => {
    const dice: NucleoDie[] = [
      { id: createId<'NucleoInstanceId'>('NucleoInstanceId', 'a'), color: 'AGRESION', value: 1, kind: 'FIXED', status: 'SPENT' },
      { id: createId<'NucleoInstanceId'>('NucleoInstanceId', 'b'), color: 'CAOS', value: 2, kind: 'EXTRA', status: 'AVAILABLE' },
      { id: createId<'NucleoInstanceId'>('NucleoInstanceId', 'c'), color: 'CONTROL', value: 3, kind: 'FIXED', status: 'AVAILABLE' },
    ];
    expect(countAvailableDice(dice)).toBe(2);
    expect(countAvailableDice([])).toBe(0);
  });
});
