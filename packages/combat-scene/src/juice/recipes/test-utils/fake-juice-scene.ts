import type Phaser from 'phaser';

/**
 * H2.5 spec §1.2 — `FakeJuiceScene`: implementa solo la superficie de la API de Phaser que las
 * recetas de `recipes/*.ts` consumen (`tweens.add`/`tweens.chain`/`tweens.timeScale`,
 * `add.rectangle`/`add.particles`, `cameras.main.shake`, `time.delayedCall`,
 * `children.getByName`), sin renderizar nada. Registra cada llamada con su configuración para que
 * los tests verifiquen lógica/configuración, no renderizado real (§1.3).
 */

export interface RecordedTween {
  readonly targets: unknown;
  readonly config: Record<string, unknown>;
}

export interface RecordedShake {
  readonly duration: number;
  readonly intensity: number;
}

export interface RecordedParticles {
  readonly x: number;
  readonly y: number;
  readonly textureKey: string;
  readonly config: Record<string, unknown>;
}

export interface RecordedDelayedCall {
  readonly delayMs: number;
  readonly callback: () => void;
}

export interface FakeJuiceRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: number;
  angle: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  readonly name: string;
  destroyed: boolean;
  setName(name: string): FakeJuiceRectangle;
  setFillStyle(color?: number, alpha?: number): FakeJuiceRectangle;
  destroy(): void;
}

export interface FakeParticleEmitter {
  explode(count?: number, x?: number, y?: number): void;
  destroy(): void;
}

export interface CreateFakeJuiceSceneOptions {
  /** Por defecto `true` (modo "auto-complete", §1.2): cada `tweens.add`/`tweens.chain`/
   *  `time.delayedCall` creado se resuelve en el siguiente microtask sin necesidad de llamar
   *  `completeTween`/`runDelayedCall` a mano. Poner `false` para tests que verifican
   *  orden/temporización exacta (`hitImpact`, `cardFlip`, `diceRoll`).
   *
   *  Nota: `cameras.main.shake` siempre se auto-resuelve en microtask, con independencia de esta
   *  opción — el contrato de §1.2 no define un `completeShake` manual (ninguna receta necesita
   *  controlar a mano cuándo "termina" un shake; el criterio de orden de `screenShake` en
   *  `index.test.ts` se verifica en que no se invoca *hasta* que el step anterior resuelve, no en
   *  controlar cuándo el propio shake resuelve). */
  readonly autoComplete?: boolean;
}

export interface FakeJuiceScene {
  readonly scene: Phaser.Scene;
  readonly recordedTweens: RecordedTween[];
  readonly recordedShakes: RecordedShake[];
  readonly recordedParticles: RecordedParticles[];
  readonly recordedDelayedCalls: RecordedDelayedCall[];
  /** Espía de cada asignación a `scene.tweens.timeScale` (hitStop embebido de `hitImpact`,
   *  spec §3.3 punto 4) — en orden cronológico de asignación. */
  readonly timeScaleAssignments: number[];
  /** Dispara manualmente el `onComplete` de la tween/chain en la posición `index` (orden de
   *  creación, `tweens.add` y `tweens.chain` comparten el mismo índice). Para un `tweens.chain`,
   *  ejecuta el `onComplete` de cada tramo en orden y finalmente el `onComplete` del chain
   *  completo — simula el mismo orden de eventos que produciría un `Phaser.Tweens.TweenChain`
   *  real. */
  completeTween(index: number): void;
  /** Ejecuta inmediatamente el callback registrado por `time.delayedCall` en la posición `index`. */
  runDelayedCall(index: number): void;
}

interface TweenLegConfig {
  readonly onComplete?: (...args: unknown[]) => void;
  readonly [key: string]: unknown;
}

interface TweenEntry {
  readonly isChain: boolean;
  readonly legs: readonly TweenLegConfig[];
  readonly onComplete: ((...args: unknown[]) => void) | undefined;
  resolved: boolean;
}

function createFakeRectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor: number,
  registerByName: (name: string, rect: FakeJuiceRectangle) => void,
): FakeJuiceRectangle {
  const rect: FakeJuiceRectangle = {
    x,
    y,
    width,
    height,
    fillColor,
    angle: 0,
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    name: '',
    destroyed: false,
    setName(name: string) {
      (rect as { name: string }).name = name;
      registerByName(name, rect);
      return rect;
    },
    setFillStyle(color?: number) {
      if (color !== undefined) {
        rect.fillColor = color;
      }
      return rect;
    },
    destroy() {
      rect.destroyed = true;
    },
  };
  return rect;
}

