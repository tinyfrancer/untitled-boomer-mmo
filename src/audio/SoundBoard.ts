import type { ZoneSetting } from '../types/ids';
import type { EventBus, WorldEvent } from '../world/worldEvents';
import { CUES, type CueId, type Voice } from './cues';
import { MomentEar, PurseEar, hearHudChannel } from './listen';
import { DEFAULT_SOUND, clampVolume, type SoundSettings } from './settings';

/** The quietest a ramp may aim for: an exponential ramp cannot reach zero. */
const SILENT = 0.0001;
const ATTACK_S = 0.006;

/**
 * The bed of sound under a kind of place, and the sparse things that happen in
 * it: wind and birdsong under the sky, a close hum and frogs in the marsh, a
 * low drone and water dripping underground. Quiet on purpose — it is the room a
 * fight is heard in, not something to listen to.
 */
interface Ambience {
  /** The filtered noise the bed is made of, and how loud it sits. */
  readonly hiss: { readonly cutoff: number; readonly gain: number };
  /** A tone under it, for the places that have one. */
  readonly drone?: { readonly hz: number; readonly gain: number };
  /** The occasional sound over it, and how far apart those come, in seconds. */
  readonly accent: readonly Voice[];
  readonly accentEvery: readonly [number, number];
}

const AMBIENCE: Record<ZoneSetting, Ambience> = {
  open: {
    hiss: { cutoff: 450, gain: 0.02 },
    accent: [
      { wave: 'sine', from: 2900, to: 3700, ms: 70, gain: 0.035 },
      { wave: 'sine', from: 3100, to: 3900, ms: 70, gain: 0.03, delayMs: 130 },
    ],
    accentEvery: [3.5, 8],
  },
  marsh: {
    hiss: { cutoff: 280, gain: 0.022 },
    accent: [
      { wave: 'square', from: 170, to: 130, ms: 90, gain: 0.025, filter: 'lowpass' },
      { wave: 'square', from: 165, to: 125, ms: 90, gain: 0.022, filter: 'lowpass', delayMs: 170 },
    ],
    accentEvery: [1.8, 4.5],
  },
  underground: {
    hiss: { cutoff: 160, gain: 0.015 },
    drone: { hz: 55, gain: 0.025 },
    accent: [{ wave: 'sine', from: 1400, to: 500, ms: 90, gain: 0.045 }],
    accentEvery: [2.5, 6.5],
  },
};

type AudioContextClass = new () => AudioContext;

/**
 * The game's sound: one `AudioContext`, a master volume, the cues the world's
 * moments are heard as, and a bed of ambience under whichever zone is running.
 *
 * Owned by the host, like the frame loop and the keyboard, and fed the same
 * `WorldEvent[]` the view is handed — so the simulation does not know there is
 * a speaker any more than it knows there is a screen. Everything is synthesised
 * from oscillators and a buffer of noise (`cues.ts`), so there is nothing to
 * load and nothing to wait for.
 *
 * A browser refuses to start audio before the page has been touched, so the
 * context is not made until `unlock()` is called from a real gesture, and every
 * call before that is quietly nothing. Where there is no Web Audio at all —
 * jsdom, an old browser — the same is true for good.
 */
export class SoundBoard {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private current: SoundSettings;
  private readonly ear = new MomentEar();
  private readonly purse = new PurseEar();
  private readonly lastPlayed = new Map<CueId, number>();
  private detach: (() => void) | null = null;
  private place: ZoneSetting | null = null;
  private stopAmbience: (() => void) | null = null;

  constructor(settings: SoundSettings = DEFAULT_SOUND) {
    this.current = settings;
  }

  get settings(): SoundSettings {
    return this.current;
  }

