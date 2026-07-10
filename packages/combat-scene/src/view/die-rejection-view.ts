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

// Claves de `setData`/`getData` propias de esta vista para cachear el color "verdadero" de cada dado
// y la referencia al `delayedCall` de restauración pendiente. Ver el comentario dentro de
// `handleRejection` para el porqué: sin esto, dos rechazos rápidos sobre el mismo dado dejan un
// tinte rojo permanente (el segundo rechazo capturaba como "original" el rojo puesto por el primero).
const TRUE_FILL_COLOR_DATA_KEY = 'dieRejectionTrueFillColor';
const RESTORE_TIMER_DATA_KEY = 'dieRejectionRestoreTimer';

export function createDieRejectionView(scene: Phaser.Scene, rejectionSignal: RejectionSignal): DieRejectionView {
  function handleRejection(event: { readonly dieId: string }): void {
    const obj = findByTargetId(scene, event.dieId);
    if (!obj || !isShakeableRectangle(obj)) return; // defensivo — dado ya no en escena (no debería ocurrir)

    const rect = obj;
    const originX = rect.x;

    // El color "verdadero" se cachea SOLO la primera vez que este dado es rechazado — en rechazos
    // subsiguientes `rect.fillColor` puede ya ser FLASH_COLOR (rojo transitorio de un rechazo previo
    // aún no restaurado), así que recapturarlo cada vez lo confundiría con el color real del dado.
    const cachedTrueColor = rect.getData(TRUE_FILL_COLOR_DATA_KEY) as number | undefined;
    const trueFillColor = cachedTrueColor ?? rect.fillColor;
    rect.setData(TRUE_FILL_COLOR_DATA_KEY, trueFillColor);

    // Cancela cualquier shake/flash previo sobre el MISMO dado (tap repetido antes de que termine la
    // animación anterior) antes de arrancar uno nuevo, para no acumular tweens compitiendo por `x`.
    scene.tweens.killTweensOf(rect);
    rect.setX(originX);

    // Cancela el `delayedCall` de restauración de color de un rechazo previo aún pendiente — sin
    // esto, el restore viejo (programado con el color "original" de ESE tap, no necesariamente el
    // real) puede ejecutarse DESPUÉS del nuevo y dejar el dado con tinte rojo permanente.
    const pendingRestoreTimer = rect.getData(RESTORE_TIMER_DATA_KEY) as Phaser.Time.TimerEvent | undefined;
    pendingRestoreTimer?.remove(false);

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
    const restoreTimer = scene.time.delayedCall(FLASH_DURATION_MS, () => {
      rect.setFillStyle(trueFillColor);
      rect.setData(RESTORE_TIMER_DATA_KEY, undefined);
    });
    rect.setData(RESTORE_TIMER_DATA_KEY, restoreTimer);
  }

  const unsubscribe = rejectionSignal.subscribe(handleRejection);

  return {
    destroy(): void {
      unsubscribe();
    },
  };
}
