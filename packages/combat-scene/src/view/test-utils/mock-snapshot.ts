import { createId } from '@collector/domain-shared';
import type { CombatStateSnapshot } from '@collector/domain-combat';

/**
 * H2.8 spec §5.1 — construye un `CombatStateSnapshot` mock mínimo pero completo, con overrides
 * parciales (mismo patrón "construible a mano" que los tests de `domain/combat/*.test.ts`). Sin
 * dependencia de `CombatEngine` real — solo forma de datos.
 */
export function createMockSnapshot(overrides: Partial<CombatStateSnapshot> = {}): CombatStateSnapshot {
  const base: CombatStateSnapshot = {
    turn: { turnOwner: 'LEADER', turnNumber: 1 },
    nucleoPool: [],
    cooldowns: [],
    leaderDamage: 0,
    leaderShield: 0,
    scenarioPlot: 0,
    leaderEnergy: 3,
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
  };

  return { ...base, ...overrides };
}

export function mockNucleoInstanceId(value: string) {
  return createId('NucleoInstanceId', value);
}

export function mockCardInstanceId(value: string) {
  return createId('CardInstanceId', value);
}

export function mockCardId(value: string) {
  return createId('CardId', value);
}
