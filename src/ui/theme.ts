import type { QuestMarker } from '../systems/QuestSystem';
import type { FloatTone } from '../world/worldEvents';
import { SHARED_RAMPS, type SharedRampId, type Step } from '../art/palette';

/**
 * A step on one of the art's ramps (`art/palette.ts`), as the number a
 * renderer fills with. The HUD draws in the world's colours rather than a
 * palette of its own (B8, decision 111): a stat's gold is the gold a coin is
 * drawn in, and the green over a creature's head is the green in the corner.
 * `theme.test.ts` holds every colour the HUD names to a step.
 */
export function rampStep(ramp: SharedRampId, step: Step): number {
  return SHARED_RAMPS[ramp][step];
}

function hex(ramp: SharedRampId, step: Step): string {
  return cssColor(rampStep(ramp, step));
}

/** A bar's fill: the ramp it is drawn in, lit along its top and shaded along its foot. */
export interface BarFill {
  ramp: SharedRampId;
}

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
    // The combat log's width, for the same reason: a recipe's line is its
    // inputs and its result, and the plate tier's are four names long.
    skills: 300,
    // Wider than the rest: the zone it draws is 25 tiles across and 19 down,
    // and a map narrow enough to fit the other panels' column would leave each
    // tile too few pixels to tell a fishing spot from the pond it sits in.
    map: 320,
    // The skills book's, for the same reason: a line of the idle panel is a
    // recipe's inputs and result, and a food row carries three buttons.
    idle: 300,
    // A rank is one line, its title and its count side by side, and the
    // longest is a boss's ("Orlath the Barrow King Slayer … 0 / 100 slain"):
    // at the character sheet's 240 both halves broke into two ragged columns.
    feats: 340,
  },
  /**
   * The paperdoll's scale: CSS pixels to the art pixel. The figure is the
   * world's 32 by 48, drawn at a whole scale so every art pixel is one square.
   */
  paperdollScale: 2,
  /**
   * The bag's cells. `min` is the narrowest a cell may be before the grid drops
   * a column, and is well over `touchMin` because a cell holds an icon and a
   * name rather than only being tapped. At the sheet's width on a 375px phone
   * it gives three columns, which is what makes the whole item list overflow
   * the body and keeps the scroll and the clip worth checking.
   */
  bagCell: { min: 96, icon: 32 },
  /**
   * An icon's side in CSS pixels: one to the art pixel, a 32-pixel icon drawn
   * as the world draws a tile on a phone, and a tab's 16 beside its word.
   */
  icon: { item: 32, tab: 16 },
  // 14 rather than 12 because the numbers moved *inside* the bars: a line of
  // 11px text needs the room, and the bars are the whole of what the player
  // column says now.
  xpBar: { width: 190, height: 14 },
  /** One buff icon: the square itself, and the two lines of caption under it. */
  effectIcon: { size: 34, caption: 14 },
  /**
   * The minimap's CSS pixels to a tile: a whole number, so every tile is the
   * same square as every pixel of art the HUD draws, and four, which fits the
   * 27 tiles it frames into a corner a thumb wide.
   */
  minimap: { tile: 4 },
  /**
   * The frames' widths: how far a panel's iron and a button's stone come in
   * from the edge (`art/hud.ts` cuts them there). A panel's padding is what is
   * left of the old eight once the frame has taken its share.
   */
  frame: { panel: 8, button: 3 },
  /** The panel's face, a slot's pit, and the ink a word over the world is edged in. */
  panelBg: rampStep('masonry', 0),
  slotBg: rampStep('ink', 0),
  inkLine: rampStep('ink', 0),
  color: {
    text: hex('bone', 4),
    muted: hex('bone', 3),
    dim: hex('linen', 2),
    equippable: hex('yellow', 4),
    targetHp: hex('red', 4),
    levelUp: hex('gold', 3),
    // Distinct from levelUp so a skill gain never reads as a combat level.
    skillUp: hex('arcane', 3),
    // Metal in rock, for the one node kind whose ground has no shade in this
    // palette: the map's trees and fishing spots are each a lighter version of
    // the grass or water under them, and stone is a grey a marker would vanish
    // into. See NODE_COLOR in hud/MapSheet.ts.
    ore: hex('gold', 2),
    // The counters' colours, which their frames' accents are drawn in too
    // (`FRAME_ACCENT` below): the trainer's violet, the quartermaster's green
    // and the forge's embers.
    trainer: hex('purple', 3),
    quartermaster: hex('green', 3),
    forge: hex('fire', 2),
    playerDamage: hex('red', 3),
    heal: hex('nature', 3),
    // Difficulty ("con") shades for an enemy's name, relative to the player.
    con: {
      trivial: hex('hairGrey', 3),
      low: hex('green', 3),
      even: hex('bone', 4),
      high: hex('yellow', 3),
      deadly: hex('red', 3),
    },
  },
  /**
   * What each bar is filled with. The XP bar is violet, the way the genre has
   * drawn it since the first of these games, which frees blue for mana and
   * keeps the two stacked bars from reading as one.
   */
  bars: {
    hp: { ramp: 'green' },
    xp: { ramp: 'purple' },
    mana: { ramp: 'arcane' },
    // Fletching's ochre, and nothing like the bars above it: the quiver's bar
    // sits where a wizard's mana does, and has to read as arrows.
    quiver: { ramp: 'ochre' },
    // The skill last trained hangs straight under the XP bar, so it cannot be
    // its violet: two touching read as one bar.
    training: { ramp: 'teal' },
    target: { ramp: 'red' },
  } satisfies Record<string, BarFill>,
  // The same green the health bar over the player's head is drawn in
  // (`render2d/ZoneView2D.ts`): the bar in the corner and the bar in the world
  // are one reading of one number, and two greens would suggest otherwise.
  hpFill: rampStep('green', 3),
  manaFill: rampStep('arcane', 3),
} as const;

/**
 * Which accent each counter's frame wears (`art/sprites/frames.ts`), so which
 * one is up is answerable without reading its title. A conversation, the menu
 * and Options wear none: they are nobody's.
 */
export const FRAME_ACCENT = {
  shop: 'gold',
  bank: 'arcane',
  trainer: 'purple',
  bounty: 'green',
  station: 'fire',
  // The spirit's, which the tips it speaks in are edged in.
  tip: 'arcane',
  picker: 'yellow',
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
  // Hotter than an ordinary hit and unlike anything else on screen: a crit is
  // the one number that is supposed to interrupt what the player was reading.
  crit: hex('fire', 3),
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
