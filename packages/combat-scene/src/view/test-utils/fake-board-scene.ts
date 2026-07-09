import type Phaser from 'phaser';

/**
 * H2.8 spec §5.1 — superficie fake mínima de Phaser para `board-view.test.ts` (mismo espíritu que
 * `FakeJuiceScene`, H2.5, y `createFakeCombatSceneSurface`, H2.6/H2.7): sin canvas/WebGL real, solo la
 * porción de la API que `view/*` consume (`add.rectangle`, `add.text`, `children.getByName`).
 */
export interface FakeRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: number;
  alpha: number;
  scaleX: number;
  scaleY: number;
  name: string;
  readonly data: Map<string, unknown>;
  destroyed: boolean;
  setName(name: string): FakeRectangle;
  setPosition(x: number, y: number): FakeRectangle;
  setAlpha(alpha: number): FakeRectangle;
  setInteractive(): FakeRectangle;
  setData(key: string, value: unknown): FakeRectangle;
  getData(key: string): unknown;
  setOrigin(x: number, y?: number): FakeRectangle;
  setScale(x: number, y?: number): FakeRectangle;
  setFillStyle(color?: number, alpha?: number): FakeRectangle;
  setStrokeStyle(width?: number, color?: number): FakeRectangle;
  setMask(mask: unknown): FakeRectangle;
  setVisible(visible: boolean): FakeRectangle;
  destroy(): void;
}

/** FIX visual (rol/dado de Núcleo) — superficie mínima de `Phaser.GameObjects.Graphics` que
 *  `role-view.ts`/`nucleo-table-view.ts` consumen para dibujar sombra/borde/máscara redondeada
 *  decorativa. No-op puro (sin canvas real) — nada en estos tests verifica el trazo dibujado, solo
 *  que las vistas no revienten al llamarlo, mismo criterio que `add.particles()` arriba. */
export interface FakeGraphics {
  x: number;
  y: number;
  destroyed: boolean;
  fillStyle(color?: number, alpha?: number): FakeGraphics;
  lineStyle(width?: number, color?: number, alpha?: number): FakeGraphics;
  fillRoundedRect(x?: number, y?: number, width?: number, height?: number, radius?: number): FakeGraphics;
  strokeRoundedRect(x?: number, y?: number, width?: number, height?: number, radius?: number): FakeGraphics;
  clear(): FakeGraphics;
  setPosition(x: number, y: number): FakeGraphics;
  setVisible(visible: boolean): FakeGraphics;
  setDepth(depth: number): FakeGraphics;
  createGeometryMask(): unknown;
  destroy(): void;
}

/** H2.10 — superficie mínima de `scene.tweens.add` que `ability-cooldown-view.ts` consume
 *  (`scaleX` + `onUpdate`/`onComplete`). Se resuelve de forma SÍNCRONA (a diferencia de
 *  `FakeJuiceScene`, que ofrece `autoComplete`/microtask): no hace falta controlar temporización
 *  fina en estos tests, solo el estado final tras `update()`. */
export interface RecordedFakeTween {
  readonly config: Record<string, unknown>;
}

export interface FakeText {
  x: number;
  y: number;
  text: string;
  alpha: number;
  name: string;
  destroyed: boolean;
  setOrigin(x: number, y: number): FakeText;
  setPosition(x: number, y: number): FakeText;
  setText(value: string): FakeText;
  setAlpha(alpha: number): FakeText;
  setName(name: string): FakeText;
  destroy(): void;
}

export interface CreateFakeBoardSceneOptions {
  /** Por defecto `true` (comportamiento histórico, H2.10): cada `tweens.add` se resuelve de forma
   *  SÍNCRONA (aplica las propiedades finales sobre `targets`, invoca `onUpdate`/`onComplete` en el
   *  acto). Poner `false` (H2.12, `nucleo-pool-view.test.ts`) para tests que necesitan verificar el
   *  estado INTERMEDIO de una animación (p. ej. un sprite todavía vivo a mitad de un fade-out de
   *  300ms) y controlar manualmente cuándo completa cada tween vía `completeTween(index)`. */
  readonly autoComplete?: boolean;
}

