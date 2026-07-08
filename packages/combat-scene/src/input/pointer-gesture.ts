// H2.7 spec §1 — contrato `PointerGesture`: gestos semánticos genéricos de puntero (tap/drag/long-press),
// sin ningún conocimiento de dominio (ver spec §0.1: la traducción a `PlayerIntent` se difiere a H2.8/H2.9).

/** Identificador opaco de "lo que había bajo el puntero" en el momento del `pointerdown` que originó el
 *  gesto. `null` = toque sobre la escena sin ningún game object interactivo debajo (toque "en vacío"). Un
 *  game object interactivo se hace identificable para InputAdapter con
 *  `gameObject.setInteractive().setData('targetId', someOpaqueId)` — InputAdapter nunca interpreta este
 *  valor, solo lo propaga. La semántica de cada targetId (¿es una carta? ¿un Núcleo? ¿un Aliado?) la decide
 *  quien consuma PointerGesture (H2.8/H2.9), no esta capa. */
export type GestureTargetId = string | null;

export interface PointCoords {
  readonly x: number;
  readonly y: number;
}

/** Unión discriminada de gestos clasificados a partir de eventos crudos de `Phaser.Input`. Un único
 *  `pointerdown → ... → pointerup` produce exactamente una de estas dos secuencias, nunca ambas:
 *  - `TAP` (secuencia de 1 evento), o
 *  - `LONG_PRESS` (secuencia de 1 evento, sin TAP posterior al soltar), o
 *  - `DRAG_START` → cero o más `DRAG_MOVE` → `DRAG_END` (secuencia de 2+ eventos).
 *  Ver §1.2 de la spec para la máquina de estados exacta que decide cuál. */
export type PointerGesture =
  | { readonly kind: 'TAP'; readonly targetId: GestureTargetId; readonly point: PointCoords }
  | { readonly kind: 'LONG_PRESS'; readonly targetId: GestureTargetId; readonly point: PointCoords }
  | { readonly kind: 'DRAG_START'; readonly targetId: GestureTargetId; readonly point: PointCoords }
  | {
      readonly kind: 'DRAG_MOVE';
      readonly targetId: GestureTargetId;
      readonly point: PointCoords;
      readonly delta: PointCoords;
    }
  | { readonly kind: 'DRAG_END'; readonly targetId: GestureTargetId; readonly point: PointCoords };

/** Umbrales configurables (spec §1.3), con default de producción documentado en
 *  `DEFAULT_INPUT_ADAPTER_THRESHOLDS`. */
export interface InputAdapterThresholds {
  /** Tiempo mínimo (ms) que el puntero debe permanecer sin superar `longPressMoveTolerancePx` para que
   *  se clasifique como `LONG_PRESS` en vez de `TAP`. Default: 500. */
  readonly longPressMs: number;
  /** Distancia mínima (px, en coordenadas de escena) que el puntero debe recorrer desde el punto de
   *  `pointerdown` para que el gesto deje de considerarse un tap/long-press potencial y se reclasifique
   *  como `DRAG_START`. Default: 10. */
  readonly dragThresholdPx: number;
  /** Tolerancia de movimiento (px) permitida mientras se espera el temporizador de long-press: si el
   *  puntero se mueve más que esto antes de que `longPressMs` transcurra, se cancela el temporizador de
   *  long-press (y, si además supera `dragThresholdPx`, el gesto se reclasifica como drag). Default: 10
   *  (mismo valor que `dragThresholdPx` — un movimiento que ya es "suficiente para ser drag" cancela
   *  igualmente cualquier intento de long-press; no hay razón de diseño para que sean umbrales distintos
   *  en el MVP, pero se exponen como campos separados para permitir ajuste independiente sin cambiar el
   *  contrato si el feel lo pide más adelante). */
  readonly longPressMoveTolerancePx: number;
}

export const DEFAULT_INPUT_ADAPTER_THRESHOLDS: InputAdapterThresholds = {
  longPressMs: 500,
  dragThresholdPx: 10,
  longPressMoveTolerancePx: 10,
};
