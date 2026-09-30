import { clamp } from '../systems/math';
import type { Point } from '../systems/MovementSystem';
import { THEME, px } from './theme';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Below either of these the HUD switches to phone rules: full-width sheets and
// nothing open by default. Height matters as much as width — a landscape phone
// is 844x390, which is wide by any reasonable measure and has less vertical
// room than a portrait one. Keying only on width is what used to place the bag
// a hundred and eighty pixels below the bottom of the screen.
const NARROW_WIDTH = 720;
const SHORT_HEIGHT = 560;

// The name-and-level line and the health bar under it, inside the panel's own
// padding and border.
const TARGET_FRAME_HEIGHT = 56;
// The line naming what the target is winding up. Only there while something is
// coming, so the frame is the height above the rest of the time — the same
// bargain the worn title and the buff row make in the other corner.
const WIND_UP_LINE_HEIGHT = 17;
// The name-and-level line, the health bar and the XP bar. Every number a bar
// carries is printed inside it, so none of the three costs a line of its own.
const PLAYER_COLUMN_HEIGHT = 60;
const MANA_BLOCK_HEIGHT = 19;
// The quiver's bar, which is the mana bar's height for the same reason: it is
// one more bar with its numbers printed inside it. So is the training bar.
const QUIVER_BLOCK_HEIGHT = MANA_BLOCK_HEIGHT;
const TRAINING_BLOCK_HEIGHT = MANA_BLOCK_HEIGHT;
// A worn title gets its own line under the name. "Adventurer, Rat Slayer" on
// one line overruns the 190px column, and shrinking the name to fit made the
// thing the player is proudest of the smallest text on screen.
const TITLE_LINE_HEIGHT = 16;
// The buff icons: one square plus the two caption lines under it, and the gap
// above the row. Presence is what costs the height — a second buff sits beside
// the first rather than under it.
const EFFECT_ROW_HEIGHT = THEME.effectIcon.size + THEME.effectIcon.caption * 2 + 6;
const TRACKER_LINE_HEIGHT = 18;
// The ability buttons plus the mana-cost line printed under them.
const ACTION_BAR_HEIGHT = THEME.touchMin + 8 + 16;

/** How many quests the tracker strip will show before it stops growing. */
export const MAX_TRACKED_QUESTS = 2;

// The two lines that sit over the middle of the playfield rather than in a
// corner. The camera keeps the player centred there, so each is offset far
// enough to clear the figure — the announcement above them, the channel bar
// below.
const TOAST_ABOVE_CENTRE = 80;
const CHANNEL_BAR_BELOW_CENTRE = 60;

export function toastTop(viewportHeight: number): number {
  return Math.round(viewportHeight / 2 - TOAST_ABOVE_CENTRE);
}

export function channelBarTop(viewportHeight: number): number {
  return Math.round(viewportHeight / 2 + CHANNEL_BAR_BELOW_CENTRE);
}

export interface HudLayout {
  narrow: boolean;
  margin: number;
  padding: number;
  targetFrame: Rect;
  playerColumn: Rect;
  /** Zero height when nothing is being tracked, and the strip is not drawn. */
  tracker: Rect;
  actionBar: Rect;
  tabBar: Rect;
}

export interface HudLayoutOptions {
  scale?: number;
  hasMana?: boolean;
  // Whether a quiver is worn, which costs the column the bar that counts it.
  hasQuiver?: boolean;
  // Whether a title is worn, which costs the player column an extra line.
  hasTitle?: boolean;
  // Whether the bar for the skill last trained is up. It comes and goes with
  // training, so this moves in play the way the buff row does.
  hasTraining?: boolean;
  // Whether any buff or debuff is up. How many there are does not matter: they
  // sit in a row, so the first one costs the height and the rest are free.
  hasEffects?: boolean;
  // Whether the target is winding something up, which costs the frame a line.
  targetWinding?: boolean;
  trackedQuests?: number;
}

export function isNarrowViewport(width: number, height: number): boolean {
  return width < NARROW_WIDTH || height < SHORT_HEIGHT;
}

/**
 * Where every piece of always-on HUD furniture goes, as plain arithmetic.
 *
 * This is engine-free and applied as inline styles rather than left to CSS, so
 * the rules can be tested at viewport sizes nobody is going to sit down and try
 * by hand. Everything stacks off the bottom edge, because that is where the
 * thumb is and where the tab bar anchors.
 */
