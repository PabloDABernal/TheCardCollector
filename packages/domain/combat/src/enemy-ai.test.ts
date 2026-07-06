import { describe, it, expect } from 'vitest';
import {
  SeededRandomSource,
  createId,
  type AbilityId,
  type CoreCostRequirement,
  type NucleoColor,
  type NucleoInstanceId,
} from '@collector/domain-shared';
import {
  poolHasValidNucleo,
  decideEnemyAbility,
  decideEnemyNucleoToSpend,
  derivePlayerColorsFromLeaderAbilities,
  validateEnemyAbilityAiProfiles,
} from './enemy-ai';
import type { EnemyAbilityAiProfile, EnemyAbilityCandidate } from './types/enemy-ai';
import type { AbilityCooldownDefinition } from './types/cooldown';
import type { NucleoInstance } from './types/nucleo';

function ability(id: string): AbilityId {
  return createId<'AbilityId'>('AbilityId', id);
}

function candidate(
  abilityId: AbilityId,
  aiProfile: EnemyAbilityAiProfile,
  opts: { coreCost?: CoreCostRequirement; baseCooldown?: number; remainingCooldown?: number } = {}
): EnemyAbilityCandidate {
  return {
    abilityId,
    coreCost: opts.coreCost ?? { kind: 'ANY' },
    baseCooldown: opts.baseCooldown ?? 1,
    remainingCooldown: opts.remainingCooldown ?? 0,
    aiProfile,
  };
}

function nucleo(id: string, color: NucleoColor, value: number): NucleoInstance {
  return { id: createId<'NucleoInstanceId'>('NucleoInstanceId', id) as NucleoInstanceId, color, value };
}

const FIRMA = ability('enemy-firma');
const ATTACK_BASICA = ability('enemy-attack-basica');
const STANDARD_A = ability('enemy-standard-a');
const STANDARD_B = ability('enemy-standard-b');
const PLOT_BASICA = ability('enemy-plot-basica');

describe('decideEnemyAbility — rama ATTACK (GDD §3.5)', () => {
  it('FIRMA lista y con Núcleo válido en pool → elige FIRMA, no BASICA', () => {
    const candidates = [
      candidate(FIRMA, { branch: 'ATTACK', tier: 'FIRMA' }, { coreCost: { kind: 'COLOR', colors: ['AGRESION'] }, baseCooldown: 3 }),
      candidate(ATTACK_BASICA, { branch: 'ATTACK', tier: 'BASICA' }, { baseCooldown: 1 }),
    ];
    const pool = [nucleo('n1', 'AGRESION', 2)];
    const result = decideEnemyAbility('ATTACK', candidates, pool, new SeededRandomSource(1));
    expect(result).toEqual({ abilityId: FIRMA, branch: 'ATTACK', tier: 'FIRMA' });
  });

  it('FIRMA en cooldown (remainingCooldown > 0) → cae a BASICA', () => {
    const candidates = [
      candidate(FIRMA, { branch: 'ATTACK', tier: 'FIRMA' }, { coreCost: { kind: 'ANY' }, baseCooldown: 3, remainingCooldown: 2 }),
      candidate(ATTACK_BASICA, { branch: 'ATTACK', tier: 'BASICA' }, { baseCooldown: 1 }),
    ];
    const pool = [nucleo('n1', 'AGRESION', 2)];
    const result = decideEnemyAbility('ATTACK', candidates, pool, new SeededRandomSource(1));
    expect(result).toEqual({ abilityId: ATTACK_BASICA, branch: 'ATTACK', tier: 'BASICA' });
  });

  it('FIRMA lista pero su coste de color no tiene ningún Núcleo válido en el pool → cae a BASICA', () => {
    const candidates = [
      candidate(FIRMA, { branch: 'ATTACK', tier: 'FIRMA' }, { coreCost: { kind: 'COLOR', colors: ['AGRESION'] }, baseCooldown: 3 }),
      candidate(ATTACK_BASICA, { branch: 'ATTACK', tier: 'BASICA' }, { baseCooldown: 1 }),
    ];
    const pool = [nucleo('n1', 'CONTROL', 4)];
    const result = decideEnemyAbility('ATTACK', candidates, pool, new SeededRandomSource(1));
    expect(result).toEqual({ abilityId: ATTACK_BASICA, branch: 'ATTACK', tier: 'BASICA' });
  });
});

