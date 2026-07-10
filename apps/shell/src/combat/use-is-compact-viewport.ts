import { useEffect, useState } from 'react';

/** H4 spec §4 — mismo breakpoint que `.combat-hud` en `CombatScreen.css` (`@media (max-width:
 *  480px)`), MISMO valor, mantener sincronizados. Solo gobierna qué TEXTO se renderiza (los
 *  tamaños/paddings ya responden vía CSS `var()`, ver H4_hud_compacto_movil.md §3) — evita duplicar
 *  lógica de layout en JS que el CSS ya resuelve.
 *
 *  Mismo patrón de suscripción/cleanup que `use-phaser-viewport-transform.ts` ya usa para medir
 *  tamaño real. */
const COMPACT_VIEWPORT_BREAKPOINT_PX = 480;

function computeIsCompactViewport(): boolean {
  return window.innerWidth <= COMPACT_VIEWPORT_BREAKPOINT_PX;
}

export function useIsCompactViewport(): boolean {
  const [isCompact, setIsCompact] = useState<boolean>(() => computeIsCompactViewport());

  useEffect(() => {
    function handleResize(): void {
      setIsCompact(computeIsCompactViewport());
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return isCompact;
}
