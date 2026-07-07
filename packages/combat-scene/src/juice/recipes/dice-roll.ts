import type Phaser from 'phaser';
import type { NucleoColor } from '@collector/domain-shared';
import type { JuiceRecipe } from '../juice-recipe';
import { DEFAULT_PLACEHOLDER_POSITION } from './placeholder';

/** H2.5 spec §3.1 — tabla fija color→hex para los placeholders efímeros de dado (no hay asset de
 *  Núcleo real todavía, H2.8). */
const NUCLEO_COLOR_HEX: Record<NucleoColor, number> = {
  AGRESION: 0xe74c3c,
  CONTROL: 0x3498db,
  DEFENSA: 0x2ecc71,
  RECURSO: 0xf1c40f,
  CAOS: 0x9b59b6,
};

const DIE_SIZE = 64;
const DIE_SEPARATION_PX = 80;
const TWEEN_DURATION_MS = 500;
/** `once: true` + destrucción diferida (spec §3.1 punto 3) — el emitter no bloquea la Promise. */
const PARTICLE_DESTROY_DELAY_MS = 300;
const PARTICLE_QUANTITY = 8;
/** Textura base 1×1 que Phaser registra siempre internamente, sin necesitar un asset propio
 *  (spec §3.1 punto 3). */
const PARTICLE_TEXTURE_KEY = '__WHITE';

export interface DiceRollParams {
  /** Posición base del pool en pantalla; por defecto el layout fijo de §2 si no se pasa. */
  readonly poolOrigin?: { x: number; y: number };
}

/** Rotación "vistosa" (2-3 vueltas, spec §3.1 punto 2) determinista a partir del valor del Núcleo
 *  (1-4, GDD) — sin aleatoriedad real: 2 vueltas completas + una fracción de vuelta adicional
 *  proporcional al valor. */
function rotationDegreesFor(nucleoValue: number): number {
  const clampedValue = Math.min(Math.max(nucleoValue, 0), 4);
  return 360 * (2 + clampedValue / 4);
}

function spawnParticleBurst(scene: Phaser.Scene, x: number, y: number, tint: number): void {
  const emitter = scene.add.particles(x, y, PARTICLE_TEXTURE_KEY, {
    speed: { min: 50, max: 120 },
    lifespan: 250,
    quantity: PARTICLE_QUANTITY,
    scale: { start: 0.4, end: 0 },
    tint,
    emitting: false,
  });
  emitter.explode(PARTICLE_QUANTITY, x, y);
  scene.time.delayedCall(PARTICLE_DESTROY_DELAY_MS, () => emitter.destroy());
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
            spawnParticleBurst(scene, die.x, die.y, tint);
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
