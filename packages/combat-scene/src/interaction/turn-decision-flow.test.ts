// @vitest-environment node
//
// H5.2 spec §7 — casos de test. Mismo criterio de aislamiento que `effects-director.test.ts`: mockea
// `CombatBridge.dispatch`/`subscribeHudEvents` a mano, sin `CombatEngine` real.
import { describe, it, expect, vi } from 'vitest';
import type { CombatBridge, CombatEvent } from '@collector/combat-bridge';
import { createId } from '@collector/domain-shared';
import type { CardId } from '@collector/domain-shared';
import { createTurnDecisionFlow } from './turn-decision-flow';

function createMockBridge() {
  const listeners: Array<(e: CombatEvent) => void> = [];
  const dispatch = vi.fn();
  return {
    bridge: {
      dispatch,
      subscribeHudEvents: (listener: (e: CombatEvent) => void) => {
        listeners.push(listener);
        return () => {
          /* no-op — no se ejercita unsubscribe en estos tests */
        };
      },
    } as unknown as CombatBridge,
    dispatch,
    emit: (event: CombatEvent) => listeners.forEach((l) => l(event)),
  };
}

const CARD_ID = createId<'CardId'>('CardId', 'card-1') as CardId;

describe('createTurnDecisionFlow (H5.2 §7)', () => {
  it("1. selectCategory('GENERATE_ENERGY') dispatch inmediato, estado sigue en CATEGORY", () => {
    const { bridge, dispatch } = createMockBridge();
    const flow = createTurnDecisionFlow({ bridge, cancelPending: vi.fn() });

    flow.selectCategory('GENERATE_ENERGY');

    expect(dispatch).toHaveBeenCalledWith({ type: 'GENERATE_ENERGY' });
    expect(flow.signal.getState()).toEqual({ stage: 'CATEGORY' });
  });

  it("2. selectCategory('DRAW_CARD') dispatch inmediato, análogo", () => {
    const { bridge, dispatch } = createMockBridge();
    const flow = createTurnDecisionFlow({ bridge, cancelPending: vi.fn() });

    flow.selectCategory('DRAW_CARD');

    expect(dispatch).toHaveBeenCalledWith({ type: 'DRAW_CARD' });
    expect(flow.signal.getState()).toEqual({ stage: 'CATEGORY' });
  });

  it("3. selectCategory('PLAY_CARD') pasa a DETAIL/PLAY_CARD, sin dispatch", () => {
    const { bridge, dispatch } = createMockBridge();
    const flow = createTurnDecisionFlow({ bridge, cancelPending: vi.fn() });

    flow.selectCategory('PLAY_CARD');

    expect(flow.signal.getState()).toEqual({ stage: 'DETAIL', category: 'PLAY_CARD' });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('4. CARD_PLAYED en DETAIL/PLAY_CARD vuelve a CATEGORY', () => {
    const { bridge, emit } = createMockBridge();
    const flow = createTurnDecisionFlow({ bridge, cancelPending: vi.fn() });

    flow.selectCategory('PLAY_CARD');
    emit({ type: 'CARD_PLAYED', cardId: CARD_ID, sourceId: 'card-instance-1', leaderEnergyAfter: 2 });

    expect(flow.signal.getState()).toEqual({ stage: 'CATEGORY' });
  });

  it('5. CARD_PLAYED en DETAIL/ACTIVATE_ABILITY NO cambia el estado (filtro por categoría activa)', () => {
    const { bridge, emit } = createMockBridge();
    const flow = createTurnDecisionFlow({ bridge, cancelPending: vi.fn() });

    flow.selectCategory('ACTIVATE_ABILITY');
    emit({ type: 'CARD_PLAYED', cardId: CARD_ID, sourceId: 'card-instance-1', leaderEnergyAfter: 2 });

    expect(flow.signal.getState()).toEqual({ stage: 'DETAIL', category: 'ACTIVATE_ABILITY' });
  });

  it('6. cancelDetail() desde DETAIL/ACTIVATE_ABILITY vuelve a CATEGORY e invoca cancelPending una vez', () => {
    const { bridge } = createMockBridge();
    const cancelPending = vi.fn();
    const flow = createTurnDecisionFlow({ bridge, cancelPending });

    flow.selectCategory('ACTIVATE_ABILITY');
    flow.cancelDetail();

    expect(flow.signal.getState()).toEqual({ stage: 'CATEGORY' });
    expect(cancelPending).toHaveBeenCalledTimes(1);
  });

  it('7. TURN_ENDED con nextTurnOwner LEADER estando en DETAIL/PLAY_CARD vuelve a CATEGORY (reset defensivo)', () => {
    const { bridge, emit } = createMockBridge();
    const flow = createTurnDecisionFlow({ bridge, cancelPending: vi.fn() });

    flow.selectCategory('PLAY_CARD');
    emit({ type: 'TURN_ENDED', previousTurnOwner: 'ENEMY', nextTurnOwner: 'LEADER', turnNumber: 2 });

    expect(flow.signal.getState()).toEqual({ stage: 'CATEGORY' });
  });

  it('8. TURN_ENDED con nextTurnOwner ENEMY no cambia el estado', () => {
    const { bridge, emit } = createMockBridge();
    const flow = createTurnDecisionFlow({ bridge, cancelPending: vi.fn() });

    flow.selectCategory('PLAY_CARD');
    emit({ type: 'TURN_ENDED', previousTurnOwner: 'LEADER', nextTurnOwner: 'ENEMY', turnNumber: 1 });

    expect(flow.signal.getState()).toEqual({ stage: 'DETAIL', category: 'PLAY_CARD' });
  });

  it('selectCategory nunca valida disponibilidad — delega íntegramente en el motor (sin guardas internas)', () => {
    const { bridge, dispatch } = createMockBridge();
    const flow = createTurnDecisionFlow({ bridge, cancelPending: vi.fn() });

    flow.selectCategory('GENERATE_ENERGY');
    flow.selectCategory('GENERATE_ENERGY');

    expect(dispatch).toHaveBeenCalledTimes(2);
  });
});
