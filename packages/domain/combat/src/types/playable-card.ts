import type { CardId, NucleoColor } from '@collector/domain-shared';
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
      /** ATAQUE/ATAQUE_MAS_X/ATAQUE_POR_X — daña a `enemyDamage` o a un Secuaz según el
       *  `target` explícito del comando `PLAY_CARD` (§3.9.2/§3.9.3 — targeting del
       *  jugador). `formula` reutiliza `AbilityUmbralDefinition` (H1.5) tal cual — sin
       *  `bonusFormula` en el contenido de esta historia (§0.1.1). */
      readonly kind: 'ATTACK_ENEMY';
      readonly formula: { readonly baseFormula: UmbralFormula; readonly bonusFormula?: UmbralFormula };
      /** NUEVO §3.9.3. Reutiliza la keyword Arrollar ya definida para Aliados/Enemigo.
       *  Solo tiene efecto cuando el `target` resuelto en tiempo de comando es `MINION`
       *  y el golpe mata al Secuaz con exceso de daño. Sin efecto cuando el target es
       *  `ENEMY`. Default false/ausente. */
      readonly arrollar?: boolean;
    }
  | { readonly kind: 'PLOT'; readonly amount: number } // TRAMA_X — siempre DECREASE (§0.1.1)
  | { readonly kind: 'SHIELD'; readonly amount: number } // DEFENSA_X — suma a leaderShield
  | { readonly kind: 'ADD_NUCLEO_DIE'; readonly color: NucleoColor }; // NUEVO H3.4
