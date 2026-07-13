import type Phaser from 'phaser';
import type { CombatBridge, CombatEvent, Unsubscribe } from '@collector/combat-bridge';
import type { JuiceConfig } from './juice-config';
import type { JuiceRecipeRegistry, JuiceStep, JuiceTarget } from './juice-recipe';
import type { SoundManager } from '../audio/sound-manager';
import type { BigMomentClassifier } from './big-moment-classifier';

/** H5.3 §4 / H5.4 §1 — contrato de sesión de foco reentrante-segura, inyectado en
 *  `createEffectsDirector` como 5º parámetro. La implementación real (`createFocusController`) vive
 *  en `focus-controller.ts` (H5.4) — este archivo solo fija su lugar en la firma, mismo criterio que
 *  la spec autoriza para desarrollo en paralelo. */
export interface FocusController {
  begin(scene: Phaser.Scene, focusId: string | undefined): Promise<void>;
  end(scene: Phaser.Scene): Promise<void>;
}

/** H5.3 §2.2 — cota inferior de cuánto se sostiene un momento grande en foco, vision.md "~500-1000ms
 *  de resolución". El contenido real de los steps (floatingNumber+hitImpact+screenShake, etc.) puede
 *  superar este mínimo por sí solo, en cuyo caso no añade espera extra. */
export const MIN_BIG_MOMENT_HOLD_MS = 500;

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
    // NUEVO H5.4 §3 — el zoom de foco total (H5.3/H5.4) se dirige al dado gastado, no al `default`
    // sin foco de antes. `NucleoInstance.id` es el mismo `NucleoInstanceId` que `nucleo-table-view.ts`
    // usa como nombre del tile (H5.1 §4).
    case 'ABILITY_ACTIVATED':
      return { event, focusId: event.nucleoSpent.id };
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
    case 'TURN_ENDED':
      // NUEVO H4 spec §3.3 — sin focusId, el banner no ataca a un game object concreto, cubre
      // pantalla (hecho explícito por claridad de mantenimiento, mismo criterio que el resto del switch).
      return { event };
    default:
      // Resto de tipos (§4): sin receta mapeada en JUICE_CONFIG — resolveJuiceTarget solo se
      // invoca cuando steps.length > 0, así que este caso no debería alcanzarse en la práctica.
      return { event };
  }
}

/** H5.9 §1 — señal de lectura de si la cola de reproducción tiene trabajo pendiente/en curso.
 *  Expuesta para que `apps/shell` pueda esperar a que la "reproducción" de un turno completo del
 *  Enemigo termine antes de mostrar `TurnStartModal` (evita el "popup ciego"). Mismo patrón de
 *  pub/sub que `TargetingSignal`/`RejectionSignal`. */
export interface EffectsQueueSignal {
  isDraining(): boolean;
  subscribe(listener: (draining: boolean) => void): () => void;
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
   *  historia (YAGNI).
   *
   *  H5.9 §1 — MODIFICADO: en vez de disparar `resolveEvent` inmediatamente por cada evento entrante
   *  ("fire-and-forget"), encola y drena uno a uno en orden de llegada (FIFO) — necesario para que el
   *  turno completo del Enemigo (5-15+ eventos emitidos en la MISMA pila síncrona de `dispatch({type:
   *  'END_TURN'})`) se reproduzca en secuencia legible en vez de superpuesto. */
  attach(bridge: CombatBridge, scene: Phaser.Scene): Unsubscribe;
  /** NUEVO H5.9 §1. */
  readonly queueSignal: EffectsQueueSignal;
}

/** Recorre `steps` en orden, disparando cada `JuiceStep` según su `mode` (§3.2). NUEVO H2.13: si el
 *  step trae `soundId`, reenvía `soundManager.play(step.soundId)` de forma síncrona y no bloqueante
 *  en el instante en que el step arranca (antes de `recipe.play`) — no participa en `pending`, no
 *  altera la secuenciación `parallel`/`sequential` ya validada en H2.4/H2.5.
 *
 *  NUEVO H5.3 §2.2 — si `isBigMoment` es `true`, envuelve el recorrido de `steps` con
 *  `focusController.begin`/`end`, sosteniendo el foco un mínimo de `MIN_BIG_MOMENT_HOLD_MS` tras
 *  completar los steps. Este wrap es responsabilidad ÚNICA de `EffectsDirector` (no de cada entrada
 *  de `JUICE_CONFIG`) — garantiza que ningún evento grande futuro olvide el `end()` de cierre, que el
 *  sistema sea reentrante-seguro por construcción (delegado en `FocusController`), y que
 *  `JUICE_CONFIG` siga siendo una tabla puramente declarativa de QUÉ receta de CONTENIDO juega. */
