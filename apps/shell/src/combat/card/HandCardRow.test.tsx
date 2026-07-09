// Fix Reviewer post-H4 (`docs/specs/H4_componente_carta.md` §1/§4/§6) — cero tests para todo el
// árbol `apps/shell/src/combat/card/`. Cubre, vía React Testing Library (mismo patrón que
// `CombatHud.test.tsx`): afordabilidad por Energía (opacidad reducida/no interactuable), render de
// `ruleText`, render de keywords como pills, y el ciclo completo de "jugar una carta" (sale de
// `leaderHand`, se le añade la clase de animación de salida `card-tile--playing`, y sigue montada
// hasta `onAnimationEnd` — no se desmonta a mitad de transición).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createId } from '@collector/domain-shared';
import type { CardId } from '@collector/domain-shared';
import type { CombatStateSnapshot } from '@collector/domain-combat';

// `HandCardRow.tsx` importa `HAND_ROW_POSITION`/`TILE_SEPARATION_PX` (valores reales, no solo tipos)
// del barrel `@collector/combat-scene`, que también reexporta `CombatScene` y arrastra
// `phaser`/`CanvasFeatures` — rompe bajo jsdom (mismo motivo documentado en `CombatHud.test.tsx`).
// Se mockea con los mismos valores reales de `board-layout.ts` (x:540, y:1498, separación 140px).
vi.mock('@collector/combat-scene', () => ({
  HAND_ROW_POSITION: { x: 540, y: 1498 },
  TILE_SEPARATION_PX: 140,
}));

// eslint-disable-next-line import/first -- debe importarse después del `vi.mock` de arriba
import type { BoardViewContext, GestureCommandTranslatorHandle, HandCardViewData } from '@collector/combat-scene';
// eslint-disable-next-line import/first
import { HandCardRow } from './HandCardRow';

function mockCardId(value: string): CardId {
  return createId('CardId', value) as CardId;
}

const CHEAP_CARD_ID = mockCardId('card-cheap');
const EXPENSIVE_CARD_ID = mockCardId('card-expensive');

const CHEAP_CARD: HandCardViewData = {
  cardId: CHEAP_CARD_ID,
  name: 'Golpe Certero',
  energyCost: 1,
  cardType: 'EVENTO',
  requiresNucleoInstance: false,
  keywords: [{ keyword: 'ATAQUE_MAS_X', amount: 2 }, { keyword: 'ARROLLAR' }],
  ruleText: 'Ataque +2. Si el objetivo tiene menos de 5 de vida, Arrollar.',
};

const EXPENSIVE_CARD: HandCardViewData = {
  cardId: EXPENSIVE_CARD_ID,
  name: 'Furia Desatada',
  energyCost: 4,
  cardType: 'EVENTO',
  requiresNucleoInstance: false,
  keywords: [{ keyword: 'ATAQUE' }],
};

function createMockCtx(cardPool: readonly HandCardViewData[]): BoardViewContext {
  return {
    nameLookup: {} as BoardViewContext['nameLookup'],
    leaderMaxHealth: 20,
    enemyMaxHealth: 20,
    scenarioPlotDefeatThreshold: 10,
    leaderCardPool: cardPool,
    leaderAbilities: [],
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
    leaderHand: [CHEAP_CARD_ID, EXPENSIVE_CARD_ID],
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
    cancelPending: vi.fn(),
  };
}

