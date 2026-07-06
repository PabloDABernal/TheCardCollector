import type { CardId, CardInstanceId, AbilityId } from '@collector/domain-shared';

/**
 * Dato de una carta ALIADO relevante para el motor. Resuelto externamente e inyectado en
 * `CombatEngineConfig.allyCards` — mismo patrón que `contratiempoCards` (H1.14):
 * `energyCost` espeja `CardDefinition.cost.energy`; `life` espeja la keyword `VIDA_X`
 * (catalog, ver spec H1.15 §0.5 — el motor no la calcula, solo la consume);
 * `isBerserker` espeja la presencia de la keyword `BERSERKER` (ya existente).
 * `abilityIds`, si se define, son las habilidades propias del Aliado que deben re-
 * arrancar en Calentamiento (CD = baseCooldown) al entrar en mesa (GDD §2.5) — deben
 * existir ya en `CombatEngineConfig.abilityCooldowns` con `side: 'LEADER'` (validado en
 * el constructor, mismo estilo que `validateAbilityComboConfig`).
 */
export interface AllyCardDefinition {
  readonly energyCost: number;
  readonly life: number;
  readonly isBerserker: boolean;
  readonly abilityIds?: readonly AbilityId[];
}

/**
 * Instancia concreta de un Aliado en mesa. Identificada por `CardInstanceId` (H1.1,
 * primer uso real — "copia concreta de una carta en juego"). Nunca se elimina de
 * `CombatEngine.alliesInPlay` al morir — `life` queda en 0 (ver spec H1.15 §0.6); toda
 * lectura de "vivos" filtra explícitamente por `life > 0`.
 */
export interface AllyInPlay {
  readonly instanceId: CardInstanceId;
  readonly cardId: CardId;
  readonly isBerserker: boolean;
  readonly maxLife: number;
  readonly life: number;
}
