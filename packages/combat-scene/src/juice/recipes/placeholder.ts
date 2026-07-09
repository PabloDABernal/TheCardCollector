import type Phaser from 'phaser';

/**
 * H2.5 spec §2 — posiciones fijas de referencia para los placeholders genéricos que las recetas
 * crean cuando todavía no existe (H2.6/H2.8) un game object real de tablero/carta/Núcleo. Viewport
 * virtual 1080×1920 (H2.6 §criterio ScaleManager) — sustituido por posiciones reales cuando H2.8
 * introduzca los sprites del tablero.
 */
// FIX QA post-`6d14b52` — `leader.y` (antes 1700) y `CARD_HAND_POSITION.y` (antes 1600, abajo) se
// recalcularon: el tile REAL del Líder (200×200, `view/role-view.ts`) invadía visualmente el panel
// vecino "Mano" (`view/board-layout.ts` `PANEL_ZONES`/`panel-hand`) — con 1700, el borde superior del
// tile (1700-100=1600) coincidía exactamente con el centro de la fila de Mano. Los valores son el
// resultado de la misma derivación por bounding-box + `CONTENT_GAP_PX` que `view/board-layout.ts` usa
// para `ALLIES_ROW_Y`/`NUCLEO_TABLE_ROW_Y` — no se deriva aquí en runtime porque este archivo es
// importado POR `board-layout.ts`, no al revés (evita un ciclo de imports).
// Ver comentario extenso en `view/board-layout.ts` junto a `LEADER_POSITION`/`HAND_ROW_POSITION`, y
// la cobertura de `board-layout.test.ts` (bounding box de cada tile dentro de su panel).
// FIX visual (feedback Director Creativo en móvil real) — recalculados a 1676/1474 (antes 1708/1498)
// tras bajar `CONTENT_GAP_PX` de 20 a 12 en `view/board-layout.ts` (mismos huecos negros muertos que
// motivaron ese cambio). Misma fórmula, GAP nuevo.
export const PLACEHOLDER_POSITIONS: Record<string, { x: number; y: number }> = {
  leader: { x: 540, y: 1676 },
  enemy: { x: 540, y: 300 },
  scenario: { x: 540, y: 960 },
};

/** Posición por defecto cuando `focusId` no es uno de los 3 roles fijos (p.ej. un
 *  `cardInstanceId`/`allyInstanceId` real todavía sin sprite propio, o `focusId` ausente). */
export const DEFAULT_PLACEHOLDER_POSITION = { x: 540, y: 960 };

/** Posición de "mano/mesa" genérica para placeholders de carta cuyo `focusId` no es uno de los 3
 *  roles fijos (spec §3.2 punto 1). FIX QA post-`6d14b52` — `y` antes 1600, ver comentario extenso
 *  junto a `PLACEHOLDER_POSITIONS.leader` arriba. FIX visual (feedback Director Creativo) — antes
 *  1498, recalculado a 1474 tras bajar `CONTENT_GAP_PX` de 20 a 12. */
export const CARD_HAND_POSITION = { x: 540, y: 1474 };

const GENERIC_PLACEHOLDER_SIZE = 96;
const CARD_PLACEHOLDER_WIDTH = 120;
const CARD_PLACEHOLDER_HEIGHT = 180;
const PLACEHOLDER_COLOR = 0x808080;

interface SceneWithChildrenLookup {
  readonly children: { getByName(name: string): Phaser.GameObjects.Rectangle | null };
  readonly add: {
    rectangle(x?: number, y?: number, width?: number, height?: number, fillColor?: number): Phaser.GameObjects.Rectangle;
  };
}

function resolvePosition(focusId: string | undefined): { x: number; y: number } {
  if (focusId !== undefined && focusId in PLACEHOLDER_POSITIONS) {
    return PLACEHOLDER_POSITIONS[focusId]!;
  }
  return DEFAULT_PLACEHOLDER_POSITION;
}

function resolveCardPosition(focusId: string | undefined): { x: number; y: number } {
  if (focusId !== undefined && focusId in PLACEHOLDER_POSITIONS) {
    return PLACEHOLDER_POSITIONS[focusId]!;
  }
  return CARD_HAND_POSITION;
}

/** Busca un game object ya nombrado `focusId` (`scene.children.getByName`); si no existe, crea un
 *  placeholder genérico (`Rectangle` 96×96, color gris neutro) en la posición conocida para ese rol
 *  (o `DEFAULT_PLACEHOLDER_POSITION` si `focusId` no es uno de los 3 roles fijos). Nunca crea un
 *  duplicado por el mismo nombre dos veces — reutiliza si ya existe (H2.5 spec §2). */
export function resolveOrCreatePlaceholder(
  scene: Phaser.Scene,
  focusId: string | undefined,
): Phaser.GameObjects.Rectangle {
  const sceneLike = scene as unknown as SceneWithChildrenLookup;

  if (focusId !== undefined) {
    const existing = sceneLike.children.getByName(focusId);
    if (existing) {
      return existing;
    }
  }

  const { x, y } = resolvePosition(focusId);
  const rect = sceneLike.add.rectangle(x, y, GENERIC_PLACEHOLDER_SIZE, GENERIC_PLACEHOLDER_SIZE, PLACEHOLDER_COLOR);
  if (focusId !== undefined) {
    (rect as unknown as { setName(name: string): void }).setName(focusId);
  }
  return rect;
}

/** Variante de `resolveOrCreatePlaceholder` para `cardFlip`: placeholder con proporción de carta
 *  (120×180) en vez del cuadrado 96×96 genérico — misma lógica de reuso por nombre (H2.5 spec §2). */
export function resolveOrCreateCardPlaceholder(
  scene: Phaser.Scene,
  focusId: string | undefined,
): Phaser.GameObjects.Rectangle {
  const sceneLike = scene as unknown as SceneWithChildrenLookup;

  if (focusId !== undefined) {
    const existing = sceneLike.children.getByName(focusId);
    if (existing) {
      return existing;
    }
  }

  const { x, y } = resolveCardPosition(focusId);
  const rect = sceneLike.add.rectangle(x, y, CARD_PLACEHOLDER_WIDTH, CARD_PLACEHOLDER_HEIGHT, PLACEHOLDER_COLOR);
  if (focusId !== undefined) {
    (rect as unknown as { setName(name: string): void }).setName(focusId);
  }
  return rect;
}
