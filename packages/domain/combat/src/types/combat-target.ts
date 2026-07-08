import type { CardInstanceId } from '@collector/domain-shared';

/**
 * NUEVO §3.9.2. decisions.md 2026-07-08 ("Vida de Secuaz") punto 1: el jugador elige
 * explícitamente el objetivo de un ataque de un solo objetivo — Enemigo o cualquier
 * Secuaz válido en mesa (referencia explícita: Marvel Champions). Tipo compartido — hoy
 * solo lo usa `PlayableCardEffectDefinition.ATTACK_ENEMY` vía `PLAY_CARD`. Si una
 * historia de contenido futura añade una "habilidad de Ataque" del Líder, debe reutilizar
 * este mismo tipo y el mismo flujo de validación — no inventar un segundo mecanismo de
 * targeting.
 */
export type AttackTarget =
  | { readonly kind: 'ENEMY' }
  | { readonly kind: 'MINION'; readonly minionInstanceId: CardInstanceId };
