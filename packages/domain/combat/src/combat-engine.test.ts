import { describe, it, expect } from 'vitest';
import { SeededRandomSource, createId, isOk, isErr, type AbilityId, type CoreCostRequirement, type NucleoColor } from '@collector/domain-shared';
import { CombatEngine } from './combat-engine';
import type { CombatCommandError } from './types/errors';
import type { NucleoDie } from './types/nucleo';
import type { AbilityCooldownDefinition } from './types/cooldown'; // H1.4

const ABILITY_ANY: AbilityId = createId<'AbilityId'>('AbilityId', 'ability-any');
// H1.4 — ver §5 de la spec: "Escenario B" activaba ABILITY_ANY como ENEMY y como
// LEADER en el mismo test; en H1.4 toda habilidad tiene un único `side` dueño, así
// que se introduce esta segunda constante solo para ese test.
const ABILITY_ANY_ENEMY: AbilityId = createId<'AbilityId'>('AbilityId', 'ability-any-enemy');

function abilityCosts(extra: [AbilityId, CoreCostRequirement][] = []) {
  return new Map<AbilityId, CoreCostRequirement>([[ABILITY_ANY, { kind: 'ANY' }], ...extra]);
}

// H1.4 — fixture pareja de abilityCosts(): toda instanciación de CombatEngine necesita
// ahora también abilityCooldowns con las MISMAS claves (el constructor valida paridad,
// ver combat-engine.ts). baseCooldown=1 + side='LEADER' como default: el motor aplica
// el primer tick de inicio de turno ya en el constructor, así que una habilidad LEADER
// con baseCooldown=1 queda lista (remaining=0) de inmediato si initialTurnOwner es
// 'LEADER' (el default) — preserva el comportamiento de todos los tests de H1.3 que
// activan como LEADER sin tocar sus aserciones.
function abilityCooldowns(
  extra: [AbilityId, AbilityCooldownDefinition][] = []
): ReadonlyMap<AbilityId, AbilityCooldownDefinition> {
  return new Map<AbilityId, AbilityCooldownDefinition>([
    [ABILITY_ANY, { side: 'LEADER', baseCooldown: 1 }],
    ...extra,
  ]);
}

describe('CombatEngine — ciclo de turnos', () => {
  it('alterna turnOwner y turnNumber en cada END_TURN', () => {
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: abilityCosts(),
      abilityCooldowns: abilityCooldowns(), // H1.4
    });
    expect(engine.getSnapshot().turn).toEqual({ turnOwner: 'LEADER', turnNumber: 1 });

    const r1 = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(r1)).toBe(true);
    expect(engine.getSnapshot().turn).toEqual({ turnOwner: 'ENEMY', turnNumber: 2 });

    const r2 = engine.dispatch({ type: 'END_TURN' });
    expect(isOk(r2)).toBe(true);
    expect(engine.getSnapshot().turn).toEqual({ turnOwner: 'LEADER', turnNumber: 3 });
  });

  it('respeta initialTurnOwner de la config', () => {
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: abilityCosts(),
      abilityCooldowns: abilityCooldowns(), // H1.4
      initialTurnOwner: 'ENEMY',
    });
    expect(engine.getSnapshot().turn.turnOwner).toBe('ENEMY');
  });

  it('getSnapshot() devuelve una copia defensiva: mutar el array externo no corrompe el estado interno', () => {
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: abilityCosts(),
      abilityCooldowns: abilityCooldowns(), // H1.4
    });

    const snapshot = engine.getSnapshot();
    // MODIFICADO H3.4 — 5 dados fijos (uno por color), sin dados EXTRA en este fixture.
    expect(snapshot.nucleoTable).toHaveLength(5);

    (snapshot.nucleoTable as NucleoDie[]).push({
      id: createId<'NucleoInstanceId'>('NucleoInstanceId', 'ghost'),
      color: 'CAOS',
      value: 4,
      kind: 'EXTRA',
      status: 'AVAILABLE',
    });

    expect(engine.getSnapshot().nucleoTable).toHaveLength(5);
  });
});