export interface FakeBoardScene {
  readonly scene: Phaser.Scene;
  readonly rectangles: FakeRectangle[];
  readonly texts: FakeText[];
  readonly graphicsObjects: FakeGraphics[];
  readonly recordedTweens: RecordedFakeTween[];
  /** H2.12 — dispara manualmente el `onComplete` (y aplica las propiedades finales) de la tween en
   *  la posición `index` (orden de creación). No-op si `autoComplete` es `true` (ya se resolvió al
   *  crearla) o si el tween ya fue completado/matado. */
  completeTween(index: number): void;
}

function createFakeRectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor: number,
  registerByName: (name: string, rect: FakeRectangle) => void,
  initialAlpha = 1,
): FakeRectangle {
  const rect: FakeRectangle = {
    x,
    y,
    width,
    height,
    fillColor,
    alpha: initialAlpha,
    scaleX: 1,
    scaleY: 1,
    name: '',
    data: new Map<string, unknown>(),
    destroyed: false,
    setName(name: string) {
      rect.name = name;
      registerByName(name, rect);
      return rect;
    },
    setPosition(newX: number, newY: number) {
      rect.x = newX;
      rect.y = newY;
      return rect;
    },
    setAlpha(alpha: number) {
      rect.alpha = alpha;
      return rect;
    },
    setInteractive() {
      return rect;
    },
    setData(key: string, value: unknown) {
      rect.data.set(key, value);
      return rect;
    },
    getData(key: string) {
      return rect.data.get(key);
    },
    setOrigin() {
      return rect;
    },
    setScale(x: number, y?: number) {
      rect.scaleX = x;
      rect.scaleY = y ?? x;
      return rect;
    },
    setFillStyle(color?: number) {
      if (color !== undefined) {
        rect.fillColor = color;
      }
      return rect;
    },
    setStrokeStyle() {
      return rect;
    },
    setMask() {
      return rect;
    },
    setVisible() {
      return rect;
    },
    destroy() {
      rect.destroyed = true;
    },
  };
  return rect;
}

function createFakeGraphics(x: number, y: number): FakeGraphics {
  const graphics: FakeGraphics = {
    x,
    y,
    destroyed: false,
    fillStyle() {
      return graphics;
    },
    lineStyle() {
      return graphics;
    },
    fillRoundedRect() {
      return graphics;
    },
    strokeRoundedRect() {
      return graphics;
    },
    clear() {
      return graphics;
    },
    setPosition(newX: number, newY: number) {
      graphics.x = newX;
      graphics.y = newY;
      return graphics;
    },
    setVisible() {
      return graphics;
    },
    setDepth() {
      return graphics;
    },
    createGeometryMask() {
      return {};
    },
    destroy() {
      graphics.destroyed = true;
    },
  };
  return graphics;
}

function createFakeText(
  x: number,
  y: number,
  initialText: string,
  registerByName: (name: string, obj: FakeText) => void,
): FakeText {
  const text: FakeText = {
    x,
    y,
    text: initialText,
    alpha: 1,
    name: '',
    destroyed: false,
    setName(name: string) {
      text.name = name;
      registerByName(name, text);
      return text;
    },
    setOrigin() {
      return text;
    },
    setPosition(newX: number, newY: number) {
      text.x = newX;
      text.y = newY;
      return text;
    },
    setText(value: string) {
      text.text = value;
      return text;
    },
    setAlpha(alpha: number) {
      text.alpha = alpha;
      return text;
    },
    destroy() {
      text.destroyed = true;
    },
  };
  return text;
}

interface FakeTweenEntry {
  readonly targets: unknown[];
  readonly config: Record<string, unknown>;
  resolved: boolean;
}

