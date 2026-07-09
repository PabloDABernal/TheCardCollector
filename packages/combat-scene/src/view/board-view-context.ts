import type { NameLookup } from '@collector/domain-catalog';
import type { AbilityId, CardId, CoreCostRequirement } from '@collector/domain-shared';

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
  /** NUEVO H2.9. `true` si y solo si esta carta EVENTO/EQUIPO tiene un efecto `ATTACK_ENEMY`
   *  (`commands.ts`: "`nucleoInstanceId` es OBLIGATORIO si y solo si `effect.kind === 'ATTACK_ENEMY'`").
   *  Siempre `false` para ALIADO/CONTRATIEMPO (nunca lo necesitan). Calculado UNA VEZ al construir
   *  `BoardViewContext`, vía `cardHasAttackEffect` (`@collector/domain-combat`) — la máquina de
   *  estados de gestos (`interaction/gesture-command-translator.ts`) lee este campo en vez de
   *  reinterpretar `keywords`/`effect` por su cuenta. */
  readonly requiresNucleoInstance: boolean;
}

/** NUEVO H2.10. Dato mínimo de una habilidad (Líder o Enemigo) necesario para pintar su icono de CD —
 *  mismo espíritu de "resuelto una vez desde catálogo" que `HandCardViewData` (H2.8 §0.1). */
export interface AbilityViewData {
  readonly abilityId: AbilityId;
  readonly name: string;
  readonly baseCooldown: number;
  /** NUEVO H3 (spec §5.4) — coste de Núcleo de la habilidad, necesario para que
   *  `GestureCommandTranslator` calcule qué dados de `nucleoTable` son válidos al tocar el icono de
   *  esta habilidad (auto-selección si solo hay 1 dado válido; si no, pide `SELECT_NUCLEO_DIE`). */
  readonly coreCost: CoreCostRequirement;
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
  /** NUEVO H2.10. Las 4 `baseAbilities` del Líder (spec §2.4/§2.5), resueltas una vez desde catálogo. */
  readonly leaderAbilities: readonly AbilityViewData[];
  /** NUEVO H2.10. Las 4 `abilities` del Enemigo (spec §2.4/§2.5), resueltas una vez desde catálogo. */
  readonly enemyAbilities: readonly AbilityViewData[];
}
