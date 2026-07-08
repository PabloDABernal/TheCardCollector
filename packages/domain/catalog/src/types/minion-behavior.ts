/**
 * NUEVO H1.16 (rediseño)/§3.9.4. Mirror estructural de `@collector/domain-combat`'s
 * `MinionSelectionCriterion` — catalog no puede importar combat (misma regla de
 * dirección de dependencia que `EnemyAbilityBranch`/`EnemyAbilityTier`, ver enemy.ts).
 *
 * `MinionDefinitionId` es `string` — igual que en `domain/combat` (no existe todavía un
 * tipo de catálogo propio de "Secuaz" con id branded; los Secuaces son datos de
 * Enemigo/Escenario, no una `CardDefinition`).
 */
export type MinionDefinitionId = string;

export type MinionSelectionCriterion =
  | { readonly kind: 'ALL' }
  | { readonly kind: 'RANDOM_ONE' }
  | { readonly kind: 'HIGHEST_PLANO_ATTACK' }
  | { readonly kind: 'HIGHEST_LIFE' }
  | { readonly kind: 'LOWEST_LIFE' }
  | { readonly kind: 'SPECIFIC_DEFINITION'; readonly minionDefinitionId: MinionDefinitionId };

export interface MinionBehaviorSpec {
  readonly criterion: MinionSelectionCriterion;
}
