// NUEVO H3 (spec §5.2) — `nucleo-table-view.test.ts`: sustituye a `nucleo-pool-view.test.ts`
// (retirado con el modelo viejo). Verifica el contrato de mesa PERSISTENTE: primer render sin
// animación, gasto de un dado (dim, nunca destruido), reroll (tween sobre el sprite real) y dado
// EXTRA añadido (spawn, sin tocar los ya existentes).
import { describe, it, expect } from 'vitest';
import type { NucleoDie } from '@collector/domain-combat';
import { createNucleoTable } from './nucleo-table-view';
import { createFakeBoardScene } from './test-utils/fake-board-scene';
import { createMockSnapshot, mockNucleoInstanceId } from './test-utils/mock-snapshot';

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
