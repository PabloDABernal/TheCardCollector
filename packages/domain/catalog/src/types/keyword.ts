/**
 * Vocabulario cerrado de GDD §12, EXCLUYENDO 'Evolucionado' — esa keyword es un marcador
 * de estado de RUN aplicado por la mecánica de evolución (GDD §7.2/§12), nunca un dato
 * autorado en una `CardDefinition` estática; no pertenece a este catálogo de contenido.
 * Metadato descriptivo (ver spec §0.7, punto 1) — desacoplado de si el efecto numérico
 * ya está modelado ejecutable en `domain/combat`.
 */
export type KeywordId =
  | 'ATAQUE'
  | 'ATAQUE_MAS_X'
  | 'ATAQUE_POR_X'
  | 'CAOS'
  | 'TRAMA_X'
  | 'DEFENSA_X'
  | 'UMBRAL'
  | 'COMBO'
  | 'ARROLLAR'
  | 'DEFENSOR'
  | 'BERSERKER'
  | 'NEUTRO'
  | 'DESHACER_DANO'   // NUEVO H1.14 — GDD §2.7, alcance DAMAGE_ONLY
  | 'DESHACER_TURNO'; // NUEVO H1.14 — GDD §2.7, alcance FULL_TURN

/** Keywords que EXIGEN `amount` (entero >= 0, mismo piso que H1.6 "modificadores
 *  negativos, capa futura"). El resto EXIGE que `amount` esté ausente. */
export const KEYWORDS_REQUIRING_AMOUNT: readonly KeywordId[] = [
  'ATAQUE_MAS_X',
  'ATAQUE_POR_X',
  'TRAMA_X',
  'DEFENSA_X',
];

export interface KeywordInstance {
  readonly keyword: KeywordId;
  readonly amount?: number;
}

/**
 * NUEVO H1.14. Exactamente una de estas dos DEBE estar presente si y solo si
 * `CardDefinition.type === 'CONTRATIEMPO'` — ver validación cruzada en schema.ts y
 * spec H1.14 §0.5.
 */
export const CONTRATIEMPO_SCOPE_KEYWORDS: readonly KeywordId[] = ['DESHACER_DANO', 'DESHACER_TURNO'];
