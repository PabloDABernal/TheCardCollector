import type { CombatEvent } from '@collector/domain-combat';
import type { JuiceStep } from './juice-recipe';

/** H2.4 spec §4 — mapeo declarativo y completo `CombatEvent['type']` → `JuiceStep[]`. Entradas sin
 *  receta se declaran como array vacío `[]` (no se omiten) para que quede explícito en el código
 *  que la ausencia de receta es una decisión, no un olvido. */
export type JuiceConfig = Record<CombatEvent['type'], JuiceStep[]>;

/**
 * Tabla completa (23 tipos reales de `packages/domain/combat/src/types/events.ts`) — ver
 * `docs/specs/H2.4_effects_director.md` §4 para el razonamiento de cada entrada.
 */
export const JUICE_CONFIG: JuiceConfig = {
  NUCLEO_POOL_ROLLED: [{ recipeId: 'diceRoll', mode: 'parallel' }],
  ABILITY_ACTIVATED: [],
  TURN_ENDED: [],
  COOLDOWNS_TICKED: [],
  LEADER_DAMAGED: [
    { recipeId: 'hitImpact', mode: 'sequential' },
    { recipeId: 'screenShake', mode: 'sequential' },
  ],
  SCENARIO_PLOT_CHANGED: [{ recipeId: 'hitImpact', mode: 'sequential' }],
  COMBO_TRIGGERED: [],
  CONTRATIEMPO_PLAYED: [{ recipeId: 'cardFlip', mode: 'parallel' }],
  ALLY_ENTERED_PLAY: [{ recipeId: 'cardFlip', mode: 'parallel' }],
  ALLY_DAMAGED: [{ recipeId: 'hitImpact', mode: 'sequential' }],
  DAMAGE_REDIRECT_SET: [],
  MINION_SUMMONED: [{ recipeId: 'cardFlip', mode: 'parallel' }],
  MINION_ACTION_RESOLVED: [],
  MINION_ACTION_SKIPPED: [],
  MINION_PASSIVE_EFFECTS_APPLIED: [],
  PHASE_CHANGED: [{ recipeId: 'screenShake', mode: 'sequential' }],
  LEADER_LEVELED_UP: [],
  CARD_PLAYED: [{ recipeId: 'cardFlip', mode: 'parallel' }],
  ENEMY_DAMAGED: [
    { recipeId: 'hitImpact', mode: 'sequential' },
    { recipeId: 'screenShake', mode: 'sequential' },
  ],
  LEADER_SHIELD_GAINED: [],
  DRAMATURGIA_CARD_DRAWN: [{ recipeId: 'cardFlip', mode: 'parallel' }],
  DRAMATURGIA_DECK_RESHUFFLED: [],
  COMBAT_ENDED: [],
};
