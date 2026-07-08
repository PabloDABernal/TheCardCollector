import { describe, it, expect } from 'vitest';
import { createId } from '@collector/domain-shared';
import type { AbilityId } from '@collector/domain-shared';
import { createAbilityCooldownView, abilityIconGroupName } from './ability-cooldown-view';
import type { AbilityViewData } from './board-view-context';
import { createFakeBoardScene } from './test-utils/fake-board-scene';
import { createMockSnapshot } from './test-utils/mock-snapshot';
import { LEADER_ABILITIES_ROW_Y, ENEMY_ABILITIES_ROW_Y, ABILITY_ICON_SEPARATION_PX } from './board-layout';
// Copia sincronizada de `packages/data` servida por Vite (`scripts/sync-data.mjs`) — se usa esta
// ruta en vez de `packages/data/**` directamente porque el boundary de eslint (`eslint.config.mjs`)
// no permite que `combat-scene` importe del tipo `data` fuera de esta copia local ya establecida
// (mismo criterio que `load-raw-content.ts`).
import soldadoBase from '../../public/data/leaders/soldado-base.json';
import magoBase from '../../public/data/leaders/mago-base.json';
import bestiaBase from '../../public/data/enemies/bestia-base.json';
import espectroBase from '../../public/data/enemies/espectro-base.json';

function abilityId(value: string): AbilityId {
  return createId<'AbilityId'>('AbilityId', value) as AbilityId;
}

const GUARDIA_ID = abilityId('ability-soldado-base-guardia-firme');
const ARROLLAR_ID = abilityId('ability-soldado-base-arrollar');

function leaderAbilities(): AbilityViewData[] {
  return [
    { abilityId: GUARDIA_ID, name: 'Guardia Firme', baseCooldown: 1 },
    { abilityId: ARROLLAR_ID, name: 'Arrollar', baseCooldown: 3 },
  ];
}

