import { describe, it, expect, vi } from 'vitest';
import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatCommand, CombatStateSnapshot } from '@collector/domain-combat';
import type { BoardViewContext, HandCardViewData } from '../view';
import { cardTileName } from '../view';
import { createMockSnapshot, mockCardId, mockNucleoInstanceId } from '../view/test-utils/mock-snapshot';
import { createGestureCommandTranslator } from './gesture-command-translator';

/**
 * H2.9 spec §6.1 — mismo espíritu que `input-adapter.test.ts` (H2.7)/`board-view.test.ts` (H2.8):
 * un `CombatBridge` FAKE mínimo (`dispatch` mock que registra llamadas, `getSnapshot` devolviendo
 * un `CombatStateSnapshot` mock controlable entre llamadas) y un `BoardViewContext` mock con 5
 * cartas cubriendo los 4 `cardType` + ambos valores de `requiresNucleoInstance`.
 */
const ALLY_CARD_ID = mockCardId('card-ally');
const CONTRATIEMPO_CARD_ID = mockCardId('card-contratiempo');
const NO_NUCLEO_CARD_ID = mockCardId('card-evento-sin-nucleo');
const REQUIRES_NUCLEO_CARD_A_ID = mockCardId('card-equipo-requiere-nucleo-a');
const REQUIRES_NUCLEO_CARD_B_ID = mockCardId('card-equipo-requiere-nucleo-b');

function createMockContext(): BoardViewContext {
  const leaderCardPool: HandCardViewData[] = [
    { cardId: ALLY_CARD_ID, name: 'Aliado', energyCost: 1, cardType: 'ALIADO', requiresNucleoInstance: false },
    {
      cardId: CONTRATIEMPO_CARD_ID,
      name: 'Contratiempo',
      energyCost: 1,
      cardType: 'CONTRATIEMPO',
      requiresNucleoInstance: false,
    },
    {
      cardId: NO_NUCLEO_CARD_ID,
      name: 'Evento sin Núcleo',
      energyCost: 1,
      cardType: 'EVENTO',
      requiresNucleoInstance: false,
    },
    {
      cardId: REQUIRES_NUCLEO_CARD_A_ID,
      name: 'Equipo A (requiere Núcleo)',
      energyCost: 2,
      cardType: 'EQUIPO',
      requiresNucleoInstance: true,
    },
    {
      cardId: REQUIRES_NUCLEO_CARD_B_ID,
      name: 'Equipo B (requiere Núcleo)',
      energyCost: 2,
      cardType: 'EQUIPO',
      requiresNucleoInstance: true,
    },
  ];

  return {
    nameLookup: { abilityName: (id) => `ability:${id}`, cardName: (id) => `card:${id}` },
    leaderMaxHealth: 30,
    enemyMaxHealth: 40,
    scenarioPlotDefeatThreshold: 10,
    leaderCardPool,
  };
}

function createFakeBridge(snapshot: CombatStateSnapshot): { bridge: CombatBridge; dispatch: ReturnType<typeof vi.fn>; setSnapshot: (s: CombatStateSnapshot) => void } {
  let currentSnapshot = snapshot;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- registra la llamada, no necesita usar el argumento
  const dispatch = vi.fn((_command: CombatCommand) => ({ ok: true, value: [] }) as unknown);
  const bridge = {
    dispatch,
    getSnapshot: () => currentSnapshot,
    subscribeHudEvents: vi.fn(() => vi.fn()),
    subscribeSceneEvents: vi.fn(() => vi.fn()),
  } as unknown as CombatBridge;
  return { bridge, dispatch, setSnapshot: (s) => { currentSnapshot = s; } };
}

