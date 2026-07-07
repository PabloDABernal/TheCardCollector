import type Phaser from 'phaser';

/**
 * H2.7 spec §4 — `FakePointerScene`: implementa solo la superficie de `Phaser.Input`/`Phaser.Time` que
 * `InputAdapter` consume (`scene.input.on`/`scene.input.off`/`scene.input.hitTestPointer`,
 * `scene.time.delayedCall`), sin canvas/WebGL ni `Phaser.Game` real — mismo espíritu que
 * `FakeJuiceScene` (H2.5).
 */

interface FakeHitTarget {
  getData(key: string): unknown;
}

type Handler = (...args: unknown[]) => void;

interface PendingTimer {
  remainingMs: number;
  callback: () => void;
  removed: boolean;
}

export interface FakePointerScene {
  /** Superficie fake inyectable a `InputAdapter.attach(...)`. */
  readonly scene: Phaser.Scene;
  /** Configura qué devuelve `hitTestPointer(pointer)` en la siguiente llamada (y en las posteriores,
   *  hasta que se vuelva a llamar `setHitTestResult`) — simula "hay un game object fake con targetId X
   *  debajo del puntero" o "no hay nada" (array vacío). */
  setHitTestResult(objects: FakeHitTarget[]): void;
  firePointerDown(x: number, y: number): void;
  firePointerMove(x: number, y: number): void;
  firePointerUp(x: number, y: number): void;
  firePointerUpOutside(x: number, y: number): void;
  /** Avanza el reloj fake, disparando cualquier `time.delayedCall` cuyo delay acumulado ya se cumplió
   *  (para simular el temporizador de long-press determinísticamente, sin esperar 500ms reales). */
  advanceTime(ms: number): void;
}

export function createFakePointerScene(): FakePointerScene {
  const handlersByEvent = new Map<string, Set<Handler>>();
  let hitTestResult: FakeHitTarget[] = [];
  const pendingTimers: PendingTimer[] = [];

  function on(event: string, handler: Handler): void {
    let set = handlersByEvent.get(event);
    if (!set) {
      set = new Set();
      handlersByEvent.set(event, set);
    }
    set.add(handler);
  }

  function off(event: string, handler: Handler): void {
    handlersByEvent.get(event)?.delete(handler);
  }

  function fire(event: string, x: number, y: number): void {
    const set = handlersByEvent.get(event);
    if (!set) {
      return;
    }
    const pointer = { x, y };
    // Copia defensiva: un handler podría desuscribirse (off) durante la propia emisión.
    [...set].forEach((handler) => handler(pointer));
  }

  const fakeScene = {
    input: {
      on,
      off,
      hitTestPointer(): FakeHitTarget[] {
        return hitTestResult;
      },
    },
    time: {
      delayedCall(delayMs: number, callback: () => void): { remove(): void } {
        const timer: PendingTimer = { remainingMs: delayMs, callback, removed: false };
        pendingTimers.push(timer);
        return {
          remove(): void {
            timer.removed = true;
          },
        };
      },
    },
  };

  return {
    scene: fakeScene as unknown as Phaser.Scene,
    setHitTestResult(objects: FakeHitTarget[]): void {
      hitTestResult = objects;
    },
    firePointerDown(x: number, y: number): void {
      fire('pointerdown', x, y);
    },
    firePointerMove(x: number, y: number): void {
      fire('pointermove', x, y);
    },
    firePointerUp(x: number, y: number): void {
      fire('pointerup', x, y);
    },
    firePointerUpOutside(x: number, y: number): void {
      fire('pointerupoutside', x, y);
    },
    advanceTime(ms: number): void {
      // Copia defensiva: disparar un timer puede encolar uno nuevo (no aplica hoy, pero mismo criterio de
      // robustez que `FakeJuiceScene.completeTween`).
      for (const timer of [...pendingTimers]) {
        if (timer.removed) {
          continue;
        }
        timer.remainingMs -= ms;
        if (timer.remainingMs <= 0) {
          timer.removed = true;
          timer.callback();
        }
      }
    },
  };
}
