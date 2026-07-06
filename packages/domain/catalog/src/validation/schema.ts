import { isRecord, isNonEmptyString, isNonNegativeInteger, isPositiveInteger, isStringArray, fail } from './primitives';
import {
  createId,
  ALL_NUCLEO_COLORS,
  type AbilityId,
  type CardId,
  type CoreCostRequirement,
  type NucleoColor,
} from '@collector/domain-shared';
import type { CardDefinition, CardType } from '../types/card';
import type { KeywordInstance } from '../types/keyword';
import { CONTRATIEMPO_SCOPE_KEYWORDS, KEYWORDS_REQUIRING_AMOUNT, type KeywordId } from '../types/keyword';
import type {
  AbilityDefinition,
  CatalogAbilityEffect,
  CatalogUmbralDefinition,
  CatalogUmbralFormula,
} from '../types/ability';
import { CATALOG_ABILITY_BASE_COOLDOWN_MIN } from '../types/ability';
import type { LeaderDefinition, LevelUpEffectSpec, LevelUpOption } from '../types/leader';
import type { EnemyAbilityAiProfile, EnemyAbilityDefinition, EnemyDefinition } from '../types/enemy';
import type { DramaturgiaCardDefinition } from '../types/dramaturgia-card';
import type { PhaseChangeCondition, PhaseDefinition } from '../types/phase';
import type { ScenarioDefinition, ScenarioPassiveEffect, ScenarioPlotThreshold } from '../types/scenario';
import type { EvolutionEffectSpec, EvolutionTemplate, EvolutionTemplateTarget } from '../types/evolution-template';

const CARD_TYPES: readonly CardType[] = ['EQUIPO', 'ALIADO', 'EVENTO', 'CONTRATIEMPO'];
const KEYWORD_IDS: readonly KeywordId[] = [
  'ATAQUE', 'ATAQUE_MAS_X', 'ATAQUE_POR_X', 'CAOS', 'TRAMA_X', 'DEFENSA_X',
  'UMBRAL', 'COMBO', 'ARROLLAR', 'DEFENSOR', 'BERSERKER', 'NEUTRO',
  'DESHACER_DANO', 'DESHACER_TURNO', // NUEVO H1.14
  'VIDA_X', // NUEVO H1.15
];

// ---------------------------------------------------------------------------
// CardDefinition
// ---------------------------------------------------------------------------

export function parseCardDefinition(raw: unknown, context: string): CardDefinition {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');

  if (!isNonEmptyString(raw.id)) fail(context, 'campo "id" ausente o no es un string no vacío');
  if (!isNonEmptyString(raw.name)) fail(context, 'campo "name" ausente o no es un string no vacío');
  if (!CARD_TYPES.includes(raw.type as CardType)) {
    fail(context, `campo "type" debe ser uno de ${CARD_TYPES.join('|')}, recibido ${String(raw.type)}`);
  }
  if (!isRecord(raw.cost) || !isNonNegativeInteger(raw.cost.energy)) {
    fail(context, 'campo "cost.energy" ausente o no es un entero >= 0');
  }
  if (!Array.isArray(raw.keywords)) fail(context, 'campo "keywords" ausente o no es un array');

  const keywords: KeywordInstance[] = raw.keywords.map((k, i) =>
    parseKeywordInstance(k, `${context}.keywords[${i}]`)
  );

  // NUEVO H1.14 — GDD §2.7, ver spec §0.5: exactamente 1 keyword de alcance si y solo si
  // type === 'CONTRATIEMPO'.
  const scopeKeywords = keywords.filter((k) => CONTRATIEMPO_SCOPE_KEYWORDS.includes(k.keyword));
  if (raw.type === 'CONTRATIEMPO') {
    if (scopeKeywords.length !== 1) {
      fail(
        context,
        `type CONTRATIEMPO exige exactamente 1 keyword de alcance (${CONTRATIEMPO_SCOPE_KEYWORDS.join('|')}), encontradas ${scopeKeywords.length} (GDD §2.7)`
      );
    }
  } else if (scopeKeywords.length > 0) {
    fail(
      context,
      `keyword(s) ${scopeKeywords.map((k) => k.keyword).join(',')} solo son válidas en cartas type CONTRATIEMPO (GDD §2.7), pero esta carta es type ${String(raw.type)}`
    );
  }

  // NUEVO H1.15 — GDD §3.7, ver spec §0.5: exactamente 1 VIDA_X si y solo si type === 'ALIADO'.
  const lifeKeywords = keywords.filter((k) => k.keyword === 'VIDA_X');
  if (raw.type === 'ALIADO') {
    if (lifeKeywords.length !== 1) {
      fail(
        context,
        `type ALIADO exige exactamente 1 keyword VIDA_X, encontradas ${lifeKeywords.length} (GDD §3.7)`
      );
    }
  } else if (lifeKeywords.length > 0) {
    fail(
      context,
      `keyword VIDA_X solo es válida en cartas type ALIADO (GDD §3.7), pero esta carta es type ${String(raw.type)}`
    );
  }

  if (raw.universeSkin !== undefined && typeof raw.universeSkin !== 'string') {
    fail(context, 'campo "universeSkin", si está presente, debe ser un string');
  }

  return {
    id: createId<'CardId'>('CardId', raw.id) as CardId,
    name: raw.name,
    type: raw.type as CardType,
    cost: { energy: raw.cost.energy },
    keywords,
    ...(raw.universeSkin !== undefined ? { universeSkin: raw.universeSkin } : {}),
  };
}

