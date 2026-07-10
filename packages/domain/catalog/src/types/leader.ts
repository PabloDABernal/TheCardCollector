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
 * {1,2,3,4} (uno de cada) y que la de CD1 sea `coreCost.kind === 'ANY'`. MODIFICADO
 * H4.x — ya NO se prohíbe `effect.kind === 'ATTACK'` en ninguna `baseAbility` (era una
 * limitación de motor, no una regla de diseño, ver spec
 * H4_targeting_habilidades_y_ficha_personaje.md §1.2.e); la única regla real de GDD
 * §2.5 ("CD1 siempre puro") es que, SI la habilidad de CD1 tiene `effect.kind ===
 * 'ATTACK'`, su `formula.baseFormula.kind` debe ser `'VALUE'` (sin +X/×X/Umbral).
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
  /**
   * NUEVO H1.18. Vida máxima del Líder (ver spec H1.18 §0.3) — mismo criterio de
   * validación que `EnemyDefinition.maxHealth` (entero > 0, <= 100, GDD §3.4). Alimenta
   * `CombatEngineConfig.leaderMaxHealth`, resuelto externamente, para la condición de
   * derrota (`leaderDamage >= maxHealth`).
   */
  readonly maxHealth: number;
  readonly universeSkin?: string;
}
