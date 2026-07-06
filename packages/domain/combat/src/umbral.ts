import type { NucleoValue } from './types/nucleo';
import type { AbilityUmbralDefinition, AbilityUmbralResolution, UmbralFormula } from './types/umbral';
import { UMBRAL_BONUS_THRESHOLD } from './types/umbral';

/**
 * Aplica literalmente la aritmética de `formula` sobre `nucleoValue`. Pura, sin
 * estado, sin ningún caso especial para `nucleoValue === 0` — el 0 se trata como
 * cualquier otro número (ver spec H1.5 §0.4: para 'ADD', 0 + amount = amount, NUNCA se
 * clampea a 0).
 */
export function computeUmbralFormulaValue(formula: UmbralFormula, nucleoValue: NucleoValue): number {
  switch (formula.kind) {
    case 'VALUE':
      return nucleoValue;
    case 'ADD':
      return nucleoValue + formula.amount;
    case 'MULTIPLY':
      return nucleoValue * formula.amount;
  }
}

/**
 * GDD §12: "Si el Núcleo gastado es ≥3, efecto extra". Universal: no depende de la
 * fórmula de la habilidad, solo del valor bruto del Núcleo gastado.
 */
export function isUmbralBonusActive(nucleoValue: NucleoValue): boolean {
  return nucleoValue >= UMBRAL_BONUS_THRESHOLD;
}

/**
 * Resuelve una `AbilityUmbralDefinition` completa (fórmula base + bonus opcional)
 * contra el valor de un Núcleo gastado. Punto de entrada principal de esta historia —
 * ver spec H1.5 §0.1: NO consulta ni muta `CombatEngine`; quien la invoque le pasa el
 * `NucleoValue` (ej. `nucleoSpent.value` de un evento `ABILITY_ACTIVADO`, H1.3)
 * explícitamente.
 */
export function resolveAbilityUmbral(
  definition: AbilityUmbralDefinition,
  nucleoValue: NucleoValue
): AbilityUmbralResolution {
  const bonusActivated = isUmbralBonusActive(nucleoValue);
  const bonusResolvedValue =
    bonusActivated && definition.bonusFormula !== undefined
      ? computeUmbralFormulaValue(definition.bonusFormula, nucleoValue)
      : undefined;

  // `exactOptionalPropertyTypes` (tsconfig.base.json) prohíbe asignar `undefined`
  // explícitamente a una propiedad opcional — se omite la clave en vez de asignarle
  // `undefined` cuando no aplica; `toEqual` en los tests (§4) trata ambas formas como
  // equivalentes.
  return {
    nucleoValue,
    baseResolvedValue: computeUmbralFormulaValue(definition.baseFormula, nucleoValue),
    bonusActivated,
    ...(bonusResolvedValue !== undefined ? { bonusResolvedValue } : {}),
  };
}
