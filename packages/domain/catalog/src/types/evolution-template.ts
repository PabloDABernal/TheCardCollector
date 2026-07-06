import type { CardId, EvolutionTemplateId } from '@collector/domain-shared';
import type { CardType } from './card';
import type { KeywordId } from './keyword';

/**
 * GDD §7.2, tabla de plantillas por tipo. Se modela con dos variantes en vez de repetir
 * la unión cruda `CardType | 'Ataque'` del sketch de `architecture_stack.md` §5.2 (que no
 * es un `CardType` real — "Ataque" en esa tabla es un subconjunto de cartas por keyword,
 * no un tipo de carta): `CARD_TYPE` cubre las filas "Equipo"/"Aliado"/"Contratiempo" de
 * la tabla GDD §7.2; `HAS_KEYWORD` cubre "Ataque / Evento de daño" (keyword `ATAQUE`/
 * `ATAQUE_MAS_X`/`ATAQUE_POR_X`) y "Cartas con Trama X" (keyword `TRAMA_X`) sin importar
 * el `CardType` exacto de la carta.
 */
export type EvolutionTemplateTarget =
  | { readonly kind: 'CARD_TYPE'; readonly cardType: CardType }
  | { readonly kind: 'HAS_KEYWORD'; readonly keyword: KeywordId };

/** GDD §7.2, tabla de plantillas — una variante por fila, extensible sin romper nada. */
export type EvolutionEffectSpec =
  | { readonly op: 'INCREASE_DAMAGE'; readonly amount: number }
  | { readonly op: 'DECREASE_ENERGY_COST'; readonly amount: number }
  | { readonly op: 'INCREASE_PLOT_AMOUNT'; readonly amount: number }
  | { readonly op: 'DECREASE_COOLDOWN'; readonly amount: number }
  | { readonly op: 'REMOVE_BACKLASH' }
  | { readonly op: 'INCREASE_ALLY_MAX_HEALTH'; readonly amount: number }
  | { readonly op: 'ALLY_NO_WARMUP_ABILITY' };

/**
 * GDD §7.2: "Puerta abierta explícita... evoluciones únicas escritas a mano por carta...
 * sin rehacer el modelo". `kind: 'BESPOKE'` exige `bespokeCardId` (validado como
 * referencia cruzada contra `cards`, §4.3); `kind: 'TEMPLATE'` exige que `bespokeCardId`
 * esté AUSENTE (una plantilla genérica no apunta a una carta concreta).
 */
export interface EvolutionTemplate {
  readonly id: EvolutionTemplateId;
  readonly name: string;
  readonly target: EvolutionTemplateTarget;
  readonly kind: 'TEMPLATE' | 'BESPOKE';
  readonly bespokeCardId?: CardId;
  readonly effect: EvolutionEffectSpec;
}
