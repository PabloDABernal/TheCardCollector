import { describe, it, expect } from 'vitest';
import { SeededRandomSource, createId, isOk, type AbilityId, type CoreCostRequirement } from '@collector/domain-shared';
import { CombatEngine } from './combat-engine';
import type { CombatEvent } from './types/events';
import type { AbilityCooldownDefinition } from './types/cooldown';
import type { AbilityEffectDefinition } from './types/ability-effect';

const ENEMY_ATTACK: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-attack');
const ENEMY_ATTACK_ARROLLAR: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-attack-arrollar');
const ENEMY_PLOT: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-plot');
const LEADER_ANTI_PLOT: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-anti-plot');

function costs(ids: AbilityId[]): Map<AbilityId, CoreCostRequirement> {
  return new Map(ids.map((id) => [id, { kind: 'ANY' } as CoreCostRequirement]));
}

function cooldowns(entries: [AbilityId, AbilityCooldownDefinition][]): Map<AbilityId, AbilityCooldownDefinition> {
  return new Map(entries);
}

function effects(entries: [AbilityId, AbilityEffectDefinition][]): Map<AbilityId, AbilityEffectDefinition> {
  return new Map(entries);
}

describe('CombatEngine — H1.6: Ataque del Enemigo solo afecta leaderDamage, nunca scenarioPlot', () => {
  it('activar ENEMY_ATTACK (formula VALUE, sin escudo) suma el valor del Núcleo a leaderDamage; scenarioPlot no se mueve', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([ENEMY_ATTACK]),
      abilityCooldowns: cooldowns([[ENEMY_ATTACK, { side: 'ENEMY', baseCooldown: 1 }]]),
      abilityEffects: effects([[ENEMY_ATTACK, { kind: 'ATTACK', formula: { baseFormula: { kind: 'VALUE' } } }]]),
      initialTurnOwner: 'ENEMY',
    });
    const nucleo = engine.getSnapshot().nucleoPool[0]!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });

    expect(isOk(result)).toBe(true);
    const snapshot = engine.getSnapshot();
    expect(snapshot.leaderDamage).toBe(nucleo.value);
    expect(snapshot.scenarioPlot).toBe(0);
  });
});

describe('CombatEngine — H1.6: Trama del Enemigo solo afecta scenarioPlot, nunca leaderDamage', () => {
  it('activar ENEMY_PLOT (amount fijo=3) sube scenarioPlot en 3; leaderDamage no se mueve', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(2),
      abilityCoreCosts: costs([ENEMY_PLOT]),
      abilityCooldowns: cooldowns([[ENEMY_PLOT, { side: 'ENEMY', baseCooldown: 1 }]]),
      abilityEffects: effects([[ENEMY_PLOT, { kind: 'PLOT', amount: 3 }]]),
      initialTurnOwner: 'ENEMY',
    });
    const nucleo = engine.getSnapshot().nucleoPool[0]!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_PLOT, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });

    expect(isOk(result)).toBe(true);
    const snapshot = engine.getSnapshot();
    expect(snapshot.scenarioPlot).toBe(3);
    expect(snapshot.leaderDamage).toBe(0);
  });

  it('el valor del Núcleo gastado NO influye en la magnitud de Trama (no está alimentada por Umbral, ver spec §0.3)', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(2),
      abilityCoreCosts: costs([ENEMY_PLOT]),
      abilityCooldowns: cooldowns([[ENEMY_PLOT, { side: 'ENEMY', baseCooldown: 1 }]]),
      abilityEffects: effects([[ENEMY_PLOT, { kind: 'PLOT', amount: 3 }]]),
      initialTurnOwner: 'ENEMY',
      poolSize: 6,
    });
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_PLOT, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id });
    // Sea cual sea nucleo.value (1-4), scenarioPlot sube exactamente `amount` (3).
    expect(engine.getSnapshot().scenarioPlot).toBe(3);
  });
});

