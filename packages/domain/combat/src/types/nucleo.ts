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
