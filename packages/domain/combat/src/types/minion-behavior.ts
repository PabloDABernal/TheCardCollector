import type { MinionDefinitionId } from './minion';

/**
 * NUEVO H1.16 (rediseño)/§3.9.4. Mirror estructural de
 * `@collector/domain-catalog`'s `MinionSelectionCriterion` — mismo patrón de
 * duplicación por dirección de dependencia que `EnemyAbilityBranch`/`EnemyAbilityTier`
 * entre `domain/catalog/types/enemy.ts` y `domain/combat/types/enemy-ai.ts` (`catalog`
 * nunca importa `combat`).
 *
 * GDD/decisions.md 2026-07-08: "el comportamiento está escrito en el TEXTO de la carta
 * de Dramaturgia". Vocabulario CERRADO de criterios ejecutables por el motor.
 */
export type MinionSelectionCriterion =
  | { readonly kind: 'ALL' } // "Tus secuaces atacan"
  | { readonly kind: 'RANDOM_ONE' } // azar EXPLÍCITO de contenido, no del motor por defecto
  | { readonly kind: 'HIGHEST_PLANO_ATTACK' } // "el más fuerte" (ataque plano más alto)
  | { readonly kind: 'HIGHEST_LIFE' } // §3.9.4 — "el secuaz con más vida ACTUAL"
  | { readonly kind: 'LOWEST_LIFE' } // §3.9.4 — "el secuaz con menos vida ACTUAL"
  | { readonly kind: 'SPECIFIC_DEFINITION'; readonly minionDefinitionId: MinionDefinitionId }; // "el Secuaz X actúa"

export interface MinionBehaviorSpec {
  readonly criterion: MinionSelectionCriterion;
}
