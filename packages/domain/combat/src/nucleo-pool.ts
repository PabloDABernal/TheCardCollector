import type { RandomSource, NucleoColor, NucleoInstanceId } from '@collector/domain-shared';
import { ALL_NUCLEO_COLORS } from '@collector/domain-shared';
import type { NucleoInstance, NucleoValue } from './types/nucleo';

export const NUCLEO_VALUE_MIN = 1;
export const NUCLEO_VALUE_MAX = 4;

/**
 * Valor placeholder, NO definitivo — ver §0.3. Game Designer/Director deben confirmar
 * el tamaño real del pool antes de balancear contenido (H1.9+). No se registra en
 * decisions.md como cerrado.
 */
export const DEFAULT_NUCLEO_POOL_SIZE = 6;

/**
 * Genera una ficha de Núcleo: color uniforme entre los 5 posibles (decisión §0.4;
 * Neutro NO es un color de ficha, ver §0.4/§0.5), valor uniforme en
 * [NUCLEO_VALUE_MIN, NUCLEO_VALUE_MAX] vía `RandomSource.nextInt` (mismo patrón ya
 * usado en el test de H1.2, `nextInt(1, 5)`).
 */
export function rollNucleo(rng: RandomSource, nextId: () => NucleoInstanceId): NucleoInstance {
  const color: NucleoColor = rng.pick(ALL_NUCLEO_COLORS);
  const value: NucleoValue = rng.nextInt(NUCLEO_VALUE_MIN, NUCLEO_VALUE_MAX + 1);
  return { id: nextId(), color, value };
}

/** Lanza si `size <= 0` — un pool vacío por construcción no tiene sentido de dominio. */
export function rollPool(size: number, rng: RandomSource, nextId: () => NucleoInstanceId): NucleoInstance[] {
  if (size <= 0) {
    throw new Error(`rollPool: size (${size}) debe ser > 0`);
  }
  return Array.from({ length: size }, () => rollNucleo(rng, nextId));
}
