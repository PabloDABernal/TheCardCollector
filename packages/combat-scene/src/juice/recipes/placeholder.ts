import type Phaser from 'phaser';
import { LEADER_POSITION, HAND_ROW_POSITION, ENEMY_POSITION, SCENARIO_POSITION, VIEWPORT_CENTER_X } from '../../view/board-layout';

/**
 * H2.5 spec §2 — posiciones fijas de referencia para los placeholders genéricos que las recetas
 * crean cuando todavía no existe (H2.6/H2.8) un game object real de tablero/carta/Núcleo. Viewport
 * virtual 1080×1920 (H2.6 §criterio ScaleManager) — sustituido por posiciones reales cuando H2.8
 * introduzca los sprites del tablero.
 *
 * H4 spec (`docs/specs/H4_layout_fuente_unica.md`) §2.2 — estas posiciones YA NO se definen aquí:
 * se importan de `view/board-layout.ts`, que es la única fuente de verdad de la cadena de derivación
 * de coordenadas de combate. La dirección de dependencia es board-layout → placeholder (nunca al
 * revés), así que no hay ciclo de imports posible.
 */
export const PLACEHOLDER_POSITIONS: Record<string, { x: number; y: number }> = {
  leader: LEADER_POSITION,
  enemy: ENEMY_POSITION,
  scenario: SCENARIO_POSITION,
};

/** Posición por defecto cuando `focusId` no es uno de los 3 roles fijos (p.ej. un
 *  `cardInstanceId`/`allyInstanceId` real todavía sin sprite propio, o `focusId` ausente). */
export const DEFAULT_PLACEHOLDER_POSITION = { x: VIEWPORT_CENTER_X, y: 960 }; // H5.8 §1 — x sigue COMBAT_SCENE_VIEWPORT.width/2, y sin cambio (eje vertical fuera de alcance de H5.8)

/** Posición de "mano/mesa" genérica para placeholders de carta cuyo `focusId` no es uno de los 3
 *  roles fijos (spec §3.2 punto 1). Alias directo de `HAND_ROW_POSITION` (`view/board-layout.ts`) —
 *  H4 spec §2.2, se mantiene el nombre para no romper los usos existentes en este archivo. */
export const CARD_HAND_POSITION = HAND_ROW_POSITION;

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
