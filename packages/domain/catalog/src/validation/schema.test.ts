import { describe, it, expect } from 'vitest';
import {
  parseCardDefinition,
  parseAbilityDefinition,
  parseLeaderDefinition,
  parseEnemyDefinition,
  parseScenarioDefinition,
  parseEvolutionTemplate,
} from './schema';

// -----------------------------------------------------------------------------
// Helpers — construyen datos de PRUEBA mínimos como literales planos (raw), nunca
// contenido real de H1.9-H1.12 (spec §0.5/§6).
// -----------------------------------------------------------------------------

function cardRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'card-1',
    name: 'Carta de Prueba',
    type: 'EQUIPO',
    cost: { energy: 1 },
    keywords: [],
    ...overrides,
  };
}

function abilityRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'ability-1',
    name: 'Habilidad de Prueba',
    coreCost: { kind: 'ANY' },
    baseCooldown: 1,
    ...overrides,
  };
}

function leaderAbilityRaw(id: string, baseCooldown: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return abilityRaw({ id, baseCooldown, ...overrides });
}

function leaderRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'leader-1',
    name: 'Líder de Prueba',
    baseAbilities: [
      leaderAbilityRaw('leader-cd1', 1),
      leaderAbilityRaw('leader-cd2', 2),
      leaderAbilityRaw('leader-cd3', 3),
      leaderAbilityRaw('leader-cd4', 4),
    ],
    cardPoolIds: [],
    levelUpOptions: [],
    maxHealth: 30,
    ...overrides,
  };
}

function enemyAbilityRaw(
  id: string,
  branch: 'ATTACK' | 'PLOT',
  tier: 'FIRMA' | 'STANDARD' | 'BASICA',
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return abilityRaw({ id, aiProfile: { branch, tier }, ...overrides });
}

function dramaturgiaCardRaw(id: string, icon: 'ATTACK' | 'PLOT', overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, name: `Carta ${id}`, icon, ...overrides };
}

function enemyRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'enemy-1',
    name: 'Enemigo de Prueba',
    abilities: [
      enemyAbilityRaw('enemy-attack-basica', 'ATTACK', 'BASICA', { baseCooldown: 1 }),
      enemyAbilityRaw('enemy-plot-basica', 'PLOT', 'BASICA', { baseCooldown: 1 }),
      enemyAbilityRaw('enemy-firma', 'ATTACK', 'FIRMA', { baseCooldown: 3 }),
    ],
    phases: [{ phaseNumber: 1, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 1 } }],
    maxHealth: 50,
    dramaturgiaDeck: [
      dramaturgiaCardRaw('dramacard-1', 'ATTACK'),
      dramaturgiaCardRaw('dramacard-2', 'ATTACK'),
      dramaturgiaCardRaw('dramacard-3', 'PLOT'),
      dramaturgiaCardRaw('dramacard-4', 'PLOT'),
    ],
    ...overrides,
  };
}

function scenarioRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'scenario-1',
    name: 'Escenario de Prueba',
    plotThresholds: [
      { atLeast: 2, description: 'umbral 1' },
      { atLeast: 4, description: 'umbral 2' },
      { atLeast: 6, description: 'umbral 3' },
    ],
    passives: [{ description: 'pasivo' }],
    phases: [
      { phaseNumber: 1, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 1 } },
      { phaseNumber: 2, changeCondition: { kind: 'SCENARIO_PLOT_AT_LEAST', amount: 5 } },
    ],
    dramaturgiaDeck: [
      dramaturgiaCardRaw('dramacard-s1', 'ATTACK'),
      dramaturgiaCardRaw('dramacard-s2', 'ATTACK'),
      dramaturgiaCardRaw('dramacard-s3', 'PLOT'),
      dramaturgiaCardRaw('dramacard-s4', 'PLOT'),
    ],
    ...overrides,
  };
}

function evolutionTemplateRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'evo-1',
    name: 'Plantilla de Prueba',
    target: { kind: 'CARD_TYPE', cardType: 'EQUIPO' },
    kind: 'TEMPLATE',
    effect: { op: 'REMOVE_BACKLASH' },
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// 1-5. parseCardDefinition
// -----------------------------------------------------------------------------

