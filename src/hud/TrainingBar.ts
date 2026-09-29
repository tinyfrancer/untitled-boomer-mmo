import { el, fillPercent } from './dom';
import { formatSkillProgress } from './skillRows';
import { SKILLS } from '../data/skills';
import { barFill } from '../systems/math';
import type { SkillId } from '../types/ids';

// How long the bar stays after the last XP into its skill, and then how long it
// takes to go. Half a minute outlasts the wait between one gather or swing and
// the next, and not a walk across a zone.
export const TRAINING_FADE_AFTER_MS = 30_000;
export const TRAINING_FADE_MS = 1000;

/** One skill's standing, as the bar draws it. */
export interface TrainingProgress {
  skillId: SkillId;
  level: number;
  xp: number;
  xpToNext: number;
}

/**
 * The skill last trained, as one more bar in the player column: its name, its
 * level and its XP toward the next, printed inside the bar like the rest.
 *
 * It comes up with XP into a skill and fades half a minute after the last of
 * it, so the corner says what the player is doing rather than what they did an
 * hour ago. A tap opens the skills book at that skill's page, which is where
 * what the next level buys is said.
 *
 * Its clock is a timer of the HUD's own, as a held finger's is: the HUD has no
 * game time, and a bar in the corner is not worth teaching it one.
 */
export class TrainingBar {
  readonly root: HTMLButtonElement;
  private readonly fill: HTMLElement;
  private readonly name: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly onHidden: () => void;
  private shown: SkillId | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(onOpen: (skillId: SkillId) => void, onHidden: () => void) {
    this.onHidden = onHidden;
    // The button is the bar and the gap above it, which is all the room there
    // is to tap between the XP bar and whatever hangs below.
    this.root = el('button', 'hud-player__training hud-hidden');
    this.root.type = 'button';
    const bar = el('div', 'hud-bar hud-training__bar');
    this.fill = el('div', 'hud-bar__fill hud-bar__fill--training');
    const label = el('div', 'hud-bar__label hud-training__label');
    this.name = el('span', 'hud-training__name');
    this.progress = el('span', 'hud-training__progress');
    label.append(this.name, this.progress);
    bar.append(this.fill, label);
    this.root.append(bar);
    this.root.addEventListener('click', () => {
      if (this.shown) {
        onOpen(this.shown);
      }
    });
  }

  /** The skill the bar is showing, or null while it is down. */
  get skillId(): SkillId | null {
    return this.shown;
  }

  /** XP into a skill: the bar is that skill's now, for another half minute. */
  train(progress: TrainingProgress): void {
    this.shown = progress.skillId;
    this.draw(progress);
    this.root.classList.remove('hud-hidden', 'is-fading');
    this.stop();
    this.fadeTimer = setTimeout(() => {
      this.fadeTimer = null;
      this.root.classList.add('is-fading');
      this.hideTimer = setTimeout(() => this.hide(), TRAINING_FADE_MS);
    }, TRAINING_FADE_AFTER_MS);
  }

  /**
   * The skill already up, drawn again without keeping it up any longer: a
   * character level raises a combat skill's ceiling with nothing trained.
   */
  redraw(progress: TrainingProgress): void {
    if (progress.skillId === this.shown) {
      this.draw(progress);
    }
  }

  /** Stops the clock, for a HUD being taken down. */
  stop(): void {
    if (this.fadeTimer !== null) clearTimeout(this.fadeTimer);
    if (this.hideTimer !== null) clearTimeout(this.hideTimer);
    this.fadeTimer = null;
    this.hideTimer = null;
  }

  private hide(): void {
    this.hideTimer = null;
    this.shown = null;
    this.root.classList.add('hud-hidden');
    this.root.classList.remove('is-fading');
    this.onHidden();
  }

  private draw({ skillId, level, xp, xpToNext }: TrainingProgress): void {
    this.name.textContent = SKILLS[skillId].name;
    this.progress.textContent = formatSkillProgress(level, xp, xpToNext);
    // A capped skill has no next level to fill toward, and reads as full.
    this.fill.style.width = fillPercent(xpToNext > 0 ? barFill(xp, xpToNext) : 1);
  }
}
