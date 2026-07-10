import type { KeywordId } from '@collector/domain-catalog';

/**
 * H4_componente_carta.md §1 — módulo puro, sin dependencias de React/Phaser (testeable en
 * aislamiento). `CardIconKind` es la clasificación visual de tipo de carta que `CardTile` usa para
 * icono/color de borde — NO existe como `CardType` propio en el dominio (`catalog/types/card.ts`
 * fija `CardType = 'EQUIPO'|'ALIADO'|'EVENTO'|'CONTRATIEMPO'`). Ataque/Trama son sub-clasificaciones
 * de EVENTO derivadas de sus keywords (§1 spec, nota de justificación).
 */
/** NUEVO H4.x — `SECUAZ` se añade para `CardTile size="board"` (`MinionRow`, un Secuaz enemigo en
 *  mesa nunca es una carta jugable de la mano, así que no participa en `cardIconFor`). */
export type CardIconKind = 'ATAQUE' | 'TRAMA' | 'EQUIPO' | 'ALIADO' | 'CONTRATIEMPO' | 'SECUAZ';

const ATTACK_KEYWORDS: readonly KeywordId[] = ['ATAQUE', 'ATAQUE_MAS_X', 'ATAQUE_POR_X'];
const PLOT_KEYWORDS: readonly KeywordId[] = ['TRAMA_X'];

/**
 * Deriva el icono de tipo de una carta EVENTO/EQUIPO/ALIADO/CONTRATIEMPO a partir de `cardType` +
 * `keywords`. EQUIPO/ALIADO/CONTRATIEMPO se resuelven directo por `cardType`, sin mirar keywords.
 * EVENTO se subdivide en ATAQUE/TRAMA según qué familia de keywords lleve; si una carta EVENTO no
 * llevara ninguna de las dos (no debería ocurrir en el catálogo actual, pero el helper debe ser
 * total), cae a ATAQUE por ser la familia de EVENTO más numerosa/representativa del catálogo MVP.
 */
export function cardIconFor(
  cardType: 'EQUIPO' | 'ALIADO' | 'EVENTO' | 'CONTRATIEMPO',
  keywords: readonly { readonly keyword: string }[],
): CardIconKind {
  if (cardType === 'EQUIPO') return 'EQUIPO';
  if (cardType === 'ALIADO') return 'ALIADO';
  if (cardType === 'CONTRATIEMPO') return 'CONTRATIEMPO';

  // cardType === 'EVENTO'
  const hasAttack = keywords.some((k) => ATTACK_KEYWORDS.includes(k.keyword as KeywordId));
  const hasPlot = keywords.some((k) => PLOT_KEYWORDS.includes(k.keyword as KeywordId));
  if (hasPlot && !hasAttack) return 'TRAMA';
  return 'ATAQUE';
}

export const CARD_ICON_GLYPH: Record<CardIconKind, string> = {
  ATAQUE: '⚔️',
  TRAMA: '📜',
  EQUIPO: '🛡️',
  ALIADO: '🤝',
  CONTRATIEMPO: '⏪',
  SECUAZ: '👹',
};