describe('CombatEngine — gasto de Núcleo', () => {
  it('gasto válido: elimina la ficha del pool y emite ABILITY_ACTIVATED', () => {
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(5),
      abilityCoreCosts: abilityCosts(),
      abilityCooldowns: abilityCooldowns(), // H1.4
    });
    const before = engine.getSnapshot().nucleoTable;
    const target = before[0]!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: ABILITY_ANY,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: target.id,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([
        { type: 'ABILITY_ACTIVATED', abilityId: ABILITY_ANY, sourceId: 'leader', side: 'LEADER', nucleoSpent: { id: target.id, color: target.color, value: target.value } },
      ]);
    }
    // MODIFICADO H3.4 — el dado gastado sigue en mesa (misma longitud), marcado SPENT.
    const after = engine.getSnapshot().nucleoTable;
    expect(after).toHaveLength(before.length);
    expect(after.find((n) => n.id === target.id)?.status).toBe('SPENT');
  });

  it('rechaza gastar un Núcleo inexistente', () => {
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: abilityCosts(),
      abilityCooldowns: abilityCooldowns(), // H1.4
    });
    const fakeId = createId<'NucleoInstanceId'>('NucleoInstanceId', 'no-existe');

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: ABILITY_ANY,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: fakeId,
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('NUCLEO_NOT_FOUND');
    }
  });

  it('rechaza gastar dos veces el mismo Núcleo (ya gastado)', () => {
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: abilityCosts(),
      abilityCooldowns: abilityCooldowns(), // H1.4
    });
    const target = engine.getSnapshot().nucleoTable[0]!;
    const command = {
      type: 'ACTIVATE_ABILITY' as const,
      abilityId: ABILITY_ANY,
      sourceId: 'leader',
      side: 'LEADER' as const,
      nucleoInstanceId: target.id,
    };

    expect(isOk(engine.dispatch(command))).toBe(true);
    const second = engine.dispatch(command);
    expect(isErr(second)).toBe(true);
    if (isErr(second)) {
      // H1.14: el nuevo orden de validación intercepta la 2ª activación de la MISMA
      // abilityId dentro del mismo turno con ABILITY_ALREADY_ACTIVATED_THIS_TURN, ANTES
      // de llegar al chequeo de ABILITY_ON_COOLDOWN (ver spec H1.14 §0.3/§3.4). Antes de
      // H1.14 este test esperaba 'ABILITY_ON_COOLDOWN'.
      expect((second.error as CombatCommandError).code).toBe('ABILITY_ALREADY_ACTIVATED_THIS_TURN');
    }
  });

  it('rechaza color que no satisface el requisito, sin mutar el pool', () => {
    const before0 = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: abilityCosts(),
      abilityCooldowns: abilityCooldowns(), // H1.4
    }).getSnapshot().nucleoTable;
    const target = before0[0]!;
    const mismatchedColors = (['AGRESION', 'CONTROL', 'DEFENSA', 'RECURSO', 'CAOS'] as NucleoColor[]).filter(
      (c) => c !== target.color
    );
    const ABILITY_MISMATCH: AbilityId = createId<'AbilityId'>('AbilityId', 'ability-mismatch');
    const costs = abilityCosts([[ABILITY_MISMATCH, { kind: 'COLOR', colors: mismatchedColors }]]);
    const cds = abilityCooldowns([[ABILITY_MISMATCH, { side: 'LEADER', baseCooldown: 1 }]]); // H1.4
    const engine2 = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [], randomSource: new SeededRandomSource(1), abilityCoreCosts: costs, abilityCooldowns: cds });
    const before = engine2.getSnapshot().nucleoTable;

    const result = engine2.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: ABILITY_MISMATCH,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: before[0]!.id,
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('NUCLEO_COLOR_MISMATCH');
    }
    expect(engine2.getSnapshot().nucleoTable).toEqual(before);
  });

  it('rechaza abilityId no registrado en abilityCoreCosts', () => {
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: abilityCosts(),
      abilityCooldowns: abilityCooldowns(), // H1.4
    });
    const target = engine.getSnapshot().nucleoTable[0]!;
    const UNKNOWN: AbilityId = createId<'AbilityId'>('AbilityId', 'no-registrada');

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: UNKNOWN,
      sourceId: 'leader',
      side: 'LEADER',
      nucleoInstanceId: target.id,
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('ABILITY_COST_UNKNOWN');
    }
  });

  it('rechaza activar una habilidad si `side` no coincide con el turnOwner actual', () => {
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: abilityCosts(),
      abilityCooldowns: abilityCooldowns(), // H1.4
    });
    const target = engine.getSnapshot().nucleoTable[0]!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY',
      abilityId: ABILITY_ANY,
      sourceId: 'enemy',
      side: 'ENEMY', // turnOwner por defecto es 'LEADER'
      nucleoInstanceId: target.id,
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as CombatCommandError).code).toBe('NOT_YOUR_TURN');
    }
    expect(engine.getSnapshot().nucleoTable).toEqual([target, ...engine.getSnapshot().nucleoTable.slice(1)]);
  });
});

