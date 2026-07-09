// FIX_combat_viewport_and_layout.md §3.1 punto 1 — regresión de Bug 1: el contenedor de Phaser
// (`config.parent`, el mismo `mountRef.current` que `CombatScreen` pasa a `new Phaser.Game(...)`)
// debe tener un ancestro con la clase `combat-screen-root` (definida en `CombatScreen.css`, §1.2
// punto 2) ANTES de que Phaser intente medir su tamaño — regresión de "el contenedor tiene una
// clase de tamaño, no solo un `<div>` vacío sin CSS". jsdom no calcula layout real (`clientWidth`/
// `clientHeight` siempre son 0 independientemente del CSS aplicado), así que este test NO puede
// verificar el tamaño en píxeles — eso lo cubre el E2E de Playwright (§3.1 punto 2). Mismo mock de
// `phaser`/`@collector/combat-scene`/`./combat/build-combat-setup` que `App.test.tsx` (líneas 14-35).
import { vi, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatStateSnapshot } from '@collector/domain-combat';

let capturedParent: HTMLElement | null = null;

// NUEVO H4 spec §5.2/§6.1 — ver App.test.tsx, mismo espíritu de mock.
const fakeTargetingSignal = { getState: () => ({ kind: 'NONE' as const }), subscribe: () => () => {} };
const fakeGestureHandle = { handleCardTap: vi.fn(), handleAbilityTap: vi.fn(), cancelPending: vi.fn() };

vi.mock('phaser', () => {
  class FakeGame {
    events = { once: (_evt: string, cb: () => void) => cb() };
    scene = {
      add: vi.fn(() => ({
        getTargetingSignal: () => fakeTargetingSignal,
        getGestureCommandTranslator: () => fakeGestureHandle,
      })),
      start: vi.fn(),
    };
    destroy = vi.fn();
    constructor(config: { parent: HTMLElement }) {
      capturedParent = config.parent;
    }
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
  // arbitrarios (el test no verifica coordenadas, solo que el árbol renderiza sin lanzar).
  LEADER_POSITION: { x: 540, y: 1708 },
  ENEMY_POSITION: { x: 540, y: 300 },
  SCENARIO_POSITION: { x: 540, y: 960 },
  PANEL_ZONES: [],
  HAND_ROW_POSITION: { x: 540, y: 1498 },
  TILE_SEPARATION_PX: 140,
  LEADER_ABILITIES_ROW_Y: 1888,
  ENEMY_ABILITIES_ROW_Y: 480,
  ABILITY_ICON_SEPARATION_PX: 200,
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

vi.mock('../combat/build-combat-setup', () => ({
  buildCombatSetup: () =>
    Promise.resolve({
      bridge: fakeBridge,
      // H4 spec §2 — `CombatBoardOverlay` (renderizado dentro de `CombatScreen`) lee estos campos de
      // `boardContext` para la línea de rol; valores mínimos arbitrarios, el test no verifica su
      // contenido numérico, solo que el árbol renderiza sin lanzar.
      boardContext: {
        leaderCardPool: [],
        leaderAbilities: [],
        enemyAbilities: [],
        enemyDramaturgiaDeck: [],
        leaderMaxHealth: 30,
        enemyMaxHealth: 40,
        scenarioPlotDefeatThreshold: 10,
      },
    }),
}));

describe('CombatScreen — contenedor de Phaser con tamaño real (Bug 1, FIX_combat_viewport_and_layout.md §1)', () => {
  it('el <div> raíz usa className="combat-screen-root" y el parent pasado a new Phaser.Game(...) es su descendiente', async () => {
    const { CombatScreen } = await import('./CombatScreen');
    render(
      <MemoryRouter>
        <CombatScreen />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Fin de turno')).toBeInTheDocument();

    const root = document.querySelector('.combat-screen-root');
    expect(root).not.toBeNull();

    const mount = document.getElementById('phaser-mount');
    expect(mount).not.toBeNull();
    expect(root?.contains(mount)).toBe(true);

    // `config.parent` de `new Phaser.Game(...)` es exactamente `mountRef.current` (`#phaser-mount`),
    // descendiente directo de `.combat-screen-root` — el ancestro con la clase de tamaño ya existe
    // en el DOM en el momento de construir el `Game`.
    expect(capturedParent).toBe(mount);
    expect(capturedParent?.closest('.combat-screen-root')).not.toBeNull();
  });
});
