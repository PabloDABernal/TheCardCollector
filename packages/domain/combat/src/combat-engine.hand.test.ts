import { describe, it, expect } from 'vitest';
import { SeededRandomSource, createId, isOk, isErr, type AbilityId, type CardId, type CoreCostRequirement } from '@collector/domain-shared';
import { CombatEngine } from './combat-engine';
import type { CombatCommandError } from './types/errors';
import type { CombatEvent } from './types/events';
import type { CombatEngineConfig } from './types/config';
import type { AbilityCooldownDefinition } from './types/cooldown';
import type { PlayableCardDefinition } from './types/playable-card';
import { LEADER_ENERGY_MAX } from './types/energy';

const ABILITY_ANY: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-ability-any');
const CARD_A: CardId = createId<'CardId'>('CardId', 'card-a');
const CARD_B: CardId = createId<'CardId'>('CardId', 'card-b');

function costs(): Map<AbilityId, CoreCostRequirement> {
  return new Map([[ABILITY_ANY, { kind: 'ANY' } as CoreCostRequirement]]);
}

function cooldowns(): Map<AbilityId, AbilityCooldownDefinition> {
  return new Map([[ABILITY_ANY, { side: 'LEADER' as const, baseCooldown: 1 }]]);
}

function playableCards(entries: [CardId, PlayableCardDefinition][]): Map<CardId, PlayableCardDefinition> {
  return new Map(entries);
}

function buildEngine(overrides: Partial<CombatEngineConfig> = {}): CombatEngine {
  return new CombatEngine({
    leaderMaxHealth: 100,
    enemyMaxHealth: 100,
    scenarioPlotDefeatThreshold: 999,
    leaderDeckCardIds: [CARD_A, CARD_B],
    randomSource: new SeededRandomSource(1),
    abilityCoreCosts: costs(),
    abilityCooldowns: cooldowns(),
    playableCards: playableCards([
      [CARD_A, { energyCost: 0 }],
      [CARD_B, { energyCost: 0 }],
    ]),
    ...overrides,
  });
}

describe('CombatEngine — H3.6: mano/mazo del Líder', () => {
  it('mano inicial: 5 cartas robadas del mazo barajado, o menos si el mazo tiene menos de 5', () => {
    const engine = buildEngine(); // deck tiene solo 2 cartas
    const snapshot = engine.getSnapshot();
    expect(snapshot.leaderHand).toHaveLength(2);
    expect(snapshot.leaderDeckRemaining).toBe(0);
  });

  it('mano inicial se trunca a 5 con un mazo más grande', () => {
    const bigDeck = Array.from({ length: 10 }, (_, i) => createId<'CardId'>('CardId', `card-${i}`));
    const engine = buildEngine({ leaderDeckCardIds: bigDeck, playableCards: new Map() });
    const snapshot = engine.getSnapshot();
    expect(snapshot.leaderHand).toHaveLength(5);
    expect(snapshot.leaderDeckRemaining).toBe(5);
  });
});

