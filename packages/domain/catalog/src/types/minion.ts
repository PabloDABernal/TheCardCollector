import type { AbilityId } from '@collector/domain-shared';
import type { MinionDefinitionId } from './minion-behavior';

/**
 * NUEVO §3.10.4. Mirror estructural EXACTO de `domain/combat`'s `MinionDefinition`/
 * `MinionPassiveEffectDefinition` (`packages/domain/combat/src/types/minion.ts`) —
 * catalog no importa combat, mismo patrón que el resto de mirrors de este documento
 * (`EnemyAbilityBranch`, `MinionSelectionCriterion`). `catalog-adapter.ts` asigna
 * directamente (cast estructural, sin conversión de campos), mismo criterio ya usado
 * para `AbilityEffectDefinition`.
 */
export interface MinionPassiveEffectDefinition {
  readonly kind: 'ATTACK' | 'PLOT';
  readonly amount: number;
  readonly arrollar?: boolean;
}

export interface MinionDefinition {
  readonly id: MinionDefinitionId;
  readonly name: string;
  readonly passiveEffect: MinionPassiveEffectDefinition;
  readonly specialActionAbilityId?: AbilityId;
  readonly planoAttackAmount: number;
  readonly isDefensor: boolean;
  readonly maxLife: number;
}
