import type Phaser from 'phaser';
import type { Unsubscribe } from '@collector/combat-bridge';
import {
  DEFAULT_INPUT_ADAPTER_THRESHOLDS,
  type GestureTargetId,
  type InputAdapterThresholds,
  type PointCoords,
  type PointerGesture,
} from './pointer-gesture';

/** H2.7 — capa de clasificación de gestos genérica (spec §0.1: NO emite `PlayerIntent` de dominio, eso es
 *  H2.8/H2.9). Mismo espíritu de pub/sub desacoplado que `EffectsDirector` (H2.4): se construye sin escena
 *  (config pura), se conecta (`attach`) a una escena concreta cuando esta existe, y expone su propio canal
 *  de suscripción (`subscribe`) independiente de esa conexión. */
export interface InputAdapter {
  /** Registra los listeners de `Phaser.Input` (`pointerdown`/`pointermove`/`pointerup`/`pointerupoutside`)
   *  sobre `scene.input`. Llamar dos veces sobre la misma instancia registra dos veces los listeners — el
   *  caller (`CombatScene`) es responsable de no hacerlo por accidente, mismo criterio de "sin guardia
   *  interna contra doble-attach" que `EffectsDirector.attach` (H2.4, YAGNI). Retorna el `Unsubscribe` que
   *  remueve exactamente esos listeners de `scene.input` (no afecta a los listeners registrados vía
   *  `subscribe`). */
  attach(scene: Phaser.Scene): Unsubscribe;

  /** Se suscribe al stream de `PointerGesture` clasificados. Independiente de `attach` — puede llamarse
   *  antes o después de `attach()` sin cambiar el comportamiento (ambos internamente alimentan/leen la
   *  misma lista de listeners). Retorna el `Unsubscribe` que remueve solo este listener. */
  subscribe(listener: (gesture: PointerGesture) => void): Unsubscribe;
}

/** Superficie mínima de un `Phaser.Input.Pointer` que la máquina de estados necesita. */
interface MinimalPointer {
  readonly x: number;
  readonly y: number;
}

/** Superficie mínima de un game object interactivo (§2.1 de la spec): solo se lee `getData('targetId')`. */
interface MinimalHitTarget {
  getData(key: string): unknown;
}

type PointerHandler = (pointer: MinimalPointer) => void;

type GestureState = 'IDLE' | 'PENDING' | 'DRAGGING' | 'LONG_PRESS_FIRED';

function distance(a: PointCoords, b: PointCoords): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Único punto de construcción — mismo patrón que `createEffectsDirector`/`createCombatBridge`: sin `new
 *  InputAdapter(...)` expuesto, deja puerta abierta a validación/instrumentación futura sin romper la
 *  firma pública. */
export function createInputAdapter(config?: Partial<InputAdapterThresholds>): InputAdapter {
  const thresholds: InputAdapterThresholds = { ...DEFAULT_INPUT_ADAPTER_THRESHOLDS, ...config };
  const listeners = new Set<(gesture: PointerGesture) => void>();

  function emit(gesture: PointerGesture): void {
    listeners.forEach((listener) => listener(gesture));
  }

  return {
    attach(scene: Phaser.Scene): Unsubscribe {
      let state: GestureState = 'IDLE';
      let startPoint: PointCoords = { x: 0, y: 0 };
      let lastPoint: PointCoords = { x: 0, y: 0 };
      let targetId: GestureTargetId = null;
      let longPressTimer: { remove(): void } | null = null;

      function clearLongPressTimer(): void {
        if (longPressTimer) {
          longPressTimer.remove();
          longPressTimer = null;
        }
      }

      function resolveTargetId(pointer: MinimalPointer): GestureTargetId {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API nativa de Phaser (§2.1 de la spec).
        const hits = (scene.input as any).hitTestPointer(pointer) as MinimalHitTarget[] | undefined;
        if (!hits || hits.length === 0) {
          return null;
        }
        const data = hits[0]?.getData('targetId');
        return data === undefined ? null : (data as GestureTargetId);
      }

      function onPointerDown(pointer: MinimalPointer): void {
        if (state !== 'IDLE') {
          // Segundo pointerdown mientras hay un gesto en curso: ignorado por completo (spec §1.4, sin
          // soporte multi-touch simultáneo).
          return;
        }
        startPoint = { x: pointer.x, y: pointer.y };
        lastPoint = startPoint;
        targetId = resolveTargetId(pointer);
        state = 'PENDING';
        longPressTimer = scene.time.delayedCall(thresholds.longPressMs, () => {
          longPressTimer = null;
          if (state === 'PENDING') {
            state = 'LONG_PRESS_FIRED';
            emit({ kind: 'LONG_PRESS', targetId, point: startPoint });
          }
        });
      }

      function onPointerMove(pointer: MinimalPointer): void {
        const current: PointCoords = { x: pointer.x, y: pointer.y };

        if (state === 'PENDING') {
          const dist = distance(startPoint, current);
          if (dist > thresholds.dragThresholdPx) {
            clearLongPressTimer();
            state = 'DRAGGING';
            lastPoint = current;
            emit({ kind: 'DRAG_START', targetId, point: startPoint });
          } else if (dist > thresholds.longPressMoveTolerancePx) {
            clearLongPressTimer();
          }
          return;
        }

        if (state === 'DRAGGING') {
          const delta: PointCoords = { x: current.x - lastPoint.x, y: current.y - lastPoint.y };
          lastPoint = current;
          emit({ kind: 'DRAG_MOVE', targetId, point: current, delta });
          return;
        }

        // LONG_PRESS_FIRED (o IDLE, no debería ocurrir): sin transición (spec §1.2, YAGNI explícito).
      }

      function endGesture(pointer: MinimalPointer): void {
        const point: PointCoords = { x: pointer.x, y: pointer.y };

        if (state === 'PENDING') {
          clearLongPressTimer();
          emit({ kind: 'TAP', targetId, point });
        } else if (state === 'DRAGGING') {
          emit({ kind: 'DRAG_END', targetId, point });
        }
        // LONG_PRESS_FIRED: sin emisión adicional (el LONG_PRESS ya fue reportado).

        state = 'IDLE';
        targetId = null;
      }

      function onPointerUp(pointer: MinimalPointer): void {
        endGesture(pointer);
      }

      function onPointerUpOutside(pointer: MinimalPointer): void {
        endGesture(pointer);
      }

      const handlers: Array<[string, PointerHandler]> = [
        ['pointerdown', onPointerDown],
        ['pointermove', onPointerMove],
        ['pointerup', onPointerUp],
        ['pointerupoutside', onPointerUpOutside],
      ];

      for (const [event, handler] of handlers) {
        scene.input.on(event, handler);
      }

      return () => {
        for (const [event, handler] of handlers) {
          scene.input.off(event, handler);
        }
      };
    },

    subscribe(listener: (gesture: PointerGesture) => void): Unsubscribe {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
