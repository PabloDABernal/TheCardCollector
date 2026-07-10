import { describe, it, expect } from 'vitest';
import type { NameLookup } from '@collector/domain-catalog';
import type { NucleoDie } from '@collector/domain-combat';
import { createBoardView } from './board-view';
import { FOCUS_ID_LEADER, FOCUS_ID_ENEMY, FOCUS_ID_SCENARIO } from '../juice';
import { PLACEHOLDER_POSITIONS } from '../juice/recipes/placeholder';
import { NUCLEO_COLOR_HEX } from './nucleo-colors';
import { createFakeBoardScene } from './test-utils/fake-board-scene';
import { createMockSnapshot, mockCardId, mockCardInstanceId, mockNucleoInstanceId } from './test-utils/mock-snapshot';
import type { BoardViewContext } from './board-view-context';

const fakeNameLookup: NameLookup = {
  abilityName: (id) => `ability:${id}`,
  cardName: (id) => `card:${id}`,
  minionName: (id) => `minion:${id}`,
};

function mockDie(id: string, color: NucleoDie['color'], value: number, overrides: Partial<NucleoDie> = {}): NucleoDie {
  return { id: mockNucleoInstanceId(id), color, value, kind: 'FIXED', status: 'AVAILABLE', ...overrides };
}

function createMockContext(overrides: Partial<BoardViewContext> = {}): BoardViewContext {
  return {
    nameLookup: fakeNameLookup,
    leaderMaxHealth: 30,
    enemyMaxHealth: 40,
    scenarioPlotDefeatThreshold: 10,
    leaderCardPool: [
      { cardId: mockCardId('card-cheap'), name: 'Carta Barata', energyCost: 1, cardType: 'EVENTO', requiresNucleoInstance: false, keywords: [] },
      { cardId: mockCardId('card-expensive'), name: 'Carta Cara', energyCost: 5, cardType: 'EQUIPO', requiresNucleoInstance: false, keywords: [] },
    ],
    leaderAbilities: [],
    enemyAbilities: [],
    enemyDramaturgiaDeck: [],
    ...overrides,
  };
}

