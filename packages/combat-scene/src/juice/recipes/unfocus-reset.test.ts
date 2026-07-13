import { describe, it, expect, vi } from 'vitest';
import type Phaser from 'phaser';
import { createUnfocusResetRecipe } from './unfocus-reset';
import { createFakeJuiceScene } from './test-utils/fake-juice-scene';
import { COMBAT_SCENE_VIEWPORT } from '../../view/board-layout';

function createFakeFocusController() {
  return { begin: vi.fn(async () => {}), end: vi.fn(async () => {}) };
}

describe('unfocusReset (H5.4 §4.3)', () => {
  it('fade-out del overlay a alpha 0 + zoomTo(1) + pan al centro neutro del viewport', async () => {
    const recipe = createUnfocusResetRecipe(createFakeFocusController());
    const fake = createFakeJuiceScene();

    await recipe.play(fake.scene as unknown as Phaser.Scene, { event: { type: 'ABILITY_ACTIVATED' } as never }, {});

    const fadeOutTween = fake.recordedTweens.find((t) => (t.config['alpha'] as number) === 0);
    expect(fadeOutTween).toBeDefined();
    expect(fake.recordedZoomTo).toEqual([{ zoom: 1, duration: 200 }]);
    expect(fake.recordedPans).toEqual([
      { x: COMBAT_SCENE_VIEWPORT.width / 2, y: COMBAT_SCENE_VIEWPORT.height / 2, duration: 200 },
    ]);
  });
});