export function hudLayout(
  width: number,
  height: number,
  options: HudLayoutOptions = {},
): HudLayout {
  const {
    scale = 1,
    hasMana = false,
    hasQuiver = false,
    hasTitle = false,
    hasTraining = false,
    targetWinding = false,
    hasEffects = false,
    trackedQuests = 0,
  } = options;
  const margin = px(THEME.margin, scale);
  const padding = px(THEME.padding, scale);

  const tabBarHeight = px(THEME.touchMin, scale) + padding * 2;
  const tabBar: Rect = { x: 0, y: height - tabBarHeight, width, height: tabBarHeight };

  const actionBarHeight = px(ACTION_BAR_HEIGHT, scale);
  const actionBar: Rect = {
    x: margin,
    y: tabBar.y - padding - actionBarHeight,
    width: px(THEME.touchMin + 8, scale) * 2 + padding,
    height: actionBarHeight,
  };

  // Who you are top-left, what you are fighting top-right. They share the top
  // row rather than stacking, which is what buys the player column the whole of
  // the corner: it used to start a target frame and a margin down the screen,
  // and everything in it was that much further from the eye.
  //
  // The frame takes what is left beside the column rather than a fixed width,
  // because at 375px a full-width one and the column meet in the middle — and
  // the narrower the phone, the worse that gets.
  const columnWidth = px(THEME.xpBar.width, scale);
  const playerColumn: Rect = {
    x: margin,
    y: margin,
    width: columnWidth,
    height: px(
      PLAYER_COLUMN_HEIGHT +
        (hasMana ? MANA_BLOCK_HEIGHT : 0) +
        (hasQuiver ? QUIVER_BLOCK_HEIGHT : 0) +
        (hasTitle ? TITLE_LINE_HEIGHT : 0) +
        (hasTraining ? TRAINING_BLOCK_HEIGHT : 0) +
        (hasEffects ? EFFECT_ROW_HEIGHT : 0),
      scale,
    ),
  };

  // The tracker sits over the ability bar at the full width, except where the
  // column hangs down far enough to meet it. That is only a landscape phone,
  // 390px tall for both, with the column at its tallest; there the tracker
  // starts right of the column rather than printing over its bottom row.
  const lines = Math.min(trackedQuests, MAX_TRACKED_QUESTS);
  const trackerHeight = lines > 0 ? lines * px(TRACKER_LINE_HEIGHT, scale) + padding : 0;
  const trackerY = actionBar.y - (trackerHeight > 0 ? padding + trackerHeight : 0);
  const trackerX =
    trackerHeight > 0 && playerColumn.y + playerColumn.height + padding > trackerY
      ? playerColumn.x + playerColumn.width + padding
      : margin;
  const tracker: Rect = {
    x: trackerX,
    y: trackerY,
    width: width - trackerX - margin,
    height: trackerHeight,
  };

  const targetWidth = Math.min(
    px(THEME.panelWidth.target, scale),
    width - margin * 2 - columnWidth - padding,
  );
  const targetFrame: Rect = {
    x: width - margin - targetWidth,
    y: margin,
    width: targetWidth,
    height: px(TARGET_FRAME_HEIGHT + (targetWinding ? WIND_UP_LINE_HEIGHT : 0), scale),
  };

  return {
    narrow: isNarrowViewport(width, height),
    margin,
    padding,
    targetFrame,
    playerColumn,
    tracker,
    actionBar,
    tabBar,
  };
}

/**
 * How tall the world camera may be: the screen, less the tab bar.
 *
 * The canvas is full-bleed, so the bar is held by where the camera stands the
 * player rather than by a smaller canvas: in the middle of this band
 * (`render2d/camera.ts`), so what is tapped on comes up out of the bar by
 * walking toward it. `tests/render2d/camera.test.ts` measures the south
 * signpost against it at real phone sizes.
 *
 * The band exists because the bar is opaque and swallows every tap that lands
 * on it: the south signpost in town once rendered four pixels inside it and
 * could not be tapped at all. New bottom furniture reserves its height here.
 */
export function worldViewportHeight(width: number, height: number, scale = 1): number {
  return hudLayout(width, height, { scale }).tabBar.y;
}

/** The first y an open sheet must stay clear of on a roomy screen. */
export function playerColumnBottom(layout: HudLayout): number {
  return layout.playerColumn.y + layout.playerColumn.height;
}

/**
 * The bottom of the whole top row, which is what a sheet on a roomy screen has
 * to start below.
 *
 * The two corners are different heights and either may be the taller: the
 * player column grows with a title, a pool and a buff row, and the sheet opens
 * in the *right*-hand column, which is the target frame's own corner now.
 */
export function topRowBottom(layout: HudLayout): number {
  return Math.max(playerColumnBottom(layout), layout.targetFrame.y + layout.targetFrame.height);
}

// The tip card's width where there is room for it, and the least room between
// the two top corners it will sit in rather than dropping below them.
const TIP_CARD_WIDTH = 320;
const TIP_CARD_MIN_WIDTH = 240;

/** Where the tip card goes. Its height is its text's, so only the top is placed. */
export interface TipCardRect {
  x: number;
  y: number;
  width: number;
}

/**
 * Where the spirit's tip card sits: at the top, between the player column and
 * the target frame, wherever that gap is wide enough to read in — a landscape
 * phone and anything roomier — and under the whole top row on a portrait
 * phone, where the two corners all but meet.
 *
 * At the top rather than over the middle, which is the player and whatever they
 * are fighting, and never at the bottom, which is the thumb's.
 */
