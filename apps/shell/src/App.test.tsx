// H2.9 — `<CombatScreen>` ahora monta un `Phaser.Game` real (§3). Este test de routing no
// necesita ejercitar ese montaje real (ya cubierto por `combat-scene`'s propia suite y por la
// verificación E2E manual de Playwright, spec §6.3) — se mockea `phaser`/`@collector/combat-scene`/
// `./combat/build-combat-setup` con la superficie mínima que `CombatScreen` toca, mismo espíritu
// que `combat-scene/src/combat-scene.test.ts` ya usa para evitar instanciar Phaser/canvas real en
// un test unitario (DoD H2.9).
import { vi, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import { App } from './App';

vi.mock('phaser', () => {
  class FakeGame {
    events = { once: (_evt: string, cb: () => void) => cb() };
    scene = { add: vi.fn(), start: vi.fn() };
    destroy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma calcada de `new Phaser.Game(config)`
    constructor(_config: unknown) {}
  }
  return {
    default: {
      AUTO: 'AUTO',
      Game: FakeGame,
      Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
      Core: { Events: { READY: 'ready' } },
    },
  };
});

vi.mock('@collector/combat-scene', () => ({
  CombatScene: class FakeCombatScene {},
  COMBAT_SCENE_VIEWPORT: { width: 1080, height: 1920 },
}));

const fakeSnapshot: CombatStateSnapshot = {
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

const fakeBridge = {
  dispatch: vi.fn(),
  getSnapshot: () => fakeSnapshot,
  subscribeHudEvents: vi.fn(() => vi.fn()),
  subscribeSceneEvents: vi.fn(() => vi.fn()),
} as unknown as CombatBridge;

vi.mock('./combat/build-combat-setup', () => ({
  buildCombatSetup: vi.fn(() => Promise.resolve({ bridge: fakeBridge, boardContext: {} })),
}));

describe('App routing', () => {
  it('navega entre las 3 pantallas end-to-end, incluyendo el montaje real de CombatScreen', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText('The Collector')).toBeInTheDocument();

    await user.click(screen.getByText('Iniciar run'));
    expect(
      screen.getByText('Inicio de Run — pantalla pendiente de implementación (ver H2.14).')
    ).toBeInTheDocument();

    await user.click(screen.getByText('Ir a combate (placeholder)'));
    expect(document.getElementById('phaser-mount')).not.toBeNull();
    expect(await screen.findByText('Fin de turno')).toBeInTheDocument();
  });
});
