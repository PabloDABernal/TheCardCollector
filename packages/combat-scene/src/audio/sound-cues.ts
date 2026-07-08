import type { SoundCueId } from './sound-manager';
import type { AudioContextLike, OscillatorWaveform } from './audio-context-like';

/** H2.13 spec §1.2 — definición de un tono sintético: forma de onda, frecuencia y duración. */
export interface SoundCueDefinition {
  readonly waveform: OscillatorWaveform;
  readonly frequencyHz: number;
  readonly durationMs: number;
}

/** H2.13 spec §1.2 — las 5 cues mínimas del criterio de aceptación, cada una con forma de
 *  onda/frecuencia/duración distinta para ser identificable pese a ser sintética. */
export const SOUND_CUE_CONFIG: Record<SoundCueId, SoundCueDefinition> = {
  diceRoll: { waveform: 'square', frequencyHz: 220, durationMs: 150 },
  cardFlip: { waveform: 'sine', frequencyHz: 440, durationMs: 120 },
  hit: { waveform: 'sawtooth', frequencyHz: 150, durationMs: 100 },
  victory: { waveform: 'sine', frequencyHz: 880, durationMs: 400 },
  defeat: { waveform: 'sine', frequencyHz: 110, durationMs: 500 },
};

const GAIN_VALUE = 0.2;
const GAIN_FLOOR = 0.0001; // exponentialRampToValueAtTime no admite 0 exacto.

/** H2.13 spec §1.2 — crea 1 oscillator + 1 gainNode, conecta `oscillator -> gainNode ->
 *  ctx.destination`, fija `type`/`frequency` en `ctx.currentTime`, aplica una envolvente simple
 *  (rampa exponencial hacia casi-cero al final de `durationMs` para evitar un "click" audible de
 *  corte abrupto) y agenda `start`/`stop`. Sin `setTimeout`/`scene.time` — toda la temporización la
 *  gestiona el propio `AudioContext` vía su reloj (`currentTime`). Privada del módulo `audio/`, no
 *  exportada desde el barrel público (`index.ts`). */
export function playTone(ctx: AudioContextLike, def: SoundCueDefinition): void {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = def.waveform;
  oscillator.frequency.setValueAtTime(def.frequencyHz, ctx.currentTime);

  const durationSeconds = def.durationMs / 1000;
  const stopTime = ctx.currentTime + durationSeconds;

  gainNode.gain.setValueAtTime(GAIN_VALUE, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(GAIN_FLOOR, stopTime);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(ctx.currentTime);
  oscillator.stop(stopTime);
}
