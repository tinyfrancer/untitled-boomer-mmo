import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hudMounted, mountHud, unmountHud } from '../../src/hud/Hud';
import { AwayReportModal } from '../../src/hud/AwayReportModal';
import { ContextMenu } from '../../src/hud/ContextMenu';
import { InspectModal } from '../../src/hud/InspectModal';
import { OptionsModal } from '../../src/hud/OptionsModal';
import type { Overlay } from '../../src/hud/Overlay';
import { BankModal } from '../../src/hud/BankModal';
import { MAX_BANK_SLOTS } from '../../src/systems/BankSystem';
import { ShopModal } from '../../src/hud/ShopModal';
import { SlotPicker } from '../../src/hud/SlotPicker';
import { createNewCharacter, type CharacterState } from '../../src/persistence';
import { recordingBus, type Emitted } from '../world/harness';
import { carryCapacity, inventoryWeight } from '../../src/systems/EncumbranceSystem';
import { computeEffectiveStats } from '../../src/systems/StatsSystem';
import { worldMap, zoneMap } from '../../src/systems/MapSystem';
import { ENEMIES } from '../../src/data/enemies';
import { SHOP_STOCK } from '../../src/data/shop';
import { formatCurrency } from '../../src/systems/CurrencySystem';
import { describeEnemy, describeEnemyLoot } from '../../src/systems/InspectSystem';
import { THEME } from '../../src/ui/theme';
import { nth } from '../nth';
import {
  ACTIONS_CHANGED_EVENT,
  AFK_TOGGLE_REQUESTED_EVENT,
  CONTEXT_ACTION_REQUESTED_EVENT,
  CONTEXT_MENU_REQUESTED_EVENT,
  COOK_REQUESTED_EVENT,
  CURRENCY_CHANGED_EVENT,
  EAT_ITEM_REQUESTED_EVENT,
  EQUIP_ITEM_REQUESTED_EVENT,
  GEAR_CHANGED_EVENT,
  INVENTORY_CHANGED_EVENT,
  LEVEL_UP_EVENT,
  LIGHT_FIRE_REQUESTED_EVENT,
  PLAYER_DIED_EVENT,
  PLAYER_EFFECTS_CHANGED_EVENT,
  PLAYER_HP_CHANGED_EVENT,
  PLAYER_MANA_CHANGED_EVENT,
  PLAYER_TILE_CHANGED_EVENT,
  SELL_ITEM_REQUESTED_EVENT,
  SHOP_CLOSED_EVENT,
  SHOP_OPENED_EVENT,
  BANK_CHANGED_EVENT,
  BANK_CLOSED_EVENT,
  BANK_OPENED_EVENT,
  BUY_BANK_SLOT_REQUESTED_EVENT,
  DEPOSIT_ITEM_REQUESTED_EVENT,
  WITHDRAW_ITEM_REQUESTED_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  ZONE_ENTERED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
  UNLOCKED_ZONES_CHANGED_EVENT,
  type ContextMenuRequest,
} from '../../src/ui/uiEvents';
import type { OfflineAfkReport } from '../../src/systems/OfflineAfkSystem';
import type { EventBus } from '../../src/world/worldEvents';
import type { PendingNotification } from '../../src/world/GameContext';

/**
 * jsdom lays nothing out, so every element measures zero — which the HUD reads
 * as the narrowest possible phone. The breakpoint is an input to half of what
 * is asserted here (which sheet opens on boot, and whether a resize closes it),
 * so it is stated rather than inherited.
 */
function setViewport(width: number, height: number): void {
  for (const [name, value] of [
    ['clientWidth', width],
    ['clientHeight', height],
  ] as const) {
    Object.defineProperty(Element.prototype, name, { configurable: true, get: () => value });
  }
}

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 900 };

const REPORT: OfflineAfkReport = {
  elapsedMs: 3_600_000,
  kills: 12,
  enemyId: 'rat',
  xp: 60,
  copper: 40,
  drops: { 'rat-bones': 3 },
  missed: {},
  gathers: 0,
  skill: null,
  skillXp: 0,
};

let parent: HTMLElement;
let events: EventBus;
let emitted: Emitted[];

function mount(overrides: Partial<CharacterState> = {}, notifications?: PendingNotification[]) {
  const character = { ...createNewCharacter('Tester', 'warrior'), ...overrides };
  mountHud({ parent, events, character, notifications });
  return character;
}

/** Which sheet the player is looking at — the invariant is that it is one. */
function openSheets(): string[] {
  return [...parent.querySelectorAll<HTMLElement>('.hud-sheet:not(.hud-hidden)')].map(
    (sheet) => sheet.dataset.sheet ?? '',
  );
}

function tab(id: string): HTMLButtonElement {
  const button = parent.querySelector<HTMLButtonElement>(`.hud-tabs__tab[data-tab="${id}"]`);
  if (!button) throw new Error(`no ${id} tab`);
  return button;
}

/** Opens a surface the way a thumb reaches it: the Menu tab, then the button. */
function menuItem(id: string): void {
  tab('menu').click();
  const button = parent.querySelector<HTMLButtonElement>(`[data-menu-tab="${id}"]`);
  if (!button) throw new Error(`no ${id} menu item`);
  button.click();
}

function press(key: string, target: EventTarget = window): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function modals(): HTMLElement[] {
  return [...parent.querySelectorAll<HTMLElement>('.hud-modal')];
}

beforeEach(() => {
  setViewport(PHONE.width, PHONE.height);
  parent = document.createElement('div');
  document.body.append(parent);
  emitted = [];
  events = recordingBus(emitted);
});

afterEach(() => {
  unmountHud();
  parent.remove();
});

