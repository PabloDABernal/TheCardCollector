import type { RandomSource, AbilityId, CoreCostRequirement, NucleoColor } from '@collector/domain-shared';
import { satisfiesCoreCost } from '@collector/domain-shared';
import type { NucleoInstance } from './types/nucleo';
import type { AbilityCooldownDefinition } from './types/cooldown';
import { ABILITY_BASE_COOLDOWN_MIN } from './types/cooldown';
import { UMBRAL_BONUS_THRESHOLD } from './types/umbral';
import type {
  DramaturgiaCardIcon,
  EnemyAbilityBranch,
  EnemyAbilityCandidate,
  EnemyAbilityDecision,
  EnemyAbilityAiProfile,
  EnemyNucleoDecision,
} from './types/enemy-ai';

/** Existe al menos un Núcleo en `pool` que satisface `requirement` (GDD §3.5: "si tiene
 *  Núcleo mínimo disponible"). Pura, reutiliza `satisfiesCoreCost` (H1.3). */
export function poolHasValidNucleo(requirement: CoreCostRequirement, pool: readonly NucleoInstance[]): boolean {
  return pool.some((n) => satisfiesCoreCost(requirement, n.color));
}

/**
 * Capa 1 (GDD §3.5): decide QUÉ habilidad del Enemigo se activa dado el icono de la
 * carta de Dramaturgia ya robada (§0.1). `candidates` debe incluir TODAS las
 * habilidades del Enemigo relevantes para IA (ambas ramas) — la función filtra
 * internamente por `icon`.
 *
 * Algoritmo (idéntico al árbol de GDD §3.5, ver spec §0.2/§0.4):
 *  - Rama ATTACK: prioridad 1 = candidatas `tier: 'FIRMA'`, CD listo (`remainingCooldown
 *    === 0`) Y con Núcleo válido disponible (`poolHasValidNucleo`); si hay más de una,
 *    desempate por `baseCooldown` más alto, y si sigue empatado, `RandomSource.pick`.
 *    Si el grupo de prioridad 1 está vacío, cae a la candidata `tier: 'BASICA'`.
 *  - Rama PLOT: prioridad 1 = candidatas `tier: 'STANDARD'` listas y con Núcleo válido;
 *    mismo desempate por `baseCooldown`/aleatorio. Si vacío, cae a `tier: 'BASICA'`.
 *  - La candidata BASICA de la rama pedida DEBE existir en `candidates` con
 *    `remainingCooldown === 0` (GDD §3.4: "siempre disponible") — si no se encuentra,
 *    lanza `Error` (invariante de contenido violada, no un caso de juego válido).
 */
export function decideEnemyAbility(
  icon: DramaturgiaCardIcon,
  candidates: readonly EnemyAbilityCandidate[],
  pool: readonly NucleoInstance[],
  randomSource: RandomSource
): EnemyAbilityDecision {
  const branch: EnemyAbilityBranch = icon;
  const readyInBranch = candidates.filter(
    (c) => c.aiProfile.branch === branch && c.remainingCooldown === 0
  );

  const priorityTier: EnemyAbilityAiProfile['tier'] = branch === 'ATTACK' ? 'FIRMA' : 'STANDARD';
  const priorityGroup = readyInBranch.filter(
    (c) => c.aiProfile.tier === priorityTier && poolHasValidNucleo(c.coreCost, pool)
  );

  const chosen =
    priorityGroup.length > 0
      ? pickHighestBaseCooldown(priorityGroup, randomSource)
      : pickBasica(readyInBranch, branch);

  return { abilityId: chosen.abilityId, branch, tier: chosen.aiProfile.tier };
}

function pickHighestBaseCooldown(
  group: readonly EnemyAbilityCandidate[],
  randomSource: RandomSource
): EnemyAbilityCandidate {
  const maxCooldown = Math.max(...group.map((c) => c.baseCooldown));
  const top = group.filter((c) => c.baseCooldown === maxCooldown);
  return top.length === 1 ? (top[0] as EnemyAbilityCandidate) : randomSource.pick(top);
}

