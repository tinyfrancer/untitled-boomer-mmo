import type { FloatTone } from '../world/worldEvents';

// Every size below is authored in CSS pixels, which is what the HUD lays out
// in. The px()/fontPx() helpers still take a scale factor — every caller
// passes 1 today, kept as the hook for a future accessibility/text-size
// setting rather than re-threading one later.
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

/**
 * What each kind of floating number is drawn in.
 *
 * A `WorldEvent` names a tone rather than a colour precisely so a view may
 * decide this for itself. The decision lives beside `THEME.color` rather than
 * in the renderer because it is made out of it: the number that floats off a
 * hit and the combat-log line about the same hit are one palette, not two.
 */
export const FLOAT_TONE_COLORS: Record<FloatTone, string> = {
  damage: THEME.color.equippable,
  'player-damage': THEME.color.playerDamage,
  heal: THEME.color.heal,
  reward: THEME.color.levelUp,
  skill: THEME.color.skillUp,
  dim: THEME.color.dim,
};

export function px(value: number, scale: number): number {
  return Math.round(value * scale);
}

export function fontPx(value: number, scale: number): string {
  return `${px(value, scale)}px`;
}

/**
 * A THEME fill as a CSS colour.
 *
 * The palette is stored two ways on purpose — `0x` numbers for the fills a
 * renderer hands to a material, `#` strings for text — and the DOM HUD needs
 * the string form of the numeric half. One conversion here rather than a third
 * copy of the palette.
 */
export function cssColor(value: number): string {
  return `#${(value >>> 0).toString(16).padStart(6, '0')}`;
}

export function cssRgba(value: number, alpha: number): string {
  const channel = (shift: number): number => (value >>> shift) & 0xff;
  return `rgba(${channel(16)}, ${channel(8)}, ${channel(0)}, ${alpha})`;
}
