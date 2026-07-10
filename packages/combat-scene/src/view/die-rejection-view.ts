import type Phaser from 'phaser';
import type { RejectionSignal } from '../interaction/rejection-signal';

/**
 * FIX QA (Bug 3, "Elige un Núcleo") — feedback visual del rechazo puntual de un tap sobre un dado ya
 * gastado durante `AWAITING_NUCLEO_FOR_CARD`/`AWAITING_NUCLEO_FOR_ABILITY` (ver
 * `interaction/rejection-signal.ts`/`gesture-command-translator.ts` para el porqué del canal). Vive
 * en Phaser, co-localizado con el sprite que rechaza — mismo criterio que
 * `targeting-highlight-view.ts` ("el texto del prompt es HTML, el highlight/feedback del sprite se
 * queda en Phaser"). Se suscribe DIRECTAMENTE a `RejectionSignal` (evento transitorio, no estado de
 * `targetingSignal`/`bridge`).
 */
export interface DieRejectionView {
  /** Desuscribe de `rejectionSignal` — llamado desde `CombatScene` en `SHUTDOWN`, mismo criterio de
   *  limpieza que el resto de suscripciones de escena. */
  destroy(): void;
}

const SHAKE_OFFSET_PX = 6;
const SHAKE_SEGMENT_DURATION_MS = 60;
const SHAKE_REPEATS = 3; // yoyo + repeat: 3 → 4 idas y vueltas completas, sacudida corta y clara
const FLASH_COLOR = 0xd23c3c; // rojo de rechazo — no reutiliza ningún token existente (--foil/--rule
// son highlight/borde, no error); mismo lenguaje de "rojo = no puedes" que el resto de la UI de combate.
const FLASH_DURATION_MS = 280;

/** Mismo mecanismo que `targeting-highlight-view.ts` (`findByTargetId`) — `getData('targetId')` es
 *  la superficie uniforme real para resolver un id de dominio a su game object en escena, ya que los
 *  dados de `nucleo-table-view.ts` no llaman `setName`. Duplicado deliberadamente en vez de
 *  extraído a un helper compartido: ambos módulos son pequeños y la duplicación es más barata que
 *  acoplar dos features de feedback visual independientes a un módulo común (mismo criterio de
 *  `rounded-frame.ts`, que SÍ se extrajo por ser decoración estructural repetida 1:1). */
function findByTargetId(scene: Phaser.Scene, id: string): Phaser.GameObjects.GameObject | undefined {
  return scene.children.list.find((obj) => {
    const getData = (obj as { getData?: (key: string) => unknown }).getData;
    return typeof getData === 'function' && getData.call(obj, 'targetId') === id;
  });
}

function isShakeableRectangle(obj: Phaser.GameObjects.GameObject): obj is Phaser.GameObjects.Rectangle {
  const candidate = obj as Partial<Phaser.GameObjects.Rectangle>;
  return typeof candidate.x === 'number' && typeof candidate.fillColor === 'number';
}

export function createDieRejectionView(scene: Phaser.Scene, rejectionSignal: RejectionSignal): DieRejectionView {
  function handleRejection(event: { readonly dieId: string }): void {
    const obj = findByTargetId(scene, event.dieId);
    if (!obj || !isShakeableRectangle(obj)) return; // defensivo — dado ya no en escena (no debería ocurrir)

    const rect = obj;
    const originX = rect.x;
    const originFillColor = rect.fillColor;

    // Cancela cualquier shake/flash previo sobre el MISMO dado (tap repetido antes de que termine la
    // animación anterior) antes de arrancar uno nuevo, para no acumular tweens compitiendo por `x`.
    scene.tweens.killTweensOf(rect);
    rect.setX(originX);

    scene.tweens.add({
      targets: rect,
      x: { from: originX - SHAKE_OFFSET_PX, to: originX + SHAKE_OFFSET_PX },
      duration: SHAKE_SEGMENT_DURATION_MS,
      yoyo: true,
      repeat: SHAKE_REPEATS,
      ease: 'Sine.easeInOut',
      onComplete: () => rect.setX(originX),
    });

    rect.setFillStyle(FLASH_COLOR);
    scene.time.delayedCall(FLASH_DURATION_MS, () => {
      rect.setFillStyle(originFillColor);
    });
  }

  const unsubscribe = rejectionSignal.subscribe(handleRejection);

  return {
    destroy(): void {
      unsubscribe();
    },
  };
}
