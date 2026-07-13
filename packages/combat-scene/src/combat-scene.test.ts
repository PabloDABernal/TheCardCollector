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
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { BoardViewContext } from './view';
import { CombatScene } from './scenes/CombatScene';

// H2.7 spec §4.1 — mockea `./input` (análogo a como este archivo ya mockea `phaser`) para verificar que
// `create()` invoca `createInputAdapter()` + `inputAdapter.attach(this)` y que su `unsubscribe` se registra
// en el mismo `SHUTDOWN` que el de `EffectsDirector`, sin ejercitar la máquina de estados real de
// `InputAdapter` (ya cubierta en `input/input-adapter.test.ts`).
const inputAdapterAttachMock = vi.fn(() => vi.fn());
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma calcada de InputAdapter.subscribe(listener)
const inputAdapterSubscribeMock = vi.fn((_listener: (gesture: unknown) => void) => vi.fn());
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma calcada de createInputAdapter(config?)
const createInputAdapterMock = vi.fn((_config?: unknown) => ({
  attach: inputAdapterAttachMock,
  subscribe: inputAdapterSubscribeMock,
}));
vi.mock('./input', () => ({
  createInputAdapter: (config?: unknown) => createInputAdapterMock(config),
}));

// H2.8 spec §5.1 punto 6 — mockea `./view` (análogo al mock de `./input`) para verificar que `create()`
// construye `BoardView` y lo pinta contra el snapshot inicial, sin ejercitar el renderizado real de
// `view/*` (ya cubierto en `view/board-view.test.ts`).
const boardViewRenderMock = vi.fn();
const createBoardViewMock = vi.fn(() => ({ render: boardViewRenderMock }));
// NUEVO H4 spec §5.4 — `create()` también construye `createTargetingHighlightView(this,
// targetingSignal)`, mockeada aquí con la misma superficie mínima (`destroy()`) que
// `targeting-highlight-view.test.ts` (si existiera) ejercitaría en detalle.
const targetingHighlightDestroyMock = vi.fn();
const createTargetingHighlightViewMock = vi.fn(() => ({ destroy: targetingHighlightDestroyMock }));
// FIX QA (Bug 3) — `create()` también construye `createDieRejectionView(this, translator.rejectionSignal)`,
// mockeada aquí con la misma superficie mínima (`destroy()`) que `createTargetingHighlightViewMock`.
const dieRejectionDestroyMock = vi.fn();
const createDieRejectionViewMock = vi.fn(() => ({ destroy: dieRejectionDestroyMock }));
vi.mock('./view', () => ({
  createBoardView: (...args: unknown[]) => createBoardViewMock(...(args as [])),
  createTargetingHighlightView: (...args: unknown[]) => createTargetingHighlightViewMock(...(args as [])),
  createDieRejectionView: (...args: unknown[]) => createDieRejectionViewMock(...(args as [])),
}));

