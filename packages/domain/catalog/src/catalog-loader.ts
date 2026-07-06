import type { CardId, EnemyId, EvolutionTemplateId, LeaderId, ScenarioId } from '@collector/domain-shared';
import type { CatalogRawInput, Catalog } from './types/catalog';
import type { CardDefinition } from './types/card';
import type { LeaderDefinition } from './types/leader';
import type { EnemyDefinition } from './types/enemy';
import type { ScenarioDefinition } from './types/scenario';
import type { EvolutionTemplate } from './types/evolution-template';
import {
  parseCardDefinition,
  parseLeaderDefinition,
  parseEnemyDefinition,
  parseScenarioDefinition,
  parseEvolutionTemplate,
} from './validation/schema';
import { validateCrossReferences } from './validation/cross-reference';
import { fail } from './validation/primitives';

/**
 * Ensambla y valida un `Catalog` a partir de `CatalogRawInput` (colecciones ya
 * parseadas de JSON — ver spec §0.4, sin `JSON.parse`/`fs`/`fetch` dentro de
 * `domain/catalog`). `load()` es `async` por fidelidad al contrato de
 * `architecture_stack.md` §5.2, aunque toda la validación aquí es síncrona.
 */
export class CatalogLoader {
  private readonly rawInput: CatalogRawInput;
  private catalog?: Catalog;

  constructor(rawInput: CatalogRawInput) {
    this.rawInput = rawInput;
  }

  async load(): Promise<Catalog> {
    const cards = buildMap(this.rawInput.cards, 'cards', parseCardDefinition, (c: CardDefinition) => c.id);
    const leaders = buildMap(this.rawInput.leaders, 'leaders', parseLeaderDefinition, (l: LeaderDefinition) => l.id);
    const enemies = buildMap(this.rawInput.enemies, 'enemies', parseEnemyDefinition, (e: EnemyDefinition) => e.id);
    const scenarios = buildMap(
      this.rawInput.scenarios,
      'scenarios',
      parseScenarioDefinition,
      (s: ScenarioDefinition) => s.id
    );
    const evolutionTemplates = buildMap(
      this.rawInput.evolutionTemplates,
      'evolutionTemplates',
      parseEvolutionTemplate,
      (t: EvolutionTemplate) => t.id
    );

    const catalog: Catalog = { cards, leaders, enemies, scenarios, evolutionTemplates };
    validateCrossReferences(catalog); // §4 — lanza en la primera referencia rota

    this.catalog = catalog;
    return catalog;
  }

  getCard(id: CardId): CardDefinition {
    return this.getOrThrow(this.ensureLoaded().cards, id, 'cards');
  }

  getLeader(id: LeaderId): LeaderDefinition {
    return this.getOrThrow(this.ensureLoaded().leaders, id, 'leaders');
  }

  getEnemy(id: EnemyId): EnemyDefinition {
    return this.getOrThrow(this.ensureLoaded().enemies, id, 'enemies');
  }

  getScenario(id: ScenarioId): ScenarioDefinition {
    return this.getOrThrow(this.ensureLoaded().scenarios, id, 'scenarios');
  }

  getEvolutionTemplate(id: EvolutionTemplateId): EvolutionTemplate {
    return this.getOrThrow(this.ensureLoaded().evolutionTemplates, id, 'evolutionTemplates');
  }

  private ensureLoaded(): Catalog {
    if (!this.catalog) {
      fail('CatalogLoader', 'load() no se ha invocado todavía (o no ha resuelto) — llama a load() antes de usar los accessors');
    }
    return this.catalog;
  }

  private getOrThrow<Id, T>(map: ReadonlyMap<Id, T>, id: Id, collectionName: string): T {
    const found = map.get(id);
    if (!found) {
      fail(collectionName, `no existe ninguna entrada con id "${String(id)}"`);
    }
    return found;
  }
}

/**
 * Construye un `ReadonlyMap<Id, T>` a partir de `raw: readonly unknown[]`, validando
 * cada entrada con `parse` (§3) y detectando ids duplicados DENTRO de esta colección
 * (distinto de `validateGlobalAbilityIdUniqueness`, §4.4, que compara ENTRE colecciones
 * distintas — habilidades de Líder vs. de Enemigo).
 */
function buildMap<T, Id>(
  raw: readonly unknown[],
  collectionName: string,
  parse: (raw: unknown, context: string) => T,
  getId: (item: T) => Id
): ReadonlyMap<Id, T> {
  const map = new Map<Id, T>();
  raw.forEach((entry, index) => {
    const parsed = parse(entry, `${collectionName}[${index}]`);
    const id = getId(parsed);
    if (map.has(id)) {
      fail(collectionName, `id duplicado "${String(id)}" (índice ${index})`);
    }
    map.set(id, parsed);
  });
  return map;
}
