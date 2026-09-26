/**
 * Every sound the game makes, as a recipe rather than a recording.
 *
 * The renderer loads no files (`docs/decisions.md` 54) and neither does this: a
 * cue is a handful of voices — an oscillator or a burst of noise, swept from one
 * pitch to another under a short envelope — and `SoundBoard` builds each one out
 * of Web Audio nodes when it is played. What a swing sounds like is a row here,
 * the way what a rat looks like is a row in `render3d/palette.ts`.
 */
export type CueId =
  | 'swing'
  | 'twang'
  | 'hit'
  | 'crit'
  | 'hurt'
  | 'block'
  | 'bolt'
  | 'heal'
  | 'wind-up'
  | 'mob-death'
  | 'player-death'
  | 'chop'
  | 'mine'
  | 'splash'
  | 'level-up'
  | 'coin'
  | 'achievement'
  | 'sack';

export type VoiceWave = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';

export interface Voice {
  readonly wave: VoiceWave;
  /**
   * The pitch it starts at, in hertz — or, for noise, the centre of the filter
   * the noise is heard through, which is what gives a burst of hiss a pitch.
   */
  readonly from: number;
  /** Where the pitch has swept to by the end; absent holds it. */
  readonly to?: number;
  readonly ms: number;
  /** Peak loudness, before the master volume, 0 to 1. */
  readonly gain: number;
  /** How long after the cue starts this voice does. */
  readonly delayMs?: number;
  /** Shapes a voice's tone; noise defaults to a band-pass around `from`. */
  readonly filter?: 'lowpass' | 'highpass' | 'bandpass';
}

export interface Cue {
  readonly voices: readonly Voice[];
  /**
   * The least time between two of the same cue. Six rats taking a swing in one
   * frame is one swing's worth of sound, not six stacked into a roar.
   */
  readonly spacingMs: number;
}

export const CUES: Record<CueId, Cue> = {
  swing: {
    voices: [{ wave: 'noise', from: 1800, to: 700, ms: 110, gain: 0.16 }],
    spacingMs: 70,
  },
  // A bowstring let go: a plucked note falling away, and the hiss of the shaft
  // leaving. Shorter and brighter than a swing's whoosh, since a ranger hears
  // one every second for as long as they fight.
  twang: {
    voices: [
      { wave: 'triangle', from: 330, to: 180, ms: 140, gain: 0.14 },
      { wave: 'noise', from: 2400, to: 1200, ms: 90, gain: 0.08, filter: 'highpass' },
    ],
    spacingMs: 70,
  },
  hit: {
    voices: [
      { wave: 'sine', from: 180, to: 55, ms: 130, gain: 0.45 },
      { wave: 'noise', from: 900, ms: 60, gain: 0.2, filter: 'lowpass' },
    ],
    spacingMs: 60,
  },
  crit: {
    voices: [
      { wave: 'sine', from: 200, to: 50, ms: 160, gain: 0.5 },
      { wave: 'noise', from: 1100, ms: 70, gain: 0.22, filter: 'lowpass' },
      { wave: 'triangle', from: 1320, to: 1760, ms: 110, gain: 0.16, delayMs: 15 },
    ],
    spacingMs: 60,
  },
  hurt: {
    voices: [
      { wave: 'square', from: 130, to: 45, ms: 170, gain: 0.14, filter: 'lowpass' },
      { wave: 'noise', from: 600, ms: 80, gain: 0.18, filter: 'lowpass' },
    ],
    spacingMs: 80,
  },
  block: {
    voices: [
      { wave: 'triangle', from: 1650, ms: 130, gain: 0.14 },
      { wave: 'triangle', from: 2480, ms: 100, gain: 0.08 },
    ],
    spacingMs: 60,
  },
  bolt: {
    voices: [
      { wave: 'noise', from: 400, to: 2600, ms: 220, gain: 0.18, filter: 'lowpass' },
      { wave: 'sine', from: 300, to: 900, ms: 200, gain: 0.1 },
    ],
    spacingMs: 80,
  },
  heal: {
    voices: [
      { wave: 'sine', from: 523, ms: 150, gain: 0.1 },
      { wave: 'sine', from: 659, ms: 150, gain: 0.1, delayMs: 80 },
      { wave: 'sine', from: 784, ms: 200, gain: 0.1, delayMs: 160 },
    ],
    spacingMs: 400,
  },
  // Rising and harsh, because it is a warning: something is about to land and
  // there is a second to be somewhere else.
  'wind-up': {
    voices: [{ wave: 'square', from: 220, to: 470, ms: 420, gain: 0.07, filter: 'lowpass' }],
    spacingMs: 200,
  },
  'mob-death': {
    voices: [{ wave: 'sawtooth', from: 320, to: 70, ms: 380, gain: 0.08, filter: 'lowpass' }],
    spacingMs: 100,
  },
  'player-death': {
    voices: [
      { wave: 'sawtooth', from: 220, to: 40, ms: 900, gain: 0.14, filter: 'lowpass' },
      { wave: 'sine', from: 110, to: 30, ms: 1100, gain: 0.2 },
    ],
    spacingMs: 1000,
  },
  chop: {
    voices: [
      { wave: 'noise', from: 700, ms: 70, gain: 0.26 },
      { wave: 'sine', from: 150, to: 90, ms: 90, gain: 0.26 },
    ],
    spacingMs: 100,
  },
  mine: {
    voices: [
      { wave: 'triangle', from: 2200, to: 1800, ms: 80, gain: 0.16 },
      { wave: 'noise', from: 3000, ms: 45, gain: 0.12, filter: 'highpass' },
    ],
    spacingMs: 100,
  },
  splash: {
    voices: [{ wave: 'noise', from: 1500, to: 600, ms: 190, gain: 0.16, filter: 'highpass' }],
    spacingMs: 100,
  },
  'level-up': {
    voices: [
      { wave: 'triangle', from: 523, ms: 240, gain: 0.14 },
      { wave: 'triangle', from: 659, ms: 240, gain: 0.14, delayMs: 110 },
      { wave: 'triangle', from: 784, ms: 240, gain: 0.14, delayMs: 220 },
      { wave: 'triangle', from: 1047, ms: 520, gain: 0.16, delayMs: 330 },
    ],
    spacingMs: 1000,
  },
  coin: {
    voices: [
      { wave: 'triangle', from: 1568, ms: 70, gain: 0.1 },
      { wave: 'triangle', from: 2093, ms: 110, gain: 0.1, delayMs: 60 },
    ],
    spacingMs: 120,
  },
  achievement: {
    voices: [
      { wave: 'sine', from: 880, ms: 700, gain: 0.12 },
      { wave: 'sine', from: 1320, ms: 700, gain: 0.08, delayMs: 20 },
    ],
    spacingMs: 800,
  },
  // A loot pile landing: a dull thump with the rustle of cloth on it. Low and
  // soft, because it says the pack was full rather than that anything was won.
  sack: {
    voices: [
      { wave: 'sine', from: 140, to: 70, ms: 150, gain: 0.3 },
      { wave: 'noise', from: 500, ms: 120, gain: 0.14, filter: 'lowpass' },
    ],
    spacingMs: 150,
  },
};
