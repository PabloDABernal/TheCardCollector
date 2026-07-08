import type { AudioContextLike, GainNodeLike, OscillatorLike, OscillatorWaveform } from '../audio-context-like';

/** H2.13 spec §4.1 — registro de todas las llamadas hechas a un `OscillatorLike` fake, para
 *  aserciones exactas en `sound-manager.test.ts`. */
export interface RecordedOscillator {
  readonly type: OscillatorWaveform;
  readonly frequencySetCalls: Array<{ value: number; time: number }>;
  readonly startCalls: number[];
  readonly stopCalls: number[];
}

/** H2.13 spec §4.1 — mismo espíritu que `FakeJuiceScene`: implementa solo la superficie de
 *  `AudioContextLike` consumida por `playTone`/`SoundManager`, registrando cada llamada. */
export interface FakeAudioContext {
  readonly ctx: AudioContextLike;
  readonly recordedOscillators: RecordedOscillator[];
  currentTime: number;
  state: 'suspended' | 'running' | 'closed';
}

class MutableRecordedOscillator implements RecordedOscillator {
  type: OscillatorWaveform = 'sine';
  readonly frequencySetCalls: Array<{ value: number; time: number }> = [];
  readonly startCalls: number[] = [];
  readonly stopCalls: number[] = [];
}

function createFakeOscillator(recorded: MutableRecordedOscillator): OscillatorLike {
  return {
    get type(): OscillatorWaveform {
      return recorded.type;
    },
    set type(value: OscillatorWaveform) {
      recorded.type = value;
    },
    frequency: {
      setValueAtTime(value: number, time: number): void {
        recorded.frequencySetCalls.push({ value, time });
      },
    },
    connect(): unknown {
      return undefined;
    },
    start(when?: number): void {
      recorded.startCalls.push(when ?? 0);
    },
    stop(when?: number): void {
      recorded.stopCalls.push(when ?? 0);
    },
  };
}

function createFakeGainNode(): GainNodeLike {
  return {
    gain: {
      setValueAtTime(): void {
        // no-op — no ejercitado por ninguna aserción de §4.1, solo necesita no lanzar.
      },
      exponentialRampToValueAtTime(): void {
        // no-op — idem.
      },
    },
    connect(): unknown {
      return undefined;
    },
  };
}

/** Fabrica un `FakeAudioContext` — `state` arranca en `'suspended'` (mismo comportamiento que un
 *  `AudioContext` real recién construido en un navegador con la autoplay policy activa, §1.1/§1.7):
 *  solo `resume()` (disparado por `SoundManager.unlock()`) lo lleva a `'running'`. */
export function createFakeAudioContext(): FakeAudioContext {
  const recordedOscillators: RecordedOscillator[] = [];

  const fake: FakeAudioContext = {
    currentTime: 0,
    state: 'suspended',
    ctx: null as unknown as AudioContextLike, // asignado justo debajo, antes de devolver `fake`.
    recordedOscillators,
  };

  const ctx: AudioContextLike = {
    get currentTime(): number {
      return fake.currentTime;
    },
    destination: {},
    get state(): 'suspended' | 'running' | 'closed' {
      return fake.state;
    },
    createOscillator(): OscillatorLike {
      const recorded = new MutableRecordedOscillator();
      recordedOscillators.push(recorded);
      return createFakeOscillator(recorded);
    },
    createGain(): GainNodeLike {
      return createFakeGainNode();
    },
    resume(): Promise<void> {
      fake.state = 'running';
      return Promise.resolve();
    },
  };

  (fake as { ctx: AudioContextLike }).ctx = ctx;

  return fake;
}

/** H2.13 doc — variante de `createFakeAudioContext()` donde `resume()` NO muta `state` de forma
 *  síncrona: en su lugar, devuelve una promesa que solo resuelve (y entonces sí muta `state` a
 *  `'running'`) tras un microtask (`await Promise.resolve()`), igual que un `AudioContext` real.
 *  Existe solo para ejercitar/documentar la ventana de carrera conocida de `SoundManager.unlock()`
 *  (ver comentario en `sound-manager.ts`) — el fake "por defecto" (`createFakeAudioContext`) sigue
 *  siendo el usado por el resto de la suite, con `resume()` síncrono por simplicidad de aserciones. */
export function createFakeAudioContextWithAsyncResume(): FakeAudioContext {
  const recordedOscillators: RecordedOscillator[] = [];

  const fake: FakeAudioContext = {
    currentTime: 0,
    state: 'suspended',
    ctx: null as unknown as AudioContextLike, // asignado justo debajo, antes de devolver `fake`.
    recordedOscillators,
  };

  const ctx: AudioContextLike = {
    get currentTime(): number {
      return fake.currentTime;
    },
    destination: {},
    get state(): 'suspended' | 'running' | 'closed' {
      return fake.state;
    },
    createOscillator(): OscillatorLike {
      const recorded = new MutableRecordedOscillator();
      recordedOscillators.push(recorded);
      return createFakeOscillator(recorded);
    },
    createGain(): GainNodeLike {
      return createFakeGainNode();
    },
    async resume(): Promise<void> {
      await Promise.resolve();
      fake.state = 'running';
    },
  };

  (fake as { ctx: AudioContextLike }).ctx = ctx;

  return fake;
}