describe('createAbilityCooldownView (H2.10)', () => {
  it('crea exactamente 1 icono (game object nombrado) por entrada de abilities', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const view = createAbilityCooldownView(scene, leaderAbilities(), 'LEADER', LEADER_ABILITIES_ROW_Y, true);
    view.update(createMockSnapshot());

    const guardiaIcons = rectangles.filter((r) => r.name === abilityIconGroupName(GUARDIA_ID));
    const arrollarIcons = rectangles.filter((r) => r.name === abilityIconGroupName(ARROLLAR_ID));

    expect(guardiaIcons).toHaveLength(1);
    expect(arrollarIcons).toHaveLength(1);
  });

  it('solo los iconos interactive:true (Líder) llevan targetId = abilityId; el Enemigo no es interactivo', () => {
    const { scene: leaderScene } = createFakeBoardScene();
    const leaderView = createAbilityCooldownView(leaderScene, leaderAbilities(), 'LEADER', LEADER_ABILITIES_ROW_Y, true);
    leaderView.update(createMockSnapshot());
    const leaderIcon = leaderScene.children.getByName(abilityIconGroupName(GUARDIA_ID)) as unknown as {
      getData(key: string): unknown;
    };
    expect(leaderIcon.getData('targetId')).toBe(GUARDIA_ID);

    const { scene: enemyScene } = createFakeBoardScene();
    const enemyView = createAbilityCooldownView(enemyScene, leaderAbilities(), 'ENEMY', ENEMY_ABILITIES_ROW_Y, false);
    enemyView.update(createMockSnapshot());
    const enemyIcon = enemyScene.children.getByName(abilityIconGroupName(GUARDIA_ID)) as unknown as {
      getData(key: string): unknown;
    };
    expect(enemyIcon.getData('targetId')).toBeUndefined();
  });

  it('update() con remaining === baseCooldown (recién gastada) seguido de remaining === 0 (lista): scaleX de iconFill pasa de un valor bajo a 1', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const view = createAbilityCooldownView(scene, [leaderAbilities()[0]!], 'LEADER', LEADER_ABILITIES_ROW_Y, true);

    view.update(
      createMockSnapshot({
        cooldowns: [{ abilityId: GUARDIA_ID, side: 'LEADER', baseCooldown: 1, remaining: 1 }],
      }),
    );
    // `iconFill` es el único Rectangle sin `name` propio (solo `iconBg` recibe `setName`).
    const iconFill = rectangles.find((r) => r.name === '')!;
    expect(iconFill.scaleX).toBe(0); // (1-1)/1 = 0

    view.update(
      createMockSnapshot({
        cooldowns: [{ abilityId: GUARDIA_ID, side: 'LEADER', baseCooldown: 1, remaining: 0 }],
      }),
    );
    expect(iconFill.scaleX).toBe(1); // (1-0)/1 = 1, tras el tween (fake síncrono)
  });

  it('update() llamado dos veces con el MISMO snapshot no dispara ningún tween adicional (idempotencia)', () => {
    const { scene, recordedTweens } = createFakeBoardScene();
    const view = createAbilityCooldownView(scene, leaderAbilities(), 'LEADER', LEADER_ABILITIES_ROW_Y, true);

    const snapshot = createMockSnapshot({
      cooldowns: [
        { abilityId: GUARDIA_ID, side: 'LEADER', baseCooldown: 1, remaining: 1 },
        { abilityId: ARROLLAR_ID, side: 'LEADER', baseCooldown: 3, remaining: 3 },
      ],
    });

    view.update(snapshot); // primera llamada: sin tween (spec §1.3, primer valor fijado directo)
    expect(recordedTweens).toHaveLength(0);

    view.update(snapshot); // segunda llamada, MISMO snapshot: remaining sin cambio, ningún tween
    expect(recordedTweens).toHaveLength(0);

    const changedSnapshot = createMockSnapshot({
      cooldowns: [
        { abilityId: GUARDIA_ID, side: 'LEADER', baseCooldown: 1, remaining: 0 },
        { abilityId: ARROLLAR_ID, side: 'LEADER', baseCooldown: 3, remaining: 3 },
      ],
    });
    view.update(changedSnapshot); // solo GUARDIA_ID cambió → exactamente 1 tween nuevo
    expect(recordedTweens).toHaveLength(1);

    view.update(changedSnapshot); // repetir el mismo snapshot de nuevo: sin tween adicional
    expect(recordedTweens).toHaveLength(1);
  });

  it('color interpolado: remaining === baseCooldown → color cercano a rojo; remaining === 0 → color cercano a verde', () => {
    const { scene, rectangles } = createFakeBoardScene();
    const view = createAbilityCooldownView(scene, [leaderAbilities()[0]!], 'LEADER', LEADER_ABILITIES_ROW_Y, true);

    view.update(
      createMockSnapshot({
        cooldowns: [{ abilityId: GUARDIA_ID, side: 'LEADER', baseCooldown: 1, remaining: 1 }],
      }),
    );
    const fillRect = rectangles.find((r) => r.name === '')!;
    expect(fillRect.fillColor).toBe(0xc0392b); // rojo puro, progreso 0

    view.update(
      createMockSnapshot({
        cooldowns: [{ abilityId: GUARDIA_ID, side: 'LEADER', baseCooldown: 1, remaining: 0 }],
      }),
    );
    expect(fillRect.fillColor).toBe(0x27ae60); // verde puro, progreso 1
  });

  it('texto: "{name} {remaining}/{baseCooldown}" cuando remaining > 0; "{name} LISTA" cuando remaining === 0', () => {
    const { scene, texts } = createFakeBoardScene();
    const view = createAbilityCooldownView(scene, leaderAbilities(), 'LEADER', LEADER_ABILITIES_ROW_Y, true);

    view.update(
      createMockSnapshot({
        cooldowns: [{ abilityId: GUARDIA_ID, side: 'LEADER', baseCooldown: 1, remaining: 1 }],
      }),
    );
    expect(texts.some((t) => t.text === 'Guardia Firme 1/1')).toBe(true);

    view.update(
      createMockSnapshot({
        cooldowns: [{ abilityId: GUARDIA_ID, side: 'LEADER', baseCooldown: 1, remaining: 0 }],
      }),
    );
    expect(texts.some((t) => t.text === 'Guardia Firme LISTA')).toBe(true);
  });
});