describe('CombatEngine — H3.6: DRAW_OR_GENERATE (paso previo gratis)', () => {
  it('action "draw": roba 1 carta, no consume actionsTakenThisTurn, marca leaderFreeStep.takenThisTurn', () => {
    const bigDeck = Array.from({ length: 10 }, (_, i) => createId<'CardId'>('CardId', `card-${i}`));
    const engine = buildEngine({ leaderDeckCardIds: bigDeck, playableCards: new Map() });
    const before = engine.getSnapshot();
    expect(before.leaderFreeStep.takenThisTurn).toBe(false);

    const result = engine.dispatch({ type: 'DRAW_OR_GENERATE', action: 'draw' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.map((e) => e.type)).toEqual(['LEADER_HAND_CARD_DRAWN', 'FREE_STEP_RESOLVED']);
      const wrapper = result.value[1] as Extract<CombatEvent, { type: 'FREE_STEP_RESOLVED' }>;
      expect(wrapper.outcome).toBe('APPLIED');
    }

    const after = engine.getSnapshot();
    expect(after.leaderHand).toHaveLength(6);
    expect(after.leaderDeckRemaining).toBe(4);
    expect(after.actions.actionsTaken).toBe(0);
    expect(after.leaderFreeStep.takenThisTurn).toBe(true);
  });

  it('action "generate": +1 Energía, no consume actionsTakenThisTurn', () => {
    const engine = buildEngine({ initialLeaderEnergy: 1 });
    const result = engine.dispatch({ type: 'DRAW_OR_GENERATE', action: 'generate' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.map((e) => e.type)).toEqual(['ENERGY_GENERATED', 'FREE_STEP_RESOLVED']);
    }
    const after = engine.getSnapshot();
    expect(after.leaderEnergy).toBe(2);
    expect(after.actions.actionsTaken).toBe(0);
  });

  it('mano llena (7) → LEADER_HAND_DRAW_SKIPPED, no-op sin error, paso previo igualmente consumido', () => {
    const bigDeck = Array.from({ length: 10 }, (_, i) => createId<'CardId'>('CardId', `card-${i}`));
    const engine = buildEngine({ leaderDeckCardIds: bigDeck, initialHandSize: 7, playableCards: new Map() });
    const result = engine.dispatch({ type: 'DRAW_OR_GENERATE', action: 'draw' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value[0]!.type).toBe('LEADER_HAND_DRAW_SKIPPED');
      const skipped = result.value[0] as Extract<CombatEvent, { type: 'LEADER_HAND_DRAW_SKIPPED' }>;
      expect(skipped.reason).toBe('HAND_FULL');
      const wrapper = result.value[1] as Extract<CombatEvent, { type: 'FREE_STEP_RESOLVED' }>;
      expect(wrapper.outcome).toBe('SKIPPED');
    }
    expect(engine.getSnapshot().leaderFreeStep.takenThisTurn).toBe(true);
  });

  it('mazo vacío → LEADER_HAND_DRAW_SKIPPED DECK_EMPTY, no-op sin error', () => {
    const engine = buildEngine({ leaderDeckCardIds: [], playableCards: new Map() });
    const result = engine.dispatch({ type: 'DRAW_OR_GENERATE', action: 'draw' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const skipped = result.value[0] as Extract<CombatEvent, { type: 'LEADER_HAND_DRAW_SKIPPED' }>;
      expect(skipped.reason).toBe('DECK_EMPTY');
    }
  });

  it('energía al tope → ENERGY_GENERATE_SKIPPED, no-op sin error', () => {
    const engine = buildEngine({ initialLeaderEnergy: LEADER_ENERGY_MAX });
    const result = engine.dispatch({ type: 'DRAW_OR_GENERATE', action: 'generate' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const skipped = result.value[0] as Extract<CombatEvent, { type: 'ENERGY_GENERATE_SKIPPED' }>;
      expect(skipped.reason).toBe('ENERGY_AT_MAX');
    }
    expect(engine.getSnapshot().leaderEnergy).toBe(LEADER_ENERGY_MAX);
  });

  it('segunda llamada en el mismo turno → FREE_STEP_ALREADY_TAKEN', () => {
    const engine = buildEngine();
    const first = engine.dispatch({ type: 'DRAW_OR_GENERATE', action: 'generate' });
    expect(isOk(first)).toBe(true);
    const second = engine.dispatch({ type: 'DRAW_OR_GENERATE', action: 'generate' });
    expect(isErr(second)).toBe(true);
    if (isErr(second)) {
      expect((second.error as CombatCommandError).code).toBe('FREE_STEP_ALREADY_TAKEN');
    }
  });

  it('resetea al inicio de cada turno de LEADER, nunca al de ENEMY', () => {
    const engine = buildEngine();
    engine.dispatch({ type: 'DRAW_OR_GENERATE', action: 'generate' });
    expect(engine.getSnapshot().leaderFreeStep.takenThisTurn).toBe(true);

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    expect(engine.getSnapshot().leaderFreeStep.takenThisTurn).toBe(true); // sin resetear para ENEMY

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER
    expect(engine.getSnapshot().leaderFreeStep.takenThisTurn).toBe(false);
  });

  it('turno de Enemigo → NOT_YOUR_TURN', () => {
    const engine = buildEngine({ initialTurnOwner: 'ENEMY' });
    const result = engine.dispatch({ type: 'DRAW_OR_GENERATE', action: 'draw' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('NOT_YOUR_TURN');
    }
  });
});

describe('CombatEngine — H3.6: DRAW_CARD (acción pagada)', () => {
  it('mismo efecto que la versión gratis, pero consume 1 acción', () => {
    const bigDeck = Array.from({ length: 10 }, (_, i) => createId<'CardId'>('CardId', `card-${i}`));
    const engine = buildEngine({ leaderDeckCardIds: bigDeck, playableCards: new Map() });
    const before = engine.getSnapshot();

    const result = engine.dispatch({ type: 'DRAW_CARD' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]!.type).toBe('LEADER_HAND_CARD_DRAWN');
    }

    const after = engine.getSnapshot();
    expect(after.leaderHand).toHaveLength(before.leaderHand.length + 1);
    expect(after.actions.actionsTaken).toBe(1);
    // No consume el paso previo gratuito — sigue disponible.
    expect(after.leaderFreeStep.takenThisTurn).toBe(false);
  });

  it('sin acciones restantes → NO_ACTIONS_REMAINING', () => {
    const engine = buildEngine();
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ABILITY_ANY, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: engine.getSnapshot().nucleoTable[0]!.id });
    engine.dispatch({ type: 'DRAW_CARD' }); // 2ª acción
    const result = engine.dispatch({ type: 'DRAW_CARD' }); // 3ª — rechazada
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('NO_ACTIONS_REMAINING');
    }
  });
});

describe('CombatEngine — H3.6: hand-gating de PLAY_CARD/PLAY_ALLY/PLAY_CONTRATIEMPO', () => {
  it('PLAY_CARD con cardId conocido pero fuera de mano → CARD_NOT_IN_HAND', () => {
    const engine = buildEngine({ leaderDeckCardIds: [] }); // mano vacía
    const result = engine.dispatch({ type: 'PLAY_CARD', cardId: CARD_A, sourceId: 'leader' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('CARD_NOT_IN_HAND');
    }
  });

  it('jugar una carta con éxito la elimina de la mano', () => {
    const engine = buildEngine();
    const before = engine.getSnapshot().leaderHand;
    expect(before).toContain(CARD_A);
    const result = engine.dispatch({ type: 'PLAY_CARD', cardId: CARD_A, sourceId: 'leader' });
    expect(isOk(result)).toBe(true);
    expect(engine.getSnapshot().leaderHand).not.toContain(CARD_A);
  });
});