describe('HandCardRow', () => {
  it('carta que el jugador PUEDE pagar (leaderEnergy >= energyCost): opacidad 1 y onTap real (interactuable)', () => {
    const snapshot = createMockSnapshot({ leaderEnergy: 2 });
    const ctx = createMockCtx([CHEAP_CARD, EXPENSIVE_CARD]);
    const gestureHandle = createFakeGestureHandle();

    render(<HandCardRow snapshot={snapshot} ctx={ctx} gestureHandle={gestureHandle} />);

    const cheapTile = document.querySelector(`[data-card-id="${CHEAP_CARD_ID}"]`) as HTMLElement;
    expect(cheapTile).toBeTruthy();
    expect(cheapTile.style.opacity).toBe('1');
    expect(cheapTile.style.pointerEvents).toBe('auto');

    fireEvent.click(cheapTile);
    expect(gestureHandle.handleCardTap).toHaveBeenCalledWith(CHEAP_CARD_ID);
  });

  it('carta que el jugador NO PUEDE pagar (leaderEnergy < energyCost): opacidad reducida (0.4 = ALPHA_UNAFFORDABLE, §1.4)', () => {
    const snapshot = createMockSnapshot({ leaderEnergy: 2 });
    const ctx = createMockCtx([CHEAP_CARD, EXPENSIVE_CARD]);
    const gestureHandle = createFakeGestureHandle();

    render(<HandCardRow snapshot={snapshot} ctx={ctx} gestureHandle={gestureHandle} />);

    const expensiveTile = document.querySelector(`[data-card-id="${EXPENSIVE_CARD_ID}"]`) as HTMLElement;
    expect(expensiveTile).toBeTruthy();
    expect(expensiveTile.style.opacity).toBe('0.4');

    const cheapTile = document.querySelector(`[data-card-id="${CHEAP_CARD_ID}"]`) as HTMLElement;
    expect(cheapTile.style.opacity).toBe('1');
  });

  it('renderiza el ruleText de la carta cuando está presente', () => {
    const snapshot = createMockSnapshot();
    const ctx = createMockCtx([CHEAP_CARD, EXPENSIVE_CARD]);
    render(<HandCardRow snapshot={snapshot} ctx={ctx} gestureHandle={createFakeGestureHandle()} />);

    expect(
      screen.getByText('Ataque +2. Si el objetivo tiene menos de 5 de vida, Arrollar.'),
    ).toBeInTheDocument();
  });

  it('renderiza las keywords de la carta como pills con su label traducido', () => {
    const snapshot = createMockSnapshot();
    const ctx = createMockCtx([CHEAP_CARD, EXPENSIVE_CARD]);
    render(<HandCardRow snapshot={snapshot} ctx={ctx} gestureHandle={createFakeGestureHandle()} />);

    expect(screen.getByText('Ataque +2')).toBeInTheDocument();
    expect(screen.getByText('Arrollar')).toBeInTheDocument();
  });

  it('ciclo completo de jugar una carta: al salir de leaderHand, la carta sigue montada con card-tile--playing hasta onAnimationEnd, sin desmontarse a mitad de transición', () => {
    const ctx = createMockCtx([CHEAP_CARD, EXPENSIVE_CARD]);
    const gestureHandle = createFakeGestureHandle();
    const { rerender } = render(
      <HandCardRow
        snapshot={createMockSnapshot({ leaderHand: [CHEAP_CARD_ID, EXPENSIVE_CARD_ID] })}
        ctx={ctx}
        gestureHandle={gestureHandle}
      />,
    );

    expect(document.querySelector(`[data-card-id="${CHEAP_CARD_ID}"]`)).toBeTruthy();

    // El motor confirma la jugada de CHEAP_CARD_ID: ya no está en leaderHand.
    rerender(
      <HandCardRow
        snapshot={createMockSnapshot({ leaderHand: [EXPENSIVE_CARD_ID] })}
        ctx={ctx}
        gestureHandle={gestureHandle}
      />,
    );

    // Sigue montada (exit animation en curso), con la clase que dispara la transición CSS.
    const exitingTile = document.querySelector(`[data-card-id="${CHEAP_CARD_ID}"]`) as HTMLElement;
    expect(exitingTile).toBeTruthy();
    expect(exitingTile.className).toContain('card-tile--playing');
    // Ya no recibe onTap real mientras sale (solo onAnimationEnd) — un click no debe disparar el tap.
    fireEvent.click(exitingTile);
    expect(gestureHandle.handleCardTap).not.toHaveBeenCalledWith(CHEAP_CARD_ID);

    // Al completar la animación DOM, el componente limpia el estado y la carta se desmonta.
    fireEvent.animationEnd(exitingTile);
    expect(document.querySelector(`[data-card-id="${CHEAP_CARD_ID}"]`)).toBeNull();

    // La carta restante sigue montada normalmente, interactuable.
    const remainingTile = document.querySelector(`[data-card-id="${EXPENSIVE_CARD_ID}"]`) as HTMLElement;
    expect(remainingTile).toBeTruthy();
    expect(remainingTile.className).not.toContain('card-tile--playing');
  });
});
