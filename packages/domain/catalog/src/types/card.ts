import type { CardId } from '@collector/domain-shared';
import type { KeywordInstance } from './keyword';

/** GDD §3.3. Mismo vocabulario que `architecture_stack.md` §5.2 pero en MAYÚSCULAS,
 *  consistente con el resto de enums del proyecto (`NucleoColor`, `CombatSide`, etc.). */
export type CardType = 'EQUIPO' | 'ALIADO' | 'EVENTO' | 'CONTRATIEMPO';

/**
 * GDD §3.2-§3.3. `cost.energy` es el ÚNICO coste de jugar la carta (decisions.md,
 * "Coste de Energía de las habilidades": solo bajar una carta a mesa/resolver su efecto
 * paga Energía) — no lleva `coreRequirement` (a diferencia del sketch inicial de
 * `architecture_stack.md` §5.2, que predata esa aclaración — ver spec §0.7, punto 1,
 * para la ambigüedad declarada sobre si un Evento con keyword numérica también gasta
 * Núcleo).
 */
export interface CardDefinition {
  readonly id: CardId;
  readonly name: string;
  readonly type: CardType;
  readonly cost: { readonly energy: number };
  readonly keywords: readonly KeywordInstance[];
  /** Referencia opaca a `assets-manifest` (no validada en esta historia — ver spec §0.3,
   *  ese catálogo no es uno de los 5 tipos de H1.8). */
  readonly universeSkin?: string;
}
