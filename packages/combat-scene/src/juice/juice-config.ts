import type { CombatEvent } from '@collector/domain-combat';
import type { JuiceStep } from './juice-recipe';

/** H2.4 spec §4 — mapeo declarativo y completo `CombatEvent['type']` → `JuiceStep[]`. Entradas sin
 *  receta se declaran como array vacío `[]` (no se omiten) para que quede explícito en el código
 *  que la ausencia de receta es una decisión, no un olvido. */
export type JuiceConfig = Record<CombatEvent['type'], JuiceStep[]>;

/**
 * Tabla completa de `packages/domain/combat/src/types/events.ts` — ver
 * `docs/specs/H2.4_effects_director.md` §4 y `docs/specs/H3_cierre_loop_jugable_batalla.md` §5.3
 * para el razonamiento de cada entrada nueva/renombrada por el cierre del loop jugable (H3).
 */
export const JUICE_CONFIG: JuiceConfig = {
  // RENOMBRADO H3.4 de NUCLEO_POOL_ROLLED — el "dado rodando" real vive en `nucleo-table-view.ts`
  // (BoardView, canal HUD, que siempre entrega antes que el canal scene) sobre los sprites
  // PERSISTENTES de mesa; esta entrada solo añade el cue de sonido (H2.13 spec §1.6/§3).
  NUCLEO_TABLE_REROLLED: [{ recipeId: 'soundOnly', mode: 'parallel', soundId: 'diceRoll' }],
  // NUEVO H3.4 — un dado EXTRA se añadió a mesa. La animación de "spawn" real vive en
  // `nucleo-table-view.ts` (mismo criterio que el reroll); aquí solo el cue de sonido.
  NUCLEO_DIE_ADDED: [{ recipeId: 'soundOnly', mode: 'parallel', soundId: 'diceRoll' }],
  // NUEVO H3.4 — intento de añadir dado ignorado por tope de mesa (no hay dado que animar, spec §5.3).
  NUCLEO_DIE_ADD_SKIPPED: [],
  // MODIFICADO H5.6 §1 — "Activar una habilidad": foco total sobre el dado gastado (focusId ya
  // resuelto por H5.4 §3) + flash de impacto. `EffectsDirector` envuelve automáticamente con
  // blur+zoom+hold+reset (H5.3 §2.2) — este array es SOLO el contenido que juega DENTRO de esa
  // ventana de foco. El daño real de una habilidad de ataque llega en un evento SEPARADO
  // (ENEMY_DAMAGED/MINION_DAMAGED, ver H5.6 §1.1) — no se duplica floatingNumber/hitImpact/
  // screenShake aquí, evita un doble impacto visual sobre el mismo golpe.
  ABILITY_ACTIVATED: [{ recipeId: 'focusWhiteLens', mode: 'parallel', isBigMoment: true, soundId: 'cardFlip' }],
  // NUEVO H4 (spec §3.2) — banner de canvas "Tu turno"/"Turno del Enemigo", enganchado al evento
  // real de dominio TURN_ENDED (nextTurnOwner). Antes: [].
  TURN_ENDED: [{ recipeId: 'turnBanner', mode: 'sequential' }],
  // H4 (fix Reviewer) — `cooldownReady` (H2.10) RETIRADA del registro (`recipes/index.ts`): el
  // pulso de "cooldown listo" vive ahora en CSS (`card-tile--ready`, `AbilityTile.tsx`), la
  // habilidad migró de icono Phaser a tile HTML. Sin receta de canvas para este evento.
  COOLDOWNS_TICKED: [],
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
  // NUEVO §3.10.3 — intento de invocación ignorado por tope de mesa (no hay Secuaz que
  // animar, mismo criterio que NUCLEO_DIE_ADD_SKIPPED).
  MINION_SUMMON_SKIPPED: [],
  MINION_ACTION_RESOLVED: [],
  MINION_ACTION_SKIPPED: [],
  // NUEVO §3.9 — daño a un Secuaz por ataque directo del jugador (spec §3.9.6, misma receta que
  // LEADER_DAMAGED/ALLY_DAMAGED: floatingNumber + hitImpact, resuelto contra el sprite del Secuaz
  // vía `focusId = minionInstanceId`, ver `effects-director.ts` `resolveJuiceTarget`).
  MINION_DAMAGED: [
    { recipeId: 'floatingNumber', mode: 'parallel' },
    { recipeId: 'hitImpact', mode: 'sequential', soundId: 'hit' },
  ],
  // NUEVO §3.9 — el Secuaz sale de mesa (spec §3.9.6): receta nueva `minionDefeated` (fade+shrink),
  // sin receta reutilizable de "muerte" existente (H1.15 nunca elimina Aliados de mesa).
  // MODIFICADO H5.6 §1 — se marca grande (momento "muerte de Secuaz", vision.md). El `focusId` de
  // este evento (`resolveJuiceTarget`, sin cambios: `event.instanceId`) apunta al Secuaz derrotado,
  // foco natural.
  MINION_DEFEATED: [{ recipeId: 'minionDefeated', mode: 'sequential', isBigMoment: true }],
  MINION_PASSIVE_EFFECTS_APPLIED: [],
  // NUEVO H5.3 §3 — momento grande ESTÁTICO: cambio de fase de Enemigo/Escenario dispara Level-Up
  // (decisions.md), vision.md lo marca como foco total. Contenido (screenShake) sin cambio.
  PHASE_CHANGED: [{ recipeId: 'screenShake', mode: 'sequential', isBigMoment: true }],
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
  // NUEVO H3.6 — paso previo gratuito del turno. Sin receta visual pesada (spec §5.3, "marca visual
  // de que el paso previo ya se gastó" vive en el HUD, no en juice de canvas); el efecto concreto
  // (`LEADER_HAND_CARD_DRAWN`/`ENERGY_GENERATED`/variantes SKIPPED) ya lleva su propia receta.
  FREE_STEP_RESOLVED: [],
  // NUEVO H3.6 — robo de carta (paso previo o `DRAW_CARD` pagado): reutiliza `cardFlip` (misma
  // receta que `CARD_PLAYED`/`MINION_SUMMONED`, spec §5.3: "animación desde un mazo/pila visual
  // hacia el abanico de mano — reutilizable con una variante de cardFlip").
  LEADER_HAND_CARD_DRAWN: [{ recipeId: 'cardFlip', mode: 'parallel' }],
  // NUEVO H3.6 — robo no-op (mano llena/mazo vacío): feedback informativo no bloqueante (spec §5.3).
  // Sin cue de sonido dedicado todavía (`SoundCueId` no tiene un tono "rechazo" en este MVP, ver
  // `audio/sound-manager.ts` — fuera de alcance de esta historia añadir uno nuevo); el HUD (React)
  // es responsable del toast/feedback textual, no juice de canvas.
  LEADER_HAND_DRAW_SKIPPED: [],
  ENERGY_GENERATED: [],
  // NUEVO H3.6 — Generar Energía no-op (ya al tope): mismo criterio que LEADER_HAND_DRAW_SKIPPED.
  ENERGY_GENERATE_SKIPPED: [],
};