describe('decideEnemyAbility — rama PLOT (GDD §3.5)', () => {
  it('dos candidatas STANDARD listas con distinto baseCooldown → elige la de mayor baseCooldown', () => {
    const candidates = [
      candidate(STANDARD_A, { branch: 'PLOT', tier: 'STANDARD' }, { baseCooldown: 2 }),
      candidate(STANDARD_B, { branch: 'PLOT', tier: 'STANDARD' }, { baseCooldown: 4 }),
      candidate(PLOT_BASICA, { branch: 'PLOT', tier: 'BASICA' }, { baseCooldown: 1 }),
    ];
    const pool = [nucleo('n1', 'AGRESION', 2)];
    const result = decideEnemyAbility('PLOT', candidates, pool, new SeededRandomSource(1));
    expect(result).toEqual({ abilityId: STANDARD_B, branch: 'PLOT', tier: 'STANDARD' });
  });

  it('dos candidatas STANDARD listas con el MISMO baseCooldown → desempate determinista vía SeededRandomSource', () => {
    const candidates = [
      candidate(STANDARD_A, { branch: 'PLOT', tier: 'STANDARD' }, { baseCooldown: 3 }),
      candidate(STANDARD_B, { branch: 'PLOT', tier: 'STANDARD' }, { baseCooldown: 3 }),
      candidate(PLOT_BASICA, { branch: 'PLOT', tier: 'BASICA' }, { baseCooldown: 1 }),
    ];
    const pool = [nucleo('n1', 'AGRESION', 2)];
    // seed=7 produce, con este contrato de SeededRandomSource, el índice 0 sobre el
    // array empatado [STANDARD_A, STANDARD_B] (mismo orden en que se construyó `candidates`).
    const result = decideEnemyAbility('PLOT', candidates, pool, new SeededRandomSource(7));
    expect(result).toEqual({ abilityId: STANDARD_A, branch: 'PLOT', tier: 'STANDARD' });
  });

  it('todas las STANDARD en cooldown → cae a BASICA', () => {
    const candidates = [
      candidate(STANDARD_A, { branch: 'PLOT', tier: 'STANDARD' }, { baseCooldown: 3, remainingCooldown: 1 }),
      candidate(PLOT_BASICA, { branch: 'PLOT', tier: 'BASICA' }, { baseCooldown: 1 }),
    ];
    const pool = [nucleo('n1', 'AGRESION', 2)];
    const result = decideEnemyAbility('PLOT', candidates, pool, new SeededRandomSource(1));
    expect(result).toEqual({ abilityId: PLOT_BASICA, branch: 'PLOT', tier: 'BASICA' });
  });
});

describe('decideEnemyAbility — invariante de contenido', () => {
  it('lanza Error si no hay ninguna candidata BASICA lista para la rama pedida', () => {
    const candidates = [candidate(FIRMA, { branch: 'ATTACK', tier: 'FIRMA' }, { baseCooldown: 3 })];
    const pool = [nucleo('n1', 'AGRESION', 2)];
    expect(() => decideEnemyAbility('PLOT', candidates, pool, new SeededRandomSource(1))).toThrow();
  });
});

describe('decideEnemyNucleoToSpend (GDD §3.5, §0.4)', () => {
  it('Núcleo de color playerColors con value >= 3 y otro de mayor value pero color no-jugador → elige el de "denegar"', () => {
    const pool = [nucleo('a', 'AGRESION', 3), nucleo('b', 'CONTROL', 4)];
    const result = decideEnemyNucleoToSpend({ kind: 'ANY' }, pool, ['AGRESION'], new SeededRandomSource(1));
    expect(result).toEqual({ nucleo: pool[0], reason: 'DENY_PLAYER_COLOR' });
  });

  it('ningún Núcleo cumple "denegar" → elige el de mayor value disponible', () => {
    const pool = [nucleo('a', 'AGRESION', 2), nucleo('b', 'CONTROL', 4)];
    const result = decideEnemyNucleoToSpend({ kind: 'ANY' }, pool, ['AGRESION'], new SeededRandomSource(1));
    expect(result).toEqual({ nucleo: pool[1], reason: 'HIGHEST_VALUE' });
  });

  it('empate en "mayor valor" → desempate determinista vía SeededRandomSource', () => {
    const pool = [nucleo('a', 'AGRESION', 4), nucleo('b', 'CONTROL', 4), nucleo('c', 'DEFENSA', 2)];
    // playerColors incluye DEFENSA, pero su único Núcleo (value=2) no llega al umbral >=3,
    // así que el grupo "denegar" queda vacío y se cae al paso de mayor valor (empate a-b).
    // seed=1 produce índice 1 sobre el array empatado [a, b].
    const result = decideEnemyNucleoToSpend({ kind: 'ANY' }, pool, ['DEFENSA'], new SeededRandomSource(1));
    expect(result).toEqual({ nucleo: pool[1], reason: 'ARBITRARY' });
  });

  it('playerColors vacío → nunca activa "denegar", va directo a mayor valor', () => {
    const pool = [nucleo('a', 'AGRESION', 4), nucleo('b', 'CONTROL', 3)];
    const result = decideEnemyNucleoToSpend({ kind: 'ANY' }, pool, [], new SeededRandomSource(1));
    expect(result).toEqual({ nucleo: pool[0], reason: 'HIGHEST_VALUE' });
  });

  it('requirement: { kind: "COLOR", colors: [...] } → solo considera Núcleos de esos colores', () => {
    const pool = [nucleo('a', 'AGRESION', 2), nucleo('b', 'CONTROL', 4)];
    const result = decideEnemyNucleoToSpend({ kind: 'COLOR', colors: ['AGRESION'] }, pool, [], new SeededRandomSource(1));
    expect(result).toEqual({ nucleo: pool[0], reason: 'HIGHEST_VALUE' });
  });

  it('lanza Error si pool no tiene ningún Núcleo válido para requirement', () => {
    const pool = [nucleo('b', 'CONTROL', 4)];
    expect(() =>
      decideEnemyNucleoToSpend({ kind: 'COLOR', colors: ['AGRESION'] }, pool, [], new SeededRandomSource(1))
    ).toThrow();
  });
});

