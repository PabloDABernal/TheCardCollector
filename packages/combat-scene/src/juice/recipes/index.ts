import type { SoundManager } from '../../audio/sound-manager';
import type { JuiceRecipeRegistry } from '../juice-recipe';
import { diceRoll } from './dice-roll';
import { cardFlip } from './card-flip';
import { hitImpact } from './hit-impact';
import { screenShake } from './screen-shake';
import { floatingNumber } from './floating-number';
import { soundOnly } from './sound-only';
import { createCombatOutcomeSoundRecipe } from './combat-outcome-sound';
import { minionDefeated } from './minion-defeated';
import { turnBanner } from './turn-banner';

/** H2.5 spec §4 — registro id→implementación real (sustituye `STUB_RECIPE_REGISTRY` de H2.4).
 *  H2.11 añade `floatingNumber` (6º id).
 *
 *  H2.13 — pasa de objeto estático (`RECIPE_REGISTRY`) a fábrica `createRecipeRegistry(soundManager)`:
 *  `combatOutcomeSound` es la primera receta que necesita un servicio inyectado (`SoundManager`)
 *  distinto de `scene`/`target`/`params` ya provistos por el contrato de `JuiceRecipe` — no cabe
 *  como singleton estático. Todos los callers (`CombatScene.ts`, `main.ts`, tests) deben migrar de
 *  `RECIPE_REGISTRY` (import directo) a `createRecipeRegistry(soundManager)`.
 *
 *  H4 (fix Reviewer) — `cooldownReady` (H2.10) RETIRADA: buscaba un game object de Phaser vía
 *  `abilityIconGroupName` que dejó de existir cuando `ability-cooldown-view.ts` migró a HTML
 *  (`AbilityTile.tsx`, H4 spec §2/§6) — se resolvía siempre a no-op silencioso. El pulso real de
 *  "cooldown listo" vive ahora en CSS (`card-tile--ready`, `AbilityTile.tsx`). Ver `JUICE_CONFIG`
 *  (`../juice-config.ts`), `COOLDOWNS_TICKED` ya no apunta a ninguna receta. */
export function createRecipeRegistry(soundManager: SoundManager): JuiceRecipeRegistry {
  return {
    diceRoll,
    cardFlip,
    hitImpact,
    screenShake,
    floatingNumber,
    soundOnly, // NUEVO H2.13
    combatOutcomeSound: createCombatOutcomeSoundRecipe(soundManager), // NUEVO H2.13
    minionDefeated, // NUEVO H3 (spec §3.9.6)
    turnBanner, // NUEVO H4 (spec §3.4)
  };
}
