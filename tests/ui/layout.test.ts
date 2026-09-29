import { describe, expect, it } from 'vitest';
import {
  MAX_TRACKED_QUESTS,
  channelBarTop,
  counterLayout,
  hudLayout,
  isNarrowViewport,
  menuPosition,
  pickerPosition,
  playerColumnBottom,
  sheetRect,
  toastTop,
  topRowBottom,
  type HudLayout,
} from '../../src/ui/layout';
import { THEME } from '../../src/ui/theme';

// The viewports that matter, named so a failure says which device broke.
const PHONE_PORTRAIT = { width: 390, height: 844 };
const PHONE_LANDSCAPE = { width: 844, height: 390 };
const SMALL_PHONE = { width: 375, height: 667 };
const DESKTOP = { width: 1440, height: 900 };

const layoutFor = (viewport: { width: number; height: number }, options = {}): HudLayout =>
  hudLayout(viewport.width, viewport.height, options);

describe('isNarrowViewport', () => {
  it('treats both phone orientations as narrow', () => {
    expect(isNarrowViewport(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height)).toBe(true);
    expect(isNarrowViewport(SMALL_PHONE.width, SMALL_PHONE.height)).toBe(true);
  });

  // The bug this exists to stop: 844 is wide by any measure, and the screen
  // still has less vertical room than a portrait phone.
  it('treats a landscape phone as narrow despite its width', () => {
    expect(isNarrowViewport(PHONE_LANDSCAPE.width, PHONE_LANDSCAPE.height)).toBe(true);
  });

  it('leaves a desktop roomy', () => {
    expect(isNarrowViewport(DESKTOP.width, DESKTOP.height)).toBe(false);
  });
});

