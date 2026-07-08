import { describe, it, expect } from 'vitest';
import type { NameLookup } from '@collector/domain-catalog';
import { createBoardView } from './board-view';
import { FOCUS_ID_LEADER, FOCUS_ID_ENEMY, FOCUS_ID_SCENARIO } from '../juice';
import { PLACEHOLDER_POSITIONS } from '../juice/recipes/placeholder';
import { cardTileName } from './card-hand-view';
import { NUCLEO_COLOR_HEX } from './nucleo-colors';
import { createFakeBoardScene } from './test-utils/fake-board-scene';
import { createMockSnapshot, mockCardId, mockCardInstanceId, mockNucleoInstanceId } from './test-utils/mock-snapshot';
import type { BoardViewContext } from './board-view-context';

const fakeNameLookup: NameLookup = {
  abilityName: (id) => `ability:${id}`,
  cardName: (id) => `card:${id}`,
};

function createMockContext(overrides: Partial<BoardViewContext> = {}): BoardViewContext {
  return {
    nameLookup: fakeNameLookup,
    leaderMaxHealth: 30,
    enemyMaxHealth: 40,
    scenarioPlotDefeatThreshold: 10,
    leaderCardPool: [
      { cardId: mockCardId('card-cheap'), name: 'Carta Barata', energyCost: 1, cardType: 'EVENTO', requiresNucleoInstance: false },
      { cardId: mockCardId('card-expensive'), name: 'Carta Cara', energyCost: 5, cardType: 'EQUIPO', requiresNucleoInstance: false },
    ],
    leaderAbilities: [],
    enemyAbilities: [],
    ...overrides,
  };
}

