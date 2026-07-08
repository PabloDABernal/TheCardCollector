import type { RandomSource, NucleoColor, NucleoInstanceId } from '@collector/domain-shared';
import { ALL_NUCLEO_COLORS } from '@collector/domain-shared';
import type { NucleoDie, NucleoValue } from './types/nucleo';

export const NUCLEO_VALUE_MIN = 1;
export const NUCLEO_VALUE_MAX = 4;

/** GDD/decisions.md: exactamente 5 dados fijos, uno por color — ya no es "tamaño de
 *  pool" configurable (DEFAULT_NUCLEO_POOL_SIZE desaparece, H3.4). */
export const FIXED_NUCLEO_DICE_COUNT = 5; // === ALL_NUCLEO_COLORS.length, documentado explícito

/** Tope duro de dados simultáneos en mesa — valor de diseño sugerido, confirmado por
 *  Director Creativo en decisions.md (2026-07-08) como "sugerido: 10, a confirmar en
 *  balanceo". Configurable vía CombatEngineConfig.tableMaxDice. */
export const DEFAULT_NUCLEO_TABLE_MAX_DICE = 10;

function rollValue(rng: RandomSource): NucleoValue {
  return rng.nextInt(NUCLEO_VALUE_MIN, NUCLEO_VALUE_MAX + 1);
}

/** Genera los 5 dados FIXED iniciales, uno por cada color de ALL_NUCLEO_COLORS, en ese
 *  orden — todos AVAILABLE. Usado solo en el constructor de CombatEngine. */
export function rollFixedDice(rng: RandomSource, nextId: () => NucleoInstanceId): NucleoDie[] {
  return ALL_NUCLEO_COLORS.map((color) => ({
    id: nextId(),
    color,
    value: rollValue(rng),
    kind: 'FIXED' as const,
    status: 'AVAILABLE' as const,
  }));
}

/** Genera un dado EXTRA nuevo de `color`, AVAILABLE. Usado por
 *  `CombatEngine.addExtraNucleoDie`. */
export function rollExtraDie(color: NucleoColor, rng: RandomSource, nextId: () => NucleoInstanceId): NucleoDie {
  return { id: nextId(), color, value: rollValue(rng), kind: 'EXTRA', status: 'AVAILABLE' };
}

/** Reroll colectivo (GDD/decisions.md: "en cuanto se gasta el ÚLTIMO dado disponible,
 *  se re-tiran TODOS"). Conserva `id`/`color`/`kind` de cada dado, genera `value` nuevo,
 *  fuerza `status: 'AVAILABLE'` en todos — incluidos los que ya estaban disponibles. */
export function rerollAllDice(dice: readonly NucleoDie[], rng: RandomSource): NucleoDie[] {
  return dice.map((d) => ({ ...d, value: rollValue(rng), status: 'AVAILABLE' as const }));
}

export function countAvailableDice(dice: readonly NucleoDie[]): number {
  return dice.filter((d) => d.status === 'AVAILABLE').length;
}
