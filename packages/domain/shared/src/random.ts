export interface RandomSource {
  /** Float en [0, 1), igual contrato que Math.random(). Primitiva base. */
  next(): number;

  /** Entero en [minInclusive, maxExclusive). Lanza si maxExclusive <= minInclusive. */
  nextInt(minInclusive: number, maxExclusive: number): number;

  /** Elige un elemento uniformemente al azar de un array no vacío. Lanza si items.length === 0. */
  pick<T>(items: readonly T[]): T;
}

export abstract class BaseRandomSource implements RandomSource {
  abstract next(): number;

  nextInt(minInclusive: number, maxExclusive: number): number {
    if (maxExclusive <= minInclusive) {
      throw new Error(`nextInt: maxExclusive (${maxExclusive}) debe ser > minInclusive (${minInclusive})`);
    }
    return minInclusive + Math.floor(this.next() * (maxExclusive - minInclusive));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('pick: items no puede estar vacío');
    }
    return items[this.nextInt(0, items.length)] as T;
  }
}

export class DefaultRandomSource extends BaseRandomSource {
  next(): number {
    return Math.random();
  }
}

export class SeededRandomSource extends BaseRandomSource {
  private state: number;

  constructor(seed: number) {
    super();
    // Fuerza a entero de 32 bits sin signo; asegura estado inicial determinista
    // incluso si `seed` llega como float o negativo.
    this.state = seed >>> 0;
  }

  next(): number {
    // mulberry32 — https://github.com/bryc/code/blob/master/jshash/PRNGs.md (dominio público)
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
