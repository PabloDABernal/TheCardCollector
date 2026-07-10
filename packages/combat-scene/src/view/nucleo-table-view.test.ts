// NUEVO H3 (spec §5.2) — `nucleo-table-view.test.ts`: sustituye a `nucleo-pool-view.test.ts`
// (retirado con el modelo viejo). Verifica el contrato de mesa PERSISTENTE: primer render sin
// animación, gasto de un dado (dim, nunca destruido), reroll (tween sobre el sprite real) y dado
// EXTRA añadido (spawn, sin tocar los ya existentes).
import { describe, it, expect } from 'vitest';
import type { NucleoDie } from '@collector/domain-combat';
import { createNucleoTable } from './nucleo-table-view';
import { createFakeBoardScene } from './test-utils/fake-board-scene';
import { createMockSnapshot, mockNucleoInstanceId } from './test-utils/mock-snapshot';
import { NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR, NUCLEO_TILE_HALF_PX, CONTENT_BOXES_TOP_TO_BOTTOM } from './board-layout';

function mockDie(id: string, color: NucleoDie['color'], value: number, overrides: Partial<NucleoDie> = {}): NucleoDie {
  return { id: mockNucleoInstanceId(id), color, value, kind: 'FIXED', status: 'AVAILABLE', ...overrides };
}