function parseKeywordInstance(raw: unknown, context: string): KeywordInstance {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (!KEYWORD_IDS.includes(raw.keyword as KeywordId)) {
    fail(context, `campo "keyword" debe ser uno de ${KEYWORD_IDS.join('|')}, recibido ${String(raw.keyword)}`);
  }
  const requiresAmount = KEYWORDS_REQUIRING_AMOUNT.includes(raw.keyword as KeywordId);
  if (requiresAmount && !isNonNegativeInteger(raw.amount)) {
    fail(context, `keyword "${String(raw.keyword)}" exige "amount" entero >= 0`);
  }
  if (!requiresAmount && raw.amount !== undefined) {
    fail(context, `keyword "${String(raw.keyword)}" no admite "amount" (recibido ${String(raw.amount)})`);
  }
  return { keyword: raw.keyword as KeywordId, ...(requiresAmount ? { amount: raw.amount as number } : {}) };
}

// ---------------------------------------------------------------------------
// AbilityDefinition (+ CoreCostRequirement, CatalogUmbralFormula/Definition, CatalogAbilityEffect)
// ---------------------------------------------------------------------------

function parseCoreCostRequirement(raw: unknown, context: string): CoreCostRequirement {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (raw.kind === 'ANY') return { kind: 'ANY' };
  if (raw.kind === 'COLOR') {
    if (!Array.isArray(raw.colors) || raw.colors.length === 0) {
      fail(context, 'campo "colors" ausente, vacío o no es un array (requerido para coreCost kind COLOR)');
    }
    for (const color of raw.colors) {
      if (!ALL_NUCLEO_COLORS.includes(color as NucleoColor)) {
        fail(context, `"colors" contiene un valor inválido: ${String(color)} (debe ser uno de ${ALL_NUCLEO_COLORS.join('|')})`);
      }
    }
    return { kind: 'COLOR', colors: raw.colors as NucleoColor[] };
  }
  fail(context, `campo "kind" debe ser ANY|COLOR, recibido ${String(raw.kind)}`);
}

function parseCatalogUmbralFormula(raw: unknown, context: string): CatalogUmbralFormula {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (raw.kind === 'VALUE') return { kind: 'VALUE' };
  if (raw.kind === 'ADD') {
    if (!isNonNegativeInteger(raw.amount)) fail(context, 'campo "amount" ausente o no es un entero >= 0 (kind ADD)');
    return { kind: 'ADD', amount: raw.amount };
  }
  if (raw.kind === 'MULTIPLY') {
    if (!isNonNegativeInteger(raw.amount)) fail(context, 'campo "amount" ausente o no es un entero >= 0 (kind MULTIPLY)');
    return { kind: 'MULTIPLY', amount: raw.amount };
  }
  fail(context, `campo "kind" debe ser VALUE|ADD|MULTIPLY, recibido ${String(raw.kind)}`);
}

function parseCatalogUmbralDefinition(raw: unknown, context: string): CatalogUmbralDefinition {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  const baseFormula = parseCatalogUmbralFormula(raw.baseFormula, `${context}.baseFormula`);
  if (raw.bonusFormula === undefined) return { baseFormula };
  return { baseFormula, bonusFormula: parseCatalogUmbralFormula(raw.bonusFormula, `${context}.bonusFormula`) };
}

