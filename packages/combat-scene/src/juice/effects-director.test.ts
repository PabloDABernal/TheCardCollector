// @vitest-environment node
//
// H2.4 spec §6 — test de aislamiento: mockea `CombatBridge.subscribeSceneEvents` a mano (no el
// `createCombatBridge` real, no hace falta un `CombatEngine`) y verifica que `EffectsDirector`
// resuelve `evento→receta` según `JUICE_CONFIG`, sin instanciar `Phaser.Scene` de verdad.
import { describe, it, expect, vi } from 'vitest';
import type { CombatBridge, CombatEvent } from '@collector/combat-bridge';
import { createId } from '@collector/domain-shared';
import type { CardId, CardInstanceId, NucleoInstanceId } from '@collector/domain-shared';
import type Phaser from 'phaser';
import { createEffectsDirector, MIN_BIG_MOMENT_HOLD_MS } from './effects-director';
import { JUICE_CONFIG } from './juice-config';
import type { JuiceConfig } from './juice-config';
import type { JuiceRecipe, JuiceRecipeRegistry } from './juice-recipe';
import type { SoundManager } from '../audio/sound-manager';
import { createFakeJuiceScene } from './recipes/test-utils/fake-juice-scene';

function createMockSceneBridge() {
  const listeners: Array<(e: CombatEvent) => void> = [];
  return {
    bridge: {
      subscribeSceneEvents: (listener: (e: CombatEvent) => void) => {
        listeners.push(listener);
        return () => {
          /* no-op para este test, no se ejercita unsubscribe */
        };
      },
    } as unknown as CombatBridge,
    emit: (event: CombatEvent) => listeners.forEach((l) => l(event)),
  };
}

interface TestRegistry {
  diceRoll: JuiceRecipe;
  cardFlip: JuiceRecipe;
  hitImpact: JuiceRecipe;
  screenShake: JuiceRecipe;
  floatingNumber: JuiceRecipe;
  soundOnly: JuiceRecipe;
  turnBanner: JuiceRecipe;
}

function createTestRegistry(): { registry: TestRegistry; callOrder: string[] } {
  const callOrder: string[] = [];

  function fnRecipe(id: string): JuiceRecipe {
    return {
      id,
      play: vi.fn(async () => {
        callOrder.push(id);
      }),
    };
  }

  return {
    registry: {
      diceRoll: fnRecipe('diceRoll'),
      cardFlip: fnRecipe('cardFlip'),
      hitImpact: fnRecipe('hitImpact'),
      screenShake: fnRecipe('screenShake'),
      floatingNumber: fnRecipe('floatingNumber'),
      soundOnly: fnRecipe('soundOnly'),
      turnBanner: fnRecipe('turnBanner'),
    },
    callOrder,
  };
}

/** H2.13 spec §4.3 — `FakeSoundManager` de test, objeto simple sin necesidad de `FakeAudioContext`
 *  real (`EffectsDirector` no conoce Web Audio, solo la interfaz `SoundManager`). */
function createFakeSoundManager(): SoundManager {
  return { unlock: vi.fn(), play: vi.fn() };
}

/** NUEVO H5.3 §5 — `BigMomentClassifier`/`FocusController` fakes mínimos: por defecto ningún evento
 *  es "grande" (mismo comportamiento observable que antes de H5.3 en los tests preexistentes de este
 *  archivo, que no ejercitan foco). Casos nuevos (H5.3) sobreescriben `classify`. */
function createFakeBigMomentClassifier(classify: (event: CombatEvent) => boolean = () => false) {
  return { classify: vi.fn(classify) };
}

function createFakeFocusController() {
  return { begin: vi.fn(async () => {}), end: vi.fn(async () => {}) };
}

const NUCLEO_ID_1 = createId<'NucleoInstanceId'>('NucleoInstanceId', 'nucleo-1') as NucleoInstanceId;
const NUCLEO_ID_2 = createId<'NucleoInstanceId'>('NucleoInstanceId', 'nucleo-2') as NucleoInstanceId;
const ALLY_INSTANCE_ID = createId<'CardInstanceId'>('CardInstanceId', 'ally-1') as CardInstanceId;

