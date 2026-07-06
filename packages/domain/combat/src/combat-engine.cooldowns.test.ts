import { describe, it, expect } from 'vitest';
import { SeededRandomSource, createId, isOk, isErr, type AbilityId, type CoreCostRequirement } from '@collector/domain-shared';
import { CombatEngine } from './combat-engine';
import type { CombatCommandError } from './types/errors';
import type { AbilityCooldownDefinition } from './types/cooldown';
import type { CombatEvent } from './types/events';

const LEADER_CD1: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-cd1');
const LEADER_CD2: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-cd2');
const LEADER_CD3: AbilityId = createId<'AbilityId'>('AbilityId', 'leader-cd3');
const ENEMY_CD1: AbilityId = createId<'AbilityId'>('AbilityId', 'enemy-cd1');

function costs(ids: AbilityId[]): Map<AbilityId, CoreCostRequirement> {
  return new Map(ids.map((id) => [id, { kind: 'ANY' } as CoreCostRequirement]));
}

function cooldowns(entries: [AbilityId, AbilityCooldownDefinition][]): Map<AbilityId, AbilityCooldownDefinition> {
  return new Map(entries);
}

describe('CombatEngine — cooldowns: CD1 siempre disponible desde el primer turno (GDD §2.5)', () => {
  it('una habilidad LEADER con baseCooldown=1 ya está lista (remaining=0) en getSnapshot() antes de cualquier acción', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([LEADER_CD1]),
      abilityCooldowns: cooldowns([[LEADER_CD1, { side: 'LEADER', baseCooldown: 1 }]]),
      poolSize: 6,
    });

    expect(engine.getSnapshot().cooldowns).toEqual([
      { abilityId: LEADER_CD1, side: 'LEADER', baseCooldown: 1, remaining: 0 },
    ]);
  });

  it('tras activarla, vuelve a estar en cooldown (remaining = baseCooldown) — no puede repetirse en la misma vuelta', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([LEADER_CD1]),
      abilityCooldowns: cooldowns([[LEADER_CD1, { side: 'LEADER', baseCooldown: 1 }]]),
      poolSize: 6,
    });
    const nucleo1 = engine.getSnapshot().nucleoPool[0]!;

    const r1 = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_CD1, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: nucleo1.id });
    expect(isOk(r1)).toBe(true);
    expect(engine.getSnapshot().cooldowns).toEqual([
      { abilityId: LEADER_CD1, side: 'LEADER', baseCooldown: 1, remaining: 1 },
    ]);

    // CRITERIO CENTRAL de H1.4: la 2ª acción del MISMO turno (todavía no hay END_TURN)
    // se rechaza por CD — demuestra que el descuento es "por vuelta", no "por acción".
    const nucleo2 = engine.getSnapshot().nucleoPool[0]!;
    const r2 = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_CD1, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: nucleo2.id });
    expect(isErr(r2)).toBe(true);
    if (isErr(r2)) {
      // H1.14: el nuevo orden de validación intercepta la repetición de la MISMA
      // abilityId dentro del mismo turno con ABILITY_ALREADY_ACTIVATED_THIS_TURN, ANTES
      // de llegar al chequeo de ABILITY_ON_COOLDOWN (ver spec H1.14 §0.3). Antes de
      // H1.14 este test esperaba 'ABILITY_ON_COOLDOWN'.
      expect((r2.error as CombatCommandError).code).toBe('ABILITY_ALREADY_ACTIVATED_THIS_TURN');
    }
    // No debe haberse mutado el pool: el 2º intento fue rechazado antes de tocar Núcleos.
    // (poolSize inicial 6, menos 1 consumido por la 1ª activación exitosa r1 = 5).
    expect(engine.getSnapshot().nucleoPool).toHaveLength(5);
  });

  it('vuelve a estar lista exactamente en el siguiente turno propio de LEADER (tras 2 END_TURN)', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([LEADER_CD1]),
      abilityCooldowns: cooldowns([[LEADER_CD1, { side: 'LEADER', baseCooldown: 1 }]]),
      poolSize: 6,
    });
    const nucleo1 = engine.getSnapshot().nucleoPool[0]!;
    engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_CD1, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: nucleo1.id });
    expect(engine.getSnapshot().cooldowns[0]!.remaining).toBe(1);

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY: no toca CD de LEADER_CD1
    expect(engine.getSnapshot().cooldowns[0]!.remaining).toBe(1);

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER: tick de LEADER, 1 -> 0
    expect(engine.getSnapshot().cooldowns[0]!.remaining).toBe(0);

    const nucleo2 = engine.getSnapshot().nucleoPool[0]!;
    const r3 = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_CD1, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: nucleo2.id });
    expect(isOk(r3)).toBe(true);
  });
});