function parseCatalogAbilityEffect(raw: unknown, context: string): CatalogAbilityEffect {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (raw.kind === 'ATTACK') {
    const formula = parseCatalogUmbralDefinition(raw.formula, `${context}.formula`);
    if (raw.arrollar !== undefined && typeof raw.arrollar !== 'boolean') {
      fail(context, 'campo "arrollar", si está presente, debe ser un boolean');
    }
    return { kind: 'ATTACK', formula, ...(raw.arrollar !== undefined ? { arrollar: raw.arrollar } : {}) };
  }
  if (raw.kind === 'PLOT') {
    if (!isNonNegativeInteger(raw.amount)) fail(context, 'campo "amount" ausente o no es un entero >= 0 (kind PLOT)');
    return { kind: 'PLOT', amount: raw.amount };
  }
  fail(context, `campo "kind" debe ser ATTACK|PLOT, recibido ${String(raw.kind)}`);
}

export function parseAbilityDefinition(raw: unknown, context: string): AbilityDefinition {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (!isNonEmptyString(raw.id)) fail(context, 'campo "id" ausente o no es un string no vacío');
  if (!isNonEmptyString(raw.name)) fail(context, 'campo "name" ausente o no es un string no vacío');

  const coreCost = parseCoreCostRequirement(raw.coreCost, `${context}.coreCost`);

  if (!isPositiveInteger(raw.baseCooldown) || raw.baseCooldown < CATALOG_ABILITY_BASE_COOLDOWN_MIN) {
    fail(context, `campo "baseCooldown" debe ser un entero >= ${CATALOG_ABILITY_BASE_COOLDOWN_MIN}`);
  }

  const effect = raw.effect === undefined ? undefined : parseCatalogAbilityEffect(raw.effect, `${context}.effect`);

  return {
    id: createId<'AbilityId'>('AbilityId', raw.id) as AbilityId,
    name: raw.name,
    coreCost,
    baseCooldown: raw.baseCooldown,
    ...(effect !== undefined ? { effect } : {}),
  };
}

// ---------------------------------------------------------------------------
// LeaderDefinition
// ---------------------------------------------------------------------------

function parseLevelUpEffectSpec(raw: unknown, context: string): LevelUpEffectSpec {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (!isNonEmptyString(raw.abilityId)) fail(context, 'campo "abilityId" ausente o no es un string no vacío');
  const abilityId = createId<'AbilityId'>('AbilityId', raw.abilityId) as AbilityId;

  if (raw.op === 'INCREASE_DAMAGE') {
    if (!isNonNegativeInteger(raw.amount)) {
      fail(context, 'campo "amount" ausente o no es un entero >= 0 (op INCREASE_DAMAGE)');
    }
    return { op: 'INCREASE_DAMAGE', abilityId, amount: raw.amount };
  }
  if (raw.op === 'DECREASE_COST') return { op: 'DECREASE_COST', abilityId };
  if (raw.op === 'REMOVE_BACKLASH') return { op: 'REMOVE_BACKLASH', abilityId };
  fail(context, `campo "op" debe ser INCREASE_DAMAGE|DECREASE_COST|REMOVE_BACKLASH, recibido ${String(raw.op)}`);
}

function parseLevelUpOption(raw: unknown, context: string): LevelUpOption {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (!isNonEmptyString(raw.id)) fail(context, 'campo "id" ausente o no es un string no vacío');
  if (!isNonEmptyString(raw.description)) fail(context, 'campo "description" ausente o no es un string no vacío');
  const effect = parseLevelUpEffectSpec(raw.effect, `${context}.effect`);
  return { id: raw.id, description: raw.description, effect };
}