export function tipCardRect(layout: HudLayout, viewportWidth: number): TipCardRect {
  const gapLeft = layout.playerColumn.x + layout.playerColumn.width + layout.padding;
  const gapRight = layout.targetFrame.x - layout.padding;
  const between = gapRight - gapLeft;
  if (between >= TIP_CARD_MIN_WIDTH) {
    const width = Math.min(TIP_CARD_WIDTH, between);
    return { x: Math.round(gapLeft + (between - width) / 2), y: layout.margin, width };
  }
  const width = Math.min(TIP_CARD_WIDTH, viewportWidth - layout.margin * 2);
  return {
    x: Math.round((viewportWidth - width) / 2),
    y: topRowBottom(layout) + layout.padding,
    width,
  };
}

/** The row a picker was opened from, in the same coordinates it is placed in. */
export interface AnchorBox {
  left: number;
  right: number;
  top: number;
}

/**
 * Where a picker anchored to `anchor` sits, given how big it turned out to be.
 *
 * To the left of the sheet it belongs to, so it never covers the row that
 * opened it, and flipped to the right when there is no room that side. Both
 * axes are then held inside the viewport: the picker for the bottom slot is
 * taller than the space under it and would otherwise hang off the screen.
 */
export function pickerPosition(
  anchor: AnchorBox,
  box: { width: number; height: number },
  bounds: { width: number; height: number },
): Point {
  const gutter = THEME.padding;
  const preferredLeft = anchor.left - box.width - gutter;
  const left =
    preferredLeft >= 0 ? preferredLeft : Math.min(anchor.right + gutter, bounds.width - box.width);
  return {
    x: Math.max(0, left),
    y: clamp(anchor.top, 0, Math.max(0, bounds.height - box.height)),
  };
}

/**
 * Where a menu opened *at* a point sits, given how big it turned out to be.
 *
 * Down and to the right of the press, which is where every menu on every
 * platform opens, and folded back over the press when that side has no room —
 * folded rather than clamped, because a menu shoved up the screen to fit would
 * sit over the thing it is about, and on a phone that thing is under a thumb.
 * The clamp is still there behind the fold for a menu taller than the viewport,
 * which is the one case the fold cannot solve.
 */
export function menuPosition(
  at: Point,
  box: { width: number; height: number },
  bounds: { width: number; height: number },
): Point {
  const foldedX = at.x + box.width <= bounds.width ? at.x : at.x - box.width;
  const foldedY = at.y + box.height <= bounds.height ? at.y : at.y - box.height;
  return {
    x: clamp(foldedX, 0, Math.max(0, bounds.width - box.width)),
    y: clamp(foldedY, 0, Math.max(0, bounds.height - box.height)),
  };
}

// A counter with two sides draws each this wide when they stand side by side:
// room for an icon, "Reforging Stone x25", a price and the stack's All button.
const COUNTER_SIDE_WIDTH = 272;
// One side over the other: the width the shop and the bank had before they had
// two, plus the room a pane's frame takes, so a row is no narrower than it was.
const COUNTER_STACKED_WIDTH = 320;

export interface CounterLayout {
  /** The keeper's side left of yours, rather than above it. */
  sideBySide: boolean;
  /** The box's width; the stylesheet still holds it inside the viewport. */
  width: number;
}

/**
 * How a counter with two sides — the shop's stock and your bag, the vault and
 * your bag — lays them out.
 *
 * Side by side wherever two full-width sides fit, which is a landscape phone
 * as much as a desktop: that is the screen short of height, where one list
 * over another would leave each a couple of rows. Otherwise one over the other,
 * each scrolling on its own, so a portrait phone sees both at once rather than
 * scrolling past the whole shelf to find the bag.
 */
export function counterLayout(viewportWidth: number): CounterLayout {
  const sideBySideWidth = COUNTER_SIDE_WIDTH * 2 + THEME.padding * 3 + 2;
  return viewportWidth >= sideBySideWidth + THEME.margin * 2
    ? { sideBySide: true, width: sideBySideWidth }
    : { sideBySide: false, width: COUNTER_STACKED_WIDTH };
}

/**
 * Where an open panel goes. Only one is open at a time — that is what the tab
 * bar means — so a sheet gets the whole column rather than sharing it.
 *
 * On a phone it is full width and covers both top corners: while a sheet is
 * open, the sheet is what the player is looking at. On a roomy screen it keeps
 * the old right-hand column, since there the playfield is not the scarce thing
 * — which is why it starts below the whole top row rather than below the player
 * column alone, the target frame now being in the corner it opens under.
 *
 * The height returned is what the panel has to fit inside; a panel wanting more
 * scrolls rather than running off the screen. It is never negative.
 */
export function sheetRect(layout: HudLayout, viewportWidth: number, preferredWidth: number): Rect {
  const floor =
    (layout.tracker.height > 0 ? layout.tracker.y : layout.actionBar.y) - layout.padding;
  const top = layout.narrow ? layout.margin : topRowBottom(layout) + layout.padding;
  const x = layout.narrow ? layout.margin : viewportWidth - preferredWidth - layout.margin;
  const width = layout.narrow ? viewportWidth - layout.margin * 2 : preferredWidth;

  return { x, y: top, width, height: Math.max(0, floor - top) };
}
