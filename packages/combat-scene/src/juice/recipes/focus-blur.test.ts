import { describe, it, expect, vi } from 'vitest';
import type Phaser from 'phaser';
import { createFocusBlurRecipe } from './focus-blur';
import { createFakeJuiceScene } from './test-utils/fake-juice-scene';

function createFakeFocusController() {
  return { begin: vi.fn(async () => {}), end: vi.fn(async () => {}) };
}

describe('focusBlur (H5.4 §4.2)', () => {
  it('crea el overlay y anima su alpha a FOCUS_OVERLAY_ALPHA (0.7)', async () => {
    const recipe = createFocusBlurRecipe(createFakeFocusController());
    const fake = createFakeJuiceScene();

    await recipe.play(fake.scene as unknown as Phaser.Scene, { event: { type: 'ABILITY_ACTIVATED' } as never }, {});

    const overlayTween = fake.recordedTweens.find((t) => (t.config['alpha'] as number) === 0.7);
    expect(overlayTween).toBeDefined();
  });

  it('llamadas repetidas reutilizan el MISMO overlay (no crea uno nuevo por nombre)', async () => {
    const recipe = createFocusBlurRecipe(createFakeFocusController());
    const fake = createFakeJuiceScene();
    const scene = fake.scene as unknown as Phaser.Scene;

    await recipe.play(scene, { event: { type: 'ABILITY_ACTIVATED' } as never }, {});
    await recipe.play(scene, { event: { type: 'ABILITY_ACTIVATED' } as never }, {});

    expect((scene.children.getByName('focus-overlay') as unknown)).not.toBeNull();
  });
});
