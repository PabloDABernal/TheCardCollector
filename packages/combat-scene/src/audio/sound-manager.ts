import type { AudioContextLike } from './audio-context-like';
import { SOUND_CUE_CONFIG, playTone } from './sound-cues';

/** H2.13 spec §1.1 — las 5 cues mínimas del criterio de aceptación. */
export type SoundCueId = 'diceRoll' | 'cardFlip' | 'hit' | 'victory' | 'defeat';

/** H2.13 spec §1.1 — abstracción propia de `combat-scene/audio`, Web Audio API cruda
 *  (`AudioContext.createOscillator()`), NO `Phaser.Sound.BaseSoundManager` (ver spec §0.1). */
export interface SoundManager {
  /** Debe llamarse dentro del handler síncrono de un gesto real del usuario (§1.6/§1.7) — crea/
   *  reanuda el `AudioContext` interno si aún no existe o está `suspended`. Idempotente: llamadas
   *  repetidas tras el primer desbloqueo son no-op barato (comprueba `state` antes de actuar). */
  unlock(): void;
  /** Reproduce el tono sintético de `cueId` (§1.2). Si el `AudioContext` todavía no existe (nunca
   *  se llamó `unlock()`, o el entorno no soporta Web Audio) o sigue `suspended`, no-op silencioso
   *  (con log opcional si `debug`, §1.8) — nunca lanza. */
  play(cueId: SoundCueId): void;
}

export interface CreateWebAudioSoundManagerOptions {
  /** Inyección de test — evita depender de `window.AudioContext` global. Por defecto, busca
   *  `globalThis.AudioContext ?? globalThis.webkitAudioContext`; si ninguno existe (jsdom, SSR), el
   *  `SoundManager` queda permanentemente en modo no-op silencioso. */
  readonly audioContextFactory?: () => AudioContextLike;
  /** Por defecto `false`. Si `true`, cada `unlock()`/`play()` loguea vía `console.log`
   *  (`'[SoundManager] ...'`) — verificación manual con Playwright (§1.8). */
  readonly debug?: boolean;
}

type GlobalWithWebAudio = typeof globalThis & {
  AudioContext?: new () => AudioContextLike;
  webkitAudioContext?: new () => AudioContextLike;
};

function defaultAudioContextFactory(): AudioContextLike {
  const globalWithWebAudio = globalThis as GlobalWithWebAudio;
  const Ctor = globalWithWebAudio.AudioContext ?? globalWithWebAudio.webkitAudioContext;
  if (!Ctor) {
    throw new Error('No AudioContext constructor available in this environment.');
  }
  return new Ctor();
}

/** Único punto de construcción del `SoundManager` real de producción — mismo patrón que
 *  `createCombatBridge`/`createEffectsDirector` (sin `new` expuesto). Construcción PEREZOSA del
 *  `AudioContext` (§1.1): nunca se instancia aquí ni en el momento de invocar esta fábrica — solo la
 *  primera llamada efectiva a `unlock()`/`play()` intenta `audioContextFactory()`. Si la fábrica no
 *  encuentra ningún constructor disponible, la instancia queda en no-op permanente, nunca lanza. */
export function createWebAudioSoundManager(options: CreateWebAudioSoundManagerOptions = {}): SoundManager {
  const audioContextFactory = options.audioContextFactory ?? defaultAudioContextFactory;
  const debug = options.debug ?? false;

  let ctx: AudioContextLike | null = null;
  let constructionAttempted = false;

  function log(message: string): void {
    if (debug) {
      console.log(message);
    }
  }

  /** Devuelve el `AudioContext` ya construido, o intenta construirlo UNA sola vez (memoizado vía
   *  `constructionAttempted`) si todavía no existe. `null` permanente si la fábrica no encuentra
   *  soporte de Web Audio en este entorno — nunca reintenta ni lanza hacia el caller. */
  function ensureContext(): AudioContextLike | null {
    if (ctx) {
      return ctx;
    }
    if (constructionAttempted) {
      return null;
    }
    constructionAttempted = true;
    try {
      ctx = audioContextFactory();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  return {
    unlock(): void {
      const contextAlreadyExisted = ctx !== null;
      const context = ensureContext();
      if (!context) {
        return;
      }

      // "Efectivo" (§1.8) cubre las dos transiciones reales de desbloqueo: construcción del
      // `AudioContext` en sí (primera llamada, sea cual sea el `state` inicial que le dé el
      // navegador/fake) O una reanudación real desde `suspended` en una llamada posterior.
      // Llamadas repetidas tras el primer desbloqueo son no-op barato (§1.1): ni reconstruyen ni
      // vuelven a `resume()`/loguear.
      const wasSuspended = context.state === 'suspended';
      if (wasSuspended) {
        // LIMITACIÓN CONOCIDA (MVP, H2.13): `resume()` fire-and-forget. En un `AudioContext` real,
        // `resume()` es asíncrono — `state` no pasa a `'running'` de forma síncrona, tarda uno o
        // varios microtasks/eventos. `play()` gatea en `context.state === 'running'` (ver abajo), así
        // que si un `CombatEvent` (ej. CARD_PLAYED) llega justo después del `pointerdown` que dispara
        // este `unlock()` pero ANTES de que la promesa de `resume()` resuelva, esa reproducción se
        // descarta en silencio — sin cola ni replay — porque `play()` no espera ni reintenta.
        // Se acepta para este MVP porque el audio es un stub de tonos sintéticos (§1.13 de
        // decisions.md), no arte final, y la ventana de carrera es de microtasks (soundcues cortos,
        // impacto perceptual mínimo). El `FakeAudioContext` de test resuelve `state` de forma
        // síncrona, así que esta ventana NO se ejercita en los tests salvo variante explícita
        // (ver 'resume() asíncrono' en sound-manager.test.ts).
        // Para resolverlo de verdad en el futuro: encolar la(s) cue(s) pendientes durante el `unlock()`
        // en curso y reproducirlas cuando la promesa de `resume()` resuelva, o hacer que `play()`
        // espere/awaite esa promesa antes de decidir si reproduce (con el coste de que `play()` deje
        // de ser síncrono).
        void context.resume();
      }
      if (!contextAlreadyExisted || wasSuspended) {
        log('[SoundManager] unlocked');
      }
    },
    play(cueId: SoundCueId): void {
      const context = ensureContext();
      // Reproducir con el `AudioContext` todavía `suspended` (nunca desbloqueado por un gesto
      // real) no sonaría en un navegador real — mismo criterio de "no-op silencioso" que la
      // ausencia total de contexto (§1.1/§1.7): el jugador siempre interactúa antes de que pase
      // algo en el flujo real, así que este caso no debería alcanzarse en producción.
      if (!context || context.state !== 'running') {
        log(`[SoundManager] play skipped (no AudioContext): ${cueId}`);
        return;
      }
      playTone(context, SOUND_CUE_CONFIG[cueId]);
      log(`[SoundManager] playing cue: ${cueId}`);
    },
  };
}
