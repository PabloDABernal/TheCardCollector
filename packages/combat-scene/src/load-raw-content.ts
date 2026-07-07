import type { CatalogRawInput } from '@collector/domain-catalog';

/**
 * `true` en Node (proceso de test de Vitest); `false` en un navegador real (dev server
 * de Vite). Distingue de forma fiable el runtime real, incluso bajo el entorno `jsdom`
 * de Vitest (que define `window`/`document` pero NO elimina las globals de Node).
 */
const isNodeRuntime = typeof process !== 'undefined' && !!process.versions?.node;

/**
 * Carga el contenido real 2×2×2 de `packages/data` (mismos 9 archivos que
 * `packages/cli/src/load-raw-content.ts`, sin nada mockeado a mano) — spec H2.1 §3.1.1.
 * Dos vías según entorno de ejecución, ninguna de las dos cruza `boundaries/element-types`
 * (`combat-scene` no puede depender de `data`, ver spec §5):
 *  - Node (Vitest, incluso con `environment: 'jsdom'`): lee directamente los JSON de
 *    `packages/data` vía `readFileSync` con una ruta resuelta en runtime (no un
 *    `import` estático) — exactamente el mismo patrón que ya usa `packages/cli`.
 *  - Navegador real: sin acceso a `node:fs`; usa `fetch` contra una copia literal de
 *    esos mismos JSON servida como asset estático desde `public/data/` (Vite sirve
 *    `public/` en la raíz del dev server/build).
 */
export async function loadRawContent(): Promise<CatalogRawInput> {
  const [soldadoCards, magoCards, commonCards, soldado, mago, bestia, espectro, bosque, templo] = await Promise.all([
    readContent('cards/soldado-base-cards.json'),
    readContent('cards/mago-base-cards.json'),
    readContent('cards/common-cards.json'),
    readContent('leaders/soldado-base.json'),
    readContent('leaders/mago-base.json'),
    readContent('enemies/bestia-base.json'),
    readContent('enemies/espectro-base.json'),
    readContent('scenarios/bosque-encantado-base.json'),
    readContent('scenarios/templo-en-ruinas-base.json'),
  ]);

  return {
    cards: [...(soldadoCards as unknown[]), ...(magoCards as unknown[]), ...(commonCards as unknown[])],
    leaders: [soldado, mago],
    enemies: [bestia, espectro],
    scenarios: [bosque, templo],
    evolutionTemplates: [],
  };
}

async function readContent(relativePath: string): Promise<unknown> {
  if (isNodeRuntime) {
    // Deliberadamente SIN `new URL(<dinámico>, import.meta.url)`: Vite reescribe ese
    // patrón en tiempo de transform (para resolver assets), incluso dentro de una rama
    // nunca alcanzada en el navegador — rompía el bundle real de `npm run dev`. En su
    // lugar se resuelve la ruta absoluta a mano con `node:path`/`node:url`.
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const here = fileURLToPath(import.meta.url);
    const dataDir = join(dirname(here), '..', '..', 'data');
    return JSON.parse(readFileSync(join(dataDir, relativePath), 'utf-8'));
  }
  const response = await fetch(`/data/${relativePath}`);
  return response.json() as Promise<unknown>;
}
