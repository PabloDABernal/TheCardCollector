// Fix Reviewer post-H4 — jsdom no implementa `AnimationEvent`/`TransitionEvent`. Sin este polyfill,
// `react-dom`'s bootstrap (`getVendorPrefixedEventName`, ejecutado UNA VEZ al importarse el módulo)
// detecta `!('AnimationEvent' in window)` y cae a un nombre de evento vendor-prefixed
// (`webkitAnimationEnd`, porque jsdom sí expone `'WebkitAnimation' in style`) en vez del estándar
// `animationend` — por lo que `onAnimationEnd`/`fireEvent.animationEnd(...)` en tests de React Testing
// Library nunca dispara el handler bajo jsdom (confirmado con `getVendorPrefixedEventName` en
// `node_modules/react-dom/cjs/react-dom.development.js`).
//
// DEBE ejecutarse (como `setupFiles`, `vitest.config.ts`) ANTES de que se importe `react-dom` por
// primera vez — de ahí que sea un archivo de `setupFiles` propio, sin ningún import, listado antes de
// `test-setup.ts` (que sí importa `@testing-library/react`, arrastrando `react-dom`). Los imports ESM
// se resuelven/evalúan por archivo de `setupFiles` en orden secuencial, así que este polyfill queda
// aplicado antes de que el bootstrap de `react-dom` lea `window.AnimationEvent`.
if (typeof window !== 'undefined' && !('AnimationEvent' in window)) {
  class AnimationEventPolyfill extends Event {
    readonly animationName: string;
    readonly elapsedTime: number;
    readonly pseudoElement: string;

    constructor(type: string, init: AnimationEventInit = {}) {
      super(type, init);
      this.animationName = init.animationName ?? '';
      this.elapsedTime = init.elapsedTime ?? 0;
      this.pseudoElement = init.pseudoElement ?? '';
    }
  }

  (window as unknown as { AnimationEvent: typeof AnimationEventPolyfill }).AnimationEvent =
    AnimationEventPolyfill;
}

export {};