describe('BoardView — render (H2.8, migrado a nucleoTable H3)', () => {
  it('crea exactamente un tile por NucleoDie de la mesa, con targetId y color reales', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const ctx = createMockContext();
    const boardView = createBoardView(scene, ctx);

    const snapshot = createMockSnapshot({
      nucleoTable: [mockDie('n1', 'AGRESION', 3), mockDie('n2', 'DEFENSA', 2)],
    });

    boardView.render(snapshot);

    const n1Id = String(mockNucleoInstanceId('n1'));
    const n2Id = String(mockNucleoInstanceId('n2'));
    const dieRects = rectangles.filter((r) => r.getData('targetId') === n1Id || r.getData('targetId') === n2Id);
    expect(dieRects).toHaveLength(2);

    const n1Rect = rectangles.find((r) => r.getData('targetId') === n1Id)!;
    expect(n1Rect.fillColor).toBe(NUCLEO_COLOR_HEX.AGRESION);
    const n2Rect = rectangles.find((r) => r.getData('targetId') === n2Id)!;
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

  it('render() llamado dos veces con el mismo snapshot no duplica roles; la mesa de Núcleos conserva la misma referencia (H3: los dados nunca se destruyen/recrean)', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const ctx = createMockContext();
    const boardView = createBoardView(scene, ctx);

    const snapshot = createMockSnapshot({
      nucleoTable: [mockDie('n1', 'CAOS', 4)],
      leaderHand: [ctx.leaderCardPool[0]!.cardId, ctx.leaderCardPool[1]!.cardId],
    });

    boardView.render(snapshot);
    const rolesAfterFirst = rectangles.filter(
      (r) => r.name === FOCUS_ID_LEADER || r.name === FOCUS_ID_ENEMY || r.name === FOCUS_ID_SCENARIO,
    );
    const n1Id = String(mockNucleoInstanceId('n1'));
    const nucleoRectsAfterFirst = rectangles.filter((r) => r.getData('targetId') === n1Id && !r.destroyed);

    boardView.render(snapshot);

    const rolesAfterSecond = rectangles.filter(
      (r) => r.name === FOCUS_ID_LEADER || r.name === FOCUS_ID_ENEMY || r.name === FOCUS_ID_SCENARIO,
    );
    const nucleoRectsAlive = rectangles.filter((r) => r.getData('targetId') === n1Id && !r.destroyed);

    expect(rolesAfterSecond).toHaveLength(rolesAfterFirst.length);
    expect(rolesAfterSecond).toHaveLength(3);

    expect(nucleoRectsAfterFirst).toHaveLength(1);
    expect(nucleoRectsAlive).toHaveLength(1);
    expect(nucleoRectsAlive[0]).toBe(nucleoRectsAfterFirst[0]);
  });

  it('H3.4: gastar un dado (AVAILABLE→SPENT) lo atenúa (alpha reducido) SIN destruirlo — nunca sale de mesa', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const ctx = createMockContext();
    const boardView = createBoardView(scene, ctx);

    boardView.render(createMockSnapshot({ nucleoTable: [mockDie('n1', 'CAOS', 4)] }));
    const n1Id = String(mockNucleoInstanceId('n1'));
    const n1Rect = rectangles.find((r) => r.getData('targetId') === n1Id)!;
    expect(n1Rect.alpha).toBe(1);

    boardView.render(createMockSnapshot({ nucleoTable: [mockDie('n1', 'CAOS', 4, { status: 'SPENT' })] }));

    expect(n1Rect.destroyed).toBe(false);
    expect(n1Rect.alpha).toBeLessThan(1);
  });

  it('H3.4: un reroll (valor cambia) reproduce un tween de angle/scale sobre el sprite persistente', () => {
    const { scene, rectangles, recordedTweens } = createFakeBoardScene();
    const ctx = createMockContext();
    const boardView = createBoardView(scene, ctx);

    boardView.render(createMockSnapshot({ nucleoTable: [mockDie('n1', 'CAOS', 4, { status: 'SPENT' })] }));
    const tweensBeforeReroll = recordedTweens.length;

    boardView.render(createMockSnapshot({ nucleoTable: [mockDie('n1', 'CAOS', 2, { status: 'AVAILABLE' })] }));

    const n1Id = String(mockNucleoInstanceId('n1'));
    const n1Rect = rectangles.find((r) => r.getData('targetId') === n1Id)!;
    expect(n1Rect.destroyed).toBe(false);
    expect(n1Rect.alpha).toBe(1);
    expect(recordedTweens.length).toBeGreaterThan(tweensBeforeReroll);
  });

  it('H3.4: un dado EXTRA añadido tras el primer render crea un tile nuevo (spawn), sin tocar los ya existentes', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const ctx = createMockContext();
    const boardView = createBoardView(scene, ctx);

    boardView.render(createMockSnapshot({ nucleoTable: [mockDie('n1', 'CAOS', 4)] }));
    boardView.render(
      createMockSnapshot({
        nucleoTable: [mockDie('n1', 'CAOS', 4), mockDie('n2', 'CAOS', 1, { kind: 'EXTRA' })],
      }),
    );

    const n2Id = String(mockNucleoInstanceId('n2'));
    const n2Rect = rectangles.find((r) => r.getData('targetId') === n2Id);
    expect(n2Rect).toBeDefined();
    expect(n2Rect!.destroyed).toBe(false);
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
          maxLife: 5,
          life: 5,
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

  // H4 spec §6 — los tests de "tile de mano" (Rectangle/Text de Phaser por carta) se retiran: la
  // mano migró por completo a HTML (`HandCardRow.tsx`/`CardTile.tsx`, `apps/shell`), fuera del
  // árbol de renderizado de `BoardView`/Phaser. Fix Reviewer post-H4: la cobertura equivalente
  // (afordabilidad por Energía/alpha reducido, ruleText, keywords, ciclo de exit-animation al jugar
  // una carta) vive ahora en `apps/shell/src/combat/card/HandCardRow.test.tsx` (React Testing
  // Library) — confirmada real, no solo referenciada en comentario.
});
