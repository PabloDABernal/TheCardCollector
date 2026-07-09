import type Phaser from 'phaser';

/**
 * Helper compartido (extraído tras review post-marco-redondeado) del patrón "sombra + máscara +
 * borde" que `role-view.ts` (tiles de rol) y `nucleo-table-view.ts` (dados de mesa) duplicaban
 * casi literalmente. Un único punto de verdad para el ORDEN de creación (sombra → rect → máscara →
 * borde) que garantiza que el pulso de `targeting-highlight-view.ts` siga funcionando: ese módulo ya
 * NO toca ni la sombra ni el borde ni el `Rectangle` que esta función devuelve — dibuja su glow en un
 * `Graphics` propio con `setDepth` explícito, así que el orden aquí ya no es una condición de
 * z-fighting con targeting, solo de estética decorativa (sombra detrás del fill, borde encima).
 *
 * `rect.setData('highlightRadius', radius)` es la única pieza de contrato entre esta decoración y
 * `targeting-highlight-view.ts` — le expone el radio de esquina que usó el `GeometryMask` para que el
 * glow dibuje el mismo redondeado sin tener que importar `role-view.ts`/`nucleo-table-view.ts`.
 */
export interface RoundedFrameOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fillColor: number;
  readonly radius: number;
  readonly borderColor: number;
  readonly borderWidthPx: number;
  readonly shadowColor: number;
  readonly shadowAlpha: number;
  readonly shadowOffsetPx: number;
}

/** Crea el `Rectangle` de fill (con `GeometryMask` redondeado) más su sombra y borde decorativos
 *  estáticos. Devuelve SOLO el `Rectangle` — sombra/máscara/borde quedan colgados de la escena, sin
 *  referencia expuesta, mismo criterio que ya tenían `role-view.ts`/`nucleo-table-view.ts` antes de
 *  esta extracción (ninguno de los dos los reutilizaba más allá de crearlos). El caller sigue siendo
 *  responsable de `setName`/`setInteractive`/`setData('targetId', ...)`/`setAlpha` — este helper NO
 *  asume nada sobre interactividad, solo decoración visual. */
export function createRoundedFrameRectangle(scene: Phaser.Scene, options: RoundedFrameOptions): Phaser.GameObjects.Rectangle {
  const { x, y, width, height, fillColor, radius, borderColor, borderWidthPx, shadowColor, shadowAlpha, shadowOffsetPx } = options;

  // 1) Sombra — Graphics decorativo estático detrás del tile, offset abajo-derecha.
  const shadow = scene.add.graphics();
  shadow.fillStyle(shadowColor, shadowAlpha);
  shadow.fillRoundedRect(x + shadowOffsetPx - width / 2, y + shadowOffsetPx - height / 2, width, height, radius);

  // 2) El Rectangle real.
  const rect = scene.add.rectangle(x, y, width, height, fillColor);
  rect.setData('highlightRadius', radius);

  // 3) GeometryMask redondeado — recorta el fill del Rectangle en esquinas redondeadas.
  const maskShape = scene.add.graphics();
  maskShape.fillStyle(0xffffff);
  maskShape.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
  maskShape.setVisible(false);
  rect.setMask(maskShape.createGeometryMask());

  // 4) Borde temático — Graphics decorativo estático encima, redondeado.
  const border = scene.add.graphics();
  border.lineStyle(borderWidthPx, borderColor, 1);
  border.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius);

  return rect;
}