export function parseLeaderDefinition(raw: unknown, context: string): LeaderDefinition {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (!isNonEmptyString(raw.id)) fail(context, 'campo "id" ausente o no es un string no vacío');
  if (!isNonEmptyString(raw.name)) fail(context, 'campo "name" ausente o no es un string no vacío');

  if (!Array.isArray(raw.baseAbilities) || raw.baseAbilities.length !== 4) {
    fail(context, 'baseAbilities debe tener exactamente 4 elementos (GDD §3.1, plantilla CD1/2/3/4)');
  }
  const baseAbilities = raw.baseAbilities.map((a, i) => parseAbilityDefinition(a, `${context}.baseAbilities[${i}]`));

  const cooldownCounts = new Map<number, number>();
  for (const ability of baseAbilities) {
    cooldownCounts.set(ability.baseCooldown, (cooldownCounts.get(ability.baseCooldown) ?? 0) + 1);
  }
  const hasExactlyOneOfEach = [1, 2, 3, 4].every((cd) => cooldownCounts.get(cd) === 1) && cooldownCounts.size === 4;
  if (!hasExactlyOneOfEach) {
    fail(context, 'baseAbilities debe tener exactamente un CD1, un CD2, un CD3 y un CD4 (GDD §3.1)');
  }

  for (const [i, ability] of baseAbilities.entries()) {
    if (ability.effect?.kind === 'ATTACK') {
      fail(
        `${context}.baseAbilities[${i}]`,
        'ninguna baseAbility del Líder puede tener effect.kind ATTACK (GDD §2.5; H1.6 exige side ENEMY para ATTACK)'
      );
    }
  }

  const cd1Ability = baseAbilities.find((a) => a.baseCooldown === CATALOG_ABILITY_BASE_COOLDOWN_MIN);
  if (!cd1Ability || cd1Ability.coreCost.kind !== 'ANY') {
    fail(context, 'la habilidad con baseCooldown 1 (CD1) debe tener coreCost.kind ANY (GDD §2.5, "CD1 siempre ⚫")');
  }

  if (!isStringArray(raw.cardPoolIds)) fail(context, 'campo "cardPoolIds" ausente o no es un array de strings');
  const cardPoolIds = raw.cardPoolIds.map((id) => createId<'CardId'>('CardId', id) as CardId);

  if (!Array.isArray(raw.levelUpOptions)) fail(context, 'campo "levelUpOptions" ausente o no es un array');
  const levelUpOptions = raw.levelUpOptions.map((o, i) => parseLevelUpOption(o, `${context}.levelUpOptions[${i}]`));

  // NUEVO H1.18 — mismo criterio que EnemyDefinition.maxHealth (ver spec H1.18 §0.3).
  if (!isPositiveInteger(raw.maxHealth) || raw.maxHealth > 100) {
    fail(context, 'campo "maxHealth" debe ser un entero > 0 y <= 100 (GDD §3.4, "tope blando de vida")');
  }

  if (raw.universeSkin !== undefined && typeof raw.universeSkin !== 'string') {
    fail(context, 'campo "universeSkin", si está presente, debe ser un string');
  }

  return {
    id: createId<'LeaderId'>('LeaderId', raw.id) as LeaderDefinition['id'],
    name: raw.name,
    baseAbilities: baseAbilities as unknown as LeaderDefinition['baseAbilities'],
    cardPoolIds,
    levelUpOptions,
    maxHealth: raw.maxHealth,
    ...(raw.universeSkin !== undefined ? { universeSkin: raw.universeSkin } : {}),
  };
}

// ---------------------------------------------------------------------------
// EnemyDefinition
// ---------------------------------------------------------------------------

function parseEnemyAbilityAiProfile(raw: unknown, context: string): EnemyAbilityAiProfile {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (raw.branch !== 'ATTACK' && raw.branch !== 'PLOT') {
    fail(context, `campo "branch" debe ser ATTACK|PLOT, recibido ${String(raw.branch)}`);
  }
  if (raw.tier !== 'FIRMA' && raw.tier !== 'STANDARD' && raw.tier !== 'BASICA') {
    fail(context, `campo "tier" debe ser FIRMA|STANDARD|BASICA, recibido ${String(raw.tier)}`);
  }
  return { branch: raw.branch, tier: raw.tier };
}

function parseEnemyAbilityDefinition(raw: unknown, context: string): EnemyAbilityDefinition {
  const ability = parseAbilityDefinition(raw, context);
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto'); // ya garantizado por parseAbilityDefinition, satisface narrowing
  const aiProfile = parseEnemyAbilityAiProfile(raw.aiProfile, `${context}.aiProfile`);
  return { ...ability, aiProfile };
}