describe('createGestureCommandTranslator (H2.9 spec §4-§6.1)', () => {
  it('caso 1: TAP en ALIADO dispatch PLAY_ALLY inmediato; un TAP posterior en un Núcleo no dispara nada más', () => {
    const snapshot = createMockSnapshot({ nucleoPool: [{ id: mockNucleoInstanceId('n1'), color: 'AGRESION', value: 3 }] });
    const { bridge, dispatch } = createFakeBridge(snapshot);
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleGesture({ kind: 'TAP', targetId: cardTileName(ALLY_CARD_ID), point: { x: 0, y: 0 } });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PLAY_ALLY',
      cardId: ALLY_CARD_ID,
      sourceId: cardTileName(ALLY_CARD_ID),
    });

    translator.handleGesture({ kind: 'TAP', targetId: 'n1', point: { x: 0, y: 0 } });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('caso 2: TAP en CONTRATIEMPO dispatch PLAY_CONTRATIEMPO inmediato', () => {
    const { bridge, dispatch } = createFakeBridge(createMockSnapshot());
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleGesture({ kind: 'TAP', targetId: cardTileName(CONTRATIEMPO_CARD_ID), point: { x: 0, y: 0 } });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PLAY_CONTRATIEMPO',
      cardId: CONTRATIEMPO_CARD_ID,
      sourceId: cardTileName(CONTRATIEMPO_CARD_ID),
    });
  });

  it('caso 3: TAP en EVENTO/EQUIPO con requiresNucleoInstance=false dispatch PLAY_CARD inmediato SIN nucleoInstanceId', () => {
    const { bridge, dispatch } = createFakeBridge(createMockSnapshot());
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleGesture({ kind: 'TAP', targetId: cardTileName(NO_NUCLEO_CARD_ID), point: { x: 0, y: 0 } });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const command = dispatch.mock.calls[0]![0] as CombatCommand;
    expect(command).toEqual({ type: 'PLAY_CARD', cardId: NO_NUCLEO_CARD_ID, sourceId: cardTileName(NO_NUCLEO_CARD_ID) });
    expect('nucleoInstanceId' in command).toBe(false);
  });

  it('caso 4: TAP en EVENTO/EQUIPO con requiresNucleoInstance=true no dispatch nada hasta el TAP en un Núcleo', () => {
    const snapshot = createMockSnapshot({ nucleoPool: [{ id: mockNucleoInstanceId('n1'), color: 'AGRESION', value: 3 }] });
    const { bridge, dispatch } = createFakeBridge(snapshot);
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleGesture({ kind: 'TAP', targetId: cardTileName(REQUIRES_NUCLEO_CARD_A_ID), point: { x: 0, y: 0 } });
    expect(dispatch).not.toHaveBeenCalled();

    translator.handleGesture({ kind: 'TAP', targetId: 'n1', point: { x: 0, y: 0 } });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PLAY_CARD',
      cardId: REQUIRES_NUCLEO_CARD_A_ID,
      sourceId: cardTileName(REQUIRES_NUCLEO_CARD_A_ID),
      nucleoInstanceId: mockNucleoInstanceId('n1'),
    });
  });

  it('caso 5: selección pendiente sustituida — TAP A, TAP B (ambos requieren Núcleo), TAP Núcleo → dispatch con cardId de B, nunca A', () => {
    const snapshot = createMockSnapshot({ nucleoPool: [{ id: mockNucleoInstanceId('n1'), color: 'AGRESION', value: 3 }] });
    const { bridge, dispatch } = createFakeBridge(snapshot);
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleGesture({ kind: 'TAP', targetId: cardTileName(REQUIRES_NUCLEO_CARD_A_ID), point: { x: 0, y: 0 } });
    translator.handleGesture({ kind: 'TAP', targetId: cardTileName(REQUIRES_NUCLEO_CARD_B_ID), point: { x: 0, y: 0 } });
    expect(dispatch).not.toHaveBeenCalled();

    translator.handleGesture({ kind: 'TAP', targetId: 'n1', point: { x: 0, y: 0 } });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PLAY_CARD',
      cardId: REQUIRES_NUCLEO_CARD_B_ID,
      sourceId: cardTileName(REQUIRES_NUCLEO_CARD_B_ID),
      nucleoInstanceId: mockNucleoInstanceId('n1'),
    });
  });

  it('caso 6: cancelación explícita — TAP A (requiere Núcleo), TAP en vacío, TAP Núcleo → ningún dispatch ocurre nunca', () => {
    const snapshot = createMockSnapshot({ nucleoPool: [{ id: mockNucleoInstanceId('n1'), color: 'AGRESION', value: 3 }] });
    const { bridge, dispatch } = createFakeBridge(snapshot);
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleGesture({ kind: 'TAP', targetId: cardTileName(REQUIRES_NUCLEO_CARD_A_ID), point: { x: 0, y: 0 } });
    translator.handleGesture({ kind: 'TAP', targetId: null, point: { x: 0, y: 0 } });
    translator.handleGesture({ kind: 'TAP', targetId: 'n1', point: { x: 0, y: 0 } });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('caso 7: LONG_PRESS/DRAG_* nunca disparan dispatch ni alteran pendingCardId', () => {
    const snapshot = createMockSnapshot({ nucleoPool: [{ id: mockNucleoInstanceId('n1'), color: 'AGRESION', value: 3 }] });
    const { bridge, dispatch } = createFakeBridge(snapshot);
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleGesture({ kind: 'TAP', targetId: cardTileName(REQUIRES_NUCLEO_CARD_A_ID), point: { x: 0, y: 0 } });
    expect(dispatch).not.toHaveBeenCalled();

    translator.handleGesture({ kind: 'LONG_PRESS', targetId: 'n1', point: { x: 0, y: 0 } });
    translator.handleGesture({ kind: 'DRAG_START', targetId: 'n1', point: { x: 0, y: 0 } });
    translator.handleGesture({ kind: 'DRAG_MOVE', targetId: 'n1', point: { x: 0, y: 0 }, delta: { x: 1, y: 1 } });
    translator.handleGesture({ kind: 'DRAG_END', targetId: 'n1', point: { x: 0, y: 0 } });
    expect(dispatch).not.toHaveBeenCalled();

    // La selección pendiente de A sigue viva — un TAP en Núcleo ahora sí la completa.
    translator.handleGesture({ kind: 'TAP', targetId: 'n1', point: { x: 0, y: 0 } });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PLAY_CARD',
      cardId: REQUIRES_NUCLEO_CARD_A_ID,
      sourceId: cardTileName(REQUIRES_NUCLEO_CARD_A_ID),
      nucleoInstanceId: mockNucleoInstanceId('n1'),
    });
  });

  it('caso 8: el lookup de nucleo.id usa bridge.getSnapshot() en el momento del segundo tap, no un snapshot cacheado', () => {
    const initialSnapshot = createMockSnapshot({ nucleoPool: [{ id: mockNucleoInstanceId('n1'), color: 'AGRESION', value: 3 }] });
    const { bridge, dispatch, setSnapshot } = createFakeBridge(initialSnapshot);
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleGesture({ kind: 'TAP', targetId: cardTileName(REQUIRES_NUCLEO_CARD_A_ID), point: { x: 0, y: 0 } });

    // El pool cambió (NUCLEO_POOL_ROLLED) mientras la selección estaba pendiente.
    setSnapshot(createMockSnapshot({ nucleoPool: [{ id: mockNucleoInstanceId('n2'), color: 'DEFENSA', value: 5 }] }));

    translator.handleGesture({ kind: 'TAP', targetId: 'n2', point: { x: 0, y: 0 } });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PLAY_CARD',
      cardId: REQUIRES_NUCLEO_CARD_A_ID,
      sourceId: cardTileName(REQUIRES_NUCLEO_CARD_A_ID),
      nucleoInstanceId: mockNucleoInstanceId('n2'),
    });
  });

  it('cero dispatch de ACTIVATE_ABILITY/SET_DAMAGE_REDIRECT/SUMMON_MINION/RESOLVE_MINION_ACTION en toda la suite (H2.9 spec §0.3/§8)', () => {
    const snapshot = createMockSnapshot({ nucleoPool: [{ id: mockNucleoInstanceId('n1'), color: 'AGRESION', value: 3 }] });
    const { bridge, dispatch } = createFakeBridge(snapshot);
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    for (const gesture of [
      { kind: 'TAP' as const, targetId: cardTileName(ALLY_CARD_ID), point: { x: 0, y: 0 } },
      { kind: 'TAP' as const, targetId: cardTileName(CONTRATIEMPO_CARD_ID), point: { x: 0, y: 0 } },
      { kind: 'TAP' as const, targetId: cardTileName(NO_NUCLEO_CARD_ID), point: { x: 0, y: 0 } },
      { kind: 'TAP' as const, targetId: cardTileName(REQUIRES_NUCLEO_CARD_A_ID), point: { x: 0, y: 0 } },
      { kind: 'TAP' as const, targetId: 'n1', point: { x: 0, y: 0 } },
      { kind: 'TAP' as const, targetId: 'FOCUS_ID_LEADER', point: { x: 0, y: 0 } },
    ]) {
      translator.handleGesture(gesture);
    }

    const forbiddenTypes = new Set(['ACTIVATE_ABILITY', 'SET_DAMAGE_REDIRECT', 'SUMMON_MINION', 'RESOLVE_MINION_ACTION']);
    for (const call of dispatch.mock.calls) {
      const command = call[0] as CombatCommand;
      expect(forbiddenTypes.has(command.type)).toBe(false);
    }
  });
});
