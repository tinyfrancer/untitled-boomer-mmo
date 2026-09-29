import { describe, expect, it } from 'vitest';
import { ALL_TABS, MENU_TABS, TABS, isMenuTab } from '../../src/ui/tabs';
import { THEME } from '../../src/ui/theme';

// The bar is a flex row with `padding` on the outside and `gap` between, so
// every tab gets an equal share of what is left.
function tabWidth(viewportWidth: number, tabs: number): number {
  const padding = THEME.padding;
  return (viewportWidth - padding * 2 - padding * (tabs - 1)) / tabs;
}

// The rendered widths are measured by `npm run smoke` at a real 375px viewport;
// this is the arithmetic behind them. It used to say an eighth tab could not be
// added — now it says the bar has room to spare, which is what the menu bought.
describe('the tab bar', () => {
  it('gives every tab a full touch target on the narrowest phone', () => {
    expect(TABS).toHaveLength(5);
    expect(tabWidth(375, TABS.length)).toBeGreaterThanOrEqual(THEME.touchMin);
  });

  it('leaves real headroom rather than the four tenths of a pixel seven had', () => {
    expect(tabWidth(375, TABS.length)).toBeGreaterThan(THEME.touchMin + 20);
  });

  it('holds its touch minimum well below any phone width', () => {
    expect(tabWidth(280, TABS.length)).toBeGreaterThanOrEqual(THEME.touchMin);
  });

  it('keeps Idle on the bar, since it is the one tab that shows state', () => {
    expect(TABS.find((tab) => tab.id === 'idle')?.label).toBe('Idle');
    expect(isMenuTab('idle')).toBe(false);
  });
});

describe('the menu behind the bar', () => {
  it('reaches every surface exactly once, from the bar or from the menu', () => {
    const ids = ALL_TABS.map((tab) => tab.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(TABS.length + MENU_TABS.length);
  });

  it('names each shortcut key once across both tables', () => {
    const keys = ALL_TABS.flatMap((tab) => (tab.key ? [tab.key] : []));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('reports which surfaces live behind it, which is what lights the tab', () => {
    for (const tab of MENU_TABS) {
      expect(isMenuTab(tab.id)).toBe(true);
    }
    for (const tab of TABS) {
      expect(isMenuTab(tab.id)).toBe(false);
    }
  });

  // Two columns inside a box capped at the viewport less a margin either side.
  it('gives its own buttons a full touch target at 375px', () => {
    const box = Math.min(280, 375 - THEME.margin * 2);
    const column = (box - THEME.padding * 2 - THEME.padding) / 2;
    expect(column).toBeGreaterThanOrEqual(THEME.touchMin);
  });
});