function parsePhaseChangeCondition(raw: unknown, context: string): PhaseChangeCondition {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (raw.kind === 'HEALTH_BELOW_PERCENT') {
    if (typeof raw.percent !== 'number' || !(raw.percent > 0 && raw.percent < 100)) {
      fail(context, 'campo "percent" debe ser un número entre 0 y 100, exclusivo (kind HEALTH_BELOW_PERCENT)');
    }
    return { kind: 'HEALTH_BELOW_PERCENT', percent: raw.percent };
  }
  if (raw.kind === 'TURN_COUNT_AT_LEAST') {
    if (!isPositiveInteger(raw.turn)) fail(context, 'campo "turn" debe ser un entero >= 1 (kind TURN_COUNT_AT_LEAST)');
    return { kind: 'TURN_COUNT_AT_LEAST', turn: raw.turn };
  }
  if (raw.kind === 'SCENARIO_PLOT_AT_LEAST') {
    if (!isNonNegativeInteger(raw.amount)) {
      fail(context, 'campo "amount" debe ser un entero >= 0 (kind SCENARIO_PLOT_AT_LEAST)');
    }
    return { kind: 'SCENARIO_PLOT_AT_LEAST', amount: raw.amount };
  }
  fail(context, `campo "kind" debe ser HEALTH_BELOW_PERCENT|TURN_COUNT_AT_LEAST|SCENARIO_PLOT_AT_LEAST, recibido ${String(raw.kind)}`);
}

function parsePhaseDefinition(raw: unknown, context: string): PhaseDefinition {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (!isPositiveInteger(raw.phaseNumber)) fail(context, 'campo "phaseNumber" debe ser un entero >= 1');
  const changeCondition = parsePhaseChangeCondition(raw.changeCondition, `${context}.changeCondition`);
  return { phaseNumber: raw.phaseNumber, changeCondition };
}

/** Compartido por Enemigo y Escenario (§3.4/§3.5) — exige >= 1 fase y numeración
 *  1..N secuencial, sin huecos ni duplicados. */
function validatePhaseSequence(phases: readonly PhaseDefinition[], context: string): void {
  if (phases.length < 1) fail(context, 'phases debe tener al menos 1 elemento');
  const numbers = new Set(phases.map((p) => p.phaseNumber));
  const isSequential = numbers.size === phases.length && [...Array(phases.length).keys()].every((i) => numbers.has(i + 1));
  if (!isSequential) fail(context, 'phases debe numerarse 1..N sin huecos ni duplicados');
}

function parseDramaturgiaCardDefinition(raw: unknown, context: string): DramaturgiaCardDefinition {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (!isNonEmptyString(raw.id)) fail(context, 'campo "id" ausente o no es un string no vacío');
  if (!isNonEmptyString(raw.name)) fail(context, 'campo "name" ausente o no es un string no vacío');
  if (raw.icon !== 'ATTACK' && raw.icon !== 'PLOT') {
    fail(context, `campo "icon" debe ser ATTACK|PLOT, recibido ${String(raw.icon)}`);
  }
  if (raw.effectDescription !== undefined && typeof raw.effectDescription !== 'string') {
    fail(context, 'campo "effectDescription", si está presente, debe ser un string');
  }
  return {
    id: createId<'DramaturgiaCardId'>('DramaturgiaCardId', raw.id) as DramaturgiaCardDefinition['id'],
    name: raw.name,
    icon: raw.icon,
    ...(raw.effectDescription !== undefined ? { effectDescription: raw.effectDescription } : {}),
  };
}

/** Valida `dramaturgiaDeck` de una `EnemyDefinition` (spec H1.10 §0.2): mínimo 4
 *  cartas, ids únicos dentro del mazo, y al menos 1 carta ATTACK y 1 PLOT (para que el
 *  mazo, una vez barajado/robado en H1.18, pueda ejercitar ambas ramas de
 *  `decideEnemyAbility`). Validación enteramente local — no hay referencia cruzada que
 *  resolver contra otra colección del `Catalog`. */
