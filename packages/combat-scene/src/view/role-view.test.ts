// @vitest-environment node
//
// H2.11 spec §5.2 — `role-view.test.ts`: resaltado persistente de umbral de Trama en
// `createScenarioRoleView` (`update()` idempotente, mismo criterio que el resto de `BoardView`).
import { describe, it, expect } from 'vitest';
import { createScenarioRoleView } from './role-view';
import { createFakeBoardScene } from './test-utils/fake-board-scene';
import { createMockSnapshot } from './test-utils/mock-snapshot';
import type { BoardViewContext } from './board-view-context';

const SCENARIO_COLOR = 0x8e44ad;
const SCENARIO_ALERT_COLOR = 0xc0392b;

function createMockContext(overrides: Partial<BoardViewContext> = {}): BoardViewContext {
  return {
    nameLookup: { abilityName: (id) => `ability:${id}`, cardName: (id) => `card:${id}` },
    leaderMaxHealth: 30,
    enemyMaxHealth: 40,
    scenarioPlotDefeatThreshold: 10,
    leaderCardPool: [],
    leaderAbilities: [],
    enemyAbilities: [],
    ...overrides,
  };
}

describe('createScenarioRoleView — resaltado de umbral de Trama (H2.11)', () => {
  it('scenarioPlot < scenarioPlotDefeatThreshold: fillColor permanece en SCENARIO_COLOR (violeta)', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const view = createScenarioRoleView(scene);
    const ctx = createMockContext({ scenarioPlotDefeatThreshold: 10 });

    view.update(createMockSnapshot({ scenarioPlot: 5 }), ctx);

    const rect = rectangles.find((r) => r.name === 'scenario')!;
    expect(rect.fillColor).toBe(SCENARIO_COLOR);
  });

  it('scenarioPlot >= scenarioPlotDefeatThreshold: fillColor cambia a SCENARIO_ALERT_COLOR (rojo)', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const view = createScenarioRoleView(scene);
    const ctx = createMockContext({ scenarioPlotDefeatThreshold: 10 });

    view.update(createMockSnapshot({ scenarioPlot: 10 }), ctx);

    const rect = rectangles.find((r) => r.name === 'scenario')!;
    expect(rect.fillColor).toBe(SCENARIO_ALERT_COLOR);
  });

  it('dos llamadas consecutivas con el mismo snapshot en umbral: mismo color ambas veces (idempotencia)', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const view = createScenarioRoleView(scene);
    const ctx = createMockContext({ scenarioPlotDefeatThreshold: 10 });
    const snapshot = createMockSnapshot({ scenarioPlot: 12 });

    view.update(snapshot, ctx);
    const rect = rectangles.find((r) => r.name === 'scenario')!;
    expect(rect.fillColor).toBe(SCENARIO_ALERT_COLOR);

    view.update(snapshot, ctx);
    expect(rect.fillColor).toBe(SCENARIO_ALERT_COLOR);
  });

  it('transición: por debajo del umbral y luego en umbral, cambia de violeta a rojo entre llamadas', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const view = createScenarioRoleView(scene);
    const ctx = createMockContext({ scenarioPlotDefeatThreshold: 10 });

    view.update(createMockSnapshot({ scenarioPlot: 3 }), ctx);
    const rect = rectangles.find((r) => r.name === 'scenario')!;
    expect(rect.fillColor).toBe(SCENARIO_COLOR);

    view.update(createMockSnapshot({ scenarioPlot: 10 }), ctx);
    expect(rect.fillColor).toBe(SCENARIO_ALERT_COLOR);
  });
});
