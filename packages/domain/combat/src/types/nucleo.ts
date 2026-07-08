import type { NucleoColor, NucleoInstanceId } from '@collector/domain-shared';

/**
 * Valor bruto de una ficha de Núcleo. Se tipa como `number` (no unión literal 1|2|3|4)
 * porque decisions.md ("Piso del valor de Núcleo: permitir 0 como debuff extremo")
 * permite que un modificador futuro (fuera de alcance de H1.3, ver H1.5) fije el valor
 * a 0. El rango de GENERACIÓN válido en esta historia es siempre [1,4] — ver §5 (nucleo-pool.ts).
 */
export type NucleoValue = number;

export interface NucleoInstance {
  readonly id: NucleoInstanceId;
  readonly color: NucleoColor;
  readonly value: NucleoValue;
}

/** NUEVO H3.4. `'FIXED'` = uno de los 5 dados permanentes (uno por color, nunca se
 *  elimina de la mesa). `'EXTRA'` = añadido por una carta/equipo; tampoco se elimina
 *  una vez añadido en esta historia (no hay mecanismo de "quitar" un extra — fuera de
 *  alcance, contenido futuro). */
export type NucleoDieKind = 'FIXED' | 'EXTRA';

/** NUEVO H3.4. `'AVAILABLE'` = puede gastarse. `'SPENT'` = ya gastado en este ciclo,
 *  vuelve a `'AVAILABLE'` únicamente cuando ocurre un reroll colectivo. */
export type NucleoDieStatus = 'AVAILABLE' | 'SPENT';

/** NUEVO H3.4. Extiende `NucleoInstance` (mismos 3 campos, mismo significado) con el
 *  estado de mesa. Es el tipo de `CombatStateSnapshot.nucleoTable` — NUNCA el tipo de
 *  `CombatEvent.nucleoSpent` (que sigue siendo `NucleoInstance` puro). */
export interface NucleoDie extends NucleoInstance {
  readonly kind: NucleoDieKind;
  readonly status: NucleoDieStatus;
}
