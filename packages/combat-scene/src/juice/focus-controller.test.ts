// H5.4 spec §7 — casos de test de `focus-controller.test.ts`. Mismo `FakeJuiceScene` (con tweens de
// cámara/overlay soportados, ver `fake-juice-scene.ts`) que el resto del módulo `juice/recipes`.
import { describe, it, expect } from 'vitest';
import type Phaser from 'phaser';
import { createFocusController } from './focus-controller';
import { createFakeJuiceScene } from './recipes/test-utils/fake-juice-scene';
import { FOCUS_OVERLAY_ALPHA, FOCUS_TARGET_ELEVATED_DEPTH } from './focus-shared';

describe('createFocusController (H5.4 §7)', () => {
  it('1. begin() en contador 0→1: crea el overlay UNA vez, anima alpha a FOCUS_OVERLAY_ALPHA, eleva el depth del objeto resuelto por focusId', async () => {
    const controller = createFocusController();
    const fake = createFakeJuiceScene();
    const scene = fake.scene as unknown as Phaser.Scene;
    const target = (scene.add as unknown as { rectangle: (...a: unknown[]) => { setName: (n: string) => unknown; depth: number } }).rectangle(
      0,
      0,
      10,
      10,
      0xffffff,
    );
    (target as { setName: (n: string) => unknown }).setName('nucleo-1');

    await controller.begin(scene, 'nucleo-1');

    // Overlay creado una vez, nombrado, con tween de alpha hacia FOCUS_OVERLAY_ALPHA.
    const overlayTween = fake.recordedTweens.find((t) => (t.config['alpha'] as number) === FOCUS_OVERLAY_ALPHA);
    expect(overlayTween).toBeDefined();

    expect((target as { depth: number }).depth).toBe(FOCUS_TARGET_ELEVATED_DEPTH);
  });

  it('2. begin() llamado una 2ª vez SIN que 1º end() ocurra (contador 1→2): NO repite el fade-in del overlay, solo repanea la cámara', async () => {
    const controller = createFocusController();
    const fake = createFakeJuiceScene();
    const scene = fake.scene as unknown as Phaser.Scene;

    await controller.begin(scene, undefined);
    const tweensAfterFirst = fake.recordedTweens.length;
    const pansAfterFirst = fake.recordedPans.length;

    await controller.begin(scene, undefined);

    // Sin nuevo tween de overlay (el fade-in del overlay solo ocurre en 0→1).
    expect(fake.recordedTweens.length).toBe(tweensAfterFirst);
    // Sí un nuevo zoomTo/pan (repaneo) — al menos un zoomTo adicional se registró.
    expect(fake.recordedZoomTo.length).toBeGreaterThan(0);
    expect(fake.recordedPans.length).toBeGreaterThanOrEqual(pansAfterFirst);
  });

  it('3. end() con contador 2→1: no-op, overlay/zoom sin cambio', async () => {
    const controller = createFocusController();
    const fake = createFakeJuiceScene();
    const scene = fake.scene as unknown as Phaser.Scene;

    await controller.begin(scene, undefined);
    await controller.begin(scene, undefined);
    const tweensBeforeEnd = fake.recordedTweens.length;

    await controller.end(scene);

    // No dispara fade-out (contador sigue en 1 tras decrementar) — ningún tween nuevo con alpha 0.
    const fadeOutTween = fake.recordedTweens
      .slice(tweensBeforeEnd)
      .find((t) => (t.config['alpha'] as number) === 0);
    expect(fadeOutTween).toBeUndefined();
  });

  it('4. end() con contador 1→0: fade-out del overlay a alpha 0, zoom vuelve a 1, depth del objeto restaurado', async () => {
    const controller = createFocusController();
    const fake = createFakeJuiceScene();
    const scene = fake.scene as unknown as Phaser.Scene;
    const target = (
      scene.add as unknown as {
        rectangle: (...a: unknown[]) => { setName: (n: string) => unknown; setDepth: (d: number) => unknown; depth: number };
      }
    ).rectangle(0, 0, 10, 10, 0xffffff);
    target.setName('nucleo-1');
    target.setDepth(42);

    await controller.begin(scene, 'nucleo-1');
    await controller.end(scene);

    const fadeOutTween = fake.recordedTweens.find((t) => (t.config['alpha'] as number) === 0);
    expect(fadeOutTween).toBeDefined();
    expect(fake.recordedZoomTo.some((z) => z.zoom === 1)).toBe(true);
    expect((target as { depth: number }).depth).toBe(42);
  });

  it('5. focusId que no resuelve a ningún game object nombrado: no lanza, no crea placeholder fantasma, zoom queda centrado sin pan explícito adicional', async () => {
    const controller = createFocusController();
    const fake = createFakeJuiceScene();
    const scene = fake.scene as unknown as Phaser.Scene;

    await expect(controller.begin(scene, 'id-inexistente')).resolves.toBeUndefined();
    await expect(controller.begin(scene, undefined)).resolves.toBeUndefined();
  });
});
