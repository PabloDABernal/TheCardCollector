import type { AbilityId, CoreCostRequirement } from '@collector/domain-shared';
import type { NucleoInstance } from './nucleo';

/**
 * Icono de la carta de Dramaturgia YA robada (GDD §3.4). Ver spec H1.7 §0.1: H1.7 NO
 * construye ni gestiona el mazo de Dramaturgia (mecánica real, GDD §3.4/§5.3, pero cuyo
 * contenido es H1.10/H1.11 y cuyo runtime de robo/reposición es H1.18) — recibe
 * únicamente el resultado de esa tirada como input externo.
 */
export type DramaturgiaCardIcon = 'ATTACK' | 'PLOT';

/** A qué icono de Dramaturgia responde una habilidad del Enemigo (GDD §3.4: ⚔️ → Ataque,
 *  📜 → Trama). Una habilidad del Enemigo pertenece siempre a una única rama. */
export type EnemyAbilityBranch = 'ATTACK' | 'PLOT';

/**
 * Categoría de prioridad de IA de una habilidad del Enemigo (GDD §3.5) — ver spec H1.7
 * §0.2 para la justificación completa de por qué Ataque y Trama usan un vocabulario
 * distinto:
 * - `'FIRMA'`    — SOLO válido con `branch: 'ATTACK'`. Habilidad "de firma" marcada
 *                  explícitamente por contenido (no calculada por CD). Prioridad 1 de
 *                  la rama Ataque, si tiene Núcleo disponible (§3.1/§3.2).
 * - `'STANDARD'` — SOLO válido con `branch: 'PLOT'`. Cualquier habilidad de Trama que no
 *                  sea la básica; la prioridad entre varias de éstas se decide
 *                  dinámicamente por `baseCooldown` (mayor CD gana, GDD §3.5 "de mayor
 *                  CD"), no por esta etiqueta.
 * - `'BASICA'`   — válido en ambas ramas. La habilidad CD1 ⚫ garantizada por "CD1 doble"
 *                  (GDD §3.4). Exactamente una por rama en el perfil de un Enemigo.
 */
export type EnemyAbilityTier = 'FIRMA' | 'STANDARD' | 'BASICA';

/** Dato de IA de una habilidad del Enemigo — inyectado en un mapa nuevo y separado de
 *  `AbilityCooldownDefinition`/`AbilityEffectDefinition` (spec H1.7 §0.2: el Líder no
 *  necesita esta clasificación). */
export interface EnemyAbilityAiProfile {
  readonly branch: EnemyAbilityBranch;
  readonly tier: EnemyAbilityTier;
}

/**
 * Vista de una habilidad del Enemigo tal como la necesita `decideEnemyAbility` (§3.1):
 * su coste, su CD (base y restante) y su perfil de IA. Quien invoque la función la
 * construye a partir de `CombatStateSnapshot.cooldowns` (H1.4) + `abilityCoreCosts`
 * (H1.3) + el nuevo mapa de perfiles de IA (§0.2) — H1.7 no impone cómo se ensambla esa
 * vista, solo qué forma debe tener.
 */
export interface EnemyAbilityCandidate {
  readonly abilityId: AbilityId;
  readonly coreCost: CoreCostRequirement;
  readonly baseCooldown: number;
  /** CD restante ahora mismo. `0` = lista para activar (mismo significado que
   *  `AbilityCooldownSnapshot.remaining`, H1.4). */
  readonly remainingCooldown: number;
  readonly aiProfile: EnemyAbilityAiProfile;
}

/** Resultado de la Capa 1 (`decideEnemyAbility`, §3.1) — incluye `branch`/`tier` además
 *  del `abilityId` para que tests/telemetría futura puedan afirmar POR QUÉ se eligió,
 *  no solo qué se eligió (mismo espíritu que `AbilityUmbralResolution`, H1.5). */
export interface EnemyAbilityDecision {
  readonly abilityId: AbilityId;
  readonly branch: EnemyAbilityBranch;
  readonly tier: EnemyAbilityTier;
}

/** Motivo por el que `decideEnemyNucleoToSpend` (§3.2) eligió un Núcleo concreto —
 *  expone el razonamiento de GDD §3.5 para tests/telemetría. */
export type EnemyNucleoDecisionReason = 'DENY_PLAYER_COLOR' | 'HIGHEST_VALUE' | 'ARBITRARY';

/** Resultado de la Capa 2 (`decideEnemyNucleoToSpend`, §3.2). */
export interface EnemyNucleoDecision {
  readonly nucleo: NucleoInstance;
  readonly reason: EnemyNucleoDecisionReason;
}