describe('hudLayout', () => {
  it('pins the tab bar to the bottom edge at full width', () => {
    const layout = layoutFor(PHONE_PORTRAIT);
    expect(layout.tabBar.x).toBe(0);
    expect(layout.tabBar.width).toBe(PHONE_PORTRAIT.width);
    expect(layout.tabBar.y + layout.tabBar.height).toBe(PHONE_PORTRAIT.height);
  });

  it('keeps every tab-bar row a full touch target tall', () => {
    const layout = layoutFor(PHONE_PORTRAIT);
    expect(layout.tabBar.height).toBeGreaterThanOrEqual(THEME.touchMin);
  });

  it('stacks the ability bar above the tab bar without overlapping it', () => {
    const layout = layoutFor(PHONE_PORTRAIT);
    expect(layout.actionBar.y + layout.actionBar.height).toBeLessThanOrEqual(layout.tabBar.y);
  });

  it('gives the tracker no height until something is being tracked', () => {
    expect(layoutFor(PHONE_PORTRAIT).tracker.height).toBe(0);
    expect(layoutFor(PHONE_PORTRAIT, { trackedQuests: 1 }).tracker.height).toBeGreaterThan(0);
  });

  it('grows the tracker per quest and then stops', () => {
    const one = layoutFor(PHONE_PORTRAIT, { trackedQuests: 1 }).tracker;
    const two = layoutFor(PHONE_PORTRAIT, { trackedQuests: 2 }).tracker;
    const many = layoutFor(PHONE_PORTRAIT, { trackedQuests: 9 }).tracker;
    expect(two.height).toBeGreaterThan(one.height);
    expect(many.height).toBe(
      layoutFor(PHONE_PORTRAIT, { trackedQuests: MAX_TRACKED_QUESTS }).tracker.height,
    );
  });

  it('pushes the tracker up to sit above the ability bar', () => {
    const layout = layoutFor(PHONE_PORTRAIT, { trackedQuests: 2 });
    expect(layout.tracker.y + layout.tracker.height).toBeLessThanOrEqual(layout.actionBar.y);
  });

  it('makes room for the mana bar only for a class that has one', () => {
    const warrior = layoutFor(PHONE_PORTRAIT).playerColumn.height;
    const wizard = layoutFor(PHONE_PORTRAIT, { hasMana: true }).playerColumn.height;
    expect(wizard).toBeGreaterThan(warrior);
  });

  // A ranger's arrows are a bar of their own, the mana bar's height, and a
  // wizard who puts a quiver on pays for both.
  it('makes room for the quiver bar only while one is worn', () => {
    const plain = layoutFor(PHONE_PORTRAIT).playerColumn.height;
    const quivered = layoutFor(PHONE_PORTRAIT, { hasQuiver: true }).playerColumn.height;
    const mana = layoutFor(PHONE_PORTRAIT, { hasMana: true }).playerColumn.height;
    const both = layoutFor(PHONE_PORTRAIT, { hasMana: true, hasQuiver: true }).playerColumn.height;
    expect(quivered - plain).toBe(mana - plain);
    expect(both - plain).toBe(2 * (mana - plain));
  });

  // A worn title takes its own line under the name rather than being appended
  // to it, so the column has to grow by one line when there is one.
  it('makes room for a title only once one is worn', () => {
    const untitled = layoutFor(PHONE_PORTRAIT).playerColumn.height;
    const titled = layoutFor(PHONE_PORTRAIT, { hasTitle: true }).playerColumn.height;
    expect(titled).toBeGreaterThan(untitled);
  });

  // The buff icons sit side by side, so the first one costs the column a row
  // and the rest are free — presence is the whole of the question.
  it('makes room for the buff row only while something is up', () => {
    const bare = layoutFor(PHONE_PORTRAIT).playerColumn.height;
    const buffed = layoutFor(PHONE_PORTRAIT, { hasEffects: true }).playerColumn.height;
    expect(buffed).toBeGreaterThan(bare);
  });

  // The skill last trained is one more bar with its numbers inside it, so it
  // costs what the mana bar does, and only while it is up.
  it('makes room for the training bar only while it is up', () => {
    const plain = layoutFor(PHONE_PORTRAIT).playerColumn.height;
    const training = layoutFor(PHONE_PORTRAIT, { hasTraining: true }).playerColumn.height;
    const mana = layoutFor(PHONE_PORTRAIT, { hasMana: true }).playerColumn.height;
    expect(training - plain).toBe(mana - plain);
  });

  it('stacks a title, a mana bar, the training bar and the buff row rather than overlapping them', () => {
    const plain = layoutFor(PHONE_PORTRAIT).playerColumn.height;
    const costOf = (options: object): number =>
      layoutFor(PHONE_PORTRAIT, options).playerColumn.height - plain;

    expect(costOf({ hasMana: true, hasTitle: true, hasTraining: true, hasEffects: true })).toBe(
      costOf({ hasMana: true }) +
        costOf({ hasTitle: true }) +
        costOf({ hasTraining: true }) +
        costOf({ hasEffects: true }),
    );
  });

  /**
   * The landscape phone is the case: 390px tall, and the column at its tallest
   * — a wizard wearing a quiver, titled, buffed and training — reaches below
   * the top of two tracked lines. The tracker steps right of it there, and a
   * short column leaves it the whole width.
   */
  it.each([
    ['phone portrait', PHONE_PORTRAIT],
    ['phone landscape', PHONE_LANDSCAPE],
    ['small landscape', { width: SMALL_PHONE.height, height: SMALL_PHONE.width }],
    ['small phone', SMALL_PHONE],
    ['desktop', DESKTOP],
  ] as const)('never lets the tallest column meet the tracker on %s', (_, viewport) => {
    const layout = layoutFor(viewport, {
      hasMana: true,
      hasQuiver: true,
      hasTitle: true,
      hasTraining: true,
      hasEffects: true,
      trackedQuests: MAX_TRACKED_QUESTS,
    });
    const { playerColumn: column, tracker } = layout;
    const beside = tracker.x >= column.x + column.width + layout.padding;
    const below = tracker.y >= column.y + column.height + layout.padding;
    expect(beside || below).toBe(true);
    expect(tracker.x + tracker.width).toBe(viewport.width - layout.margin);
  });

  it('gives the tracker the whole width under a column that stops short of it', () => {
    const layout = layoutFor(PHONE_LANDSCAPE, { hasTraining: true, trackedQuests: 2 });
    expect(layout.tracker.x).toBe(layout.margin);
    expect(layout.tracker.width).toBe(PHONE_LANDSCAPE.width - layout.margin * 2);
  });

  // The two corners share the top row now rather than stacking, which is what
  // buys the player column the top of the screen.
  it('puts the player column top-left and the target frame top-right', () => {
    const layout = layoutFor(PHONE_PORTRAIT);
    expect(layout.playerColumn.x).toBe(layout.margin);
    expect(layout.playerColumn.y).toBe(layout.margin);
    expect(layout.targetFrame.y).toBe(layout.margin);
    expect(layout.targetFrame.x + layout.targetFrame.width).toBe(
      PHONE_PORTRAIT.width - layout.margin,
    );
  });

  /**
   * The regression the width clamp exists for: at 375px a full-width target
   * frame and a 190px player column meet in the middle, and the narrower the
   * phone the deeper they overlap. The frame takes what is left instead.
   */
  it.each([
    ['phone portrait', PHONE_PORTRAIT],
    ['phone landscape', PHONE_LANDSCAPE],
    ['small phone', SMALL_PHONE],
    ['desktop', DESKTOP],
  ] as const)('never lets the two top corners overlap on %s', (_, viewport) => {
    const layout = layoutFor(viewport, { hasMana: true, hasTitle: true, hasEffects: true });
    expect(layout.targetFrame.x).toBeGreaterThanOrEqual(
      layout.playerColumn.x + layout.playerColumn.width + layout.padding,
    );
    expect(layout.targetFrame.width).toBeGreaterThan(0);
  });

  it('gives the target frame its full width when there is room for it', () => {
    expect(layoutFor(DESKTOP).targetFrame.width).toBe(THEME.panelWidth.target);
  });

  /**
   * A wound-up enemy ability names itself under the health bar, and the frame
   * has to be tall enough to hold the warning or the warning is clipped. Only
   * while something is coming — the same bargain the worn title and the buff row
   * make in the other corner.
   */
  it('grows the target frame by a line while the target is winding up', () => {
    const quiet = layoutFor(PHONE_PORTRAIT);
    const winding = layoutFor(PHONE_PORTRAIT, { targetWinding: true });

    expect(winding.targetFrame.height).toBeGreaterThan(quiet.targetFrame.height);
    expect(winding.targetFrame.width).toBe(quiet.targetFrame.width);
    expect(topRowBottom(winding)).toBeGreaterThanOrEqual(topRowBottom(quiet));
  });
});

