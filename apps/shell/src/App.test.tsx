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

// NUEVO H4 spec §5.2/§6.1 — `CombatScene.create()` (real, mockeada aquí) devuelve un
// `getTargetingSignal()`/`getGestureCommandTranslator()` fake — `CombatScreen` los llama
// síncronamente justo después de `scene.start(...)` dentro del handler de `READY`.
const fakeTargetingSignal = { getState: () => ({ kind: 'NONE' as const }), subscribe: () => () => {} };
const fakeGestureHandle = { handleCardTap: vi.fn(), handleAbilityTap: vi.fn(), cancelPending: vi.fn() };
// NUEVO H5.9 §2 — `CombatScene.getEffectsQueueSignal()`, mismo espíritu de mock que el resto de este
// archivo (superficie mínima, sin cola de reproducción real).
const fakeEffectsQueueSignal = { isDraining: () => false, subscribe: () => () => {} };

vi.mock('phaser', () => {
  class FakeGame {
    events = { once: (_evt: string, cb: () => void) => cb() };
    scene = {
      add: vi.fn(() => ({
        getTargetingSignal: () => fakeTargetingSignal,
        getGestureCommandTranslator: () => fakeGestureHandle,
        getEffectsQueueSignal: () => fakeEffectsQueueSignal,
      })),
      start: vi.fn(),
    };
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
  // H4 spec §2 — `CombatBoardOverlay` (renderizado dentro de `CombatScreen`) lee estas constantes de
  // posición/paneles vía `@collector/combat-scene`; el mock debe exponerlas con valores mínimos
  // arbitrarios (el test no verifica coordenadas, solo el flujo de navegación end-to-end).
  LEADER_POSITION: { x: 540, y: 1708 },
  ENEMY_POSITION: { x: 540, y: 300 },
  SCENARIO_POSITION: { x: 540, y: 960 },
  PANEL_ZONES: [],
  // NUEVO H4 spec §6 — `HandCardRow`/`AbilityRow` (renderizados dentro de `CombatBoardOverlay`) leen
  // estas constantes de posición vía `@collector/combat-scene`.
  HAND_ROW_POSITION: { x: 540, y: 1498 },
  TILE_SEPARATION_PX: 140,
  LEADER_ABILITIES_ROW_Y: 1888,
  ENEMY_ABILITIES_ROW_Y: 480,
  ABILITY_ICON_SEPARATION_PX: 200,
  // NUEVO H5.7 §3.1 — `SideActionRail` (renderizado dentro de `CombatBoardOverlay`) lee estas
  // constantes de posición vía `@collector/combat-scene`.
  SIDE_ACTION_RAIL_X: 76,
  SIDE_ACTION_RAIL_Y: 1030,
  SIDE_ACTION_RAIL_GAP_PX: 96,
  RAIL_CHIP_HALF_WIDTH_PX: 55,
  RAIL_CHIP_HEIGHT_PX: 44,
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
  enemyActiveDramaturgiaCardId: null,
};

const fakeBridge = {
  dispatch: vi.fn(),
  getSnapshot: () => fakeSnapshot,
  subscribeHudEvents: vi.fn(() => vi.fn()),
  subscribeSceneEvents: vi.fn(() => vi.fn()),
} as unknown as CombatBridge;

const buildCombatSetupMock = vi.fn(
  (_params: { readonly leaderId?: string; readonly enemyId?: string; readonly scenarioId?: string }) =>
    Promise.resolve({
      bridge: fakeBridge,
      boardContext: { leaderCardPool: [], leaderAbilities: [], enemyAbilities: [], enemyDramaturgiaDeck: [] },
    })
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
    expect(await screen.findByText('Acciones')).toBeInTheDocument();
    // H4 spec §6 — `CombatHud` ya no prefija "Líder: " (mockup §6, solo el nombre en `TYPE.displaySm`
    // junto al contador de acciones); el mismo nombre también aparece en `CombatBoardOverlay`
    // (línea de rol), así que se verifica dentro del contenedor `.combat-hud` específicamente.
    expect(document.querySelector('.combat-hud')?.textContent).toContain('Soldado Base');
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
    expect(await screen.findByText('Acciones')).toBeInTheDocument();
    expect(document.querySelector('.combat-hud')?.textContent).toContain('Mago Base');
    expect(document.querySelector('.combat-hud')?.textContent).not.toContain('Soldado Base');
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
    expect(await screen.findByText('Acciones')).toBeInTheDocument();
    // H4 spec §6 — `CombatHud` ya no prefija "Líder: " (mockup §6, solo el nombre en `TYPE.displaySm`
    // junto al contador de acciones); el mismo nombre también aparece en `CombatBoardOverlay`
    // (línea de rol), así que se verifica dentro del contenedor `.combat-hud` específicamente.
    expect(document.querySelector('.combat-hud')?.textContent).toContain('Soldado Base');
    expect(buildCombatSetupMock).toHaveBeenCalledWith({
      leaderId: 'leader-soldado-base',
      enemyId: 'enemy-bestia-base',
      scenarioId: 'scenario-bosque-encantado-base',
    });
  });
});
