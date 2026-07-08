// @vitest-environment node
//
// H2.7 spec §4 — test de aislamiento: `InputAdapter` real contra `FakePointerScene`, sin canvas/WebGL ni
// `Phaser.Game` real. Cubre los 8 casos de la máquina de estados de §1.2.
import { describe, it, expect, vi } from 'vitest';
import { createInputAdapter } from './input-adapter';
import { createFakePointerScene } from './test-utils/fake-pointer-scene';

function fakeTarget(targetId: string) {
  return { getData: (key: string) => (key === 'targetId' ? targetId : undefined) };
}

describe('createInputAdapter — máquina de estados de gestos (H2.7)', () => {
  it('1. tap simple: pointerdown+pointerup inmediato con targetId emite TAP', () => {
    const fake = createFakePointerScene();
    const adapter = createInputAdapter();
    adapter.attach(fake.scene);
    const listener = vi.fn();
    adapter.subscribe(listener);

    fake.setHitTestResult([fakeTarget('card-1')]);
    fake.firePointerDown(10, 20);
    fake.firePointerUp(10, 20);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ kind: 'TAP', targetId: 'card-1', point: { x: 10, y: 20 } });
  });

  it('2. tap en vacío: hitTestPointer sin resultados produce targetId null', () => {
    const fake = createFakePointerScene();
    const adapter = createInputAdapter();
    adapter.attach(fake.scene);
    const listener = vi.fn();
    adapter.subscribe(listener);

    fake.setHitTestResult([]);
    fake.firePointerDown(5, 5);
    fake.firePointerUp(5, 5);

    expect(listener).toHaveBeenCalledWith({ kind: 'TAP', targetId: null, point: { x: 5, y: 5 } });
  });

  it('3. long-press: el timer dispara LONG_PRESS antes de soltar; soltar después no añade un TAP', () => {
    const fake = createFakePointerScene();
    const adapter = createInputAdapter();
    adapter.attach(fake.scene);
    const listener = vi.fn();
    adapter.subscribe(listener);

    fake.setHitTestResult([fakeTarget('card-2')]);
    fake.firePointerDown(0, 0);
    fake.advanceTime(500);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ kind: 'LONG_PRESS', targetId: 'card-2', point: { x: 0, y: 0 } });

    fake.firePointerUp(0, 0);
    expect(listener).toHaveBeenCalledTimes(1); // sin TAP adicional
  });

  it('4. long-press cancelado por movimiento: no emite LONG_PRESS si se supera la tolerancia (caso límite: por debajo de dragThresholdPx)', () => {
    const fake = createFakePointerScene();
    // dragThresholdPx alto a propósito para poder probar el caso límite del §1.2: movimiento que supera
    // longPressMoveTolerancePx pero sigue sin ser suficiente para reclasificar como drag.
    const adapter = createInputAdapter({ dragThresholdPx: 50, longPressMoveTolerancePx: 10 });
    adapter.attach(fake.scene);
    const listener = vi.fn();
    adapter.subscribe(listener);

    fake.setHitTestResult([fakeTarget('card-3')]);
    fake.firePointerDown(0, 0);
    fake.firePointerMove(15, 0); // > longPressMoveTolerancePx(10), < dragThresholdPx(50) configurado.
    fake.advanceTime(500);

    expect(listener).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'LONG_PRESS' }));
    expect(listener).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'DRAG_START' }));
  });

  it('5. drag completo: DRAG_START → DRAG_MOVE con delta → DRAG_END, mismo targetId de origen', () => {
    const fake = createFakePointerScene();
    const adapter = createInputAdapter();
    adapter.attach(fake.scene);
    const listener = vi.fn();
    adapter.subscribe(listener);

    fake.setHitTestResult([fakeTarget('ally-2')]);
    fake.firePointerDown(0, 0);
    fake.firePointerMove(20, 0); // supera dragThresholdPx(10) -> DRAG_START
    fake.firePointerMove(30, 5); // DRAG_MOVE con delta respecto al punto anterior
    fake.firePointerUp(40, 10); // DRAG_END

    expect(listener).toHaveBeenNthCalledWith(1, { kind: 'DRAG_START', targetId: 'ally-2', point: { x: 0, y: 0 } });
    expect(listener).toHaveBeenNthCalledWith(2, {
      kind: 'DRAG_MOVE',
      targetId: 'ally-2',
      point: { x: 30, y: 5 },
      delta: { x: 10, y: 5 },
    });
    expect(listener).toHaveBeenNthCalledWith(3, { kind: 'DRAG_END', targetId: 'ally-2', point: { x: 40, y: 10 } });
  });

  it('6. pointerupoutside durante drag también emite DRAG_END', () => {
    const fake = createFakePointerScene();
    const adapter = createInputAdapter();
    adapter.attach(fake.scene);
    const listener = vi.fn();
    adapter.subscribe(listener);

    fake.setHitTestResult([fakeTarget('ally-3')]);
    fake.firePointerDown(0, 0);
    fake.firePointerMove(20, 0);
    fake.firePointerUpOutside(50, 50);

    expect(listener).toHaveBeenNthCalledWith(2, { kind: 'DRAG_END', targetId: 'ally-3', point: { x: 50, y: 50 } });
  });

  it('7. umbrales configurables: dragThresholdPx inyectado se respeta en vez del default', () => {
    const fake = createFakePointerScene();
    const adapter = createInputAdapter({ dragThresholdPx: 50 });
    adapter.attach(fake.scene);
    const listener = vi.fn();
    adapter.subscribe(listener);

    fake.setHitTestResult([fakeTarget('card-4')]);
    fake.firePointerDown(0, 0);
    fake.firePointerMove(20, 0); // 20px < 50px configurado -> no debería disparar DRAG_START

    expect(listener).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'DRAG_START' }));
  });

  it('8. attach()/subscribe() desacoplados: subscribe antes de attach funciona; unsubscribeAttach corta la escena', () => {
    const fake = createFakePointerScene();
    const adapter = createInputAdapter();
    const listener = vi.fn();
    adapter.subscribe(listener); // suscrito antes de attach

    const unsubscribeAttach = adapter.attach(fake.scene);

    fake.setHitTestResult([fakeTarget('card-5')]);
    fake.firePointerDown(1, 1);
    fake.firePointerUp(1, 1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribeAttach();
    fake.firePointerDown(2, 2);
    fake.firePointerUp(2, 2);
    expect(listener).toHaveBeenCalledTimes(1); // sin efecto tras desconectar de la escena
  });
});
