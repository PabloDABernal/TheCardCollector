import type Phaser from 'phaser';

/**
 * H2.12 spec §1.3 — matemática pura de "dado rodando" extraída de `juice/recipes/dice-roll.ts`
 * (H2.5) a este módulo neutral de `view/`, sin cambio de comportamiento, para que tanto `dice-roll.ts`
 * (receta, ver `1.4`) como `nucleo-pool-view.ts` (H2.12 §1.2 punto 3) la reutilicen sin duplicarla ni
 * introducir una dependencia inversa `view/ → juice/recipes/`.
 */

/** `once: true` + destrucción diferida — el emitter no bloquea la Promise (H2.5 spec §3.1 punto 3). */
const PARTICLE_DESTROY_DELAY_MS = 300;
const PARTICLE_QUANTITY = 8;
/** Textura base 1×1 que Phaser registra siempre internamente, sin necesitar un asset propio
 *  (H2.5 spec §3.1 punto 3). */
const PARTICLE_TEXTURE_KEY = '__WHITE';

/** Rotación "vistosa" (2-3 vueltas) determinista a partir del valor del Núcleo (1-4, GDD) — sin
 *  aleatoriedad real: 2 vueltas completas + una fracción de vuelta adicional proporcional al valor. */
export function rotationDegreesFor(nucleoValue: number): number {
  const clampedValue = Math.min(Math.max(nucleoValue, 0), 4);
  return 360 * (2 + clampedValue / 4);
}

export function spawnDieParticleBurst(scene: Phaser.Scene, x: number, y: number, tint: number): void {
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