describe('CombatEngine — relanzado automático del pool', () => {
  it('al gastarse el último dado AVAILABLE de la mesa (5 dados fijos), se relanzan TODOS en el mismo dispatch y emite NUCLEO_TABLE_REROLLED', () => {
    // MODIFICADO H3.4 — ya no hay "poolSize 1": la mesa siempre tiene 5 dados fijos.
    // Para vaciar la disponibilidad hacen falta 5 gastos — el Líder solo tiene 2
    // acciones/turno (GDD §2.1), así que se reparten entre 2 turnos de LEADER + 1 de
    // ENEMY (1 acción), con 5 habilidades ANY distintas de baseCooldown 1.
    const LEADER_A: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-reroll-a');
    const LEADER_B: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-reroll-b');
    const LEADER_C: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-reroll-c');
    const LEADER_D: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-reroll-d');
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(9),
      abilityCoreCosts: abilityCosts([
        [LEADER_A, { kind: 'ANY' }], [LEADER_B, { kind: 'ANY' }], [LEADER_C, { kind: 'ANY' }], [LEADER_D, { kind: 'ANY' }],
        [ABILITY_ANY_ENEMY, { kind: 'ANY' }],
      ]),
      abilityCooldowns: abilityCooldowns([
        [LEADER_A, { side: 'LEADER', baseCooldown: 1 }], [LEADER_B, { side: 'LEADER', baseCooldown: 1 }],
        [LEADER_C, { side: 'LEADER', baseCooldown: 1 }], [LEADER_D, { side: 'LEADER', baseCooldown: 1 }],
        [ABILITY_ANY_ENEMY, { side: 'ENEMY', baseCooldown: 1 }],
      ]),
    });

    // Turno 1 LEADER: 2 acciones (LEADER_A, LEADER_B) — 2 de 5 dados AVAILABLE gastados.
    const d1 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    expect(isOk(engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_A, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: d1.id }))).toBe(true);
    const d2 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    expect(isOk(engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_B, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: d2.id }))).toBe(true);

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY

    // Turno ENEMY: 1 acción — 3 de 5 gastados.
    const d3 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    expect(isOk(engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ABILITY_ANY_ENEMY, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: d3.id }))).toBe(true);

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    // Turno 2 LEADER: LEADER_C (4/5), luego LEADER_D gasta el ÚLTIMO disponible → reroll.
    const d4 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    expect(isOk(engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_C, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: d4.id }))).toBe(true);
    const d5 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const idsBeforeReroll = engine.getSnapshot().nucleoTable.map((d) => d.id);

    const result = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_D, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: d5.id });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]!.type).toBe('ABILITY_ACTIVATED');
      expect(result.value[1]!.type).toBe('NUCLEO_TABLE_REROLLED');
      const rerollEvent = result.value[1]!;
      if (rerollEvent.type === 'NUCLEO_TABLE_REROLLED') {
        expect(rerollEvent.dice).toHaveLength(5);
        expect(rerollEvent.dice.map((d) => d.id)).toEqual(idsBeforeReroll); // mismos ids, mismo orden
        expect(rerollEvent.dice.every((d) => d.status === 'AVAILABLE')).toBe(true);
        expect(rerollEvent.priorityTurnOwner).toBe('LEADER');
      }
    }
    const after = engine.getSnapshot().nucleoTable;
    expect(after).toHaveLength(5);
    expect(after.every((d) => d.status === 'AVAILABLE')).toBe(true);
  });
});