function pickBasica(
  readyInBranch: readonly EnemyAbilityCandidate[],
  branch: EnemyAbilityBranch
): EnemyAbilityCandidate {
  const basica = readyInBranch.filter((c) => c.aiProfile.tier === 'BASICA');
  if (basica.length !== 1) {
    throw new Error(
      `decideEnemyAbility: se esperaba exactamente 1 candidata BASICA lista para la rama "${branch}" (GDD §3.4, "CD1 doble... siempre disponible"), encontradas ${basica.length}`
    );
  }
  return basica[0] as EnemyAbilityCandidate;
}

/**
 * Capa 2 (GDD §3.5, ver spec §0.4): decide QUÉ instancia de Núcleo del pool se gasta
 * para pagar `requirement` (el coste de la habilidad ya elegida por `decideEnemyAbility`).
 *
 * Algoritmo:
 *  1. `valid` = Núcleos de `pool` que satisfacen `requirement` (`satisfiesCoreCost`).
 *     Si `valid` está vacío, lanza `Error` (invariante violada — el caller debería haber
 *     comprobado `poolHasValidNucleo` antes de llegar aquí, vía Capa 1).
 *  2. `deny` = de `valid`, los de color ∈ `playerColors` Y `value >= 3` (GDD §12,
 *     `UMBRAL_BONUS_THRESHOLD`). Si `deny` no está vacío: de esos, el de mayor `value`
 *     (empate → `randomSource.pick`), razón `'DENY_PLAYER_COLOR'`.
 *  3. Si `deny` está vacío: de `valid`, el de mayor `value` (empate → `randomSource.pick`,
 *     razón `'ARBITRARY'`; sin empate, razón `'HIGHEST_VALUE'`).
 */
export function decideEnemyNucleoToSpend(
  requirement: CoreCostRequirement,
  pool: readonly NucleoInstance[],
  playerColors: readonly NucleoColor[],
  randomSource: RandomSource
): EnemyNucleoDecision {
  const valid = pool.filter((n) => satisfiesCoreCost(requirement, n.color));
  if (valid.length === 0) {
    throw new Error(
      'decideEnemyNucleoToSpend: no hay ningún Núcleo en el pool que satisfaga el coste requerido — el caller debe comprobar poolHasValidNucleo antes de invocar esta función'
    );
  }

  const deny = valid.filter((n) => playerColors.includes(n.color) && n.value >= UMBRAL_BONUS_THRESHOLD);
  if (deny.length > 0) {
    const maxValue = Math.max(...deny.map((n) => n.value));
    const top = deny.filter((n) => n.value === maxValue);
    const nucleo = top.length === 1 ? (top[0] as NucleoInstance) : randomSource.pick(top);
    return { nucleo, reason: 'DENY_PLAYER_COLOR' };
  }

  const maxValue = Math.max(...valid.map((n) => n.value));
  const top = valid.filter((n) => n.value === maxValue);
  if (top.length === 1) {
    return { nucleo: top[0] as NucleoInstance, reason: 'HIGHEST_VALUE' };
  }
  return { nucleo: randomSource.pick(top), reason: 'ARBITRARY' };
}

/**
 * Deriva el conjunto de "colores del jugador" (GDD §3.5, spec H1.7 §0.4): los colores
 * que aparecen en el coste `kind: 'COLOR'` de alguna habilidad `side: 'LEADER'`. Las
 * habilidades `kind: 'ANY'` (⚫) del Líder no "necesitan" ningún color concreto y no
 * contribuyen. Pura, sin acceso a `CombatEngine` — opera directamente sobre los mismos
 * mapas que ya recibe `CombatEngineConfig` (`abilityCoreCosts`/`abilityCooldowns`).
 */