describe('mounting', () => {
  it('mounts once and unmounts', () => {
    mount();
    expect(hudMounted()).toBe(true);
    expect(parent.querySelectorAll('.hud')).toHaveLength(1);

    // The HUD outlives every zone, so a second boot must not stack a second one.
    mount();
    expect(parent.querySelectorAll('.hud')).toHaveLength(1);

    unmountHud();
    expect(hudMounted()).toBe(false);
    expect(parent.querySelector('.hud')).toBeNull();
  });

  it('leaves a phone with a clear playfield and gives a roomy screen the sheet', () => {
    mount();
    expect(openSheets()).toEqual([]);
    unmountHud();

    setViewport(DESKTOP.width, DESKTOP.height);
    mount();
    expect(openSheets()).toEqual(['character']);
  });
});

describe('one sheet is open at a time', () => {
  beforeEach(() => mount());

  it('opens exactly one sheet per tab and swaps rather than stacks', () => {
    for (const id of ['character', 'inventory', 'quests']) {
      tab(id).click();
      expect(openSheets()).toEqual([id]);
    }
    for (const id of ['feats', 'log']) {
      menuItem(id);
      expect(openSheets()).toEqual([id]);
    }
  });

  it('lights Menu for a sheet that lives behind it, so the bar is not left dark', () => {
    menuItem('log');
    const lit = [...parent.querySelectorAll<HTMLElement>('.hud-tabs__tab.is-selected')];
    expect(lit.map((button) => button.dataset.tab)).toEqual(['menu']);
  });

  it('closes the menu behind the sheet it opened', () => {
    menuItem('feats');
    expect(modals()).toHaveLength(0);
    expect(openSheets()).toEqual(['feats']);
  });

  it('closes the open sheet when its own tab is tapped again', () => {
    tab('inventory').click();
    tab('inventory').click();
    expect(openSheets()).toEqual([]);
  });

  it('lights the tab of whatever is open, and only that one', () => {
    tab('quests').click();
    const lit = [...parent.querySelectorAll<HTMLElement>('.hud-tabs__tab.is-selected')];
    expect(lit.map((button) => button.dataset.tab)).toEqual(['quests']);
  });

  it('opens no sheet for the tabs that are actions', () => {
    tab('inventory').click();
    tab('camp').click();
    expect(emitted.map((e) => e.event)).toContain(AFK_TOGGLE_REQUESTED_EVENT);
    expect(openSheets()).toEqual(['inventory']);

    menuItem('options');
    expect(openSheets()).toEqual(['inventory']);
    expect(modals()).toHaveLength(1);
  });
});

describe('the keyboard', () => {
  beforeEach(() => mount());

  it('opens a sheet on its tab key', () => {
    press('i');
    expect(openSheets()).toEqual(['inventory']);
    press('c');
    expect(openSheets()).toEqual(['character']);
  });

  it('never steals a letter from a text field', () => {
    const input = document.createElement('input');
    parent.append(input);
    press('i', input);
    expect(openSheets()).toEqual([]);
  });

  it('closes an open modal on Escape before it reaches the tabs', () => {
    menuItem('options');
    expect(modals()).toHaveLength(1);
    press('Escape');
    expect(modals()).toHaveLength(0);
  });

  it('opens a menu-held sheet by its own key, without going through the menu', () => {
    press('l');
    expect(openSheets()).toEqual(['log']);
    expect(modals()).toHaveLength(0);
  });

  it('closes the menu itself on Escape', () => {
    tab('menu').click();
    expect(modals()).toHaveLength(1);
    press('Escape');
    expect(modals()).toHaveLength(0);
  });
});

describe('the redraws that are derived rather than sent', () => {
  const weightLine = (): string =>
    parent.querySelector<HTMLElement>('.hud-weight')?.textContent ?? '';

  it('recounts the pack against a capacity nobody sent it', () => {
    mount();
    const strength = computeEffectiveStats(
      'warrior',
      createNewCharacter('T', 'warrior').gear,
      1,
    ).strength;
    expect(weightLine()).toBe(`0 / ${carryCapacity(strength)} carried`);

    const bag = { 'rat-bones': 3 };
    events.emit(INVENTORY_CHANGED_EVENT, bag);
    expect(weightLine()).toBe(
      `${Math.round(inventoryWeight(bag))} / ${carryCapacity(strength)} carried`,
    );
  });

  it('moves capacity with the strength a level buys', () => {
    mount();
    const before = weightLine();
    events.emit(LEVEL_UP_EVENT, 5);
    expect(weightLine()).not.toBe(before);
    const strength = computeEffectiveStats(
      'warrior',
      createNewCharacter('T', 'warrior').gear,
      5,
    ).strength;
    expect(weightLine()).toBe(`0 / ${carryCapacity(strength)} carried`);
  });

  it('moves capacity with the strength gear carries', () => {
    mount();
    const before = weightLine();
    events.emit(GEAR_CHANGED_EVENT, {
      helmet: null,
      chest: 'brown-chestplate',
      pants: 'brown-legs',
      weapon: 'rusty-sword',
      offhand: null,
    });
    expect(weightLine()).not.toBe(before);
  });

  it('redraws the paperdoll from the gear it is told about', () => {
    mount();
    tab('character').click();
    const slot = parent.querySelector<HTMLElement>('.hud-slot[data-slot="chest"]');
    expect(slot?.textContent).not.toContain('Brown Chestplate');
    events.emit(GEAR_CHANGED_EVENT, {
      helmet: null,
      chest: 'brown-chestplate',
      pants: null,
      weapon: 'rusty-sword',
      offhand: null,
    });
    expect(slot?.textContent).toContain('Brown Chestplate');
  });
});

/**
 * The top-left corner, which is read at a glance mid-fight or not at all.
 *
 * Every number a bar carries is printed inside it and the level shares the
 * name's line, so what is asserted here is mostly *where* a value is rather
 * than that it exists: a health bar with its numbers on a line of their own
 * would pass a `textContent` check and lose the point of the change.
 */
