import { describe, expect, it } from 'vitest';
import {
  MAX_TRACKED_QUESTS,
  gatherBarTop,
  hudLayout,
  isNarrowViewport,
  pickerPosition,
  playerColumnBottom,
  sheetRect,
  toastTop,
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

  it('stacks a title, a mana bar and the buff row rather than overlapping them', () => {
    const plain = layoutFor(PHONE_PORTRAIT).playerColumn.height;
    const costOf = (options: object): number =>
      layoutFor(PHONE_PORTRAIT, options).playerColumn.height - plain;

    expect(costOf({ hasMana: true, hasTitle: true, hasEffects: true })).toBe(
      costOf({ hasMana: true }) + costOf({ hasTitle: true }) + costOf({ hasEffects: true }),
    );
  });

  it('keeps the player column clear of the target frame', () => {
    const layout = layoutFor(PHONE_PORTRAIT);
    expect(layout.playerColumn.y).toBeGreaterThanOrEqual(
      layout.targetFrame.y + layout.targetFrame.height,
    );
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

  it('shrinks the sheet when the tracker takes room', () => {
    const bare = layoutFor(PHONE_PORTRAIT);
    const tracked = layoutFor(PHONE_PORTRAIT, { trackedQuests: 2 });
    expect(sheetRect(tracked, PHONE_PORTRAIT.width, 210).height).toBeLessThan(
      sheetRect(bare, PHONE_PORTRAIT.width, 210).height,
    );
  });
});

describe('the two lines over the middle of the playfield', () => {
  // The camera keeps the player centred, so both clear the figure standing
  // there — the announcement above it, the channel bar below.
  it('puts the toast above centre and the gather bar below it', () => {
    const { height } = PHONE_PORTRAIT;
    expect(toastTop(height)).toBeLessThan(height / 2);
    expect(gatherBarTop(height)).toBeGreaterThan(height / 2);
  });

  it('rounds to whole pixels on an odd viewport', () => {
    expect(Number.isInteger(toastTop(667))).toBe(true);
    expect(Number.isInteger(gatherBarTop(667))).toBe(true);
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
