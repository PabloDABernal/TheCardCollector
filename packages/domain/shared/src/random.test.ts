import { describe, it, expect } from 'vitest';
import { DefaultRandomSource, SeededRandomSource } from './random';

describe('SeededRandomSource', () => {
  it('produce la misma secuencia de next() con la misma semilla', () => {
    const a = new SeededRandomSource(42);
    const b = new SeededRandomSource(42);

    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];

    expect(seqA).toEqual(seqB);
  });

  it('produce secuencias distintas con semillas distintas', () => {
    const a = new SeededRandomSource(1);
    const b = new SeededRandomSource(2);

    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];

    expect(seqA).not.toEqual(seqB);
  });

  it('nextInt es reproducible con la misma semilla y respeta el rango [min, max)', () => {
    const a = new SeededRandomSource(7);
    const b = new SeededRandomSource(7);

    const rollsA = Array.from({ length: 20 }, () => a.nextInt(1, 5)); // simula valores de Núcleo 1-4
    const rollsB = Array.from({ length: 20 }, () => b.nextInt(1, 5));

    expect(rollsA).toEqual(rollsB);
    for (const roll of rollsA) {
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThan(5);
    }
  });

  it('pick es reproducible con la misma semilla y solo devuelve elementos de la lista', () => {
    const secuaces = ['A', 'B', 'C'] as const;
    const a = new SeededRandomSource(99);
    const b = new SeededRandomSource(99);

    const picksA = Array.from({ length: 10 }, () => a.pick(secuaces));
    const picksB = Array.from({ length: 10 }, () => b.pick(secuaces));

    expect(picksA).toEqual(picksB);
    for (const p of picksA) {
      expect(secuaces).toContain(p);
    }
  });

  it('nextInt lanza si maxExclusive <= minInclusive', () => {
    const rng = new SeededRandomSource(1);
    expect(() => rng.nextInt(5, 5)).toThrow();
  });

  it('pick lanza si la lista está vacía', () => {
    const rng = new SeededRandomSource(1);
    expect(() => rng.pick([])).toThrow();
  });
});

describe('DefaultRandomSource', () => {
  it('next() devuelve siempre un valor en [0, 1)', () => {
    const rng = new DefaultRandomSource();
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
