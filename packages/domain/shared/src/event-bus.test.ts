import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from './event-bus';

describe('EventBus', () => {
  it('entrega eventos emitidos a los listeners suscritos', () => {
    type DummyEvent = { type: 'PING'; value: number };
    const bus = createEventBus<DummyEvent>();
    const listener = vi.fn();

    bus.subscribe(listener);
    bus.emit({ type: 'PING', value: 42 });

    expect(listener).toHaveBeenCalledWith({ type: 'PING', value: 42 });
  });

  it('deja de recibir eventos tras invocar unsubscribe', () => {
    type DummyEvent = { type: 'PING' };
    const bus = createEventBus<DummyEvent>();
    const listener = vi.fn();

    const unsubscribe = bus.subscribe(listener);
    unsubscribe();
    bus.emit({ type: 'PING' });

    expect(listener).not.toHaveBeenCalled();
  });
});
