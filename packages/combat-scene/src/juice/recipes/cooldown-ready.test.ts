// @vitest-environment node
//
// H2.10 spec §5.2 — `cooldown-ready.test.ts`, mismo patrón que `hit-impact.test.ts`.
import { describe, it, expect } from 'vitest';
import { createId } from '@collector/domain-shared';
import type { AbilityId } from '@collector/domain-shared';
import { createFakeJuiceScene } from './test-utils/fake-juice-scene';
import { cooldownReady } from './cooldown-ready';
import { abilityIconGroupName } from '../../view/ability-cooldown-view';
import type { JuiceTarget } from '../juice-recipe';

function abilityId(value: string): AbilityId {
  return createId<'AbilityId'>('AbilityId', value) as AbilityId;
}

const READY_ID = abilityId('ability-soldado-base-guardia-firme');
const NOT_READY_ID = abilityId('ability-soldado-base-arrollar');

function cooldownsTickedTarget(): JuiceTarget {
  return {
    event: {
      type: 'COOLDOWNS_TICKED',
      side: 'LEADER',
      cooldowns: [
        { abilityId: READY_ID, side: 'LEADER', baseCooldown: 1, remaining: 0 },
        { abilityId: NOT_READY_ID, side: 'LEADER', baseCooldown: 3, remaining: 2 },
      ],
    },
  };
}

describe('cooldownReady', () => {
  it('pulso de escala solo sobre el game object de la habilidad con remaining === 0', async () => {
    const fake = createFakeJuiceScene({ autoComplete: false });
    const readyIcon = fake.scene.add.rectangle(0, 0, 80, 24, 0xc0392b);
    readyIcon.setName(abilityIconGroupName(READY_ID));
    const notReadyIcon = fake.scene.add.rectangle(0, 0, 80, 24, 0xc0392b);
    notReadyIcon.setName(abilityIconGroupName(NOT_READY_ID));

    const playPromise = cooldownReady.play(fake.scene, cooldownsTickedTarget(), {});

    expect(fake.recordedTweens).toHaveLength(1);
    const legs = fake.recordedTweens[0]?.config['tweens'] as Array<Record<string, unknown>>;
    expect(legs.map((leg) => leg['scale'])).toEqual([1.15, 1]);
    expect(fake.recordedTweens[0]?.targets).toBe(readyIcon);

    fake.completeTween(0);
    await playPromise;
  });

  it('ninguna entrada con remaining === 0: ninguna llamada a scene.tweens.chain', async () => {
    const fake = createFakeJuiceScene();
    const target: JuiceTarget = {
      event: {
        type: 'COOLDOWNS_TICKED',
        side: 'LEADER',
        cooldowns: [{ abilityId: NOT_READY_ID, side: 'LEADER', baseCooldown: 3, remaining: 2 }],
      },
    };

    await cooldownReady.play(fake.scene, target, {});

    expect(fake.recordedTweens).toHaveLength(0);
  });

  it('game object inexistente para un abilityId con remaining === 0: no lanza error, la Promise resuelve igualmente', async () => {
    const fake = createFakeJuiceScene();
    const target: JuiceTarget = {
      event: {
        type: 'COOLDOWNS_TICKED',
        side: 'LEADER',
        cooldowns: [{ abilityId: READY_ID, side: 'LEADER', baseCooldown: 1, remaining: 0 }],
      },
    };

    await expect(cooldownReady.play(fake.scene, target, {})).resolves.toBeUndefined();
    expect(fake.recordedTweens).toHaveLength(0);
  });

  it('evento de tipo distinto de COOLDOWNS_TICKED: no-op inmediato', async () => {
    const fake = createFakeJuiceScene();
    const target: JuiceTarget = {
      focusId: 'leader',
      event: {
        type: 'TURN_ENDED',
        previousTurnOwner: 'LEADER',
        nextTurnOwner: 'ENEMY',
        turnNumber: 1,
      },
    };

    await expect(cooldownReady.play(fake.scene, target, {})).resolves.toBeUndefined();
    expect(fake.recordedTweens).toHaveLength(0);
  });
});
