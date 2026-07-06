import type { AbilityId, CardInstanceId } from '@collector/domain-shared';

/** GDD §2.7: "Alcance según la carta: algunas revierten solo el daño [DAMAGE_ONLY],
 *  otras la carta de Dramaturgia entera [FULL_TURN]". */
export type ContratiempoUndoScope = 'DAMAGE_ONLY' | 'FULL_TURN';

/**
 * Dato de una carta CONTRATIEMPO relevante para el motor. Resuelto externamente e
 * inyectado en `CombatEngineConfig.contratiempoCards` — mismo patrón "CatalogLoader no
 * está conectado todavía al motor" que `abilityCoreCosts`/`abilityCooldowns`/
 * `abilityEffects` (H1.3/H1.4/H1.6). `energyCost` espeja `CardDefinition.cost.energy`
 * (catalog) — combat no importa el tipo de catalog, igual que `AbilityDefinition`
 * (catalog) espeja `AbilityCooldownDefinition`/`AbilityEffectDefinition` (combat) sin
 * import cruzado (ver `packages/domain/catalog/src/types/ability.ts`).
 */
export interface ContratiempoCardDefinition {
  readonly energyCost: number;
  readonly undoScope: ContratiempoUndoScope;
}

/**
 * Una entrada por cada `ACTIVATE_ABILITY` exitosa de `side: 'ENEMY'` ocurrida durante
 * SU turno más reciente. Suficiente para invertir selectivamente (DAMAGE_ONLY) o por
 * completo (FULL_TURN) sin snapshotear ni recomputar el resto del estado del motor —
 * ver spec §0.4. Los valores "antes"/"después" ya los calculan `applyAttackEffect`/
 * `applyPlotEffect` (H1.6); esta historia solo los captura en vez de descartarlos.
 */
export interface UndoableEnemyActionLogEntry {
  readonly abilityId: AbilityId;
  readonly sourceId: string;
  /** CD restante de `abilityId` INMEDIATAMENTE ANTES de esta activación — se restaura
   *  solo en alcance FULL_TURN (revertir el CD "como si el Enemigo nunca hubiera actuado"). */
  readonly cooldownBefore: number;
  readonly effect?:
    | {
        readonly kind: 'ATTACK';
        readonly target: 'LEADER';
        readonly leaderDamageBefore: number;
        readonly leaderDamageAfter: number;
        readonly leaderShieldBefore: number;
        readonly leaderShieldAfter: number;
      }
    | {
        /** NUEVO H1.15 — ver spec H1.15 §0.7. */
        readonly kind: 'ATTACK';
        readonly target: 'ALLY';
        readonly allyInstanceId: CardInstanceId;
        readonly allyLifeBefore: number;
        readonly allyLifeAfter: number;
        /** Daño que además cayó sobre el Líder por derrame de Arrollar (0 si no hubo). */
        readonly leaderDamageBefore: number;
        readonly leaderDamageAfter: number;
      }
    | {
        readonly kind: 'PLOT';
        readonly scenarioPlotBefore: number;
        readonly scenarioPlotAfter: number;
      };
}
