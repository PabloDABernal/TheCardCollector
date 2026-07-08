/** DESVIACIÓN documentada respecto al contrato literal de la spec (que usa el tipo `OscillatorType`
 *  de la lib DOM de TypeScript): `tsconfig.base.json` de este monorepo fija `"lib": ["ES2022"]` sin
 *  `"DOM"` (ningún otro módulo de `combat-scene` depende de tipos DOM globales hasta esta historia).
 *  Se define aquí una unión local con los mismos 4 valores reales que expone
 *  `OscillatorNode.type`/`SOUND_CUE_CONFIG` (§1.2) — estructuralmente compatible con el `OscillatorType`
 *  real del navegador en runtime (mismos strings), sin necesitar añadir `"DOM"` al `lib` del paquete. */
export type OscillatorWaveform = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'custom';

/** H2.13 spec §1.1 — abstracción mínima de Web Audio consumida por `sound-manager.ts`. Permite
 *  inyectar un fake en tests (jsdom no implementa `AudioContext`) sin que el módulo de producción
 *  toque `window.AudioContext` directamente. Solo modela la superficie realmente usada por
 *  `playTone` (`sound-cues.ts`) — no un contrato exhaustivo de Web Audio. */
export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: unknown;
  readonly state: 'suspended' | 'running' | 'closed';
  createOscillator(): OscillatorLike;
  createGain(): GainNodeLike;
  resume(): Promise<void>;
}

export interface OscillatorLike {
  type: OscillatorWaveform;
  readonly frequency: { setValueAtTime(value: number, time: number): void };
  connect(destination: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface GainNodeLike {
  readonly gain: {
    setValueAtTime(value: number, time: number): void;
    exponentialRampToValueAtTime(value: number, endTime: number): void;
  };
  connect(destination: unknown): unknown;
}
