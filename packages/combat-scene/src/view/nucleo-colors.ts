import type { NucleoColor } from '@collector/domain-shared';

/**
 * H2.8 spec §6 — extraída de `juice/recipes/dice-roll.ts` (H2.5, donde vivía como literal privado) a
 * este módulo compartido para que `nucleo-pool-view.ts` la reutilice sin duplicar la tabla de 5
 * colores. `dice-roll.ts` pasa a importarla de aquí — sin cambio de comportamiento/valores.
 */
export const NUCLEO_COLOR_HEX: Record<NucleoColor, number> = {
  AGRESION: 0xe74c3c,
  CONTROL: 0x3498db,
  DEFENSA: 0x2ecc71,
  RECURSO: 0xf1c40f,
  CAOS: 0x9b59b6,
};
