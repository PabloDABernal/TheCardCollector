// @vitest-environment node
//
// H2.5 spec §5 — `screen-shake.test.ts`.
import { describe, it, expect } from 'vitest';
import { createFakeJuiceScene } from './test-utils/fake-juice-scene';
import { screenShake } from './screen-shake';
import type { JuiceTarget } from '../juice-recipe';

function leaderDamagedTarget(appliedDamage: number): JuiceTarget {
  return {
    focusId: 'leader',
    event: {
      type: 'LEADER_DAMAGED',
      sourceId: 'enemy-ability-1',
      side: 'ENEMY',
      nucleoSpent: null,
      rawAmount: appliedDamage,
      absorbedByShield: 0,
      appliedDamage,
      leaderShieldAfter: 0,
      leaderDamageAfter: appliedDamage,
    },
  };
}

function phaseChangedTarget(): JuiceTarget {
  return {
    focusId: 'enemy',
    event: { type: 'PHASE_CHANGED', source: 'ENEMY', fromPhaseNumber: 1, toPhaseNumber: 2 },
  };
}

describe('screenShake', () => {
  it('con LEADER_DAMAGED, intensidad de appliedDamage:20 es mayor que con appliedDamage:5', async () => {
    const fakeHigh = createFakeJuiceScene();
    const fakeLow = createFakeJuiceScene();

    await screenShake.play(fakeHigh.scene, leaderDamagedTarget(20), {});
    await screenShake.play(fakeLow.scene, leaderDamagedTarget(5), {});

    expect(fakeHigh.recordedShakes[0]?.intensity).toBeGreaterThan(fakeLow.recordedShakes[0]?.intensity ?? 0);
  });

  it('con PHASE_CHANGED, intensity === baseIntensity (sin escalar)', async () => {
    const fake = createFakeJuiceScene();
    const baseIntensity = 0.02;

    await screenShake.play(fake.scene, phaseChangedTarget(), { baseIntensity });

    expect(fake.recordedShakes[0]?.intensity).toBe(baseIntensity);
  });

  it('play() resuelve tras el onComplete fake de cameras.main.shake', async () => {
    const fake = createFakeJuiceScene();
    let resolved = false;

    const playPromise = screenShake.play(fake.scene, phaseChangedTarget(), {}).then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);
    await playPromise;
    expect(resolved).toBe(true);
  });

  it('respeta durationMs/baseIntensity de params al llamar a cameras.main.shake', async () => {
    const fake = createFakeJuiceScene();

    await screenShake.play(fake.scene, phaseChangedTarget(), { durationMs: 400, baseIntensity: 0.05 });

    expect(fake.recordedShakes[0]).toEqual({ duration: 400, intensity: 0.05 });
  });
});
