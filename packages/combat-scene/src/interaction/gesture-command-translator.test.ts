import { describe, it, expect, vi } from 'vitest';
import type { CombatBridge } from '@collector/combat-bridge';
import type { CombatCommand, CombatStateSnapshot, NucleoDie, MinionInPlay } from '@collector/domain-combat';
import type { BoardViewContext, HandCardViewData, AbilityViewData } from '../view';
import { cardTileName } from '../view';
import { createMockSnapshot, mockCardId, mockNucleoInstanceId, mockCardInstanceId } from '../view/test-utils/mock-snapshot';
import { createGestureCommandTranslator } from './gesture-command-translator';

/**
 * H2.9 spec §6.1 (extendida H3 §5.4/§6, H4 §5/§6.1) — mismo espíritu que `input-adapter.test.ts`
 * (H2.7)/`board-view.test.ts` (H2.8): un `CombatBridge` FAKE mínimo (`dispatch` mock que registra
 * llamadas, `getSnapshot` devolviendo un `CombatStateSnapshot` mock controlable entre llamadas) y un
 * `BoardViewContext` mock con 5 cartas cubriendo los 4 `cardType` + ambos valores de
 * `requiresNucleoInstance`.
 *
 * H4 §6.1 — el tap real de carta/habilidad migró de `handleGesture` (Phaser `PointerGesture`) a
 * `handleCardTap`/`handleAbilityTap` (invocados directo desde DOM `onClick`, `CardTile`/
 * `AbilityTile`). `handleGesture` sigue resolviendo taps de Phaser: rol, Secuaz en mesa, dado de
 * Núcleo — nunca cartas/habilidades. Esta suite se actualiza para reflejar ese cableado nuevo,
 * preservando exactamente la misma cobertura de casos.
 */
const ALLY_CARD_ID = mockCardId('card-ally');
const CONTRATIEMPO_CARD_ID = mockCardId('card-contratiempo');
const NO_NUCLEO_CARD_ID = mockCardId('card-evento-sin-nucleo');
const REQUIRES_NUCLEO_CARD_A_ID = mockCardId('card-equipo-requiere-nucleo-a');
const REQUIRES_NUCLEO_CARD_B_ID = mockCardId('card-equipo-requiere-nucleo-b');
const ABILITY_ID = 'ability-strike' as AbilityViewData['abilityId'];

function mockDie(id: string, color: NucleoDie['color'], value: number, overrides: Partial<NucleoDie> = {}): NucleoDie {
  return { id: mockNucleoInstanceId(id), color, value, kind: 'FIXED', status: 'AVAILABLE', ...overrides };
}

