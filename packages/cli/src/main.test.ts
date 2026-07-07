import { describe, it, expect } from 'vitest';
import { SeededRandomSource } from '@collector/domain-shared';
import { CatalogLoader } from '@collector/domain-catalog';
import { CombatEngine, buildCombatEngineConfig } from '@collector/domain-combat';
import type { CombatCommand } from '@collector/domain-combat';
import { loadRawContent } from './load-raw-content';
import { parseLine } from './command-parser';

/**
 * Smoke test obligatorio (spec H1.19 §7.4) — NO se testea el bucle de `readline`
 * interactivo (fuera de alcance razonable para un test automatizado). En su lugar, un
 * test de integración que alimenta una secuencia de líneas de texto fijas directamente a
 * `parseLine` + `engine.dispatch()` (sin pasar por stdin/readline) hasta alcanzar
 * `VICTORY` o `DEFEAT` — un guion de combate determinista con una semilla fija.
 *
 * El guion es deliberadamente simple ("end turn" repetido, sin jugar ninguna carta ni
 * activar ninguna habilidad del Líder): con el contenido real de H1.9-H1.12, la Energía
 * del Líder arranca en 1 y ningún efecto de catálogo la regenera todavía (deuda de
 * contenido/diseño fuera de alcance de esta historia) — cualquier guion que dependa de
 * jugar más de 1 carta de coste >1 no sería sostenible. "end turn" repetido sí basta para
 * alcanzar un estado terminal: cada turno de Enemigo automático (`runAutomaticEnemyTurn`)
 * mueve `leaderDamage` y/o `scenarioPlot`, ambos con condición de derrota, garantizando
 * terminación determinista con la semilla fija usada aquí.
 */
async function buildEngine(seed: number) {
  const rawInput = loadRawContent();
  const catalog = await new CatalogLoader(rawInput).load();
  const leader = catalog.leaders.get(
    [...catalog.leaders.keys()].find((id) => String(id) === 'leader-soldado-base')!
  )!;
  const enemy = catalog.enemies.get(
    [...catalog.enemies.keys()].find((id) => String(id) === 'enemy-bestia-base')!
  )!;
  const scenario = catalog.scenarios.get(
    [...catalog.scenarios.keys()].find((id) => String(id) === 'scenario-bosque-encantado-base')!
  )!;

  const config = buildCombatEngineConfig({
    catalog,
    leader,
    enemy,
    scenario,
    randomSource: new SeededRandomSource(seed),
  });
  return new CombatEngine(config);
}

describe('main.ts (H1.19) — smoke test end-to-end sin stdin real', () => {
  it('un guion de "end turn" repetido, alimentado a parseLine + engine.dispatch(), alcanza VICTORY o DEFEAT sin ningún rechazo inesperado', async () => {
    const engine = await buildEngine(42);

    const MAX_ITERATIONS = 200;
    let lastSnapshot = engine.getSnapshot();
    let iterations = 0;

    while (lastSnapshot.status === 'IN_PROGRESS' && iterations < MAX_ITERATIONS) {
      const parsed = parseLine('end turn', lastSnapshot);
      expect(parsed.kind).toBe('COMMAND');
      if (parsed.kind !== 'COMMAND') break;

      const command: CombatCommand = parsed.command;
      const result = engine.dispatch(command);
      expect(result.ok).toBe(true);

      lastSnapshot = engine.getSnapshot();
      iterations += 1;
    }

    expect(iterations).toBeLessThan(MAX_ITERATIONS);
    expect(lastSnapshot.status).not.toBe('IN_PROGRESS');
    expect(['VICTORY', 'DEFEAT']).toContain(lastSnapshot.status);
  });

  it('parseLine resuelve la gramática básica ("play card", "activate ability", "set redirect") contra un snapshot real', async () => {
    const engine = await buildEngine(7);
    const snapshot = engine.getSnapshot();

    const activateParsed = parseLine(
      `activate ability ability-soldado-base-guardia-firme 0`,
      snapshot
    );
    expect(activateParsed.kind).toBe('COMMAND');
    if (activateParsed.kind === 'COMMAND') {
      expect(activateParsed.command.type).toBe('ACTIVATE_ABILITY');
    }

    const redirectParsed = parseLine('set redirect none', snapshot);
    expect(redirectParsed).toEqual({
      kind: 'COMMAND',
      command: { type: 'SET_DAMAGE_REDIRECT', targetAllyInstanceId: null },
    });

    const outOfRangeParsed = parseLine(`play card card-soldado-base-02 999`, snapshot);
    expect(outOfRangeParsed.kind).toBe('PARSE_ERROR');
  });
});
