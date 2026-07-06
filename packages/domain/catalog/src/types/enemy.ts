import type { EnemyId } from '@collector/domain-shared';
import type { AbilityDefinition } from './ability';
import type { PhaseDefinition } from './phase';

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
  readonly universeSkin?: string;
}