describe('CombatEngine — cooldowns: CD > 1 tarda varios turnos propios (no por acción)', () => {
  it('CD2: no está lista en el turno 1; requiere que pasen 2 turnos propios completos tras el uso para volver a estar lista', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(2),
      abilityCoreCosts: costs([LEADER_CD2]),
      abilityCooldowns: cooldowns([[LEADER_CD2, { side: 'LEADER', baseCooldown: 2 }]]),
      poolSize: 6,
    });

    // Calentamiento (remaining=2) + tick de inicio del turno 1 (LEADER): 2 -> 1. No lista.
    expect(engine.getSnapshot().cooldowns[0]).toEqual({ abilityId: LEADER_CD2, side: 'LEADER', baseCooldown: 2, remaining: 1 });
    const nucleo = engine.getSnapshot().nucleoPool[0]!;
    const rBlocked = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_CD2, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: nucleo.id });
    expect(isErr(rBlocked)).toBe(true);
    if (isErr(rBlocked)) expect((rBlocked.error as CombatCommandError).code).toBe('ABILITY_ON_COOLDOWN');

    engine.dispatch({ type: 'END_TURN' }); // -> ENEMY (no toca LEADER_CD2)
    expect(engine.getSnapshot().cooldowns[0]!.remaining).toBe(1);

    engine.dispatch({ type: 'END_TURN' }); // -> LEADER (2º turno propio desde el inicio): 1 -> 0
    expect(engine.getSnapshot().cooldowns[0]!.remaining).toBe(0);

    const nucleo2 = engine.getSnapshot().nucleoPool[0]!;
    const rReady = engine.dispatch({ type: 'ACTIVATE_ABILITY', abilityId: LEADER_CD2, sourceId: 'leader', side: 'LEADER', nucleoInstanceId: nucleo2.id });
    expect(isOk(rReady)).toBe(true);

    // Tras usarla, vuelve a su CD base completo (2), no a un valor parcial.
    expect(engine.getSnapshot().cooldowns[0]!.remaining).toBe(2);
  });
});

describe('CombatEngine — cooldowns: el descuento es "por lado propio", NUNCA "todas las habilidades en cada END_TURN"', () => {
  it('las cooldowns de ENEMY no bajan en los turnos de LEADER, y viceversa (resuelve la ambigüedad central de H1.4, ver §0.2 de la spec)', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(3),
      abilityCoreCosts: costs([LEADER_CD3, ENEMY_CD1]),
      abilityCooldowns: cooldowns([
        [LEADER_CD3, { side: 'LEADER', baseCooldown: 3 }],
        [ENEMY_CD1, { side: 'ENEMY', baseCooldown: 1 }],
      ]),
      poolSize: 6,
    });

    // Construcción (turnOwner LEADER, turno 1): solo LEADER_CD3 recibe el tick inicial.
    // ENEMY_CD1 (calentamiento — "el enemigo también arranca en cooldown", GDD §2.5)
    // permanece en su baseCooldown hasta que le toque su PROPIO turno.
    const before = engine.getSnapshot().cooldowns;
    expect(before.find((c) => c.abilityId === LEADER_CD3)!.remaining).toBe(2); // 3 - 1
    expect(before.find((c) => c.abilityId === ENEMY_CD1)!.remaining).toBe(1); // sin tocar

    engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY: tick(ENEMY)
    const afterFirst = engine.getSnapshot().cooldowns;
    expect(afterFirst.find((c) => c.abilityId === LEADER_CD3)!.remaining).toBe(2); // sin cambio
    expect(afterFirst.find((c) => c.abilityId === ENEMY_CD1)!.remaining).toBe(0); // 1 -> 0, listo

    engine.dispatch({ type: 'END_TURN' }); // ENEMY -> LEADER: tick(LEADER)
    const afterSecond = engine.getSnapshot().cooldowns;
    expect(afterSecond.find((c) => c.abilityId === LEADER_CD3)!.remaining).toBe(1); // 2 -> 1
    expect(afterSecond.find((c) => c.abilityId === ENEMY_CD1)!.remaining).toBe(0); // sin cambio
  });
});