describe('parseCardDefinition', () => {
  it('objeto válido → devuelve CardDefinition correcto (keywords con y sin amount)', () => {
    const raw = cardRaw({
      keywords: [{ keyword: 'ATAQUE_MAS_X', amount: 2 }, { keyword: 'ARROLLAR' }],
    });
    const result = parseCardDefinition(raw, 'cards[0]');
    expect(result).toEqual({
      id: 'card-1',
      name: 'Carta de Prueba',
      type: 'EQUIPO',
      cost: { energy: 1 },
      keywords: [{ keyword: 'ATAQUE_MAS_X', amount: 2 }, { keyword: 'ARROLLAR' }],
    });
  });

  it('raw no es objeto → lanza', () => {
    expect(() => parseCardDefinition('no soy un objeto', 'cards[0]')).toThrow();
    expect(() => parseCardDefinition(null, 'cards[0]')).toThrow();
    expect(() => parseCardDefinition([], 'cards[0]')).toThrow();
  });

  it.each([
    ['id', { id: undefined }],
    ['name', { name: undefined }],
    ['type', { type: undefined }],
    ['cost.energy', { cost: {} }],
    ['keywords', { keywords: undefined }],
  ])('falta el campo obligatorio "%s" → lanza mencionando el context', (_label, overrides) => {
    expect(() => parseCardDefinition(cardRaw(overrides), 'cards[3]')).toThrow(/cards\[3\]/);
  });

  it('type fuera de la unión → lanza', () => {
    expect(() => parseCardDefinition(cardRaw({ type: 'NO_EXISTE' }), 'cards[0]')).toThrow();
  });

  it('keyword que exige amount pero lo omite → lanza', () => {
    const raw = cardRaw({ keywords: [{ keyword: 'ATAQUE_MAS_X' }] });
    expect(() => parseCardDefinition(raw, 'cards[0]')).toThrow();
  });

  it('keyword que NO exige amount pero lo incluye → lanza', () => {
    const raw = cardRaw({ keywords: [{ keyword: 'ARROLLAR', amount: 1 }] });
    expect(() => parseCardDefinition(raw, 'cards[0]')).toThrow();
  });

  // ---------------------------------------------------------------------------
  // NUEVO H1.14 — validación cruzada CONTRATIEMPO ↔ keyword de alcance (spec §0.5/§6.2)
  // ---------------------------------------------------------------------------

  it('type CONTRATIEMPO con keyword DESHACER_DANO → ok', () => {
    const raw = cardRaw({ type: 'CONTRATIEMPO', keywords: [{ keyword: 'DESHACER_DANO' }] });
    const result = parseCardDefinition(raw, 'cards[0]');
    expect(result.keywords).toEqual([{ keyword: 'DESHACER_DANO' }]);
  });

  it('type CONTRATIEMPO con keyword DESHACER_TURNO → ok', () => {
    const raw = cardRaw({ type: 'CONTRATIEMPO', keywords: [{ keyword: 'DESHACER_TURNO' }] });
    const result = parseCardDefinition(raw, 'cards[0]');
    expect(result.keywords).toEqual([{ keyword: 'DESHACER_TURNO' }]);
  });

  it('type CONTRATIEMPO sin ninguna keyword de alcance → lanza', () => {
    const raw = cardRaw({ type: 'CONTRATIEMPO', keywords: [{ keyword: 'NEUTRO' }] });
    expect(() => parseCardDefinition(raw, 'cards[0]')).toThrow();
  });

  it('type CONTRATIEMPO con las dos keywords de alcance a la vez → lanza', () => {
    const raw = cardRaw({
      type: 'CONTRATIEMPO',
      keywords: [{ keyword: 'DESHACER_DANO' }, { keyword: 'DESHACER_TURNO' }],
    });
    expect(() => parseCardDefinition(raw, 'cards[0]')).toThrow();
  });

  it('keyword DESHACER_DANO en una carta type EVENTO (no CONTRATIEMPO) → lanza', () => {
    const raw = cardRaw({ type: 'EVENTO', keywords: [{ keyword: 'DESHACER_DANO' }] });
    expect(() => parseCardDefinition(raw, 'cards[0]')).toThrow();
  });

  // ---------------------------------------------------------------------------
  // NUEVO H1.15 — validación cruzada ALIADO ↔ keyword VIDA_X (spec §0.5/§6.2)
  // ---------------------------------------------------------------------------

  it('type ALIADO con keyword VIDA_X → ok', () => {
    const raw = cardRaw({ type: 'ALIADO', keywords: [{ keyword: 'VIDA_X', amount: 5 }] });
    const result = parseCardDefinition(raw, 'cards[0]');
    expect(result.keywords).toEqual([{ keyword: 'VIDA_X', amount: 5 }]);
  });

  it('type ALIADO sin keyword VIDA_X → lanza', () => {
    const raw = cardRaw({ type: 'ALIADO', keywords: [{ keyword: 'NEUTRO' }] });
    expect(() => parseCardDefinition(raw, 'cards[0]')).toThrow();
  });

  it('type ALIADO con 2 keywords VIDA_X → lanza', () => {
    const raw = cardRaw({
      type: 'ALIADO',
      keywords: [{ keyword: 'VIDA_X', amount: 5 }, { keyword: 'VIDA_X', amount: 3 }],
    });
    expect(() => parseCardDefinition(raw, 'cards[0]')).toThrow();
  });

  it('keyword VIDA_X en una carta type EVENTO (no ALIADO) → lanza', () => {
    const raw = cardRaw({ type: 'EVENTO', keywords: [{ keyword: 'VIDA_X', amount: 5 }] });
    expect(() => parseCardDefinition(raw, 'cards[0]')).toThrow();
  });
});

