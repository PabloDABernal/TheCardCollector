// H2.12 spec §5.1 — `nucleo-pool-view.test.ts`: no existía archivo de test propio hasta ahora (H2.8
// solo lo cubría indirectamente vía `board-view.test.ts`). Verifica el diff por `id` de
// `syncFromSnapshot` — primer render sin animación, pool conservado (misma referencia), retirada
// parcial (fade+shrink diferido) y relanzado completo (roll-in + partícula).
import { describe, it, expect } from 'vitest';
import { createNucleoPoolView } from './nucleo-pool-view';
import { createFakeBoardScene } from './test-utils/fake-board-scene';
import { createMockSnapshot, mockNucleoInstanceId } from './test-utils/mock-snapshot';

describe('createNucleoPoolView — syncFromSnapshot (H2.12)', () => {
  it('primer render: crea un tile por NucleoInstance, sin ningún tween registrado (caso "primer render")', () => {
    const { scene, rectangles, texts, recordedTweens } = createFakeBoardScene({ autoComplete: false });
    const view = createNucleoPoolView(scene);

    view.syncFromSnapshot(
      createMockSnapshot({
        nucleoPool: [
          { id: mockNucleoInstanceId('n1'), color: 'AGRESION', value: 2 },
          { id: mockNucleoInstanceId('n2'), color: 'DEFENSA', value: 3 },
        ],
      }),
    );

    const n1Rect = rectangles.find((r) => r.getData('targetId') === 'n1');
    const n2Rect = rectangles.find((r) => r.getData('targetId') === 'n2');
    expect(n1Rect).toBeDefined();
    expect(n2Rect).toBeDefined();
    expect(texts).toHaveLength(2);
    expect(recordedTweens).toHaveLength(0);
  });

  it('segundo syncFromSnapshot con el MISMO pool: ningún tile destruido, mismas referencias (caso "parcial", keptIds completo)', () => {
    const { scene, rectangles } = createFakeBoardScene({ autoComplete: false });
    const view = createNucleoPoolView(scene);

    const snapshot = createMockSnapshot({
      nucleoPool: [
        { id: mockNucleoInstanceId('n1'), color: 'AGRESION', value: 2 },
        { id: mockNucleoInstanceId('n2'), color: 'DEFENSA', value: 3 },
      ],
    });

    view.syncFromSnapshot(snapshot);
    const n1RectFirst = rectangles.find((r) => r.getData('targetId') === 'n1')!;
    const n2RectFirst = rectangles.find((r) => r.getData('targetId') === 'n2')!;

    view.syncFromSnapshot(snapshot);
    const n1RectSecond = rectangles.find((r) => r.getData('targetId') === 'n1' && !r.destroyed);
    const n2RectSecond = rectangles.find((r) => r.getData('targetId') === 'n2' && !r.destroyed);

    expect(n1RectFirst.destroyed).toBe(false);
    expect(n2RectFirst.destroyed).toBe(false);
    expect(n1RectSecond).toBe(n1RectFirst);
    expect(n2RectSecond).toBe(n2RectFirst);
  });

  it('retira exactamente 1 id de los 2 anteriores: el retirado sigue vivo hasta completar el tween de fade+shrink; el superviviente no fue tocado', () => {
    const { scene, rectangles, completeTween } = createFakeBoardScene({ autoComplete: false });
    const view = createNucleoPoolView(scene);

    view.syncFromSnapshot(
      createMockSnapshot({
        nucleoPool: [
          { id: mockNucleoInstanceId('n1'), color: 'AGRESION', value: 2 },
          { id: mockNucleoInstanceId('n2'), color: 'DEFENSA', value: 3 },
        ],
      }),
    );
    const n1Rect = rectangles.find((r) => r.getData('targetId') === 'n1')!;
    const n2Rect = rectangles.find((r) => r.getData('targetId') === 'n2')!;
    const n2X = n2Rect.x;
    const n2Y = n2Rect.y;

    view.syncFromSnapshot(
      createMockSnapshot({
        nucleoPool: [{ id: mockNucleoInstanceId('n2'), color: 'DEFENSA', value: 3 }],
      }),
    );

    // n1 (retirado) sigue vivo inmediatamente tras la llamada, con un tween registrado.
    expect(n1Rect.destroyed).toBe(false);
    // n2 (superviviente, único id restante — su índice pasa de 1 a 0) no fue destruido/recreado.
    expect(n2Rect.destroyed).toBe(false);

    completeTween(0);

    expect(n1Rect.destroyed).toBe(true);
    // n2 nunca tocado en posición si su índice no cambia tras el reposicionamiento del punto 5;
    // aquí SÍ cambia (de índice 1 a 0), así que se reposiciona sin tween — comprobado en el test
    // dedicado de reposicionamiento más abajo. Aquí solo se verifica que no fue destruido/recreado.
    expect(rectangles.find((r) => r.getData('targetId') === 'n2' && !r.destroyed)).toBe(n2Rect);
    void n2X;
    void n2Y;
  });

  it('pool completamente disjunto del anterior (relanzado): destruye todos los supervivientes (incluido uno en fade pendiente) y crea 6 nuevos con tween de angle/scale + particleBurst al completar', () => {
    const { scene, rectangles, recordedTweens, completeTween } = createFakeBoardScene({ autoComplete: false });
    const view = createNucleoPoolView(scene);

    view.syncFromSnapshot(
      createMockSnapshot({
        nucleoPool: [
          { id: mockNucleoInstanceId('n1'), color: 'AGRESION', value: 2 },
          { id: mockNucleoInstanceId('n2'), color: 'DEFENSA', value: 3 },
        ],
      }),
    );

    // Retira n1 (queda en fade pendiente, sin completar su tween) antes del relanzado completo.
    view.syncFromSnapshot(
      createMockSnapshot({
        nucleoPool: [{ id: mockNucleoInstanceId('n2'), color: 'DEFENSA', value: 3 }],
      }),
    );
    const n1Rect = rectangles.find((r) => r.getData('targetId') === 'n1')!;
    const n2Rect = rectangles.find((r) => r.getData('targetId') === 'n2')!;
    expect(n1Rect.destroyed).toBe(false);

    const newPool = Array.from({ length: 6 }, (_, i) => ({
      id: mockNucleoInstanceId(`new-${i}`),
      color: 'CAOS' as const,
      value: i % 5,
    }));

    view.syncFromSnapshot(createMockSnapshot({ nucleoPool: newPool }));

    // n1 (en fade pendiente) y n2 (superviviente estático) quedan destruidos inmediatamente.
    expect(n1Rect.destroyed).toBe(true);
    expect(n2Rect.destroyed).toBe(true);

    const newRects = newPool.map((n) => rectangles.find((r) => r.getData('targetId') === String(n.id))!);
    expect(newRects.every((r) => r !== undefined && !r.destroyed)).toBe(true);

    const rollTweens = recordedTweens.filter((t) => t.config['angle'] !== undefined);
    expect(rollTweens).toHaveLength(6);
    for (const tween of rollTweens) {
      expect(tween.config['scale']).toEqual({ from: 1.2, to: 1 });
      expect(tween.config['duration']).toBe(500);
      expect(tween.config['ease']).toBe('Cubic.easeOut');
    }

    // Completar el primer tween de roll-in dispara el particleBurst (add.particles), sin lanzar.
    expect(() => completeTween(recordedTweens.indexOf(rollTweens[0]!))).not.toThrow();
  });

  it('reposicionamiento sin tween: pool de 3 ids, se retira el del medio (índice 1) → los 2 supervivientes se reposicionan de forma inmediata', () => {
    const { scene, rectangles, recordedTweens } = createFakeBoardScene({ autoComplete: false });
    const view = createNucleoPoolView(scene);

    view.syncFromSnapshot(
      createMockSnapshot({
        nucleoPool: [
          { id: mockNucleoInstanceId('n1'), color: 'AGRESION', value: 1 },
          { id: mockNucleoInstanceId('n2'), color: 'DEFENSA', value: 2 },
          { id: mockNucleoInstanceId('n3'), color: 'CONTROL', value: 3 },
        ],
      }),
    );
    const n1Rect = rectangles.find((r) => r.getData('targetId') === 'n1')!;
    const n3Rect = rectangles.find((r) => r.getData('targetId') === 'n3')!;
    const n1XBefore = n1Rect.x;
    const n3XBefore = n3Rect.x;

    const tweensBeforeRemoval = recordedTweens.length;

    view.syncFromSnapshot(
      createMockSnapshot({
        nucleoPool: [
          { id: mockNucleoInstanceId('n1'), color: 'AGRESION', value: 1 },
          { id: mockNucleoInstanceId('n3'), color: 'CONTROL', value: 3 },
        ],
      }),
    );

    // n1 mantiene su índice (0) — no se toca su posición.
    expect(n1Rect.x).toBe(n1XBefore);
    // n3 pasa de índice 2 a índice 1 — reposicionado de forma inmediata, sin tween.
    expect(n3Rect.x).not.toBe(n3XBefore);
    expect(recordedTweens.length).toBe(tweensBeforeRemoval + 1); // solo el fade de n2 retirado
  });
});
