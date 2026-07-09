// Test de regresión del FIX QA documentado en `use-combat-snapshot.ts` (bug HUD permanentemente
// deshabilitado desde ~turno 4). `CombatHud.test.tsx` usa un `createFakeBridge()` cuyo
// `subscribeHudEvents` nunca invoca al listener realmente, así que nunca ejercitó el escenario de
// la causa raíz: un solo `dispatch(END_TURN)` con IA de Enemigo automática emite VARIOS eventos
// síncronos en cadena (`TURN_ENDED`/`COOLDOWNS_TICKED` del cierre ENEMY, y de nuevo del cierre
// recursivo LEADER que sigue) ANTES de que `actionsTakenThisTurn`/`actionsAllowedThisTurn` del
// turno entrante del Líder queden reseteados. Aquí se usa un `CombatEngine`+`CombatBridge` REALES
// (mismo patrón mínimo que `combat-engine.turn-loop.test.ts` — motor con IA de Enemigo habilitada
// vía `enemyAbilityAiProfiles`+`dramaturgiaDeck`) para reproducir la recursión real de
// `handleEndTurn`, en vez de mockear el bus de eventos.
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SeededRandomSource, createId } from '@collector/domain-shared';
import type { AbilityId, CardId, CoreCostRequirement } from '@collector/domain-shared';
import { CombatEngine } from '@collector/domain-combat';
import type { CombatEngineConfig } from '@collector/domain-combat';
import type { EnemyAbilityAiProfile } from '@collector/domain-combat';
import type { DramaturgiaCardDefinition } from '@collector/domain-catalog';
import { createCombatBridge } from '@collector/combat-bridge';
import { useCombatSnapshot } from './use-combat-snapshot';

const ABILITY_ANY: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-ability-any');
const ENEMY_ATTACK_BASICA: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-attack-basica');
const ENEMY_PLOT_BASICA: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-plot-basica');
const CARD_ATTACK: CardId = createId<'CardId'>('CardId', 'card-attack');

/** Motor mínimo con IA de Enemigo habilitada — mismo espíritu que `buildEngineWithAi` de
 *  `combat-engine.turn-loop.test.ts`: un solo `dispatch(END_TURN)` del Líder dispara el turno
 *  automático del Enemigo (`TURN_ENDED`/`COOLDOWNS_TICKED` de la mano ENEMY) y la recursión que
 *  cierra devolviendo el turno al Líder (`TURN_ENDED`/`COOLDOWNS_TICKED` de la mano LEADER),
 *  todo dentro de un único `dispatch()` síncrono. */
function buildEngineWithAi(): CombatEngine {
  const enemyAbilityAiProfiles = new Map<AbilityId, EnemyAbilityAiProfile>([
    [ENEMY_ATTACK_BASICA, { branch: 'ATTACK', tier: 'BASICA' }],
    [ENEMY_PLOT_BASICA, { branch: 'PLOT', tier: 'BASICA' }],
  ]);
  const dramaturgiaDeck: DramaturgiaCardDefinition[] = [
    { id: createId('DramaturgiaCardId', 'dramacard-0-ATTACK'), name: 'Carta 0', icon: 'ATTACK' },
  ];

  const config: CombatEngineConfig = {
    randomSource: new SeededRandomSource(1),
    abilityCoreCosts: new Map<AbilityId, CoreCostRequirement>([
      [ABILITY_ANY, { kind: 'ANY' }],
      [ENEMY_ATTACK_BASICA, { kind: 'ANY' }],
      [ENEMY_PLOT_BASICA, { kind: 'ANY' }],
    ]),
    abilityCooldowns: new Map([
      [ABILITY_ANY, { side: 'LEADER' as const, baseCooldown: 1 }],
      [ENEMY_ATTACK_BASICA, { side: 'ENEMY' as const, baseCooldown: 1 }],
      [ENEMY_PLOT_BASICA, { side: 'ENEMY' as const, baseCooldown: 1 }],
    ]),
    abilityEffects: new Map([
      [
        ENEMY_ATTACK_BASICA,
        { kind: 'ATTACK' as const, formula: { baseFormula: { kind: 'ADD' as const, amount: 3 } } },
      ],
      [ENEMY_PLOT_BASICA, { kind: 'PLOT' as const, amount: 1 }],
    ]),
    leaderMaxHealth: 100,
    enemyMaxHealth: 100,
    scenarioPlotDefeatThreshold: 999,
    leaderDeckCardIds: [CARD_ATTACK],
    enemyAbilityAiProfiles,
    dramaturgiaDeck,
  };

  return new CombatEngine(config);
}

describe('useCombatSnapshot — FIX QA: coalescencia de eventos síncronos de handleEndTurn', () => {
  it('tras END_TURN con recursión de IA, el snapshot leído refleja el estado post-recursión (actionsTaken/actionsAllowed ya reseteados para LEADER), no el estado a medio camino del primer TURN_ENDED', async () => {
    const engine = buildEngineWithAi();
    const bridge = createCombatBridge(engine);

    const { result } = renderHook(() => useCombatSnapshot(bridge));

    expect(result.current.turn.turnOwner).toBe('LEADER');
    expect(result.current.actions.actionsTaken).toBe(0);

    await act(async () => {
      const dispatchResult = bridge.dispatch({ type: 'END_TURN' });
      expect(dispatchResult.ok).toBe(true);
      // Deja correr el microtask agendado por la coalescencia del hook (spec: `queueMicrotask`).
      await Promise.resolve();
    });

    // Verificación independiente contra el motor real: la recursión de `handleEndTurn` ya devolvió
    // el turno al LEADER con las acciones de su turno entrante reseteadas.
    const realSnapshot = bridge.getSnapshot();
    expect(realSnapshot.turn.turnOwner).toBe('LEADER');
    expect(realSnapshot.actions.side).toBe('LEADER');
    expect(realSnapshot.actions.actionsTaken).toBe(0);
    expect(realSnapshot.actions.actionsAllowed).toBe(2);

    // El snapshot que sirve el hook a React debe coincidir EXACTAMENTE con el estado real
    // post-recursión — no con el estado intermedio (turno ENEMY, o LEADER con acciones sin
    // resetear) capturado por cualquier evento intermedio de la ráfaga.
    expect(result.current.turn.turnOwner).toBe('LEADER');
    expect(result.current.actions.side).toBe('LEADER');
    expect(result.current.actions.actionsTaken).toBe(0);
    expect(result.current.actions.actionsAllowed).toBe(2);
  });
});
