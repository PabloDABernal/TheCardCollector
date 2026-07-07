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
  name: string;
  readonly data: Map<string, unknown>;
  destroyed: boolean;
  setName(name: string): FakeRectangle;
  setPosition(x: number, y: number): FakeRectangle;
  setAlpha(alpha: number): FakeRectangle;
  setInteractive(): FakeRectangle;
  setData(key: string, value: unknown): FakeRectangle;
  getData(key: string): unknown;
  destroy(): void;
}

export interface FakeText {
  x: number;
  y: number;
  text: string;
  destroyed: boolean;
  setOrigin(x: number, y: number): FakeText;
  setPosition(x: number, y: number): FakeText;
  setText(value: string): FakeText;
  destroy(): void;
}

export interface FakeBoardScene {
  readonly scene: Phaser.Scene;
  readonly rectangles: FakeRectangle[];
  readonly texts: FakeText[];
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
    destroy() {
      text.destroyed = true;
    },
  };
  return text;
}

export function createFakeBoardScene(): FakeBoardScene {
  const rectangles: FakeRectangle[] = [];
  const texts: FakeText[] = [];
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
  };
}