describe('CombatEngine — H1.6: una habilidad nunca hace ambas cosas (Ataque y Trama a la vez)', () => {
  it('activar una habilidad ATTACK deja scenarioPlot en 0 Y activar una habilidad PLOT deja leaderDamage en 0, en el mismo engine', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(3),
      abilityCoreCosts: costs([ENEMY_ATTACK, ENEMY_PLOT]),
      abilityCooldowns: cooldowns([
        [ENEMY_ATTACK, { side: 'ENEMY', baseCooldown: 1 }],
        [ENEMY_PLOT, { side: 'ENEMY', baseCooldown: 1 }],
      ]),
      abilityEffects: effects([
        [ENEMY_ATTACK, { kind: 'ATTACK', formula: { baseFormula: { kind: 'VALUE' } } }],
        [ENEMY_PLOT, { kind: 'PLOT', amount: 2 }],
      ]),
      initialTurnOwner: 'ENEMY',
      poolSize: 6,
    });

    const n1 = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: n1.id });
    expect(engine.getSnapshot().leaderDamage).toBe(n1.value);
    expect(engine.getSnapshot().scenarioPlot).toBe(0); // ATTACK no tocó Trama

    const n2 = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_PLOT, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: n2.id });
    expect(engine.getSnapshot().scenarioPlot).toBe(2);
    expect(engine.getSnapshot().leaderDamage).toBe(n1.value); // PLOT no tocó leaderDamage
  });
});

describe('CombatEngine — H1.6: criterio de aceptación literal — "algo" bloquea daño pero no Trama (leaderShield, GDD §2.8, ver spec §0.1)', () => {
  it('con leaderShield=4 (>= NUCLEO_VALUE_MAX), un ataque VALUE queda totalmente absorbido: leaderDamage sigue en 0; una Trama posterior SÍ sube y NO consume leaderShield', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(4),
      abilityCoreCosts: costs([ENEMY_ATTACK, ENEMY_PLOT]),
      abilityCooldowns: cooldowns([
        [ENEMY_ATTACK, { side: 'ENEMY', baseCooldown: 1 }],
        [ENEMY_PLOT, { side: 'ENEMY', baseCooldown: 1 }],
      ]),
      abilityEffects: effects([
        [ENEMY_ATTACK, { kind: 'ATTACK', formula: { baseFormula: { kind: 'VALUE' } } }],
        [ENEMY_PLOT, { kind: 'PLOT', amount: 2 }],
      ]),
      initialTurnOwner: 'ENEMY',
      initialLeaderShield: 4,
      poolSize: 6,
    });

    // 1) El "escudo" bloquea el daño de Ataque por completo (valor de Núcleo máximo
    //    posible es 4 = leaderShield inicial).
    const attackNucleo = engine.getSnapshot().nucleoPool[0]!;
    const rAttack = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: attackNucleo.id,
    });
    expect(isOk(rAttack)).toBe(true);
    const afterAttack = engine.getSnapshot();
    expect(afterAttack.leaderDamage).toBe(0); // daño bloqueado
    const shieldAfterAttack = afterAttack.leaderShield;
    expect(shieldAfterAttack).toBe(4 - attackNucleo.value); // escudo consumido según el ataque

    // 2) La MISMA fuente de bloqueo NO frena Trama: scenarioPlot sube su magnitud
    //    completa y leaderShield permanece intacto.
    const plotNucleo = engine.getSnapshot().nucleoPool[0]!;
    const rPlot = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_PLOT, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: plotNucleo.id,
    });
    expect(isOk(rPlot)).toBe(true);
    const afterPlot = engine.getSnapshot();
    expect(afterPlot.scenarioPlot).toBe(2); // Trama sube completa, sin descuento de escudo
    expect(afterPlot.leaderShield).toBe(shieldAfterAttack); // escudo INTACTO tras la Trama
  });
});