// -----------------------------------------------------------------------------
// 6. parseAbilityDefinition
// -----------------------------------------------------------------------------

describe('parseAbilityDefinition', () => {
  it('válido con coreCost ANY y sin effect → ok', () => {
    const result = parseAbilityDefinition(abilityRaw(), 'abilities[0]');
    expect(result).toEqual({
      id: 'ability-1',
      name: 'Habilidad de Prueba',
      coreCost: { kind: 'ANY' },
      baseCooldown: 1,
    });
  });

  it('válido con effect ATTACK (formula ADD amount 2) → ok', () => {
    const raw = abilityRaw({
      effect: { kind: 'ATTACK', formula: { baseFormula: { kind: 'ADD', amount: 2 } } },
    });
    const result = parseAbilityDefinition(raw, 'abilities[0]');
    expect(result.effect).toEqual({ kind: 'ATTACK', formula: { baseFormula: { kind: 'ADD', amount: 2 } } });
  });

  it('baseCooldown < 1 → lanza', () => {
    expect(() => parseAbilityDefinition(abilityRaw({ baseCooldown: 0 }), 'abilities[0]')).toThrow();
  });

  it('effect.kind PLOT con amount negativo → lanza', () => {
    const raw = abilityRaw({ effect: { kind: 'PLOT', amount: -1 } });
    expect(() => parseAbilityDefinition(raw, 'abilities[0]')).toThrow();
  });
});

// -----------------------------------------------------------------------------
// 7. parseLeaderDefinition
// -----------------------------------------------------------------------------

describe('parseLeaderDefinition', () => {
  it('válido (4 abilities, CD1 ANY sin effect) → ok', () => {
    const result = parseLeaderDefinition(leaderRaw(), 'leaders[0]');
    expect(result.baseAbilities).toHaveLength(4);
    expect(result.id).toEqual('leader-1');
  });

  it('baseAbilities.length !== 4 → lanza', () => {
    const raw = leaderRaw({ baseAbilities: [leaderAbilityRaw('a1', 1)] });
    expect(() => parseLeaderDefinition(raw, 'leaders[0]')).toThrow();
  });

  it('CDs repetidos (dos CD1, ningún CD3) → lanza', () => {
    const raw = leaderRaw({
      baseAbilities: [
        leaderAbilityRaw('a1', 1),
        leaderAbilityRaw('a2', 1),
        leaderAbilityRaw('a3', 2),
        leaderAbilityRaw('a4', 4),
      ],
    });
    expect(() => parseLeaderDefinition(raw, 'leaders[0]')).toThrow();
  });

  it('CD1 con coreCost.kind COLOR → lanza', () => {
    const raw = leaderRaw({
      baseAbilities: [
        leaderAbilityRaw('a1', 1, { coreCost: { kind: 'COLOR', colors: ['AGRESION'] } }),
        leaderAbilityRaw('a2', 2),
        leaderAbilityRaw('a3', 3),
        leaderAbilityRaw('a4', 4),
      ],
    });
    expect(() => parseLeaderDefinition(raw, 'leaders[0]')).toThrow();
  });

  // MODIFICADO H4.x — la restricción "ninguna baseAbility del Líder puede tener
  // effect.kind ATTACK" se retira (era consecuencia de una limitación de motor ya
  // corregida, ver spec H4_targeting_habilidades_y_ficha_personaje.md §1.2.e). La única
  // regla real es GDD §2.5 ("CD1 siempre puro"): CD1 con ATTACK exige formula VALUE.

  it('CD1 con effect.kind ATTACK y formula VALUE → ok', () => {
    const raw = leaderRaw({
      baseAbilities: [
        leaderAbilityRaw('a1', 1, { effect: { kind: 'ATTACK', formula: { baseFormula: { kind: 'VALUE' } } } }),
        leaderAbilityRaw('a2', 2),
        leaderAbilityRaw('a3', 3),
        leaderAbilityRaw('a4', 4),
      ],
    });
    expect(() => parseLeaderDefinition(raw, 'leaders[0]')).not.toThrow();
  });

  it('CD1 con effect.kind ATTACK y formula ADD (no puro) → lanza', () => {
    const raw = leaderRaw({
      baseAbilities: [
        leaderAbilityRaw('a1', 1, {
          effect: { kind: 'ATTACK', formula: { baseFormula: { kind: 'ADD', amount: 1 } } },
        }),
        leaderAbilityRaw('a2', 2),
        leaderAbilityRaw('a3', 3),
        leaderAbilityRaw('a4', 4),
      ],
    });
    expect(() => parseLeaderDefinition(raw, 'leaders[0]')).toThrow();
  });

  it('una habilidad CD2 (no CD1) con effect.kind ATTACK → ok (sin restricción de pureza)', () => {
    const raw = leaderRaw({
      baseAbilities: [
        leaderAbilityRaw('a1', 1),
        leaderAbilityRaw('a2', 2, { effect: { kind: 'ATTACK', formula: { baseFormula: { kind: 'ADD', amount: 1 } } } }),
        leaderAbilityRaw('a3', 3),
        leaderAbilityRaw('a4', 4),
      ],
    });
    expect(() => parseLeaderDefinition(raw, 'leaders[0]')).not.toThrow();
  });

  it('habilidades CD3/CD4 con effect.kind ATTACK → ok', () => {
    const raw = leaderRaw({
      baseAbilities: [
        leaderAbilityRaw('a1', 1),
        leaderAbilityRaw('a2', 2),
        leaderAbilityRaw('a3', 3, { effect: { kind: 'ATTACK', formula: { baseFormula: { kind: 'VALUE' } } } }),
        leaderAbilityRaw('a4', 4, { effect: { kind: 'ATTACK', formula: { baseFormula: { kind: 'MULTIPLY', amount: 2 } } } }),
      ],
    });
    expect(() => parseLeaderDefinition(raw, 'leaders[0]')).not.toThrow();
  });
});

