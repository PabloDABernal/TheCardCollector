// @vitest-environment node
//
// H2.6 spec §5.1 — mismo espíritu que `effects-director.test.ts` (H2.4): no se instancia un
// `Phaser.Game` real ni se depende de canvas/WebGL. Se instancia `new CombatScene()` directamente y se
// sobrescriben a mano las superficies mínimas de Phaser que `create()` toca, mismo patrón que
// `FakeJuiceScene` (H2.5) pero aplicado sobre la propia instancia bajo test.
//
// `CombatScene.ts` importa `phaser` en runtime (no solo como tipo, a diferencia del resto de
// `combat-scene`) porque extiende `Phaser.Scene` y referencia `Phaser.Scenes.Events.SHUTDOWN`. El propio
// paquete `phaser` ejecuta detección real de `Device`/`Canvas` al cargarse (necesita un `<canvas>` real con
// contexto 2D, no disponible bajo jsdom sin el paquete nativo `canvas`) — se mockea aquí con la superficie
// mínima que `CombatScene` consume, para cumplir el DoD de H2.6 ("sin instanciar Phaser/canvas real en
// ningún test unitario") sin añadir una dependencia nativa nueva al paquete.
vi.mock('phaser', () => {
  class FakeScene {
    constructor(public readonly key: string) {}
  }
  return {
    default: {
      Scene: FakeScene,
      Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    },
  };
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CombatBridge } from '@collector/combat-bridge';
import { CombatScene } from './scenes/CombatScene';

// H2.7 spec §4.1 — mockea `./input` (análogo a como este archivo ya mockea `phaser`) para verificar que
// `create()` invoca `createInputAdapter()` + `inputAdapter.attach(this)` y que su `unsubscribe` se registra
// en el mismo `SHUTDOWN` que el de `EffectsDirector`, sin ejercitar la máquina de estados real de
// `InputAdapter` (ya cubierta en `input/input-adapter.test.ts`).
const inputAdapterAttachMock = vi.fn(() => vi.fn());
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma calcada de createInputAdapter(config?)
const createInputAdapterMock = vi.fn((_config?: unknown) => ({
  attach: inputAdapterAttachMock,
  subscribe: vi.fn(() => vi.fn()),
}));
vi.mock('./input', () => ({
  createInputAdapter: (config?: unknown) => createInputAdapterMock(config),
}));

function createFakeCombatSceneSurface(scene: CombatScene) {
  const shutdownListeners: Array<() => void> = [];
  // Superficie fake mínima de Phaser (mismo patrón que FakeJuiceScene, H2.5), sin depender de un
  // Phaser.Game/canvas real.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (scene as any).cameras = { main: { setBackgroundColor: vi.fn() } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (scene as any).events = { once: (evt: string, cb: () => void) => evt === 'shutdown' && shutdownListeners.push(cb) };
  return { fireShutdown: () => shutdownListeners.forEach((cb) => cb()) };
}

describe('CombatScene — init/create/shutdown (H2.6)', () => {
  beforeEach(() => {
    inputAdapterAttachMock.mockClear();
    inputAdapterAttachMock.mockImplementation(() => vi.fn());
    createInputAdapterMock.mockClear();
  });

  it('init(data) guarda el CombatBridge inyectado sin dispatch ni side-effects', () => {
    const scene = new CombatScene();
    const bridge = { subscribeSceneEvents: vi.fn(() => () => {}) } as unknown as CombatBridge;
    scene.init({ bridge });
    expect(bridge.subscribeSceneEvents).not.toHaveBeenCalled(); // create() aún no corrió
  });

  it('init(data) sin bridge lanza de forma explícita', () => {
    const scene = new CombatScene();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- data inválida a propósito (falta bridge).
    expect(() => scene.init({} as any)).toThrow();
  });

  it('create() suscribe EffectsDirector al bridge inyectado exactamente una vez', () => {
    const scene = new CombatScene();
    createFakeCombatSceneSurface(scene);
    const unsubscribe = vi.fn();
    const bridge = { subscribeSceneEvents: vi.fn(() => unsubscribe) } as unknown as CombatBridge;
    scene.init({ bridge });
    scene.create();
    expect(bridge.subscribeSceneEvents).toHaveBeenCalledTimes(1);
  });

  it('shutdown de la escena invoca el unsubscribe de EffectsDirector.attach', () => {
    const scene = new CombatScene();
    const { fireShutdown } = createFakeCombatSceneSurface(scene);
    const unsubscribe = vi.fn();
    const bridge = { subscribeSceneEvents: vi.fn(() => unsubscribe) } as unknown as CombatBridge;
    scene.init({ bridge });
    scene.create();
    fireShutdown();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('create() instancia InputAdapter y lo conecta a la escena (H2.7 spec §4.1)', () => {
    const scene = new CombatScene();
    createFakeCombatSceneSurface(scene);
    const bridge = { subscribeSceneEvents: vi.fn(() => vi.fn()) } as unknown as CombatBridge;
    scene.init({ bridge });
    scene.create();

    expect(createInputAdapterMock).toHaveBeenCalledTimes(1);
    expect(inputAdapterAttachMock).toHaveBeenCalledTimes(1);
    expect(inputAdapterAttachMock).toHaveBeenCalledWith(scene);
  });

  it('shutdown invoca el unsubscribe de InputAdapter.attach junto al de EffectsDirector (H2.7 spec §4.1)', () => {
    const scene = new CombatScene();
    const { fireShutdown } = createFakeCombatSceneSurface(scene);
    const effectsUnsubscribe = vi.fn();
    const bridge = { subscribeSceneEvents: vi.fn(() => effectsUnsubscribe) } as unknown as CombatBridge;
    const inputUnsubscribe = vi.fn();
    inputAdapterAttachMock.mockReturnValueOnce(inputUnsubscribe);

    scene.init({ bridge });
    scene.create();
    fireShutdown();

    expect(effectsUnsubscribe).toHaveBeenCalledTimes(1);
    expect(inputUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('reconstrucción real: buildDefaultCombatBridge + CombatScene arrancan sin lanzar (sanity funcional)', async () => {
    const { buildDefaultCombatBridge } = await import('./build-default-combat-bridge');
    const bridge = await buildDefaultCombatBridge();
    const scene = new CombatScene();
    createFakeCombatSceneSurface(scene);
    scene.init({ bridge });
    expect(() => scene.create()).not.toThrow();
  });
});