describe('CombatEngine — H1.6: Arrollar (GDD §2.8) — exceso pasa a leaderDamage solo si la habilidad lo declara', () => {
  it('sin arrollar: exceso sobre leaderShield se pierde, leaderDamage no sube', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(5),
      abilityCoreCosts: costs([ENEMY_ATTACK]),
      abilityCooldowns: cooldowns([[ENEMY_ATTACK, { side: 'ENEMY', baseCooldown: 1 }]]),
      // formula ADD amount=3: rawAmount = nucleo.value(1-4) + 3, SIEMPRE > shield inicial (2).
      abilityEffects: effects([[ENEMY_ATTACK, { kind: 'ATTACK', formula: { baseFormula: { kind: 'ADD', amount: 3 } } }]]),
      initialTurnOwner: 'ENEMY',
      initialLeaderShield: 2,
    });
    const nucleo = engine.getSnapshot().nucleoPool[0]!;

    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id });

    const snapshot = engine.getSnapshot();
    expect(snapshot.leaderShield).toBe(0); // escudo agotado
    expect(snapshot.leaderDamage).toBe(0); // exceso perdido, NO pasa a vida
  });

  it('con arrollar: true, el exceso sobre leaderShield SÍ pasa a leaderDamage', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(5),
      abilityCoreCosts: costs([ENEMY_ATTACK_ARROLLAR]),
      abilityCooldowns: cooldowns([[ENEMY_ATTACK_ARROLLAR, { side: 'ENEMY', baseCooldown: 1 }]]),
      abilityEffects: effects([[ENEMY_ATTACK_ARROLLAR, { kind: 'ATTACK', formula: { baseFormula: { kind: 'ADD', amount: 3 } }, arrollar: true }]]),
      initialTurnOwner: 'ENEMY',
      initialLeaderShield: 2,
    });
    const nucleo = engine.getSnapshot().nucleoPool[0]!;

    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK_ARROLLAR, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id });

    const rawAmount = nucleo.value + 3;
    const snapshot = engine.getSnapshot();
    expect(snapshot.leaderShield).toBe(0);
    expect(snapshot.leaderDamage).toBe(rawAmount - 2); // exceso sobre las 2 fichas de escudo
  });
});

describe('CombatEngine — H1.6: bidireccionalidad de Trama (GDD §12: "Enemigo sube, jugador baja")', () => {
  it('una habilidad PLOT de side LEADER resta de scenarioPlot', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(6),
      abilityCoreCosts: costs([ENEMY_PLOT, LEADER_ANTI_PLOT]),
      abilityCooldowns: cooldowns([
        [ENEMY_PLOT, { side: 'ENEMY', baseCooldown: 1 }],
        [LEADER_ANTI_PLOT, { side: 'LEADER', baseCooldown: 1 }],
      ]),
      abilityEffects: effects([
        [ENEMY_PLOT, { kind: 'PLOT', amount: 5 }],
        [LEADER_ANTI_PLOT, { kind: 'PLOT', amount: 2 }],
      ]),
      poolSize: 6,
    });

    // LEADER tiene el turno inicial: sube primero la Trama vía una activación ENEMY no
    // es posible (NOT_YOUR_TURN) — se sube manualmente pasando primero por ENEMY.
    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    const enemyNucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: ENEMY_PLOT, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: enemyNucleo.id });
    expect(engine.getSnapshot().scenarioPlot).toBe(5);

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER
    const leaderNucleo = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_ANTI_PLOT, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: leaderNucleo.id });
    expect(engine.getSnapshot().scenarioPlot).toBe(3); // 5 - 2
  });

  it('scenarioPlot satura en 0, nunca queda negativo', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(7),
      abilityCoreCosts: costs([LEADER_ANTI_PLOT]),
      abilityCooldowns: cooldowns([[LEADER_ANTI_PLOT, { side: 'LEADER', baseCooldown: 1 }]]),
      abilityEffects: effects([[LEADER_ANTI_PLOT, { kind: 'PLOT', amount: 2 }]]),
      poolSize: 6,
    });
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    // scenarioPlot arranca en 0; una habilidad LEADER lo intenta bajar en 2.
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_ANTI_PLOT, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: nucleo.id });
    expect(engine.getSnapshot().scenarioPlot).toBe(0); // saturado, no -2
  });
});