function parseDramaturgiaDeck(raw: unknown, context: string): readonly DramaturgiaCardDefinition[] {
  if (!Array.isArray(raw)) fail(context, 'campo "dramaturgiaDeck" ausente o no es un array');
  const dramaturgiaDeck = raw.map((c, i) => parseDramaturgiaCardDefinition(c, `${context}[${i}]`));

  if (dramaturgiaDeck.length < 4) {
    fail(context, 'dramaturgiaDeck debe tener al menos 4 cartas (mínimo de contenido de prueba, ver spec H1.10 §0.5)');
  }

  const seenIds = new Set<string>();
  for (const card of dramaturgiaDeck) {
    if (seenIds.has(card.id)) {
      fail(context, `dramaturgiaDeck contiene un DramaturgiaCardId duplicado: "${card.id}"`);
    }
    seenIds.add(card.id);
  }

  const countByIcon = new Map<string, number>();
  for (const card of dramaturgiaDeck) {
    countByIcon.set(card.icon, (countByIcon.get(card.icon) ?? 0) + 1);
  }
  if ((countByIcon.get('ATTACK') ?? 0) === 0) {
    fail(context, 'dramaturgiaDeck debe incluir al menos 1 carta con icon ATTACK (GDD §3.4, el icono ⚔️ debe poder salir)');
  }
  if ((countByIcon.get('PLOT') ?? 0) === 0) {
    fail(context, 'dramaturgiaDeck debe incluir al menos 1 carta con icon PLOT (GDD §3.4, el icono 📜 debe poder salir)');
  }

  return dramaturgiaDeck;
}

export function parseEnemyDefinition(raw: unknown, context: string): EnemyDefinition {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (!isNonEmptyString(raw.id)) fail(context, 'campo "id" ausente o no es un string no vacío');
  if (!isNonEmptyString(raw.name)) fail(context, 'campo "name" ausente o no es un string no vacío');

  if (!Array.isArray(raw.abilities)) fail(context, 'campo "abilities" ausente o no es un array');
  const abilities = raw.abilities.map((a, i) => parseEnemyAbilityDefinition(a, `${context}.abilities[${i}]`));

  const basicaCountByBranch = new Map<string, number>();
  for (const [i, ability] of abilities.entries()) {
    const abilityContext = `${context}.abilities[${i}]`;
    if (ability.aiProfile.branch === 'ATTACK' && ability.aiProfile.tier === 'STANDARD') {
      fail(abilityContext, 'branch ATTACK no admite tier STANDARD (GDD §3.5, solo FIRMA/BASICA)');
    }
    if (ability.aiProfile.branch === 'PLOT' && ability.aiProfile.tier === 'FIRMA') {
      fail(abilityContext, 'branch PLOT no admite tier FIRMA (GDD §3.5, solo STANDARD/BASICA)');
    }
    if (ability.aiProfile.tier === 'BASICA') {
      if (ability.baseCooldown !== CATALOG_ABILITY_BASE_COOLDOWN_MIN) {
        fail(abilityContext, 'tier BASICA debe tener baseCooldown === 1 (GDD §3.4, "CD1 doble")');
      }
      if (ability.coreCost.kind !== 'ANY') {
        fail(abilityContext, 'tier BASICA debe tener coreCost ANY (⚫) (GDD §3.4)');
      }
      const key = ability.aiProfile.branch;
      basicaCountByBranch.set(key, (basicaCountByBranch.get(key) ?? 0) + 1);
    }
  }
  for (const branch of ['ATTACK', 'PLOT']) {
    const count = basicaCountByBranch.get(branch) ?? 0;
    if (count !== 1) {
      fail(context, `se esperaba exactamente 1 BASICA para branch "${branch}", encontradas ${count} (GDD §3.4)`);
    }
  }

  if (!Array.isArray(raw.phases)) fail(context, 'campo "phases" ausente o no es un array');
  const phases = raw.phases.map((p, i) => parsePhaseDefinition(p, `${context}.phases[${i}]`));
  validatePhaseSequence(phases, `${context}.phases`);

  if (!isPositiveInteger(raw.maxHealth) || raw.maxHealth > 100) {
    fail(context, 'campo "maxHealth" debe ser un entero > 0 y <= 100 (GDD §3.4, "tope blando de vida")');
  }

  const dramaturgiaDeck = parseDramaturgiaDeck(raw.dramaturgiaDeck, `${context}.dramaturgiaDeck`);

  if (raw.universeSkin !== undefined && typeof raw.universeSkin !== 'string') {
    fail(context, 'campo "universeSkin", si está presente, debe ser un string');
  }

  return {
    id: createId<'EnemyId'>('EnemyId', raw.id) as EnemyDefinition['id'],
    name: raw.name,
    abilities,
    phases,
    maxHealth: raw.maxHealth,
    dramaturgiaDeck,
    ...(raw.universeSkin !== undefined ? { universeSkin: raw.universeSkin } : {}),
  };
}

