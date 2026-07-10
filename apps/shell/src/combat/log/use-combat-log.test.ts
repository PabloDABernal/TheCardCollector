// FIX Reviewer post-H4 — `use-combat-log.ts` no tenía ningún test propio. Cubre el contrato de
// generación de `id`/`turnNumber` (estable y único a través de múltiples eventos, reinicio de
// secuencia al cambiar de turno) y confirma vía remount tipo StrictMode que el `useRef` de
// secuencia no duplica entradas — mismo espíritu de "`CombatBridge` fake mínimo" que
// `CombatHud.test.tsx`/`use-combat-snapshot.test.ts`.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createId } from '@collector/domain-shared';
import type { CardId } from '@collector/domain-shared';
import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatEvent, CombatStateSnapshot } from '@collector/domain-combat';
import type { BoardViewContext } from '@collector/combat-scene';
import { useCombatLog } from './use-combat-log';

const CARD_ID = createId<'CardId'>('CardId', 'card-x') as CardId;

function createMockContext(): BoardViewContext {
  return {
    nameLookup: {
      abilityName: (id) => `ability:${id}`,
      cardName: (id) => `card:${id}`,
      minionName: (id) => `minion:${id}`,
    },
    leaderMaxHealth: 30,
    enemyMaxHealth: 40,
    scenarioPlotDefeatThreshold: 10,
    leaderCardPool: [],
    leaderAbilities: [],
    enemyAbilities: [],
    enemyDramaturgiaDeck: [],
  };
}

/** Fake mínimo: expone el listener registrado por `subscribeHudEvents` para que el test lo dispare
 *  manualmente, y un `turnNumber` mutable que `getSnapshot()` refleja (el hook lee
 *  `bridge.getSnapshot().turn.turnNumber` en el momento de cada evento — spec §3.1). */
function createFakeBridge() {
  let turnNumber = 1;
  const listeners: Array<(event: CombatEvent) => void> = [];
  const bridge = {
    getSnapshot: () => ({ turn: { turnNumber } }) as unknown as CombatStateSnapshot,
    subscribeHudEvents: vi.fn((listener: (event: CombatEvent) => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    }),
    subscribeSceneEvents: vi.fn(() => vi.fn()),
  } as unknown as CombatBridge;

  return {
    bridge,
    setTurnNumber: (value: number) => {
      turnNumber = value;
    },
    emit: (event: CombatEvent) => {
      listeners.forEach((listener) => listener(event));
    },
    listenerCount: () => listeners.length,
  };
}

const cardPlayedEvent: CombatEvent = { type: 'CARD_PLAYED', cardId: CARD_ID, sourceId: 'src', leaderEnergyAfter: 1 };

describe('useCombatLog — generación de id/turnNumber', () => {
  it('cada entrada traducible recibe un id único con secuencia 0, 1, 2... dentro del mismo turno', () => {
    const { bridge, emit } = createFakeBridge();
    const ctx = createMockContext();
    const { result } = renderHook(() => useCombatLog(bridge, ctx));

    act(() => {
      emit(cardPlayedEvent);
      emit(cardPlayedEvent);
      emit(cardPlayedEvent);
    });

    expect(result.current).toHaveLength(3);
    expect(result.current.map((e) => e.id)).toEqual(['1-0', '1-1', '1-2']);
    expect(result.current.every((e) => e.turnNumber === 1)).toBe(true);
  });

  it('eventos no traducibles (null) no generan entrada ni consumen secuencia', () => {
    const { bridge, emit } = createFakeBridge();
    const ctx = createMockContext();
    const { result } = renderHook(() => useCombatLog(bridge, ctx));

    act(() => {
      emit({ type: 'ENERGY_GENERATED', amount: 1, leaderEnergyAfter: 2 }); // no traducible → null
      emit(cardPlayedEvent);
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.id).toBe('1-0');
  });

  it('al cambiar el turnNumber del snapshot, la secuencia se reinicia a 0', () => {
    const { bridge, emit, setTurnNumber } = createFakeBridge();
    const ctx = createMockContext();
    const { result } = renderHook(() => useCombatLog(bridge, ctx));

    act(() => {
      emit(cardPlayedEvent);
      emit(cardPlayedEvent);
    });
    expect(result.current.map((e) => e.id)).toEqual(['1-0', '1-1']);

    act(() => {
      setTurnNumber(2);
      emit(cardPlayedEvent);
    });

    expect(result.current.map((e) => e.id)).toEqual(['1-0', '1-1', '2-0']);
    expect(result.current[2]?.turnNumber).toBe(2);
  });

  it('sobrevive un remount tipo StrictMode (mount → unmount → mount) sin duplicar entradas', () => {
    const { bridge, emit, listenerCount } = createFakeBridge();
    const ctx = createMockContext();

    // Simula el doble-mount de React StrictMode en desarrollo: monta, desmonta, vuelve a montar.
    const first = renderHook(() => useCombatLog(bridge, ctx));
    first.unmount();
    expect(listenerCount()).toBe(0); // el `unsubscribe` del efecto se limpió correctamente

    const second = renderHook(() => useCombatLog(bridge, ctx));

    act(() => {
      emit(cardPlayedEvent);
    });

    // Solo el listener del segundo (montaje vigente) sigue activo — una única entrada, no duplicada.
    expect(second.result.current).toHaveLength(1);
    expect(second.result.current[0]?.id).toBe('1-0');
  });
});
