// FIX Reviewer post-H3 (commit `cce72a3`) — `CombatHud.tsx` no tenía test propio. H5.5 corrección
// 2026-07-13 — `CombatHud` perdió los 4 botones de categoría (Jugar Carta/Activar Habilidad/Generar
// Energía/Robar Carta) y "Fin de turno" (H5.9): este archivo cubre lo que queda (nombre del Líder,
// contador de acciones, franja de paso previo gratuito) y `disabledReasonFor` (helper puro,
// reutilizado por `SideActionRail`).
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
// `ability-activation.ts` — así el test sigue ejercitando el comportamiento real de
// `disabledReasonFor`, no un stub ciego.
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
import { CombatHud, disabledReasonFor } from './CombatHud';

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
    <CombatHud snapshot={snapshot} bridge={bridge} leaderName="Líder de prueba" leaderAbilities={abilities} />,
  );
  return { bridge };
}

describe('CombatHud', () => {
  it('renderiza el nombre del Líder y el contador de acciones, sin ningún botón de categoría ni "Fin de turno" (H5.5 corrección)', () => {
    renderHud(createMockSnapshot());

    expect(screen.getByText('Líder de prueba')).toBeInTheDocument();
    expect(screen.getByText('Acciones')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Jugar Carta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activar Habilidad' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generar Energía' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Robar Carta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fin de turno' })).not.toBeInTheDocument();
  });

  it('paso previo disponible: "Robar carta (gratis)"/"Generar energía (gratis)" habilitados', () => {
    renderHud(createMockSnapshot({ leaderDeckRemaining: 10, leaderEnergy: 2 }));

    expect(screen.getByRole('button', { name: 'Robar carta (gratis)' })).toBeEnabled();
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

  it('click en "Robar carta (gratis)" despacha DRAW_OR_GENERATE(action: draw) directamente', () => {
    const { bridge } = renderHud(createMockSnapshot({ leaderDeckRemaining: 10 }));

    screen.getByRole('button', { name: 'Robar carta (gratis)' }).click();

    expect(bridge.dispatch).toHaveBeenCalledWith({ type: 'DRAW_OR_GENERATE', action: 'draw' });
  });
});

describe('disabledReasonFor (helper puro, reutilizado por SideActionRail)', () => {
  it('habilidad CONTROL lista (CD 0) pero solo dado CAOS disponible: motivo no-null', () => {
    const snapshot = createMockSnapshot({
      cooldowns: [{ abilityId: CONTROL_ABILITY_ID, side: 'LEADER', baseCooldown: 2, remaining: 0 }],
      nucleoTable: [mockDie('n1', 'CAOS')],
    });

    expect(disabledReasonFor('ACTIVATE_ABILITY', snapshot, leaderAbilities)).not.toBeNull();
  });

  it('habilidad CONTROL lista y un dado CONTROL disponible: sin motivo (disponible)', () => {
    const snapshot = createMockSnapshot({
      cooldowns: [{ abilityId: CONTROL_ABILITY_ID, side: 'LEADER', baseCooldown: 2, remaining: 0 }],
      nucleoTable: [mockDie('n1', 'CAOS'), mockDie('n2', 'CONTROL')],
    });

    expect(disabledReasonFor('ACTIVATE_ABILITY', snapshot, leaderAbilities)).toBeNull();
  });

  it('mano vacía: PLAY_CARD con motivo', () => {
    const snapshot = createMockSnapshot({ leaderHand: [] });

    expect(disabledReasonFor('PLAY_CARD', snapshot, leaderAbilities)).toBe('Sin cartas en mano');
  });

  it('Energía al tope: GENERATE_ENERGY con motivo', () => {
    const snapshot = createMockSnapshot({ leaderEnergy: 5 });

    expect(disabledReasonFor('GENERATE_ENERGY', snapshot, leaderAbilities)).toBe('Energía al máximo (5/5)');
  });

  it('mazo vacío: DRAW_CARD con motivo', () => {
    const snapshot = createMockSnapshot({ leaderDeckRemaining: 0 });

    expect(disabledReasonFor('DRAW_CARD', snapshot, leaderAbilities)).toBe('Mazo vacío');
  });
});
