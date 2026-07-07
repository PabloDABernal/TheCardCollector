// @vitest-environment node
//
// Este test invoca directamente `buildHelloCombatResult` (lógica pura, sin
// `Phaser.Scene`) — no necesita `window`/`document`. Se fuerza el entorno `node` (en
// vez del `jsdom` por defecto del paquete, ver vitest.config.ts) porque bajo `jsdom`
// `import.meta.url` deja de resolver a una URL `file://` real (Vitest la reescribe a un
// path `/@fs/...` de estilo navegador), rompiendo la resolución de rutas de
// `readFileSync` en `load-raw-content.ts`.
import { describe, it, expect } from 'vitest';
import { buildHelloCombatResult } from './scenes/build-hello-engine';

/**
 * Verificación funcional automatizada de H2.1 (spec §4.2) — sin levantar un navegador
 * real. Prueba, de forma determinista, que `combat-scene` puede importar y ejecutar
 * `domain-combat`/`domain-catalog` reales contra el contenido real 2×2×2 de
 * `packages/data` (leader-soldado-base / enemy-bestia-base /
 * scenario-bosque-encantado-base), el mismo contrato que consumirá `apps/shell` en
 * H2.2+.
 */
describe('HelloCombatScene — construcción real de CombatEngine (H2.1)', () => {
  it('arranca en turno 1, con vida completa de Líder/Enemigo y un pool de Núcleos válido', async () => {
    const { snapshot, leaderMaxHealth, enemyMaxHealth } = await buildHelloCombatResult();

    expect(snapshot.turn.turnNumber).toBe(1);

    // leader-soldado-base / enemy-bestia-base (mismos valores que H1.18 / packages/cli).
    expect(leaderMaxHealth).toBe(30);
    expect(enemyMaxHealth).toBe(60);
    expect(snapshot.leaderDamage).toBe(0);
    expect(snapshot.enemyDamage).toBe(0);

    // pool inicial de Núcleos: cardinalidad 5+1 (DEFAULT_NUCLEO_POOL_SIZE), valores en [1,4].
    expect(snapshot.nucleoPool).toHaveLength(6);
    for (const nucleo of snapshot.nucleoPool) {
      expect(nucleo.value).toBeGreaterThanOrEqual(1);
      expect(nucleo.value).toBeLessThanOrEqual(4);
    }
  });
});
