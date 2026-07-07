// @vitest-environment node
//
// H2.10 spec §5.2 — `cooldown-ready.test.ts`, mismo patrón que `hit-impact.test.ts`.
// Fix H2.10 (bug reportado por Reviewer): la receta ya no pulsa en TODA entrada con
// `remaining === 0` del snapshot completo de `COOLDOWNS_TICKED` — solo en la transición real
// `remaining > 0 -> remaining === 0`, usando el estado previo que guarda `createCooldownReadyRecipe`
// en su closure. Cada test crea su propia instancia vía `createCooldownReadyRecipe()` para no
// compartir el `Map` de estado previo entre casos.
import { describe, it, expect } from 'vitest';
import { createId } from '@collector/domain-shared';
import type { AbilityId } from '@collector/domain-shared';
import { createFakeJuiceScene } from './test-utils/fake-juice-scene';
import { createCooldownReadyRecipe } from './cooldown-ready';
import { abilityIconGroupName } from '../../view/ability-cooldown-view';
import type { JuiceTarget } from '../juice-recipe';

function abilityId(value: string): AbilityId {
  return createId<'AbilityId'>('AbilityId', value) as AbilityId;
}

const READY_ID = abilityId('ability-soldado-base-guardia-firme');
const NOT_READY_ID = abilityId('ability-soldado-base-arrollar');

function cooldownsTickedTarget(readyRemaining: number): JuiceTarget {
  return {
    event: {
      type: 'COOLDOWNS_TICKED',
      side: 'LEADER',
      cooldowns: [
        { abilityId: READY_ID, side: 'LEADER', baseCooldown: 1, remaining: readyRemaining },
        { abilityId: NOT_READY_ID, side: 'LEADER', baseCooldown: 3, remaining: 2 },
      ],
    },
  };
}

describe('cooldownReady', () => {
  it('transición real remaining>0 -> remaining=0: pulso de escala solo sobre el game object de esa habilidad', async () => {
    const recipe = createCooldownReadyRecipe();
    const fake = createFakeJuiceScene({ autoComplete: false });
    const readyIcon = fake.scene.add.rectangle(0, 0, 80, 24, 0xc0392b);
    readyIcon.setName(abilityIconGroupName(READY_ID));
    const notReadyIcon = fake.scene.add.rectangle(0, 0, 80, 24, 0xc0392b);
    notReadyIcon.setName(abilityIconGroupName(NOT_READY_ID));

    // Tick previo: READY_ID todavía en CD (remaining=1), registra el estado inicial.
    await recipe.play(fake.scene, cooldownsTickedTarget(1), {});
    expect(fake.recordedTweens).toHaveLength(0);

    // Tick siguiente: READY_ID acaba de llegar a remaining=0 -> transición real, sí pulsa.
    const playPromise = recipe.play(fake.scene, cooldownsTickedTarget(0), {});

    expect(fake.recordedTweens).toHaveLength(1);
    const legs = fake.recordedTweens[0]?.config['tweens'] as Array<Record<string, unknown>>;
    expect(legs.map((leg) => leg['scale'])).toEqual([1.15, 1]);
    expect(fake.recordedTweens[0]?.targets).toBe(readyIcon);

    fake.completeTween(0);
    await playPromise;
  });

  it('(a) habilidad que YA estaba en remaining=0 en el tick anterior: no vuelve a pulsar (fix del bug)', async () => {
    const recipe = createCooldownReadyRecipe();
    const fake = createFakeJuiceScene();
    const readyIcon = fake.scene.add.rectangle(0, 0, 80, 24, 0xc0392b);
    readyIcon.setName(abilityIconGroupName(READY_ID));

    // Primer tick: READY_ID ya llega en remaining=0 (sin estado previo) -> no pulsa (spec (c)).
    await recipe.play(fake.scene, cooldownsTickedTarget(0), {});
    expect(fake.recordedTweens).toHaveLength(0);

    // Segundo, tercer... tick: READY_ID sigue en remaining=0, sin usarse -> NO debe volver a pulsar.
    await recipe.play(fake.scene, cooldownsTickedTarget(0), {});
    expect(fake.recordedTweens).toHaveLength(0);

    await recipe.play(fake.scene, cooldownsTickedTarget(0), {});
    expect(fake.recordedTweens).toHaveLength(0);
  });

  it('(b) habilidad que pasa de remaining>0 a remaining=0: sí pulsa (ya cubierto arriba, caso explícito adicional con varios pasos)', async () => {
    const recipe = createCooldownReadyRecipe();
    const fake = createFakeJuiceScene();
    const readyIcon = fake.scene.add.rectangle(0, 0, 80, 24, 0xc0392b);
    readyIcon.setName(abilityIconGroupName(READY_ID));

    await recipe.play(fake.scene, cooldownsTickedTarget(2), {});
    expect(fake.recordedTweens).toHaveLength(0);

    await recipe.play(fake.scene, cooldownsTickedTarget(1), {});
    expect(fake.recordedTweens).toHaveLength(0);

    await recipe.play(fake.scene, cooldownsTickedTarget(0), {});
    expect(fake.recordedTweens).toHaveLength(1);
  });

  it('(c) primera vez que se ve una habilidad con remaining=0 (sin estado previo): no pulsa, solo registra el estado inicial', async () => {
    const recipe = createCooldownReadyRecipe();
    const fake = createFakeJuiceScene();
    const readyIcon = fake.scene.add.rectangle(0, 0, 80, 24, 0xc0392b);
    readyIcon.setName(abilityIconGroupName(READY_ID));

    await recipe.play(fake.scene, cooldownsTickedTarget(0), {});
    expect(fake.recordedTweens).toHaveLength(0);
  });

  it('ninguna entrada con remaining === 0: ninguna llamada a scene.tweens.chain', async () => {
    const recipe = createCooldownReadyRecipe();
    const fake = createFakeJuiceScene();
    const target: JuiceTarget = {
      event: {
        type: 'COOLDOWNS_TICKED',
        side: 'LEADER',
        cooldowns: [{ abilityId: NOT_READY_ID, side: 'LEADER', baseCooldown: 3, remaining: 2 }],
      },
    };

    await recipe.play(fake.scene, target, {});

    expect(fake.recordedTweens).toHaveLength(0);
  });

  it('game object inexistente para un abilityId en transición a remaining === 0: no lanza error, la Promise resuelve igualmente', async () => {
    const recipe = createCooldownReadyRecipe();
    const fake = createFakeJuiceScene();
    const targetNotReady: JuiceTarget = {
      event: {
        type: 'COOLDOWNS_TICKED',
        side: 'LEADER',
        cooldowns: [{ abilityId: READY_ID, side: 'LEADER', baseCooldown: 1, remaining: 1 }],
      },
    };
    const targetReady: JuiceTarget = {
      event: {
        type: 'COOLDOWNS_TICKED',
        side: 'LEADER',
        cooldowns: [{ abilityId: READY_ID, side: 'LEADER', baseCooldown: 1, remaining: 0 }],
      },
    };

    await recipe.play(fake.scene, targetNotReady, {});
    await expect(recipe.play(fake.scene, targetReady, {})).resolves.toBeUndefined();
    expect(fake.recordedTweens).toHaveLength(0);
  });

  it('evento de tipo distinto de COOLDOWNS_TICKED: no-op inmediato', async () => {
    const recipe = createCooldownReadyRecipe();
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

    await expect(recipe.play(fake.scene, target, {})).resolves.toBeUndefined();
    expect(fake.recordedTweens).toHaveLength(0);
  });
});
