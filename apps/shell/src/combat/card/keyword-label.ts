import type { KeywordId } from '@collector/domain-catalog';

/**
 * H4_componente_carta.md §1.4 — helper puro, testeable sin DOM: traduce `KeywordId` (vocabulario
 * cerrado de `catalog/types/keyword.ts`) a texto legible en español para los pills de `CardTile`.
 * Keywords con `amount` (`ATAQUE_MAS_X`, `ATAQUE_POR_X`, `TRAMA_X`, `DEFENSA_X`, `VIDA_X`) componen
 * el número en el propio label (ej. `{ keyword: 'TRAMA_X', amount: 2 }` → `'Trama +2'`).
 */
const KEYWORD_LABELS: Record<KeywordId, string> = {
  ATAQUE: 'Ataque',
  ATAQUE_MAS_X: 'Ataque',
  ATAQUE_POR_X: 'Ataque',
  CAOS: 'Caos',
  TRAMA_X: 'Trama',
  DEFENSA_X: 'Defensa',
  UMBRAL: 'Umbral',
  COMBO: 'Combo',
  ARROLLAR: 'Arrollar',
  DEFENSOR: 'Defensor',
  BERSERKER: 'Berserker',
  NEUTRO: 'Neutro',
  DESHACER_DANO: 'Deshacer Daño',
  DESHACER_TURNO: 'Deshacer Turno',
  VIDA_X: 'Vida',
};

export function keywordLabel(instance: { readonly keyword: KeywordId; readonly amount?: number }): string {
  const base = KEYWORD_LABELS[instance.keyword] ?? instance.keyword;
  if (instance.keyword === 'ATAQUE_POR_X' && instance.amount !== undefined) {
    return `${base} ×${instance.amount}`;
  }
  if (instance.amount !== undefined) {
    return `${base} +${instance.amount}`;
  }
  return base;
}