export function createFakeJuiceScene(options: CreateFakeJuiceSceneOptions = {}): FakeJuiceScene {
  const autoComplete = options.autoComplete ?? true;

  const recordedTweens: RecordedTween[] = [];
  const recordedShakes: RecordedShake[] = [];
  const recordedParticles: RecordedParticles[] = [];
  const recordedDelayedCalls: RecordedDelayedCall[] = [];
  const timeScaleAssignments: number[] = [];
  const tweenEntries: TweenEntry[] = [];
  const byName = new Map<string, FakeJuiceRectangle>();
  let currentTimeScale = 1;

  function registerByName(name: string, rect: FakeJuiceRectangle): void {
    byName.set(name, rect);
  }

  function completeTween(index: number): void {
    const entry = tweenEntries[index];
    if (!entry || entry.resolved) {
      return;
    }
    entry.resolved = true;
    for (const leg of entry.legs) {
      leg.onComplete?.();
    }
    entry.onComplete?.();
  }

  function runDelayedCall(index: number): void {
    const entry = recordedDelayedCalls[index];
    if (!entry) {
      return;
    }
    entry.callback();
  }

  function scheduleAutoCompleteTween(index: number): void {
    if (!autoComplete) {
      return;
    }
    void Promise.resolve().then(() => completeTween(index));
  }

  function scheduleAutoCompleteDelayedCall(callback: () => void): void {
    if (!autoComplete) {
      return;
    }
    void Promise.resolve().then(() => callback());
  }

  /** `cameras.main.shake` siempre se resuelve en el siguiente microtask, con independencia de
   *  `autoComplete` — ver nota en `CreateFakeJuiceSceneOptions.autoComplete`. */
  function scheduleShakeCompletion(callback: () => void): void {
    void Promise.resolve().then(() => callback());
  }

  function addTween(config: Record<string, unknown>): void {
    const index =
      recordedTweens.push({ targets: config['targets'], config }) - 1;
    tweenEntries[index] = {
      isChain: false,
      legs: [],
      onComplete: config['onComplete'] as ((...args: unknown[]) => void) | undefined,
      resolved: false,
    };
    scheduleAutoCompleteTween(index);
  }

  function chainTweens(config: Record<string, unknown>): void {
    const legs = (config['tweens'] as TweenLegConfig[] | undefined) ?? [];
    const index =
      recordedTweens.push({ targets: config['targets'], config }) - 1;
    tweenEntries[index] = {
      isChain: true,
      legs,
      onComplete: config['onComplete'] as ((...args: unknown[]) => void) | undefined,
      resolved: false,
    };
    scheduleAutoCompleteTween(index);
  }

  const fakeScene = {
    add: {
      rectangle(
        x?: number,
        y?: number,
        width?: number,
        height?: number,
        fillColor?: number,
      ): FakeJuiceRectangle {
        return createFakeRectangle(x ?? 0, y ?? 0, width ?? 0, height ?? 0, fillColor ?? 0x000000, registerByName);
      },
      particles(
        x?: number,
        y?: number,
        textureKey?: string,
        config?: Record<string, unknown>,
      ): FakeParticleEmitter {
        recordedParticles.push({ x: x ?? 0, y: y ?? 0, textureKey: textureKey ?? '', config: config ?? {} });
        return {
          explode() {
            /* no-op fake — la propia llamada ya quedó registrada en recordedParticles */
          },
          destroy() {
            /* no-op fake */
          },
        };
      },
    },
    tweens: {
      add(config: Record<string, unknown>) {
        addTween(config);
        return {} as unknown;
      },
      chain(config: Record<string, unknown>) {
        chainTweens(config);
        return {} as unknown;
      },
      get timeScale(): number {
        return currentTimeScale;
      },
      set timeScale(value: number) {
        currentTimeScale = value;
        timeScaleAssignments.push(value);
      },
    },
    cameras: {
      main: {
        shake(
          duration?: number,
          intensity?: number,
          _force?: boolean,
          callback?: (...args: unknown[]) => void,
        ) {
          recordedShakes.push({ duration: duration ?? 0, intensity: intensity ?? 0 });
          scheduleShakeCompletion(() => callback?.());
          return fakeScene as unknown;
        },
      },
    },
    time: {
      delayedCall(delayMs: number, callback: (...args: unknown[]) => void) {
        const wrapped = () => callback();
        recordedDelayedCalls.push({ delayMs, callback: wrapped });
        scheduleAutoCompleteDelayedCall(wrapped);
        return {} as unknown;
      },
    },
    children: {
      getByName(name: string): FakeJuiceRectangle | null {
        return byName.get(name) ?? null;
      },
    },
  };

  return {
    scene: fakeScene as unknown as Phaser.Scene,
    recordedTweens,
    recordedShakes,
    recordedParticles,
    recordedDelayedCalls,
    timeScaleAssignments,
    completeTween,
    runDelayedCall,
  };
}
