// H2.9 — `<CombatScreen>` ahora monta un `Phaser.Game` real (§3). Este test de routing no
// necesita ejercitar ese montaje real (ya cubierto por `combat-scene`'s propia suite y por la
// verificación E2E manual de Playwright, spec §6.3) — se mockea `phaser`/`@collector/combat-scene`/
// `./combat/build-combat-setup` con la superficie mínima que `CombatScreen` toca, mismo espíritu
// que `combat-scene/src/combat-scene.test.ts` ya usa para evitar instanciar Phaser/canvas real en
// un test unitario (DoD H2.9).
import { vi, describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatStateSnapshot } from '@collector/domain-combat';
import type { App as AppComponent } from './App';

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
  // FIX Reviewer post-H3 — `CombatHud` (renderizado dentro de `CombatScreen`) llama a esta función
  // real vía `@collector/combat-scene`; el mock del paquete debe exponerla, aunque devuelva `false`
  // siempre (mismo espíritu que el resto de este mock: superficie mínima, no lógica real).
  isAnyLeaderAbilityActivatable: vi.fn(() => false),
}));

const fakeSnapshot: CombatStateSnapshot = {
  turn: { turnOwner: 'LEADER', turnNumber: 1 },
  nucleoTable: [],
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
  leaderHand: [],
  leaderDeckRemaining: 0,
  leaderFreeStep: { takenThisTurn: false },
};

const fakeBridge = {
  dispatch: vi.fn(),
  getSnapshot: () => fakeSnapshot,
  subscribeHudEvents: vi.fn(() => vi.fn()),
  subscribeSceneEvents: vi.fn(() => vi.fn()),
} as unknown as CombatBridge;

const buildCombatSetupMock = vi.fn(
  (_params: { readonly leaderId?: string; readonly enemyId?: string; readonly scenarioId?: string }) =>
    Promise.resolve({ bridge: fakeBridge, boardContext: { leaderAbilities: [] } })
);

vi.mock('./combat/build-combat-setup', () => ({
  buildCombatSetup: (params: {
    readonly leaderId?: string;
    readonly enemyId?: string;
    readonly scenarioId?: string;
  }) => buildCombatSetupMock(params),
}));

// `App.tsx` construye el router (`createBrowserRouter`) como singleton en el ámbito del módulo,
// compartiendo el mismo historial de navegación del navegador entre renders. Para que cada test
// de este archivo empiece limpio en `/` (en vez de heredar la navegación del test anterior),
// `vi.resetModules()` + reimport dinámico de `App` en cada test, junto con resetear la URL real
// de jsdom antes de cada uno.
let App: typeof AppComponent;

beforeEach(async () => {
  window.history.pushState({}, '', '/');
  vi.resetModules();
  ({ App } = await import('./App'));
});

describe('App routing', () => {
  it('navega entre las 3 pantallas end-to-end, incluyendo el montaje real de CombatScreen (selección por defecto)', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText('The Collector')).toBeInTheDocument();

    await user.click(screen.getByText('Iniciar run'));
    expect(screen.getByText('Inicio de Run')).toBeInTheDocument();

    // H2.14 — sin tocar el selector, "Iniciar combate" navega con el Líder preseleccionado
    // (Soldado Base) — regresión cero respecto al flujo que `apps/shell` ya jugaba antes.
    await user.click(screen.getByText('Iniciar combate'));
    expect(document.getElementById('phaser-mount')).not.toBeNull();
    expect(await screen.findByText('Fin de turno')).toBeInTheDocument();
    expect(screen.getByText('Líder: Soldado Base')).toBeInTheDocument();
    expect(buildCombatSetupMock).toHaveBeenCalledWith({
      leaderId: 'leader-soldado-base',
      enemyId: 'enemy-bestia-base',
      scenarioId: 'scenario-bosque-encantado-base',
    });
  });

  it('H2.14 — elegir "Mago Base" en RunStartScreen viaja de punta a punta hasta el HUD de combate', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Iniciar run'));
    expect(screen.getByText('Inicio de Run')).toBeInTheDocument();

    await user.click(screen.getByText('Mago Base'));
    await user.click(screen.getByText('Iniciar combate'));

    expect(document.getElementById('phaser-mount')).not.toBeNull();
    expect(await screen.findByText('Fin de turno')).toBeInTheDocument();
    expect(screen.getByText('Líder: Mago Base')).toBeInTheDocument();
    expect(screen.queryByText('Líder: Soldado Base')).not.toBeInTheDocument();
    expect(buildCombatSetupMock).toHaveBeenCalledWith({
      leaderId: 'leader-mago-base',
      enemyId: 'enemy-bestia-base',
      scenarioId: 'scenario-bosque-encantado-base',
    });
  });

  it('H2.14 bug fix — navegar a /combat con un leaderId inválido en state no crashea y cae al Líder por defecto', async () => {
    // Simula navegación directa con `state` manipulado/corrupto (ej. URL/state inyectado a mano,
    // no proviene de `RunStartScreen`) — `leaderId` no existe en `LEADER_OPTIONS`.
    window.history.pushState({ leaderId: 'leader-does-not-exist' }, '', '/combat');
    vi.resetModules();
    ({ App } = await import('./App'));

    render(<App />);

    expect(document.getElementById('phaser-mount')).not.toBeNull();
    expect(await screen.findByText('Fin de turno')).toBeInTheDocument();
    expect(screen.getByText('Líder: Soldado Base')).toBeInTheDocument();
    expect(buildCombatSetupMock).toHaveBeenCalledWith({
      leaderId: 'leader-soldado-base',
      enemyId: 'enemy-bestia-base',
      scenarioId: 'scenario-bosque-encantado-base',
    });
  });
});
