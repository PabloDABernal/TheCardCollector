import type { CardId } from '@collector/domain-shared';
import type { UmbralFormula } from './umbral';

/**
 * NUEVO H1.18. Dato de una carta jugable vía `PLAY_CARD` relevante para el motor —
 * mismo patrón "mirror resuelto externamente" que `AllyCardDefinition`/
 * `ContratiempoCardDefinition` (H1.14/H1.15). Cubre EXCLUSIVAMENTE cartas de tipo
 * EVENTO/EQUIPO del catálogo (ALIADO/CONTRATIEMPO ya tienen su propio comando —
 * `PLAY_ALLY`/`PLAY_CONTRATIEMPO` — y su propio mapa de config; una carta no debe
 * aparecer en más de un mapa, ver spec §0.1 punto 3).
 */
export interface PlayableCardDefinition {
  readonly energyCost: number;
  /** Ausente = carta sin efecto numérico ejecutable hoy (p. ej. solo NEUTRO) — se
   *  puede jugar (paga Energía, consume 1 acción) pero no muta ningún contador. */
  readonly effect?: PlayableCardEffectDefinition;
}

/**
 * Ver spec H1.18 §0.1/§0.1.1 para el mapeo completo keyword de catálogo → esta unión.
 * Una carta nunca tiene más de un `kind` — mismo invariante que `AbilityEffectDefinition`
 * (H1.6, "una habilidad nunca hace ambas cosas").
 */
export type PlayableCardEffectDefinition =
  | {
      /** ATAQUE/ATAQUE_MAS_X/ATAQUE_POR_X — daña directamente a `enemyDamage` (§0.2:
       *  nunca se redirige a un Secuaz). `formula` reutiliza `AbilityUmbralDefinition`
       *  (H1.5) tal cual — sin `bonusFormula` en el contenido de esta historia (§0.1.1). */
      readonly kind: 'ATTACK_ENEMY';
      readonly formula: { readonly baseFormula: UmbralFormula; readonly bonusFormula?: UmbralFormula };
    }
  | { readonly kind: 'PLOT'; readonly amount: number } // TRAMA_X — siempre DECREASE (§0.1.1)
  | { readonly kind: 'SHIELD'; readonly amount: number }; // DEFENSA_X — suma a leaderShield
