// H5.5 corrección 2026-07-13 — reemplaza los casos de gating por `stage` (H5.2 retirado): mano y
// habilidades del Líder vuelven a estar SIEMPRE visibles/interactivas durante el turno del jugador.
// Mismo motivo de mock que `HandCardRow.test.tsx`: el barrel `@collector/combat-scene` reexporta
// `CombatScene`, que arrastra `phaser`/`CanvasFeatures` — rompe bajo jsdom. Se mockea con los mismos
// valores reales de `board-layout.ts` que consumen `CombatBoardOverlay.tsx` y sus hijos
// (`HandCardRow`/`AbilityRow`/`MinionRow`/`AllyRow`/`SideActionRail`/`EnemyDramaturgiaCardSlot`).
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createId } from '@collector/domain-shared';
import type { CardId } from '@collector/domain-shared';
import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatStateSnapshot } from '@collector/domain-combat';

vi.mock('@collector/combat-scene', () => ({
  COMBAT_SCENE_VIEWPORT: { width: 1080, height: 2060 },
  LEADER_POSITION: { x: 540, y: 1890 },
  ENEMY_POSITION: { x: 540, y: 110 },
  SCENARIO_POSITION: { x: 540, y: 504 },
  PANEL_ZONES: [],
  LEADER_ABILITIES_ROW_Y: 2010,
  ENEMY_ABILITIES_ROW_Y: 230,
  ALLIES_ROW_X_ORIGIN: 200,
  ALLIES_ROW_Y: 1538,
  MINIONS_ROW_X_ORIGIN: 200,
  MINIONS_ROW_Y: 338,
  HAND_ROW_POSITION: { x: 540, y: 1724 },
  TILE_SEPARATION_PX: 140,
  ABILITY_ICON_SEPARATION_PX: 200,
  SIDE_ACTION_RAIL_X: 76,
  SIDE_ACTION_RAIL_Y: 1030,
  SIDE_ACTION_RAIL_GAP_PX: 96,
  RAIL_CHIP_HALF_WIDTH_PX: 55,
  RAIL_CHIP_HEIGHT_PX: 44,
  isAnyLeaderAbilityActivatable: vi.fn(() => false),
}));

// eslint-disable-next-line import/first -- debe importarse después del `vi.mock` de arriba
import type { BoardViewContext, GestureCommandTranslatorHandle } from '@collector/combat-scene';
// eslint-disable-next-line import/first
import { CombatBoardOverlay } from './CombatBoardOverlay';

function mockCardId(value: string): CardId {
  return createId('CardId', value) as CardId;
}

function createMockCtx(): BoardViewContext {
  return {
    nameLookup: {} as BoardViewContext['nameLookup'],
    leaderMaxHealth: 20,
    enemyMaxHealth: 20,
    scenarioPlotDefeatThreshold: 10,
    leaderCardPool: [
      {
        cardId: mockCardId('card-1'),
        name: 'Golpe Certero',
        energyCost: 1,
        cardType: 'EVENTO',
        requiresNucleoInstance: false,
        keywords: [],
      },
    ],
    leaderAbilities: [
      {
        abilityId: createId('AbilityId', 'ability-1'),
        name: 'Habilidad 1',
        baseCooldown: 2,
        coreCost: { kind: 'COLOR', colors: ['CONTROL'] },
        effectKind: 'NONE',
      },
    ],
    enemyAbilities: [],
    enemyDramaturgiaDeck: [],
  };
}

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
    leaderHand: [mockCardId('card-1')],
    leaderDeckRemaining: 10,
    leaderFreeStep: { takenThisTurn: false },
    enemyActiveDramaturgiaCardId: null,
  };
  return { ...base, ...overrides };
}

function createFakeGestureHandle(): GestureCommandTranslatorHandle {
  return {
    handleCardTap: vi.fn(),
    handleAbilityTap: vi.fn(),
    handleMinionTap: vi.fn(),
    cancelPending: vi.fn(),
  };
}

function createFakeBridge(): CombatBridge {
  return {
    dispatch: vi.fn(() => ({ ok: true, value: [] })),
    getSnapshot: vi.fn(),
    subscribeHudEvents: vi.fn(() => vi.fn()),
    subscribeSceneEvents: vi.fn(() => vi.fn()),
  } as unknown as CombatBridge;
}

const TRANSFORM = { offsetX: 0, offsetY: 0, scale: 1 };