describe('the player column', () => {
  const column = (selector: string): HTMLElement | null =>
    parent.querySelector<HTMLElement>(`.hud-player ${selector}`);
  const widthOf = (selector: string): string => column(selector)?.style.width ?? '';

  it('puts the level on the name line rather than under it', () => {
    mount();
    const head = column('.hud-player__head');
    expect(head?.querySelector('.hud-player__name')?.textContent).toBe('Tester');
    expect(head?.querySelector('.hud-player__level')?.textContent).toBe('Level 1');
  });

  it('prints the XP progress inside the bar instead of on a line of its own', () => {
    mount();
    const label = column('.hud-player__xp .hud-bar__label');
    expect(label?.textContent).toContain('/');
    expect(column('.hud-player__xp-text')).toBeNull();
  });

  it('shows health with the rest of the character details, and drains it', () => {
    const character = mount();
    const { maxHp } = computeEffectiveStats(character.classId, character.gear, character.level);
    expect(column('.hud-player__hp .hud-bar__label')?.textContent).toBe(`${maxHp} / ${maxHp} hp`);
    expect(widthOf('.hud-player__hp .hud-bar__fill')).toBe('100%');

    events.emit(PLAYER_HP_CHANGED_EVENT, Math.floor(maxHp / 2));
    expect(column('.hud-player__hp .hud-bar__label')?.textContent).toContain(
      `${Math.floor(maxHp / 2)} / ${maxHp}`,
    );
    expect(widthOf('.hud-player__hp .hud-bar__fill')).not.toBe('100%');
  });

  it('hangs mana under the health bar, and only for a class with a pool', () => {
    mount();
    const bars = [...parent.querySelectorAll('.hud-player .hud-bar')].map(
      (bar) => [...bar.classList].find((name) => name.startsWith('hud-player__')) ?? '',
    );
    expect(bars).toEqual(['hud-player__hp', 'hud-player__mana', 'hud-player__xp']);

    // A warrior is sent a pool of zero, and no bar at all is what that means.
    expect(column('.hud-player__mana')?.classList.contains('hud-hidden')).toBe(true);
    events.emit(PLAYER_MANA_CHANGED_EVENT, { mana: 12, maxMana: 30 });
    expect(column('.hud-player__mana')?.classList.contains('hud-hidden')).toBe(false);
    expect(column('.hud-player__mana .hud-bar__label')?.textContent).toBe('12 / 30 mana');
  });
});

describe('the buff row', () => {
  const icons = (): string[] =>
    [...parent.querySelectorAll<HTMLElement>('.hud-effect')].map(
      (icon) => icon.dataset.effect ?? '',
    );
  const row = (): HTMLElement | null => parent.querySelector('.hud-effects');

  beforeEach(() => mount());

  it('draws nothing at all until something is up', () => {
    expect(row()?.classList.contains('hud-hidden')).toBe(true);
    expect(icons()).toEqual([]);
  });

  it('draws one icon per effect and takes them off again', () => {
    events.emit(PLAYER_EFFECTS_CHANGED_EVENT, [
      { effectId: 'mana-shield', remainingMs: 15000, durationMs: 20000 },
      { effectId: 'haste', remainingMs: 4000, durationMs: 8000 },
    ]);
    expect(icons()).toEqual(['mana-shield', 'haste']);
    expect(row()?.classList.contains('hud-hidden')).toBe(false);

    events.emit(PLAYER_EFFECTS_CHANGED_EVENT, []);
    expect(icons()).toEqual([]);
    expect(row()?.classList.contains('hud-hidden')).toBe(true);
  });

  it('counts each one down and sweeps its square as it is spent', () => {
    const sweep = (): string =>
      parent.querySelector<HTMLElement>('.hud-effect__sweep')?.style.height ?? '';
    const time = (): string =>
      parent.querySelector<HTMLElement>('.hud-effect__time')?.textContent ?? '';

    events.emit(PLAYER_EFFECTS_CHANGED_EVENT, [
      { effectId: 'haste', remainingMs: 8000, durationMs: 8000 },
    ]);
    expect(sweep()).toBe('0%');
    expect(time()).toBe('8s');

    events.emit(PLAYER_EFFECTS_CHANGED_EVENT, [
      { effectId: 'haste', remainingMs: 2000, durationMs: 8000 },
    ]);
    expect(sweep()).toBe('75%');
    expect(time()).toBe('2s');
  });

  /**
   * The world republishes several times a second while anything is ticking. A
   * row rebuilt at that rate would throw away whatever a desktop player was
   * hovering, so only a change in *which* effects are up may rebuild it.
   */
  it('updates in place while the same effects are up', () => {
    events.emit(PLAYER_EFFECTS_CHANGED_EVENT, [
      { effectId: 'haste', remainingMs: 8000, durationMs: 8000 },
    ]);
    const first = parent.querySelector('.hud-effect');

    events.emit(PLAYER_EFFECTS_CHANGED_EVENT, [
      { effectId: 'haste', remainingMs: 7000, durationMs: 8000 },
    ]);
    expect(parent.querySelector('.hud-effect')).toBe(first);

    events.emit(PLAYER_EFFECTS_CHANGED_EVENT, [
      { effectId: 'haste', remainingMs: 7000, durationMs: 8000 },
      { effectId: 'well-fed', remainingMs: 9000, durationMs: 10000 },
    ]);
    expect(parent.querySelector('.hud-effect')).not.toBe(first);
  });
});

