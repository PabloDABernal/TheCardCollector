// @vitest-environment node
//
// H2.5 spec §5.1 — test de integración: `EffectsDirector` real (H2.4) + registro de recetas real de
// esta historia (no un mock) contra un `FakeJuiceScene`. Cubre explícitamente el criterio de
// `backlog.md` "secuencia de dos recetas seguidas espera la primera": `LEADER_DAMAGED` dispara
// `hitImpact` (`sequential`) → `screenShake` (`sequential`), y `screenShake` no debe invocarse hasta
// que el tween de `hitImpact` completó.
//
// H2.13 spec §4.4 — migrado de `RECIPE_REGISTRY` (import estático) a `createRecipeRegistry(soundManager)`
// (fábrica): `combatOutcomeSound` necesita el `SoundManager` inyectado en su clausura.
import { describe, it, expect, vi } from 'vitest';
import type { CombatBridge, CombatEvent } from '@collector/combat-bridge';
import { createId } from '@collector/domain-shared';
import type { NucleoInstanceId } from '@collector/domain-shared';
import type Phaser from 'phaser';
import { createEffectsDirector } from '../effects-director';
import { JUICE_CONFIG } from '../juice-config';
import { createRecipeRegistry } from './index';
import { cooldownReady } from './cooldown-ready';
import { floatingNumber } from './floating-number';
import { soundOnly } from './sound-only';
import type { SoundManager } from '../../audio/sound-manager';
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

function createFakeSoundManager(): SoundManager {
  return { unlock: vi.fn(), play: vi.fn() };
}

describe('createRecipeRegistry + EffectsDirector — integración de secuencia (H2.5 spec §5.1, H2.13 spec §4.4)', () => {
  it('LEADER_DAMAGED: screenShake NO se invoca hasta que hitImpact completa su tween', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const fake = createFakeJuiceScene({ autoComplete: false });
    const soundManager = createFakeSoundManager();
    const director = createEffectsDirector(JUICE_CONFIG, createRecipeRegistry(soundManager), soundManager);
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
    // H2.13: soundManager.play('hit') ya se disparó (soundId estático del step hitImpact).
    expect(soundManager.play).toHaveBeenCalledWith('hit');

    // Completar el tween de hitImpact (índice 1) resuelve su Promise, lo que permite a
    // EffectsDirector avanzar al siguiente step secuencial (screenShake).
    fake.completeTween(1);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(fake.recordedShakes).toHaveLength(1);
  });

  it('NUCLEO_TABLE_REROLLED: sin ningún tween visual (H2.13 — soundOnly es no-op visual puro, el "dado rodando" sigue viviendo en nucleo-table-view.ts/BoardView), pero SÍ dispara soundManager.play("diceRoll")', async () => {
    const { bridge, emit } = createMockSceneBridge();
    const fake = createFakeJuiceScene();
    const soundManager = createFakeSoundManager();
    const director = createEffectsDirector(JUICE_CONFIG, createRecipeRegistry(soundManager), soundManager);
    director.attach(bridge, fake.scene as unknown as Phaser.Scene);

    expect(JUICE_CONFIG.NUCLEO_TABLE_REROLLED).toEqual([{ recipeId: 'soundOnly', mode: 'parallel', soundId: 'diceRoll' }]);

    emit({
      type: 'NUCLEO_TABLE_REROLLED',
      dice: [{ id: NUCLEO_ID_1, color: 'AGRESION', value: 2, kind: 'FIXED', status: 'AVAILABLE' }],
      priorityTurnOwner: 'LEADER',
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(fake.recordedTweens).toHaveLength(0);
    expect(soundManager.play).toHaveBeenCalledWith('diceRoll');
  });

  it('H2.10: JUICE_CONFIG.COOLDOWNS_TICKED apunta a cooldownReady, registrado en createRecipeRegistry', () => {
    const soundManager = createFakeSoundManager();
    const registry = createRecipeRegistry(soundManager);
    expect(JUICE_CONFIG.COOLDOWNS_TICKED).toEqual([{ recipeId: 'cooldownReady', mode: 'parallel' }]);
    expect(registry['cooldownReady']).toBe(cooldownReady);
    expect(registry['cooldownReady']?.id).toBe('cooldownReady');
  });

  it('H2.11: floatingNumber registrado en createRecipeRegistry con id correcto', () => {
    const soundManager = createFakeSoundManager();
    const registry = createRecipeRegistry(soundManager);
    expect(registry['floatingNumber']).toBe(floatingNumber);
    expect(registry['floatingNumber']?.id).toBe('floatingNumber');
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
    const soundManager = createFakeSoundManager();
    const director = createEffectsDirector(JUICE_CONFIG, createRecipeRegistry(soundManager), soundManager);
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

  it('H2.13: createRecipeRegistry(soundManager).soundOnly.id === "soundOnly"', () => {
    const soundManager = createFakeSoundManager();
    const registry = createRecipeRegistry(soundManager);
    expect(registry['soundOnly']).toBe(soundOnly);
    expect(registry['soundOnly']?.id).toBe('soundOnly');
  });

  it('H2.13: createRecipeRegistry(soundManager).combatOutcomeSound.id === "combatOutcomeSound", y su play() delega en soundManager.play para un evento COMBAT_ENDED', async () => {
    const soundManager = createFakeSoundManager();
    const registry = createRecipeRegistry(soundManager);
    const recipe = registry['combatOutcomeSound'];

    expect(recipe?.id).toBe('combatOutcomeSound');

    await recipe?.play({} as Phaser.Scene, { event: { type: 'COMBAT_ENDED', outcome: 'VICTORY' } }, {});

    expect(soundManager.play).toHaveBeenCalledWith('victory');
  });

  it('H2.13: JUICE_CONFIG.COMBAT_ENDED apunta a combatOutcomeSound', () => {
    expect(JUICE_CONFIG.COMBAT_ENDED).toEqual([{ recipeId: 'combatOutcomeSound', mode: 'parallel' }]);
  });
});