describe('sheetRect', () => {
  const viewports = [
    ['phone portrait', PHONE_PORTRAIT],
    ['phone landscape', PHONE_LANDSCAPE],
    ['small phone', SMALL_PHONE],
    ['desktop', DESKTOP],
  ] as const;

  // The landscape case is the regression: the bag used to be positioned at
  // y=560 on a 390-tall screen with a computed height of -182.
  it.each(viewports)('keeps a sheet on screen with usable height on %s', (_, viewport) => {
    const layout = layoutFor(viewport);
    const sheet = sheetRect(layout, viewport.width, THEME.panelWidth.inventory);

    expect(sheet.x).toBeGreaterThanOrEqual(0);
    expect(sheet.y).toBeGreaterThanOrEqual(0);
    expect(sheet.x + sheet.width).toBeLessThanOrEqual(viewport.width);
    expect(sheet.y + sheet.height).toBeLessThanOrEqual(viewport.height);
    expect(sheet.height).toBeGreaterThan(THEME.touchMin * 2);
  });

  it.each(viewports)('never lets a sheet reach the tab bar on %s', (_, viewport) => {
    const layout = layoutFor(viewport, { trackedQuests: 2 });
    const sheet = sheetRect(layout, viewport.width, THEME.panelWidth.inventory);
    expect(sheet.y + sheet.height).toBeLessThanOrEqual(layout.tabBar.y);
  });

  it('gives a phone the full width and a desktop the panel width', () => {
    const phone = layoutFor(PHONE_PORTRAIT);
    expect(sheetRect(phone, PHONE_PORTRAIT.width, THEME.panelWidth.inventory).width).toBe(
      PHONE_PORTRAIT.width - phone.margin * 2,
    );

    const desktop = layoutFor(DESKTOP);
    expect(sheetRect(desktop, DESKTOP.width, THEME.panelWidth.inventory).width).toBe(
      THEME.panelWidth.inventory,
    );
  });

  it('leaves the player column visible on a desktop and covers it on a phone', () => {
    const desktop = layoutFor(DESKTOP);
    expect(sheetRect(desktop, DESKTOP.width, THEME.panelWidth.character).y).toBeGreaterThanOrEqual(
      playerColumnBottom(desktop),
    );

    const phone = layoutFor(PHONE_PORTRAIT);
    expect(sheetRect(phone, PHONE_PORTRAIT.width, THEME.panelWidth.character).y).toBeLessThan(
      playerColumnBottom(phone),
    );
  });

  // The tallest the column ever gets: a titled caster with buffs up. On a roomy
  // screen the sheet starts below it, so this is the case where the two would
  // collide if the reserved height stopped keeping up with what is drawn.
  it('still leaves a usable sheet under the tallest the player column gets', () => {
    const layout = layoutFor(DESKTOP, { hasMana: true, hasTitle: true, hasEffects: true });
    const sheet = sheetRect(layout, DESKTOP.width, THEME.panelWidth.character);

    expect(sheet.y).toBeGreaterThanOrEqual(playerColumnBottom(layout));
    expect(sheet.y + sheet.height).toBeLessThanOrEqual(layout.tabBar.y);
    expect(sheet.height).toBeGreaterThan(THEME.touchMin * 2);
  });

  /**
   * A desktop sheet opens in the right-hand column, which is the target frame's
   * own corner now — so clearing the player column is no longer enough on its
   * own. The column happens to be the taller of the two today; that is a
   * coincidence between two independently tuned heights, not a rule, which is
   * why the sheet is measured against whichever is lower on the screen.
   */
  it('opens a desktop sheet below both top corners, not just the column', () => {
    const layout = layoutFor(DESKTOP);
    const sheet = sheetRect(layout, DESKTOP.width, THEME.panelWidth.character);
    const frameBottom = layout.targetFrame.y + layout.targetFrame.height;

    expect(topRowBottom(layout)).toBe(Math.max(playerColumnBottom(layout), frameBottom));
    expect(sheet.y).toBeGreaterThanOrEqual(frameBottom);
    // And it really does open under that corner, or there would be nothing to
    // clear: the sheet's right edge is the frame's right edge.
    expect(sheet.x).toBeLessThan(layout.targetFrame.x + layout.targetFrame.width);
  });

  it('shrinks the sheet when the tracker takes room', () => {
    const bare = layoutFor(PHONE_PORTRAIT);
    const tracked = layoutFor(PHONE_PORTRAIT, { trackedQuests: 2 });
    expect(sheetRect(tracked, PHONE_PORTRAIT.width, 210).height).toBeLessThan(
      sheetRect(bare, PHONE_PORTRAIT.width, 210).height,
    );
  });
});

