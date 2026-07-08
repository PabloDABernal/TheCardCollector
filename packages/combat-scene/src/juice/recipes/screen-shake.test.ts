// @vitest-environment node
//
// H2.5 spec §5 — `screen-shake.test.ts`.
import { describe, it, expect } from 'vitest';
import { createId } from '@collector/domain-shared';
import type { CardId, NucleoInstanceId } from '@collector/domain-shared';
import type { NucleoInstance } from '@collector/domain-combat';
import { createFakeJuiceScene } from './test-utils/fake-juice-scene';
import { screenShake } from './screen-shake';
import type { JuiceTarget } from '../juice-recipe';

const CARD_ID = createId<'CardId'>('CardId', 'card-1') as CardId;
const NUCLEO_SPENT: NucleoInstance = {
  id: createId<'NucleoInstanceId'>('NucleoInstanceId', 'nucleo-1') as NucleoInstanceId,
  color: 'AGRESION',
  value: 3,
};

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

function enemyDamagedTarget(rawAmount: number, bonus?: { bonusActivated: boolean; bonusResolvedValue?: number }): JuiceTarget {
  return {
    focusId: 'enemy',
    event: {
      type: 'ENEMY_DAMAGED',
      cardId: CARD_ID,
      sourceId: 'leader-1',
      nucleoSpent: NUCLEO_SPENT,
      rawAmount,
      bonusActivated: bonus?.bonusActivated ?? false,
      ...(bonus?.bonusResolvedValue !== undefined ? { bonusResolvedValue: bonus.bonusResolvedValue } : {}),
      enemyDamageAfter: rawAmount,
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

  it('con ENEMY_DAMAGED, intensidad de rawAmount:20 es mayor que con rawAmount:5', async () => {
    const fakeHigh = createFakeJuiceScene();
    const fakeLow = createFakeJuiceScene();

    await screenShake.play(fakeHigh.scene, enemyDamagedTarget(20), {});
    await screenShake.play(fakeLow.scene, enemyDamagedTarget(5), {});

    expect(fakeHigh.recordedShakes[0]?.intensity).toBeGreaterThan(fakeLow.recordedShakes[0]?.intensity ?? 0);
  });

  it('con ENEMY_DAMAGED, la intensidad depende solo de rawAmount y NO de bonusResolvedValue aunque bonusActivated sea true', async () => {
    const fakeWithoutBonus = createFakeJuiceScene();
    const fakeWithBonus = createFakeJuiceScene();

    await screenShake.play(fakeWithoutBonus.scene, enemyDamagedTarget(10), {});
    await screenShake.play(
      fakeWithBonus.scene,
      enemyDamagedTarget(10, { bonusActivated: true, bonusResolvedValue: 999 }),
      {}
    );

    expect(fakeWithBonus.recordedShakes[0]?.intensity).toBe(fakeWithoutBonus.recordedShakes[0]?.intensity);
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
