// @vitest-environment node
//
// Movido tal cual (sin cambios funcionales) desde `hello-combat-scene.test.ts` (H2.1) — el archivo
// original desaparece en H2.6 junto con `HelloCombatScene`/`build-hello-engine.ts`, pero este guardrail
// sigue siendo responsabilidad de `combat-scene`, ajeno a H2.6 (spec H2.6 §5.2).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import RELATIVE_PATHS from './sync-data-files.json';

/**
 * Guardrail de H2.1 (deuda detectada por Reviewer): `public/data` es una copia física
 * de los 9 JSON reales de `packages/data`, sin ningún mecanismo hasta ahora que impida
 * que se desincronicen. Este test compara contenido JSON parseado (no bytes crudos, para
 * tolerar diferencias de fin de línea/espacios sin significado) de cada uno de los 9
 * archivos y FALLA si `packages/data` y `public/data` divergen — señal de que alguien
 * editó el JSON fuente sin correr `node packages/combat-scene/scripts/sync-data.mjs`
 * (enganchado como `predev`/`prebuild` en `package.json`).
 */
describe('Sincronización packages/data <-> public/data (guardrail H2.1)', () => {
  const here = fileURLToPath(import.meta.url);
  const dataDir = join(dirname(here), '..', '..', 'data');
  const publicDataDir = join(dirname(here), '..', 'public', 'data');

  it.each(RELATIVE_PATHS)('%s: la copia en public/data coincide con la fuente de verdad en packages/data', (relativePath) => {
    const source = JSON.parse(readFileSync(join(dataDir, relativePath), 'utf-8'));
    const copy = JSON.parse(readFileSync(join(publicDataDir, relativePath), 'utf-8'));
    expect(copy).toEqual(source);
  });
});
