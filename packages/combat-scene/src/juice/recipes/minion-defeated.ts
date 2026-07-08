import type Phaser from 'phaser';
import type { JuiceRecipe } from '../juice-recipe';
import { resolveOrCreateCardPlaceholder } from './placeholder';

const FADE_SHRINK_DURATION_MS = 300;

/** `minions-view.ts` mantiene un `Text` de vida/label separado del `Rectangle` con `focusId` —
 *  no está nombrado (`setName`) porque ningún otro consumidor lo necesitaba hasta ahora. Se
 *  intenta localizar por convención (`${focusId}-label`) para no dejarlo huérfano en pantalla tras
 *  el fade del rect; si `minions-view.ts` no lo nombra así (limitación conocida, documentada), esta
 *  receta simplemente no encuentra nada y no falla — el rect sigue siendo el efecto principal. */
function tryDestroyLabel(scene: Phaser.Scene, focusId: string | undefined): void {
  if (focusId === undefined) return;
  const sceneLike = scene as unknown as { children: { getByName(name: string): { destroy(): void } | null } };
  const label = sceneLike.children.getByName(`${focusId}-label`);
  label?.destroy();
}

/**
 * NUEVO H3 (spec §3.9.6/§5.3) — "el sprite del Secuaz sale de mesa" cuando `MINION_DEFEATED` se
 * dispara. Reutiliza el mismo lenguaje visual (fade+shrink, misma duración) que H2.12 ya definió
 * para un Núcleo gastado (`nucleo-pool-view.ts`, ahora sustituido por el modelo de mesa
 * persistente) — no existe hoy una animación de "muerte de Aliado" reutilizable (H1.15 nunca
 * elimina Aliados de mesa, solo los deja en `life === 0`), así que esta es una receta NUEVA simple,
 * tal como permite la spec cuando no hay nada que reutilizar con sentido semántico. Destruye el
 * game object al completar — a diferencia de `nucleo-table-view.ts`, un Secuaz derrotado SÍ sale
 * definitivamente de mesa (domain: `minionsInPlay` lo elimina de inmediato).
 */
export const minionDefeated: JuiceRecipe = {
  id: 'minionDefeated',
  play(scene, target) {
    const gameObject = resolveOrCreateCardPlaceholder(scene, target.focusId);

    return new Promise<void>((resolve) => {
      scene.tweens.add({
        targets: gameObject,
        alpha: { from: 1, to: 0 },
        scale: { from: 1, to: 0.6 },
        duration: FADE_SHRINK_DURATION_MS,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          gameObject.destroy();
          tryDestroyLabel(scene, target.focusId);
          resolve();
        },
      });
    });
  },
};