describe('the target frame', () => {
  const hp = (): HTMLElement | null => parent.querySelector('.hud-target__hp .hud-bar__fill');
  const winding = (): HTMLElement | null => parent.querySelector('.hud-target__winding');

  it('draws the target’s health as a bar with the numbers inside it', () => {
    mount();
    events.emit(TARGET_SELECTED_EVENT, {
      name: 'Rat',
      level: 2,
      hp: 3,
      maxHp: 12,
      conColor: '#ffffff',
      winding: null,
    });

    const frame = parent.querySelector<HTMLElement>('.hud-target');
    expect(frame?.classList.contains('hud-hidden')).toBe(false);
    expect(winding()?.classList.contains('hud-hidden')).toBe(true);
    expect(frame?.querySelector('.hud-target__name')?.textContent).toBe('Rat (Lv 2)');
    expect(frame?.querySelector('.hud-target__hp .hud-bar__label')?.textContent).toBe('3 / 12 hp');
    expect(hp()?.style.width).toBe('25%');

    events.emit(TARGET_CLEARED_EVENT);
    expect(frame?.classList.contains('hud-hidden')).toBe(true);
  });

  /**
   * The other half of an enemy ability's telegraph. The shout goes over the
   * creature's head in the world; this is the line where the player is already
   * looking mid-fight, and it is only ever there when something is coming.
   */
  it('says what the target is winding up, and stops saying it when it lands', () => {
    mount();
    const rat = { name: 'Rat', level: 2, hp: 3, maxHp: 12, conColor: '#ffffff' };

    events.emit(TARGET_SELECTED_EVENT, { ...rat, winding: 'Cleave' });
    expect(winding()?.textContent).toBe('Cleave');
    expect(winding()?.classList.contains('hud-hidden')).toBe(false);

    events.emit(TARGET_SELECTED_EVENT, { ...rat, winding: null });
    expect(winding()?.classList.contains('hud-hidden')).toBe(true);
  });
});

describe('the shop', () => {
  const shop = (): HTMLElement | null => parent.querySelector('.hud-modal__box--shop');
  const locked = (): string[] =>
    [...parent.querySelectorAll<HTMLElement>('.hud-modal__box--shop [data-locked]')].map(
      (row) => row.dataset.locked ?? '',
    );
  const gated = nth(SHOP_STOCK.filter((row) => row.requires?.kind === 'level'));
  const gateLevel = gated.requires?.kind === 'level' ? gated.requires.level : 0;

  it('opens and closes with the world, not with a tab', () => {
    mount();
    expect(shop()).toBeNull();
    events.emit(SHOP_OPENED_EVENT);
    expect(shop()).not.toBeNull();
    events.emit(SHOP_CLOSED_EVENT);
    expect(shop()).toBeNull();
  });

  it('refreshes while open from the bag and the purse it does not own', () => {
    mount();
    events.emit(SHOP_OPENED_EVENT);
    expect(shop()?.textContent).not.toContain('Rat Bones');

    events.emit(INVENTORY_CHANGED_EVENT, { 'rat-bones': 2 });
    expect(shop()?.textContent).toContain('Rat Bones');

    events.emit(CURRENCY_CHANGED_EVENT, 1234);
    expect(shop()?.textContent).toContain('12s');
  });

  /**
   * Half the shelf is earned rather than bought. A row that has not been is
   * drawn rather than hidden — it is the whole reason to come back — and carries
   * what it is waiting on where its price would sit, which is what stops it
   * reading as something the purse is merely short of.
   */
  it('draws a row it has not earned with the requirement where the price goes', () => {
    mount();
    events.emit(SHOP_OPENED_EVENT);

    const row = shop()?.querySelector<HTMLElement>(`.hud-list-row[data-item="${gated.itemId}"]`);
    expect(row?.dataset.locked).toBe(gated.itemId);
    expect(row?.querySelector('.hud-list-row__value')?.textContent).toBe(`Level ${gateLevel}`);
  });

  /**
   * A quest handed in at this counter pays XP, so a level can land with the
   * panel open and the player looking at the row it stocks. The shelf is drawn
   * from the HUD's own model, which is what makes that a redraw rather than
   * anything the world has to re-send.
   */
  it('puts the row on the shelf the moment the level lands', () => {
    mount();
    events.emit(SHOP_OPENED_EVENT);
    expect(locked()).toContain(gated.itemId);

    events.emit(LEVEL_UP_EVENT, gateLevel);

    expect(locked()).not.toContain(gated.itemId);
    const row = shop()?.querySelector<HTMLElement>(`.hud-list-row[data-item="${gated.itemId}"]`);
    expect(row?.querySelector('.hud-list-row__value')?.textContent).toBe(
      formatCurrency(gated.price),
    );
  });

  /**
   * The row parts with one and the button beside it empties the stack. They are
   * two targets rather than one row with two meanings: a stack of quest turn-ins
   * is exactly the thing a mis-tap must not be able to sell.
   */
  it('grows a bulk button on a stack, and asks for the whole of it', () => {
    mount();
    events.emit(SHOP_OPENED_EVENT);
    events.emit(INVENTORY_CHANGED_EVENT, { 'rat-bones': 12, 'brown-helmet': 1 });

    expect(shop()?.querySelector('[data-sell-all="brown-helmet"]')).toBeNull();
    shop()?.querySelector<HTMLButtonElement>('[data-sell-all="rat-bones"]')?.click();
    expect(emitted.at(-1)).toEqual({ event: SELL_ITEM_REQUESTED_EVENT, args: ['rat-bones', 12] });

    shop()?.querySelector<HTMLButtonElement>('.hud-list-row[data-item="rat-bones"]')?.click();
    expect(emitted.at(-1)).toEqual({ event: SELL_ITEM_REQUESTED_EVENT, args: ['rat-bones', 1] });
  });
});

