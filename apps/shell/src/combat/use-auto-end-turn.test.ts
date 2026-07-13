// H5.9 spec §6 casos 5-7 — `useAutoEndTurn` no tenía test propio. Mismo motivo de mock que
// `CombatHud.test.tsx`: el barrel `@collector/combat-scene` reexporta `CombatScene`, que arrastra
// `phaser`/`CanvasFeatures` — rompe bajo jsdom.
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { AbilityViewData } from '@collector/combat-scene';

vi.mock('@collector/combat-scene', () => ({
  isAnyLeaderAbilityActivatable: vi.fn(() => false),
}));

// eslint-disable-next-line import/first -- debe importarse después del `vi.mock` de arriba
import { useAutoEndTurn } from './use-auto-end-turn';

const leaderAbilities: readonly AbilityViewData[] = [];

function createMockSnapshot(overrides: Partial<CombatStateSnapshot> = {}): CombatStateSnapshot {
  const base: CombatStateSnapshot = {
    turn: { turnOwner: 'LEADER', turnNumber: 1 },
    nucleoTable: [],
    cooldowns: [],
    leaderDamage: 0,
    leaderShield: 0,
    scenarioPlot: 0,
    leaderEnergy: 2,
    actions: { side: 'LEADER', actionsTaken: 0, actionsAllowed: 2, comboBonusGranted: false },
    undoableLastEnemyTurn: [],
    alliesInPlay: [],
    activeDamageRedirectTargetId: null,
    minionsInPlay: [],
    leaderState: { level: 1, levelUpsSpent: 0 },
    enemyPhase: { phaseNumber: 1, totalPhases: 1 },
    scenarioPhase: { phaseNumber: 1, totalPhases: 1 },
    enemyDamage: 0,
    status: 'IN_PROGRESS',
    leaderHand: [],
    leaderDeckRemaining: 10,
    leaderFreeStep: { takenThisTurn: true },
    enemyActiveDramaturgiaCardId: null,
  };
  return { ...base, ...overrides };
}

function createFakeBridge(): CombatBridge {
  return {
    dispatch: vi.fn(() => ({ ok: true, value: [] })),
    getSnapshot: vi.fn(),
    subscribeHudEvents: vi.fn(() => vi.fn()),
    subscribeSceneEvents: vi.fn(() => vi.fn()),
  } as unknown as CombatBridge;
}

describe('useAutoEndTurn', () => {
  it('5. actionsTaken === actionsAllowed y es turno del Líder: dispatch(END_TURN) exactamente una vez; un segundo render con el mismo turnNumber no repite el dispatch', () => {
    const bridge = createFakeBridge();
    const snapshot = createMockSnapshot({ actions: { side: 'LEADER', actionsTaken: 2, actionsAllowed: 2, comboBonusGranted: false } });

    const { rerender } = renderHook(
      ({ snap }) => useAutoEndTurn(bridge, snap, leaderAbilities),
      { initialProps: { snap: snapshot } },
    );

    expect(bridge.dispatch).toHaveBeenCalledTimes(1);
    expect(bridge.dispatch).toHaveBeenCalledWith({ type: 'END_TURN' });

    rerender({ snap: { ...snapshot } }); // mismo turnNumber, nuevo objeto snapshot

    expect(bridge.dispatch).toHaveBeenCalledTimes(1);
  });

  it('6. actionsTaken < actionsAllowed pero ninguna acción pagada es legal (deadlock): dispatch(END_TURN) también se dispara', () => {
    const bridge = createFakeBridge();
    // Energía al tope (canGenerateEnergy=false), mano vacía (canPlayCard=false), mazo vacío
    // (canDrawCard=false), sin habilidades activables (mock devuelve false) —
    // paidActionAvailabilityFor(...).anyAvailable === false pese a actionsTaken < actionsAllowed.
    const snapshot = createMockSnapshot({
      leaderEnergy: 5,
      leaderHand: [],
      leaderDeckRemaining: 0,
      actions: { side: 'LEADER', actionsTaken: 0, actionsAllowed: 2, comboBonusGranted: false },
    });

    renderHook(() => useAutoEndTurn(bridge, snapshot, leaderAbilities));

    expect(bridge.dispatch).toHaveBeenCalledWith({ type: 'END_TURN' });
  });

  it('7. turno del Enemigo: nunca dispara dispatch', () => {
    const bridge = createFakeBridge();
    const snapshot = createMockSnapshot({ turn: { turnOwner: 'ENEMY', turnNumber: 1 } });

    renderHook(() => useAutoEndTurn(bridge, snapshot, leaderAbilities));

    expect(bridge.dispatch).not.toHaveBeenCalled();
  });

  it('con acciones disponibles y al menos una acción legal (mano no vacía): no dispara dispatch', () => {
    const bridge = createFakeBridge();
    const snapshot = createMockSnapshot({
      leaderHand: ['card-1' as never],
      actions: { side: 'LEADER', actionsTaken: 0, actionsAllowed: 2, comboBonusGranted: false },
    });

    renderHook(() => useAutoEndTurn(bridge, snapshot, leaderAbilities));

    expect(bridge.dispatch).not.toHaveBeenCalled();
  });
});
