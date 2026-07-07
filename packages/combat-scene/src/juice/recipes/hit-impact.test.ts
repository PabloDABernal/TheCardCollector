// @vitest-environment node
//
// H2.5 spec §5 — `hit-impact.test.ts`. El hitStop usa `setTimeout` plano (spec §3.3 punto 4,
// deliberadamente no `scene.time.delayedCall`) — se controla con fake timers de Vitest.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createId } from '@collector/domain-shared';
import type { CardInstanceId } from '@collector/domain-shared';
import { createFakeJuiceScene } from './test-utils/fake-juice-scene';
import { hitImpact } from './hit-impact';
import type { JuiceTarget } from '../juice-recipe';

const ALLY_INSTANCE_ID = createId<'CardInstanceId'>('CardInstanceId', 'ally-1') as CardInstanceId;

function leaderDamagedTarget(): JuiceTarget {
  return {
    focusId: 'leader',
    event: {
      type: 'LEADER_DAMAGED',
      sourceId: 'enemy-ability-1',
      side: 'ENEMY',
      nucleoSpent: null,
      rawAmount: 5,
      absorbedByShield: 0,
      appliedDamage: 5,
      leaderShieldAfter: 0,
      leaderDamageAfter: 5,
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('hitImpact', () => {
  it('registra la secuencia de escalas del punch (1→1.1→0.95→1) con duración total < 200ms', async () => {
    const fake = createFakeJuiceScene();
    await hitImpact.play(fake.scene, leaderDamagedTarget(), {});

    expect(fake.recordedTweens).toHaveLength(1);
    const legs = fake.recordedTweens[0]?.config['tweens'] as Array<Record<string, unknown>>;
    expect(legs.map((leg) => leg['scale'])).toEqual([1.1, 0.95, 1]);

    const totalDuration = legs.reduce((sum, leg) => sum + (leg['duration'] as number), 0);
    expect(totalDuration).toBeLessThan(200);
  });

  it('con hitStop por defecto (undefined), manipula tweens.timeScale antes del punch y revierte a 1', async () => {
    const fake = createFakeJuiceScene();

    const playPromise = hitImpact.play(fake.scene, leaderDamagedTarget(), {});

    // El hitStop se aplica de forma síncrona, antes de que el punch complete.
    expect(fake.timeScaleAssignments[0]).toBe(0);

    await vi.advanceTimersByTimeAsync(60);
    expect(fake.timeScaleAssignments).toContain(1);

    await playPromise;
  });

  it('con params: { hitStop: false }, no manipula timeScale en absoluto', async () => {
    const fake = createFakeJuiceScene();

    await hitImpact.play(fake.scene, leaderDamagedTarget(), { hitStop: false });

    expect(fake.timeScaleAssignments).toHaveLength(0);
  });

  it('flash de tinte: alterna fillColor a blanco y de vuelta al original', async () => {
    const fake = createFakeJuiceScene({ autoComplete: false });
    const target: JuiceTarget = { focusId: ALLY_INSTANCE_ID, event: leaderDamagedTarget().event };

    const playPromise = hitImpact.play(fake.scene, target, { hitStop: false });

    const placeholder = fake.scene.children.getByName(ALLY_INSTANCE_ID) as unknown as {
      fillColor: number;
    };
    expect(placeholder.fillColor).toBe(0xffffff);

    fake.runDelayedCall(0);
    expect(placeholder.fillColor).toBe(0x808080);

    fake.completeTween(0);
    await playPromise;
  });
});