describe('CombatBoardOverlay — H5.5 corrección 2026-07-13 (mano/habilidades siempre visibles)', () => {
  it('con gestureHandle no-nulo: HandCardRow SIEMPRE está en el árbol, AbilityRow del Líder SIEMPRE interactive', () => {
    render(
      <CombatBoardOverlay
        snapshot={createMockSnapshot()}
        ctx={createMockCtx()}
        transform={TRANSFORM}
        leaderName="Líder de prueba"
        gestureHandle={createFakeGestureHandle()}
        targetingPrompt={{ kind: 'NONE' }}
        bridge={createFakeBridge()}
      />,
    );

    expect(document.querySelector('[data-card-id="card-1"]')).toBeTruthy();
    expect(screen.getByText('Habilidad 1')).toBeInTheDocument();
  });

  it('tap directo en una carta de mano dispara handleCardTap sin ningún paso previo de "elegir categoría"', () => {
    const gestureHandle = createFakeGestureHandle();
    render(
      <CombatBoardOverlay
        snapshot={createMockSnapshot()}
        ctx={createMockCtx()}
        transform={TRANSFORM}
        leaderName="Líder de prueba"
        gestureHandle={gestureHandle}
        targetingPrompt={{ kind: 'NONE' }}
        bridge={createFakeBridge()}
      />,
    );

    document.querySelector<HTMLElement>('[data-card-id="card-1"]')!.click();

    expect(gestureHandle.handleCardTap).toHaveBeenCalledWith(mockCardId('card-1'));
  });

  it('tap directo en un icono de habilidad dispara handleAbilityTap sin paso previo', () => {
    const gestureHandle = createFakeGestureHandle();
    const abilityId = createId('AbilityId', 'ability-1');
    render(
      <CombatBoardOverlay
        snapshot={createMockSnapshot()}
        ctx={createMockCtx()}
        transform={TRANSFORM}
        leaderName="Líder de prueba"
        gestureHandle={gestureHandle}
        targetingPrompt={{ kind: 'NONE' }}
        bridge={createFakeBridge()}
      />,
    );

    document.querySelector<HTMLElement>(`[data-ability-id="${abilityId}"]`)!.click();

    expect(gestureHandle.handleAbilityTap).toHaveBeenCalledWith(abilityId);
  });

  it('sin gestureHandle (todavía no READY): ni HandCardRow ni AbilityRow del Líder son interactivos, pero SideActionRail sigue montado', () => {
    render(
      <CombatBoardOverlay
        snapshot={createMockSnapshot()}
        ctx={createMockCtx()}
        transform={TRANSFORM}
        leaderName="Líder de prueba"
        gestureHandle={null}
        targetingPrompt={{ kind: 'NONE' }}
        bridge={createFakeBridge()}
      />,
    );

    expect(document.querySelector('[data-card-id="card-1"]')).toBeNull();
    expect(screen.getByRole('button', { name: /Energía/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Robar/ })).toBeInTheDocument();
  });

  it('SideActionRail: click en "Robar Carta" (habilitado) despacha DRAW_CARD directo, sin ningún intermediario', () => {
    const bridge = createFakeBridge();
    render(
      <CombatBoardOverlay
        snapshot={createMockSnapshot({ leaderDeckRemaining: 10, leaderHand: [] })}
        ctx={createMockCtx()}
        transform={TRANSFORM}
        leaderName="Líder de prueba"
        gestureHandle={createFakeGestureHandle()}
        targetingPrompt={{ kind: 'NONE' }}
        bridge={bridge}
      />,
    );

    screen.getByRole('button', { name: /Robar/ }).click();

    expect(bridge.dispatch).toHaveBeenCalledWith({ type: 'DRAW_CARD' });
  });

  it('SideActionRail: click en "Generar Energía" (habilitado) despacha GENERATE_ENERGY directo', () => {
    const bridge = createFakeBridge();
    render(
      <CombatBoardOverlay
        snapshot={createMockSnapshot({ leaderEnergy: 2 })}
        ctx={createMockCtx()}
        transform={TRANSFORM}
        leaderName="Líder de prueba"
        gestureHandle={createFakeGestureHandle()}
        targetingPrompt={{ kind: 'NONE' }}
        bridge={bridge}
      />,
    );

    screen.getByRole('button', { name: /Energía/ }).click();

    expect(bridge.dispatch).toHaveBeenCalledWith({ type: 'GENERATE_ENERGY' });
  });
});
