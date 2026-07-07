import type { NameLookup } from '@collector/domain-catalog';
import type { CardId } from '@collector/domain-shared';

/**
 * Dato mínimo de una carta del pool fijo del Líder (spec H2.8 §0.1) necesario para pintar su tile de
 * mano — NO es `CardDefinition` completa (evita acoplar `combat-scene/view` a todo el esquema de
 * catálogo, igual que `AllyCardDefinition`/`PlayableCardDefinition` en `domain/combat` ya "resuelven"
 * solo lo que su capa necesita en vez de reexportar el catálogo crudo).
 */
export interface HandCardViewData {
  readonly cardId: CardId;
  readonly name: string;
  readonly energyCost: number;
  readonly cardType: 'EVENTO' | 'EQUIPO' | 'ALIADO' | 'CONTRATIEMPO';
}

/**
 * Contexto de presentación resuelto UNA VEZ contra el catálogo (mismo momento/lugar que
 * `buildCombatEngineConfig`, ver `build-default-combat-bridge.ts`) — análogo directo a
 * `RenderContext` de `packages/cli/src/renderer.ts`, reutilizando su mismo `NameLookup` (H2.8 §2.3)
 * en vez de reinventar resolución de nombres.
 */
export interface BoardViewContext {
  readonly nameLookup: NameLookup;
  readonly leaderMaxHealth: number;
  readonly enemyMaxHealth: number;
  readonly scenarioPlotDefeatThreshold: number;
  /** Pool fijo completo del Líder (spec §0.1), en el mismo orden que `leader.cardPoolIds` — orden
   *  estable para que el layout de mano (§3.3) no "salte" entre renders. */
  readonly leaderCardPool: readonly HandCardViewData[];
}
