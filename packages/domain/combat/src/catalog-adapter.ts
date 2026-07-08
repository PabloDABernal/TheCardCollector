import type { RandomSource } from '@collector/domain-shared';
import type { Catalog, LeaderDefinition, EnemyDefinition, ScenarioDefinition, CardDefinition } from '@collector/domain-catalog';
import type { AbilityDefinition } from '@collector/domain-catalog';
import type { KeywordId } from '@collector/domain-catalog';
import type { CombatEngineConfig } from './types/config';
import type { CombatSide } from './types/turn';
import type { AbilityId, CardId, CoreCostRequirement } from '@collector/domain-shared';
import type { AbilityCooldownDefinition } from './types/cooldown';
import type { AbilityEffectDefinition } from './types/ability-effect';
import type { PlayableCardDefinition, PlayableCardEffectDefinition } from './types/playable-card';
import type { AllyCardDefinition } from './types/ally';
import type { ContratiempoCardDefinition } from './types/contratiempo';
import type { EnemyAbilityAiProfile } from './types/enemy-ai';
import type { DramaturgiaCardDefinition } from '@collector/domain-catalog';
import type { AlternativeVictoryCondition } from './types/victory-condition';

/**
 * H1.19 §2.1 — ver spec para el contrato completo. `packages/cli` (H1.19) es hoy el
 * único consumidor; H2 (Phaser/React) reutilizará esta misma función sin duplicarla
 * (ver spec H1.19 §0.2).
 */
export interface BuildCombatEngineConfigParams {
  readonly catalog: Catalog;
  readonly leader: LeaderDefinition;
  readonly enemy: EnemyDefinition;
  readonly scenario: ScenarioDefinition;
  readonly randomSource: RandomSource;
  /** Default 'LEADER' — mismo default que CombatEngineConfig.initialTurnOwner. */
  readonly initialTurnOwner?: CombatSide;
}

/**
 * Ensambla un `CombatEngineConfig` completo a partir de un `Catalog` ya cargado
 * (`CatalogLoader.load()`) y 3 entidades concretas ya resueltas (Líder, Enemigo,
 * Escenario) — mismo nivel de "ya resuelto" que exige `CombatEngineConfig` para
 * `leaderMaxHealth`/`scenarioPlotDefeatThreshold` (H1.18 §0.3/§0.4). Activa SIEMPRE el
 * turno de IA automático (`enemyAbilityAiProfiles`/`dramaturgiaDeck` nunca vacíos) — no
 * hay ningún caso de uso de este adaptador que quiera un Enemigo sin IA.
 *
 * No valida referencias cruzadas (cardId inexistente, etc.) — esa validación YA ocurrió
 * en `CatalogLoader.load()` (H1.8 §4) antes de que `catalog` llegue aquí; un `Catalog`
 * bien formado por contrato nunca puede producir una referencia rota en este adaptador.
 */
export function buildCombatEngineConfig(params: BuildCombatEngineConfigParams): CombatEngineConfig {
  const { catalog, leader, enemy, scenario, randomSource } = params;

  const abilityCoreCosts = new Map<AbilityId, CoreCostRequirement>();
  const abilityCooldowns = new Map<AbilityId, AbilityCooldownDefinition>();
  const abilityEffects = new Map<AbilityId, AbilityEffectDefinition>();

  addAbilities(leader.baseAbilities, 'LEADER', abilityCoreCosts, abilityCooldowns, abilityEffects);
  addAbilities(enemy.abilities, 'ENEMY', abilityCoreCosts, abilityCooldowns, abilityEffects);

  const playableCards = new Map<CardId, PlayableCardDefinition>();
  const allyCards = new Map<CardId, AllyCardDefinition>();
  const contratiempoCards = new Map<CardId, ContratiempoCardDefinition>();

  for (const cardId of leader.cardPoolIds) {
    const card = catalog.cards.get(cardId) as CardDefinition; // garantizado por CatalogLoader (§4 H1.8)
    switch (card.type) {
      case 'EVENTO':
      case 'EQUIPO':
        playableCards.set(cardId, buildPlayableCardDefinition(card));
        break;
      case 'ALIADO':
        allyCards.set(cardId, buildAllyCardDefinition(card));
        break;
      case 'CONTRATIEMPO':
        contratiempoCards.set(cardId, buildContratiempoCardDefinition(card));
        break;
    }
  }

  const enemyAbilityAiProfiles = new Map<AbilityId, EnemyAbilityAiProfile>(
    enemy.abilities.map((a) => [a.id, a.aiProfile])
  );
  // MODIFICADO H1.16 (rediseño) — la carta COMPLETA, no solo el icono (§3.4).
  const dramaturgiaDeck: DramaturgiaCardDefinition[] = [...enemy.dramaturgiaDeck, ...scenario.dramaturgiaDeck];

  // NUEVO H3.6 — MVP: el mazo de combate del Líder es su pool completo de cartas (§2.9).
  const leaderDeckCardIds: CardId[] = [...leader.cardPoolIds];

  // NUEVO H1.8+H1.18 — merge Enemigo + Escenario (§4.3).
  const alternativeVictoryConditions: AlternativeVictoryCondition[] = [
    ...(enemy.alternativeVictoryConditions ?? []),
    ...(scenario.alternativeVictoryConditions ?? []),
  ];

  return {
    randomSource,
    initialTurnOwner: params.initialTurnOwner ?? 'LEADER',
    abilityCoreCosts,
    abilityCooldowns,
    abilityEffects,
    playableCards,
    allyCards,
    contratiempoCards,
    enemyAbilityAiProfiles,
    dramaturgiaDeck,
    enemyPhases: enemy.phases,
    scenarioPhases: scenario.phases,
    enemyMaxHealth: enemy.maxHealth,
    leaderMaxHealth: leader.maxHealth,
    scenarioPlotDefeatThreshold: Math.max(...scenario.plotThresholds.map((t) => t.atLeast)),
    minionDefinitions: new Map(),
    leaderDeckCardIds,
    alternativeVictoryConditions,
  };
}

