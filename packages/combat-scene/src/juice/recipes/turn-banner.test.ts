// @vitest-environment node
//
// H4 spec §5 — `turn-banner.test.ts`: verifica selección de mensaje/color por `nextTurnOwner`,
// reuso del mismo game object entre invocaciones (sin acumular game objects huérfanos) y ausencia
// de `setInteractive()` (banner no bloqueante). Los colores pasan de los hex de Núcleo
// (`NUCLEO_COLOR_HEX.DEFENSA`/`AGRESION`) a los semánticos `--success`/`--danger` (H4 spec §5) — el
// banner de turno es un indicador de sistema, no de color de dado.
import { describe, it, expect } from 'vitest';
import { createFakeJuiceScene } from './test-utils/fake-juice-scene';
import { createTurnBannerRecipe } from './turn-banner';
import type { JuiceTarget } from '../juice-recipe';
import type { CombatEvent } from '@collector/domain-combat';

const SUCCESS_COLOR_HEX = '#4caf6f'; // = --success
const DANGER_COLOR_HEX = '#d1495b'; // = --danger

function turnEndedTarget(nextTurnOwner: 'LEADER' | 'ENEMY'): JuiceTarget {
  const event: CombatEvent = {
    type: 'TURN_ENDED',
    previousTurnOwner: nextTurnOwner === 'LEADER' ? 'ENEMY' : 'LEADER',
    nextTurnOwner,
    turnNumber: 1,
  };
  return { event };
}

describe('turnBanner', () => {
  it('nextTurnOwner: LEADER — texto "Tu turno", color --success (verde)', async () => {
    const fake = createFakeJuiceScene();
    const recipe = createTurnBannerRecipe();

    await recipe.play(fake.scene, turnEndedTarget('LEADER'), {});

    const bannerText = fake.recordedTexts[0]!;
    expect(bannerText.text).toBe('Tu turno');
    expect(bannerText.color).toBe(SUCCESS_COLOR_HEX);
  });

  it('nextTurnOwner: ENEMY — texto "Turno del Enemigo", color --danger (rojo)', async () => {
    const fake = createFakeJuiceScene();
    const recipe = createTurnBannerRecipe();

    await recipe.play(fake.scene, turnEndedTarget('ENEMY'), {});

    const bannerText = fake.recordedTexts[0]!;
    expect(bannerText.text).toBe('Turno del Enemigo');
    expect(bannerText.color).toBe(DANGER_COLOR_HEX);
  });

  it('reutiliza el mismo Rectangle/Text entre invocaciones — no crea game objects nuevos en la 2ª llamada', async () => {
    const fake = createFakeJuiceScene();
    const recipe = createTurnBannerRecipe();

    await recipe.play(fake.scene, turnEndedTarget('LEADER'), {});
    const textsAfterFirst = fake.recordedTexts.length;

    await recipe.play(fake.scene, turnEndedTarget('ENEMY'), {});

    expect(fake.recordedTexts).toHaveLength(textsAfterFirst); // no nuevo Text creado
    expect(fake.recordedTexts[0]!.text).toBe('Turno del Enemigo'); // el mismo Text, actualizado
  });

  it('sin setInteractive() en el Rectangle — nunca bloquea input (banner no bloqueante)', async () => {
    const fake = createFakeJuiceScene();
    const recipe = createTurnBannerRecipe();

    // Si `turnBanner.play` llamara a `setInteractive()` sobre un objeto que no lo implementa,
    // esto lanzaría — la propia ejecución sin excepción ya es la prueba negativa mínima. Además,
    // el fake no rastrea "interactive" en ningún tracker, así que no hay estado que consultar:
    // el criterio real (spec §3.4) es "no captura el puntero", verificado por ausencia de llamada.
    await expect(recipe.play(fake.scene, turnEndedTarget('LEADER'), {})).resolves.toBeUndefined();
  });

  it('respeta holdMs de params — la secuencia total sigue siendo fade-in(150) + hold + fade-out(150)', async () => {
    const fake = createFakeJuiceScene({ autoComplete: false });
    const recipe = createTurnBannerRecipe();

    let resolved = false;
    const playPromise = recipe.play(fake.scene, turnEndedTarget('LEADER'), { holdMs: 1000 }).then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);
    const chainConfig = fake.recordedTweens[0]!.config;
    const legs = chainConfig['tweens'] as Array<{ duration: number }>;
    expect(legs.map((l) => l.duration)).toEqual([150, 1000, 150]);

    fake.completeTween(0);
    await playPromise;
    expect(resolved).toBe(true);
  });

  it('evento distinto de TURN_ENDED: no crea ningún game object, resuelve inmediatamente', async () => {
    const fake = createFakeJuiceScene();
    const recipe = createTurnBannerRecipe();

    await recipe.play(
      fake.scene,
      { event: { type: 'CARD_PLAYED', cardId: 'x' as never, sourceId: 'y', leaderEnergyAfter: 1 } },
      {},
    );

    expect(fake.recordedTexts).toHaveLength(0);
    expect(fake.recordedTweens).toHaveLength(0);
  });
});