  /** Starts the sound, from a gesture. Safe to call on every one. */
  unlock(): void {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return;
    }
    const Context = audioContextClass();
    if (!Context) return;
    try {
      this.context = new Context();
    } catch {
      return;
    }
    this.master = this.context.createGain();
    this.master.connect(this.context.destination);
    this.noise = whiteNoise(this.context);
    this.applyVolume();
    if (this.place) this.startAmbience(this.place);
  }

  configure(settings: SoundSettings): void {
    this.current = { muted: settings.muted, volume: clampVolume(settings.volume) };
    this.applyVolume();
  }

  /** Starts hearing the HUD channel's moments: coin, and an achievement. */
  listenTo(events: EventBus): void {
    this.detach?.();
    this.detach = hearHudChannel(events, (cue) => this.play(cue), this.purse);
  }

  /** The frame's moments, played as whatever each sounds like. */
  hear(events: readonly WorldEvent[]): void {
    for (const event of events) {
      for (const cue of this.ear.hear(event)) this.play(cue);
    }
  }

  play(cueId: CueId): void {
    const context = this.context;
    if (!context || !this.master || this.current.muted) return;
    const cue = CUES[cueId];
    const now = context.currentTime;
    const last = this.lastPlayed.get(cueId) ?? -Infinity;
    if ((now - last) * 1000 < cue.spacingMs) return;
    this.lastPlayed.set(cueId, now);
    for (const voice of cue.voices) this.voice(voice, now, this.master);
  }

  /** The kind of place the player is standing in, which decides the ambience. */
  enter(setting: ZoneSetting): void {
    this.ear.reset();
    if (setting === this.place && this.stopAmbience) return;
    this.place = setting;
    if (this.context) this.startAmbience(setting);
  }

  /**
   * Ends the sound with the session. A later `unlock()` builds a new context,
   * which is why the spacing memory goes too: it is kept on the old context's
   * clock, and a new clock starts from zero, so every cue would stay suppressed
   * until the new one caught up with the old.
   */
  dispose(): void {
    this.detach?.();
    this.detach = null;
    this.stopAmbience?.();
    this.stopAmbience = null;
    // A context that is already closing rejects; there is nothing to do about it.
    this.context?.close().catch(() => undefined);
    this.context = null;
    this.master = null;
    this.noise = null;
    this.lastPlayed.clear();
    this.ear.reset();
    this.purse.reset();
  }

  private applyVolume(): void {
    if (!this.context || !this.master) return;
    const level = this.current.muted ? 0 : this.current.volume;
    this.master.gain.setTargetAtTime(level, this.context.currentTime, 0.03);
  }

  /** One voice of a cue: a source, an optional filter, and a short envelope. */
  private voice(voice: Voice, startAt: number, destination: AudioNode): void {
    const context = this.context;
    if (!context) return;
    const begin = startAt + (voice.delayMs ?? 0) / 1000;
    const end = begin + voice.ms / 1000;

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(SILENT, begin);
    envelope.gain.exponentialRampToValueAtTime(voice.gain, begin + ATTACK_S);
    envelope.gain.exponentialRampToValueAtTime(SILENT, end);
    envelope.connect(destination);

    let source: AudioScheduledSourceNode;
    let head: AudioNode = envelope;
    if (voice.wave === 'noise') {
      const noise = context.createBufferSource();
      noise.buffer = this.noise;
      noise.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = voice.filter ?? 'bandpass';
      filter.frequency.setValueAtTime(voice.from, begin);
      if (voice.to) filter.frequency.exponentialRampToValueAtTime(voice.to, end);
      filter.connect(envelope);
      head = filter;
      source = noise;
    } else {
      const oscillator = context.createOscillator();
      oscillator.type = voice.wave;
      oscillator.frequency.setValueAtTime(voice.from, begin);
      if (voice.to) oscillator.frequency.exponentialRampToValueAtTime(voice.to, end);
      if (voice.filter) {
        const filter = context.createBiquadFilter();
        filter.type = voice.filter;
        filter.frequency.value = voice.from * 4;
        filter.connect(envelope);
        head = filter;
      }
      source = oscillator;
    }
    source.connect(head);
    source.start(begin);
    source.stop(end + 0.05);
    source.onended = () => envelope.disconnect();
  }

  private startAmbience(setting: ZoneSetting): void {
    this.stopAmbience?.();
    const context = this.context;
    const master = this.master;
    if (!context || !master || !this.noise) return;
    const ambience = AMBIENCE[setting];

    const bed = context.createGain();
    bed.gain.setValueAtTime(SILENT, context.currentTime);
    bed.gain.exponentialRampToValueAtTime(1, context.currentTime + 1.5);
    bed.connect(master);

    const hiss = context.createBufferSource();
    hiss.buffer = this.noise;
    hiss.loop = true;
    const hissFilter = context.createBiquadFilter();
    hissFilter.type = 'lowpass';
    hissFilter.frequency.value = ambience.hiss.cutoff;
    const hissGain = context.createGain();
    hissGain.gain.value = ambience.hiss.gain;
    hiss.connect(hissFilter).connect(hissGain).connect(bed);
    hiss.start();

    const sources: AudioScheduledSourceNode[] = [hiss];
    if (ambience.drone) {
      const drone = context.createOscillator();
      drone.frequency.value = ambience.drone.hz;
      const droneGain = context.createGain();
      droneGain.gain.value = ambience.drone.gain;
      drone.connect(droneGain).connect(bed);
      drone.start();
      sources.push(drone);
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const [least, most] = ambience.accentEvery;
    const accent = (): void => {
      if (!this.current.muted) {
        for (const voice of ambience.accent) this.voice(voice, context.currentTime, bed);
      }
      timer = setTimeout(accent, (least + Math.random() * (most - least)) * 1000);
    };
    timer = setTimeout(accent, least * 1000);

    this.stopAmbience = () => {
      if (timer !== null) clearTimeout(timer);
      const at = context.currentTime;
      bed.gain.cancelScheduledValues(at);
      bed.gain.setTargetAtTime(SILENT, at, 0.2);
      for (const source of sources) source.stop(at + 1);
      setTimeout(() => bed.disconnect(), 1200);
    };
  }
}

function audioContextClass(): AudioContextClass | null {
  const scope = globalThis as unknown as {
    AudioContext?: AudioContextClass;
    webkitAudioContext?: AudioContextClass;
  };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

/** A second of white noise, looped by every voice that hisses. */
function whiteNoise(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;
  return buffer;
}
