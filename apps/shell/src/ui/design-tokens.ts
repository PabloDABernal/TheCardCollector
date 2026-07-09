/**
 * H4 spec §1.2/§1.3 — sistema de diseño real de "The Collector" (sustituye por completo la versión
 * anterior de "grises genéricos" rechazada por el Director Creativo). Fuente de verdad = `tokens.css`
 * (mismo `:root`); este archivo repite los mismos valores literales como constantes TS para los
 * consumidores React/Phaser que necesitan el valor en JS (inline styles, `Phaser.GameObjects.Text`).
 * Sin generación de build adicional — duplicado documentado 1:1, mismo criterio que `board-layout.ts`
 * ya usa para constantes cruzadas entre módulos.
 *
 * Ruptura deliberada respecto a la versión anterior: se retiran `COLOR_MODAL_PANEL`, `COLOR_CARD_BG`,
 * `COLOR_CARD_BG_SELECTED`, `COLOR_CARD_BORDER`, `COLOR_MODAL_BORDER`, `ACCENT_COLORS`, `FONT_FAMILY`,
 * `FONT_SIZE_*`, `RADIUS_MODAL`, `RADIUS_CARD`, `PANEL_BORDER_WIDTH_PX` (duplicado con
 * `board-layout.ts`, se deja solo ahí). Ver tabla de migración en `docs/specs/H4_diseno_real_ui.md` §1.2.
 */

// H4_componente_carta.md §1.2 — `CardIconKind` vive en `apps/shell/src/combat/card/card-icon.ts`
// (módulo puro, sin dependencias) — se importa aquí solo el TIPO, para tipar `CARD_TYPE_COLORS` sin
// crear un ciclo de módulos.
import type { CardIconKind } from '../combat/card/card-icon';

export const COLOR_INK = '#14141a';
export const COLOR_BINDER = '#1f1e26';
export const COLOR_RULE = '#3a3744';
export const COLOR_PARCHMENT = '#ece7de';
export const COLOR_FOIL = '#d4a24c';
export const COLOR_SUCCESS = '#4caf6f';
export const COLOR_DANGER = '#d1495b';

export const COLOR_TEXT_PRIMARY = COLOR_PARCHMENT;
export const COLOR_TEXT_SECONDARY = 'rgba(236, 231, 222, 0.64)';
export const COLOR_TEXT_DISABLED = 'rgba(236, 231, 222, 0.32)';

// Fondo de página/marco de canvas — MISMO gradiente que CombatScreen.css §0.3, reutilizado aquí para
// que RunStartScreen y el marco de combate compartan literalmente el mismo valor.
export const COLOR_PAGE_BACKGROUND =
  'radial-gradient(ellipse at 50% 20%, #1f1e26 0%, #14141a 65%, #0c0c11 100%)';
export const COLOR_OVERLAY = 'rgba(10, 10, 12, 0.78)';

// Acentos temáticos de Núcleo — MISMOS hex que NUCLEO_COLOR_HEX (packages/combat-scene), NUNCA se
// reutiliza --foil aquí: el foil es el acento de acción de la UI, los colores de Núcleo son
// semántica de juego, familias separadas a propósito (grounding, H4 spec §1.1).
export const NUCLEO_ACCENT_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6'] as const;

// H4_componente_carta.md §2 — mismos hex que `NUCLEO_COLOR_HEX` (packages/combat-scene,
// `view/nucleo-colors.ts`) pero en formato CSS string en vez de número Phaser, indexado por
// `NucleoColor` (no por posición round-robin como `NUCLEO_ACCENT_COLORS`) — necesario para el
// círculo de coste de `AbilityTile` (única pieza de esta pasada donde el mapeo de color de Núcleo
// SÍ aplica, ver spec §1.1).
export const NUCLEO_COLOR_HEX_CSS: Record<import('@collector/domain-shared').NucleoColor, string> = {
  AGRESION: '#e74c3c',
  CONTROL: '#3498db',
  DEFENSA: '#2ecc71',
  RECURSO: '#f1c40f',
  CAOS: '#9b59b6',
};

export const FONT_DISPLAY = "'Staatliches', 'Impact', sans-serif";
export const FONT_UI = "'Manrope', system-ui, -apple-system, sans-serif";
export const FONT_MONO = "'JetBrains Mono', 'IBM Plex Mono', monospace";

// Escala tipográfica — reemplaza los 3 FONT_SIZE_* sueltos anteriores (H4 spec §1.3).
export const TYPE = {
  displayLg: { fontFamily: FONT_DISPLAY, fontSize: '32px', letterSpacing: '0.02em' },
  displaySm: { fontFamily: FONT_DISPLAY, fontSize: '20px', letterSpacing: '0.02em' },
  bodyMd: { fontFamily: FONT_UI, fontSize: '15px', fontWeight: 400 },
  bodySm: { fontFamily: FONT_UI, fontSize: '13px', fontWeight: 400 },
  labelUpper: {
    fontFamily: FONT_UI,
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  dataMd: { fontFamily: FONT_MONO, fontSize: '15px', fontVariantNumeric: 'tabular-nums' },
  dataLg: { fontFamily: FONT_MONO, fontSize: '22px', fontVariantNumeric: 'tabular-nums' },
} as const;

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const; // base-4, alias legible
export const RADIUS_PANEL = 12;
export const RADIUS_CHIP = 10;
export const SHADOW_PANEL = '0 2px 8px rgba(0, 0, 0, 0.4)';
export const SHADOW_MODAL = '0 20px 60px rgba(0, 0, 0, 0.6)';
export const MIN_TAP_TARGET_PX = 44; // criterio de aceptación H4.1, botones/tarjetas táctiles

// H4_componente_carta.md §1.2 — color de borde/acento por tipo de carta, familia PROPIA, NUNCA
// `NUCLEO_COLOR_HEX` (§1.1: `CardDefinition.cost` es solo Energía, el color de Núcleo pertenece a
// `AbilityDefinition.coreCost`). Elegidos por contraste entre sí y legibilidad sobre `--binder`, sin
// pisar `--foil` (reservado a selección/acento de acción) ni `--success`/`--danger` (semántica de
// sistema).
export const CARD_TYPE_COLORS: Record<CardIconKind, string> = {
  ATAQUE: '#b5482f', // terracota — cálido, distinto de --danger (#d1495b) para no leerse como alerta
  TRAMA: '#6a5a8c', // violeta apagado
  EQUIPO: '#4c7a8c', // acero azulado
  ALIADO: '#5c8c5a', // verde apagado, distinto de --success
  CONTRATIEMPO: '#8c7a4c', // ocre
};
