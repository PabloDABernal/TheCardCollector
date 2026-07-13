// H5.5 spec §8 casos 5-6 — gating de `HandCardRow`/`AbilityRow` (Líder) por `stage` (revelación
// progresiva, H5.2). Mismo motivo de mock que `HandCardRow.test.tsx`: el barrel
// `@collector/combat-scene` reexporta `CombatScene`, que arrastra `phaser`/`CanvasFeatures` — rompe
// bajo jsdom. Se mockea con los mismos valores reales de `board-layout.ts` que consumen
// `CombatBoardOverlay.tsx` y sus hijos (`HandCardRow`/`AbilityRow`/`MinionRow`/`AllyRow`/
// `EnemyDramaturgiaCardSlot`).
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createId } from '@collector/domain-shared';
import type { CardId } from '@collector/domain-shared';
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

const TRANSFORM = { offsetX: 0, offsetY: 0, scale: 1 };

describe('CombatBoardOverlay — H5.5 §8 casos 5-6 (gating por stage)', () => {
  it('5. stage CATEGORY: HandCardRow NO está en el árbol renderizado, AbilityRow del Líder recibe visible=false (sin tiles renderizados)', () => {
    render(
      <CombatBoardOverlay
        snapshot={createMockSnapshot()}
        ctx={createMockCtx()}
        transform={TRANSFORM}
        leaderName="Líder de prueba"
        gestureHandle={createFakeGestureHandle()}
        targetingPrompt={{ kind: 'NONE' }}
        stage={{ stage: 'CATEGORY' }}
      />,
    );

    expect(document.querySelector('[data-card-id="card-1"]')).toBeNull();
    expect(screen.queryByText('Habilidad 1')).not.toBeInTheDocument();
  });

  it('6. stage DETAIL/PLAY_CARD: HandCardRow SÍ está presente; AbilityRow del Líder sigue visible=false; AbilityRow del Enemigo sigue presente por defecto', () => {
    render(
      <CombatBoardOverlay
        snapshot={createMockSnapshot()}
        ctx={createMockCtx()}
        transform={TRANSFORM}
        leaderName="Líder de prueba"
        gestureHandle={createFakeGestureHandle()}
        targetingPrompt={{ kind: 'NONE' }}
        stage={{ stage: 'DETAIL', category: 'PLAY_CARD' }}
      />,
    );

    expect(document.querySelector('[data-card-id="card-1"]')).toBeTruthy();
    expect(screen.queryByText('Habilidad 1')).not.toBeInTheDocument();
  });

  it('stage DETAIL/ACTIVATE_ABILITY: AbilityRow del Líder visible (tile renderizado), HandCardRow oculta', () => {
    render(
      <CombatBoardOverlay
        snapshot={createMockSnapshot()}
        ctx={createMockCtx()}
        transform={TRANSFORM}
        leaderName="Líder de prueba"
        gestureHandle={createFakeGestureHandle()}
        targetingPrompt={{ kind: 'NONE' }}
        stage={{ stage: 'DETAIL', category: 'ACTIVATE_ABILITY' }}
      />,
    );

    expect(screen.getByText('Habilidad 1')).toBeInTheDocument();
    expect(document.querySelector('[data-card-id="card-1"]')).toBeNull();
  });
});