describe('CombatEngine — H1.6: eventos LEADER_DAMAGED / SCENARIO_PLOT_CHANGED', () => {
  it('ACTIVATE_ABILITY de una ATTACK emite [ABILITY_ACTIVATED, LEADER_DAMAGED] en ese orden', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(8),
      abilityCoreCosts: costs([ENEMY_ATTACK]),
      abilityCooldowns: cooldowns([[ENEMY_ATTACK, { side: 'ENEMY', baseCooldown: 1 }]]),
      abilityEffects: effects([[ENEMY_ATTACK, { kind: 'ATTACK', formula: { baseFormula: { kind: 'VALUE' } } }]]),
      initialTurnOwner: 'ENEMY',
      poolSize: 6,
    });
    const nucleo = engine.getSnapshot().nucleoPool[0]!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_ATTACK, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.map((e) => e.type)).toEqual(['ABILITY_ACTIVATED', 'LEADER_DAMAGED']);
      const damaged = result.value[1] as Extract<CombatEvent, { type: 'LEADER_DAMAGED' }>;
      expect(damaged.rawAmount).toBe(nucleo.value);
      expect(damaged.absorbedByShield).toBe(0);
      expect(damaged.appliedDamage).toBe(nucleo.value);
      expect(damaged.leaderDamageAfter).toBe(nucleo.value);
      expect(damaged.leaderShieldAfter).toBe(0);
    }
  });

  it('ACTIVATE_ABILITY de una PLOT emite [ABILITY_ACTIVATED, SCENARIO_PLOT_CHANGED] en ese orden', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(9),
      abilityCoreCosts: costs([ENEMY_PLOT]),
      abilityCooldowns: cooldowns([[ENEMY_PLOT, { side: 'ENEMY', baseCooldown: 1 }]]),
      abilityEffects: effects([[ENEMY_PLOT, { kind: 'PLOT', amount: 4 }]]),
      initialTurnOwner: 'ENEMY',
      poolSize: 6,
    });
    const nucleo = engine.getSnapshot().nucleoPool[0]!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: ENEMY_PLOT, sourceId: 'enemy', side: 'ENEMY', nucleoInstanceId: nucleo.id,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.map((e) => e.type)).toEqual(['ABILITY_ACTIVATED', 'SCENARIO_PLOT_CHANGED']);
      const changed = result.value[1] as Extract<CombatEvent, { type: 'SCENARIO_PLOT_CHANGED' }>;
      expect(changed.direction).toBe('INCREASE');
      expect(changed.rawAmount).toBe(4);
      expect(changed.appliedDelta).toBe(4);
      expect(changed.scenarioPlotAfter).toBe(4);
    }
  });

  it('una habilidad sin entrada en abilityEffects no emite LEADER_DAMAGED ni SCENARIO_PLOT_CHANGED (comportamiento idéntico a H1.3-H1.5)', () => {
    const NO_EFFECT: AbilityId = createId<'AbilityId'>('AbilityId', 'no-effect');
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(10),
      abilityCoreCosts: costs([NO_EFFECT]),
      abilityCooldowns: cooldowns([[NO_EFFECT, { side: 'LEADER', baseCooldown: 1 }]]),
      // abilityEffects omitido por completo
      poolSize: 6,
    });
    const nucleo = engine.getSnapshot().nucleoPool[0]!;

    const result = engine.dispatch({
      type: 'ACTIVATE_ABILITY', abilityId: NO_EFFECT, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: nucleo.id,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.map((e) => e.type)).toEqual(['ABILITY_ACTIVATED']);
    }
    expect(engine.getSnapshot().leaderDamage).toBe(0);
    expect(engine.getSnapshot().scenarioPlot).toBe(0);
  });
});

describe('CombatEngine — H1.6: validación de configuración (fallos rápidos del constructor)', () => {
  it('lanza si abilityEffects tiene una clave ausente en abilityCoreCosts/abilityCooldowns', () => {
    const GHOST: AbilityId = createId<'AbilityId'>('AbilityId', 'ghost-ability');
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      abilityEffects: effects([[GHOST, { kind: 'PLOT', amount: 1 }]]),
    })).toThrow();
  });

  it('lanza si una habilidad ATTACK pertenece a side LEADER (H1.6 solo modela daño Enemigo→Líder, ver spec §0.5)', () => {
    const LEADER_ATTACK: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-attack-not-supported');
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([LEADER_ATTACK]),
      abilityCooldowns: cooldowns([[LEADER_ATTACK, { side: 'LEADER', baseCooldown: 1 }]]),
      abilityEffects: effects([[LEADER_ATTACK, { kind: 'ATTACK', formula: { baseFormula: { kind: 'VALUE' } } }]]),
    })).toThrow();
  });

  it('lanza si initialLeaderShield es negativo', () => {
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      initialLeaderShield: -1,
    })).toThrow();
  });

  it('lanza si initialLeaderShield excede LEADER_SHIELD_MAX (5)', () => {
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      initialLeaderShield: 6,
    })).toThrow();
  });

  it('lanza si initialLeaderShield no es entero', () => {
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
      initialLeaderShield: 2.5,
    })).toThrow();
  });

  it('abilityEffects omitido por completo (undefined) es válido — equivale a Map vacío', () => {
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([]),
      abilityCooldowns: cooldowns([]),
    })).not.toThrow();
  });
});