describe('the bank', () => {
  const bank = (): HTMLElement | null => parent.querySelector('.hud-modal__box--bank');

  it('opens and closes with the world, like the other counter', () => {
    mount();
    expect(bank()).toBeNull();
    events.emit(BANK_OPENED_EVENT);
    expect(bank()).not.toBeNull();
    events.emit(BANK_CLOSED_EVENT);
    expect(bank()).toBeNull();
  });

  it('draws the shelves the world sent and the pack it already holds', () => {
    mount();
    events.emit(BANK_OPENED_EVENT);
    events.emit(BANK_CHANGED_EVENT, { contents: { logs: 30 }, slots: 8 });
    events.emit(INVENTORY_CHANGED_EVENT, { 'rat-bones': 2 });

    expect(bank()?.textContent).toContain('Logs');
    expect(bank()?.textContent).toContain('Rat Bones');
    expect(bank()?.textContent).toContain('1/8 slots');
  });

  /**
   * Both directions are one gesture: a row moves one across the counter and the
   * smaller button beside it moves the rest, whichever way it is being crossed.
   */
  it('sends a row as one and the button beside it as the stack, both ways', () => {
    mount();
    events.emit(BANK_OPENED_EVENT);
    events.emit(BANK_CHANGED_EVENT, { contents: { logs: 30 }, slots: 8 });
    events.emit(INVENTORY_CHANGED_EVENT, { 'rat-bones': 12 });

    bank()?.querySelector<HTMLButtonElement>('.hud-list-row[data-bank="deposit"]')?.click();
    expect(emitted.at(-1)).toEqual({
      event: DEPOSIT_ITEM_REQUESTED_EVENT,
      args: ['rat-bones', 1],
    });

    bank()
      ?.querySelector<HTMLButtonElement>('.hud-stack:has([data-bank="withdraw"]) [data-bank-all]')
      ?.click();
    expect(emitted.at(-1)).toEqual({ event: WITHDRAW_ITEM_REQUESTED_EVENT, args: ['logs', 30] });
  });

  it('offers a slot to rent until there are none left', () => {
    mount();
    events.emit(BANK_OPENED_EVENT);
    events.emit(BANK_CHANGED_EVENT, { contents: {}, slots: 8 });

    bank()?.querySelector<HTMLButtonElement>('[data-action="buy-bank-slot"]')?.click();
    expect(emitted.at(-1)).toEqual({ event: BUY_BANK_SLOT_REQUESTED_EVENT, args: [] });

    // At the cap it is a line rather than a button: "there are no more" and
    // "you cannot afford it" are different things to tell a player.
    events.emit(BANK_CHANGED_EVENT, { contents: {}, slots: MAX_BANK_SLOTS });
    expect(bank()?.querySelector('[data-action="buy-bank-slot"]')).toBeNull();
    expect(bank()?.textContent).toContain('Every slot rented');
  });
});

describe('the character sheet asks for what it cannot do itself', () => {
  it('opens a picker on an empty slot and asks to unequip a filled one', () => {
    mount();
    tab('character').click();

    parent.querySelector<HTMLButtonElement>('.hud-slot[data-slot="helmet"]')?.click();
    const picker = parent.querySelector('.hud-picker');
    expect(picker).not.toBeNull();

    parent.querySelector<HTMLButtonElement>('.hud-slot[data-slot="weapon"]')?.click();
    expect(emitted.map((e) => e.event)).toContain(UNEQUIP_SLOT_REQUESTED_EVENT);
  });

  it('closes the picker when the sheet behind it closes', () => {
    mount({ inventory: { 'brown-helmet': 1 } });
    tab('character').click();
    parent.querySelector<HTMLButtonElement>('.hud-slot[data-slot="helmet"]')?.click();
    expect(parent.querySelector('.hud-picker')).not.toBeNull();

    tab('inventory').click();
    expect(parent.querySelector('.hud-picker')).toBeNull();
  });

  it('equips through the bus rather than reaching for the character', () => {
    mount({ inventory: { 'brown-helmet': 1 } });
    tab('character').click();
    parent.querySelector<HTMLButtonElement>('.hud-slot[data-slot="helmet"]')?.click();
    parent.querySelector<HTMLButtonElement>('.hud-picker button')?.click();
    expect(emitted.filter((e) => e.event === EQUIP_ITEM_REQUESTED_EVENT)).toHaveLength(1);
  });
});

/**
 * Five buttons, five requests, and nothing in between: the panel asks
 * `ItemActionsSystem` which buttons an item offers and the HUD turns the one
 * pressed into the event that asks for it. What is worth holding is the pairing
 * — an Eat that emitted the cook request would look right until it burnt.
 */
describe('the inventory panel forwards its buttons', () => {
  // One stack among the singles: what a bag cell offers depends on how many of
  // it there are, and only "sell the lot" asks.
  const BAG = { 'brown-helmet': 1, 'cooked-fish': 1, logs: 1, 'raw-fish': 1, 'rat-bones': 12 };

  function pressAction(itemId: string, action: string): void {
    parent.querySelector<HTMLButtonElement>(`.hud-item[data-item="${itemId}"]`)?.click();
    const button = parent.querySelector<HTMLButtonElement>(`[data-item-action="${action}"]`);
    if (!button) throw new Error(`no ${action} button on ${itemId}`);
    button.click();
  }

  beforeEach(() => {
    mount({ inventory: BAG });
    tab('inventory').click();
  });

  it.each([
    ['brown-helmet', 'equip', EQUIP_ITEM_REQUESTED_EVENT],
    ['cooked-fish', 'eat', EAT_ITEM_REQUESTED_EVENT],
  ])('asks to %s the item it was pressed on', (itemId, action, event) => {
    pressAction(itemId, action);
    expect(emitted.filter((e) => e.event === event)).toEqual([{ event, args: [itemId] }]);
  });

  // The two that need the world to allow them first.
  it('asks to cook once there is a fire, and to sell once the shop is open', () => {
    events.emit(ACTIONS_CHANGED_EVENT, { nearFire: true, nearForge: false });
    pressAction('raw-fish', 'cook');
    expect(emitted.at(-1)).toEqual({ event: COOK_REQUESTED_EVENT, args: ['raw-fish'] });

    events.emit(SHOP_OPENED_EVENT);
    pressAction('cooked-fish', 'sell');
    expect(emitted.at(-1)).toEqual({ event: SELL_ITEM_REQUESTED_EVENT, args: ['cooked-fish', 1] });
  });

  // The bulk half of the same request: one event with a count on it, so the
  // counter has one rule about vendoring rather than two.
  it('asks to sell the whole stack, and offers that only on a stack', () => {
    events.emit(SHOP_OPENED_EVENT);

    pressAction('rat-bones', 'sell-all');
    expect(emitted.at(-1)).toEqual({ event: SELL_ITEM_REQUESTED_EVENT, args: ['rat-bones', 12] });

    parent.querySelector<HTMLButtonElement>('.hud-item[data-item="cooked-fish"]')?.click();
    expect(parent.querySelector('[data-item-action="sell-all"]')).toBeNull();
  });

  // The one button that is about where the player is standing rather than about
  // what was pressed, so its request carries nothing.
  it('asks for a fire without naming the logs it would burn', () => {
    pressAction('logs', 'light-fire');
    expect(emitted.at(-1)).toEqual({ event: LIGHT_FIRE_REQUESTED_EVENT, args: [] });
  });
});

