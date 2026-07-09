// Fix Reviewer post-H4 (`docs/specs/H4_componente_carta.md` §1.4) — `keyword-label.ts` no tenía
// ningún test propio. Cubre la tabla completa de traducción `KeywordId → string`, incluidos los
// casos con `amount` (composición del número en el label) y el caso especial `ATAQUE_POR_X`
// (multiplicador `×N` en vez de `+N`).
import { describe, it, expect } from 'vitest';
import { keywordLabel } from './keyword-label';

describe('keywordLabel', () => {
  it('keywords sin amount se traducen a su label base', () => {
    expect(keywordLabel({ keyword: 'ATAQUE' })).toBe('Ataque');
    expect(keywordLabel({ keyword: 'CAOS' })).toBe('Caos');
    expect(keywordLabel({ keyword: 'UMBRAL' })).toBe('Umbral');
    expect(keywordLabel({ keyword: 'COMBO' })).toBe('Combo');
    expect(keywordLabel({ keyword: 'ARROLLAR' })).toBe('Arrollar');
    expect(keywordLabel({ keyword: 'DEFENSOR' })).toBe('Defensor');
    expect(keywordLabel({ keyword: 'BERSERKER' })).toBe('Berserker');
    expect(keywordLabel({ keyword: 'NEUTRO' })).toBe('Neutro');
    expect(keywordLabel({ keyword: 'DESHACER_DANO' })).toBe('Deshacer Daño');
    expect(keywordLabel({ keyword: 'DESHACER_TURNO' })).toBe('Deshacer Turno');
  });

  it('ATAQUE_MAS_X con amount compone "Ataque +N"', () => {
    expect(keywordLabel({ keyword: 'ATAQUE_MAS_X', amount: 2 })).toBe('Ataque +2');
  });

  it('ATAQUE_POR_X con amount compone "Ataque ×N" (multiplicador, no suma)', () => {
    expect(keywordLabel({ keyword: 'ATAQUE_POR_X', amount: 3 })).toBe('Ataque ×3');
  });

  it('TRAMA_X con amount compone "Trama +N"', () => {
    expect(keywordLabel({ keyword: 'TRAMA_X', amount: 2 })).toBe('Trama +2');
  });

  it('DEFENSA_X con amount compone "Defensa +N"', () => {
    expect(keywordLabel({ keyword: 'DEFENSA_X', amount: 1 })).toBe('Defensa +1');
  });

  it('VIDA_X con amount compone "Vida +N"', () => {
    expect(keywordLabel({ keyword: 'VIDA_X', amount: 5 })).toBe('Vida +5');
  });

  it('ATAQUE (sin _X) con amount definido igual compone "+N" (no es el caso normal del catálogo, pero el helper es total)', () => {
    expect(keywordLabel({ keyword: 'ATAQUE', amount: 1 })).toBe('Ataque +1');
  });
});