/**
 * Ver spec §2.2.a. `ability.effect` (`CatalogAbilityEffect`) es estructuralmente
 * idéntico a `AbilityEffectDefinition` (mismas 2 variantes ATTACK/PLOT, mismos 3 `kind`
 * de fórmula Umbral) — se asigna directamente (cast estructural, sin conversión de
 * campos), documentado como intencional desde H1.18 §0.1.1.
 */
function addAbilities(
  abilities: readonly AbilityDefinition[],
  side: CombatSide,
  abilityCoreCosts: Map<AbilityId, CoreCostRequirement>,
  abilityCooldowns: Map<AbilityId, AbilityCooldownDefinition>,
  abilityEffects: Map<AbilityId, AbilityEffectDefinition>
): void {
  for (const ability of abilities) {
    abilityCoreCosts.set(ability.id, ability.coreCost);
    abilityCooldowns.set(ability.id, { side, baseCooldown: ability.baseCooldown });
    if (ability.effect) {
      abilityEffects.set(ability.id, ability.effect as AbilityEffectDefinition);
    }
  }
}

/** Ver spec §2.2.b. */
function buildPlayableCardDefinition(card: CardDefinition): PlayableCardDefinition {
  const effect = resolveKeywordEffect(card);
  return { energyCost: card.cost.energy, ...(effect ? { effect } : {}) };
}

/** NUEVO H2.9 (spec §4.2.1). `true` si `card.keywords` contiene alguna keyword de ataque —
 *  exactamente el mismo vocabulario que `resolveKeywordEffect` ya usa para producir
 *  `{ kind: 'ATTACK_ENEMY', ... }`. Pura, sin side-effects, reutilizable fuera de
 *  `domain/combat` sin exponer `resolveKeywordEffect` completo (que construye la fórmula,
 *  no solo el booleano). */
const ATTACK_KEYWORDS: readonly KeywordId[] = ['ATAQUE', 'ATAQUE_MAS_X', 'ATAQUE_POR_X'];

export function cardHasAttackEffect(card: CardDefinition): boolean {
  return card.keywords.some((k) => ATTACK_KEYWORDS.includes(k.keyword));
}

function resolveKeywordEffect(card: CardDefinition): PlayableCardEffectDefinition | undefined {
  const found: PlayableCardEffectDefinition[] = [];

  if (cardHasAttackEffect(card)) {
    for (const k of card.keywords) {
      switch (k.keyword) {
        case 'ATAQUE':
          found.push({ kind: 'ATTACK_ENEMY', formula: { baseFormula: { kind: 'VALUE' } } });
          break;
        case 'ATAQUE_MAS_X':
          found.push({
            kind: 'ATTACK_ENEMY',
            formula: { baseFormula: { kind: 'ADD', amount: k.amount as number } },
          });
          break;
        case 'ATAQUE_POR_X':
          found.push({
            kind: 'ATTACK_ENEMY',
            formula: { baseFormula: { kind: 'MULTIPLY', amount: k.amount as number } },
          });
          break;
        default:
          break;
      }
    }
  }

  for (const k of card.keywords) {
    switch (k.keyword) {
      case 'TRAMA_X':
        found.push({ kind: 'PLOT', amount: k.amount as number });
        break;
      case 'DEFENSA_X':
        found.push({ kind: 'SHIELD', amount: k.amount as number });
        break;
      default:
        break;
    }
  }

  if (found.length > 1) {
    throw new Error(`buildPlayableCardDefinition: carta ${card.id} tiene más de un efecto numérico de PLAY_CARD`);
  }
  return found[0];
}

/** Ver spec §2.2.b. `VIDA_X` siempre presente en ALIADO (H1.12). */
function buildAllyCardDefinition(card: CardDefinition): AllyCardDefinition {
  const life = card.keywords.find((k) => k.keyword === 'VIDA_X')?.amount as number;
  const isBerserker = card.keywords.some((k) => k.keyword === 'BERSERKER');
  return { energyCost: card.cost.energy, life, isBerserker };
}

/** Ver spec §2.2.b. Exactamente una de DESHACER_DANO/DESHACER_TURNO está presente
 *  (invariante ya validada por parseCardDefinition, H1.14 §0.5). */
function buildContratiempoCardDefinition(card: CardDefinition): ContratiempoCardDefinition {
  const undoScope = card.keywords.some((k) => k.keyword === 'DESHACER_TURNO') ? 'FULL_TURN' : 'DAMAGE_ONLY';
  return { energyCost: card.cost.energy, undoScope };
}