describe('EffectsDirector — resolución evento→receta (H2.4)', () => {
  it('NUCLEO_TABLE_REROLLED: dispara soundOnly (H2.13 — JUICE_CONFIG.NUCLEO_TABLE_REROLLED apunta a soundOnly+soundId "diceRoll"; sin ningún tween visual, el "dado rodando" sigue viviendo en nucleo-table-view.ts/BoardView)', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const { registry } = createTestRegistry();
    const soundManager = createFakeSoundManager();
    const director = createEffectsDirector(
      JUICE_CONFIG,
      registry as unknown as JuiceRecipeRegistry,
      soundManager,
      createFakeBigMomentClassifier(),
      createFakeFocusController(),
    );
    director.attach(bridge, {} as Phaser.Scene);

    const event: CombatEvent = {
      type: 'NUCLEO_TABLE_REROLLED',
      dice: [
        { id: NUCLEO_ID_1, color: 'AGRESION', value: 2, kind: 'FIXED', status: 'AVAILABLE' },
        { id: NUCLEO_ID_2, color: 'CONTROL', value: 3, kind: 'FIXED', status: 'AVAILABLE' },
      ],
      priorityTurnOwner: 'LEADER',
    };

    emit(event);
    await Promise.resolve();
    await Promise.resolve();

    expect(registry.diceRoll.play).not.toHaveBeenCalled();
    expect(registry.cardFlip.play).not.toHaveBeenCalled();
    expect(registry.hitImpact.play).not.toHaveBeenCalled();
    expect(registry.screenShake.play).not.toHaveBeenCalled();
    expect(soundManager.play).toHaveBeenCalledWith('diceRoll');
    expect(soundManager.play).toHaveBeenCalledTimes(1);
  });

  it('LEADER_DAMAGED: dispara hitImpact y luego screenShake, en ese orden, con focusId "leader"', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const { registry, callOrder } = createTestRegistry();
    const soundManager = createFakeSoundManager();
    const director = createEffectsDirector(
      JUICE_CONFIG,
      registry as unknown as JuiceRecipeRegistry,
      soundManager,
      createFakeBigMomentClassifier(),
      createFakeFocusController(),
    );
    director.attach(bridge, {} as Phaser.Scene);

    const event: CombatEvent = {
      type: 'LEADER_DAMAGED',
      sourceId: 'enemy-ability-1',
      side: 'ENEMY',
      nucleoSpent: { id: NUCLEO_ID_1, color: 'AGRESION', value: 2 },
      rawAmount: 5,
      absorbedByShield: 0,
      appliedDamage: 5,
      leaderShieldAfter: 0,
      leaderDamageAfter: 5,
    };

    emit(event);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(registry.hitImpact.play).toHaveBeenCalledTimes(1);
    expect(registry.screenShake.play).toHaveBeenCalledTimes(1);
    // H2.11: floatingNumber (parallel, primer step) resuelve antes de que hitImpact/screenShake
    // arranquen — no altera su orden relativo entre sí.
    expect(callOrder).toEqual(['floatingNumber', 'hitImpact', 'screenShake']);

    const [, hitImpactTarget] = (registry.hitImpact.play as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(hitImpactTarget.focusId).toBe('leader');

    // H2.13: soundManager.play('hit') se dispara junto con el step 'hitImpact' (soundId estático).
    expect(soundManager.play).toHaveBeenCalledWith('hit');
    expect(soundManager.play).toHaveBeenCalledTimes(1);
  });

  it('H2.13: LEADER_DAMAGED invoca soundManager.play("hit") ANTES de que hitImpact/screenShake completen sus tweens (no bloquea el "pending", mismo criterio que floatingNumber)', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const soundManager = createFakeSoundManager();
    const callOrder: string[] = [];
    const registry: TestRegistry = {
      diceRoll: { id: 'diceRoll', play: vi.fn(async () => {}) },
      cardFlip: { id: 'cardFlip', play: vi.fn(async () => {}) },
      hitImpact: {
        id: 'hitImpact',
        play: vi.fn(
          () =>
            new Promise<void>((resolve) => {
              // Nunca resuelve dentro del test — solo nos interesa que soundManager.play ya se
              // haya invocado ANTES de que esta promesa llegue a resolverse.
              setTimeout(resolve, 0);
            }),
        ),
      },
      screenShake: { id: 'screenShake', play: vi.fn(async () => {}) },
      floatingNumber: {
        id: 'floatingNumber',
        play: vi.fn(async () => {
          callOrder.push('floatingNumber');
        }),
      },
      soundOnly: { id: 'soundOnly', play: vi.fn(async () => {}) },
      turnBanner: { id: 'turnBanner', play: vi.fn(async () => {}) },
    };
    const director = createEffectsDirector(
      JUICE_CONFIG,
      registry as unknown as JuiceRecipeRegistry,
      soundManager,
      createFakeBigMomentClassifier(),
      createFakeFocusController(),
    );
    director.attach(bridge, {} as Phaser.Scene);

    const event: CombatEvent = {
      type: 'LEADER_DAMAGED',
      sourceId: 'enemy-ability-1',
      side: 'ENEMY',
      nucleoSpent: { id: NUCLEO_ID_1, color: 'AGRESION', value: 2 },
      rawAmount: 5,
      absorbedByShield: 0,
      appliedDamage: 5,
      leaderShieldAfter: 0,
      leaderDamageAfter: 5,
    };

    emit(event);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // hitImpact todavía no ha completado su tween (nunca resuelve en este test), pero
    // soundManager.play('hit') ya se disparó de forma síncrona al arrancar el step.
    expect(soundManager.play).toHaveBeenCalledWith('hit');
    expect(registry.screenShake.play).not.toHaveBeenCalled();
  });

  it('TURN_ENDED: dispara únicamente turnBanner (H4 spec §3.2), sin soundManager.play (sin soundId estático)', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const { registry } = createTestRegistry();
    const soundManager = createFakeSoundManager();
    const director = createEffectsDirector(
      JUICE_CONFIG,
      registry as unknown as JuiceRecipeRegistry,
      soundManager,
      createFakeBigMomentClassifier(),
      createFakeFocusController(),
    );
    director.attach(bridge, {} as Phaser.Scene);

    const event: CombatEvent = {
      type: 'TURN_ENDED',
      previousTurnOwner: 'LEADER',
      nextTurnOwner: 'ENEMY',
      turnNumber: 1,
    };

    emit(event);
    await Promise.resolve();
    await Promise.resolve();

    expect(registry.diceRoll.play).not.toHaveBeenCalled();
    expect(registry.cardFlip.play).not.toHaveBeenCalled();
    expect(registry.hitImpact.play).not.toHaveBeenCalled();
    expect(registry.screenShake.play).not.toHaveBeenCalled();
    expect(registry.turnBanner.play).toHaveBeenCalledTimes(1);
    const [, target] = (registry.turnBanner.play as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(target.event).toEqual(event);
    expect(target.focusId).toBeUndefined();
    expect(soundManager.play).not.toHaveBeenCalled();
  });

  it('H2.13: CARD_PLAYED invoca soundManager.play("cardFlip")', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const { registry } = createTestRegistry();
    const soundManager = createFakeSoundManager();
    const director = createEffectsDirector(
      JUICE_CONFIG,
      registry as unknown as JuiceRecipeRegistry,
      soundManager,
      createFakeBigMomentClassifier(),
      createFakeFocusController(),
    );
    director.attach(bridge, {} as Phaser.Scene);

    const event: CombatEvent = {
      type: 'CARD_PLAYED',
      cardId: createId<'CardId'>('CardId', 'card-1') as CardId,
      sourceId: 'card-instance-1',
      leaderEnergyAfter: 2,
    };

    emit(event);
    await Promise.resolve();
    await Promise.resolve();

    expect(soundManager.play).toHaveBeenCalledWith('cardFlip');
    expect(soundManager.play).toHaveBeenCalledTimes(1);
  });

  it('H2.13: evento sin soundId en ninguno de sus steps (SCENARIO_PLOT_CHANGED) nunca invoca soundManager.play', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const { registry } = createTestRegistry();
    const soundManager = createFakeSoundManager();
    const director = createEffectsDirector(
      JUICE_CONFIG,
      registry as unknown as JuiceRecipeRegistry,
      soundManager,
      createFakeBigMomentClassifier(),
      createFakeFocusController(),
    );
    director.attach(bridge, {} as Phaser.Scene);

    const event: CombatEvent = {
      type: 'SCENARIO_PLOT_CHANGED',
      sourceId: 'enemy-ability-1',
      side: 'ENEMY',
      direction: 'INCREASE',
      rawAmount: 2,
      appliedDelta: 2,
      scenarioPlotAfter: 2,
    };

    emit(event);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(soundManager.play).not.toHaveBeenCalled();
  });

  it('ALLY_DAMAGED: dispara hitImpact con focusId=allyInstanceId, sin screenShake (distinto de LEADER_DAMAGED)', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const { registry } = createTestRegistry();
    const soundManager = createFakeSoundManager();
    const director = createEffectsDirector(
      JUICE_CONFIG,
      registry as unknown as JuiceRecipeRegistry,
      soundManager,
      createFakeBigMomentClassifier(),
      createFakeFocusController(),
    );
    director.attach(bridge, {} as Phaser.Scene);

    const event: CombatEvent = {
      type: 'ALLY_DAMAGED',
      sourceId: 'enemy-ability-1',
      side: 'ENEMY',
      nucleoSpent: { id: NUCLEO_ID_1, color: 'AGRESION', value: 2 },
      allyInstanceId: ALLY_INSTANCE_ID,
      rawAmount: 3,
      absorbedByAlly: 3,
      allyLifeBefore: 5,
      allyLifeAfter: 2,
      allyDied: false,
      excess: 0,
      appliedDamageToLeader: 0,
      leaderDamageAfter: 0,
    };

    emit(event);
    await Promise.resolve();
    await Promise.resolve();

    expect(registry.hitImpact.play).toHaveBeenCalledTimes(1);
    const [, target] = (registry.hitImpact.play as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(target.focusId).toBe(ALLY_INSTANCE_ID);
    expect(registry.screenShake.play).not.toHaveBeenCalled();
    // ALLY_DAMAGED no tiene soundId estático asignado en JUICE_CONFIG (H2.13 spec §1.6 no lo cubre).
    expect(soundManager.play).not.toHaveBeenCalled();
  });

  it('recipeId inexistente en el registro: lanza en vez de fallar en silencio', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const { registry } = createTestRegistry();
    const soundManager = createFakeSoundManager();

    const brokenConfig: JuiceConfig = {
      ...JUICE_CONFIG,
      TURN_ENDED: [{ recipeId: 'typoRecipeId', mode: 'parallel' }],
    };

    const errors: unknown[] = [];
    const originalHandler = process.listeners('unhandledRejection');
    const handler = (reason: unknown) => errors.push(reason);
    process.on('unhandledRejection', handler);

    try {
      const director = createEffectsDirector(
        brokenConfig,
        registry as unknown as JuiceRecipeRegistry,
        soundManager,
        createFakeBigMomentClassifier(),
        createFakeFocusController(),
      );
      director.attach(bridge, {} as Phaser.Scene);

      const event: CombatEvent = {
        type: 'TURN_ENDED',
        previousTurnOwner: 'LEADER',
        nextTurnOwner: 'ENEMY',
        turnNumber: 1,
      };

      emit(event);
      // El listener de `attach` dispara `resolveEvent` como fire-and-forget (§3.2 punto 4) — la
      // promesa rechazada se detecta como `unhandledRejection`, que Node emite tras vaciar la
      // cola de microtareas (siguiente vuelta del event loop, de ahí `setImmediate`).
      await new Promise((resolve) => setImmediate(resolve));

      expect(errors).toHaveLength(1);
      expect(String(errors[0])).toMatch(/typoRecipeId/);
    } finally {
      process.removeListener('unhandledRejection', handler);
      originalHandler.forEach((l) => process.on('unhandledRejection', l));
    }
  });

  // H5.3 spec §5 casos 7-10 — wrap automático de foco alrededor de eventos "grandes".
  describe('H5.3 — wrap de foco (isBigMoment estático + BigMomentClassifier dinámico)', () => {
    it('7. evento con steps[0].isBigMoment === true: focusController.begin/end se invocan alrededor de recipe.play', async () => {
      const { bridge, emit } = createMockSceneBridge();
      const soundManager = createFakeSoundManager();
      const bigMomentClassifier = createFakeBigMomentClassifier();
      const focusController = createFakeFocusController();
      const { scene } = createFakeJuiceScene();

      const config: JuiceConfig = {
        ...JUICE_CONFIG,
        PHASE_CHANGED: [{ recipeId: 'screenShake', mode: 'sequential', isBigMoment: true }],
      };
      const registry: JuiceRecipeRegistry = { screenShake: { id: 'screenShake', play: vi.fn(async () => {}) } };

      const director = createEffectsDirector(config, registry, soundManager, bigMomentClassifier, focusController);
      director.attach(bridge, scene);

      emit({ type: 'PHASE_CHANGED', source: 'ENEMY', fromPhaseNumber: 1, toPhaseNumber: 2 });
      await new Promise((resolve) => setImmediate(resolve));

      expect(focusController.begin).toHaveBeenCalledTimes(1);
      expect(focusController.end).toHaveBeenCalledTimes(1);
      expect(registry['screenShake']!.play).toHaveBeenCalledTimes(1);
    });

    it('8. isBigMoment ausente en todos los steps y bigMomentClassifier.classify=false: focusController nunca se llama', async () => {
      const { bridge, emit } = createMockSceneBridge();
      const soundManager = createFakeSoundManager();
      const bigMomentClassifier = createFakeBigMomentClassifier(() => false);
      const focusController = createFakeFocusController();
      const { scene } = createFakeJuiceScene();
      const registry: JuiceRecipeRegistry = { turnBanner: { id: 'turnBanner', play: vi.fn(async () => {}) } };

      const director = createEffectsDirector(JUICE_CONFIG, registry, soundManager, bigMomentClassifier, focusController);
      director.attach(bridge, scene);

      emit({ type: 'TURN_ENDED', previousTurnOwner: 'LEADER', nextTurnOwner: 'ENEMY', turnNumber: 1 });
      await new Promise((resolve) => setImmediate(resolve));

      expect(focusController.begin).not.toHaveBeenCalled();
      expect(focusController.end).not.toHaveBeenCalled();
    });

    it('9. isBigMoment ausente pero bigMomentClassifier.classify=true: focusController SÍ se llama (promoción dinámica)', async () => {
      const { bridge, emit } = createMockSceneBridge();
      const soundManager = createFakeSoundManager();
      const bigMomentClassifier = createFakeBigMomentClassifier(() => true);
      const focusController = createFakeFocusController();
      const { scene } = createFakeJuiceScene();
      const registry: JuiceRecipeRegistry = { turnBanner: { id: 'turnBanner', play: vi.fn(async () => {}) } };

      const director = createEffectsDirector(JUICE_CONFIG, registry, soundManager, bigMomentClassifier, focusController);
      director.attach(bridge, scene);

      emit({ type: 'TURN_ENDED', previousTurnOwner: 'LEADER', nextTurnOwner: 'ENEMY', turnNumber: 1 });
      await new Promise((resolve) => setImmediate(resolve));

      expect(focusController.begin).toHaveBeenCalledTimes(1);
      expect(focusController.end).toHaveBeenCalledTimes(1);
    });

    it('10. focusController.end no se llama antes de que resuelva el delayedCall de espera mínima (MIN_BIG_MOMENT_HOLD_MS), aunque recipe.play ya haya completado', async () => {
      const { bridge, emit } = createMockSceneBridge();
      const soundManager = createFakeSoundManager();
      const bigMomentClassifier = createFakeBigMomentClassifier();
      const focusController = createFakeFocusController();
      // autoComplete: false — controla a mano cuándo resuelve `scene.time.delayedCall`, para poder
      // observar el estado ANTES de que la espera mínima termine.
      const { scene, recordedDelayedCalls, runDelayedCall } = createFakeJuiceScene({ autoComplete: false });
      const registry: JuiceRecipeRegistry = { screenShake: { id: 'screenShake', play: vi.fn(async () => {}) } };
      const config: JuiceConfig = {
        ...JUICE_CONFIG,
        PHASE_CHANGED: [{ recipeId: 'screenShake', mode: 'sequential', isBigMoment: true }],
      };

      const director = createEffectsDirector(config, registry, soundManager, bigMomentClassifier, focusController);
      director.attach(bridge, scene);

      emit({ type: 'PHASE_CHANGED', source: 'ENEMY', fromPhaseNumber: 1, toPhaseNumber: 2 });

      // Deja resolver los microtasks pendientes (begin(), recipe.play()) hasta que el código llegue
      // al `scene.time.delayedCall` de espera mínima.
      for (let i = 0; i < 10; i += 1) await Promise.resolve();

      expect(recordedDelayedCalls).toHaveLength(1);
      expect(recordedDelayedCalls[0]!.delayMs).toBeLessThanOrEqual(MIN_BIG_MOMENT_HOLD_MS);
      expect(recordedDelayedCalls[0]!.delayMs).toBeGreaterThan(0);
      expect(focusController.end).not.toHaveBeenCalled();

      runDelayedCall(0);
      await Promise.resolve();
      await Promise.resolve();

      expect(focusController.end).toHaveBeenCalledTimes(1);
    });
  });

  // H5.9 spec §6 casos 1-3 — cola de reproducción serializada + queueSignal.
  describe('H5.9 — cola de reproducción serializada (EffectsQueueSignal)', () => {
    it('1. el segundo evento no arranca su receta hasta que la del primero (incluido su posible foco) resolvió', async () => {
      const { bridge, emit } = createMockSceneBridge();
      const soundManager = createFakeSoundManager();
      let resolveTurnBanner: () => void = () => {};
      const registry: JuiceRecipeRegistry = {
        turnBanner: {
          id: 'turnBanner',
          play: vi.fn(() => new Promise<void>((resolve) => { resolveTurnBanner = resolve; })),
        },
        hitImpact: { id: 'hitImpact', play: vi.fn(async () => {}) },
        screenShake: { id: 'screenShake', play: vi.fn(async () => {}) },
        floatingNumber: { id: 'floatingNumber', play: vi.fn(async () => {}) },
      };
      const director = createEffectsDirector(
        JUICE_CONFIG,
        registry,
        soundManager,
        createFakeBigMomentClassifier(),
        createFakeFocusController(),
      );
      director.attach(bridge, {} as Phaser.Scene);

      const turnEndedEvent: CombatEvent = { type: 'TURN_ENDED', previousTurnOwner: 'ENEMY', nextTurnOwner: 'LEADER', turnNumber: 2 };
      const leaderDamagedEvent: CombatEvent = {
        type: 'LEADER_DAMAGED',
        sourceId: 'enemy-ability-1',
        side: 'ENEMY',
        nucleoSpent: { id: NUCLEO_ID_1, color: 'AGRESION', value: 2 },
        rawAmount: 5,
        absorbedByShield: 0,
        appliedDamage: 5,
        leaderShieldAfter: 0,
        leaderDamageAfter: 5,
      };

      // Ambos emitidos EN LA MISMA pila síncrona (mismo patrón que `handleEndTurn` real) — sin await
      // entre ellos.
      emit(turnEndedEvent);
      emit(leaderDamagedEvent);

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(registry.turnBanner!.play).toHaveBeenCalledTimes(1);
      expect(registry.hitImpact!.play).not.toHaveBeenCalled(); // el 2º evento espera su turno en la cola

      resolveTurnBanner();
      await new Promise((resolve) => setImmediate(resolve));

      expect(registry.hitImpact!.play).toHaveBeenCalledTimes(1);
    });

    it('2. isDraining() pasa a true en cuanto el primer evento con receta entra en cola, y a false solo tras drenar el último', async () => {
      const { bridge, emit } = createMockSceneBridge();
      const { registry } = createTestRegistry();
      const soundManager = createFakeSoundManager();
      const director = createEffectsDirector(
        JUICE_CONFIG,
        registry as unknown as JuiceRecipeRegistry,
        soundManager,
        createFakeBigMomentClassifier(),
        createFakeFocusController(),
      );
      director.attach(bridge, {} as Phaser.Scene);

      const transitions: boolean[] = [];
      director.queueSignal.subscribe((draining) => transitions.push(draining));

      expect(director.queueSignal.isDraining()).toBe(false);

      const turnEndedEvent: CombatEvent = { type: 'TURN_ENDED', previousTurnOwner: 'ENEMY', nextTurnOwner: 'LEADER', turnNumber: 2 };
      const cardPlayedEvent: CombatEvent = {
        type: 'CARD_PLAYED',
        cardId: createId<'CardId'>('CardId', 'card-1') as CardId,
        sourceId: 'card-instance-1',
        leaderEnergyAfter: 2,
      };

      emit(turnEndedEvent);
      emit(cardPlayedEvent);

      await new Promise((resolve) => setImmediate(resolve));

      expect(transitions).toEqual([true, false]);
      expect(director.queueSignal.isDraining()).toBe(false);
    });

    it('3. un evento sin receta (steps.length === 0) no dispara ningún cambio de isDraining()', async () => {
      const { bridge, emit } = createMockSceneBridge();
      const { registry } = createTestRegistry();
      const soundManager = createFakeSoundManager();
      const director = createEffectsDirector(
        JUICE_CONFIG,
        registry as unknown as JuiceRecipeRegistry,
        soundManager,
        createFakeBigMomentClassifier(),
        createFakeFocusController(),
      );
      director.attach(bridge, {} as Phaser.Scene);

      const transitions: boolean[] = [];
      director.queueSignal.subscribe((draining) => transitions.push(draining));

      // COOLDOWNS_TICKED no tiene receta en JUICE_CONFIG (array vacío) — no debe entrar en cola.
      emit({ type: 'COOLDOWNS_TICKED', changes: [] } as unknown as CombatEvent);

      await new Promise((resolve) => setImmediate(resolve));

      expect(transitions).toEqual([]);
      expect(director.queueSignal.isDraining()).toBe(false);
    });

    it('4. FIX Reviewer post-E5 (bug real 1) — una receta que lanza NO bloquea el resto de la cola: el siguiente evento SÍ se resuelve y isDraining() vuelve a false', async () => {
      const { bridge, emit } = createMockSceneBridge();
      const soundManager = createFakeSoundManager();

      // CARD_PLAYED apunta a un recipeId inexistente — reproduce una receta rota (mismo mecanismo que
      // el test "recipeId inexistente..." de arriba), pero aquí seguida de un segundo evento válido en
      // la MISMA pila síncrona (mismo patrón que `handleEndTurn` real, H5.9 §0.2).
      const brokenConfig: JuiceConfig = {
        ...JUICE_CONFIG,
        CARD_PLAYED: [{ recipeId: 'typoRecipeId', mode: 'parallel' }],
      };
      const registry: JuiceRecipeRegistry = {
        turnBanner: { id: 'turnBanner', play: vi.fn(async () => {}) },
      };

      const errors: unknown[] = [];
      const originalHandler = process.listeners('unhandledRejection');
      const handler = (reason: unknown) => errors.push(reason);
      process.on('unhandledRejection', handler);

      try {
        const director = createEffectsDirector(
          brokenConfig,
          registry,
          soundManager,
          createFakeBigMomentClassifier(),
          createFakeFocusController(),
        );
        director.attach(bridge, {} as Phaser.Scene);

        const transitions: boolean[] = [];
        director.queueSignal.subscribe((draining) => transitions.push(draining));

        const brokenEvent: CombatEvent = {
          type: 'CARD_PLAYED',
          cardId: createId<'CardId'>('CardId', 'card-1') as CardId,
          sourceId: 'card-instance-1',
          leaderEnergyAfter: 2,
        };
        const validEvent: CombatEvent = {
          type: 'TURN_ENDED',
          previousTurnOwner: 'LEADER',
          nextTurnOwner: 'ENEMY',
          turnNumber: 1,
        };

        // Ambos emitidos EN LA MISMA pila síncrona — mismo patrón que `handleEndTurn` real.
        emit(brokenEvent);
        emit(validEvent);

        await new Promise((resolve) => setImmediate(resolve));

        expect(registry.turnBanner!.play).toHaveBeenCalledTimes(1); // el 2º evento SÍ se resolvió
        expect(director.queueSignal.isDraining()).toBe(false); // no queda atascado en `true`
        expect(transitions).toEqual([true, false]); // una única transición completa, sin bloqueo
        expect(errors).toHaveLength(1); // el error sigue siendo visible, no silencioso
        expect(String(errors[0])).toMatch(/typoRecipeId/);
      } finally {
        process.removeListener('unhandledRejection', handler);
        originalHandler.forEach((l) => process.on('unhandledRejection', l));
      }
    });
  });
});
