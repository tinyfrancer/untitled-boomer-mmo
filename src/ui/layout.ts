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

const TARGET_FRAME_HEIGHT = 52;
// Name, level, XP bar and the XP detail line; the mana bar adds a second bar
// and its own label underneath.
const PLAYER_COLUMN_HEIGHT = 82;
const MANA_BLOCK_HEIGHT = 34;
// A worn title gets its own line under the name. "Adventurer, Rat Slayer" on
// one line overruns the 190px column, and shrinking the name to fit made the
// thing the player is proudest of the smallest text on screen.
const TITLE_LINE_HEIGHT = 16;
const TRACKER_LINE_HEIGHT = 18;
// The ability buttons plus the mana-cost line printed under them.
const ACTION_BAR_HEIGHT = THEME.touchMin + 8 + 16;

/** How many quests the tracker strip will show before it stops growing. */
export const MAX_TRACKED_QUESTS = 2;

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
  // Whether a title is worn, which costs the player column an extra line.
  hasTitle?: boolean;
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
  const { scale = 1, hasMana = false, hasTitle = false, trackedQuests = 0 } = options;
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

  const lines = Math.min(trackedQuests, MAX_TRACKED_QUESTS);
  const trackerHeight = lines > 0 ? lines * px(TRACKER_LINE_HEIGHT, scale) + padding : 0;
  const tracker: Rect = {
    x: margin,
    y: actionBar.y - (trackerHeight > 0 ? padding + trackerHeight : 0),
    width: width - margin * 2,
    height: trackerHeight,
  };

  const targetFrame: Rect = {
    x: margin,
    y: margin,
    width: px(THEME.panelWidth.target, scale),
    height: px(TARGET_FRAME_HEIGHT, scale),
  };

  return {
    narrow: isNarrowViewport(width, height),
    margin,
    padding,
    targetFrame,
    playerColumn: {
      x: margin,
      y: targetFrame.y + targetFrame.height + margin,
      width: px(THEME.xpBar.width, scale),
      height: px(
        PLAYER_COLUMN_HEIGHT +
          (hasMana ? MANA_BLOCK_HEIGHT : 0) +
          (hasTitle ? TITLE_LINE_HEIGHT : 0),
        scale,
      ),
    },
    tracker,
    actionBar,
    tabBar,
  };
}

/**
 * How tall the world camera may be: the screen, less the tab bar.
 *
 * Nothing in production calls this, and that is not an oversight. The canvas is
 * full-bleed and a perspective camera cannot shrink without changing what it
 * shows, so the requirement is held by how the camera is *framed* instead
 * (`render3d/camera.ts`: pitch, distance, and a look point aimed short of the
 * player). This is the specification of the band that framing has to keep
 * clear, and the oracle `tests/render3d/camera.test.ts` measures it against.
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
 * Where an open panel goes. Only one is open at a time — that is what the tab
 * bar means — so a sheet gets the whole column rather than sharing it.
 *
 * On a phone it is full width and covers the player column: while a sheet is
 * open, the sheet is what the player is looking at. On a roomy screen it keeps
 * the old right-hand column, since there the playfield is not the scarce thing.
 *
 * The height returned is what the panel has to fit inside; a panel wanting more
 * scrolls rather than running off the screen. It is never negative.
 */
export function sheetRect(layout: HudLayout, viewportWidth: number, preferredWidth: number): Rect {
  const floor =
    (layout.tracker.height > 0 ? layout.tracker.y : layout.actionBar.y) - layout.padding;
  const top = layout.narrow ? layout.margin : playerColumnBottom(layout) + layout.padding;
  const x = layout.narrow ? layout.margin : viewportWidth - preferredWidth - layout.margin;
  const width = layout.narrow ? viewportWidth - layout.margin * 2 : preferredWidth;

  return { x, y: top, width, height: Math.max(0, floor - top) };
}
