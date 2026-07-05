/** Los 5 colores base del GDD (§2.3, §11.3). El pool de Núcleos tiene exactamente
 * estos 5 colores — "Neutro" NO es un 6º color de ficha, ver §0.4/§0.5. */
export type NucleoColor = 'AGRESION' | 'CONTROL' | 'DEFENSA' | 'RECURSO' | 'CAOS';

/** Los 5 colores posibles de una ficha del pool de Núcleos. Equivalente a todos los
 * valores de `NucleoColor` — se mantiene como constante (en vez de derivarla del tipo
 * en runtime) para que `RandomSource.pick`/tests tengan un array literal a mano. */
export const ALL_NUCLEO_COLORS: readonly NucleoColor[] = ['AGRESION', 'CONTROL', 'DEFENSA', 'RECURSO', 'CAOS'];

/**
 * Requisito de coste de Núcleo de una habilidad/carta (GDD §2.4, tabla de notación).
 * Referenciado sin definir en architecture_stack.md §5.2 (`CardDefinition.cost.coreRequirement`);
 * esta historia lo cierra aquí para que `domain/catalog` (H1.8) lo reutilice sin duplicarlo.
 *
 * - 'ANY'   → ⚫ un Núcleo de cualquiera de los 5 colores. Esto es lo que el GDD llama
 *             "habilidad/coste Neutro" (GDD §2.3.2, decisions.md): no importa el color,
 *             acepta cualquier Núcleo disponible, para que ningún color quede sin uso
 *             posible. No existe un `kind` separado para esto — `'ANY'` ya es Neutro
 *             en el sentido correcto del término (ver §0.4).
 * - 'COLOR' → 🔴 / 🔴🟡🟢 un Núcleo de alguno de los colores concretos listados.
 */
export type CoreCostRequirement =
  | { readonly kind: 'ANY' }
  | { readonly kind: 'COLOR'; readonly colors: readonly NucleoColor[] };

/** Evalúa si un Núcleo de `color` satisface `requirement`. Pura, sin estado. */
export function satisfiesCoreCost(requirement: CoreCostRequirement, color: NucleoColor): boolean {
  switch (requirement.kind) {
    case 'ANY':
      return true;
    case 'COLOR':
      return requirement.colors.includes(color);
  }
}