export function derivePlayerColorsFromLeaderAbilities(
  abilityCoreCosts: ReadonlyMap<AbilityId, CoreCostRequirement>,
  abilityCooldowns: ReadonlyMap<AbilityId, AbilityCooldownDefinition>
): readonly NucleoColor[] {
  const colors = new Set<NucleoColor>();
  for (const [abilityId, requirement] of abilityCoreCosts) {
    const def = abilityCooldowns.get(abilityId);
    if (def?.side !== 'LEADER') continue;
    if (requirement.kind === 'COLOR') {
      for (const color of requirement.colors) colors.add(color);
    }
  }
  return [...colors];
}

/**
 * Valida las invariantes de contenido de un mapa de perfiles de IA (spec H1.7 §0.2).
 * Lanza `Error` con mensaje descriptivo en la primera violación encontrada, mismo estilo
 * que `CombatEngine.validateAbilityCooldownsConfig` (H1.4). NO se invoca desde el
 * constructor de `CombatEngine` en esta historia (§0.3: el mapa de perfiles de IA no
 * vive en `CombatEngineConfig` todavía) — es una función independiente para que
 * tests/H1.18 la llamen explícitamente al ensamblar contenido de Enemigo.
 *
 * Invariantes:
 *  1. Toda clave debe existir en `abilityCooldowns` con `side === 'ENEMY'`.
 *  2. `branch: 'ATTACK'` → `tier` ∈ {'FIRMA','BASICA'}; `branch: 'PLOT'` → `tier` ∈
 *     {'STANDARD','BASICA'} (spec §0.2).
 *  3. Para cada `branch` presente, exactamente una entrada con `tier: 'BASICA'`, y esa
 *     entrada debe tener `abilityCooldowns.get(id).baseCooldown === ABILITY_BASE_COOLDOWN_MIN`.
 */
export function validateEnemyAbilityAiProfiles(
  profiles: ReadonlyMap<AbilityId, EnemyAbilityAiProfile>,
  abilityCooldowns: ReadonlyMap<AbilityId, AbilityCooldownDefinition>
): void {
  const basicaCountByBranch = new Map<EnemyAbilityBranch, number>();

  for (const [abilityId, profile] of profiles) {
    const def = abilityCooldowns.get(abilityId);
    if (!def || def.side !== 'ENEMY') {
      throw new Error(
        `validateEnemyAbilityAiProfiles: "${String(abilityId)}" no existe en abilityCooldowns con side "ENEMY"`
      );
    }

    if (profile.branch === 'ATTACK' && profile.tier === 'STANDARD') {
      throw new Error(
        `validateEnemyAbilityAiProfiles: "${String(abilityId)}" es branch ATTACK con tier STANDARD — GDD §3.5 no define una tercera categoría para Ataque (solo FIRMA/BASICA), ver spec H1.7 §0.2`
      );
    }
    if (profile.branch === 'PLOT' && profile.tier === 'FIRMA') {
      throw new Error(
        `validateEnemyAbilityAiProfiles: "${String(abilityId)}" es branch PLOT con tier FIRMA — GDD §3.5 nunca usa "firma" para Trama (solo STANDARD/BASICA), ver spec H1.7 §0.2`
      );
    }

    if (profile.tier === 'BASICA') {
      if (def.baseCooldown !== ABILITY_BASE_COOLDOWN_MIN) {
        throw new Error(
          `validateEnemyAbilityAiProfiles: "${String(abilityId)}" es tier BASICA pero baseCooldown es ${def.baseCooldown} (esperado ${ABILITY_BASE_COOLDOWN_MIN}, GDD §3.4 "CD1 doble")`
        );
      }
      basicaCountByBranch.set(profile.branch, (basicaCountByBranch.get(profile.branch) ?? 0) + 1);
    }
  }

  for (const branch of ['ATTACK', 'PLOT'] as const) {
    const count = basicaCountByBranch.get(branch) ?? 0;
    if (count !== 1) {
      throw new Error(
        `validateEnemyAbilityAiProfiles: se esperaba exactamente 1 tier BASICA para branch "${branch}" (GDD §3.4, "CD1 doble"), encontradas ${count}`
      );
    }
  }
}
