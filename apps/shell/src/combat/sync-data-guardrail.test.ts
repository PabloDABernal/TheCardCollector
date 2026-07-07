// @vitest-environment node
//
// H2.9 — duplicado (a propósito) del guardrail de H2.1 que ya existía en
// `packages/combat-scene/src/sync-data-guardrail.test.ts`, ahora también en `apps/shell` porque
// `apps/shell/public/data` es la copia que sirve el dev server real de `apps/shell` (§1.3).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import RELATIVE_PATHS from '../sync-data-files.json';

describe('Sincronización packages/data <-> apps/shell/public/data (guardrail H2.9)', () => {
  const here = fileURLToPath(import.meta.url);
  const dataDir = join(dirname(here), '..', '..', '..', '..', 'packages', 'data');
  const publicDataDir = join(dirname(here), '..', '..', 'public', 'data');

  it.each(RELATIVE_PATHS)('%s: la copia en public/data coincide con la fuente de verdad en packages/data', (relativePath) => {
    const source = JSON.parse(readFileSync(join(dataDir, relativePath), 'utf-8'));
    const copy = JSON.parse(readFileSync(join(publicDataDir, relativePath), 'utf-8'));
    expect(copy).toEqual(source);
  });
});