describe('counterLayout', () => {
  // Both phones are narrow to `hudLayout`, and they come out on opposite sides
  // of this: it asks whether two lists fit across, which is exactly what a
  // landscape phone has and a portrait one lacks.
  it('stands the two sides one over the other on a portrait phone', () => {
    for (const phone of [PHONE_PORTRAIT, SMALL_PHONE]) {
      const layout = counterLayout(phone.width);
      expect(layout.sideBySide).toBe(false);
      expect(layout.width).toBeLessThanOrEqual(phone.width - THEME.margin * 2);
    }
  });

  it('stands them side by side on a landscape phone and a desktop', () => {
    for (const screen of [PHONE_LANDSCAPE, DESKTOP]) {
      const layout = counterLayout(screen.width);
      expect(layout.sideBySide).toBe(true);
      expect(layout.width).toBeLessThanOrEqual(screen.width - THEME.margin * 2);
    }
  });
});

describe('the two lines over the middle of the playfield', () => {
  // The camera keeps the player centred, so both clear the figure standing
  // there — the announcement above it, the channel bar below.
  it('puts the toast above centre and the gather bar below it', () => {
    const { height } = PHONE_PORTRAIT;
    expect(toastTop(height)).toBeLessThan(height / 2);
    expect(channelBarTop(height)).toBeGreaterThan(height / 2);
  });

  it('rounds to whole pixels on an odd viewport', () => {
    expect(Number.isInteger(toastTop(667))).toBe(true);
    expect(Number.isInteger(channelBarTop(667))).toBe(true);
  });
});

describe('pickerPosition', () => {
  const BOUNDS = { width: 375, height: 812 };
  const BOX = { width: 160, height: 200 };
  const anchorAt = (left: number, top: number, width = 200) => ({
    left,
    right: left + width,
    top,
  });

  it('opens to the left of the row it was asked from', () => {
    const anchor = anchorAt(190, 100);
    const { x } = pickerPosition(anchor, BOX, BOUNDS);
    expect(x + BOX.width).toBeLessThanOrEqual(anchor.left);
  });

  it('flips to the right when the left would run off the screen', () => {
    const anchor = anchorAt(20, 100, 120);
    const { x } = pickerPosition(anchor, BOX, BOUNDS);
    expect(x).toBeGreaterThanOrEqual(anchor.right);
  });

  // The bottom slot: the picker is taller than the room under the row that
  // opened it, and hung off the screen before it was held inside.
  it('holds a tall picker inside the viewport', () => {
    const { y } = pickerPosition(anchorAt(190, 700), BOX, BOUNDS);
    expect(y + BOX.height).toBeLessThanOrEqual(BOUNDS.height);
  });

  it('never places one off the top or the left, however little room there is', () => {
    const tight = { width: 100, height: 100 };
    const { x, y } = pickerPosition(anchorAt(10, 10), BOX, tight);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
  });
});

/**
 * Where a menu opened at a point lands. The press it belongs to is usually a
 * thumb, so the rule is about not opening the menu under the thing that asked
 * for it — which a clamp cannot do and a fold can.
 */
describe('menuPosition', () => {
  const BOUNDS = { width: 375, height: 812 };
  const BOX = { width: 160, height: 180 };

  it('opens down and to the right of the press, where every menu does', () => {
    expect(menuPosition({ x: 80, y: 200 }, BOX, BOUNDS)).toEqual({ x: 80, y: 200 });
  });

  it('folds back over the press rather than sliding along the edge', () => {
    const { x, y } = menuPosition({ x: 340, y: 780 }, BOX, BOUNDS);
    expect(x).toBe(340 - BOX.width);
    expect(y).toBe(780 - BOX.height);
  });

  it('holds a menu bigger than the screen inside it anyway', () => {
    const tight = { width: 120, height: 120 };
    const { x, y } = menuPosition({ x: 10, y: 10 }, BOX, tight);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });
});
