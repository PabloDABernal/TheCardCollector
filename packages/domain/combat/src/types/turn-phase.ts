/**
 * NUEVO H3.6. Estado del paso previo gratuito del turno actual del Líder (decisions.md,
 * "Estructura del turno del jugador: paso previo gratis + 2 acciones"). Se resetea a
 * `false` en cada `handleEndTurn` que entrega el turno al Líder — NUNCA aplica al turno
 * de Enemigo (el paso previo es EXCLUSIVO del Líder, la IA no lo usa).
 */
export type LeaderFreeStepState = { readonly takenThisTurn: boolean };
