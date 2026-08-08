import type { QuestMarker } from '../systems/QuestSystem';
import type { FloatTone } from '../world/worldEvents';
import type { EffectId } from '../types/ids';

// Every size below is authored in CSS pixels, which is what the HUD lays out
// in. The px() helper still takes a scale factor — every caller passes 1
// today, kept as the hook for a future accessibility/text-size setting rather
// than re-threading one later.
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
    // Wider than the other panels since the bag became a grid: at 210 the
    // desktop sheet fit a single column, which is a list with extra steps.
    inventory: 260,
    target: 160,
    combatLog: 300,
  },
  paperdollSize: 102,
  /**
   * The bag's cells. `min` is the narrowest a cell may be before the grid drops
   * a column, and is well over `touchMin` because a cell holds an icon and a
   * name rather than only being tapped. At the sheet's width on a 375px phone
   * it gives three columns, which is what makes the whole item list overflow
   * the body and keeps the scroll and the clip worth checking.
   */
  bagCell: { min: 96, icon: 40 },
  // 14 rather than 12 because the numbers moved *inside* the bars: a line of
  // 11px text needs the room, and the bars are the whole of what the player
  // column says now.
  xpBar: { width: 190, height: 14 },
  /** One buff icon: the square itself, and the two lines of caption under it. */
  effectIcon: { size: 30, caption: 14 },
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
  // The same green the health bar over the player's head is drawn in
  // (`render3d/palette.ts`): the bar in the corner and the bar in the world are
  // one reading of one number, and two greens would suggest otherwise.
  hpFill: 0x66bb6a,
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

/**
 * The glyph and colour for each state a quest giver can be in.
 *
 * Same bargain as `FLOAT_TONE_COLORS` above: `QuestSystem.npcMarker` decides
 * *what* an NPC has to say and this decides what that looks like, so the rule
 * stays a pure function of the log and the bag with nothing drawn in it. Gold
 * for the two states worth walking over and grey for the one that is just
 * bookkeeping — the shape carries the rest, "!" being a quest that is not yet
 * yours and "?" one that already is.
 *
 * The grey is `muted` and not `dim`, which is what a line of unimportant HUD
 * text uses: this is a single thin stroke standing on open grass rather than
 * on a panel's black backing, and #888 there is closer to invisible than to
 * understated.
 */
export const QUEST_MARKER_STYLE: Record<QuestMarker, { glyph: string; color: string }> = {
  available: { glyph: '!', color: THEME.color.levelUp },
  ready: { glyph: '?', color: THEME.color.levelUp },
  active: { glyph: '?', color: THEME.color.muted },
};

/**
 * The glyph and colour each buff icon is drawn as.
 *
 * The same split `QUEST_MARKER_STYLE` above makes: `data/effects.ts` says what
 * an effect *is* and this says what it looks like, so the rule stays a pure
 * function of the player's timers with nothing drawn in it. There are no art
 * assets — see the "no art skills" constraint in `docs/initial_design.txt` — so
 * a glyph in the effect's colour is the icon, and the three are deliberately
 * three different shapes rather than three shades of one.
 */
export const EFFECT_STYLE: Record<EffectId, { glyph: string; color: string }> = {
  'mana-shield': { glyph: '◈', color: THEME.color.skillUp },
  haste: { glyph: '»', color: THEME.color.equippable },
  'well-fed': { glyph: '♥', color: THEME.color.heal },
};

export function px(value: number, scale: number): number {
  return Math.round(value * scale);
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
