import type { AbilityId, CoreCostRequirement } from '@collector/domain-shared';

/**
 * Espejo intencional de `ABILITY_BASE_COOLDOWN_MIN` (domain/combat/types/cooldown.ts) —
 * catalog no puede importar ese archivo (ver spec §0.2). Ambas constantes citan la misma
 * regla de origen (GDD §2.5: "CD mínimo = 1, nunca 0") y deben mantenerse sincronizadas
 * a mano si esa regla cambiara alguna vez.
 */
export const CATALOG_ABILITY_BASE_COOLDOWN_MIN = 1;

/** Espejo estructural de `UmbralFormula` (domain/combat/types/umbral.ts) — mismo
 *  vocabulario, misma justificación de "NO se modelan variantes de resta/división"
 *  (GDD §12: "Modificadores negativos — Capa futura"). Ver spec §0.2. */
export type CatalogUmbralFormula =
  | { readonly kind: 'VALUE' }
  | { readonly kind: 'ADD'; readonly amount: number }
  | { readonly kind: 'MULTIPLY'; readonly amount: number };

/** Espejo estructural de `AbilityUmbralDefinition` (domain/combat/types/umbral.ts). */
export interface CatalogUmbralDefinition {
  readonly baseFormula: CatalogUmbralFormula;
  readonly bonusFormula?: CatalogUmbralFormula;
}

/**
 * Espejo estructural de `AbilityEffectDefinition` (domain/combat/types/ability-effect.ts).
 * Cubre ÚNICAMENTE lo que `domain/combat` ya sabe ejecutar hoy (H1.6): ATTACK
 * (Enemigo→Líder) y PLOT (ambos lados, dirección derivada de quién es dueño). NO se
 * añade un kind 'SHIELD'/Defensa X — H1.6 tampoco lo modela todavía en el motor (ver
 * `LEADER_SHIELD_MAX`, comentario en `types/ability-effect.ts`: "no existe todavía
 * ninguna habilidad/carta 'Defensa X' que lo genere en runtime") — sería un contrato de
 * datos que el motor no puede ejecutar. Contenido con Defensa X queda fuera de alcance
 * hasta que una historia futura amplíe ambos lados (combat Y catalog) a la vez.
 */
export type CatalogAbilityEffect =
  | { readonly kind: 'ATTACK'; readonly formula: CatalogUmbralDefinition; readonly arrollar?: boolean }
  | { readonly kind: 'PLOT'; readonly amount: number };

/**
 * Habilidad de contenido, reutilizada tal cual por `LeaderDefinition.baseAbilities` y
 * `EnemyDefinition.abilities` (vía `EnemyAbilityDefinition`, que la extiende con
 * `aiProfile`). Deliberadamente SIN campo `side` — a diferencia de
 * `AbilityCooldownDefinition` (combat), aquí el lado es implícito por la colección en la
 * que vive (toda habilidad de `LeaderDefinition` es del Líder; toda habilidad de
 * `EnemyDefinition` es del Enemigo) — el futuro adaptador (fuera de alcance, ver §0.2) es
 * quien anota `side` al aplanar ambas listas en un único mapa para `CombatEngineConfig`.
 */
export interface AbilityDefinition {
  readonly id: AbilityId;
  readonly name: string;
  readonly coreCost: CoreCostRequirement;
  /** Entero >= `CATALOG_ABILITY_BASE_COOLDOWN_MIN` (GDD §2.5). */
  readonly baseCooldown: number;
  /** Ausente = sin efecto numérico modelado todavía (igual que una habilidad ausente de
   *  `CombatEngineConfig.abilityEffects` hoy — ver §0.2 nota sobre Líder/enemyHealth). */
  readonly effect?: CatalogAbilityEffect;
}