// H2.9 spec §4.1 (extendida H4 §5.2/§6.1) — mockea `./interaction` (análogo al mock de
// `./input`/`./view`) para verificar que `create()` construye el `GestureCommandTranslator` y lo
// suscribe a `inputAdapter.subscribe`, sin ejercitar la máquina de estados real (ya cubierta en
// `interaction/gesture-command-translator.test.ts`). El translator fake expone también
// `targetingSignal`/`handleCardTap`/`handleAbilityTap`/`cancelPending` (H4), consumidos por
// `CombatScene.getTargetingSignal()`/`getGestureCommandTranslator()`.
const translatorHandleGestureMock = vi.fn();
const translatorHandleCardTapMock = vi.fn();
const translatorHandleAbilityTapMock = vi.fn();
const translatorCancelPendingMock = vi.fn();
const fakeTargetingSignal = { getState: vi.fn(() => ({ kind: 'NONE' })), subscribe: vi.fn(() => vi.fn()) };
// FIX QA (Bug 3) — `translator.rejectionSignal`, mismo shape mínimo que `fakeTargetingSignal`
// (solo `subscribe` hace falta, `create()` nunca llama `getState()` sobre este canal).
const fakeRejectionSignal = { subscribe: vi.fn(() => vi.fn()) };
const createGestureCommandTranslatorMock = vi.fn(() => ({
  handleGesture: translatorHandleGestureMock,
  handleCardTap: translatorHandleCardTapMock,
  handleAbilityTap: translatorHandleAbilityTapMock,
  cancelPending: translatorCancelPendingMock,
  targetingSignal: fakeTargetingSignal,
  rejectionSignal: fakeRejectionSignal,
}));
// NUEVO H5.2/H5.5 — `create()` también construye `createTurnDecisionFlow({ bridge, cancelPending })`,
// mockeada aquí con la misma superficie mínima (`selectCategory`/`cancelDetail`/`signal`) que
// `interaction/turn-decision-flow.test.ts` ejercita en detalle — este archivo solo verifica el
// cableado (constructor invocado, getter expone el handle), no la máquina de estados real.
const turnDecisionFlowSelectCategoryMock = vi.fn();
const turnDecisionFlowCancelDetailMock = vi.fn();
const fakeTurnDecisionSignal = { getState: vi.fn(() => ({ stage: 'CATEGORY' })), subscribe: vi.fn(() => vi.fn()) };
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma calcada de createTurnDecisionFlow(deps)
const createTurnDecisionFlowMock = vi.fn((_deps: { bridge: unknown; cancelPending: () => void }) => ({
  selectCategory: turnDecisionFlowSelectCategoryMock,
  cancelDetail: turnDecisionFlowCancelDetailMock,
  signal: fakeTurnDecisionSignal,
}));
vi.mock('./interaction', () => ({
  createGestureCommandTranslator: (...args: unknown[]) => createGestureCommandTranslatorMock(...(args as [])),
  createTurnDecisionFlow: (...args: unknown[]) =>
    createTurnDecisionFlowMock(...(args as [{ bridge: unknown; cancelPending: () => void }])),
}));

function createFakeCombatSceneSurface(scene: CombatScene) {
  const shutdownListeners: Array<() => void> = [];
  const pointerdownListeners: Array<() => void> = [];
  // Superficie fake mínima de Phaser (mismo patrón que FakeJuiceScene, H2.5), sin depender de un
  // Phaser.Game/canvas real.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (scene as any).cameras = { main: { setBackgroundColor: vi.fn() } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (scene as any).events = { once: (evt: string, cb: () => void) => evt === 'shutdown' && shutdownListeners.push(cb) };
  // NUEVO H2.13 (spec §1.7) — `create()` registra `this.input.once('pointerdown', ...)` para
  // desbloquear el `SoundManager` en el primer gesto real.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (scene as any).input = {
    once: (evt: string, cb: () => void) => evt === 'pointerdown' && pointerdownListeners.push(cb),
  };
  return {
    fireShutdown: () => shutdownListeners.forEach((cb) => cb()),
    firePointerdown: () => pointerdownListeners.forEach((cb) => cb()),
  };
}

const fakeSnapshot = {} as CombatStateSnapshot;
const fakeBoardContext = {} as BoardViewContext;

function createFakeBridge(overrides: Partial<CombatBridge> = {}): CombatBridge {
  return {
    subscribeSceneEvents: vi.fn(() => vi.fn()),
    subscribeHudEvents: vi.fn(() => vi.fn()),
    getSnapshot: vi.fn(() => fakeSnapshot),
    ...overrides,
  } as unknown as CombatBridge;
}