describe('BoardView — render (H2.8)', () => {
  it('crea exactamente un tile por NucleoInstance del pool, con targetId y color reales', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const ctx = createMockContext();
    const boardView = createBoardView(scene, ctx);

    const snapshot = createMockSnapshot({
      nucleoPool: [
        { id: mockNucleoInstanceId('n1'), color: 'AGRESION', value: 3 },
        { id: mockNucleoInstanceId('n2'), color: 'DEFENSA', value: 2 },
      ],
    });

    boardView.render(snapshot);

    const dieRects = rectangles.filter((r) => r.getData('targetId') === 'n1' || r.getData('targetId') === 'n2');
    expect(dieRects).toHaveLength(2);

    const n1Rect = rectangles.find((r) => r.getData('targetId') === 'n1')!;
    expect(n1Rect.fillColor).toBe(NUCLEO_COLOR_HEX.AGRESION);
    const n2Rect = rectangles.find((r) => r.getData('targetId') === 'n2')!;
    expect(n2Rect.fillColor).toBe(NUCLEO_COLOR_HEX.DEFENSA);
  });

  it('crea los 3 roles con name = FOCUS_ID_LEADER/ENEMY/SCENARIO en las posiciones de PLACEHOLDER_POSITIONS', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const ctx = createMockContext();
    const boardView = createBoardView(scene, ctx);
    boardView.render(createMockSnapshot());

    const leaderRect = rectangles.find((r) => r.name === FOCUS_ID_LEADER);
    const enemyRect = rectangles.find((r) => r.name === FOCUS_ID_ENEMY);
    const scenarioRect = rectangles.find((r) => r.name === FOCUS_ID_SCENARIO);

    expect(leaderRect).toBeDefined();
    expect(leaderRect!.x).toBe(PLACEHOLDER_POSITIONS.leader!.x);
    expect(leaderRect!.y).toBe(PLACEHOLDER_POSITIONS.leader!.y);

    expect(enemyRect).toBeDefined();
    expect(enemyRect!.x).toBe(PLACEHOLDER_POSITIONS.enemy!.x);
    expect(enemyRect!.y).toBe(PLACEHOLDER_POSITIONS.enemy!.y);

    expect(scenarioRect).toBeDefined();
    expect(scenarioRect!.x).toBe(PLACEHOLDER_POSITIONS.scenario!.x);
    expect(scenarioRect!.y).toBe(PLACEHOLDER_POSITIONS.scenario!.y);
  });

  it('render() llamado dos veces con el mismo snapshot no duplica roles ni tiles de mano; el pool de Núcleos conserva la misma referencia (H2.12: ya no se recrea si el id se mantiene)', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const ctx = createMockContext();
    const boardView = createBoardView(scene, ctx);

    const snapshot = createMockSnapshot({
      nucleoPool: [{ id: mockNucleoInstanceId('n1'), color: 'CAOS', value: 4 }],
    });

    boardView.render(snapshot);
    const rolesAfterFirst = rectangles.filter(
      (r) => r.name === FOCUS_ID_LEADER || r.name === FOCUS_ID_ENEMY || r.name === FOCUS_ID_SCENARIO,
    );
    const handTilesAfterFirst = rectangles.filter(
      (r) => r.name === cardTileName(ctx.leaderCardPool[0]!.cardId) || r.name === cardTileName(ctx.leaderCardPool[1]!.cardId),
    );
    const nucleoRectsAfterFirst = rectangles.filter((r) => r.getData('targetId') === 'n1' && !r.destroyed);

    boardView.render(snapshot);

    const rolesAfterSecond = rectangles.filter(
      (r) => r.name === FOCUS_ID_LEADER || r.name === FOCUS_ID_ENEMY || r.name === FOCUS_ID_SCENARIO,
    );
    const handTilesAfterSecond = rectangles.filter(
      (r) => r.name === cardTileName(ctx.leaderCardPool[0]!.cardId) || r.name === cardTileName(ctx.leaderCardPool[1]!.cardId),
    );
    const nucleoRectsAlive = rectangles.filter((r) => r.getData('targetId') === 'n1' && !r.destroyed);

    expect(rolesAfterSecond).toHaveLength(rolesAfterFirst.length);
    expect(rolesAfterSecond).toHaveLength(3);
    expect(handTilesAfterSecond).toHaveLength(handTilesAfterFirst.length);
    expect(handTilesAfterSecond).toHaveLength(2);

    // H2.12 §1.5: un id presente en ambos snapshots CONSERVA la misma referencia — nunca se
    // destruye/recrea (contrato invertido respecto a H2.8, que destruía-y-recreaba siempre).
    expect(nucleoRectsAfterFirst).toHaveLength(1);
    expect(nucleoRectsAlive).toHaveLength(1);
    expect(nucleoRectsAlive[0]).toBe(nucleoRectsAfterFirst[0]);
  });

  it('H2.12: render() con pool [n1] y luego pool [] (n1 retirado) anima fade+shrink antes de destruir — n1 sigue vivo hasta completar el tween', () => {
    const { scene, rectangles, completeTween } = createFakeBoardScene({ autoComplete: false });
    const ctx = createMockContext();
    const boardView = createBoardView(scene, ctx);

    const snapshotWithNucleo = createMockSnapshot({
      nucleoPool: [{ id: mockNucleoInstanceId('n1'), color: 'CAOS', value: 4 }],
    });
    boardView.render(snapshotWithNucleo);

    const n1Rect = rectangles.find((r) => r.getData('targetId') === 'n1')!;
    expect(n1Rect).toBeDefined();
    expect(n1Rect.destroyed).toBe(false);

    boardView.render(createMockSnapshot({ nucleoPool: [] }));

    // El tween de fade+shrink está registrado pero aún no completó — n1 sigue vivo.
    expect(n1Rect.destroyed).toBe(false);

    completeTween(0);

    expect(n1Rect.destroyed).toBe(true);
  });

  it('un AllyInPlay/MinionInPlay produce un tile con su instanceId real; un segundo render no crea un segundo tile', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const ctx = createMockContext();
    const boardView = createBoardView(scene, ctx);

    const allyInstanceId = mockCardInstanceId('ally-1');
    const minionInstanceId = mockCardInstanceId('minion-1');

    const snapshot = createMockSnapshot({
      alliesInPlay: [{ instanceId: allyInstanceId, cardId: mockCardId('ally-card'), isBerserker: false, maxLife: 10, life: 8 }],
      minionsInPlay: [
        {
          instanceId: minionInstanceId,
          definitionId: 'minion-def',
          passiveEffect: { kind: 'ATTACK', amount: 1 },
          planoAttackAmount: 1,
          isDefensor: true,
        },
      ],
    });

    boardView.render(snapshot);
    const allyRectFirst = rectangles.find((r) => r.name === allyInstanceId);
    const minionRectFirst = rectangles.find((r) => r.name === minionInstanceId);
    expect(allyRectFirst).toBeDefined();
    expect(minionRectFirst).toBeDefined();

    boardView.render(snapshot);
    const allyRectsSecond = rectangles.filter((r) => r.name === allyInstanceId);
    const minionRectsSecond = rectangles.filter((r) => r.name === minionInstanceId);

    expect(allyRectsSecond).toHaveLength(1);
    expect(allyRectsSecond[0]).toBe(allyRectFirst);
    expect(minionRectsSecond).toHaveLength(1);
    expect(minionRectsSecond[0]).toBe(minionRectFirst);
  });

  it('existe un tile de mano por cada entrada de leaderCardPool, nombrado card-{cardId}, con alpha reducido si no hay Energía suficiente', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const ctx = createMockContext();
    const boardView = createBoardView(scene, ctx);

    const cheapCard = ctx.leaderCardPool[0]!;
    const expensiveCard = ctx.leaderCardPool[1]!;

    boardView.render(createMockSnapshot({ leaderEnergy: 3 }));

    const cheapTile = rectangles.find((r) => r.name === cardTileName(cheapCard.cardId))!;
    const expensiveTile = rectangles.find((r) => r.name === cardTileName(expensiveCard.cardId))!;

    expect(cheapTile).toBeDefined();
    expect(expensiveTile).toBeDefined();
    expect(cheapTile.alpha).toBe(1);
    expect(expensiveTile.alpha).toBeLessThan(1);

    boardView.render(createMockSnapshot({ leaderEnergy: 0 }));
    expect(cheapTile.alpha).toBeLessThan(1);
    expect(expensiveTile.alpha).toBeLessThan(1);
  });

  it('el Text de cada tile de mano recibe la misma alpha que su Rectangle (fix Reviewer: opacidad inconsistente)', () => {
    const { scene, rectangles, texts } = createFakeBoardScene();
    const ctx = createMockContext();
    const boardView = createBoardView(scene, ctx);

    const cheapCard = ctx.leaderCardPool[0]!;
    const expensiveCard = ctx.leaderCardPool[1]!;

    boardView.render(createMockSnapshot({ leaderEnergy: 3 }));

    const cheapTile = rectangles.find((r) => r.name === cardTileName(cheapCard.cardId))!;
    const expensiveTile = rectangles.find((r) => r.name === cardTileName(expensiveCard.cardId))!;
    const cheapText = texts.find((t) => t.text.startsWith(cheapCard.name))!;
    const expensiveText = texts.find((t) => t.text.startsWith(expensiveCard.name))!;

    expect(cheapText).toBeDefined();
    expect(expensiveText).toBeDefined();
    expect(cheapText.alpha).toBe(cheapTile.alpha);
    expect(expensiveText.alpha).toBe(expensiveTile.alpha);
    expect(expensiveText.alpha).toBeLessThan(1);
  });
});
