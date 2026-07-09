import type Phaser from 'phaser';
import type { CombatBridge, CombatEvent, Unsubscribe } from '@collector/combat-bridge';
import type { JuiceConfig } from './juice-config';
import type { JuiceRecipeRegistry, JuiceStep, JuiceTarget } from './juice-recipe';
import type { SoundManager } from '../audio/sound-manager';

/** H2.4 spec §3.3 — nombres estables que H2.8 debe usar para nombrar los game objects del
 *  tablero/Líder/Enemigo/Escenario, de modo que las recetas reales de H2.5 puedan resolverlos sin
 *  re-inventar convención. */
export const FOCUS_ID_LEADER = 'leader';
export const FOCUS_ID_ENEMY = 'enemy';
export const FOCUS_ID_SCENARIO = 'scenario';

/** H2.4 spec §3.3 — calcula el `focusId` (si aplica) a partir de la forma concreta de cada
 *  variante de `CombatEvent`. Función pura, solo usada internamente por `resolveEvent`. */
function resolveJuiceTarget(event: CombatEvent): JuiceTarget {
  switch (event.type) {
    case 'LEADER_DAMAGED':
      return { event, focusId: FOCUS_ID_LEADER };
    case 'ENEMY_DAMAGED':
      return { event, focusId: FOCUS_ID_ENEMY };
    case 'ALLY_DAMAGED':
      return { event, focusId: event.allyInstanceId };
    case 'SCENARIO_PLOT_CHANGED':
      return { event, focusId: FOCUS_ID_SCENARIO };
    case 'CARD_PLAYED':
      return { event, focusId: event.sourceId };
    case 'CONTRATIEMPO_PLAYED':
      return { event, focusId: event.sourceId };
    case 'ALLY_ENTERED_PLAY':
      return { event, focusId: event.allyInstanceId };
    case 'MINION_SUMMONED':
      return { event, focusId: event.instanceId };
    case 'MINION_DAMAGED':
      return { event, focusId: event.minionInstanceId };
    case 'MINION_DEFEATED':
      return { event, focusId: event.instanceId };
    case 'PHASE_CHANGED':
      return { event, focusId: event.source === 'ENEMY' ? FOCUS_ID_ENEMY : FOCUS_ID_SCENARIO };
    case 'NUCLEO_TABLE_REROLLED':
    case 'DRAMATURGIA_CARD_DRAWN':
      return { event };
    default:
      // Resto de tipos (§4): sin receta mapeada en JUICE_CONFIG — resolveJuiceTarget solo se
      // invoca cuando steps.length > 0, así que este caso no debería alcanzarse en la práctica.
      return { event };
  }
}

/**
 * H2.4 spec §3.1 — puente entre el stream de `CombatEvent` de `subscribeSceneEvents` y las
 * recetas de juice declaradas en `JuiceConfig`.
 */
export interface EffectsDirector {
  /** Se suscribe a `bridge.subscribeSceneEvents` y resuelve cada evento contra `JuiceConfig`
   *  (inyectado en la construcción, ver `createEffectsDirector`). Retorna el `Unsubscribe` de esa
   *  suscripción (H2.6 lo invoca en el `shutdown`/`destroy` de `CombatScene`). Llamar `attach` dos
   *  veces sobre la misma instancia crea dos suscripciones independientes — el caller (H2.6) es
   *  responsable de no hacerlo por accidente; no hay guardia interna contra doble-attach en esta
   *  historia (YAGNI). */
  attach(bridge: CombatBridge, scene: Phaser.Scene): Unsubscribe;
}

/** Recorre `steps` en orden, disparando cada `JuiceStep` según su `mode` (§3.2). NUEVO H2.13: si el
 *  step trae `soundId`, reenvía `soundManager.play(step.soundId)` de forma síncrona y no bloqueante
 *  en el instante en que el step arranca (antes de `recipe.play`) — no participa en `pending`, no
 *  altera la secuenciación `parallel`/`sequential` ya validada en H2.4/H2.5. */
async function resolveEvent(
  steps: readonly JuiceStep[],
  target: JuiceTarget,
  scene: Phaser.Scene,
  recipes: JuiceRecipeRegistry,
  soundManager: SoundManager,
): Promise<void> {
  let pending: Promise<void>[] = [];

  for (const step of steps) {
    const recipe = recipes[step.recipeId];
    if (!recipe) {
      throw new Error(
        `EffectsDirector: recipeId "${step.recipeId}" no existe en el JuiceRecipeRegistry inyectado (evento "${target.event.type}").`,
      );
    }

    if (step.soundId) {
      soundManager.play(step.soundId); // NUEVO H2.13 — síncrono, no bloqueante, no participa en `pending`
    }

    if (step.mode === 'parallel') {
      pending.push(recipe.play(scene, target, step.params ?? {}));
    } else {
      await Promise.all(pending);
      pending = [];
      await recipe.play(scene, target, step.params ?? {});
    }
  }

  await Promise.all(pending);
}

/** Único punto de construcción — mismo patrón que `createCombatBridge` (H2.3): sin `new
 *  EffectsDirector(...)` expuesto, deja puerta abierta a validación/instrumentación futura sin
 *  romper la firma pública. */
export function createEffectsDirector(
  config: JuiceConfig,
  recipes: JuiceRecipeRegistry,
  soundManager: SoundManager, // NUEVO H2.13 — 3er parámetro obligatorio, mismo criterio que `recipes`
): EffectsDirector {
  return {
    attach(bridge: CombatBridge, scene: Phaser.Scene): Unsubscribe {
      return bridge.subscribeSceneEvents((event: CombatEvent) => {
        const steps = config[event.type] ?? [];
        if (steps.length === 0) {
          return;
        }

        const target = resolveJuiceTarget(event);
        // Fire-and-forget respecto al bus de eventos de dominio (§3.2 punto 4) — errores no
        // capturados dentro de una receta deben propagarse como excepción no manejada visible.
        void resolveEvent(steps, target, scene, recipes, soundManager);
      });
    },
  };
}
