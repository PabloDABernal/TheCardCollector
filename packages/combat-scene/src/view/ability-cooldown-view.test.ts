import { describe, it, expect } from 'vitest';
import { createId } from '@collector/domain-shared';
import type { AbilityId } from '@collector/domain-shared';
import { createAbilityCooldownView, abilityIconGroupName } from './ability-cooldown-view';
import type { AbilityViewData } from './board-view-context';
import { createFakeBoardScene } from './test-utils/fake-board-scene';
import { createMockSnapshot } from './test-utils/mock-snapshot';
import { LEADER_ABILITIES_ROW_Y, ENEMY_ABILITIES_ROW_Y } from './board-layout';

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
