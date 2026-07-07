import type { MinionInPlay } from './types/minion';

/**
 * NUEVO H1.16. GDD §3.8: si hay ≥1 Secuaz Defensor vivo en mesa, CUALQUIER ataque
 * dirigido al tablero del Enemigo (contrato futuro, fuera de alcance de esta historia —
 * ver spec H1.16 §0.5) debe resolverse contra él, nunca contra el Enemigo directamente
 * ni contra otro Secuaz. Si hay más de uno (no esperado por contenido, pero no
 * prohibido por tipos), se elige el primero por orden de entrada en mesa —
 * determinista, mismo criterio que el Berserker (H1.15, `resolveDamageTarget`).
 *
 * "No se puede ignorar" (AC) se satisface por CONTRATO de firma: esta función no acepta
 * ningún parámetro para saltarse al Defensor — quien la invoque no tiene forma de pedir
 * "el objetivo elegido por el jugador" si hay un Defensor vivo, exactamente igual que
 * `resolveDamageTarget` (H1.15) no permite ignorar a un Berserker vivo.
 *
 * NO se llama desde ningún `dispatch()` de `CombatEngine` en esta historia — no hay
 * ningún comando hoy que modele "el jugador ataca al tablero enemigo" para conectarla.
 * Forward-declaration, mismo trato que H1.15 dio a `INCREASE_ALLY_MAX_HEALTH`/
 * `ALLY_NO_WARMUP_ABILITY` en `evolution-template.ts`.
 */
export function resolveDefenderMinion(minionsInPlay: readonly MinionInPlay[]): MinionInPlay | null {
  return minionsInPlay.find((m) => m.isDefensor) ?? null;
}
