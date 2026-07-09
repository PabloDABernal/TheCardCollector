import { describe, it, expect } from 'vitest';
import { SeededRandomSource, createId, isOk, isErr, type AbilityId, type CoreCostRequirement } from '@collector/domain-shared';
import { CombatEngine } from './combat-engine';
import type { CombatCommandError } from './types/errors';
import type { CombatEvent } from './types/events';
import type { AbilityCooldownDefinition } from './types/cooldown';

const LEADER_A: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-combo-a');
const LEADER_B: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-combo-b');
const LEADER_C: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-plain-c');
const ENEMY_A: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-combo-a');
const ENEMY_B: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-plain-b');

function costs(ids: AbilityId[]): Map<AbilityId, CoreCostRequirement> {
  return new Map(ids.map((id) => [id, { kind: 'ANY' } as CoreCostRequirement]));
}

function cooldowns(entries: [AbilityId, AbilityCooldownDefinition][]): Map<AbilityId, AbilityCooldownDefinition> {
  return new Map(entries);
}

describe('CombatEngine — H1.14: Combo (GDD §2.6)', () => {
  it('activar una habilidad LEADER con abilityCombo emite COMBO_TRIGGERED (actionsAllowedThisTurn: 3), permitiendo una 3ª acción', () => {
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([LEADER_A, LEADER_B]),
      abilityCooldowns: cooldowns([
        [LEADER_A, { side: 'LEADER', baseCooldown: 1 }],
        [LEADER_B, { side: 'LEADER', baseCooldown: 1 }],
      ]),
      abilityCombo: new Set([LEADER_A]),
    });

    const n1 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const r1 = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_A, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: n1.id });
    expect(isOk(r1)).toBe(true);
    if (isOk(r1)) {
      expect(r1.value.map((e) => e.type)).toEqual(['ABILITY_ACTIVATED', 'COMBO_TRIGGERED']);
      const combo = r1.value[1] as Extract<CombatEvent, { type: 'COMBO_TRIGGERED' }>;
      expect(combo.actionsAllowedThisTurn).toBe(3);
      expect(combo.abilityId).toBe(LEADER_A);
      expect(combo.side).toBe('LEADER');
    }
    expect(engine.getSnapshot().actions.actionsAllowed).toBe(3);

    // 3ª acción (habilidad distinta, sin CD): aceptada.
    const n2 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const r2 = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_B, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: n2.id });
    expect(isOk(r2)).toBe(true);
  });

  it('sin ninguna activación Combo, una 3ª ACTIVATE_ABILITY en el mismo turno es rechazada con NO_ACTIONS_REMAINING (actionsAllowed: 2)', () => {
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(2),
      abilityCoreCosts: costs([LEADER_A, LEADER_B, LEADER_C]),
      abilityCooldowns: cooldowns([
        [LEADER_A, { side: 'LEADER', baseCooldown: 1 }],
        [LEADER_B, { side: 'LEADER', baseCooldown: 1 }],
        [LEADER_C, { side: 'LEADER', baseCooldown: 1 }],
      ]),
    });

    const n1 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_A, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: n1.id });
    const n2 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_B, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: n2.id });

    const n3 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const r3 = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_C, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: n3.id });
    expect(isErr(r3)).toBe(true);
    if (isErr(r3)) {
      const error = r3.error as Extract<CombatCommandError, { code: 'NO_ACTIONS_REMAINING' }>;
      expect(error.code).toBe('NO_ACTIONS_REMAINING');
      expect(error.actionsAllowed).toBe(2);
    }
  });

  it('activar 2 habilidades con Combo cada una: el bonus solo se concede una vez (tope 3, no sube a 4); una 4ª activación es rechazada con NO_ACTIONS_REMAINING', () => {
    const LEADER_D: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-combo-d');
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(3),
      abilityCoreCosts: costs([LEADER_A, LEADER_B, LEADER_D]),
      abilityCooldowns: cooldowns([
        [LEADER_A, { side: 'LEADER', baseCooldown: 1 }],
        [LEADER_B, { side: 'LEADER', baseCooldown: 1 }],
        [LEADER_D, { side: 'LEADER', baseCooldown: 1 }],
      ]),
      abilityCombo: new Set([LEADER_A, LEADER_B]),
    });

    const n1 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const r1 = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_A, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: n1.id });
    expect(isOk(r1)).toBe(true);
    if (isOk(r1)) {
      expect(r1.value.some((e) => e.type === 'COMBO_TRIGGERED')).toBe(true);
    }
    expect(engine.getSnapshot().actions.actionsAllowed).toBe(3);

    const n2 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const r2 = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_B, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: n2.id });
    expect(isOk(r2)).toBe(true);
    if (isOk(r2)) {
      // 2ª activación con Combo: NO emite un 2º COMBO_TRIGGERED (tope ya alcanzado).
      expect(r2.value.some((e) => e.type === 'COMBO_TRIGGERED')).toBe(false);
    }
    expect(engine.getSnapshot().actions.actionsAllowed).toBe(3); // se mantiene, no sube a 4

    const n3 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const r3 = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_D, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: n3.id });
    expect(isOk(r3)).toBe(true); // 3ª acción, dentro del tope

    // 4ª acción: NO_ACTIONS_REMAINING se valida ANTES que ABILITY_ALREADY_ACTIVATED_THIS_TURN
    // (ver spec §3.4) — se rechaza por límite de acciones, aunque se reintente una
    // habilidad ya usada este turno.
    const n4 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const r4 = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_A, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: n4.id });
    expect(isErr(r4)).toBe(true);
    if (isErr(r4)) {
      const error = r4.error as CombatCommandError;
      expect(error.code).toBe('NO_ACTIONS_REMAINING');
    }
  });

  it('repetir la MISMA abilityId como intento de 3ª acción (con Combo ya generado) es rechazada con ABILITY_ALREADY_ACTIVATED_THIS_TURN', () => {
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(4),
      abilityCoreCosts: costs([LEADER_A]),
      abilityCooldowns: cooldowns([[LEADER_A, { side: 'LEADER', baseCooldown: 1 }]]),
      abilityCombo: new Set([LEADER_A]),
    });

    const n1 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const r1 = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_A, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: n1.id });
    expect(isOk(r1)).toBe(true);
    expect(engine.getSnapshot().actions.actionsAllowed).toBe(3); // Combo concedido

    const n2 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const r2 = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_A, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: n2.id });
    expect(isErr(r2)).toBe(true);
    if (isErr(r2)) {
      expect((r2.error as CombatCommandError).code).toBe('ABILITY_ALREADY_ACTIVATED_THIS_TURN');
    }
  });

  it('el bonus de Combo NO persiste al siguiente turno: tras END_TURN y volver al Líder, actionsAllowed vuelve a 2', () => {
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(5),
      abilityCoreCosts: costs([LEADER_A]),
      abilityCooldowns: cooldowns([[LEADER_A, { side: 'LEADER', baseCooldown: 1 }]]),
      abilityCombo: new Set([LEADER_A]),
    });

    const n1 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_A, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: n1.id });
    expect(engine.getSnapshot().actions.actionsAllowed).toBe(3);

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    const snapshot = engine.getSnapshot();
    expect(snapshot.turn.turnOwner).toBe('LEADER');
    expect(snapshot.actions.actionsAllowed).toBe(2);
    expect(snapshot.actions.actionsTaken).toBe(0);
    expect(snapshot.actions.comboBonusGranted).toBe(false);
  });

  it('el constructor lanza si abilityCombo incluye un abilityId con side ENEMY', () => {
    expect(() => new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([ENEMY_A]),
      abilityCooldowns: cooldowns([[ENEMY_A, { side: 'ENEMY', baseCooldown: 1 }]]),
      abilityCombo: new Set([ENEMY_A]),
    })).toThrow();
  });

  it('ENEMY solo tiene 1 acción por turno: 2ª ACTIVATE_ABILITY de side ENEMY en el mismo turno es rechazada con NO_ACTIONS_REMAINING (actionsAllowed: 1)', () => {
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(6),
      abilityCoreCosts: costs([ENEMY_A, ENEMY_B]),
      abilityCooldowns: cooldowns([
        [ENEMY_A, { side: 'ENEMY', baseCooldown: 1 }],
        [ENEMY_B, { side: 'ENEMY', baseCooldown: 1 }],
      ]),
      initialTurnOwner: 'ENEMY',
    });

    const n1 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const r1 = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_A, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: n1.id });
    expect(isOk(r1)).toBe(true);

    const n2 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const r2 = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_B, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: n2.id });
    expect(isErr(r2)).toBe(true);
    if (isErr(r2)) {
      const error = r2.error as Extract<CombatCommandError, { code: 'NO_ACTIONS_REMAINING' }>;
      expect(error.code).toBe('NO_ACTIONS_REMAINING');
      expect(error.actionsAllowed).toBe(1);
    }
  });
});
