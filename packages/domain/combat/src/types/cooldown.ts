import type { AbilityId } from '@collector/domain-shared';
import type { CombatSide } from './turn';

/**
 * CD mínimo permitido para el CD BASE (de catálogo) de cualquier habilidad — GDD §2.5:
 * "Cada habilidad tiene un CD. CD mínimo = 1, nunca 0." Esto es una propiedad del dato
 * de catálogo (CD1/CD2/CD3/CD4...), NO del CD restante en runtime (que sí llega a 0,
 * ver AbilityCooldownSnapshot.remaining) — ver §0.3 de esta spec y la validación del
 * constructor en combat-engine.ts.
 */
export const ABILITY_BASE_COOLDOWN_MIN = 1;

/**
 * Dato de catálogo/definición de una habilidad relevante para cooldowns (GDD §2.5).
 * Igual que `abilityCoreCosts` en H1.3 (§0.2 de esa spec): `CatalogLoader` no existe
 * todavía (H1.8), así que se resuelve como mapa inyectado en
 * `CombatEngineConfig.abilityCooldowns` (§3).
 *
 * - `side`: el lado (LEADER o ENEMY) DUEÑO de esta habilidad. Una habilidad pertenece
 *   siempre a un único lado (nunca se comparte entre Líder y Enemigo) — determina en
 *   el turno de inicio de QUÉ lado se descuenta su CD en 1 (ver §0.2 de esta spec y
 *   `tickCooldownsForSide` en combat-engine.ts). Aliados/Secuaces (H1.15/H1.16, fuera
 *   de alcance) usarían el `side` de su dueño (LEADER o ENEMY), igual que ya hace
 *   `side` en `CombatCommand`/`ABILITY_ACTIVATED` (H1.3 §3.4) — no hace falta un
 *   tercer valor de `CombatSide`.
 * - `baseCooldown`: el "CD" de catálogo (CD1, CD2, CD3, CD4...). Entero >=
 *   `ABILITY_BASE_COOLDOWN_MIN` (GDD §2.5, §0.3 de esta spec) — el motor valida esto
 *   en el constructor y lanza `Error` si se viola.
 */
export interface AbilityCooldownDefinition {
  readonly side: CombatSide;
  readonly baseCooldown: number;
}

/** Snapshot de solo lectura del estado de CD de una habilidad — para UI futura y tests. */
export interface AbilityCooldownSnapshot {
  readonly abilityId: AbilityId;
  readonly side: CombatSide;
  readonly baseCooldown: number;
  /**
   * CD restante actual. `0` significa "lista para activar" (GDD §2.2 paso 4: "si CD = 0").
   * Nunca negativo — el descuento por vuelta satura en 0 (`Math.max(0, remaining - 1)`).
   * Distinto de `baseCooldown`, que nunca es 0 (ver `ABILITY_BASE_COOLDOWN_MIN`, §0.3).
   */
  readonly remaining: number;
}
