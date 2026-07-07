#!/usr/bin/env node
// packages/combat-scene/scripts/sync-data.mjs
//
// Guardrail de H2.1 (deuda detectada por Reviewer): `packages/combat-scene/public/data`
// es una copia física de los 9 JSON de contenido reales de `packages/data`, necesaria
// porque el navegador solo puede `fetch` assets estáticos servidos por Vite, no leer
// `packages/data` directamente (boundaries de eslint, ver `eslint.config.mjs`).
//
// Este script sincroniza SIEMPRE en un solo sentido: `packages/data` (fuente de verdad)
// -> `packages/combat-scene/public/data` (copia servida por Vite). Nunca al revés.
// Se engancha como `predev`/`prebuild` en `package.json` para que la copia nunca quede
// desincronizada de forma silenciosa; `packages/data/load-content.test.ts` (Node, vía
// `readFileSync`) y `packages/combat-scene/src/load-raw-content.ts` (Node/fetch) listan
// exactamente los mismos 9 archivos — ver ese mismo listado replicado aquí.

import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(import.meta.url);
const dataDir = join(dirname(here), '..', '..', 'data');
const publicDataDir = join(dirname(here), '..', 'public', 'data');

// Mismos 9 archivos que `packages/combat-scene/src/load-raw-content.ts` y
// `packages/data/load-content.test.ts` — lista única en
// `src/sync-data-files.json`, reusada también por el test de divergencia
// (`hello-combat-scene.test.ts`) para no duplicar el listado.
export const RELATIVE_PATHS = JSON.parse(
  readFileSync(join(dirname(here), '..', 'src', 'sync-data-files.json'), 'utf-8')
);

export function syncData() {
  for (const relativePath of RELATIVE_PATHS) {
    const from = join(dataDir, relativePath);
    const to = join(publicDataDir, relativePath);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
}

// Solo ejecutar al invocar directamente (`node sync-data.mjs`), no al importarlo desde
// un test que quiera reusar `RELATIVE_PATHS`.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncData();
  console.log(`sync-data: ${RELATIVE_PATHS.length} archivos sincronizados de packages/data a packages/combat-scene/public/data.`);
}