/**
 * The right click, and the finger held on a phone. Two menus meet here and are
 * deliberately one component: what the world found under the pointer arrives on
 * the wire, and what a bag cell offers the HUD works out itself.
 */
describe('the context menu', () => {
  const RAT: ContextMenuRequest = {
    title: 'Rat (2)',
    titleColor: THEME.color.con.high,
    actions: [{ id: 'attack', label: 'Attack' }],
    details: describeEnemy(ENEMIES.rat, 2),
    loot: describeEnemyLoot(ENEMIES.rat),
    at: { x: 120, y: 200 },
  };

  const lines = (): string[] =>
    [...parent.querySelectorAll<HTMLElement>('.hud-context__row')].map(
      (row) => row.textContent ?? '',
    );
  const line = (label: string): HTMLButtonElement => {
    const button = parent.querySelector<HTMLButtonElement>(
      `.hud-context__row[data-context-action="${label}"]`,
    );
    if (!button) throw new Error(`no ${label} line: ${lines().join(', ')}`);
    return button;
  };
  const card = (): HTMLElement | null => parent.querySelector('.hud-modal__box--inspect');
  const openFor = (itemId: string): void => {
    const cell = parent.querySelector<HTMLElement>(`.hud-item[data-item="${itemId}"]`);
    cell?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 40, clientY: 60 }));
  };

  describe('over the world', () => {
    beforeEach(() => {
      mount();
      events.emit(CONTEXT_MENU_REQUESTED_EVENT, RAT);
    });

    it('offers what the world can do, then the two panels it was handed', () => {
      expect(lines()).toEqual(['Attack', 'Inspect', 'Loot']);
      expect(parent.querySelector<HTMLElement>('.hud-context__title')?.textContent).toBe('Rat (2)');
    });

    // The only thing that goes back is which line was pressed: the world is
    // holding the rat, and the HUD deliberately never has a reference to it.
    it('asks for the action by id, and closes behind itself', () => {
      line('Attack').click();

      expect(emitted.at(-1)).toEqual({ event: CONTEXT_ACTION_REQUESTED_EVENT, args: ['attack'] });
      expect(lines()).toEqual([]);
    });

    it('shows the stat block without asking the world anything', () => {
      const before = emitted.length;
      line('Inspect').click();

      expect(card()?.textContent).toContain('Level 2 Beast');
      expect(emitted).toHaveLength(before);
    });

    it('shows every drop with the chance the roll actually uses', () => {
      line('Loot').click();

      const drops = [...parent.querySelectorAll<HTMLElement>('.hud-inspect__drop')];
      expect(drops.map((row) => row.dataset.item)).toEqual(['rat-bones', 'rat-meat']);
      expect(drops[0]?.textContent).toContain('60%');
    });

    it('closes on Escape, and the card behind it too', () => {
      line('Inspect').click();
      press('Escape');

      expect(card()).toBeNull();
      expect(lines()).toEqual([]);
    });

    // The HUD outlives the world; a menu about a rat in town does not.
    it.each([
      ['a zone change', () => events.emit(ZONE_ENTERED_EVENT, 'beach')],
      ['a death', () => events.emit(PLAYER_DIED_EVENT)],
    ])('closes on %s', (_case, happen) => {
      happen();
      expect(lines()).toEqual([]);
    });

    it('replaces itself rather than stacking a second menu', () => {
      events.emit(CONTEXT_MENU_REQUESTED_EVENT, { ...RAT, title: 'Rat (1)' });
      expect(parent.querySelectorAll('.hud-context')).toHaveLength(1);
    });
  });

  describe('over the bag', () => {
    beforeEach(() => {
      mount({ inventory: { 'brown-helmet': 1 } });
      tab('inventory').click();
    });

    it('offers the item its own actions, and Inspect after them', () => {
      openFor('brown-helmet');
      expect(lines()).toEqual(['Equip', 'Inspect']);
    });

    it('asks for the action the same way the detail strip does', () => {
      openFor('brown-helmet');
      line('Equip').click();

      expect(emitted.at(-1)).toEqual({
        event: EQUIP_ITEM_REQUESTED_EVENT,
        args: ['brown-helmet'],
      });
    });

    // What the bag has never had room to say: the weight, the price, and which
    // class is allowed to wear it.
    it('spells the item out in full', () => {
      openFor('brown-helmet');
      line('Inspect').click();

      expect(card()?.textContent).toContain('Leather armour');
      expect(card()?.textContent).toContain('Warrior');
      expect(card()?.textContent).toContain('25c');
    });
  });
});