describe('CombatEngine — cooldowns: evento COOLDOWNS_TICKED', () => {
  it('END_TURN emite TURN_ENDED seguido de COOLDOWNS_TICKED, con solo las cooldowns del nuevo turnOwner', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(4),
      abilityCoreCosts: costs([LEADER_CD1, ENEMY_CD1]),
      abilityCooldowns: cooldowns([
        [LEADER_CD1, { side: 'LEADER', baseCooldown: 1 }],
        [ENEMY_CD1, { side: 'ENEMY', baseCooldown: 1 }],
      ]),
      poolSize: 6,
    });

    const result = engine.dispatch({ type: 'END_TURN' }); // LEADER -> ENEMY
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]!.type).toBe('TURN_ENDED');
      expect(result.value[1]!.type).toBe('COOLDOWNS_TICKED');
      const tickedEvent = result.value[1] as Extract<CombatEvent, { type: 'COOLDOWNS_TICKED' }>;
      expect(tickedEvent.side).toBe('ENEMY');
      expect(tickedEvent.cooldowns).toEqual([
        { abilityId: ENEMY_CD1, side: 'ENEMY', baseCooldown: 1, remaining: 0 },
      ]);
    }
  });
});

describe('CombatEngine — validación de configuración de cooldowns (fallos rápidos del constructor)', () => {
  it('lanza si abilityCoreCosts tiene una clave ausente en abilityCooldowns', () => {
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([LEADER_CD1]),
      abilityCooldowns: cooldowns([]),
    })).toThrow();
  });

  it('lanza si abilityCooldowns tiene una clave ausente en abilityCoreCosts', () => {
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: new Map(),
      abilityCooldowns: cooldowns([[LEADER_CD1, { side: 'LEADER', baseCooldown: 1 }]]),
    })).toThrow();
  });

  it('lanza si baseCooldown < 1 (GDD §2.5: "CD mínimo = 1, nunca 0")', () => {
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([LEADER_CD1]),
      abilityCooldowns: cooldowns([[LEADER_CD1, { side: 'LEADER', baseCooldown: 0 }]]),
    })).toThrow();
  });

  it('lanza si baseCooldown no es entero', () => {
    expect(() => new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([LEADER_CD1]),
      abilityCooldowns: cooldowns([[LEADER_CD1, { side: 'LEADER', baseCooldown: 1.5 }]]),
    })).toThrow();
  });
});

describe('CombatEngine — cooldowns: getSnapshot() defensivo', () => {
  it('mutar el array de cooldowns devuelto no corrompe el estado interno', () => {
    const engine = new CombatEngine({
      randomSource: new SeededRandomSource(1),
      abilityCoreCosts: costs([LEADER_CD1]),
      abilityCooldowns: cooldowns([[LEADER_CD1, { side: 'LEADER', baseCooldown: 1 }]]),
    });
    const snapshot = engine.getSnapshot();
    (snapshot.cooldowns as unknown[]).push({});
    expect(engine.getSnapshot().cooldowns).toHaveLength(1);
  });
});
