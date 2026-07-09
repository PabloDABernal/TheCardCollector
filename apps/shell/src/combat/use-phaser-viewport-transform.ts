import { useEffect, useState, type RefObject } from 'react';
import { COMBAT_SCENE_VIEWPORT } from '@collector/combat-scene';

/**
 * H4 spec §2.3 — transform CSS vigente para convertir coordenadas del viewport virtual
 * (`COMBAT_SCENE_VIEWPORT`, 1080×1920, las MISMAS que `board-layout.ts` ya usa) a posición real en
 * pantalla, dado el escalado uniforme que `Phaser.Scale.FIT` aplica al `<canvas>` real.
 */
export interface PhaserViewportTransform {
  readonly scale: number; // factor uniforme aplicado por Phaser.Scale.FIT
  readonly offsetX: number; // píxeles CSS entre el borde del contenedor y el borde real del canvas
  readonly offsetY: number;
}

const IDENTITY_TRANSFORM: PhaserViewportTransform = { scale: 1, offsetX: 0, offsetY: 0 };

/**
 * Observa el elemento `<canvas>` real de Phaser (vía `ResizeObserver` sobre `mountRef.current`, más
 * `MutationObserver` para el instante en que Phaser inserta el `<canvas>` de forma asíncrona tras el
 * evento `READY`) y devuelve el transform CSS vigente. Recalcula en cada resize/orientationchange —
 * mismo evento que ya dispara el recálculo interno de `Phaser.Scale.FIT`.
 *
 * `mountRef` debe apuntar al mismo `<div>` que se pasa como `parent` a `new Phaser.Game(...)`
 * (`#phaser-mount` en `CombatScreen.tsx`), que ocupa el 100% de `.combat-screen-root` — el mismo
 * origen (0,0) que usa `CombatBoardOverlay` como ancestro posicionado.
 */
export function usePhaserViewportTransform(
  mountRef: RefObject<HTMLDivElement>,
): PhaserViewportTransform {
  const [transform, setTransform] = useState<PhaserViewportTransform>(IDENTITY_TRANSFORM);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return undefined;

    function recompute(): void {
      const canvas = mountEl!.querySelector('canvas');
      if (!canvas) return;
      const mountRect = mountEl!.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      if (canvasRect.width === 0) return; // canvas insertado pero aún sin layout medido

      setTransform({
        scale: canvasRect.width / COMBAT_SCENE_VIEWPORT.width,
        offsetX: canvasRect.left - mountRect.left,
        offsetY: canvasRect.top - mountRect.top,
      });
    }

    recompute();

    // `ResizeObserver`/`MutationObserver` no existen en jsdom (entorno de tests) — igual que
    // `CombatScreen.test.tsx` ya documenta que jsdom no calcula layout real (`clientWidth`/
    // `clientHeight` siempre 0), esta capa de observación se omite por completo bajo test: el valor
    // inicial (`recompute()` de arriba, sin-op si el canvas aún no mide nada) ya es correcto y
    // estable, y el resize/orientationchange real se cubre por el E2E de Playwright.
    const hasResizeObserver = typeof ResizeObserver !== 'undefined';
    const hasMutationObserver = typeof MutationObserver !== 'undefined';

    const resizeObserver = hasResizeObserver ? new ResizeObserver(recompute) : null;
    resizeObserver?.observe(mountEl);

    // El <canvas> no existe todavía en el momento en que este efecto se monta (Phaser lo crea de
    // forma asíncrona tras `Phaser.Core.Events.READY`, ver `CombatScreen.tsx`) — un
    // MutationObserver detecta su inserción sin depender de que llegue un resize/orientationchange
    // real para pintar el primer transform correcto.
    const mutationObserver = hasMutationObserver ? new MutationObserver(recompute) : null;
    mutationObserver?.observe(mountEl, { childList: true });

    window.addEventListener('resize', recompute);
    window.addEventListener('orientationchange', recompute);

    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', recompute);
      window.removeEventListener('orientationchange', recompute);
    };
  }, [mountRef]);

  return transform;
}
