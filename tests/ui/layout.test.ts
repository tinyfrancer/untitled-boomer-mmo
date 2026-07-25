import { describe, expect, it } from 'vitest';
import {
  MAX_TRACKED_QUESTS,
  hudLayout,
  isNarrowViewport,
  playerColumnBottom,
  sheetRect,
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

  it('shrinks the sheet when the tracker takes room', () => {
    const bare = layoutFor(PHONE_PORTRAIT);
    const tracked = layoutFor(PHONE_PORTRAIT, { trackedQuests: 2 });
    expect(sheetRect(tracked, PHONE_PORTRAIT.width, 210).height).toBeLessThan(
      sheetRect(bare, PHONE_PORTRAIT.width, 210).height,
    );
  });
});
