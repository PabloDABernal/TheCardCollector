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
  destroyed: boolean;
  setOrigin(x: number, y: number): FakeText;
  setPosition(x: number, y: number): FakeText;
  setText(value: string): FakeText;
  setAlpha(alpha: number): FakeText;
  destroy(): void;
}

export interface FakeBoardScene {
  readonly scene: Phaser.Scene;
  readonly rectangles: FakeRectangle[];
  readonly texts: FakeText[];
  readonly recordedTweens: RecordedFakeTween[];
}

function createFakeRectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor: number,
  registerByName: (name: string, rect: FakeRectangle) => void,
): FakeRectangle {
  const rect: FakeRectangle = {
    x,
    y,
    width,
    height,
    fillColor,
    alpha: 1,
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
    destroy() {
      rect.destroyed = true;
    },
  };
  return rect;
}

function createFakeText(x: number, y: number, initialText: string): FakeText {
  const text: FakeText = {
    x,
    y,
    text: initialText,
    alpha: 1,
    destroyed: false,
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

export function createFakeBoardScene(): FakeBoardScene {
  const rectangles: FakeRectangle[] = [];
  const texts: FakeText[] = [];
  const recordedTweens: RecordedFakeTween[] = [];
  const byName = new Map<string, FakeRectangle>();

  function registerByName(name: string, rect: FakeRectangle): void {
    byName.set(name, rect);
  }

  const fakeScene = {
    add: {
      rectangle(x?: number, y?: number, width?: number, height?: number, fillColor?: number): FakeRectangle {
        const rect = createFakeRectangle(x ?? 0, y ?? 0, width ?? 0, height ?? 0, fillColor ?? 0x000000, registerByName);
        rectangles.push(rect);
        return rect;
      },
      text(x?: number, y?: number, value?: string): FakeText {
        const text = createFakeText(x ?? 0, y ?? 0, value ?? '');
        texts.push(text);
        return text;
      },
    },
    // H2.10 — `tweens.add` fake, resuelto SÍNCRONAMENTE: aplica de inmediato las propiedades
    // numéricas del `config` (p.ej. `scaleX`) sobre el/los `targets`, invoca `onUpdate` una vez con
    // `{ progress: 1 }` (mismo contrato que `Phaser.Tweens.Tween`, solo el campo que
    // `ability-cooldown-view.ts` consume) y finalmente `onComplete`. Simplificación deliberada frente
    // a `FakeJuiceScene` (que sí simula timing async): estos tests solo verifican el estado
    // final/la configuración solicitada, no la temporización del tween.
    tweens: {
      add(config: Record<string, unknown>): unknown {
        recordedTweens.push({ config });

        const reservedKeys = new Set(['targets', 'duration', 'ease', 'onUpdate', 'onComplete']);
        const targets = Array.isArray(config['targets']) ? config['targets'] : [config['targets']];
        const propKeys = Object.keys(config).filter((key) => !reservedKeys.has(key));

        const onUpdate = config['onUpdate'] as ((tween: { progress: number }) => void) | undefined;
        onUpdate?.({ progress: 1 });

        for (const target of targets) {
          for (const key of propKeys) {
            (target as Record<string, unknown>)[key] = config[key];
          }
        }

        const onComplete = config['onComplete'] as (() => void) | undefined;
        onComplete?.();

        return {};
      },
    },
    children: {
      getByName(name: string): FakeRectangle | null {
        return byName.get(name) ?? null;
      },
    },
  };

  return {
    scene: fakeScene as unknown as Phaser.Scene,
    rectangles,
    texts,
    recordedTweens,
  };
}
