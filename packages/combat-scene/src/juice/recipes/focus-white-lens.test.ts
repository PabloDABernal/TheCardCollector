import { describe, it, expect } from 'vitest';
import type Phaser from 'phaser';
import { focusWhiteLens } from './focus-white-lens';
import { createFakeJuiceScene } from './test-utils/fake-juice-scene';

describe('focusWhiteLens (H5.4 §4.4)', () => {
  it('crea un flash blanco a pantalla completa que anima de 0.8 a 0 y se destruye al terminar', async () => {
    const fake = createFakeJuiceScene();

    await focusWhiteLens.play(fake.scene as unknown as Phaser.Scene, { event: { type: 'ABILITY_ACTIVATED' } as never }, {});

    const flashTween = fake.recordedTweens.find((t) => (t.config['alpha'] as number) === 0);
    expect(flashTween).toBeDefined();
    expect(flashTween!.config['duration']).toBe(100);
  });
});