function createMockContext(abilities: AbilityViewData[] = []): BoardViewContext {
  const leaderCardPool: HandCardViewData[] = [
    { cardId: ALLY_CARD_ID, name: 'Aliado', energyCost: 1, cardType: 'ALIADO', requiresNucleoInstance: false, keywords: [] },
    {
      cardId: CONTRATIEMPO_CARD_ID,
      name: 'Contratiempo',
      energyCost: 1,
      cardType: 'CONTRATIEMPO',
      requiresNucleoInstance: false,
      keywords: [],
    },
    {
      cardId: NO_NUCLEO_CARD_ID,
      name: 'Evento sin Núcleo',
      energyCost: 1,
      cardType: 'EVENTO',
      requiresNucleoInstance: false,
      keywords: [],
    },
    {
      cardId: REQUIRES_NUCLEO_CARD_A_ID,
      name: 'Equipo A (requiere Núcleo)',
      energyCost: 2,
      cardType: 'EQUIPO',
      requiresNucleoInstance: true,
      keywords: [],
    },
    {
      cardId: REQUIRES_NUCLEO_CARD_B_ID,
      name: 'Equipo B (requiere Núcleo)',
      energyCost: 2,
      cardType: 'EQUIPO',
      requiresNucleoInstance: true,
      keywords: [],
    },
  ];

  return {
    nameLookup: { abilityName: (id) => `ability:${id}`, cardName: (id) => `card:${id}`, minionName: (id) => `minion:${id}` },
    leaderMaxHealth: 30,
    enemyMaxHealth: 40,
    scenarioPlotDefeatThreshold: 10,
    leaderCardPool,
    leaderAbilities: abilities,
    enemyAbilities: [],
    enemyDramaturgiaDeck: [],
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

describe('createGestureCommandTranslator (H2.9 spec §4-§6.1, migrado a nucleoTable H3, tap de carta/habilidad migrado a DOM H4)', () => {
  it('caso 1: handleCardTap ALIADO dispatch PLAY_ALLY inmediato; un TAP posterior en un Núcleo no dispara nada más', () => {
    const snapshot = createMockSnapshot({ nucleoTable: [mockDie('n1', 'AGRESION', 3)] });
    const { bridge, dispatch } = createFakeBridge(snapshot);
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleCardTap(ALLY_CARD_ID);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PLAY_ALLY',
      cardId: ALLY_CARD_ID,
      sourceId: cardTileName(ALLY_CARD_ID),
    });

    translator.handleGesture({ kind: 'TAP', targetId: String(mockNucleoInstanceId('n1')), point: { x: 0, y: 0 } });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('caso 2: handleCardTap CONTRATIEMPO dispatch PLAY_CONTRATIEMPO inmediato', () => {
    const { bridge, dispatch } = createFakeBridge(createMockSnapshot());
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleCardTap(CONTRATIEMPO_CARD_ID);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PLAY_CONTRATIEMPO',
      cardId: CONTRATIEMPO_CARD_ID,
      sourceId: cardTileName(CONTRATIEMPO_CARD_ID),
    });
  });

  it('caso 3: handleCardTap EVENTO/EQUIPO con requiresNucleoInstance=false dispatch PLAY_CARD inmediato SIN nucleoInstanceId ni target', () => {
    const { bridge, dispatch } = createFakeBridge(createMockSnapshot());
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleCardTap(NO_NUCLEO_CARD_ID);

    expect(dispatch).toHaveBeenCalledTimes(1);
    const command = dispatch.mock.calls[0]![0] as CombatCommand;
    expect(command).toEqual({ type: 'PLAY_CARD', cardId: NO_NUCLEO_CARD_ID, sourceId: cardTileName(NO_NUCLEO_CARD_ID) });
    expect('nucleoInstanceId' in command).toBe(false);
    expect('target' in command).toBe(false);
  });

  it('caso 4: handleCardTap carta de Ataque sin Secuaces en mesa → target ENEMY automático; no dispatch hasta el TAP en un Núcleo', () => {
    const snapshot = createMockSnapshot({ nucleoTable: [mockDie('n1', 'AGRESION', 3)] });
    const { bridge, dispatch } = createFakeBridge(snapshot);
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleCardTap(REQUIRES_NUCLEO_CARD_A_ID);
    expect(dispatch).not.toHaveBeenCalled();

    translator.handleGesture({ kind: 'TAP', targetId: String(mockNucleoInstanceId('n1')), point: { x: 0, y: 0 } });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PLAY_CARD',
      cardId: REQUIRES_NUCLEO_CARD_A_ID,
      sourceId: cardTileName(REQUIRES_NUCLEO_CARD_A_ID),
      nucleoInstanceId: mockNucleoInstanceId('n1'),
      target: { kind: 'ENEMY' },
    });
  });

  it('caso 4b: handleCardTap carta de Ataque CON Secuaces en mesa → espera TAP de objetivo (Enemigo o Secuaz) antes del Núcleo', () => {
    const minionInstanceId = mockCardInstanceId('minion-1');
    const minion = { instanceId: minionInstanceId } as unknown as MinionInPlay;
    const snapshot = createMockSnapshot({
      nucleoTable: [mockDie('n1', 'AGRESION', 3)],
      minionsInPlay: [minion],
    });
    const { bridge, dispatch } = createFakeBridge(snapshot);
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleCardTap(REQUIRES_NUCLEO_CARD_A_ID);
    expect(dispatch).not.toHaveBeenCalled();

    translator.handleGesture({ kind: 'TAP', targetId: String(minionInstanceId), point: { x: 0, y: 0 } });
    translator.handleGesture({ kind: 'TAP', targetId: String(mockNucleoInstanceId('n1')), point: { x: 0, y: 0 } });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PLAY_CARD',
      cardId: REQUIRES_NUCLEO_CARD_A_ID,
      sourceId: cardTileName(REQUIRES_NUCLEO_CARD_A_ID),
      nucleoInstanceId: mockNucleoInstanceId('n1'),
      target: { kind: 'MINION', minionInstanceId },
    });
  });

  it('caso 5: selección pendiente sustituida — handleCardTap A, handleCardTap B (ambos requieren Núcleo), TAP Núcleo → dispatch con cardId de B, nunca A', () => {
    const snapshot = createMockSnapshot({ nucleoTable: [mockDie('n1', 'AGRESION', 3)] });
    const { bridge, dispatch } = createFakeBridge(snapshot);
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleCardTap(REQUIRES_NUCLEO_CARD_A_ID);
    translator.handleCardTap(REQUIRES_NUCLEO_CARD_B_ID);
    expect(dispatch).not.toHaveBeenCalled();

    translator.handleGesture({ kind: 'TAP', targetId: String(mockNucleoInstanceId('n1')), point: { x: 0, y: 0 } });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PLAY_CARD',
      cardId: REQUIRES_NUCLEO_CARD_B_ID,
      sourceId: cardTileName(REQUIRES_NUCLEO_CARD_B_ID),
      nucleoInstanceId: mockNucleoInstanceId('n1'),
      target: { kind: 'ENEMY' },
    });
  });

  it('caso 6: cancelación explícita — handleCardTap A (requiere Núcleo), TAP en vacío, TAP Núcleo → ningún dispatch ocurre nunca', () => {
    const snapshot = createMockSnapshot({ nucleoTable: [mockDie('n1', 'AGRESION', 3)] });
    const { bridge, dispatch } = createFakeBridge(snapshot);
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleCardTap(REQUIRES_NUCLEO_CARD_A_ID);
    translator.handleGesture({ kind: 'TAP', targetId: null, point: { x: 0, y: 0 } });
    translator.handleGesture({ kind: 'TAP', targetId: String(mockNucleoInstanceId('n1')), point: { x: 0, y: 0 } });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('caso 6b: cancelPending() explícito (botón "Cancelar" del banner) — mismo efecto que un TAP en vacío', () => {
    const snapshot = createMockSnapshot({ nucleoTable: [mockDie('n1', 'AGRESION', 3)] });
    const { bridge, dispatch } = createFakeBridge(snapshot);
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleCardTap(REQUIRES_NUCLEO_CARD_A_ID);
    expect(translator.targetingSignal.getState().kind).not.toBe('NONE');

    translator.cancelPending();
    expect(translator.targetingSignal.getState()).toEqual({ kind: 'NONE' });

    translator.handleGesture({ kind: 'TAP', targetId: String(mockNucleoInstanceId('n1')), point: { x: 0, y: 0 } });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('caso 7: LONG_PRESS/DRAG_* nunca disparan dispatch ni alteran la selección pendiente', () => {
    const snapshot = createMockSnapshot({ nucleoTable: [mockDie('n1', 'AGRESION', 3)] });
    const { bridge, dispatch } = createFakeBridge(snapshot);
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleCardTap(REQUIRES_NUCLEO_CARD_A_ID);
    expect(dispatch).not.toHaveBeenCalled();

    const n1Id = String(mockNucleoInstanceId('n1'));
    translator.handleGesture({ kind: 'LONG_PRESS', targetId: n1Id, point: { x: 0, y: 0 } });
    translator.handleGesture({ kind: 'DRAG_START', targetId: n1Id, point: { x: 0, y: 0 } });
    translator.handleGesture({ kind: 'DRAG_MOVE', targetId: n1Id, point: { x: 0, y: 0 }, delta: { x: 1, y: 1 } });
    translator.handleGesture({ kind: 'DRAG_END', targetId: n1Id, point: { x: 0, y: 0 } });
    expect(dispatch).not.toHaveBeenCalled();

    // La selección pendiente de A sigue viva — un TAP en Núcleo ahora sí la completa.
    translator.handleGesture({ kind: 'TAP', targetId: n1Id, point: { x: 0, y: 0 } });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PLAY_CARD',
      cardId: REQUIRES_NUCLEO_CARD_A_ID,
      sourceId: cardTileName(REQUIRES_NUCLEO_CARD_A_ID),
      nucleoInstanceId: mockNucleoInstanceId('n1'),
      target: { kind: 'ENEMY' },
    });
  });

  it('caso 8: el lookup de nucleo.id usa bridge.getSnapshot() en el momento del segundo tap, no un snapshot cacheado', () => {
    const initialSnapshot = createMockSnapshot({ nucleoTable: [mockDie('n1', 'AGRESION', 3)] });
    const { bridge, dispatch, setSnapshot } = createFakeBridge(initialSnapshot);
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleCardTap(REQUIRES_NUCLEO_CARD_A_ID);

    // La mesa cambió (NUCLEO_TABLE_REROLLED) mientras la selección estaba pendiente.
    setSnapshot(createMockSnapshot({ nucleoTable: [mockDie('n2', 'DEFENSA', 5)] }));

    translator.handleGesture({ kind: 'TAP', targetId: String(mockNucleoInstanceId('n2')), point: { x: 0, y: 0 } });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PLAY_CARD',
      cardId: REQUIRES_NUCLEO_CARD_A_ID,
      sourceId: cardTileName(REQUIRES_NUCLEO_CARD_A_ID),
      nucleoInstanceId: mockNucleoInstanceId('n2'),
      target: { kind: 'ENEMY' },
    });
  });

  describe('FIX QA (Bug 3) — tap sobre un dado ya gastado durante AWAITING_NUCLEO_FOR_*: rechaza, no cancela', () => {
    it('AWAITING_NUCLEO_FOR_CARD: TAP en dado SPENT no cancela la selección, no dispatch, emite rejectionSignal con ese dieId', () => {
      const spentId = String(mockNucleoInstanceId('n1'));
      const snapshot = createMockSnapshot({
        nucleoTable: [mockDie('n1', 'AGRESION', 3, { status: 'SPENT' }), mockDie('n2', 'DEFENSA', 1)],
      });
      const { bridge, dispatch } = createFakeBridge(snapshot);
      const translator = createGestureCommandTranslator(bridge, createMockContext());

      const rejections: string[] = [];
      translator.rejectionSignal.subscribe((event) => rejections.push(event.dieId));

      translator.handleCardTap(REQUIRES_NUCLEO_CARD_A_ID);
      expect(translator.targetingSignal.getState().kind).toBe('AWAITING_NUCLEO_FOR_CARD');

      translator.handleGesture({ kind: 'TAP', targetId: spentId, point: { x: 0, y: 0 } });

      expect(dispatch).not.toHaveBeenCalled();
      // La selección sigue viva (banner de prompt visible) — a diferencia de un TAP en vacío/rol.
      expect(translator.targetingSignal.getState().kind).toBe('AWAITING_NUCLEO_FOR_CARD');
      expect(rejections).toEqual([spentId]);

      // El dado AVAILABLE restante sigue resolviendo la selección con normalidad tras el rechazo.
      translator.handleGesture({ kind: 'TAP', targetId: String(mockNucleoInstanceId('n2')), point: { x: 0, y: 0 } });
      expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it('AWAITING_NUCLEO_FOR_ABILITY: TAP en dado SPENT no cancela la selección, no dispatch, emite rejectionSignal', () => {
      const spentId = String(mockNucleoInstanceId('n1'));
      const snapshot = createMockSnapshot({
        nucleoTable: [
          mockDie('n1', 'AGRESION', 3, { status: 'SPENT' }),
          mockDie('n2', 'AGRESION', 2),
          mockDie('n3', 'AGRESION', 4),
        ],
      });
      const { bridge, dispatch } = createFakeBridge(snapshot);
      const translator = createGestureCommandTranslator(bridge, createMockContext([
        { abilityId: ABILITY_ID, name: 'Guardia Firme', baseCooldown: 2, coreCost: { kind: 'COLOR', colors: ['AGRESION'] }, effectKind: 'NONE' },
      ]));

      const rejections: string[] = [];
      translator.rejectionSignal.subscribe((event) => rejections.push(event.dieId));

      translator.handleAbilityTap(ABILITY_ID);
      expect(translator.targetingSignal.getState().kind).toBe('AWAITING_NUCLEO_FOR_ABILITY');

      translator.handleGesture({ kind: 'TAP', targetId: spentId, point: { x: 0, y: 0 } });

      expect(dispatch).not.toHaveBeenCalled();
      expect(translator.targetingSignal.getState().kind).toBe('AWAITING_NUCLEO_FOR_ABILITY');
      expect(rejections).toEqual([spentId]);
    });

    it('TAP en vacío (fuera de cualquier dado) durante AWAITING_NUCLEO_FOR_CARD sigue cancelando (comportamiento previo intacto)', () => {
      const snapshot = createMockSnapshot({ nucleoTable: [mockDie('n1', 'AGRESION', 3)] });
      const { bridge, dispatch } = createFakeBridge(snapshot);
      const translator = createGestureCommandTranslator(bridge, createMockContext());

      translator.handleCardTap(REQUIRES_NUCLEO_CARD_A_ID);
      translator.handleGesture({ kind: 'TAP', targetId: null, point: { x: 0, y: 0 } });

      expect(translator.targetingSignal.getState()).toEqual({ kind: 'NONE' });
      translator.handleGesture({ kind: 'TAP', targetId: String(mockNucleoInstanceId('n1')), point: { x: 0, y: 0 } });
      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  it('cero dispatch de SET_DAMAGE_REDIRECT/SUMMON_MINION/RESOLVE_MINION_ACTION en toda la suite (H2.9 spec §0.3/§8)', () => {
    const snapshot = createMockSnapshot({ nucleoTable: [mockDie('n1', 'AGRESION', 3)] });
    const { bridge, dispatch } = createFakeBridge(snapshot);
    const translator = createGestureCommandTranslator(bridge, createMockContext());

    translator.handleCardTap(ALLY_CARD_ID);
    translator.handleCardTap(CONTRATIEMPO_CARD_ID);
    translator.handleCardTap(NO_NUCLEO_CARD_ID);
    translator.handleCardTap(REQUIRES_NUCLEO_CARD_A_ID);
    for (const gesture of [
      { kind: 'TAP' as const, targetId: String(mockNucleoInstanceId('n1')), point: { x: 0, y: 0 } },
      { kind: 'TAP' as const, targetId: 'FOCUS_ID_LEADER', point: { x: 0, y: 0 } },
    ]) {
      translator.handleGesture(gesture);
    }

    const forbiddenTypes = new Set(['SET_DAMAGE_REDIRECT', 'SUMMON_MINION', 'RESOLVE_MINION_ACTION']);
    for (const call of dispatch.mock.calls) {
      const command = call[0] as CombatCommand;
      expect(forbiddenTypes.has(command.type)).toBe(false);
    }
  });

  describe('NUEVO H3.1/§5.4 (migrado a handleAbilityTap H4 §6.1) — tap en icono de habilidad del Líder', () => {
    function abilityContext(coreCost: AbilityViewData['coreCost']): BoardViewContext {
      const ability: AbilityViewData = { abilityId: ABILITY_ID, name: 'Golpe', baseCooldown: 2, coreCost, effectKind: 'NONE' };
      return createMockContext([ability]);
    }

    it('un único dado válido → dispatch ACTIVATE_ABILITY inmediato, sin esperar un segundo TAP', () => {
      const snapshot = createMockSnapshot({ nucleoTable: [mockDie('n1', 'AGRESION', 3)] });
      const { bridge, dispatch } = createFakeBridge(snapshot);
      const translator = createGestureCommandTranslator(bridge, abilityContext({ kind: 'ANY' }));

      translator.handleAbilityTap(ABILITY_ID);

      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith({
        type: 'ACTIVATE_ABILITY',
        abilityId: ABILITY_ID,
        sourceId: 'leader',
        side: 'LEADER',
        nucleoInstanceId: mockNucleoInstanceId('n1'),
      });
    });

    it('varios dados válidos → espera TAP en un dado concreto antes de dispatch', () => {
      const snapshot = createMockSnapshot({
        nucleoTable: [mockDie('n1', 'AGRESION', 3), mockDie('n2', 'CONTROL', 1)],
      });
      const { bridge, dispatch } = createFakeBridge(snapshot);
      const translator = createGestureCommandTranslator(bridge, abilityContext({ kind: 'ANY' }));

      translator.handleAbilityTap(ABILITY_ID);
      expect(dispatch).not.toHaveBeenCalled();

      translator.handleGesture({ kind: 'TAP', targetId: String(mockNucleoInstanceId('n2')), point: { x: 0, y: 0 } });

      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith({
        type: 'ACTIVATE_ABILITY',
        abilityId: ABILITY_ID,
        sourceId: 'leader',
        side: 'LEADER',
        nucleoInstanceId: mockNucleoInstanceId('n2'),
      });
    });

    it('sin dado válido (color no coincide, coste específico) → no-op, ningún dispatch', () => {
      const snapshot = createMockSnapshot({ nucleoTable: [mockDie('n1', 'AGRESION', 3, { status: 'SPENT' })] });
      const { bridge, dispatch } = createFakeBridge(snapshot);
      const translator = createGestureCommandTranslator(bridge, abilityContext({ kind: 'COLOR', colors: ['AGRESION'] }));

      translator.handleAbilityTap(ABILITY_ID);

      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  describe('NUEVO H4 §5.2 — targetingSignal refleja el estado de `pending`', () => {
    it('AWAITING_NUCLEO_FOR_CARD expone cardName + validDieIds (dados AVAILABLE)', () => {
      const snapshot = createMockSnapshot({
        nucleoTable: [mockDie('n1', 'AGRESION', 3), mockDie('n2', 'DEFENSA', 1, { status: 'SPENT' })],
      });
      const { bridge } = createFakeBridge(snapshot);
      const translator = createGestureCommandTranslator(bridge, createMockContext());

      translator.handleCardTap(REQUIRES_NUCLEO_CARD_A_ID);

      expect(translator.targetingSignal.getState()).toEqual({
        kind: 'AWAITING_NUCLEO_FOR_CARD',
        cardName: 'Equipo A (requiere Núcleo)',
        validDieIds: [String(mockNucleoInstanceId('n1'))],
      });
    });

    it('AWAITING_ATTACK_TARGET expone cardName + validTargetIds (Enemigo + Secuaces en mesa)', () => {
      const minionInstanceId = mockCardInstanceId('minion-1');
      const minion = { instanceId: minionInstanceId } as unknown as MinionInPlay;
      const snapshot = createMockSnapshot({ minionsInPlay: [minion] });
      const { bridge } = createFakeBridge(snapshot);
      const translator = createGestureCommandTranslator(bridge, createMockContext());

      translator.handleCardTap(REQUIRES_NUCLEO_CARD_A_ID);

      const prompt = translator.targetingSignal.getState();
      expect(prompt.kind).toBe('AWAITING_ATTACK_TARGET');
      expect(prompt).toMatchObject({ cardName: 'Equipo A (requiere Núcleo)' });
      if (prompt.kind === 'AWAITING_ATTACK_TARGET') {
        expect(prompt.validTargetIds).toContain(String(minionInstanceId));
      }
    });

    it('vuelve a NONE tras completar la selección', () => {
      const snapshot = createMockSnapshot({ nucleoTable: [mockDie('n1', 'AGRESION', 3)] });
      const { bridge } = createFakeBridge(snapshot);
      const translator = createGestureCommandTranslator(bridge, createMockContext());

      translator.handleCardTap(REQUIRES_NUCLEO_CARD_A_ID);
      translator.handleGesture({ kind: 'TAP', targetId: String(mockNucleoInstanceId('n1')), point: { x: 0, y: 0 } });

      expect(translator.targetingSignal.getState()).toEqual({ kind: 'NONE' });
    });
  });
});
