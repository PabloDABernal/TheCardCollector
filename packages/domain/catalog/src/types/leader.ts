import type { AbilityId, CardId, LeaderId } from '@collector/domain-shared';
import type { AbilityDefinition } from './ability';

/**
 * GDD §7.3/§4.3. `abilityId` referencia una de las `baseAbilities` DEL MISMO Líder
 * (validado en `validateCrossReferences`, §4.2) — nunca una habilidad de otro
 * Líder/Enemigo.
 */
export type LevelUpEffectSpec =
  | { readonly op: 'INCREASE_DAMAGE'; readonly abilityId: AbilityId; readonly amount: number }
  | { readonly op: 'DECREASE_COST'; readonly abilityId: AbilityId }
  | { readonly op: 'REMOVE_BACKLASH'; readonly abilityId: AbilityId };

export interface LevelUpOption {
  readonly id: string;
  readonly description: string;
  readonly effect: LevelUpEffectSpec;
}

/**
 * GDD §3.1/§4.1. `baseAbilities` es una tupla de EXACTAMENTE 4 (plantilla CD1/2/3/4,
 * GDD §3.1) — se tipa como tupla para que el propio compilador exija longitud 4; el
 * `parseLeaderDefinition` (§3.3) valida además que sus `baseCooldown` sean exactamente
 * {1,2,3,4} (uno de cada) y que la de CD1 sea `coreCost.kind === 'ANY'` y sin
 * `effect.kind === 'ATTACK'` (GDD §2.5: "CD1 siempre ⚫, y siempre puro"; ver spec §3.3
 * para la justificación completa de por qué también se prohíbe ATTACK en las otras 3).
 */
export interface LeaderDefinition {
  readonly id: LeaderId;
  readonly name: string;
  readonly baseAbilities: readonly [AbilityDefinition, AbilityDefinition, AbilityDefinition, AbilityDefinition];
  /** GDD §3.1: "Pool de 10 cartas propias". La cardinalidad exacta (10) NO se valida en
   *  el esquema de `CatalogLoader` — es una guía de autoría de contenido (H1.9), no una
   *  invariante estructural; el loader solo exige que cada id resuelva contra `cards`
   *  (§4.1). */
  readonly cardPoolIds: readonly CardId[];
  readonly levelUpOptions: readonly LevelUpOption[];
  readonly universeSkin?: string;
}
