import { TILE_SIZE } from '../config/constants';

// Every size below is authored in CSS pixels. Scale.RESIZE keeps the canvas at
// the viewport's size, so canvas units and CSS pixels are 1:1 and the HUD can
// be laid out directly in these values. The px()/fontPx() helpers still take a
// scale factor — it is 1 today (see scenePxScale), kept as the hook for a
// future accessibility/text-size setting rather than re-threading one later.
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
    combatLog: 300,
  },
  paperdollSize: 102,
  xpBar: { width: 190, height: 12 },
  panelBg: 0x000000,
  panelAlpha: 0.65,
  // Sheets are near-opaque where small overlays are not: a full-width sheet
  // covers the player column, and at 0.65 the name and XP bar behind it showed
  // straight through the text.
  sheetAlpha: 0.94,
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
    // Distinct from levelUp so a skill gain never reads as a combat level.
    skillUp: '#4fc3f7',
    playerDamage: '#ff5252',
    heal: '#66bb6a',
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
  // Deeper than the XP bar's blue, so the two stacked bars stay tellable apart.
  manaFill: 0x3949ab,
} as const;

// How many tiles the world camera aims to show across the viewport's smaller
// axis. Bigger number = further zoomed out.
const TARGET_TILES_ACROSS = 10;

/**
 * Zoom for the world camera, from the viewport and world pixel sizes.
 *
 * Aims to show roughly the same slice of world on every device (a phone gets
 * a closer camera in absolute pixels, not a miniature map), clamped to at most
 * 1:1 pixels and never further out than the world edge — a camera wider than
 * the world would letterbox it against the page background.
 */
export function worldZoom(
  viewportWidth: number,
  viewportHeight: number,
  worldWidth: number,
  worldHeight: number,
): number {
  if (
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    return 1;
  }
  const target = Math.min(viewportWidth, viewportHeight) / (TILE_SIZE * TARGET_TILES_ACROSS);
  const fillsWorld = Math.max(viewportWidth / worldWidth, viewportHeight / worldHeight);
  return Math.max(Math.min(target, 1), fillsWorld);
}

export function scenePxScale(): number {
  return 1;
}

export function px(value: number, scale: number): number {
  return Math.round(value * scale);
}

export function fontPx(value: number, scale: number): string {
  return `${px(value, scale)}px`;
}
