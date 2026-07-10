// FIX Reviewer post-H3 (commit `cce72a3`) — `CombatHud.tsx` no tenía test propio. Cubre el bug que
// motivó `isAnyLeaderAbilityActivatable`/`ability-activation.ts` (agregado laxo de disponibilidad
// de "Activar Habilidad" que no cruzaba color de dado libre contra `coreCost` real) más los demás
// indicadores/botones de los 5 controles + paso previo (spec §6, decisions.md "Estructura del turno
// del jugador"). Mismo espíritu de "`CombatBridge` fake mínimo, `CombatStateSnapshot` construido a
// mano" que `gesture-command-translator.test.ts` (`packages/combat-scene`).
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createId, satisfiesCoreCost } from '@collector/domain-shared';
import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatStateSnapshot, NucleoDie } from '@collector/domain-combat';
import type { AbilityViewData } from '@collector/combat-scene';

// `@collector/combat-scene`'s barrel (`src/index.ts`) también reexporta `CombatScene`, que arrastra
// `phaser` y sus side effects de `CanvasFeatures` al importar el módulo — rompe bajo jsdom (mismo
// motivo por el que `App.test.tsx`/`CombatScreen.test.tsx` mockean todo el paquete). Aquí se mockea
// igual, pero reimplementando `isAnyLeaderAbilityActivatable` con la MISMA lógica real
// (`satisfiesCoreCost`, `@collector/domain-shared`, sin dependencia de Phaser) que
// `ability-activation.ts` — así el test sigue ejercitando el comportamiento real del HUD, no un
// stub ciego.
vi.mock('@collector/combat-scene', () => ({
  isAnyLeaderAbilityActivatable: (
    snapshot: CombatStateSnapshot,
    abilities: readonly AbilityViewData[],
  ): boolean => {
    const abilitiesById = new Map(abilities.map((ability) => [ability.abilityId, ability]));
    return snapshot.cooldowns.some((cooldown) => {
      if (cooldown.side !== 'LEADER' || cooldown.remaining !== 0) return false;
      const ability = abilitiesById.get(cooldown.abilityId);
      if (!ability) return false;
      return snapshot.nucleoTable.some(
        (die) => die.status === 'AVAILABLE' && satisfiesCoreCost(ability.coreCost, die.color),
      );
    });
  },
}));

// eslint-disable-next-line import/first -- debe importarse después del `vi.mock` de arriba
import { CombatHud } from './CombatHud';

function mockAbilityId(value: string) {
  return createId('AbilityId', value);
}

function mockNucleoInstanceId(value: string) {
  return createId('NucleoInstanceId', value);
}

const CONTROL_ABILITY_ID = mockAbilityId('ability-control');

const leaderAbilities: readonly AbilityViewData[] = [
  {
    abilityId: CONTROL_ABILITY_ID,
    name: 'Habilidad CONTROL',
    baseCooldown: 2,
    coreCost: { kind: 'COLOR', colors: ['CONTROL'] },
    effectKind: 'NONE',
  },
];

function mockDie(id: string, color: NucleoDie['color'], overrides: Partial<NucleoDie> = {}): NucleoDie {
  return { id: mockNucleoInstanceId(id), color, value: 2, kind: 'FIXED', status: 'AVAILABLE', ...overrides };
}

function createMockSnapshot(overrides: Partial<CombatStateSnapshot> = {}): CombatStateSnapshot {
  const base: CombatStateSnapshot = {
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

function renderHud(snapshot: CombatStateSnapshot, abilities: readonly AbilityViewData[] = leaderAbilities) {
  const bridge = createFakeBridge();
  render(
    <CombatHud
      snapshot={snapshot}
      bridge={bridge}
      onEndTurn={vi.fn()}
      leaderName="Líder de prueba"
      leaderAbilities={abilities}
    />,
  );
  return bridge;
}

describe('CombatHud', () => {
  it('habilidad CONTROL lista (CD 0) pero solo dado CAOS disponible: "Activar Habilidad" deshabilitado (bug que motivó el fix)', () => {
    const snapshot = createMockSnapshot({
      cooldowns: [{ abilityId: CONTROL_ABILITY_ID, side: 'LEADER', baseCooldown: 2, remaining: 0 }],
      nucleoTable: [mockDie('n1', 'CAOS')],
    });
    renderHud(snapshot);

    expect(screen.getByText('Activar Habilidad')).toHaveAttribute('aria-disabled', 'true');
  });

  it('habilidad CONTROL lista y un dado CONTROL disponible: "Activar Habilidad" habilitado', () => {
    const snapshot = createMockSnapshot({
      cooldowns: [{ abilityId: CONTROL_ABILITY_ID, side: 'LEADER', baseCooldown: 2, remaining: 0 }],
      nucleoTable: [mockDie('n1', 'CAOS'), mockDie('n2', 'CONTROL')],
    });
    renderHud(snapshot);

    expect(screen.getByText('Activar Habilidad')).toHaveAttribute('aria-disabled', 'false');
  });

  it('mano vacía: "Jugar Carta" deshabilitado', () => {
    const snapshot = createMockSnapshot({ leaderHand: [] });
    renderHud(snapshot);

    expect(screen.getByText('Jugar Carta')).toHaveAttribute('aria-disabled', 'true');
  });

  it('Energía al tope: "Generar Energía" deshabilitado', () => {
    const snapshot = createMockSnapshot({ leaderEnergy: 5 });
    renderHud(snapshot);

    expect(screen.getByRole('button', { name: 'Generar Energía' })).toBeDisabled();
  });

  it('mazo vacío: "Robar Carta" deshabilitado pero el paso previo sigue permitiendo generar energía', () => {
    const snapshot = createMockSnapshot({ leaderDeckRemaining: 0, leaderEnergy: 2 });
    renderHud(snapshot);

    expect(screen.getByRole('button', { name: 'Robar Carta' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Generar energía (gratis)' })).toBeEnabled();
  });

  it('paso previo ya tomado este turno: controles del paso previo deshabilitados', () => {
    const snapshot = createMockSnapshot({
      leaderFreeStep: { takenThisTurn: true },
      leaderDeckRemaining: 10,
      leaderEnergy: 2,
    });
    renderHud(snapshot);

    expect(screen.getByRole('button', { name: 'Robar carta (gratis)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Generar energía (gratis)' })).toBeDisabled();
  });
});
