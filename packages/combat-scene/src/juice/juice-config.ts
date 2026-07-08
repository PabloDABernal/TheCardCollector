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
  NUCLEO_POOL_ROLLED: [{ recipeId: 'soundOnly', mode: 'parallel', soundId: 'diceRoll' }], // NUEVO H2.13
                          // antes: [] (H2.12). El "dado rodando" real sigue viviendo en
                          // nucleo-pool-view.ts (BoardView) — ver spec H2.12 §0.1/§1.1 (el canal hud
                          // siempre entrega antes que el canal scene, así que ninguna receta llegaría
                          // a tiempo sobre el sprite real). `soundOnly` no anima nada; esta entrada
                          // solo añade el cue de sonido (H2.13 spec §1.6/§3).
  ABILITY_ACTIVATED: [], // sin cambio — la animación de "Núcleo gastado" tampoco pasa por juice
                         // (mismo razonamiento, §1.1); `nucleo-pool-view.ts` la resuelve internamente
                         // leyendo el diff de snapshot, no el evento.
  TURN_ENDED: [],
  COOLDOWNS_TICKED: [{ recipeId: 'cooldownReady', mode: 'parallel' }], // NUEVO H2.10 (antes: [])
  LEADER_DAMAGED: [
    { recipeId: 'floatingNumber', mode: 'parallel' }, // NUEVO H2.11 — antes de hitImpact, spec §1.8
    { recipeId: 'hitImpact', mode: 'sequential', soundId: 'hit' }, // soundId NUEVO H2.13
    { recipeId: 'screenShake', mode: 'sequential' },
  ],
  SCENARIO_PLOT_CHANGED: [
    { recipeId: 'floatingNumber', mode: 'parallel' }, // NUEVO H2.11
    { recipeId: 'hitImpact', mode: 'sequential' },
  ],
  COMBO_TRIGGERED: [],
  CONTRATIEMPO_PLAYED: [{ recipeId: 'cardFlip', mode: 'parallel' }],
  ALLY_ENTERED_PLAY: [{ recipeId: 'cardFlip', mode: 'parallel' }],
  ALLY_DAMAGED: [
    { recipeId: 'floatingNumber', mode: 'parallel' }, // NUEVO H2.11
    { recipeId: 'hitImpact', mode: 'sequential' },
  ],
  DAMAGE_REDIRECT_SET: [],
  MINION_SUMMONED: [{ recipeId: 'cardFlip', mode: 'parallel' }],
  MINION_ACTION_RESOLVED: [],
  MINION_ACTION_SKIPPED: [],
  MINION_PASSIVE_EFFECTS_APPLIED: [],
  PHASE_CHANGED: [{ recipeId: 'screenShake', mode: 'sequential' }],
  LEADER_LEVELED_UP: [],
  CARD_PLAYED: [{ recipeId: 'cardFlip', mode: 'parallel', soundId: 'cardFlip' }], // soundId NUEVO H2.13
  ENEMY_DAMAGED: [
    { recipeId: 'floatingNumber', mode: 'parallel' }, // NUEVO H2.11
    { recipeId: 'hitImpact', mode: 'sequential', soundId: 'hit' }, // soundId NUEVO H2.13
    { recipeId: 'screenShake', mode: 'sequential' },
  ],
  LEADER_SHIELD_GAINED: [],
  DRAMATURGIA_CARD_DRAWN: [{ recipeId: 'cardFlip', mode: 'parallel' }],
  DRAMATURGIA_DECK_RESHUFFLED: [],
  COMBAT_ENDED: [{ recipeId: 'combatOutcomeSound', mode: 'parallel' }], // NUEVO H2.13, antes: []
};
