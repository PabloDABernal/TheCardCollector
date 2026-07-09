/**
 * H4 spec §1.2 — sistema de diseño compartido de `apps/shell` (E4.1 + E4.4). Único punto de verdad
 * de color/tipografía para `RunStartModal` (§1) y `CombatHud` (§4), evitando dos paletas divergentes
 * entre pantallas React. Los valores de acento (`ACCENT_COLORS`) reutilizan los MISMOS hex que
 * `NUCLEO_COLOR_HEX` de `packages/combat-scene/src/view/nucleo-colors.ts` (en notación CSS) para que
 * el jugador asocie visualmente "colores de dado" entre Run Start y Combate.
 */

// Fondo de página — degradado radial, nunca negro plano sin variación (causa raíz de la queja).
export const COLOR_PAGE_BACKGROUND =
  'radial-gradient(circle at 50% 15%, #1c1c28 0%, #0a0a0c 70%)';

export const COLOR_OVERLAY = 'rgba(0, 0, 0, 0.72)'; // backdrop detrás del panel modal
export const COLOR_MODAL_PANEL = '#1e1e24'; // panel del popup
export const COLOR_MODAL_BORDER = '#3a3a42';
export const COLOR_CARD_BG = '#2a2a32';
export const COLOR_CARD_BG_SELECTED = '#34343f';
export const COLOR_CARD_BORDER = '#44444e';

export const COLOR_TEXT_PRIMARY = '#f5f5f5';
export const COLOR_TEXT_SECONDARY = '#a0a0a8';
export const COLOR_TEXT_DISABLED = '#5c5c66';

// Acentos temáticos — MISMOS valores hex que `NUCLEO_COLOR_HEX` de
// `packages/combat-scene/src/view/nucleo-colors.ts` en notación CSS, para que el jugador asocie
// visualmente "colores de dado" entre Run Start y Combate sin duplicar una paleta nueva sin
// relación. Reutilizados aquí como acentos decorativos de tarjeta (round-robin), no como dato de
// dominio.
export const ACCENT_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6'] as const;

export const FONT_FAMILY = "'Segoe UI', system-ui, -apple-system, sans-serif"; // sin fuente nueva a cargar
export const FONT_SIZE_TITLE = '24px';
export const FONT_SIZE_SECTION_TITLE = '16px';
export const FONT_SIZE_CARD_LABEL = '16px';

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const RADIUS_MODAL = 20;
export const RADIUS_CARD = 12;
export const MIN_TAP_TARGET_PX = 44; // criterio de aceptación H4.1, botones/tarjetas táctiles

// Valor CSS del mismo hex que `PANEL_BORDER_COLOR`/`PANEL_BORDER_WIDTH_PX` de
// `packages/combat-scene/src/view/board-layout.ts` (E4.2) — reutilizado por `CombatHud` (E4.4) para
// que el borde del HUD sea coherente con los paneles de combate.
export const PANEL_BORDER_WIDTH_PX = 2;
