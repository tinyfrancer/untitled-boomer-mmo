import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';

// Every size below is authored in CSS pixels — what the player actually sees —
// rather than canvas units. Scale.FIT shrinks the fixed GAME_WIDTH canvas to fit
// the viewport, so a HUD sized in canvas units gets physically smaller the
// smaller the window; on a phone it becomes unreadable. Multiply by uiScale()
// at build time to keep apparent size roughly constant instead.
export const THEME = {
  font: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 24,
  },
  rowHeight: 22,
  padding: 8,
  margin: 12,
  // WCAG's minimum tap target; the old 22px buttons were half of this.
  touchMin: 44,
  panelWidth: {
    character: 240,
    inventory: 210,
    target: 160,
  },
  paperdollSize: 102,
  xpBar: { width: 190, height: 12 },
  panelBg: 0x000000,
  panelAlpha: 0.65,
  panelStroke: 0x555577,
  buttonBg: 0x333333,
  buttonAlpha: 0.85,
  color: {
    text: '#ffffff',
    muted: '#cccccc',
    dim: '#888888',
    equippable: '#ffee58',
    targetHp: '#ff8a80',
    levelUp: '#ffd54f',
    playerDamage: '#ff5252',
    // Difficulty ("con") shades for an enemy's name, relative to the player.
    con: {
      trivial: '#9e9e9e',
      low: '#66bb6a',
      even: '#ffffff',
      high: '#ffee58',
      deadly: '#ff5252',
    },
  },
  xpFill: 0x42a5f5,
} as const;

export const MIN_UI_SCALE = 1;

// Tallest thing the HUD draws, in CSS px (the character sheet). The upper clamp
// is whatever scale still keeps that on screen rather than a round number —
// past it the panel would run off the bottom of the canvas on a phone.
const TALLEST_PANEL = 320;
export const MAX_UI_SCALE = GAME_HEIGHT / TALLEST_PANEL;

/**
 * Canvas units per CSS pixel, given the canvas's on-screen width.
 *
 * The lower clamp stops the HUD rendering below its authored pixel density on
 * very wide displays; the upper clamp keeps the tallest panel on screen.
 */
export function uiScale(displayWidth: number): number {
  if (!Number.isFinite(displayWidth) || displayWidth <= 0) {
    return MIN_UI_SCALE;
  }
  const raw = GAME_WIDTH / displayWidth;
  return Math.min(Math.max(raw, MIN_UI_SCALE), MAX_UI_SCALE);
}

export function scenePxScale(scene: Phaser.Scene): number {
  return uiScale(scene.scale.displaySize.width);
}

export function px(value: number, scale: number): number {
  return Math.round(value * scale);
}

export function fontPx(value: number, scale: number): string {
  return `${px(value, scale)}px`;
}
