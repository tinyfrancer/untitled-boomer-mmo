import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { bindHudKeys } from '../../src/hud/keys';
import { TABS, type TabId } from '../../src/ui/tabs';

/**
 * The window-level half of the HUD. Most of what it does is decide which keys
 * are *not* the HUD's, and a panel is a poor witness to a key nobody took.
 */
let unbind: () => void;
let handlers: {
  onEscape: Mock<() => boolean>;
  onTab: Mock<(tab: TabId) => void>;
  onAbilitySlot: Mock<(slot: number) => void>;
};

function bind(escapeConsumes = false): void {
  handlers = {
    onEscape: vi.fn(() => escapeConsumes),
    onTab: vi.fn<(tab: TabId) => void>(),
    onAbilitySlot: vi.fn<(slot: number) => void>(),
  };
  unbind = bindHudKeys(handlers);
}

function press(init: KeyboardEventInit, target: EventTarget = window): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
}

const INVENTORY_KEY = TABS.find((tab) => tab.id === 'inventory')?.key ?? 'i';

beforeEach(() => bind());

afterEach(() => unbind());

it('opens a sheet on its own tab key, whatever case it is typed in', () => {
  press({ key: INVENTORY_KEY });
  press({ key: INVENTORY_KEY.toUpperCase() });
  expect(handlers.onTab.mock.calls).toEqual([['inventory'], ['inventory']]);
});

it('fires the action bar slots by index, in the order the bar draws them', () => {
  press({ key: '1' });
  press({ key: '2' });
  expect(handlers.onAbilitySlot.mock.calls).toEqual([[0], [1]]);

  // The bar has two slots; a third number belongs to nobody.
  press({ key: '3' });
  expect(handlers.onAbilitySlot).toHaveBeenCalledTimes(2);
});

describe('the keys it refuses to take', () => {
  it('never steals a letter from a text field', () => {
    const input = document.createElement('input');
    document.body.append(input);
    press({ key: INVENTORY_KEY }, input);
    expect(handlers.onTab).not.toHaveBeenCalled();
    input.remove();
  });

  it('leaves a browser shortcut alone', () => {
    press({ key: INVENTORY_KEY, altKey: true });
    press({ key: INVENTORY_KEY, ctrlKey: true });
    press({ key: INVENTORY_KEY, metaKey: true });
    expect(handlers.onTab).not.toHaveBeenCalled();
  });

  it('ignores the repeats of a held key', () => {
    press({ key: INVENTORY_KEY, repeat: true });
    expect(handlers.onTab).not.toHaveBeenCalled();
  });
});

describe('escape', () => {
  it('stops at the overlay that took it', () => {
    unbind();
    bind(true);
    press({ key: 'Escape' });
    expect(handlers.onEscape).toHaveBeenCalledTimes(1);
  });

  // Escape is nobody's tab key today, so what this really holds is that a key
  // an overlay declined goes on being offered to everything after it.
  it('falls through when nothing was open to close', () => {
    press({ key: 'Escape' });
    expect(handlers.onEscape).toHaveBeenCalledTimes(1);
    expect(handlers.onTab).not.toHaveBeenCalled();
  });
});

it('stops listening once unbound', () => {
  unbind();
  unbind = (): void => {};
  press({ key: INVENTORY_KEY });
  expect(handlers.onTab).not.toHaveBeenCalled();
});
