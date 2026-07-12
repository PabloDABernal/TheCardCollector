import type { CombatBridge, CombatEvent } from '@collector/combat-bridge';
import type { CardInstanceId } from '@collector/domain-shared';
import type { BoardViewContext } from '../view';

/** H5.3 spec §1 — decide si UNA ocurrencia concreta de un evento de dominio debe tratarse como
 *  "momento grande" por haber cruzado un umbral relevante (Trama o vida), complementando la
 *  clasificación ESTÁTICA de `JuiceStep.isBigMoment` (ver §0 de la spec — el veredicto final es
 *  "grande si CUALQUIERA de las dos fuentes dice que sí"). */
export interface BigMomentClassifier {
  /** `true` si ESTA ocurrencia concreta del evento cruza un umbral relevante. Para tipos de evento
   *  sin lógica de umbral (fuera de `TRAMA_O_VIDA_EVENT_TYPES`), devuelve siempre `false`. */
  classify(event: CombatEvent): boolean;
}

/** H5.3 §1.1 — fracciones de vida RESTANTE (no de daño acumulado) cuyo cruce hacia abajo se
 *  considera un momento grande. Reutiliza el mismo umbral cualitativo `0.3` ya validado por H4
 *  ("vida baja", `CombatBoardOverlay.tsx` `LOW_HEALTH_RATIO`), generalizado a 2 escalones. */
export const LIFE_RATIO_THRESHOLDS: readonly number[] = [0.3, 0.1];

const TRAMA_O_VIDA_EVENT_TYPES: ReadonlySet<CombatEvent['type']> = new Set([
  'SCENARIO_PLOT_CHANGED',
  'LEADER_DAMAGED',
  'ENEMY_DAMAGED',
  'MINION_DAMAGED',
  'ALLY_DAMAGED',
]);

function crossedScenarioThreshold(before: number, after: number, threshold: number): boolean {
  return before < threshold && after >= threshold;
}

function crossedAnyLifeThreshold(before: number, after: number): boolean {
  return LIFE_RATIO_THRESHOLDS.some((t) => before > t && after <= t);
}

function minionMaxLife(instanceId: CardInstanceId, snapshot: ReturnType<CombatBridge['getSnapshot']>): number | null {
  const minion = snapshot.minionsInPlay.find((m) => m.instanceId === instanceId);
  return minion ? minion.maxLife : null;
}

function allyMaxLife(instanceId: CardInstanceId, snapshot: ReturnType<CombatBridge['getSnapshot']>): number | null {
  const ally = snapshot.alliesInPlay.find((a) => a.instanceId === instanceId);
  return ally ? ally.maxLife : null;
}

function classifyImpl(event: CombatEvent, ctx: BoardViewContext, snapshot: ReturnType<CombatBridge['getSnapshot']>): boolean {
  switch (event.type) {
    case 'SCENARIO_PLOT_CHANGED': {
      const before = event.scenarioPlotAfter - event.appliedDelta; // reconstruido, sin campo nuevo
      return crossedScenarioThreshold(before, event.scenarioPlotAfter, ctx.scenarioPlotDefeatThreshold);
    }
    case 'LEADER_DAMAGED': {
      const before = 1 - (event.leaderDamageAfter - event.appliedDamage) / ctx.leaderMaxHealth;
      const after = 1 - event.leaderDamageAfter / ctx.leaderMaxHealth;
      return crossedAnyLifeThreshold(before, after);
    }
    case 'ENEMY_DAMAGED': {
      const before = 1 - (event.enemyDamageAfter - event.rawAmount) / ctx.enemyMaxHealth;
      const after = 1 - event.enemyDamageAfter / ctx.enemyMaxHealth;
      return crossedAnyLifeThreshold(before, after);
    }
    case 'MINION_DAMAGED': {
      // `died === true` ya es semánticamente "muerte de Secuaz" — pero `MINION_DEFEATED` (evento
      // separado, emitido a continuación en el mismo dispatch) ya está en la lista ESTÁTICA de
      // grandes (JUICE_CONFIG) — no duplicar el criterio aquí. Solo se evalúa el ratio de vida
      // restante; si la entidad ya no está en mesa (caso borde de lectura tardía), se trata como
      // `false` sin lanzar.
      const maxLife = minionMaxLife(event.minionInstanceId, snapshot);
      if (maxLife === null || maxLife === 0) return false;
      return crossedAnyLifeThreshold(event.lifeBefore / maxLife, event.lifeAfter / maxLife);
    }
    case 'ALLY_DAMAGED': {
      const maxLife = allyMaxLife(event.allyInstanceId, snapshot);
      if (maxLife === null || maxLife === 0) return false;
      return crossedAnyLifeThreshold(event.allyLifeBefore / maxLife, event.allyLifeAfter / maxLife);
    }
    default:
      return false;
  }
}

/** Único punto de construcción — mismo patrón que `createEffectsDirector`/`createTargetingSignal`.
 *  Sin estado interno mutable más allá de las clausuras de `ctx`/`bridge` (cada evento reconstruye
 *  "antes"/"después" a partir de sus propios campos `...Before`/`...After`, así que no hace falta
 *  memorizar nada entre llamadas). */
export function createBigMomentClassifier(ctx: BoardViewContext, bridge: CombatBridge): BigMomentClassifier {
  return {
    classify(event: CombatEvent): boolean {
      if (!TRAMA_O_VIDA_EVENT_TYPES.has(event.type)) return false;
      return classifyImpl(event, ctx, bridge.getSnapshot());
    },
  };
}
