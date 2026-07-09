import type Phaser from 'phaser';
import type { TargetingSignal, TargetingPrompt } from '../interaction/targeting-signal';

/**
 * H4 spec H4_componente_carta.md §5.4 — highlight visual sobre los sprites de mesa válidos para el
 * targeting/selección de Núcleo vigente. Se queda en Phaser (co-localizado con el sprite que
 * resalta), a diferencia del TEXTO del prompt (`TargetingPromptBanner.tsx`, HTML). Se suscribe
 * DIRECTAMENTE a `targetingSignal` (no a `bridge`) — sin relación con snapshots de dominio, reacciona
 * solo a cambios de `pending`.
 */
export interface TargetingHighlightView {
  /** Desuscribe de `targetingSignal` y limpia cualquier highlight activo — llamado desde
   *  `CombatScene` en `SHUTDOWN`, mismo criterio de limpieza que el resto de suscripciones. */
  destroy(): void;
}

const HIGHLIGHT_COLOR = 0xd4a24c; // = --foil
const HIGHLIGHT_STROKE_WIDTH = 4;
const PULSE_ALPHA_FROM = 1;
const PULSE_ALPHA_TO = 0.6;
const PULSE_DURATION_MS = 500;

/** Superficie mínima de un game object resaltable — subconjunto de `Phaser.GameObjects.Rectangle`
 *  (único tipo que hoy recibe highlight: rol/Secuaz/dado, todos `Rectangle`s con `setStrokeStyle`). */
interface HighlightableObject extends Phaser.GameObjects.GameObject {
  setStrokeStyle(width: number, color: number): unknown;
  alpha: number;
}

function isHighlightable(obj: Phaser.GameObjects.GameObject): obj is HighlightableObject {
  return typeof (obj as { setStrokeStyle?: unknown }).setStrokeStyle === 'function';
}

/** Resuelve un `id` de `validTargetIds`/`validDieIds` a su game object real — vía
 *  `getData('targetId')`, el MISMO mecanismo que `InputAdapter`/`gesture-command-translator.ts` ya
 *  usan para resolver taps (no todos los sprites de mesa llaman `setName`, ej. los dados de Núcleo
 *  en `nucleo-table-view.ts` — `getData('targetId')` es la superficie uniforme real). */
function findByTargetId(scene: Phaser.Scene, id: string): Phaser.GameObjects.GameObject | undefined {
  return scene.children.list.find((obj) => {
    const getData = (obj as { getData?: (key: string) => unknown }).getData;
    return typeof getData === 'function' && getData.call(obj, 'targetId') === id;
  });
}

function idsFromPrompt(prompt: TargetingPrompt): readonly string[] {
  switch (prompt.kind) {
    case 'AWAITING_ATTACK_TARGET':
      return prompt.validTargetIds;
    case 'AWAITING_NUCLEO_FOR_CARD':
    case 'AWAITING_NUCLEO_FOR_ABILITY':
      return prompt.validDieIds;
    case 'NONE':
    default:
      return [];
  }
}

export function createTargetingHighlightView(scene: Phaser.Scene, targetingSignal: TargetingSignal): TargetingHighlightView {
  let highlighted: readonly HighlightableObject[] = [];

  function clearHighlight(): void {
    for (const obj of highlighted) {
      scene.tweens.killTweensOf(obj);
      obj.alpha = 1;
      obj.setStrokeStyle(0, 0);
    }
    highlighted = [];
  }

  function applyHighlight(prompt: TargetingPrompt): void {
    clearHighlight();
    const ids = idsFromPrompt(prompt);
    if (ids.length === 0) return;

    const objects = ids
      .map((id) => findByTargetId(scene, id))
      .filter((obj): obj is Phaser.GameObjects.GameObject => obj !== undefined)
      .filter(isHighlightable);

    for (const obj of objects) {
      obj.setStrokeStyle(HIGHLIGHT_STROKE_WIDTH, HIGHLIGHT_COLOR);
      scene.tweens.add({
        targets: obj,
        alpha: { from: PULSE_ALPHA_FROM, to: PULSE_ALPHA_TO },
        yoyo: true,
        repeat: -1,
        duration: PULSE_DURATION_MS,
      });
    }
    highlighted = objects;
  }

  applyHighlight(targetingSignal.getState());
  const unsubscribe = targetingSignal.subscribe(applyHighlight);

  return {
    destroy(): void {
      unsubscribe();
      clearHighlight();
    },
  };
}
