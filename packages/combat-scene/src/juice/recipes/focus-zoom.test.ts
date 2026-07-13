import { describe, it, expect, vi } from 'vitest';
import type Phaser from 'phaser';
import { createFocusZoomRecipe } from './focus-zoom';
import { createFakeJuiceScene } from './test-utils/fake-juice-scene';

function createFakeFocusController() {
  return { begin: vi.fn(async () => {}), end: vi.fn(async () => {}) };
}

describe('focusZoom (H5.4 §4.1)', () => {
  it('sin focusId resoluble: solo zoomTo, sin pan', async () => {
    const recipe = createFocusZoomRecipe(createFakeFocusController());
    const fake = createFakeJuiceScene();

    await recipe.play(fake.scene as unknown as Phaser.Scene, { event: { type: 'ABILITY_ACTIVATED' } as never }, {});

    expect(fake.recordedZoomTo).toHaveLength(1);
    expect(fake.recordedZoomTo[0]!.zoom).toBe(1.25);
    expect(fake.recordedPans).toHaveLength(0);
  });

  it('con focusId resoluble: zoomTo + pan hacia la posición del objeto', async () => {
    const recipe = createFocusZoomRecipe(createFakeFocusController());
    const fake = createFakeJuiceScene();
    const scene = fake.scene as unknown as Phaser.Scene;
    const target = (scene.add as unknown as { rectangle: (...a: unknown[]) => { setName: (n: string) => unknown } }).rectangle(
      123,
      456,
      10,
      10,
      0xffffff,
    );
    (target as { setName: (n: string) => unknown }).setName('nucleo-1');

    await recipe.play(scene, { event: { type: 'ABILITY_ACTIVATED' } as never, focusId: 'nucleo-1' }, { zoomLevel: 1.3, durationMs: 200 });

    expect(fake.recordedZoomTo).toEqual([{ zoom: 1.3, duration: 200 }]);
    expect(fake.recordedPans).toEqual([{ x: 123, y: 456, duration: 200 }]);
  });
});