// -----------------------------------------------------------------------------
// 8. parseEnemyDefinition
// -----------------------------------------------------------------------------

describe('parseEnemyDefinition', () => {
  it('válido (1 ATTACK/BASICA CD1 ⚫, 1 PLOT/BASICA CD1 ⚫, + 1 FIRMA opcional) → ok', () => {
    const result = parseEnemyDefinition(enemyRaw(), 'enemies[0]');
    expect(result.abilities).toHaveLength(3);
    expect(result.maxHealth).toEqual(50);
  });

  it('branch ATTACK con tier STANDARD → lanza', () => {
    const raw = enemyRaw({
      abilities: [
        enemyAbilityRaw('a1', 'ATTACK', 'STANDARD', { baseCooldown: 2 }),
        enemyAbilityRaw('enemy-attack-basica', 'ATTACK', 'BASICA', { baseCooldown: 1 }),
        enemyAbilityRaw('enemy-plot-basica', 'PLOT', 'BASICA', { baseCooldown: 1 }),
      ],
    });
    expect(() => parseEnemyDefinition(raw, 'enemies[0]')).toThrow();
  });

  it('branch PLOT con tier FIRMA → lanza', () => {
    const raw = enemyRaw({
      abilities: [
        enemyAbilityRaw('a1', 'PLOT', 'FIRMA', { baseCooldown: 2 }),
        enemyAbilityRaw('enemy-attack-basica', 'ATTACK', 'BASICA', { baseCooldown: 1 }),
        enemyAbilityRaw('enemy-plot-basica', 'PLOT', 'BASICA', { baseCooldown: 1 }),
      ],
    });
    expect(() => parseEnemyDefinition(raw, 'enemies[0]')).toThrow();
  });

  it('0 BASICA en una rama → lanza', () => {
    const raw = enemyRaw({
      abilities: [enemyAbilityRaw('enemy-attack-basica', 'ATTACK', 'BASICA', { baseCooldown: 1 })],
    });
    expect(() => parseEnemyDefinition(raw, 'enemies[0]')).toThrow();
  });

  it('2+ BASICA en una rama → lanza', () => {
    const raw = enemyRaw({
      abilities: [
        enemyAbilityRaw('enemy-attack-basica', 'ATTACK', 'BASICA', { baseCooldown: 1 }),
        enemyAbilityRaw('enemy-attack-basica-2', 'ATTACK', 'BASICA', { baseCooldown: 1 }),
        enemyAbilityRaw('enemy-plot-basica', 'PLOT', 'BASICA', { baseCooldown: 1 }),
      ],
    });
    expect(() => parseEnemyDefinition(raw, 'enemies[0]')).toThrow();
  });

  it('BASICA con baseCooldown !== 1 → lanza', () => {
    const raw = enemyRaw({
      abilities: [
        enemyAbilityRaw('enemy-attack-basica', 'ATTACK', 'BASICA', { baseCooldown: 2 }),
        enemyAbilityRaw('enemy-plot-basica', 'PLOT', 'BASICA', { baseCooldown: 1 }),
      ],
    });
    expect(() => parseEnemyDefinition(raw, 'enemies[0]')).toThrow();
  });

  it('BASICA con coreCost.kind !== ANY → lanza', () => {
    const raw = enemyRaw({
      abilities: [
        enemyAbilityRaw('enemy-attack-basica', 'ATTACK', 'BASICA', {
          baseCooldown: 1,
          coreCost: { kind: 'COLOR', colors: ['AGRESION'] },
        }),
        enemyAbilityRaw('enemy-plot-basica', 'PLOT', 'BASICA', { baseCooldown: 1 }),
      ],
    });
    expect(() => parseEnemyDefinition(raw, 'enemies[0]')).toThrow();
  });

  it('phases vacío → lanza', () => {
    expect(() => parseEnemyDefinition(enemyRaw({ phases: [] }), 'enemies[0]')).toThrow();
  });

  it('phases con numeración [1,3] (hueco) → lanza', () => {
    const raw = enemyRaw({
      phases: [
        { phaseNumber: 1, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 1 } },
        { phaseNumber: 3, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 2 } },
      ],
    });
    expect(() => parseEnemyDefinition(raw, 'enemies[0]')).toThrow();
  });

  it('phases con numeración [1,1] (duplicado) → lanza', () => {
    const raw = enemyRaw({
      phases: [
        { phaseNumber: 1, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 1 } },
        { phaseNumber: 1, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 2 } },
      ],
    });
    expect(() => parseEnemyDefinition(raw, 'enemies[0]')).toThrow();
  });

  it('maxHealth 0 → lanza', () => {
    expect(() => parseEnemyDefinition(enemyRaw({ maxHealth: 0 }), 'enemies[0]')).toThrow();
  });

  it('maxHealth > 100 → lanza', () => {
    expect(() => parseEnemyDefinition(enemyRaw({ maxHealth: 101 }), 'enemies[0]')).toThrow();
  });

  it('dramaturgiaDeck ausente → lanza', () => {
    const raw = enemyRaw();
    delete (raw as Record<string, unknown>).dramaturgiaDeck;
    expect(() => parseEnemyDefinition(raw, 'enemies[0]')).toThrow();
  });

  it('dramaturgiaDeck con menos de 4 cartas → lanza', () => {
    const raw = enemyRaw({
      dramaturgiaDeck: [
        dramaturgiaCardRaw('dramacard-1', 'ATTACK'),
        dramaturgiaCardRaw('dramacard-2', 'PLOT'),
      ],
    });
    expect(() => parseEnemyDefinition(raw, 'enemies[0]')).toThrow();
  });

  it('dramaturgiaDeck con DramaturgiaCardId duplicado → lanza', () => {
    const raw = enemyRaw({
      dramaturgiaDeck: [
        dramaturgiaCardRaw('dramacard-1', 'ATTACK'),
        dramaturgiaCardRaw('dramacard-1', 'ATTACK'),
        dramaturgiaCardRaw('dramacard-3', 'PLOT'),
        dramaturgiaCardRaw('dramacard-4', 'PLOT'),
      ],
    });
    expect(() => parseEnemyDefinition(raw, 'enemies[0]')).toThrow();
  });

  it('dramaturgiaDeck sin ninguna carta ATTACK → lanza', () => {
    const raw = enemyRaw({
      dramaturgiaDeck: [
        dramaturgiaCardRaw('dramacard-1', 'PLOT'),
        dramaturgiaCardRaw('dramacard-2', 'PLOT'),
        dramaturgiaCardRaw('dramacard-3', 'PLOT'),
        dramaturgiaCardRaw('dramacard-4', 'PLOT'),
      ],
    });
    expect(() => parseEnemyDefinition(raw, 'enemies[0]')).toThrow();
  });

  it('dramaturgiaDeck sin ninguna carta PLOT → lanza', () => {
    const raw = enemyRaw({
      dramaturgiaDeck: [
        dramaturgiaCardRaw('dramacard-1', 'ATTACK'),
        dramaturgiaCardRaw('dramacard-2', 'ATTACK'),
        dramaturgiaCardRaw('dramacard-3', 'ATTACK'),
        dramaturgiaCardRaw('dramacard-4', 'ATTACK'),
      ],
    });
    expect(() => parseEnemyDefinition(raw, 'enemies[0]')).toThrow();
  });

  it('dramaturgiaDeck válido con effectDescription opcional → ok', () => {
    const raw = enemyRaw({
      dramaturgiaDeck: [
        dramaturgiaCardRaw('dramacard-1', 'ATTACK', { effectDescription: 'Invoca un secuaz menor.' }),
        dramaturgiaCardRaw('dramacard-2', 'ATTACK'),
        dramaturgiaCardRaw('dramacard-3', 'PLOT'),
        dramaturgiaCardRaw('dramacard-4', 'PLOT'),
      ],
    });
    const result = parseEnemyDefinition(raw, 'enemies[0]');
    expect(result.dramaturgiaDeck).toHaveLength(4);
    expect(result.dramaturgiaDeck[0]?.effectDescription).toBe('Invoca un secuaz menor.');
  });

  // ---------------------------------------------------------------------------
  // NUEVO §3.10.1/§3.10.4 — summonEffect + minions[]
  // ---------------------------------------------------------------------------

  it('dramaturgiaDeck con summonEffect válido → ok, minionDefinitionId preservado', () => {
    const raw = enemyRaw({
      dramaturgiaDeck: [
        dramaturgiaCardRaw('dramacard-1', 'ATTACK', { summonEffect: { minionDefinitionId: 'minion-1' } }),
        dramaturgiaCardRaw('dramacard-2', 'ATTACK'),
        dramaturgiaCardRaw('dramacard-3', 'PLOT'),
        dramaturgiaCardRaw('dramacard-4', 'PLOT'),
      ],
    });
    const result = parseEnemyDefinition(raw, 'enemies[0]');
    expect(result.dramaturgiaDeck[0]?.summonEffect).toEqual({ minionDefinitionId: 'minion-1' });
    expect(result.dramaturgiaDeck[1]?.summonEffect).toBeUndefined();
  });

  it('summonEffect sin minionDefinitionId (o vacío) → lanza', () => {
    const raw = enemyRaw({
      dramaturgiaDeck: [
        dramaturgiaCardRaw('dramacard-1', 'ATTACK', { summonEffect: {} }),
        dramaturgiaCardRaw('dramacard-2', 'ATTACK'),
        dramaturgiaCardRaw('dramacard-3', 'PLOT'),
        dramaturgiaCardRaw('dramacard-4', 'PLOT'),
      ],
    });
    expect(() => parseEnemyDefinition(raw, 'enemies[0]')).toThrow();
  });

  it('minions ausente → EnemyDefinition.minions es undefined', () => {
    const result = parseEnemyDefinition(enemyRaw(), 'enemies[0]');
    expect(result.minions).toBeUndefined();
  });

  it('minions con un MinionDefinition válido → ok, campos preservados', () => {
    const raw = enemyRaw({
      minions: [
        {
          id: 'minion-1',
          name: 'Secuaz de Prueba',
          passiveEffect: { kind: 'ATTACK', amount: 1 },
          planoAttackAmount: 2,
          isDefensor: false,
          maxLife: 4,
        },
      ],
    });
    const result = parseEnemyDefinition(raw, 'enemies[0]');
    expect(result.minions).toHaveLength(1);
    expect(result.minions?.[0]).toEqual({
      id: 'minion-1',
      name: 'Secuaz de Prueba',
      passiveEffect: { kind: 'ATTACK', amount: 1 },
      planoAttackAmount: 2,
      isDefensor: false,
      maxLife: 4,
    });
  });

  it.each([
    ['id vacío', { id: '' }],
    ['name vacío', { name: '' }],
    ['maxLife 0', { maxLife: 0 }],
    ['maxLife negativo', { maxLife: -1 }],
    ['planoAttackAmount negativo', { planoAttackAmount: -1 }],
    ['isDefensor no booleano', { isDefensor: 'no' }],
  ])('minions con %s → lanza', (_label, overrides) => {
    const raw = enemyRaw({
      minions: [
        {
          id: 'minion-1',
          name: 'Secuaz de Prueba',
          passiveEffect: { kind: 'ATTACK', amount: 1 },
          planoAttackAmount: 2,
          isDefensor: false,
          maxLife: 4,
          ...overrides,
        },
      ],
    });
    expect(() => parseEnemyDefinition(raw, 'enemies[0]')).toThrow();
  });

  it('minions con ids duplicados dentro del mismo array → lanza', () => {
    const minion = {
      id: 'minion-1',
      name: 'Secuaz de Prueba',
      passiveEffect: { kind: 'ATTACK', amount: 1 },
      planoAttackAmount: 2,
      isDefensor: false,
      maxLife: 4,
    };
    const raw = enemyRaw({ minions: [minion, minion] });
    expect(() => parseEnemyDefinition(raw, 'enemies[0]')).toThrow();
  });
});