describe('CombatEngine — regla "elige primero quien tenga turno tras el vaciado"', () => {
  it('el vaciado ocurre en el turno de ENEMY; el reroll refleja priorityTurnOwner ENEMY, y tras END_TURN LEADER puede seguir gastando del nuevo estado', () => {
    // Fixture reducida: 4 habilidades ANY para gastar 4 dados en turno 1 de LEADER (2
    // acciones) + turno 1 de ENEMY (1 acción, no vacía todavía) + turno 2 de LEADER (1
    // acción) — el 5º y último gasto lo hace ENEMY en su 2º turno, dentro de este mismo
    // test, para verificar priorityTurnOwner === 'ENEMY'.
    const LEADER_A: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-b-a');
    const LEADER_B: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-b-b');
    const LEADER_C: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-b-c');
    const engine = new CombatEngine({ leaderMaxHealth: 100, enemyMaxHealth: 100, scenarioPlotDefeatThreshold: 999, leaderDeckCardIds: [],
      randomSource: new SeededRandomSource(11),
      abilityCoreCosts: abilityCosts([
        [LEADER_A, { kind: 'ANY' }], [LEADER_B, { kind: 'ANY' }], [LEADER_C, { kind: 'ANY' }],
        [ABILITY_ANY_ENEMY, { kind: 'ANY' }],
      ]),
      abilityCooldowns: abilityCooldowns([
        [LEADER_A, { side: 'LEADER', baseCooldown: 1 }], [LEADER_B, { side: 'LEADER', baseCooldown: 1 }],
        [LEADER_C, { side: 'LEADER', baseCooldown: 1 }],
        [ABILITY_ANY_ENEMY, { side: 'ENEMY', baseCooldown: 1 }],
      ]),
    });

    // Turno 1 LEADER: 2 gastos (2/5).
    const d1 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_A, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: d1.id });
    const d2 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_B, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: d2.id });
    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY

    // Turno 1 ENEMY: 1 gasto (3/5).
    const d3 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ABILITY_ANY_ENEMY, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: d3.id });
    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER

    // Turno 2 LEADER: 1 gasto (4/5) — ABILITY_ANY_ENEMY sigue en CD, LEADER usa su 3ª habilidad.
    const d4 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_C, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: d4.id });
    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY

    // Turno 2 ENEMY: ABILITY_ANY_ENEMY vuelve a estar lista (CD1, tick de inicio de
    // turno) — gasta el ÚLTIMO dado disponible (5/5) → reroll con priorityTurnOwner ENEMY.
    const d5 = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const rEnemy = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ABILITY_ANY_ENEMY, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: d5.id });
    expect(isOk(rEnemy)).toBe(true);
    if (isOk(rEnemy)) {
      const refillEvent = rEnemy.value.find((e) => e.type === 'NUCLEO_TABLE_REROLLED');
      expect(refillEvent && 'priorityTurnOwner' in refillEvent ? refillEvent.priorityTurnOwner : undefined).toBe('ENEMY');
    }

    // ENEMY termina su turno.
    engine.dispatch({ type: 'END_TURN' });
    expect(engine.getSnapshot().turn.turnOwner).toBe('LEADER');

    // ENEMY intenta gastar tras haber terminado su turno: rechazado por NOT_YOUR_TURN.
    const staleNucleo = engine.getSnapshot().nucleoTable.find((d) => d.status === 'AVAILABLE')!;
    const rEnemyLate = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ABILITY_ANY_ENEMY, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: staleNucleo.id });
    expect(isErr(rEnemyLate)).toBe(true);
    if (isErr(rEnemyLate)) {
      expect((rEnemyLate.error as CombatCommandError).code).toBe('NOT_YOUR_TURN');
    }

    // LEADER (el turno inmediatamente después del reroll, que ocurrió en turno de ENEMY)
    // sí puede gastar del nuevo estado de mesa ya relanzado.
    const rLeader = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ABILITY_ANY, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: staleNucleo.id });
    expect(isOk(rLeader)).toBe(true);
  });
});
