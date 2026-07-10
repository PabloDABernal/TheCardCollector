// @vitest-environment node
//
// H2.5 spec §5 — `card-flip.test.ts`.
import { describe, it, expect } from 'vitest';
import { createId } from '@collector/domain-shared';
import type { CardId, CardInstanceId, DramaturgiaCardId } from '@collector/domain-shared';
import type { CombatEvent } from '@collector/combat-bridge';
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

function cardPlayedTarget(): JuiceTarget {
  return {
    event: { type: 'CARD_PLAYED', cardId: 'card-1' as CardId, sourceId: 'source-2', leaderEnergyAfter: 2 },
    focusId: 'source-2',
  };
}

function contratiempoPlayedTarget(): JuiceTarget {
  const event: Extract<CombatEvent, { type: 'CONTRATIEMPO_PLAYED' }> = {
    type: 'CONTRATIEMPO_PLAYED',
    cardId: 'card-2' as CardId,
    sourceId: 'source-3',
    undoScope: 'DAMAGE_ONLY',
    energySpent: 0,
    leaderEnergyAfter: 2,
    revertedEntries: [],
    leaderDamageAfter: 0,
    leaderShieldAfter: 0,
    scenarioPlotAfter: 0,
  };
  return { event, focusId: 'source-3' };
}

describe('cardFlip', () => {
  it.each([
    ['CARD_PLAYED', cardPlayedTarget],
    ['CONTRATIEMPO_PLAYED', contratiempoPlayedTarget],
  ])(
    'H4 spec §8 fix: %s trae focusId definido pero el placeholder SÍ debe destruirse al terminar el flip (evita el tile fantasma pegado al Líder)',
    async (_label, buildTarget) => {
      const fake = createFakeJuiceScene();
      const target = buildTarget();

      await cardFlip.play(fake.scene, target, {});

      const placeholder = fake.scene.children.getByName(target.focusId as string) as unknown as {
        destroyed: boolean;
      };
      expect(placeholder.destroyed).toBe(true);
    },
  );

  it('ALLY_ENTERED_PLAY (persiste en mesa) sigue SIN destruirse tras el flip — regresión del fix §8', async () => {
    const fake = createFakeJuiceScene();
    const target = allyEnteredPlayTarget();

    await cardFlip.play(fake.scene, target, {});

    const placeholder = fake.scene.children.getByName(ALLY_INSTANCE_ID) as unknown as {
      destroyed: boolean;
    };
    expect(placeholder.destroyed).toBe(false);
  });

  it('registra un único tweens.chain con dos tramos scaleX (1→0 y 0→1)', async () => {
    const fake = createFakeJuiceScene();
    await cardFlip.play(fake.scene, allyEnteredPlayTarget(), {});

    expect(fake.recordedTweens).toHaveLength(1);
    const legs = fake.recordedTweens[0]?.config['tweens'] as Array<Record<string, unknown>>;
    expect(legs).toHaveLength(2);
    expect(legs[0]).toMatchObject({ scaleX: 0, duration: 150, ease: 'Sine.easeIn' });
    expect(legs[1]).toMatchObject({ scaleX: 1, duration: 150, ease: 'Sine.easeOut' });
  });

  it('invoca el callback de cambio de aspecto en el punto medio, y restaura el color original al terminar el flip completo (FIX QA — el tile no debe quedar en blanco permanente)', () => {
    const fake = createFakeJuiceScene({ autoComplete: false });
    const target = allyEnteredPlayTarget();

    void cardFlip.play(fake.scene, target, {});

    const placeholder = fake.scene.children.getByName(ALLY_INSTANCE_ID) as unknown as {
      fillColor: number;
      setFillStyle(color?: number, alpha?: number): unknown;
    };
    const originalColor = placeholder.fillColor;

    // Espía `setFillStyle` para observar CADA cambio de color por separado — `fake.completeTween`
    // dispara los dos tramos del chain Y el `onComplete` final en la misma llamada síncrona (no
    // simula el retraso real de 150ms entre tramos de Phaser), así que inspeccionar solo el
    // `fillColor` final no distinguiría el toggle de punto medio de la restauración de cierre.
    const colorsSet: number[] = [];
    const realSetFillStyle = placeholder.setFillStyle.bind(placeholder);
    placeholder.setFillStyle = (color?: number, alpha?: number) => {
      if (color !== undefined) colorsSet.push(color);
      return realSetFillStyle(color, alpha);
    };

    fake.completeTween(0);

    // 1ª llamada = punto medio del flip ("cambia de aspecto", distinto del original).
    expect(colorsSet[0]).not.toBe(originalColor);
    // 2ª llamada = cierre del flip completo: restaura el color de partida — el tile no debe
    // quedarse fijado en el color de "punto medio" (blanco) para siempre.
    expect(placeholder.fillColor).toBe(originalColor);
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
      event: { type: 'DRAMATURGIA_CARD_DRAWN', icon: 'ATTACK', cardId: 'dramaturgia-test' as DramaturgiaCardId },
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