describe('derivePlayerColorsFromLeaderAbilities', () => {
  it('mapa mixto de habilidades LEADER (ANY y COLOR) y ENEMY → devuelve solo los colores de las COLOR del Líder, sin duplicados', () => {
    const leaderAny = ability('leader-any');
    const leaderColor1 = ability('leader-color-1');
    const leaderColor2 = ability('leader-color-2');
    const enemyColor = ability('enemy-color');

    const abilityCoreCosts = new Map<AbilityId, CoreCostRequirement>([
      [leaderAny, { kind: 'ANY' }],
      [leaderColor1, { kind: 'COLOR', colors: ['AGRESION', 'CONTROL'] }],
      [leaderColor2, { kind: 'COLOR', colors: ['CONTROL', 'CAOS'] }],
      [enemyColor, { kind: 'COLOR', colors: ['DEFENSA'] }],
    ]);
    const abilityCooldowns = new Map<AbilityId, AbilityCooldownDefinition>([
      [leaderAny, { side: 'LEADER', baseCooldown: 1 }],
      [leaderColor1, { side: 'LEADER', baseCooldown: 2 }],
      [leaderColor2, { side: 'LEADER', baseCooldown: 3 }],
      [enemyColor, { side: 'ENEMY', baseCooldown: 1 }],
    ]);

    const result = derivePlayerColorsFromLeaderAbilities(abilityCoreCosts, abilityCooldowns);
    expect(result).toEqual(['AGRESION', 'CONTROL', 'CAOS']);
  });
});

describe('poolHasValidNucleo', () => {
  it.each([
    ['ANY siempre true si pool no vacío', { kind: 'ANY' } as CoreCostRequirement, [nucleo('a', 'AGRESION', 1)], true],
    [
      'COLOR según coincidencia de color (hay match)',
      { kind: 'COLOR', colors: ['AGRESION'] } as CoreCostRequirement,
      [nucleo('a', 'AGRESION', 1), nucleo('b', 'CONTROL', 1)],
      true,
    ],
    [
      'COLOR según coincidencia de color (sin match)',
      { kind: 'COLOR', colors: ['AGRESION'] } as CoreCostRequirement,
      [nucleo('b', 'CONTROL', 1)],
      false,
    ],
  ])('%s', (_label, requirement, pool, expected) => {
    expect(poolHasValidNucleo(requirement, pool)).toBe(expected);
  });
});

