// @vitest-environment node
//
// H2.5 spec §5 — `card-flip.test.ts`.
import { describe, it, expect } from 'vitest';
import { createId } from '@collector/domain-shared';
import type { CardId, CardInstanceId } from '@collector/domain-shared';
import { createFakeJuiceScene } from './test-utils/fake-juice-scene';
import { cardFlip } from './card-flip';
import type { JuiceTarget } from '../juice-recipe';

const ALLY_INSTANCE_ID = createId<'CardInstanceId'>('CardInstanceId', 'ally-1') as CardInstanceId;
const ALLY_CARD_ID = createId<'CardId'>('CardId', 'ally-card-1') as CardId;

function allyEnteredPlayTarget(): JuiceTarget {
  return {
    event: {
      type: 'ALLY_ENTERED_PLAY',
      cardId: ALLY_CARD_ID,
      sourceId: 'source-1',
      allyInstanceId: ALLY_INSTANCE_ID,
      maxLife: 5,
      isBerserker: false,
      leaderEnergyAfter: 3,
    },
    focusId: ALLY_INSTANCE_ID,
  };
}

describe('cardFlip', () => {
  it('registra un único tweens.chain con dos tramos scaleX (1→0 y 0→1)', async () => {
    const fake = createFakeJuiceScene();
    await cardFlip.play(fake.scene, allyEnteredPlayTarget(), {});

    expect(fake.recordedTweens).toHaveLength(1);
    const legs = fake.recordedTweens[0]?.config['tweens'] as Array<Record<string, unknown>>;
    expect(legs).toHaveLength(2);
    expect(legs[0]).toMatchObject({ scaleX: 0, duration: 150, ease: 'Sine.easeIn' });
    expect(legs[1]).toMatchObject({ scaleX: 1, duration: 150, ease: 'Sine.easeOut' });
  });

  it('invoca el callback de cambio de aspecto entre ambos tramos (orden verificado a mano)', () => {
    const fake = createFakeJuiceScene({ autoComplete: false });
    const target = allyEnteredPlayTarget();

    void cardFlip.play(fake.scene, target, {});

    const placeholder = fake.scene.children.getByName(ALLY_INSTANCE_ID) as unknown as {
      fillColor: number;
    };
    const colorBeforeMidpoint = placeholder.fillColor;

    fake.completeTween(0);

    expect(placeholder.fillColor).not.toBe(colorBeforeMidpoint);
  });

  it('reuso: llamar play() dos veces con el mismo focusId no crea dos placeholders distintos', async () => {
    const fake = createFakeJuiceScene();
    const target = allyEnteredPlayTarget();

    await cardFlip.play(fake.scene, target, {});
    const first = fake.scene.children.getByName(ALLY_INSTANCE_ID);

    await cardFlip.play(fake.scene, target, {});
    const second = fake.scene.children.getByName(ALLY_INSTANCE_ID);

    expect(second).toBe(first);
  });

  it('sin focusId (DRAMATURGIA_CARD_DRAWN): destruye el placeholder efímero al terminar el flip, sin acumular huérfanos entre disparos repetidos', async () => {
    const fake = createFakeJuiceScene();
    const target: JuiceTarget = {
      event: { type: 'DRAMATURGIA_CARD_DRAWN', icon: 'ATTACK' },
    };

    await cardFlip.play(fake.scene, target, {});
    const firstRectangle = fake.recordedTweens[0]?.targets;

    await cardFlip.play(fake.scene, target, {});
    const secondRectangle = fake.recordedTweens[1]?.targets;

    expect(firstRectangle).toBeDefined();
    expect(secondRectangle).toBeDefined();
    // Cada disparo crea (y destruye) su propio placeholder efímero — nunca se reutiliza por
    // nombre porque nunca se le asigna uno (sin focusId no hay bajo qué nombre buscarlo).
    expect(secondRectangle).not.toBe(firstRectangle);
    expect((firstRectangle as { destroyed: boolean }).destroyed).toBe(true);
    expect((secondRectangle as { destroyed: boolean }).destroyed).toBe(true);
  });
});
