import { describe, it, expect } from 'vitest';
import { SeededRandomSource, ALL_NUCLEO_COLORS, createId, type NucleoInstanceId } from '@collector/domain-shared';
import { rollNucleo, rollPool, NUCLEO_VALUE_MIN, NUCLEO_VALUE_MAX } from './nucleo-pool';

function makeIdCounter(): () => NucleoInstanceId {
  let n = 0;
  return () => createId<'NucleoInstanceId'>('NucleoInstanceId', `nucleo-${n++}`);
}

describe('rollNucleo', () => {
  it('siempre genera color de ALL_NUCLEO_COLORS y valor en [1,4]', () => {
    const rng = new SeededRandomSource(1);
    const nextId = makeIdCounter();
    for (let i = 0; i < 200; i++) {
      const nucleo = rollNucleo(rng, nextId);
      expect(ALL_NUCLEO_COLORS).toContain(nucleo.color);
      expect(nucleo.value).toBeGreaterThanOrEqual(NUCLEO_VALUE_MIN);
      expect(nucleo.value).toBeLessThanOrEqual(NUCLEO_VALUE_MAX);
    }
  });
});

describe('rollPool', () => {
  it('genera exactamente `size` fichas con ids únicos', () => {
    const rng = new SeededRandomSource(7);
    const pool = rollPool(6, rng, makeIdCounter());
    expect(pool).toHaveLength(6);
    expect(new Set(pool.map((n) => n.id)).size).toBe(6);
  });

  it('es reproducible con la misma semilla y el mismo generador de ids', () => {
    const poolA = rollPool(6, new SeededRandomSource(42), makeIdCounter());
    const poolB = rollPool(6, new SeededRandomSource(42), makeIdCounter());
    expect(poolA).toEqual(poolB);
  });

  it('lanza si size <= 0', () => {
    const rng = new SeededRandomSource(1);
    expect(() => rollPool(0, rng, makeIdCounter())).toThrow();
    expect(() => rollPool(-1, rng, makeIdCounter())).toThrow();
  });
});