describe('CombatScene — init/create/shutdown (H2.6/H2.8)', () => {
  beforeEach(() => {
    inputAdapterAttachMock.mockClear();
    inputAdapterAttachMock.mockImplementation(() => vi.fn());
    inputAdapterSubscribeMock.mockClear();
    inputAdapterSubscribeMock.mockImplementation(() => vi.fn());
    createInputAdapterMock.mockClear();
    createBoardViewMock.mockClear();
    createBoardViewMock.mockImplementation(() => ({ render: boardViewRenderMock }));
    boardViewRenderMock.mockClear();
    createGestureCommandTranslatorMock.mockClear();
    createGestureCommandTranslatorMock.mockImplementation(() => ({
      handleGesture: translatorHandleGestureMock,
      handleCardTap: translatorHandleCardTapMock,
      handleAbilityTap: translatorHandleAbilityTapMock,
      cancelPending: translatorCancelPendingMock,
      targetingSignal: fakeTargetingSignal,
      rejectionSignal: fakeRejectionSignal,
    }));
    translatorHandleGestureMock.mockClear();
    translatorHandleCardTapMock.mockClear();
    translatorHandleAbilityTapMock.mockClear();
    translatorCancelPendingMock.mockClear();
    createTargetingHighlightViewMock.mockClear();
    createTargetingHighlightViewMock.mockImplementation(() => ({ destroy: targetingHighlightDestroyMock }));
    targetingHighlightDestroyMock.mockClear();
    createDieRejectionViewMock.mockClear();
    createDieRejectionViewMock.mockImplementation(() => ({ destroy: dieRejectionDestroyMock }));
    dieRejectionDestroyMock.mockClear();
    createTurnDecisionFlowMock.mockClear();
    createTurnDecisionFlowMock.mockImplementation(() => ({
      selectCategory: turnDecisionFlowSelectCategoryMock,
      cancelDetail: turnDecisionFlowCancelDetailMock,
      signal: fakeTurnDecisionSignal,
    }));
    turnDecisionFlowSelectCategoryMock.mockClear();
    turnDecisionFlowCancelDetailMock.mockClear();
  });

  it('init(data) guarda el CombatBridge/boardContext inyectados sin dispatch ni side-effects', () => {
    const scene = new CombatScene();
    const bridge = createFakeBridge();
    scene.init({ bridge, boardContext: fakeBoardContext });
    expect(bridge.subscribeSceneEvents).not.toHaveBeenCalled(); // create() aún no corrió
  });

  it('init(data) sin bridge lanza de forma explícita', () => {
    const scene = new CombatScene();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- data inválida a propósito (falta bridge).
    expect(() => scene.init({ boardContext: fakeBoardContext } as any)).toThrow();
  });

  it('init(data) sin boardContext lanza de forma explícita (H2.8 spec §4.2)', () => {
    const scene = new CombatScene();
    const bridge = createFakeBridge();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- data inválida a propósito (falta boardContext).
    expect(() => scene.init({ bridge } as any)).toThrow();
  });

  it('create() suscribe EffectsDirector al bridge inyectado exactamente una vez', () => {
    const scene = new CombatScene();
    createFakeCombatSceneSurface(scene);
    const bridge = createFakeBridge();
    scene.init({ bridge, boardContext: fakeBoardContext });
    scene.create();
    expect(bridge.subscribeSceneEvents).toHaveBeenCalledTimes(1);
  });

  it('shutdown de la escena invoca el unsubscribe de EffectsDirector.attach', () => {
    const scene = new CombatScene();
    const { fireShutdown } = createFakeCombatSceneSurface(scene);
    const unsubscribe = vi.fn();
    const bridge = createFakeBridge({ subscribeSceneEvents: vi.fn(() => unsubscribe) });
    scene.init({ bridge, boardContext: fakeBoardContext });
    scene.create();
    fireShutdown();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('create() instancia InputAdapter y lo conecta a la escena (H2.7 spec §4.1)', () => {
    const scene = new CombatScene();
    createFakeCombatSceneSurface(scene);
    const bridge = createFakeBridge();
    scene.init({ bridge, boardContext: fakeBoardContext });
    scene.create();

    expect(createInputAdapterMock).toHaveBeenCalledTimes(1);
    expect(inputAdapterAttachMock).toHaveBeenCalledTimes(1);
    expect(inputAdapterAttachMock).toHaveBeenCalledWith(scene);
  });

  it('shutdown invoca el unsubscribe de InputAdapter.attach junto al de EffectsDirector (H2.7 spec §4.1)', () => {
    const scene = new CombatScene();
    const { fireShutdown } = createFakeCombatSceneSurface(scene);
    const effectsUnsubscribe = vi.fn();
    const bridge = createFakeBridge({ subscribeSceneEvents: vi.fn(() => effectsUnsubscribe) });
    const inputUnsubscribe = vi.fn();
    inputAdapterAttachMock.mockReturnValueOnce(inputUnsubscribe);

    scene.init({ bridge, boardContext: fakeBoardContext });
    scene.create();
    fireShutdown();

    expect(effectsUnsubscribe).toHaveBeenCalledTimes(1);
    expect(inputUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('create() construye BoardView, lo pinta contra el snapshot inicial y se suscribe a subscribeHudEvents exactamente una vez (H2.8 spec §4)', () => {
    const scene = new CombatScene();
    createFakeCombatSceneSurface(scene);
    const bridge = createFakeBridge();
    scene.init({ bridge, boardContext: fakeBoardContext });
    scene.create();

    expect(createBoardViewMock).toHaveBeenCalledTimes(1);
    expect(createBoardViewMock).toHaveBeenCalledWith(scene, fakeBoardContext);
    expect(boardViewRenderMock).toHaveBeenCalledTimes(1);
    expect(boardViewRenderMock).toHaveBeenCalledWith(fakeSnapshot);
    expect(bridge.subscribeHudEvents).toHaveBeenCalledTimes(1);
  });

  it('un evento de subscribeHudEvents dispara un nuevo boardView.render(bridge.getSnapshot())', () => {
    const scene = new CombatScene();
    createFakeCombatSceneSurface(scene);
    let hudListener: (() => void) | undefined;
    const bridge = createFakeBridge({
      subscribeHudEvents: vi.fn((listener: () => void) => {
        hudListener = listener;
        return vi.fn();
      }),
    });
    scene.init({ bridge, boardContext: fakeBoardContext });
    scene.create();
    boardViewRenderMock.mockClear();

    hudListener?.();

    expect(boardViewRenderMock).toHaveBeenCalledTimes(1);
    expect(boardViewRenderMock).toHaveBeenCalledWith(fakeSnapshot);
  });

  it('shutdown invoca el unsubscribe de subscribeHudEvents junto a los de EffectsDirector/InputAdapter (H2.8 spec §4)', () => {
    const scene = new CombatScene();
    const { fireShutdown } = createFakeCombatSceneSurface(scene);
    const hudUnsubscribe = vi.fn();
    const bridge = createFakeBridge({ subscribeHudEvents: vi.fn(() => hudUnsubscribe) });
    scene.init({ bridge, boardContext: fakeBoardContext });
    scene.create();
    fireShutdown();

    expect(hudUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('create() construye el GestureCommandTranslator (bridge, boardContext) y lo suscribe al InputAdapter (H2.9 spec §4.1)', () => {
    const scene = new CombatScene();
    createFakeCombatSceneSurface(scene);
    const bridge = createFakeBridge();
    scene.init({ bridge, boardContext: fakeBoardContext });
    scene.create();

    expect(createGestureCommandTranslatorMock).toHaveBeenCalledTimes(1);
    expect(createGestureCommandTranslatorMock).toHaveBeenCalledWith(bridge, fakeBoardContext);
    expect(inputAdapterSubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('un gesto emitido por InputAdapter.subscribe llega a translator.handleGesture (H2.9 spec §4.1)', () => {
    const scene = new CombatScene();
    createFakeCombatSceneSurface(scene);
    let gestureListener: ((gesture: unknown) => void) | undefined;
    inputAdapterSubscribeMock.mockImplementationOnce((listener: (gesture: unknown) => void) => {
      gestureListener = listener;
      return vi.fn();
    });
    const bridge = createFakeBridge();
    scene.init({ bridge, boardContext: fakeBoardContext });
    scene.create();

    const fakeGesture = { kind: 'TAP', targetId: null, point: { x: 0, y: 0 } };
    gestureListener?.(fakeGesture);

    expect(translatorHandleGestureMock).toHaveBeenCalledTimes(1);
    expect(translatorHandleGestureMock).toHaveBeenCalledWith(fakeGesture);
  });

  it('shutdown invoca el unsubscribe del translator junto a los de EffectsDirector/InputAdapter/BoardView (H2.9 spec §4.1)', () => {
    const scene = new CombatScene();
    const { fireShutdown } = createFakeCombatSceneSurface(scene);
    const translatorUnsubscribe = vi.fn();
    inputAdapterSubscribeMock.mockImplementationOnce(() => translatorUnsubscribe);
    const bridge = createFakeBridge();
    scene.init({ bridge, boardContext: fakeBoardContext });
    scene.create();
    fireShutdown();

    expect(translatorUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('shutdown invoca targetingHighlightView.destroy() (H4 spec §5.4)', () => {
    const scene = new CombatScene();
    const { fireShutdown } = createFakeCombatSceneSurface(scene);
    const bridge = createFakeBridge();
    scene.init({ bridge, boardContext: fakeBoardContext });
    scene.create();
    fireShutdown();

    expect(targetingHighlightDestroyMock).toHaveBeenCalledTimes(1);
  });

  // FIX QA (Bug 3) — mismo patrón que el test anterior, para `dieRejectionView.destroy()`.
  it('shutdown invoca dieRejectionView.destroy() y createDieRejectionView() recibe translator.rejectionSignal', () => {
    const scene = new CombatScene();
    const { fireShutdown } = createFakeCombatSceneSurface(scene);
    const bridge = createFakeBridge();
    scene.init({ bridge, boardContext: fakeBoardContext });
    scene.create();

    expect(createDieRejectionViewMock).toHaveBeenCalledTimes(1);
    expect(createDieRejectionViewMock).toHaveBeenCalledWith(scene, fakeRejectionSignal);

    fireShutdown();

    expect(dieRejectionDestroyMock).toHaveBeenCalledTimes(1);
  });

  it('getTargetingSignal()/getGestureCommandTranslator() exponen la superficie del translator tras create() (H4 spec §5.3/§6.1)', () => {
    const scene = new CombatScene();
    createFakeCombatSceneSurface(scene);
    const bridge = createFakeBridge();
    scene.init({ bridge, boardContext: fakeBoardContext });
    scene.create();

    expect(scene.getTargetingSignal()).toBe(fakeTargetingSignal);

    const handle = scene.getGestureCommandTranslator();
    handle.handleCardTap('card-1' as never);
    handle.handleAbilityTap('ability-1' as never);
    handle.cancelPending();
    expect(translatorHandleCardTapMock).toHaveBeenCalledWith('card-1');
    expect(translatorHandleAbilityTapMock).toHaveBeenCalledWith('ability-1');
    expect(translatorCancelPendingMock).toHaveBeenCalledTimes(1);
  });

  it('create() construye TurnDecisionFlow(bridge, cancelPending) y getTurnDecisionFlow() expone el handle (H5.2 §3/H5.5 §1)', () => {
    const scene = new CombatScene();
    createFakeCombatSceneSurface(scene);
    const bridge = createFakeBridge();
    scene.init({ bridge, boardContext: fakeBoardContext });
    scene.create();

    expect(createTurnDecisionFlowMock).toHaveBeenCalledTimes(1);
    expect(createTurnDecisionFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({ bridge, cancelPending: expect.any(Function) }),
    );

    const handle = scene.getTurnDecisionFlow();
    handle.selectCategory('GENERATE_ENERGY');
    handle.cancelDetail();
    expect(turnDecisionFlowSelectCategoryMock).toHaveBeenCalledWith('GENERATE_ENERGY');
    expect(turnDecisionFlowCancelDetailMock).toHaveBeenCalledTimes(1);

    createTurnDecisionFlowMock.mock.calls[0]?.[0]?.cancelPending();
    expect(translatorCancelPendingMock).toHaveBeenCalledTimes(1);
  });
});