// ---------------------------------------------------------------------------
// ScenarioDefinition
// ---------------------------------------------------------------------------

function parsePlotThreshold(raw: unknown, context: string): ScenarioPlotThreshold {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (!isNonNegativeInteger(raw.atLeast)) fail(context, 'campo "atLeast" debe ser un entero >= 0');
  if (!isNonEmptyString(raw.description)) fail(context, 'campo "description" ausente o no es un string no vacío');
  return { atLeast: raw.atLeast, description: raw.description };
}

function parsePassiveEffect(raw: unknown, context: string): ScenarioPassiveEffect {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (!isNonEmptyString(raw.description)) fail(context, 'campo "description" ausente o no es un string no vacío');
  return { description: raw.description };
}

/** Exige >= 3 thresholds y `atLeast` estrictamente ascendente sin repetidos, en el mismo
 *  orden del array (GDD §3.6: "efectos variables por umbrales escalados"; criterio de
 *  aceptación H1.11: "Trama con umbrales escalonados"). No exige ningún tamaño de paso
 *  concreto (+1, +2...) — eso es balance, no invariante de motor. */
function validatePlotThresholdEscalation(thresholds: readonly ScenarioPlotThreshold[], context: string): void {
  if (thresholds.length < 3) {
    fail(context, 'plotThresholds debe tener al menos 3 umbrales para modelar una escalada (ver spec H1.11 §0.2)');
  }
  for (let i = 1; i < thresholds.length; i++) {
    const current = thresholds[i]!;
    const previous = thresholds[i - 1]!;
    if (current.atLeast <= previous.atLeast) {
      fail(
        context,
        `plotThresholds debe tener "atLeast" estrictamente ascendente — el elemento [${i}] (${current.atLeast}) no es mayor que el anterior (${previous.atLeast})`
      );
    }
  }
}

export function parseScenarioDefinition(raw: unknown, context: string): ScenarioDefinition {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (!isNonEmptyString(raw.id)) fail(context, 'campo "id" ausente o no es un string no vacío');
  if (!isNonEmptyString(raw.name)) fail(context, 'campo "name" ausente o no es un string no vacío');

  if (!Array.isArray(raw.plotThresholds)) fail(context, 'campo "plotThresholds" ausente o no es un array');
  const plotThresholds = raw.plotThresholds.map((t, i) => parsePlotThreshold(t, `${context}.plotThresholds[${i}]`));
  validatePlotThresholdEscalation(plotThresholds, `${context}.plotThresholds`);

  if (!Array.isArray(raw.passives)) fail(context, 'campo "passives" ausente o no es un array');
  const passives = raw.passives.map((p, i) => parsePassiveEffect(p, `${context}.passives[${i}]`));

  if (!Array.isArray(raw.phases)) fail(context, 'campo "phases" ausente o no es un array');
  const phases = raw.phases.map((p, i) => parsePhaseDefinition(p, `${context}.phases[${i}]`));
  for (const [i, phase] of phases.entries()) {
    if (phase.changeCondition.kind === 'HEALTH_BELOW_PERCENT') {
      fail(
        `${context}.phases[${i}].changeCondition`,
        'ScenarioDefinition no admite changeCondition HEALTH_BELOW_PERCENT — el Escenario no tiene vida (GDD §3.6, la Trama pertenece al Escenario, no HP)'
      );
    }
  }
  validatePhaseSequence(phases, `${context}.phases`);

  const dramaturgiaDeck = parseDramaturgiaDeck(raw.dramaturgiaDeck, `${context}.dramaturgiaDeck`);

  if (raw.universeSkin !== undefined && typeof raw.universeSkin !== 'string') {
    fail(context, 'campo "universeSkin", si está presente, debe ser un string');
  }

  return {
    id: createId<'ScenarioId'>('ScenarioId', raw.id) as ScenarioDefinition['id'],
    name: raw.name,
    plotThresholds,
    passives,
    phases,
    dramaturgiaDeck,
    ...(raw.universeSkin !== undefined ? { universeSkin: raw.universeSkin } : {}),
  };
}

// ---------------------------------------------------------------------------
// EvolutionTemplate
// ---------------------------------------------------------------------------

