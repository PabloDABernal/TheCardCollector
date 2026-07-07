#!/usr/bin/env node
// apps/shell/scripts/sync-data.mjs
//
// H2.9 spec §1.3/§7 — duplicado (a propósito, opción explícitamente válida de la spec) del
// guardrail de H2.1 que ya existía en `packages/combat-scene/scripts/sync-data.mjs`:
// `apps/shell/public/data` es una copia física de los 9 JSON de contenido reales de
// `packages/data`, necesaria porque el navegador solo puede `fetch` assets estáticos servidos
// por Vite, no leer `packages/data` directamente (boundaries de eslint).
//
// Sincroniza SIEMPRE en un solo sentido: `packages/data` (fuente de verdad) ->
// `apps/shell/public/data` (copia servida por Vite). Se engancha como `predev`/`prebuild` en
// `package.json` para que la copia nunca quede desincronizada de forma silenciosa.

import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(import.meta.url);
const dataDir = join(dirname(here), '..', '..', '..', 'packages', 'data');
const publicDataDir = join(dirname(here), '..', 'public', 'data');

// Mismos 9 archivos que `apps/shell/src/combat/load-raw-content.ts` y
// `packages/data/load-content.test.ts` — lista única en `src/sync-data-files.json`, reusada
// también por el test de divergencia (`sync-data-guardrail.test.ts`) para no duplicar el listado.
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

// Solo ejecutar al invocar directamente (`node sync-data.mjs`), no al importarlo desde un test
// que quiera reusar `RELATIVE_PATHS`.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncData();
  console.log(`sync-data: ${RELATIVE_PATHS.length} archivos sincronizados de packages/data a apps/shell/public/data.`);
}
