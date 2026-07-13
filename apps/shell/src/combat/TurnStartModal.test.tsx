// H5.9 spec §6 caso 4 — `TurnStartModal` no tenía test propio. Cubre la condición nueva
// `effectsQueueDraining` (evita el "popup ciego" mientras la cola de `EffectsDirector` reproduce el
// turno del Enemigo) además de la condición de aparición ya existente de H4.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import { TurnStartModal } from './TurnStartModal';

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
    leaderFreeStep: { takenThisTurn: false },
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

describe('TurnStartModal — H5.9 §2 effectsQueueDraining', () => {
  it('effectsQueueDraining=true: el modal NO se renderiza aunque el resto de shouldShow ya se cumpla', () => {
    render(<TurnStartModal snapshot={createMockSnapshot()} bridge={createFakeBridge()} effectsQueueDraining />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('effectsQueueDraining=false: el modal SÍ se renderiza (comportamiento H4 sin cambios)', () => {
    render(
      <TurnStartModal snapshot={createMockSnapshot()} bridge={createFakeBridge()} effectsQueueDraining={false} />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Tu turno')).toBeInTheDocument();
  });

  it('turno del Enemigo: el modal no se renderiza sin importar effectsQueueDraining', () => {
    render(
      <TurnStartModal
        snapshot={createMockSnapshot({ turn: { turnOwner: 'ENEMY', turnNumber: 1 } })}
        bridge={createFakeBridge()}
        effectsQueueDraining={false}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
