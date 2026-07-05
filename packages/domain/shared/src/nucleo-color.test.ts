import { describe, it, expect } from 'vitest';
import { satisfiesCoreCost, ALL_NUCLEO_COLORS, type NucleoColor } from './nucleo-color';

describe('satisfiesCoreCost', () => {
  it("'ANY' (coste neutro) acepta cualquiera de los 5 colores", () => {
    expect(ALL_NUCLEO_COLORS).toHaveLength(5);
    for (const color of ALL_NUCLEO_COLORS) {
      expect(satisfiesCoreCost({ kind: 'ANY' }, color)).toBe(true);
    }
  });

  it("'COLOR' acepta solo los colores listados", () => {
    const requirement = { kind: 'COLOR' as const, colors: ['AGRESION', 'RECURSO'] as NucleoColor[] };
    expect(satisfiesCoreCost(requirement, 'AGRESION')).toBe(true);
    expect(satisfiesCoreCost(requirement, 'RECURSO')).toBe(true);
    expect(satisfiesCoreCost(requirement, 'CONTROL')).toBe(false);
    expect(satisfiesCoreCost(requirement, 'CAOS')).toBe(false);
  });
});