describe('validateEnemyAbilityAiProfiles (spec H1.7 §0.2)', () => {
  it('config válida (2 ramas, cada una con 1 BASICA CD1 + 0-N FIRMA/STANDARD) → no lanza', () => {
    const profiles = new Map<AbilityId, EnemyAbilityAiProfile>([
      [FIRMA, { branch: 'ATTACK', tier: 'FIRMA' }],
      [ATTACK_BASICA, { branch: 'ATTACK', tier: 'BASICA' }],
      [STANDARD_A, { branch: 'PLOT', tier: 'STANDARD' }],
      [PLOT_BASICA, { branch: 'PLOT', tier: 'BASICA' }],
    ]);
    const abilityCooldowns = new Map<AbilityId, AbilityCooldownDefinition>([
      [FIRMA, { side: 'ENEMY', baseCooldown: 3 }],
      [ATTACK_BASICA, { side: 'ENEMY', baseCooldown: 1 }],
      [STANDARD_A, { side: 'ENEMY', baseCooldown: 2 }],
      [PLOT_BASICA, { side: 'ENEMY', baseCooldown: 1 }],
    ]);
    expect(() => validateEnemyAbilityAiProfiles(profiles, abilityCooldowns)).not.toThrow();
  });

  it.each([
    [
      'referencia una habilidad side LEADER',
      new Map<AbilityId, EnemyAbilityAiProfile>([[ability('leader-x'), { branch: 'ATTACK', tier: 'FIRMA' }]]),
      new Map<AbilityId, AbilityCooldownDefinition>([[ability('leader-x'), { side: 'LEADER', baseCooldown: 2 }]]),
    ],
    [
      'referencia una habilidad inexistente en abilityCooldowns',
      new Map<AbilityId, EnemyAbilityAiProfile>([[ability('no-existe'), { branch: 'ATTACK', tier: 'FIRMA' }]]),
      new Map<AbilityId, AbilityCooldownDefinition>(),
    ],
  ])('lanza Error si %s', (_label, profiles, abilityCooldowns) => {
    expect(() => validateEnemyAbilityAiProfiles(profiles, abilityCooldowns)).toThrow();
  });

  it('lanza Error si branch ATTACK tiene tier STANDARD', () => {
    const id = ability('bad-attack-standard');
    const profiles = new Map<AbilityId, EnemyAbilityAiProfile>([[id, { branch: 'ATTACK', tier: 'STANDARD' }]]);
    const abilityCooldowns = new Map<AbilityId, AbilityCooldownDefinition>([[id, { side: 'ENEMY', baseCooldown: 2 }]]);
    expect(() => validateEnemyAbilityAiProfiles(profiles, abilityCooldowns)).toThrow();
  });

  it('lanza Error si branch PLOT tiene tier FIRMA', () => {
    const id = ability('bad-plot-firma');
    const profiles = new Map<AbilityId, EnemyAbilityAiProfile>([[id, { branch: 'PLOT', tier: 'FIRMA' }]]);
    const abilityCooldowns = new Map<AbilityId, AbilityCooldownDefinition>([[id, { side: 'ENEMY', baseCooldown: 2 }]]);
    expect(() => validateEnemyAbilityAiProfiles(profiles, abilityCooldowns)).toThrow();
  });

  it.each([
    [
      'falta la BASICA de una rama (PLOT sin BASICA)',
      new Map<AbilityId, EnemyAbilityAiProfile>([
        [FIRMA, { branch: 'ATTACK', tier: 'FIRMA' }],
        [ATTACK_BASICA, { branch: 'ATTACK', tier: 'BASICA' }],
        [STANDARD_A, { branch: 'PLOT', tier: 'STANDARD' }],
      ]),
      new Map<AbilityId, AbilityCooldownDefinition>([
        [FIRMA, { side: 'ENEMY', baseCooldown: 3 }],
        [ATTACK_BASICA, { side: 'ENEMY', baseCooldown: 1 }],
        [STANDARD_A, { side: 'ENEMY', baseCooldown: 2 }],
      ]),
    ],
    [
      'hay más de una BASICA en la misma rama (ATTACK con 2 BASICA)',
      new Map<AbilityId, EnemyAbilityAiProfile>([
        [ATTACK_BASICA, { branch: 'ATTACK', tier: 'BASICA' }],
        [ability('enemy-attack-basica-2'), { branch: 'ATTACK', tier: 'BASICA' }],
        [PLOT_BASICA, { branch: 'PLOT', tier: 'BASICA' }],
      ]),
      new Map<AbilityId, AbilityCooldownDefinition>([
        [ATTACK_BASICA, { side: 'ENEMY', baseCooldown: 1 }],
        [ability('enemy-attack-basica-2'), { side: 'ENEMY', baseCooldown: 1 }],
        [PLOT_BASICA, { side: 'ENEMY', baseCooldown: 1 }],
      ]),
    ],
  ])('lanza Error si %s', (_label, profiles, abilityCooldowns) => {
    expect(() => validateEnemyAbilityAiProfiles(profiles, abilityCooldowns)).toThrow();
  });

  it('lanza Error si la BASICA de una rama tiene baseCooldown !== 1', () => {
    const id = ability('bad-basica-cd2');
    const profiles = new Map<AbilityId, EnemyAbilityAiProfile>([[id, { branch: 'ATTACK', tier: 'BASICA' }]]);
    const abilityCooldowns = new Map<AbilityId, AbilityCooldownDefinition>([[id, { side: 'ENEMY', baseCooldown: 2 }]]);
    expect(() => validateEnemyAbilityAiProfiles(profiles, abilityCooldowns)).toThrow();
  });
});