function parseEvolutionTemplateTarget(raw: unknown, context: string): EvolutionTemplateTarget {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (raw.kind === 'CARD_TYPE') {
    if (!CARD_TYPES.includes(raw.cardType as CardType)) {
      fail(context, `campo "cardType" debe ser uno de ${CARD_TYPES.join('|')}, recibido ${String(raw.cardType)}`);
    }
    return { kind: 'CARD_TYPE', cardType: raw.cardType as CardType };
  }
  if (raw.kind === 'HAS_KEYWORD') {
    if (!KEYWORD_IDS.includes(raw.keyword as KeywordId)) {
      fail(context, `campo "keyword" debe ser uno de ${KEYWORD_IDS.join('|')}, recibido ${String(raw.keyword)}`);
    }
    return { kind: 'HAS_KEYWORD', keyword: raw.keyword as KeywordId };
  }
  fail(context, `campo "kind" debe ser CARD_TYPE|HAS_KEYWORD, recibido ${String(raw.kind)}`);
}

function requireEffectAmount(raw: Record<string, unknown>, context: string, opName: string): number {
  if (!isNonNegativeInteger(raw.amount)) {
    fail(context, `campo "amount" ausente o no es un entero >= 0 (op ${opName})`);
  }
  return raw.amount;
}

function parseEvolutionEffectSpec(raw: unknown, context: string): EvolutionEffectSpec {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  switch (raw.op) {
    case 'INCREASE_DAMAGE':
      return { op: 'INCREASE_DAMAGE', amount: requireEffectAmount(raw, context, raw.op) };
    case 'DECREASE_ENERGY_COST':
      return { op: 'DECREASE_ENERGY_COST', amount: requireEffectAmount(raw, context, raw.op) };
    case 'INCREASE_PLOT_AMOUNT':
      return { op: 'INCREASE_PLOT_AMOUNT', amount: requireEffectAmount(raw, context, raw.op) };
    case 'DECREASE_COOLDOWN':
      return { op: 'DECREASE_COOLDOWN', amount: requireEffectAmount(raw, context, raw.op) };
    case 'INCREASE_ALLY_MAX_HEALTH':
      return { op: 'INCREASE_ALLY_MAX_HEALTH', amount: requireEffectAmount(raw, context, raw.op) };
    case 'REMOVE_BACKLASH':
      return { op: 'REMOVE_BACKLASH' };
    case 'ALLY_NO_WARMUP_ABILITY':
      return { op: 'ALLY_NO_WARMUP_ABILITY' };
    default:
      fail(
        context,
        `campo "op" debe ser uno de INCREASE_DAMAGE|DECREASE_ENERGY_COST|INCREASE_PLOT_AMOUNT|DECREASE_COOLDOWN|REMOVE_BACKLASH|INCREASE_ALLY_MAX_HEALTH|ALLY_NO_WARMUP_ABILITY, recibido ${String(raw.op)}`
      );
  }
}

export function parseEvolutionTemplate(raw: unknown, context: string): EvolutionTemplate {
  if (!isRecord(raw)) fail(context, 'se esperaba un objeto');
  if (!isNonEmptyString(raw.id)) fail(context, 'campo "id" ausente o no es un string no vacío');
  if (!isNonEmptyString(raw.name)) fail(context, 'campo "name" ausente o no es un string no vacío');

  const target = parseEvolutionTemplateTarget(raw.target, `${context}.target`);

  if (raw.kind !== 'TEMPLATE' && raw.kind !== 'BESPOKE') {
    fail(context, `campo "kind" debe ser TEMPLATE|BESPOKE, recibido ${String(raw.kind)}`);
  }

  if (raw.kind === 'BESPOKE' && !isNonEmptyString(raw.bespokeCardId)) {
    fail(context, 'kind BESPOKE exige campo "bespokeCardId" (string no vacío)');
  }
  if (raw.kind === 'TEMPLATE' && raw.bespokeCardId !== undefined) {
    fail(context, 'kind TEMPLATE no admite campo "bespokeCardId" — una plantilla genérica no apunta a una carta concreta');
  }

  const effect = parseEvolutionEffectSpec(raw.effect, `${context}.effect`);

  return {
    id: createId<'EvolutionTemplateId'>('EvolutionTemplateId', raw.id) as EvolutionTemplate['id'],
    name: raw.name,
    target,
    kind: raw.kind,
    ...(raw.kind === 'BESPOKE' ? { bespokeCardId: createId<'CardId'>('CardId', raw.bespokeCardId as string) as CardId } : {}),
    effect,
  };
}
