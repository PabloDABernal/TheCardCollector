// @vitest-environment node
//
// H2.4 spec §6 — test de aislamiento: mockea `CombatBridge.subscribeSceneEvents` a mano (no el
// `createCombatBridge` real, no hace falta un `CombatEngine`) y verifica que `EffectsDirector`
// resuelve `evento→receta` según `JUICE_CONFIG`, sin instanciar `Phaser.Scene` de verdad.
import { describe, it, expect, vi } from 'vitest';
import type { CombatBridge, CombatEvent } from '@collector/combat-bridge';
import { createId } from '@collector/domain-shared';
import type { CardInstanceId, NucleoInstanceId } from '@collector/domain-shared';
import type Phaser from 'phaser';
import { createEffectsDirector } from './effects-director';
import { JUICE_CONFIG } from './juice-config';
import type { JuiceConfig } from './juice-config';
import type { JuiceRecipe, JuiceRecipeRegistry } from './juice-recipe';

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
    },
    callOrder,
  };
}

const NUCLEO_ID_1 = createId<'NucleoInstanceId'>('NucleoInstanceId', 'nucleo-1') as NucleoInstanceId;
const NUCLEO_ID_2 = createId<'NucleoInstanceId'>('NucleoInstanceId', 'nucleo-2') as NucleoInstanceId;
const ALLY_INSTANCE_ID = createId<'CardInstanceId'>('CardInstanceId', 'ally-1') as CardInstanceId;

describe('EffectsDirector — resolución evento→receta (H2.4)', () => {
  it('NUCLEO_POOL_ROLLED: no dispara ningún step (H2.12 — JUICE_CONFIG.NUCLEO_POOL_ROLLED es [], el "dado rodando" ahora vive en nucleo-pool-view.ts/BoardView, no en EffectsDirector)', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const { registry } = createTestRegistry();
    const director = createEffectsDirector(JUICE_CONFIG, registry as unknown as JuiceRecipeRegistry);
    director.attach(bridge, {} as Phaser.Scene);

    const event: CombatEvent = {
      type: 'NUCLEO_POOL_ROLLED',
      pool: [
        { id: NUCLEO_ID_1, color: 'AGRESION', value: 2 },
        { id: NUCLEO_ID_2, color: 'CONTROL', value: 3 },
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
  });

  it('LEADER_DAMAGED: dispara hitImpact y luego screenShake, en ese orden, con focusId "leader"', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const { registry, callOrder } = createTestRegistry();
    const director = createEffectsDirector(JUICE_CONFIG, registry as unknown as JuiceRecipeRegistry);
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
  });

  it('TURN_ENDED: ninguna receta del registro es invocada', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const { registry } = createTestRegistry();
    const director = createEffectsDirector(JUICE_CONFIG, registry as unknown as JuiceRecipeRegistry);
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
  });

  it('ALLY_DAMAGED: dispara hitImpact con focusId=allyInstanceId, sin screenShake (distinto de LEADER_DAMAGED)', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const { registry } = createTestRegistry();
    const director = createEffectsDirector(JUICE_CONFIG, registry as unknown as JuiceRecipeRegistry);
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
  });

  it('recipeId inexistente en el registro: lanza en vez de fallar en silencio', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const { registry } = createTestRegistry();

    const brokenConfig: JuiceConfig = {
      ...JUICE_CONFIG,
      TURN_ENDED: [{ recipeId: 'typoRecipeId', mode: 'parallel' }],
    };

    const errors: unknown[] = [];
    const originalHandler = process.listeners('unhandledRejection');
    const handler = (reason: unknown) => errors.push(reason);
    process.on('unhandledRejection', handler);

    try {
      const director = createEffectsDirector(brokenConfig, registry as unknown as JuiceRecipeRegistry);
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
});