/**
 * FIX_combat_viewport_and_layout.md §3.2 punto 2 — regresión: `ABILITY_ICON_SEPARATION_PX` debe ser
 * suficiente para alojar la etiqueta de habilidad más larga de cada uno de los 4 roles reales del
 * catálogo MVP (2 Líderes + 2 Enemigos, 4 `baseAbilities`/`abilities` cada uno — datos LITERALES de
 * `packages/data/{leaders,enemies}/*.json`, no un mock sintético, para detectar de verdad una
 * regresión de contenido). `estimateLabelWidthPx`/`AVG_CHAR_WIDTH_PX`/`MIN_GAP_PX` son test-only,
 * NUNCA se usan en runtime (spec §2.2: no hay medición real de texto por `canvas.measureText` en el
 * entorno de test sin canvas real de `combat-scene`).
 */
describe('ABILITY_ICON_SEPARATION_PX — separación suficiente contra el catálogo real (Bug 2 §2.2)', () => {
  // Estimación conservadora/pesimista del ancho renderizado por carácter a 14px con la fuente por
  // defecto de Phaser (sans-serif del sistema) — solo para este test, no representa una medición
  // real de `Text.width`.
  const AVG_CHAR_WIDTH_PX = 8.5;
  // Margen de seguridad mínimo entre el borde derecho de una etiqueta y el borde izquierdo de la
  // siguiente, además del ancho estimado de la etiqueta.
  const MIN_GAP_PX = 8;

  function estimateLabelWidthPx(label: string): number {
    return label.length * AVG_CHAR_WIDTH_PX;
  }

  // Peor caso de longitud de etiqueta por habilidad: `remaining === baseCooldown` (recién gastada),
  // mismo número de dígitos que cualquier otro valor de `remaining` posible en el catálogo MVP
  // (todos los `baseCooldown` son de un solo dígito, 1-4) — `labelFor()` produce
  // `"{name} {remaining}/{baseCooldown}"`.
  function worstCaseLabel(ability: { readonly name: string; readonly baseCooldown: number }): string {
    return `${ability.name} ${ability.baseCooldown}/${ability.baseCooldown}`;
  }

  const catalogRoles: ReadonlyArray<{
    readonly roleName: string;
    readonly abilities: ReadonlyArray<{ readonly name: string; readonly baseCooldown: number }>;
  }> = [
    { roleName: soldadoBase.name, abilities: soldadoBase.baseAbilities },
    { roleName: magoBase.name, abilities: magoBase.baseAbilities },
    { roleName: bestiaBase.name, abilities: bestiaBase.abilities },
    { roleName: espectroBase.name, abilities: espectroBase.abilities },
  ];

  it.each(catalogRoles.map((role) => [role.roleName, role] as const))(
    'rol %s: ABILITY_ICON_SEPARATION_PX aloja la etiqueta más larga de sus 4 habilidades reales',
    (_roleName, role) => {
      expect(role.abilities.length).toBe(4); // los 4 roles del MVP fijan exactamente 4 habilidades

      const widestLabelWidthPx = Math.max(...role.abilities.map((a) => estimateLabelWidthPx(worstCaseLabel(a))));

      expect(ABILITY_ICON_SEPARATION_PX).toBeGreaterThanOrEqual(widestLabelWidthPx + MIN_GAP_PX);
    },
  );
});