describe('createNucleoTable (H3, spec §5.2)', () => {
  it('primer render: crea un tile por NucleoDie, sin ningún tween registrado', () => {
    const { scene, rectangles, texts, recordedTweens } = createFakeBoardScene();
    const table = [mockDie('n1', 'AGRESION', 2), mockDie('n2', 'DEFENSA', 3)];
    const view = createNucleoTable(scene, table);

    const n1Id = String(mockNucleoInstanceId('n1'));
    const n2Id = String(mockNucleoInstanceId('n2'));
    expect(rectangles.find((r) => r.getData('targetId') === n1Id)).toBeDefined();
    expect(rectangles.find((r) => r.getData('targetId') === n2Id)).toBeDefined();
    expect(texts).toHaveLength(2);
    expect(recordedTweens).toHaveLength(0);
    expect(view.getDieObject(mockNucleoInstanceId('n1'))).toBeDefined();
  });

  it('contrato de decoración redondeada (review post-marco-redondeado): cada dado expone data.highlightRadius y crea 3 Graphics decorativos (sombra, máscara, borde)', () => {
    const { scene, rectangles, graphicsObjects } = createFakeBoardScene();
    createNucleoTable(scene, [mockDie('n1', 'AGRESION', 2)]);

    const n1Id = String(mockNucleoInstanceId('n1'));
    const n1Rect = rectangles.find((r) => r.getData('targetId') === n1Id)!;
    expect(n1Rect.getData('highlightRadius')).toBe(10);
    expect(graphicsObjects).toHaveLength(3);
  });

  it('gastar un dado (AVAILABLE→SPENT) vía syncFromSnapshot lo atenúa sin destruirlo', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const view = createNucleoTable(scene, []);

    view.syncFromSnapshot(createMockSnapshot({ nucleoTable: [mockDie('n1', 'CAOS', 4)] }));
    const n1Id = String(mockNucleoInstanceId('n1'));
    const n1Rect = rectangles.find((r) => r.getData('targetId') === n1Id)!;
    expect(n1Rect.alpha).toBe(1);

    view.syncFromSnapshot(createMockSnapshot({ nucleoTable: [mockDie('n1', 'CAOS', 4, { status: 'SPENT' })] }));

    expect(n1Rect.destroyed).toBe(false);
    expect(n1Rect.alpha).toBeLessThan(1);
  });

  it('reroll (valor cambia) reproduce un tween de angle/scale y restaura alpha a 1', () => {
    const { scene, rectangles, recordedTweens } = createFakeBoardScene();
    const view = createNucleoTable(scene, []);

    view.syncFromSnapshot(createMockSnapshot({ nucleoTable: [mockDie('n1', 'CAOS', 4, { status: 'SPENT' })] }));
    const before = recordedTweens.length;

    view.syncFromSnapshot(createMockSnapshot({ nucleoTable: [mockDie('n1', 'CAOS', 2, { status: 'AVAILABLE' })] }));

    const n1Id = String(mockNucleoInstanceId('n1'));
    const n1Rect = rectangles.find((r) => r.getData('targetId') === n1Id)!;
    expect(n1Rect.alpha).toBe(1);
    expect(recordedTweens.length).toBeGreaterThan(before);
    const rollTween = recordedTweens[recordedTweens.length - 1]!;
    expect(rollTween.config['scale']).toEqual({ from: 1.2, to: 1 });
  });

  it('un dado EXTRA añadido tras el primer render crea un tile nuevo con animación, sin tocar los existentes', () => {
    const { scene, rectangles, recordedTweens } = createFakeBoardScene();
    const view = createNucleoTable(scene, []);

    view.syncFromSnapshot(createMockSnapshot({ nucleoTable: [mockDie('n1', 'CAOS', 4)] }));
    const n1Id = String(mockNucleoInstanceId('n1'));
    const n1RectBefore = rectangles.find((r) => r.getData('targetId') === n1Id)!;

    view.syncFromSnapshot(
      createMockSnapshot({
        nucleoTable: [mockDie('n1', 'CAOS', 4), mockDie('n2', 'CAOS', 1, { kind: 'EXTRA' })],
      }),
    );

    const n2Id = String(mockNucleoInstanceId('n2'));
    const n2Rect = rectangles.find((r) => r.getData('targetId') === n2Id);
    expect(n2Rect).toBeDefined();
    expect(n2Rect!.destroyed).toBe(false);
    // n1 no fue tocado/recreado.
    expect(rectangles.find((r) => r.getData('targetId') === n1Id && !r.destroyed)).toBe(n1RectBefore);
    expect(recordedTweens.length).toBeGreaterThan(0);
  });

  /**
   * FIX Reviewer (hallazgo tras commit `195ecca`) — el test "gap real >= CONTENT_GAP_PX" de
   * `board-layout.test.ts` es tautológico para el peor caso de apilado EXTRA: por construcción,
   * `HAND_ROW_POSITION.y` se define como `NUCLEO_CONTENT_BOTTOM_Y + CONTENT_GAP_PX +
   * CARD_TILE_HALF_PX`, así que ese test SIEMPRE da exactamente `CONTENT_GAP_PX`, sin importar el
   * valor real de `NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR`/`NUCLEO_EXTRA_DIE_STACK_OFFSET_PX` — no
   * puede detectar una divergencia entre la fórmula de apilado REAL (`positionFor`, este archivo) y
   * la fórmula que `board-layout.ts` ASUME como peor caso (`NUCLEO_CONTENT_BOTTOM_Y`). Este test
   * construye una mesa REAL (vía `createNucleoTable`, sin reimplementar la fórmula a mano) con
   * `NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR` dados EXTRA del mismo color apilados — el peor caso
   * posible — y verifica que el bounding box REAL del último dado (el más bajo de la pila) cae
   * dentro del borde inferior de contenido de `panel-nucleos` que `board-layout.ts` calcula. Si
   * alguien cambia `NUCLEO_EXTRA_DIE_STACK_OFFSET_PX` o la lógica de `positionFor` sin actualizar
   * `board-layout.ts` en consecuencia, este test debe fallar.
   */
  it('el peor caso de apilado EXTRA (NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR dados del mismo color) no invade panel-hand', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const color: NucleoDie['color'] = 'AGRESION';
    const fixed = mockDie('fixed', color, 1);
    const extras = Array.from({ length: NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR }, (_, index) =>
      mockDie(`extra-${index}`, color, 1, { kind: 'EXTRA' }),
    );
    const table = [fixed, ...extras];

    createNucleoTable(scene, table);

    const lastExtraId = String(mockNucleoInstanceId(`extra-${NUCLEO_MAX_EXTRA_DICE_STACKED_PER_COLOR - 1}`));
    const lastRect = rectangles.find((rect) => rect.getData('targetId') === lastExtraId)!;
    const nucleosContentBottomY = CONTENT_BOXES_TOP_TO_BOTTOM.find((entry) => entry.id === 'nucleos')!.box.bottom;

    expect(lastRect).toBeDefined();
    expect(
      lastRect.y + NUCLEO_TILE_HALF_PX,
      `bottom real (${lastRect.y + NUCLEO_TILE_HALF_PX}) del último dado EXTRA apilado supera el borde ` +
        `inferior de contenido de panel-nucleos (${nucleosContentBottomY}) que board-layout.ts asume`,
    ).toBeLessThanOrEqual(nucleosContentBottomY);
  });

  it('dos syncFromSnapshot consecutivos con la misma mesa: ningún tile destruido, mismas referencias', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const view = createNucleoTable(scene, []);
    const snapshot = createMockSnapshot({ nucleoTable: [mockDie('n1', 'AGRESION', 3)] });

    view.syncFromSnapshot(snapshot);
    const n1Id = String(mockNucleoInstanceId('n1'));
    const first = rectangles.find((r) => r.getData('targetId') === n1Id)!;

    view.syncFromSnapshot(snapshot);
    const second = rectangles.find((r) => r.getData('targetId') === n1Id && !r.destroyed);

    expect(second).toBe(first);
  });
});
