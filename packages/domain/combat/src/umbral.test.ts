import { describe, it, expect } from 'vitest';
import { computeUmbralFormulaValue, isUmbralBonusActive, resolveAbilityUmbral } from './umbral';
import { UMBRAL_BONUS_THRESHOLD, type AbilityUmbralDefinition, type UmbralFormula } from './types/umbral';

describe('computeUmbralFormulaValue — keyword "Ataque" (VALUE)', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
  ])('nucleoValue=%i → resultado=%i (Daño = valor del Núcleo, GDD §12)', (nucleoValue, expected) => {
    const formula: UmbralFormula = { kind: 'VALUE' };
    expect(computeUmbralFormulaValue(formula, nucleoValue)).toBe(expected);
  });
});

describe('computeUmbralFormulaValue — keyword "Ataque +X" (ADD, amount=2)', () => {
  it.each([
    [0, 2],
    [1, 3],
    [2, 4],
    [3, 5],
    [4, 6],
  ])('nucleoValue=%i → resultado=%i (Daño = Núcleo + 2, GDD §12)', (nucleoValue, expected) => {
    const formula: UmbralFormula = { kind: 'ADD', amount: 2 };
    expect(computeUmbralFormulaValue(formula, nucleoValue)).toBe(expected);
  });

  it('nucleoValue=0 NO colapsa a 0: devuelve exactamente `amount` (spec §0.4 — no hay clamp especial para 0)', () => {
    const formula: UmbralFormula = { kind: 'ADD', amount: 7 };
    expect(computeUmbralFormulaValue(formula, 0)).toBe(7);
  });
});

describe('computeUmbralFormulaValue — keyword "Ataque ×X" (MULTIPLY, amount=3)', () => {
  it.each([
    [0, 0],
    [1, 3],
    [2, 6],
    [3, 9],
    [4, 12],
  ])('nucleoValue=%i → resultado=%i (Daño = Núcleo × 3, GDD §12)', (nucleoValue, expected) => {
    const formula: UmbralFormula = { kind: 'MULTIPLY', amount: 3 };
    expect(computeUmbralFormulaValue(formula, nucleoValue)).toBe(expected);
  });

  it('nucleoValue=0 SÍ colapsa a 0 con cualquier amount (0 × X = 0)', () => {
    const formula: UmbralFormula = { kind: 'MULTIPLY', amount: 999 };
    expect(computeUmbralFormulaValue(formula, 0)).toBe(0);
  });
});

describe('isUmbralBonusActive — GDD §12: "Si el Núcleo gastado es ≥3, efecto extra"', () => {
  it.each([
    [0, false],
    [1, false],
    [2, false],
    [3, true],
    [4, true],
  ])('nucleoValue=%i → bonusActivated=%s', (nucleoValue, expected) => {
    expect(isUmbralBonusActive(nucleoValue)).toBe(expected);
  });

  it('el umbral configurado es exactamente 3 (UMBRAL_BONUS_THRESHOLD)', () => {
    expect(UMBRAL_BONUS_THRESHOLD).toBe(3);
  });
});

describe('resolveAbilityUmbral — habilidad SIN bonusFormula (bonusResolvedValue siempre undefined)', () => {
  const definition: AbilityUmbralDefinition = { baseFormula: { kind: 'ADD', amount: 2 } };

  it.each([
    [0, 2, false],
    [1, 3, false],
    [2, 4, false],
    [3, 5, true],
    [4, 6, true],
  ])(
    'nucleoValue=%i → baseResolvedValue=%i, bonusActivated=%s, bonusResolvedValue=undefined',
    (nucleoValue, expectedBase, expectedBonusActivated) => {
      const result = resolveAbilityUmbral(definition, nucleoValue);
      expect(result).toEqual({
        nucleoValue,
        baseResolvedValue: expectedBase,
        bonusActivated: expectedBonusActivated,
        bonusResolvedValue: undefined,
      });
    }
  );
});

describe('resolveAbilityUmbral — habilidad CON bonusFormula ("Ataque = Núcleo; Umbral: +5 adicional")', () => {
  const definition: AbilityUmbralDefinition = {
    baseFormula: { kind: 'VALUE' },
    bonusFormula: { kind: 'ADD', amount: 5 },
  };

  it.each([
    [0, 0, false, undefined],
    [1, 1, false, undefined],
    [2, 2, false, undefined],
    [3, 3, true, 8],
    [4, 4, true, 9],
  ])(
    'nucleoValue=%i → baseResolvedValue=%i, bonusActivated=%s, bonusResolvedValue=%s',
    (nucleoValue, expectedBase, expectedBonusActivated, expectedBonusResolvedValue) => {
      const result = resolveAbilityUmbral(definition, nucleoValue);
      expect(result).toEqual({
        nucleoValue,
        baseResolvedValue: expectedBase,
        bonusActivated: expectedBonusActivated,
        bonusResolvedValue: expectedBonusResolvedValue,
      });
    }
  );
});

describe('resolveAbilityUmbral — criterio de aceptación literal: Núcleo modificado a 0', () => {
  it('con fórmula base "Ataque" (VALUE), el efecto numérico resuelve a 0 y Umbral NO se activa', () => {
    const definition: AbilityUmbralDefinition = {
      baseFormula: { kind: 'VALUE' },
      bonusFormula: { kind: 'ADD', amount: 10 },
    };
    const result = resolveAbilityUmbral(definition, 0);
    expect(result.baseResolvedValue).toBe(0);
    expect(result.bonusActivated).toBe(false);
    expect(result.bonusResolvedValue).toBeUndefined();
  });
});

describe('resolveAbilityUmbral — el valor del Núcleo NUNCA bloquea/lanza, ni con valor 1 ni con 0', () => {
  it.each([0, 1, 2, 3, 4])(
    'nucleoValue=%i no lanza excepción (GDD §2.4: el valor nunca condiciona si la habilidad es pagable, solo su efecto)',
    (nucleoValue) => {
      const definition: AbilityUmbralDefinition = { baseFormula: { kind: 'ADD', amount: 1 } };
      expect(() => resolveAbilityUmbral(definition, nucleoValue)).not.toThrow();
    }
  );

  it('Núcleo valor 1: no bloquea la habilidad, solo produce un efecto reducido (no un error/rechazo)', () => {
    const definition: AbilityUmbralDefinition = { baseFormula: { kind: 'MULTIPLY', amount: 4 } };
    const result = resolveAbilityUmbral(definition, 1);
    expect(result.baseResolvedValue).toBe(4); // reducido frente a, ej., nucleoValue=4 → 16
    expect(result.bonusActivated).toBe(false);
  });
});