// -----------------------------------------------------------------------------
// 9. parseScenarioDefinition
// -----------------------------------------------------------------------------

describe('parseScenarioDefinition', () => {
  it('válido (2 fases, 3+ thresholds escalonados, 1+ passive, dramaturgiaDeck) → ok', () => {
    const result = parseScenarioDefinition(scenarioRaw(), 'scenarios[0]');
    expect(result.phases).toHaveLength(2);
    expect(result.plotThresholds).toHaveLength(3);
    expect(result.passives).toHaveLength(1);
    expect(result.dramaturgiaDeck).toHaveLength(4);
  });

  it('phases[].changeCondition.kind === HEALTH_BELOW_PERCENT → lanza', () => {
    const raw = scenarioRaw({
      phases: [{ phaseNumber: 1, changeCondition: { kind: 'HEALTH_BELOW_PERCENT', percent: 50 } }],
    });
    expect(() => parseScenarioDefinition(raw, 'scenarios[0]')).toThrow();
  });

  it('phases con numeración [1,3] (hueco) → lanza', () => {
    const raw = scenarioRaw({
      phases: [
        { phaseNumber: 1, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 1 } },
        { phaseNumber: 3, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 2 } },
      ],
    });
    expect(() => parseScenarioDefinition(raw, 'scenarios[0]')).toThrow();
  });

  it('phases con numeración [1,1] (duplicado) → lanza', () => {
    const raw = scenarioRaw({
      phases: [
        { phaseNumber: 1, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 1 } },
        { phaseNumber: 1, changeCondition: { kind: 'TURN_COUNT_AT_LEAST', turn: 2 } },
      ],
    });
    expect(() => parseScenarioDefinition(raw, 'scenarios[0]')).toThrow();
  });

  it('plotThresholds con menos de 3 elementos → lanza', () => {
    const raw = scenarioRaw({
      plotThresholds: [
        { atLeast: 2, description: 'umbral 1' },
        { atLeast: 4, description: 'umbral 2' },
      ],
    });
    expect(() => parseScenarioDefinition(raw, 'scenarios[0]')).toThrow();
  });

  it('plotThresholds desordenados (atLeast no ascendente) → lanza', () => {
    const raw = scenarioRaw({
      plotThresholds: [
        { atLeast: 4, description: 'umbral 1' },
        { atLeast: 2, description: 'umbral 2' },
        { atLeast: 6, description: 'umbral 3' },
      ],
    });
    expect(() => parseScenarioDefinition(raw, 'scenarios[0]')).toThrow();
  });

  it('plotThresholds con "atLeast" repetidos → lanza', () => {
    const raw = scenarioRaw({
      plotThresholds: [
        { atLeast: 2, description: 'umbral 1' },
        { atLeast: 2, description: 'umbral 2' },
        { atLeast: 6, description: 'umbral 3' },
      ],
    });
    expect(() => parseScenarioDefinition(raw, 'scenarios[0]')).toThrow();
  });

  it('dramaturgiaDeck ausente → lanza', () => {
    const raw = scenarioRaw();
    delete (raw as Record<string, unknown>).dramaturgiaDeck;
    expect(() => parseScenarioDefinition(raw, 'scenarios[0]')).toThrow();
  });

  it('dramaturgiaDeck con menos de 4 cartas → lanza', () => {
    const raw = scenarioRaw({
      dramaturgiaDeck: [
        dramaturgiaCardRaw('dramacard-s1', 'ATTACK'),
        dramaturgiaCardRaw('dramacard-s2', 'PLOT'),
      ],
    });
    expect(() => parseScenarioDefinition(raw, 'scenarios[0]')).toThrow();
  });

  it('dramaturgiaDeck con DramaturgiaCardId duplicado → lanza', () => {
    const raw = scenarioRaw({
      dramaturgiaDeck: [
        dramaturgiaCardRaw('dramacard-s1', 'ATTACK'),
        dramaturgiaCardRaw('dramacard-s1', 'ATTACK'),
        dramaturgiaCardRaw('dramacard-s3', 'PLOT'),
        dramaturgiaCardRaw('dramacard-s4', 'PLOT'),
      ],
    });
    expect(() => parseScenarioDefinition(raw, 'scenarios[0]')).toThrow();
  });

  it('dramaturgiaDeck sin ninguna carta ATTACK → lanza', () => {
    const raw = scenarioRaw({
      dramaturgiaDeck: [
        dramaturgiaCardRaw('dramacard-s1', 'PLOT'),
        dramaturgiaCardRaw('dramacard-s2', 'PLOT'),
        dramaturgiaCardRaw('dramacard-s3', 'PLOT'),
        dramaturgiaCardRaw('dramacard-s4', 'PLOT'),
      ],
    });
    expect(() => parseScenarioDefinition(raw, 'scenarios[0]')).toThrow();
  });

  it('dramaturgiaDeck sin ninguna carta PLOT → lanza', () => {
    const raw = scenarioRaw({
      dramaturgiaDeck: [
        dramaturgiaCardRaw('dramacard-s1', 'ATTACK'),
        dramaturgiaCardRaw('dramacard-s2', 'ATTACK'),
        dramaturgiaCardRaw('dramacard-s3', 'ATTACK'),
        dramaturgiaCardRaw('dramacard-s4', 'ATTACK'),
      ],
    });
    expect(() => parseScenarioDefinition(raw, 'scenarios[0]')).toThrow();
  });

  it('dramaturgiaDeck válido con effectDescription opcional → ok', () => {
    const raw = scenarioRaw({
      dramaturgiaDeck: [
        dramaturgiaCardRaw('dramacard-s1', 'ATTACK', { effectDescription: 'Avanza la Trama un paso extra.' }),
        dramaturgiaCardRaw('dramacard-s2', 'ATTACK'),
        dramaturgiaCardRaw('dramacard-s3', 'PLOT'),
        dramaturgiaCardRaw('dramacard-s4', 'PLOT'),
      ],
    });
    const result = parseScenarioDefinition(raw, 'scenarios[0]');
    expect(result.dramaturgiaDeck).toHaveLength(4);
    expect(result.dramaturgiaDeck[0]?.effectDescription).toBe('Avanza la Trama un paso extra.');
  });

  it('minions ausente → ScenarioDefinition.minions es undefined; minions con un MinionDefinition válido → ok', () => {
    expect(parseScenarioDefinition(scenarioRaw(), 'scenarios[0]').minions).toBeUndefined();

    const raw = scenarioRaw({
      minions: [
        {
          id: 'minion-scenario-1',
          name: 'Secuaz de Escenario',
          passiveEffect: { kind: 'PLOT', amount: 1 },
          planoAttackAmount: 0,
          isDefensor: true,
          maxLife: 6,
        },
      ],
    });
    const result = parseScenarioDefinition(raw, 'scenarios[0]');
    expect(result.minions).toHaveLength(1);
    expect(result.minions?.[0]?.id).toBe('minion-scenario-1');
  });
});

