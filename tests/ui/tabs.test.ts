import { describe, expect, it } from 'vitest';
import { TABS } from '../../src/ui/tabs';
import { THEME } from '../../src/ui/theme';

// The bar is a flex row with `padding` on the outside and `gap` between, so
// every tab gets an equal share of what is left.
function tabWidth(viewportWidth: number, tabs: number): number {
  const padding = THEME.padding;
  return (viewportWidth - padding * 2 - padding * (tabs - 1)) / tabs;
}

// The rendered widths are measured by `npm run smoke` at a real 375px viewport;
// this is the arithmetic behind them, which is what says an eighth tab cannot
// be added rather than merely that today's seven happen to fit.
describe('the tab bar is full', () => {
  it('gives seven tabs a full touch target on the narrowest phone', () => {
    expect(TABS).toHaveLength(7);
    expect(tabWidth(375, TABS.length)).toBeGreaterThanOrEqual(THEME.touchMin);
  });

  it('would drop an eighth tab under the touch minimum', () => {
    expect(tabWidth(375, TABS.length + 1)).toBeLessThan(THEME.touchMin);
  });

  it('drops under the minimum below ~372px, which is narrower than any phone', () => {
    expect(tabWidth(372, TABS.length)).toBeGreaterThanOrEqual(THEME.touchMin);
    expect(tabWidth(371, TABS.length)).toBeLessThan(THEME.touchMin);
  });

  it('names each tab and each shortcut key once', () => {
    const ids = TABS.map((tab) => tab.id);
    const keys = TABS.flatMap((tab) => (tab.key ? [tab.key] : []));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
