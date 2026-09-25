/**
 * Whether the game makes a sound, and how loud.
 *
 * A fact about the speaker rather than about the character, so it is kept per
 * device beside the save rather than in `CharacterState` — a character played
 * on a phone on a train and on a laptop at home wants two answers, and a reset
 * that wipes the character should not unmute the phone.
 */
export interface SoundSettings {
  readonly muted: boolean;
  /** 0 to 1. */
  readonly volume: number;
}

export const DEFAULT_SOUND: SoundSettings = { muted: false, volume: 0.7 };

export const SOUND_STORAGE_KEY = 'untitled-boomer-mmo:sound:v1';

/**
 * What this device last chose, or the default. Never throws: storage can be
 * refused outright in a private window, and a game that would not boot for want
 * of a volume setting is a worse bug than one that forgot it.
 */
export function loadSoundSettings(storage: Storage | null = globalStorage()): SoundSettings {
  try {
    const raw = storage?.getItem(SOUND_STORAGE_KEY);
    if (!raw) return DEFAULT_SOUND;
    const parsed = JSON.parse(raw) as Partial<SoundSettings>;
    return {
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SOUND.muted,
      volume: clampVolume(parsed.volume),
    };
  } catch {
    return DEFAULT_SOUND;
  }
}

export function saveSoundSettings(
  settings: SoundSettings,
  storage: Storage | null = globalStorage(),
): void {
  try {
    storage?.setItem(SOUND_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Refused storage costs the setting its next session, and nothing else.
  }
}

export function clampVolume(volume: unknown): number {
  return typeof volume === 'number' && Number.isFinite(volume)
    ? Math.min(1, Math.max(0, volume))
    : DEFAULT_SOUND.volume;
}

function globalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
