import type { JuiceRecipe } from '../juice-recipe';
import { DEFAULT_PLACEHOLDER_POSITION } from './placeholder';
// H2.8 spec §6 — tabla fija color→hex extraída a `view/nucleo-colors.ts` para que `nucleo-pool-view.ts`
// la reutilice sin duplicar el literal; sin cambio de valores/comportamiento respecto a H2.5.
import { NUCLEO_COLOR_HEX } from '../../view/nucleo-colors';
// H2.12 spec §1.3 — matemática pura de "dado rodando" extraída a `view/nucleo-roll-animation.ts` para
// que `nucleo-pool-view.ts` la reutilice sin duplicarla; sin cambio de comportamiento para esta receta.
import { rotationDegreesFor, spawnDieParticleBurst } from '../../view/nucleo-roll-animation';

const DIE_SIZE = 64;
const DIE_SEPARATION_PX = 80;
const TWEEN_DURATION_MS = 500;

export interface DiceRollParams {
  /** Posición base del pool en pantalla; por defecto el layout fijo de §2 si no se pasa. */
  readonly poolOrigin?: { x: number; y: number };
}

/** H2.5 spec §3.1 — dados rodando + `particleBurst` embebido. Dispara con `NUCLEO_POOL_ROLLED`;
 *  itera internamente sobre `target.event.pool` (un único step de `EffectsDirector`, no uno por
 *  Núcleo — H2.4 §4). */
export const diceRoll: JuiceRecipe<DiceRollParams> = {
  id: 'diceRoll',
  play(scene, target, params) {
    if (target.event.type !== 'NUCLEO_POOL_ROLLED') {
      // No debería alcanzarse en la práctica (único mapeo de JUICE_CONFIG para esta receta) —
      // resuelve sin efecto en vez de lanzar, mismo criterio defensivo de `resolveJuiceTarget`.
      return Promise.resolve();
    }

    const pool = target.event.pool;
    const origin = params.poolOrigin ?? DEFAULT_PLACEHOLDER_POSITION;
    const startX = origin.x - ((pool.length - 1) * DIE_SEPARATION_PX) / 2;

    const perDieCompletion = pool.map((nucleo, index) => {
      const x = startX + index * DIE_SEPARATION_PX;
      const y = origin.y;
      const tint = NUCLEO_COLOR_HEX[nucleo.color];
      const die = scene.add.rectangle(x, y, DIE_SIZE, DIE_SIZE, tint);

      return new Promise<void>((resolve) => {
        scene.tweens.add({
          targets: die,
          angle: { from: 0, to: rotationDegreesFor(nucleo.value) },
          scale: { from: 1.2, to: 1 },
          duration: TWEEN_DURATION_MS,
          ease: 'Cubic.easeOut',
          onComplete: () => {
            spawnDieParticleBurst(scene, die.x, die.y, tint);
            die.destroy();
            resolve();
          },
        });
      });
    });

    // La Promise resuelve cuando TODOS los tweens de dado completaron — no espera al remate de
    // partículas (fire-and-forget, spec §3.1 punto 4).
    return Promise.all(perDieCompletion).then(() => undefined);
  },
};
