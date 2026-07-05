import type { NucleoValue } from './nucleo';

/**
 * Umbral del valor de Núcleo gastado a partir del cual se activa el "efecto extra"
 * de la keyword Umbral — GDD §2.3, §12: "Si el Núcleo gastado es ≥3, efecto extra".
 * 50% de frecuencia en el rango base 1-4 (GDD §12, nota de la tabla).
 */
export const UMBRAL_BONUS_THRESHOLD = 3;

/**
 * Fórmula genérica que consume el valor de un Núcleo gastado para producir un efecto
 * numérico (GDD §12: "Ataque", "Ataque +X", "Ataque ×X"). Deliberadamente agnóstica de
 * a qué contador del juego alimenta el resultado (daño al Líder, movimiento de Trama
 * del Escenario, fichas de Defensa...) — esa asociación es responsabilidad de la
 * definición de la habilidad/carta (H1.8, fuera de alcance) y de quien aplique el
 * resultado (H1.6/H1.18, fuera de alcance) — ver spec H1.5 §0.1/§0.3.
 *
 * - 'VALUE'    → resultado = valor del Núcleo, sin modificar (keyword "Ataque" base).
 * - 'ADD'      → resultado = valor del Núcleo + `amount` (keyword "Ataque +X").
 * - 'MULTIPLY' → resultado = valor del Núcleo × `amount` (keyword "Ataque ×X").
 *
 * Explícitamente NO se modelan variantes de resta/división ("Ataque -X / /X", GDD §12:
 * "Modificadores negativos — Capa futura") — fuera de alcance de H1.5, ver spec §0.3.
 */
export type UmbralFormula =
  | { readonly kind: 'VALUE' }
  | { readonly kind: 'ADD'; readonly amount: number }
  | { readonly kind: 'MULTIPLY'; readonly amount: number };

/**
 * Dato de una habilidad/carta relevante para Umbral: su fórmula base y, opcionalmente,
 * una segunda fórmula que solo se resuelve si se activa el bonus Umbral (≥3, GDD §12).
 * `bonusFormula` reutiliza el mismo tipo `UmbralFormula` — no hay un tipo separado para
 * el "efecto extra"; qué representa ese número en el juego (más daño, escudo, etc.) es
 * dato de contenido (H1.8/H1.9), fuera de alcance aquí — ver spec §0.5.
 *
 * Construido explícitamente por quien llama a `resolveAbilityUmbral` (tests, o más
 * adelante H1.6/H1.18 a partir de `AbilityDefinition`) — NO vive en
 * `CombatEngineConfig`: `CombatEngine` no aplica todavía ningún efecto de habilidad
 * (ver spec §0.1/§0.5).
 */
export interface AbilityUmbralDefinition {
  readonly baseFormula: UmbralFormula;
  readonly bonusFormula?: UmbralFormula;
}

/**
 * Resultado de resolver un `AbilityUmbralDefinition` contra un `NucleoValue` concreto
 * (posiblemente 0 — decisions.md "Piso del valor de Núcleo: permitir 0 como debuff
 * extremo"; ver spec §0.2).
 */
export interface AbilityUmbralResolution {
  /** Valor del Núcleo gastado que alimentó esta resolución. Se repite aquí (en vez de
   *  obligar al caller a recordarlo aparte) para que el resultado sea autocontenido en
   *  logs/tests/UI futura. */
  readonly nucleoValue: NucleoValue;
  /** Resultado de aplicar `baseFormula` — siempre presente, sin condición de Umbral. */
  readonly baseResolvedValue: number;
  /** `true` si `nucleoValue >= UMBRAL_BONUS_THRESHOLD` (GDD §12). Nunca depende de la
   *  fórmula ni de si hay `bonusFormula` definida. */
  readonly bonusActivated: boolean;
  /**
   * Resultado de aplicar `bonusFormula`, solo si `bonusActivated` es `true` Y la
   * definición declaró `bonusFormula`. `undefined` en cualquier otro caso (bonus no
   * activado, o activado pero sin `bonusFormula` — habilidad cuyo "efecto extra" no es
   * numérico, ej. "roba una carta").
   */
  readonly bonusResolvedValue?: number;
}
