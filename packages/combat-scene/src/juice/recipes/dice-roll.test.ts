// @vitest-environment node
//
// H2.5 spec §5 — `dice-roll.test.ts`: verifica configuración de las tweens/partículas por dado
// contra `FakeJuiceScene`, no renderizado real (§1.3).
import { describe, it, expect } from 'vitest';
import { createId } from '@collector/domain-shared';
import type { NucleoInstanceId } from '@collector/domain-shared';
import type { CombatEvent } from '@collector/domain-combat';
import { createFakeJuiceScene } from './test-utils/fake-juice-scene';
import { diceRoll } from './dice-roll';
import type { JuiceTarget } from '../juice-recipe';

const NUCLEO_ID_1 = createId<'NucleoInstanceId'>('NucleoInstanceId', 'nucleo-1') as NucleoInstanceId;
const NUCLEO_ID_2 = createId<'NucleoInstanceId'>('NucleoInstanceId', 'nucleo-2') as NucleoInstanceId;

function poolRolledEvent(): CombatEvent {
  return {
    type: 'NUCLEO_TABLE_REROLLED',
    dice: [
      { id: NUCLEO_ID_1, color: 'AGRESION', value: 2, kind: 'FIXED', status: 'AVAILABLE' },
      { id: NUCLEO_ID_2, color: 'CONTROL', value: 3, kind: 'FIXED', status: 'AVAILABLE' },
    ],
    priorityTurnOwner: 'LEADER',
  };
}

describe('diceRoll', () => {
  it('registra un tween (angle + scale) por Núcleo del pool, en paralelo', async () => {
    const fake = createFakeJuiceScene();
    const target: JuiceTarget = { event: poolRolledEvent() };

    void diceRoll.play(fake.scene, target, {});
    // No await todavía: verificamos que los 2 tweens se crearon de forma síncrona, antes de que
    // resuelva nada (paralelismo real, no uno-tras-otro).
    expect(fake.recordedTweens).toHaveLength(2);

    for (const tween of fake.recordedTweens) {
      expect(tween.config['angle']).toMatchObject({ from: 0 });
      expect(tween.config['scale']).toEqual({ from: 1.2, to: 1 });
      expect(tween.config['duration']).toBe(500);
      expect(tween.config['ease']).toBe('Cubic.easeOut');
    }
  });

  it('dispara add.particles solo después de completar el tween del dado correspondiente (orden)', async () => {
    const fake = createFakeJuiceScene({ autoComplete: false });
    const target: JuiceTarget = { event: poolRolledEvent() };

    const playPromise = diceRoll.play(fake.scene, target, {});

    expect(fake.recordedTweens).toHaveLength(2);
    expect(fake.recordedParticles).toHaveLength(0);

    fake.completeTween(0);
    expect(fake.recordedParticles).toHaveLength(1);
    expect(fake.recordedParticles[0]?.config['quantity']).toBe(8);

    fake.completeTween(1);
    expect(fake.recordedParticles).toHaveLength(2);

    await playPromise;
  });

  it('la Promise de play() resuelve solo tras completar los tweens de AMBOS dados', async () => {
    const fake = createFakeJuiceScene({ autoComplete: false });
    const target: JuiceTarget = { event: poolRolledEvent() };

    let resolved = false;
    const playPromise = diceRoll.play(fake.scene, target, {}).then(() => {
      resolved = true;
    });

    fake.completeTween(0);
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);

    fake.completeTween(1);
    await playPromise;
    expect(resolved).toBe(true);
  });

  it('con un evento distinto de NUCLEO_TABLE_REROLLED, resuelve sin crear tweens (defensivo)', async () => {
    const fake = createFakeJuiceScene();
    const target: JuiceTarget = {
      event: { type: 'TURN_ENDED', previousTurnOwner: 'LEADER', nextTurnOwner: 'ENEMY', turnNumber: 1 },
    };

    await diceRoll.play(fake.scene, target, {});
    expect(fake.recordedTweens).toHaveLength(0);
  });
});