describe('the away report', () => {
  const parked: PendingNotification = { kind: 'offline-afk', report: REPORT };

  it('shows what the camp earned on the boot that resolved it', () => {
    mount({}, [parked]);
    const modal = modals()[0];
    expect(modal?.textContent).toContain('12 kills');
  });

  it('shows nothing when the session was not parked', () => {
    mount({}, []);
    expect(modals()).toHaveLength(0);
  });

  /**
   * A full pack never stops an unattended session — it keeps working and keeps
   * earning — so this list is the only place the cost of one is ever stated.
   */
  it('itemises what the pack had no room for, under its own heading', () => {
    mount({}, [
      {
        kind: 'offline-afk',
        report: {
          ...REPORT,
          kills: 0,
          xp: 0,
          gathers: 15,
          skill: 'fishing',
          skillXp: 100,
          drops: {},
          missed: { 'raw-fish': 15, 'rat-bones': 1 },
        },
      },
    ]);

    const modal = modals()[0];
    expect(modal?.textContent).toContain('15 gathered, 100 Fishing XP');
    expect(modal?.textContent).toContain('Could not carry:');
    const lost = [...(modal?.querySelectorAll('.hud-modal__missed') ?? [])].map(
      (line) => line.textContent,
    );
    expect(lost).toEqual(['Raw Fish x15', 'Rat Bones x1']);
  });

  it('says nothing about carrying when everything fitted', () => {
    mount({}, [parked]);
    expect(modals()[0]?.textContent).not.toContain('Could not carry');
  });
});

describe('destroy', () => {
  it('drops every subscription', () => {
    mount();
    tab('inventory').click();
    unmountHud();

    // The bus outlives the HUD — the session owns it — so a HUD that stayed
    // subscribed would keep drawing into a detached tree forever.
    expect(() => events.emit(INVENTORY_CHANGED_EVENT, { 'rat-bones': 1 })).not.toThrow();
    expect(document.querySelectorAll('.hud-weight')).toHaveLength(0);
  });

  it('stops listening to the keyboard', () => {
    mount();
    unmountHud();
    press('i');
    expect(document.querySelectorAll('.hud-sheet')).toHaveLength(0);
  });

  // All four overlays are appended to the HUD's own root, so removing it takes
  // them with it whether or not `destroy()` names them. That is what makes the
  // omission below invisible from here.
  it('takes every overlay out of the document', () => {
    mount({ inventory: { 'brown-helmet': 1 } });
    tab('character').click();
    parent.querySelector<HTMLButtonElement>('.hud-slot[data-slot="helmet"]')?.click();
    menuItem('options');
    events.emit(SHOP_OPENED_EVENT);
    expect(parent.querySelector('.hud-picker')).not.toBeNull();
    expect(modals()).toHaveLength(2);

    unmountHud();
    expect(document.querySelector('.hud-picker')).toBeNull();
    expect(document.querySelector('.hud-modal')).toBeNull();
  });
});

/**
 * All four overlays close the same way, which they did not before: three had
 * independently written copies of the flag and the guard, and the shop had none
 * at all — so `Hud` reached past it into `root.remove()` and `destroy()` left
 * it out. None of that was visible in the DOM, since every overlay hangs off
 * the root `destroy()` removes, so the lifecycle itself is what is asserted.
 */
describe('every overlay has the same lifecycle', () => {
  const noop = (): void => {};
  const overlays = (onClosed: () => void): Overlay[] => [
    new OptionsModal({ onResetCharacter: noop, onClose: onClosed }),
    new SlotPicker('helmet', [], new DOMRect(), PHONE, noop, onClosed),
    new AwayReportModal(REPORT, onClosed),
    new ShopModal(
      { onBuy: noop, onSell: noop, onAcceptQuest: noop, onTurnInQuest: noop, onDismiss: noop },
      onClosed,
    ),
    new BankModal(
      { onDeposit: noop, onWithdraw: noop, onBuySlot: noop, onDismiss: noop },
      onClosed,
    ),
    new ContextMenu({ title: 'Rat', entries: [], at: { x: 0, y: 0 }, bounds: PHONE, onClosed }),
    new InspectModal(describeEnemy(ENEMIES.rat, 1), onClosed),
  ];

  it('takes each one out of the tree and says so once', () => {
    for (const overlay of overlays(noop)) {
      document.body.append(overlay.root);
      overlay.close();
      expect(overlay.root.isConnected).toBe(false);
    }
  });

  it('closes idempotently: the second close does nothing and calls nothing', () => {
    let closes = 0;
    // Counted off the list rather than written down, so the next overlay to
    // exist is held to the same rule without an edit here.
    const built = overlays(() => closes++);
    for (const overlay of built) {
      overlay.close();
      expect(() => overlay.close()).not.toThrow();
    }
    expect(closes).toBe(built.length);
  });
});

/**
 * The map, which is the only sheet drawn from something the HUD is *told*
 * rather than something it already holds: which zone is running and where the
 * player is standing are both the world's to know.
 */
