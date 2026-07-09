import type { EnemyId } from '@collector/domain-shared';
import type { AbilityDefinition } from './ability';
import type { PhaseDefinition } from './phase';
import type { DramaturgiaCardDefinition } from './dramaturgia-card';
import type { AlternativeVictoryCondition } from './victory-condition'; // NUEVO H1.8+H1.18
import type { MinionDefinition } from './minion'; // NUEVO §3.10.4

/** Espejo estructural de `EnemyAbilityBranch`/`EnemyAbilityTier`/`EnemyAbilityAiProfile`
 *  (domain/combat/types/enemy-ai.ts) — ver spec §0.2. Mismas invariantes de contenido que
 *  `validateEnemyAbilityAiProfiles` (H1.7), reimplementadas aquí porque catalog no puede
 *  importar ese validador (ver §3.4). */
export type EnemyAbilityBranch = 'ATTACK' | 'PLOT';
export type EnemyAbilityTier = 'FIRMA' | 'STANDARD' | 'BASICA';

export interface EnemyAbilityAiProfile {
  readonly branch: EnemyAbilityBranch;
  readonly tier: EnemyAbilityTier;
}

export interface EnemyAbilityDefinition extends AbilityDefinition {
  readonly aiProfile: EnemyAbilityAiProfile;
}

/**
 * GDD §3.4-§3.5. `abilities` debe incluir, entre otras, exactamente 1 con
 * `aiProfile: { branch: 'ATTACK', tier: 'BASICA' }` y exactamente 1 con
 * `{ branch: 'PLOT', tier: 'BASICA' }`, ambas con `baseCooldown === 1` y
 * `coreCost.kind === 'ANY'` (GDD §3.4: "CD1 doble... ambas siempre ⚫") — ver §3.4 para
 * el pseudocódigo completo de validación.
 */
export interface EnemyDefinition {
  readonly id: EnemyId;
  readonly name: string;
  readonly abilities: readonly EnemyAbilityDefinition[];
  /** GDD §3.4: "Fases: 2-3 (variable)". Sin tope duro — ver spec §0.6. */
  readonly phases: readonly PhaseDefinition[];
  /** GDD §3.4: "Tope blando de vida: ningún enemigo supera 100HP". Validado como
   *  entero > 0 y <= 100 — ver §3.4. */
  readonly maxHealth: number;
  /**
   * NUEVO H1.10. El mazo de Dramaturgia PROPIO de este Enemigo (GDD §5.2: "8 cartas de
   * Enemigo (4 tipos × 2 copias) + 2 únicas" = 10 en el contenido "real" de LCG). Esta
   * historia NO exige cardinalidad 10 — ver spec H1.10 §0.5 para el tamaño mínimo
   * elegido para contenido "de juguete". Es SOLO la porción de Enemigo del mazo completo
   * de 30 (GDD §5.3): las 10 cartas de Escenario y las 10 comunes son H1.11; el
   * ensamblaje del mazo de combate de 30 cartas (shuffle/robo/descarte) es H1.18 — ver
   * spec H1.10 §0.3.
   */
  readonly dramaturgiaDeck: readonly DramaturgiaCardDefinition[];
  /** NUEVO H1.8+H1.18. Condiciones de victoria/derrota alternativas o adicionales a las
   *  por defecto (decisions.md, "Condiciones de victoria/derrota alternativas por
   *  Enemigo/Escenario"). Ausente/vacío = solo las condiciones por defecto del motor. */
  readonly alternativeVictoryConditions?: readonly AlternativeVictoryCondition[];
  /** NUEVO §3.10.4. Secuaces que este Enemigo puede invocar (vía `SUMMON_MINION`,
   *  disparado hoy únicamente desde `DramaturgiaCardDefinition.summonEffect`). Ausente/
   *  vacío = este Enemigo no invoca Secuaces — combate sin Secuaces, igual que hoy. */
  readonly minions?: readonly MinionDefinition[];
  readonly universeSkin?: string;
}
