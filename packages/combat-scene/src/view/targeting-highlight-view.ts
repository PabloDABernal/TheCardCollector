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
// FIX crítico (review post-marco redondeado) — el glow ya NO se dibuja llamando `setStrokeStyle`
// sobre el `Rectangle` base de rol/dado: ese `Rectangle` ahora lleva un `GeometryMask` redondeado
// (`role-view.ts`/`nucleo-table-view.ts`) del MISMO tamaño que el propio `Rectangle`, así que la
// mitad exterior de cualquier stroke centrado en su borde quedaba recortada por la máscara, y la
// mitad interior superviviente quedaba debajo del `Graphics` de borde temático (`--rule`, opaco,
// creado DESPUÉS del `rect` en la display list). Resultado: highlight invisible. Ahora el glow es un
// `Graphics` propio, creado aparte y con `setDepth` explícito por encima de sombra+máscara+borde+fill
// de cualquier tile — nunca vuelve a depender del orden de inserción de decoración futura.
const HIGHLIGHT_PADDING_PX = 2; // el glow se dibuja ligeramente por fuera del borde --rule, nunca lo solapa
const HIGHLIGHT_DEPTH = 1000;
const PULSE_ALPHA_FROM = 1;
const PULSE_ALPHA_TO = 0.6;
const PULSE_DURATION_MS = 500;

/** Superficie mínima de un game object resaltable — cualquier sprite de mesa (rol/Secuaz/dado de
 *  Núcleo) con posición y tamaño propios más el radio de esquina que usó al crear su `GeometryMask`
 *  (`highlightRadius` en `data`, mismo mecanismo de `setData` que ya usa `targetId` — ver
 *  `role-view.ts`/`nucleo-table-view.ts`). Ya NO requiere `setStrokeStyle`: el glow no toca el
 *  `Rectangle` original, solo lee su geometría para dibujar un `Graphics` separado encima. */
interface HighlightableObject extends Phaser.GameObjects.GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  getData(key: string): unknown;
}

function isHighlightable(obj: Phaser.GameObjects.GameObject): obj is HighlightableObject {
  const candidate = obj as Partial<HighlightableObject> & { getData?: unknown };
  return (
    typeof candidate.x === 'number' &&
    typeof candidate.y === 'number' &&
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number' &&
    typeof candidate.getData === 'function'
  );
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
  let highlighted: readonly Phaser.GameObjects.Graphics[] = [];

  function clearHighlight(): void {
    for (const glow of highlighted) {
      scene.tweens.killTweensOf(glow);
      glow.destroy();
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

    highlighted = objects.map((obj) => {
      const radius = Number(obj.getData('highlightRadius')) || 0;
      const glow = scene.add.graphics();
      glow.setDepth(HIGHLIGHT_DEPTH);
      glow.lineStyle(HIGHLIGHT_STROKE_WIDTH, HIGHLIGHT_COLOR, 1);
      glow.strokeRoundedRect(
        obj.x - obj.width / 2 - HIGHLIGHT_PADDING_PX,
        obj.y - obj.height / 2 - HIGHLIGHT_PADDING_PX,
        obj.width + HIGHLIGHT_PADDING_PX * 2,
        obj.height + HIGHLIGHT_PADDING_PX * 2,
        radius + HIGHLIGHT_PADDING_PX,
      );
      scene.tweens.add({
        targets: glow,
        alpha: { from: PULSE_ALPHA_FROM, to: PULSE_ALPHA_TO },
        yoyo: true,
        repeat: -1,
        duration: PULSE_DURATION_MS,
      });
      return glow;
    });
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
