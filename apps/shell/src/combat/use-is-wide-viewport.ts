import { useEffect, useState } from 'react';

/** H5.8 §3.2 — mismo patrón de suscripción/cleanup que `use-is-compact-viewport.ts`, invertido:
 *  `true` cuando hay margen lateral libre real suficiente para convertir `CombatLogPanel` en un
 *  sidebar persistente (`variant='sidebar'`) en vez de la franja "peek" (`variant='peek'`, H4). */
const WIDE_VIEWPORT_BREAKPOINT_PX = 1100;

function computeIsWideViewport(): boolean {
  return window.innerWidth >= WIDE_VIEWPORT_BREAKPOINT_PX;
}

export function useIsWideViewport(): boolean {
  const [isWide, setIsWide] = useState<boolean>(() => computeIsWideViewport());

  useEffect(() => {
    function handleResize(): void {
      setIsWide(computeIsWideViewport());
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return isWide;
}