export function createFakeBoardScene(options: CreateFakeBoardSceneOptions = {}): FakeBoardScene {
  const autoComplete = options.autoComplete ?? true;

  const rectangles: FakeRectangle[] = [];
  const texts: FakeText[] = [];
  const graphicsObjects: FakeGraphics[] = [];
  const recordedTweens: RecordedFakeTween[] = [];
  const tweenEntries: FakeTweenEntry[] = [];
  const byName = new Map<string, FakeRectangle | FakeText>();

  function registerByName(name: string, obj: FakeRectangle | FakeText): void {
    byName.set(name, obj);
  }

  function resolveTween(index: number): void {
    const entry = tweenEntries[index];
    if (!entry || entry.resolved) {
      return;
    }
    entry.resolved = true;

    const reservedKeys = new Set(['targets', 'duration', 'ease', 'onUpdate', 'onComplete']);
    const propKeys = Object.keys(entry.config).filter((key) => !reservedKeys.has(key));

    const onUpdate = entry.config['onUpdate'] as ((tween: { progress: number }) => void) | undefined;
    onUpdate?.({ progress: 1 });

    for (const target of entry.targets) {
      for (const key of propKeys) {
        (target as Record<string, unknown>)[key] = entry.config[key];
      }
    }

    const onComplete = entry.config['onComplete'] as (() => void) | undefined;
    onComplete?.();
  }

  const fakeScene = {
    add: {
      rectangle(x?: number, y?: number, width?: number, height?: number, fillColor?: number, alpha?: number): FakeRectangle {
        const rect = createFakeRectangle(
          x ?? 0,
          y ?? 0,
          width ?? 0,
          height ?? 0,
          fillColor ?? 0x000000,
          registerByName,
          alpha ?? 1,
        );
        rectangles.push(rect);
        return rect;
      },
      text(x?: number, y?: number, value?: string): FakeText {
        const text = createFakeText(x ?? 0, y ?? 0, value ?? '', registerByName);
        texts.push(text);
        return text;
      },
      graphics(config?: { x?: number; y?: number }): FakeGraphics {
        const graphicsObj = createFakeGraphics(config?.x ?? 0, config?.y ?? 0);
        graphicsObjects.push(graphicsObj);
        return graphicsObj;
      },
      // H2.12 — `add.particles`/`time.delayedCall`, mínimo necesario para `spawnDieParticleBurst`
      // (`nucleo-roll-animation.ts`) invocado desde `nucleo-pool-view.ts` en el caso "relanzado
      // completo". No se registra en ninguna colección expuesta: los tests de `nucleo-pool-view.ts`
      // verifican la tween de `angle`/`scale`, no el remate de partículas (ya cubierto por
      // `dice-roll.test.ts` vía `FakeJuiceScene`).
      particles() {
        return {
          explode() {
            /* no-op fake */
          },
          destroy() {
            /* no-op fake */
          },
        };
      },
    },
    // H2.10 — `tweens.add` fake. Por defecto (`autoComplete: true`) se resuelve SÍNCRONAMENTE:
    // aplica de inmediato las propiedades numéricas del `config` (p.ej. `scaleX`) sobre el/los
    // `targets`, invoca `onUpdate` una vez con `{ progress: 1 }` (mismo contrato que
    // `Phaser.Tweens.Tween`, solo el campo que `ability-cooldown-view.ts` consume) y finalmente
    // `onComplete`. H2.12: con `autoComplete: false`, la tween queda pendiente hasta que el test
    // llame `completeTween(index)` a mano — necesario para verificar el estado intermedio de una
    // animación (p. ej. un Núcleo gastado todavía vivo a mitad de su fade-out de 300ms).
    tweens: {
      add(config: Record<string, unknown>): unknown {
        const targets = Array.isArray(config['targets']) ? config['targets'] : [config['targets']];
        const index = tweenEntries.push({ targets, config, resolved: false }) - 1;
        recordedTweens.push({ config });

        if (autoComplete) {
          resolveTween(index);
        }

        return {};
      },
      // H2.12 — `killTweensOf(target)`: marca como resuelto (sin invocar `onComplete`, mismo
      // contrato que `Phaser.Tweens.TweenManager.killTweensOf`) cualquier tween pendiente cuyos
      // `targets` incluyan `target`. Usado por `nucleo-pool-view.ts` para no dejar un tween huérfano
      // corriendo sobre un sprite ya destruido (relanzado completo a mitad de un fade-out).
      killTweensOf(target: unknown): void {
        tweenEntries.forEach((entry) => {
          if (!entry.resolved && entry.targets.includes(target)) {
            entry.resolved = true;
          }
        });
      },
    },
    time: {
      delayedCall(_delayMs: number, callback: () => void): unknown {
        callback();
        return {};
      },
    },
    children: {
      getByName(name: string): FakeRectangle | FakeText | null {
        return byName.get(name) ?? null;
      },
    },
  };

  return {
    scene: fakeScene as unknown as Phaser.Scene,
    rectangles,
    texts,
    graphicsObjects,
    recordedTweens,
    completeTween: resolveTween,
  };
}
