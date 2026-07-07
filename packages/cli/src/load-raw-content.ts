import { readFileSync } from 'node:fs';
import type { CatalogRawInput } from '@collector/domain-catalog';

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf-8'));
}

/**
 * Lee TODO el contenido real de packages/data — mismos 4 archivos de cartas + 2 de
 * Líder + 2 de Enemigo + 2 de Escenario que `packages/data/load-content.test.ts`. Sin
 * filtrar por id todavía — la selección de qué Líder/Enemigo/Escenario jugar ocurre
 * después, contra el `Catalog` ya cargado (ver main.ts, spec H1.19 §6).
 */
export function loadRawContent(): CatalogRawInput {
  const soldadoCards = readJson('../../data/cards/soldado-base-cards.json') as unknown[];
  const magoCards = readJson('../../data/cards/mago-base-cards.json') as unknown[];
  const commonCards = readJson('../../data/cards/common-cards.json') as unknown[];
  const soldado = readJson('../../data/leaders/soldado-base.json');
  const mago = readJson('../../data/leaders/mago-base.json');
  const bestia = readJson('../../data/enemies/bestia-base.json');
  const espectro = readJson('../../data/enemies/espectro-base.json');
  const bosque = readJson('../../data/scenarios/bosque-encantado-base.json');
  const templo = readJson('../../data/scenarios/templo-en-ruinas-base.json');

  return {
    cards: [...soldadoCards, ...magoCards, ...commonCards],
    leaders: [soldado, mago],
    enemies: [bestia, espectro],
    scenarios: [bosque, templo],
    evolutionTemplates: [],
  };
}
