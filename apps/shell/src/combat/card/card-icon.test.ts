// Fix Reviewer post-H4 (`docs/specs/H4_componente_carta.md` §1) — `card-icon.ts` no tenía ningún
// test propio. Cubre `cardIconFor`: resolución directa por `cardType` para EQUIPO/ALIADO/
// CONTRATIEMPO, la subclasificación ATAQUE/TRAMA de EVENTO por familia de keywords, y el caso de
// fallback a ATAQUE cuando un EVENTO no lleva ninguna keyword de ninguna de las dos familias.
import { describe, it, expect } from 'vitest';
import { cardIconFor, CARD_ICON_GLYPH } from './card-icon';

describe('cardIconFor', () => {
  it('EQUIPO se resuelve directo por cardType, sin mirar keywords', () => {
    expect(cardIconFor('EQUIPO', [{ keyword: 'TRAMA_X' }])).toBe('EQUIPO');
  });

  it('ALIADO se resuelve directo por cardType, sin mirar keywords', () => {
    expect(cardIconFor('ALIADO', [{ keyword: 'ATAQUE' }])).toBe('ALIADO');
  });

  it('CONTRATIEMPO se resuelve directo por cardType, sin mirar keywords', () => {
    expect(cardIconFor('CONTRATIEMPO', [])).toBe('CONTRATIEMPO');
  });

  it('EVENTO con keyword de ataque (ATAQUE) → ATAQUE', () => {
    expect(cardIconFor('EVENTO', [{ keyword: 'ATAQUE' }])).toBe('ATAQUE');
  });

  it('EVENTO con keyword de ataque (ATAQUE_MAS_X) → ATAQUE', () => {
    expect(cardIconFor('EVENTO', [{ keyword: 'ATAQUE_MAS_X' }])).toBe('ATAQUE');
  });

  it('EVENTO con keyword de ataque (ATAQUE_POR_X) → ATAQUE', () => {
    expect(cardIconFor('EVENTO', [{ keyword: 'ATAQUE_POR_X' }])).toBe('ATAQUE');
  });

  it('EVENTO con keyword de trama (TRAMA_X) y sin keyword de ataque → TRAMA', () => {
    expect(cardIconFor('EVENTO', [{ keyword: 'TRAMA_X' }])).toBe('TRAMA');
  });

  it('EVENTO con TRAMA_X y ATAQUE a la vez: ataque tiene prioridad → ATAQUE', () => {
    expect(cardIconFor('EVENTO', [{ keyword: 'TRAMA_X' }, { keyword: 'ATAQUE' }])).toBe('ATAQUE');
  });

  it('EVENTO sin ninguna keyword de las dos familias: cae a ATAQUE por fallback', () => {
    expect(cardIconFor('EVENTO', [{ keyword: 'ARROLLAR' }])).toBe('ATAQUE');
  });

  it('EVENTO sin ninguna keyword en absoluto: cae a ATAQUE por fallback', () => {
    expect(cardIconFor('EVENTO', [])).toBe('ATAQUE');
  });
});

describe('CARD_ICON_GLYPH', () => {
  it('define un glyph para cada CardIconKind', () => {
    expect(CARD_ICON_GLYPH).toEqual({
      ATAQUE: '⚔️',
      TRAMA: '📜',
      EQUIPO: '🛡️',
      ALIADO: '🤝',
      CONTRATIEMPO: '⏪',
      SECUAZ: '👹', // NUEVO H4.x — CardTile size="board" (MinionRow)
    });
  });
});