describe('the map', () => {
  const svg = (): SVGSVGElement | null => parent.querySelector('.hud-map__svg');
  const dot = (): SVGCircleElement | null => parent.querySelector('.hud-map__player');
  const markers = (kind: string): number =>
    parent.querySelectorAll(`.hud-map__svg [data-marker="${kind}"]`).length;

  it('stays blank until the world says which zone it is', () => {
    mount();
    menuItem('map');
    expect(svg()).toBeNull();
  });

  it('draws the terrain, the exits and what is worth walking to', () => {
    mount();
    menuItem('map');
    events.emit(ZONE_ENTERED_EVENT, 'town');

    const map = zoneMap('town');
    expect(svg()?.getAttribute('viewBox')).toBe(`0 0 ${map.columns} ${map.rows}`);
    expect(parent.querySelectorAll('.hud-map__svg rect[fill]').length).toBeGreaterThan(0);
    expect(markers('node')).toBe(map.markers.filter((m) => m.kind === 'node').length);
    expect(markers('npc')).toBe(map.markers.filter((m) => m.kind === 'npc').length);
    expect(markers('exit')).toBe(map.markers.filter((m) => m.kind === 'exit').length);
    expect(
      parent.querySelector('.hud-sheet[data-sheet="map"] .hud-sheet__title')?.textContent,
    ).toBe('Town');
  });

  // A dot parked in the corner would read as a position rather than as an
  // absence, so it waits for a tile of its own.
  it('shows the player only once it has been told where they are', () => {
    mount();
    events.emit(ZONE_ENTERED_EVENT, 'town');
    expect(dot()?.getAttribute('visibility')).toBe('hidden');

    events.emit(PLAYER_TILE_CHANGED_EVENT, { x: 4, y: 7 });
    expect(dot()?.getAttribute('visibility')).toBe('visible');
    expect(dot()?.getAttribute('cx')).toBe('4');
    expect(dot()?.getAttribute('cy')).toBe('7');
  });

  /**
   * The reason the two arrive as separate events: the terrain is four hundred
   * rectangles and the dot is one, so a walk across a zone must not redraw the
   * first to move the second.
   */
  it('moves the dot without rebuilding the terrain under it', () => {
    mount();
    events.emit(ZONE_ENTERED_EVENT, 'town');
    const before = svg();

    events.emit(PLAYER_TILE_CHANGED_EVENT, { x: 1, y: 1 });
    events.emit(PLAYER_TILE_CHANGED_EVENT, { x: 9, y: 3 });

    expect(svg()).toBe(before);
    expect(dot()?.getAttribute('cx')).toBe('9');
  });

  it('redraws for a new zone, and not for the one it is already showing', () => {
    mount();
    events.emit(ZONE_ENTERED_EVENT, 'town');
    const town = svg();

    events.emit(ZONE_ENTERED_EVENT, 'town');
    expect(svg()).toBe(town);

    events.emit(ZONE_ENTERED_EVENT, 'beach');
    expect(svg()).not.toBe(town);
    expect(markers('npc')).toBe(0);
  });
});

/**
 * The zoomed-out view, which is the answer to "which edge was the beach again".
 * Its layout is `worldMap()`'s business and tested there; what matters here is
 * that a tap on a zone asks to go there rather than going there itself.
 */
describe('the world map', () => {
  const zoom = (): HTMLButtonElement | null =>
    parent.querySelector('[data-action="toggle-map-zoom"]');
  const cells = (): string[] =>
    [...parent.querySelectorAll<SVGElement>('.hud-map__zone')].map(
      (cell) => cell.dataset.zone ?? '',
    );
  const cell = (zoneId: string): SVGElement | null =>
    parent.querySelector(`.hud-map__zone[data-zone="${zoneId}"]`);

  function openMap(): void {
    mount();
    menuItem('map');
    events.emit(ZONE_ENTERED_EVENT, 'town');
  }

  it('zooms out to every zone, and back in again', () => {
    openMap();
    expect(cells()).toEqual([]);

    zoom()?.click();
    expect(cells().sort()).toEqual(
      worldMap()
        .zones.map((zone) => zone.zoneId)
        .sort(),
    );
    expect(zoom()?.textContent).toBe('Zone');

    zoom()?.click();
    expect(cells()).toEqual([]);
    expect(parent.querySelector('.hud-map__svg')).not.toBeNull();
  });

  it('says which zone the player is standing in', () => {
    openMap();
    zoom()?.click();

    expect(cell('town')?.dataset.here).toBe('true');
    expect(cell('beach')?.dataset.here).toBeUndefined();
  });

  // The map asks; the world decides. Only it knows whether the player is in the
  // middle of a fight, so nothing here may move them.
  it('asks to travel rather than travelling', () => {
    openMap();
    zoom()?.click();

    cell('beach')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(emitted.filter((entry) => entry.event === 'travel-requested')).toEqual([
      { event: 'travel-requested', args: ['beach'] },
    ]);
  });

  // Pressing your own square is not a request to go where you already are.
  it('zooms in on the zone the player is already in rather than asking', () => {
    openMap();
    zoom()?.click();

    cell('town')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(emitted.filter((entry) => entry.event === 'travel-requested')).toEqual([]);
    expect(cells()).toEqual([]);
  });

  it('follows the player into the zone they travelled to', () => {
    openMap();
    zoom()?.click();
    events.emit(ZONE_ENTERED_EVENT, 'beach');

    expect(cell('beach')?.dataset.here).toBe('true');
    expect(cell('town')?.dataset.here).toBeUndefined();
  });

  /**
   * A shut zone is drawn shut, in three states rather than two — the key being
   * in the pack is the difference between a wall and an invitation, and it is
   * the only thing on this panel that tells a player their looting worked.
   */
  describe('a locked zone', () => {
    it('is drawn shut while there is no way in', () => {
      openMap();
      zoom()?.click();

      expect(cell('bandit-hideout')?.dataset.access).toBe('locked');
      expect(cell('town')?.dataset.access).toBeUndefined();
    });

    // The key can be looted with this very panel open, which is why the sheet
    // reads the bag through a getter rather than being handed it once.
    it('turns to an invitation the moment the key lands in the bag', () => {
      openMap();
      zoom()?.click();

      events.emit(INVENTORY_CHANGED_EVENT, { 'hideout-key': 1 });

      expect(cell('bandit-hideout')?.dataset.access).toBe('unlockable');
    });

    // The key is spent walking through, so the bag cannot answer this: an empty
    // pack is what someone who has already been in there has.
    it('opens for good once the door has been opened, key or no key', () => {
      openMap();
      zoom()?.click();

      events.emit(UNLOCKED_ZONES_CHANGED_EVENT, ['bandit-hideout']);

      expect(cell('bandit-hideout')?.dataset.access).toBeUndefined();
    });

    // Still a tap like any other: whether a door opens is the world's answer,
    // and it says so with the same toast walking into it earns.
    it('is still asked about, so the world can say why not', () => {
      openMap();
      zoom()?.click();

      cell('bandit-hideout')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(emitted.filter((entry) => entry.event === 'travel-requested')).toEqual([
        { event: 'travel-requested', args: ['bandit-hideout'] },
      ]);
    });
  });
});
