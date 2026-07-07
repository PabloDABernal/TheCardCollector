// @vitest-environment node
//
// H2.5 spec §5.1 — test de integración: `EffectsDirector` real (H2.4) + `RECIPE_REGISTRY` real de
// esta historia (no un mock) contra un `FakeJuiceScene`. Cubre explícitamente el criterio de
// `backlog.md` "secuencia de dos recetas seguidas espera la primera": `LEADER_DAMAGED` dispara
// `hitImpact` (`sequential`) → `screenShake` (`sequential`), y `screenShake` no debe invocarse hasta
// que el tween de `hitImpact` completó.
import { describe, it, expect } from 'vitest';
import type { CombatBridge, CombatEvent } from '@collector/combat-bridge';
import { createId } from '@collector/domain-shared';
import type { NucleoInstanceId } from '@collector/domain-shared';
import type Phaser from 'phaser';
import { createEffectsDirector } from '../effects-director';
import { JUICE_CONFIG } from '../juice-config';
import { RECIPE_REGISTRY } from './index';
import { cooldownReady } from './cooldown-ready';
import { floatingNumber } from './floating-number';
import { createFakeJuiceScene } from './test-utils/fake-juice-scene';

const NUCLEO_ID_1 = createId<'NucleoInstanceId'>('NucleoInstanceId', 'nucleo-1') as NucleoInstanceId;

function createMockSceneBridge() {
  const listeners: Array<(e: CombatEvent) => void> = [];
  return {
    bridge: {
      subscribeSceneEvents: (listener: (e: CombatEvent) => void) => {
        listeners.push(listener);
        return () => {
          /* no-op, no se ejercita unsubscribe en este test */
        };
      },
    } as unknown as CombatBridge,
    emit: (event: CombatEvent) => listeners.forEach((l) => l(event)),
  };
}

describe('RECIPE_REGISTRY + EffectsDirector — integración de secuencia (H2.5 spec §5.1)', () => {
  it('LEADER_DAMAGED: screenShake NO se invoca hasta que hitImpact completa su tween', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const fake = createFakeJuiceScene({ autoComplete: false });
    const director = createEffectsDirector(JUICE_CONFIG, RECIPE_REGISTRY);
    director.attach(bridge, fake.scene as unknown as Phaser.Scene);

    const event: CombatEvent = {
      type: 'LEADER_DAMAGED',
      sourceId: 'enemy-ability-1',
      side: 'ENEMY',
      nucleoSpent: null,
      rawAmount: 5,
      absorbedByShield: 0,
      appliedDamage: 5,
      leaderShieldAfter: 0,
      leaderDamageAfter: 5,
    };

    emit(event);
    await Promise.resolve();
    await Promise.resolve();

    // H2.11: floatingNumber (parallel, primer step) ya creó su propio tween de subida/fade
    // (índice 0) sin esperar a que termine (§1.7); hitImpact ya creó su tweens.chain (punch,
    // índice 1), pero screenShake aún NO debe haberse invocado.
    expect(fake.recordedTweens).toHaveLength(2);
    expect(fake.recordedShakes).toHaveLength(0);

    // Completar el tween de hitImpact (índice 1) resuelve su Promise, lo que permite a
    // EffectsDirector avanzar al siguiente step secuencial (screenShake).
    fake.completeTween(1);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(fake.recordedShakes).toHaveLength(1);
  });

  it('NUCLEO_POOL_ROLLED: diceRoll real crea tweens con el RECIPE_REGISTRY real', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const fake = createFakeJuiceScene();
    const director = createEffectsDirector(JUICE_CONFIG, RECIPE_REGISTRY);
    director.attach(bridge, fake.scene as unknown as Phaser.Scene);

    emit({
      type: 'NUCLEO_POOL_ROLLED',
      pool: [{ id: NUCLEO_ID_1, color: 'AGRESION', value: 2 }],
      priorityTurnOwner: 'LEADER',
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(fake.recordedTweens).toHaveLength(1);
  });

  it('H2.10: JUICE_CONFIG.COOLDOWNS_TICKED apunta a cooldownReady, registrado en RECIPE_REGISTRY', () => {
    expect(JUICE_CONFIG.COOLDOWNS_TICKED).toEqual([{ recipeId: 'cooldownReady', mode: 'parallel' }]);
    expect(RECIPE_REGISTRY['cooldownReady']).toBe(cooldownReady);
    expect(RECIPE_REGISTRY['cooldownReady']?.id).toBe('cooldownReady');
  });

  it('H2.11: floatingNumber registrado en RECIPE_REGISTRY con id correcto', () => {
    expect(RECIPE_REGISTRY['floatingNumber']).toBe(floatingNumber);
    expect(RECIPE_REGISTRY['floatingNumber']?.id).toBe('floatingNumber');
  });

  it('H2.11: floatingNumber es el PRIMER step (mode: parallel) de LEADER_DAMAGED/ENEMY_DAMAGED/ALLY_DAMAGED/SCENARIO_PLOT_CHANGED', () => {
    expect(JUICE_CONFIG.LEADER_DAMAGED[0]).toEqual({ recipeId: 'floatingNumber', mode: 'parallel' });
    expect(JUICE_CONFIG.ENEMY_DAMAGED[0]).toEqual({ recipeId: 'floatingNumber', mode: 'parallel' });
    expect(JUICE_CONFIG.ALLY_DAMAGED[0]).toEqual({ recipeId: 'floatingNumber', mode: 'parallel' });
    expect(JUICE_CONFIG.SCENARIO_PLOT_CHANGED[0]).toEqual({ recipeId: 'floatingNumber', mode: 'parallel' });
  });

  it('H2.11: LEADER_DAMAGED emite floatingNumber sin retrasar hitImpact/screenShake (mismo t=0)', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const fake = createFakeJuiceScene({ autoComplete: false });
    const director = createEffectsDirector(JUICE_CONFIG, RECIPE_REGISTRY);
    director.attach(bridge, fake.scene as unknown as Phaser.Scene);

    emit({
      type: 'LEADER_DAMAGED',
      sourceId: 'enemy-ability-1',
      side: 'ENEMY',
      nucleoSpent: null,
      rawAmount: 5,
      absorbedByShield: 0,
      appliedDamage: 5,
      leaderShieldAfter: 0,
      leaderDamageAfter: 5,
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // floatingNumber ya creó su Text + tween de subida/fade (fire-and-forget); hitImpact ya
    // arrancó su punch (2 tweens grabados hasta ahora: floatingNumber + hitImpact), screenShake
    // aún no se invocó.
    expect(fake.recordedTexts).toHaveLength(1);
    expect(fake.recordedTweens).toHaveLength(2);
    expect(fake.recordedShakes).toHaveLength(0);
  });
});
