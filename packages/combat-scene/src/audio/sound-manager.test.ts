// @vitest-environment node
//
// H2.13 spec §4.1 — `SoundManager` real (`createWebAudioSoundManager`) contra un `FakeAudioContext`
// inyectado vía `audioContextFactory`, sin depender de `AudioContext` real (jsdom no lo implementa).
import { describe, it, expect, vi } from 'vitest';
import { createWebAudioSoundManager } from './sound-manager';
import type { SoundCueId } from './sound-manager';
import { SOUND_CUE_CONFIG } from './sound-cues';
import { createFakeAudioContext } from './test-utils/fake-audio-context';

describe('createWebAudioSoundManager (H2.13 spec §4.1)', () => {
  it('play() ANTES de unlock(): ningún createOscillator registrado (no-op)', () => {
    const fake = createFakeAudioContext();
    const soundManager = createWebAudioSoundManager({ audioContextFactory: () => fake.ctx });

    soundManager.play('hit');

    expect(fake.recordedOscillators).toHaveLength(0);
  });

  it('unlock() + play("hit"): 1 createOscillator con type/frequency/duración de SOUND_CUE_CONFIG.hit', () => {
    const fake = createFakeAudioContext();
    const soundManager = createWebAudioSoundManager({ audioContextFactory: () => fake.ctx });

    soundManager.unlock();
    soundManager.play('hit');

    expect(fake.recordedOscillators).toHaveLength(1);
    const [oscillator] = fake.recordedOscillators;
    expect(oscillator!.type).toBe('sawtooth');
    expect(oscillator!.frequencySetCalls).toEqual([{ value: 150, time: fake.currentTime }]);
    expect(oscillator!.startCalls).toHaveLength(1);
    expect(oscillator!.stopCalls).toHaveLength(1);
    expect(oscillator!.stopCalls[0]! - oscillator!.startCalls[0]!).toBeCloseTo(0.1, 5);
  });

  const ALL_CUE_IDS: SoundCueId[] = ['diceRoll', 'cardFlip', 'hit', 'victory', 'defeat'];

  it.each(ALL_CUE_IDS)('unlock() + play("%s"): type/frequencyHz/durationMs exactos de SOUND_CUE_CONFIG', (cueId) => {
    const fake = createFakeAudioContext();
    const soundManager = createWebAudioSoundManager({ audioContextFactory: () => fake.ctx });
    const def = SOUND_CUE_CONFIG[cueId];

    soundManager.unlock();
    soundManager.play(cueId);

    expect(fake.recordedOscillators).toHaveLength(1);
    const [oscillator] = fake.recordedOscillators;
    expect(oscillator!.type).toBe(def.waveform);
    expect(oscillator!.frequencySetCalls).toEqual([{ value: def.frequencyHz, time: fake.currentTime }]);
    expect(oscillator!.stopCalls[0]! - oscillator!.startCalls[0]!).toBeCloseTo(def.durationMs / 1000, 5);
  });

  it('unlock() llamado dos veces seguidas: audioContextFactory invocado una sola vez', () => {
    const fake = createFakeAudioContext();
    const audioContextFactory = vi.fn(() => fake.ctx);
    const soundManager = createWebAudioSoundManager({ audioContextFactory });

    soundManager.unlock();
    soundManager.unlock();

    expect(audioContextFactory).toHaveBeenCalledTimes(1);
  });

  it('sin audioContextFactory y sin globalThis.AudioContext/webkitAudioContext (jsdom real): play() no lanza, no-op silencioso', () => {
    const soundManager = createWebAudioSoundManager();

    expect(() => soundManager.play('hit')).not.toThrow();
    expect(() => soundManager.unlock()).not.toThrow();
  });

  it('debug: true — unlock()/play() invocan console.log con los mensajes exactos de §1.8', () => {
    const fake = createFakeAudioContext();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      const soundManager = createWebAudioSoundManager({ audioContextFactory: () => fake.ctx, debug: true });

      soundManager.play('cardFlip');
      expect(logSpy).toHaveBeenCalledWith('[SoundManager] play skipped (no AudioContext): cardFlip');

      soundManager.unlock();
      expect(logSpy).toHaveBeenCalledWith('[SoundManager] unlocked');

      soundManager.play('cardFlip');
      expect(logSpy).toHaveBeenCalledWith('[SoundManager] playing cue: cardFlip');
    } finally {
      logSpy.mockRestore();
    }
  });
});
