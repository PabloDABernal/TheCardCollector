import { fail } from './primitives';
import type { Catalog } from '../types/catalog';
import type { CardId } from '@collector/domain-shared';

/**
 * Resolución de referencias cruzadas del catálogo — el corazón de la historia (spec
 * §0.3/§4). Recibe los 5 mapas YA construidos (todas las entradas ya pasaron `parse*`,
 * §3, y ya se comprobó que no hay ids duplicados dentro de cada colección — ver
 * `CatalogLoader.load()`, §5) y valida, en este orden, lanzando en la primera violación
 * encontrada (mismo estilo fail-fast que el resto del proyecto).
 */
export function validateCrossReferences(catalog: Catalog): void {
  validateLeaderCardPools(catalog);
  validateLeaderLevelUpAbilityRefs(catalog);
  validateEvolutionTemplateBespokeRefs(catalog);
  validateGlobalAbilityIdUniqueness(catalog);
}

function validateLeaderCardPools(catalog: Catalog): void {
  for (const [leaderId, leader] of catalog.leaders) {
    for (const cardId of leader.cardPoolIds) {
      if (!catalog.cards.has(cardId)) {
        fail(
          `leaders["${String(leaderId)}"].cardPoolIds`,
          `referencia a CardId "${String(cardId)}" que no existe en la colección "cards"`
        );
      }
    }
  }
}

/**
 * `LevelUpEffectSpec` (§2.6) es una unión discriminada por `op` cuyas 3 variantes
 * (`INCREASE_DAMAGE`/`DECREASE_COST`/`REMOVE_BACKLASH`) siempre incluyen `abilityId` —
 * se accede directamente sin ninguna función de extracción condicional (ver spec §4,
 * "Nota de implementación" tras el pseudocódigo: se simplifica frente al pseudocódigo
 * defensivo original porque, a día de hoy, ninguna variante carece de `abilityId`).
 */
function validateLeaderLevelUpAbilityRefs(catalog: Catalog): void {
  for (const [leaderId, leader] of catalog.leaders) {
    const ownAbilityIds = new Set(leader.baseAbilities.map((a) => a.id));
    for (const [i, option] of leader.levelUpOptions.entries()) {
      const abilityId = option.effect.abilityId;
      if (!ownAbilityIds.has(abilityId)) {
        fail(
          `leaders["${String(leaderId)}"].levelUpOptions[${i}].effect.abilityId`,
          `referencia a AbilityId "${String(abilityId)}" que no es una de las 4 baseAbilities de este mismo Líder`
        );
      }
    }
  }
}

function validateEvolutionTemplateBespokeRefs(catalog: Catalog): void {
  for (const [templateId, template] of catalog.evolutionTemplates) {
    if (template.kind === 'BESPOKE') {
      const cardId = template.bespokeCardId as CardId; // ya garantizado presente por parseEvolutionTemplate, §3.6
      if (!catalog.cards.has(cardId)) {
        fail(
          `evolutionTemplates["${String(templateId)}"].bespokeCardId`,
          `referencia a CardId "${String(cardId)}" que no existe en la colección "cards"`
        );
      }
    }
  }
}

/**
 * GDD/architecture_stack.md §6: el futuro adaptador (H1.18, fuera de alcance) aplana
 * TODAS las habilidades de TODOS los Líderes + TODOS los Enemigos en un único
 * `Map<AbilityId, ...>` plano para `CombatEngineConfig` — dos habilidades de contenido
 * distinto con el mismo `AbilityId` colisionarían silenciosamente en ese mapa (la
 * segunda pisaría a la primera). Se detecta aquí, en catálogo, antes de que eso ocurra.
 */
function validateGlobalAbilityIdUniqueness(catalog: Catalog): void {
  const seen = new Map<string, string>(); // AbilityId (string) -> "de dónde" para el mensaje de error

  for (const [leaderId, leader] of catalog.leaders) {
    for (const ability of leader.baseAbilities) {
      registerAbilityId(seen, ability.id, `leaders["${String(leaderId)}"].baseAbilities`);
    }
  }
  for (const [enemyId, enemy] of catalog.enemies) {
    for (const ability of enemy.abilities) {
      registerAbilityId(seen, ability.id, `enemies["${String(enemyId)}"].abilities`);
    }
  }
}

function registerAbilityId(seen: Map<string, string>, abilityId: { toString(): string }, origin: string): void {
  const key = String(abilityId);
  const previousOrigin = seen.get(key);
  if (previousOrigin !== undefined) {
    fail(
      'validateGlobalAbilityIdUniqueness',
      `AbilityId "${key}" está duplicado — aparece en "${previousOrigin}" y en "${origin}" (todo AbilityId debe ser único en todo el catálogo, ver spec H1.8 §0.3/§4.4)`
    );
  }
  seen.set(key, origin);
}
