import type { SoundManager } from '../../audio/sound-manager';
import type { JuiceRecipe } from '../juice-recipe';

/** H2.13 spec §1.4 — única receta de esta historia con acceso directo al `SoundManager` (vía
 *  clausura, mismo criterio que `createCooldownReadyRecipe`/H2.10 con su `Map` de estado). Lee
 *  `target.event.outcome` para decidir `victory` vs `defeat` — caso que `JuiceStep.soundId` estático
 *  no puede cubrir. Resuelve su Promise de inmediato (mismo criterio que `floatingNumber`, H2.11): el
 *  sonido es puramente decorativo y no debe condicionar ningún step secuencial posterior. */
export function createCombatOutcomeSoundRecipe(soundManager: SoundManager): JuiceRecipe {
  return {
    id: 'combatOutcomeSound',
    play(_scene, target): Promise<void> {
      if (target.event.type === 'COMBAT_ENDED') {
        soundManager.play(target.event.outcome === 'VICTORY' ? 'victory' : 'defeat');
      }
      return Promise.resolve();
    },
  };
}