async function resolveEvent(
  steps: readonly JuiceStep[],
  target: JuiceTarget,
  scene: Phaser.Scene,
  recipes: JuiceRecipeRegistry,
  soundManager: SoundManager,
  isBigMoment: boolean,
  focusController: FocusController,
): Promise<void> {
  const startedAt = isBigMoment ? Date.now() : 0;
  if (isBigMoment) {
    await focusController.begin(scene, target.focusId);
  }

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

  if (isBigMoment) {
    const elapsedMs = Date.now() - startedAt;
    const remainingHoldMs = Math.max(0, MIN_BIG_MOMENT_HOLD_MS - elapsedMs);
    if (remainingHoldMs > 0) {
      await new Promise<void>((resolve) => scene.time.delayedCall(remainingHoldMs, resolve));
    }
    await focusController.end(scene);
  }
}

/** Único punto de construcción — mismo patrón que `createCombatBridge` (H2.3): sin `new
 *  EffectsDirector(...)` expuesto, deja puerta abierta a validación/instrumentación futura sin
 *  romper la firma pública. */
export function createEffectsDirector(
  config: JuiceConfig,
  recipes: JuiceRecipeRegistry,
  soundManager: SoundManager, // NUEVO H2.13 — 3er parámetro obligatorio, mismo criterio que `recipes`
  bigMomentClassifier: BigMomentClassifier, // NUEVO H5.3 — 4º parámetro obligatorio
  focusController: FocusController, // NUEVO H5.3/H5.4 — 5º parámetro obligatorio
): EffectsDirector {
  // H5.9 §1 — cola de reproducción serializada: `attach()` deja de disparar `resolveEvent` de forma
  // "fire-and-forget" por cada evento; encola y drena uno a uno, en orden de llegada.
  const queue: JuiceTarget[] = [];
  let draining = false;
  const listeners = new Set<(draining: boolean) => void>();

  function setDraining(next: boolean): void {
    if (draining === next) return;
    draining = next;
    listeners.forEach((listener) => listener(draining));
  }

  async function drain(scene: Phaser.Scene): Promise<void> {
    setDraining(true);
    // FIX Reviewer post-E5 (bug real 1, bloqueante) — `setDraining(false)` vive en un `finally` que
    // envuelve TODO el `while`: si el `while` se corta por cualquier motivo (incluida una excepción no
    // capturada por el `try` interno de abajo, que no debería ocurrir pero no se confía ciegamente),
    // `draining` nunca queda atascado en `true` — condición necesaria para que `attach()` vuelva a
    // llamar `drain()` en el futuro y para que `queueSignal.isDraining()` no bloquee `TurnStartModal`
    // para siempre (ver `docs/specs/H5.9_fin_de_turno_automatico.md` §2).
    try {
      while (queue.length > 0) {
        const target = queue.shift()!;
        const steps = config[target.event.type] ?? [];
        const isBigMoment = steps.some((s) => s.isBigMoment === true) || bigMomentClassifier.classify(target.event);
        try {
          // await DENTRO del bucle es DELIBERADO — secuenciación estricta, ver H5.9 §1
          // (`no-await-in-loop` no está habilitada en este proyecto, sin necesidad de disable).
          await resolveEvent(steps, target, scene, recipes, soundManager, isBigMoment, focusController);
        } catch (error) {
          // FIX Reviewer post-E5 (bug real 1) — una receta rota (ej. `recipeId` inexistente, o una
          // excepción real dentro de `recipe.play`) NO debe bloquear el resto de la cola: el resto de
          // eventos ya encolados (potencialmente el turno completo del Enemigo, H5.9 §0.2) deben poder
          // seguir reproduciéndose. El error sigue siendo visible/no silencioso (§3.2 punto 4 de la
          // spec H5.9: "errores no capturados dentro de una receta deben propagarse como excepción no
          // manejada visible") — se reporta como `unhandledRejection` de forma asíncrona (mismo
          // criterio "fire-and-forget" que ya regía este canal antes de la cola serializada), sin
          // interrumpir el `while`.
          void Promise.reject(error);
        }
      }
    } finally {
      setDraining(false);
    }
  }

  return {
    attach(bridge: CombatBridge, scene: Phaser.Scene): Unsubscribe {
      return bridge.subscribeSceneEvents((event: CombatEvent) => {
        const steps = config[event.type] ?? [];
        if (steps.length === 0) {
          return; // sin receta — no entra en cola, mismo comportamiento que antes (se ignora)
        }

        queue.push(resolveJuiceTarget(event));
        if (!draining) {
          // Fire-and-forget respecto al bus de eventos de dominio (§3.2 punto 4) — errores no
          // capturados dentro de una receta deben propagarse como excepción no manejada visible.
          void drain(scene);
        }
        // si ya está drenando, el nuevo evento simplemente se procesa cuando le toque su turno en
        // la cola (orden FIFO) — reentrante-seguro por construcción.
      });
    },
    queueSignal: {
      isDraining: () => draining,
      subscribe(listener: (draining: boolean) => void): () => void {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  };
}
