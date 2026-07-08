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

vi.mock('phaser', () => {
  class FakeGame {
    events = { once: (_evt: string, cb: () => void) => cb() };
    scene = { add: vi.fn(), start: vi.fn() };
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

vi.mock('../combat/build-combat-setup', () => ({
  buildCombatSetup: () => Promise.resolve({ bridge: fakeBridge, boardContext: {} }),
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