// -----------------------------------------------------------------------------
// 10. parseEvolutionTemplate
// -----------------------------------------------------------------------------

describe('parseEvolutionTemplate', () => {
  it('válido kind TEMPLATE sin bespokeCardId → ok', () => {
    const result = parseEvolutionTemplate(evolutionTemplateRaw(), 'evolutionTemplates[0]');
    expect(result.kind).toEqual('TEMPLATE');
    expect(result.bespokeCardId).toBeUndefined();
  });

  it('válido kind BESPOKE con bespokeCardId → ok', () => {
    const raw = evolutionTemplateRaw({ kind: 'BESPOKE', bespokeCardId: 'card-1' });
    const result = parseEvolutionTemplate(raw, 'evolutionTemplates[0]');
    expect(result.kind).toEqual('BESPOKE');
    expect(result.bespokeCardId).toEqual('card-1');
  });

  it('kind TEMPLATE CON bespokeCardId → lanza', () => {
    const raw = evolutionTemplateRaw({ kind: 'TEMPLATE', bespokeCardId: 'card-1' });
    expect(() => parseEvolutionTemplate(raw, 'evolutionTemplates[0]')).toThrow();
  });

  it('kind BESPOKE SIN bespokeCardId → lanza', () => {
    const raw = evolutionTemplateRaw({ kind: 'BESPOKE' });
    expect(() => parseEvolutionTemplate(raw, 'evolutionTemplates[0]')).toThrow();
  });

  it('target.kind HAS_KEYWORD con keyword inválido → lanza', () => {
    const raw = evolutionTemplateRaw({ target: { kind: 'HAS_KEYWORD', keyword: 'NO_EXISTE' } });
    expect(() => parseEvolutionTemplate(raw, 'evolutionTemplates[0]')).toThrow();
  });
});
