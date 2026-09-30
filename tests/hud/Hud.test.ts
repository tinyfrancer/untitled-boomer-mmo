import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hudMounted, mountHud, unmountHud } from '../../src/hud/Hud';
import { TRAINING_FADE_AFTER_MS, TRAINING_FADE_MS } from '../../src/hud/TrainingBar';
import { fillPercent } from '../../src/hud/dom';
import { barFill } from '../../src/systems/math';
import { skillXpToNextLevel } from '../../src/systems/SkillSystem';
import { AwayReportModal } from '../../src/hud/AwayReportModal';
import { ContextMenu } from '../../src/hud/ContextMenu';
import { InspectModal } from '../../src/hud/InspectModal';
import { OptionsModal } from '../../src/hud/OptionsModal';
import { LoadSaveModal } from '../../src/hud/LoadSaveModal';
import { copyText, downloadFile } from '../../src/hud/saveTransfer';
import { writeSaveExport } from '../../src/persistence/saveFile';
import { DEFAULT_SOUND } from '../../src/audio/settings';
import type { Overlay } from '../../src/hud/Overlay';
import { BankModal } from '../../src/hud/BankModal';
import { MAX_BANK_SLOTS } from '../../src/systems/BankSystem';
import { ShopModal } from '../../src/hud/ShopModal';
import { SlotPicker } from '../../src/hud/SlotPicker';
import { createNewCharacter, type CharacterState } from '../../src/persistence';
import { recordingBus, type Emitted } from '../world/harness';
import { carryCapacity, inventoryWeight } from '../../src/systems/EncumbranceSystem';
import { computeEffectiveStats } from '../../src/systems/StatsSystem';
import { damageReduction } from '../../src/systems/CombatSystem';
import { ALL_TABS, isMenuTab } from '../../src/ui/tabs';
import { NO_GEAR, type Gear } from '../../src/systems/InventorySystem';
import { worldMap, zoneMap } from '../../src/systems/MapSystem';
import { ENEMIES } from '../../src/data/enemies';
import { conColor } from '../../src/systems/EnemySystem';
import { SHOP_STOCK } from '../../src/data/shop';
import { formatCurrency } from '../../src/systems/CurrencySystem';
import { describeEnemy, describeEnemyLoot, describePile } from '../../src/systems/InspectSystem';
import { THEME } from '../../src/ui/theme';
import { InputState, bindKeyboard } from '../../src/systems/InputState';
import { nth } from '../nth';
import { NPCS, ROLE_SERVICES, type CounterId, type NpcRoleId } from '../../src/data/npcs';
import { QUESTS, QUEST_ORDER } from '../../src/data/quests';
import {
  ACCEPT_QUEST_REQUESTED_EVENT,
  ACTIONS_CHANGED_EVENT,
  AFK_SET_REQUESTED_EVENT,
  AFK_STATE_CHANGED_EVENT,
  IDLE_FOOD_CHANGED_EVENT,
  IDLE_FOOD_KEEP_REQUESTED_EVENT,
  IDLE_FOOD_MOVE_REQUESTED_EVENT,
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
  QUIVER_CHANGED_EVENT,
  PLAYER_TILE_CHANGED_EVENT,
  QUEST_LOG_CHANGED_EVENT,
  SELL_ITEM_REQUESTED_EVENT,
  BANK_CHANGED_EVENT,
  BUY_BANK_SLOT_REQUESTED_EVENT,
  DEPOSIT_ITEM_REQUESTED_EVENT,
  WITHDRAW_ITEM_REQUESTED_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  TURN_IN_QUEST_REQUESTED_EVENT,
  ZONE_ENTERED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
  UNLOCKED_ZONES_CHANGED_EVENT,
  type ContextMenuRequest,
  COUNTER_OPENED_EVENT,
  COUNTER_CLOSED_EVENT,
  COUNTER_REQUESTED_EVENT,
  SOUND_SETTINGS_CHANGED_EVENT,
  SAVE_EXPORT_REQUESTED_EVENT,
  SAVE_EXPORTED_EVENT,
  SAVE_IMPORT_REQUESTED_EVENT,
  BUY_ITEM_REQUESTED_EVENT,
  STATION_OPENED_EVENT,
  MASTERY_CHANGED_EVENT,
  SKILL_XP_GAINED_EVENT,
  TIP_HEARD_EVENT,
  TIP_OFFERED_EVENT,
  SECRET_FOUND_EVENT,
  SECRETS_CHANGED_EVENT,
  TIPS_SET_REQUESTED_EVENT,
  TIPS_STATE_CHANGED_EVENT,
  CREATURES_CHANGED_EVENT,
  MINIMAP_SET_REQUESTED_EVENT,
  MINIMAP_STATE_CHANGED_EVENT,
} from '../../src/ui/uiEvents';
import { OFFLINE_CAP_MS, type OfflineAfkReport } from '../../src/systems/OfflineAfkSystem';
import type { EventBus } from '../../src/world/worldEvents';
import type { PendingNotification } from '../../src/world/GameContext';
import type { NpcId, SkillId, ZoneId } from '../../src/types/ids';

// A page's downloads and clipboard, which jsdom has neither of. What the HUD
// hands them is what is asserted.
vi.mock('../../src/hud/saveTransfer', () => ({
  downloadFile: vi.fn(),
  copyText: vi.fn(async () => true),
}));

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
  consumed: {},
  gathers: 0,
  crafts: 0,
  skill: null,
  skillXp: 0,
  masteryTargetId: null,
  arrowsSpent: 0,
  outOfArrows: false,
  capped: false,
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

  // A panel is called what its tab calls it: Bag had opened "Inventory (I)"
  // and Feats "Achievements", and a tip pointing at Feats found neither. A
  // label may abbreviate the title (Char, Character), never rename it. The map
  // is left out because its title names the zone it draws.
  it.each(ALL_TABS.filter((definition) => definition.kind === 'sheet' && definition.id !== 'map'))(
    'titles the $id sheet with its tab’s own word',
    ({ id, label }) => {
      if (isMenuTab(id)) menuItem(id);
      else tab(id).click();
      const title = parent.querySelector(`[data-sheet="${id}"] .hud-sheet__title`)?.textContent;
      expect(title?.startsWith(label)).toBe(true);
    },
  );

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
    menuItem('options');
    expect(openSheets()).toEqual(['inventory']);
    expect(modals()).toHaveLength(1);
  });
});

/**
 * The speaker, which is the one thing in Options that is not the character's.
 * The HUD is handed where it was left and only ever sends a whole new setting
 * back — it keeps nothing on the device itself, so the host stays the one place
 * the setting is stored.
 */
/**
 * The idle panel (decision 96): the Idle tab opens it rather than starting idle,
 * it says what idle will do before its own button starts it, and it holds the
 * food rows the player orders and keeps.
 */
describe('the idle panel', () => {
  const panel = (): HTMLElement | null =>
    parent.querySelector<HTMLElement>('.hud-sheet[data-sheet="idle"]');
  const lines = (): string[] =>
    [...(panel()?.querySelectorAll('.hud-idle__line') ?? [])].map((line) => line.textContent ?? '');
  const button = (action: string): HTMLButtonElement => {
    const found = panel()?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
    if (!found) throw new Error(`no ${action} button`);
    return found;
  };
  const foodButton = (itemId: string, action: string): HTMLButtonElement => {
    const found = panel()?.querySelector<HTMLButtonElement>(
      `[data-food="${itemId}"] [data-action="${action}"]`,
    );
    if (!found) throw new Error(`no ${action} button on ${itemId}`);
    return found;
  };
  const foods = (): string[] =>
    [...(panel()?.querySelectorAll<HTMLElement>('.hud-idle-food') ?? [])].map(
      (row) => row.dataset.food ?? '',
    );
  const sent = (event: string) => emitted.filter((e) => e.event === event).map((e) => e.args);

  it('opens from its tab and its key, and starts nothing on its own', () => {
    mount();
    tab('idle').click();
    expect(openSheets()).toEqual(['idle']);
    expect(sent(AFK_SET_REQUESTED_EVENT)).toEqual([]);

    tab('idle').click();
    press('z');
    expect(openSheets()).toEqual(['idle']);
  });

  it('says what idle will do before it starts', () => {
    mount();
    tab('idle').click();
    expect(lines()).toContain('Fight what comes near where you start, never starting on a boss');
    expect(lines()).toContain('Half the XP for kills, and no abilities');
    expect(lines()).toContain('Counts up to 8 hours');
    expect(button('start-idle').textContent).toBe('Start idle');
  });

  it('asks for idle on, and steps out of the way of the character it set going', () => {
    mount();
    tab('idle').click();
    button('start-idle').click();

    expect(sent(AFK_SET_REQUESTED_EVENT)).toEqual([[true]]);
    expect(openSheets()).toEqual([]);
  });

  it('lights its tab while idle runs, and offers Stop in the panel', () => {
    mount();
    events.emit(AFK_STATE_CHANGED_EVENT, true);
    expect(tab('idle').classList.contains('is-lit')).toBe(true);

    tab('idle').click();
    button('stop-idle').click();
    expect(sent(AFK_SET_REQUESTED_EVENT)).toEqual([[false]]);

    events.emit(AFK_STATE_CHANGED_EVENT, false);
    expect(tab('idle').classList.contains('is-lit')).toBe(false);
    expect(button('start-idle').textContent).toBe('Start idle');
  });

  // A station underfoot beats the tool in hand, so walking up to one is a
  // different job, and the panel says the new one.
  it('follows the station the player walks up to', () => {
    mount({ inventory: { 'raw-fish': 4 } });
    tab('idle').click();
    events.emit(ACTIONS_CHANGED_EVENT, { nearFire: true, nearStations: ['fire'] });

    expect(lines()).toContain('Cook at the campfire: Raw Fish → Cooked Fish');
    expect(lines()).toContain('The campfire goes out, so instead:');
  });

  it('lists the food in the order idle eats it, and asks to move or keep one', () => {
    mount({ inventory: { 'cooked-crab': 2, 'cooked-rat': 3 } });
    tab('idle').click();
    expect(foods()).toEqual(['cooked-rat', 'cooked-crab']);
    // Nothing above the first to move past, and nothing below the last.
    expect(foodButton('cooked-rat', 'food-earlier').disabled).toBe(true);
    expect(foodButton('cooked-crab', 'food-later').disabled).toBe(true);

    foodButton('cooked-crab', 'food-earlier').click();
    foodButton('cooked-crab', 'food-keep').click();
    expect(sent(IDLE_FOOD_MOVE_REQUESTED_EVENT)).toEqual([['cooked-crab', 'earlier']]);
    expect(sent(IDLE_FOOD_KEEP_REQUESTED_EVENT)).toEqual([['cooked-crab', true]]);
  });

  it('redraws from the choice the world answers with', () => {
    mount({ inventory: { 'cooked-crab': 2, 'cooked-rat': 3 } });
    tab('idle').click();
    events.emit(IDLE_FOOD_CHANGED_EVENT, {
      order: ['cooked-crab', 'cooked-rat'],
      keep: ['cooked-crab'],
    });

    expect(foods()).toEqual(['cooked-crab', 'cooked-rat']);
    expect(foodButton('cooked-crab', 'food-keep').classList.contains('is-lit')).toBe(true);
    expect(panel()?.querySelector('[data-food="cooked-crab"]')?.textContent).toContain('Kept');
  });

  it('starts from the choice the save holds', () => {
    mount({
      inventory: { 'cooked-crab': 2, 'cooked-rat': 3 },
      idleFood: { order: ['cooked-crab'], keep: [] },
    });
    tab('idle').click();
    expect(foods()).toEqual(['cooked-crab', 'cooked-rat']);
  });
});

describe("the options menu's sound", () => {
  const soundButton = (): HTMLButtonElement | null =>
    parent.querySelector('[data-action="toggle-sound"]');
  const volume = (): HTMLInputElement | null => parent.querySelector('[data-action="volume"]');
  const sent = () =>
    emitted.filter((e) => e.event === SOUND_SETTINGS_CHANGED_EVENT).map((e) => e.args[0]);

  it('opens on what the host handed the HUD', () => {
    mountHud({
      parent,
      events,
      character: createNewCharacter('Tester', 'warrior'),
      sound: { muted: true, volume: 0.3 },
    });
    menuItem('options');
    expect(soundButton()?.textContent).toBe('Sound: Off');
    expect(soundButton()?.getAttribute('aria-pressed')).toBe('false');
    expect(volume()?.value).toBe('30');
    // Kept in its place while muted, so it says what unmuting comes back at.
    expect(volume()?.disabled).toBe(true);
  });

  it('sends the whole setting on a toggle, and opens on it next time', () => {
    mount();
    menuItem('options');
    soundButton()?.click();
    expect(sent()).toEqual([{ muted: true, volume: 0.7 }]);

    press('Escape');
    menuItem('options');
    expect(soundButton()?.textContent).toBe('Sound: Off');
  });

  it('sends the volume as the slider moves rather than when it is let go', () => {
    mount();
    menuItem('options');
    const slider = volume();
    if (!slider) throw new Error('no volume slider');
    slider.value = '40';
    slider.dispatchEvent(new Event('input'));
    expect(sent()).toEqual([{ muted: false, volume: 0.4 }]);
  });
});

/**
 * The spirit's tip card (decision 98): shown when the world offers one, waiting
 * for a tap, holding while something covers the playfield, and answering with
 * the tip heard or with tips off.
 */
describe("the spirit's tips", () => {
  const TIP = { tipId: 'raw-food', text: "Rat Meat won't mend you raw." } as const;
  const card = (): HTMLElement => {
    const found = parent.querySelector<HTMLElement>('.hud-tip');
    if (!found) throw new Error('no tip card');
    return found;
  };
  const showing = (): boolean => !card().classList.contains('hud-hidden');
  const answer = (action: string): void =>
    card().querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.click();
  const sent = (event: string) => emitted.filter((e) => e.event === event).map((e) => e.args);
  // Overlays are heard coming and going through a MutationObserver, whose
  // callbacks run a microtask after the tree changes.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('shows the tip the world offers, and hears it back on Got it', () => {
    mount();
    expect(showing()).toBe(false);
    events.emit(TIP_OFFERED_EVENT, TIP);
    expect(showing()).toBe(true);
    expect(card().textContent).toContain(TIP.text);

    answer('tip-heard');
    expect(sent(TIP_HEARD_EVENT)).toEqual([['raw-food']]);
    expect(showing()).toBe(false);
  });

  it('asks for tips off on No more tips, and goes', () => {
    mount();
    events.emit(TIP_OFFERED_EVENT, TIP);
    answer('tips-off');
    expect(sent(TIPS_SET_REQUESTED_EVENT)).toEqual([[false]]);
    expect(sent(TIP_HEARD_EVENT)).toEqual([]);
    expect(showing()).toBe(false);
  });

  it('waits out a sheet on a phone, and an overlay anywhere', async () => {
    mount();
    tab('inventory').click();
    events.emit(TIP_OFFERED_EVENT, TIP);
    expect(showing()).toBe(false);
    tab('inventory').click();
    expect(showing()).toBe(true);

    menuItem('options');
    await settle();
    expect(showing()).toBe(false);
    press('Escape');
    await settle();
    expect(showing()).toBe(true);
  });

  // A roomy screen's sheet stands in its own column under the top row, and
  // the character sheet is open there from the start.
  it('does not wait out a sheet on a roomy screen', () => {
    setViewport(DESKTOP.width, DESKTOP.height);
    mount();
    expect(openSheets()).toEqual(['character']);
    events.emit(TIP_OFFERED_EVENT, TIP);
    expect(showing()).toBe(true);
  });

  it('shows nothing while tips are off, from the save or from the world', () => {
    mount({ tips: { heard: [], off: true } });
    events.emit(TIP_OFFERED_EVENT, TIP);
    expect(showing()).toBe(false);

    events.emit(TIPS_STATE_CHANGED_EVENT, true);
    events.emit(TIP_OFFERED_EVENT, TIP);
    expect(showing()).toBe(true);
    events.emit(TIPS_STATE_CHANGED_EVENT, false);
    expect(showing()).toBe(false);
  });

  // Decision 117: what was found is said once, ahead of a tip still waiting to
  // be heard, and whether or not tips are on, since it is the reward.
  it('says a secret found ahead of a waiting tip, and then the tip', () => {
    mount();
    events.emit(TIP_OFFERED_EVENT, TIP);
    events.emit(SECRET_FOUND_EVENT, 'cellar-hatch');
    expect(card().dataset.find).toBe('cellar-hatch');
    expect(card().textContent).toContain('The Cellar Hatch');
    expect(card().textContent).toContain('Left there: 20c and Pickaxe.');
    expect(card().querySelector('[data-action="tips-off"]')?.classList.contains('hud-hidden')).toBe(
      true,
    );

    answer('tip-heard');
    expect(sent(TIP_HEARD_EVENT)).toEqual([]);
    expect(card().dataset.tip).toBe('raw-food');
    expect(card().textContent).toContain(TIP.text);
  });

  it('says a secret found with tips off', () => {
    mount({ tips: { heard: [], off: true } });
    events.emit(SECRET_FOUND_EVENT, 'lamp-stone');
    expect(showing()).toBe(true);
    answer('tip-heard');
    expect(showing()).toBe(false);
  });

  it('puts the switch in Options, on what the save says', () => {
    mount({ tips: { heard: [], off: true } });
    menuItem('options');
    const button = parent.querySelector<HTMLButtonElement>('[data-action="toggle-tips"]');
    expect(button?.textContent).toBe('Tips: Off');
    button?.click();
    expect(button?.textContent).toBe('Tips: On');
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(sent(TIPS_SET_REQUESTED_EVENT)).toEqual([[true]]);
  });
});

/**
 * The save in Options (decision 97): the HUD asks the session for it and does
 * what a page does with the answer, and loading one opens a panel that names
 * who is playing now.
 */
describe("the options menu's save", () => {
  const action = (name: string): HTMLButtonElement => {
    const found = parent.querySelector<HTMLButtonElement>(`[data-action="${name}"]`);
    if (!found) throw new Error(`no ${name}`);
    return found;
  };
  const sent = (event: string) => emitted.filter((e) => e.event === event).map((e) => e.args);
  // The session's half, which answers on the same call stack the ask came in on.
  const answerAsTheSession = (character: CharacterState): void => {
    events.on(SAVE_EXPORT_REQUESTED_EVENT, (kind) => {
      events.emit(SAVE_EXPORTED_EVENT, writeSaveExport(kind, character));
    });
  };

  beforeEach(() => {
    vi.mocked(downloadFile).mockClear();
    vi.mocked(copyText).mockClear();
  });

  it('asks the session for a file and hands its answer to the downloads', () => {
    const character = mount();
    answerAsTheSession(character);
    menuItem('options');
    action('download-save').click();

    expect(sent(SAVE_EXPORT_REQUESTED_EVENT)).toEqual([['file']]);
    const [fileName, text] = vi.mocked(downloadFile).mock.calls[0] ?? [];
    expect(fileName).toMatch(/^untitled-boomer-mmo-tester-level-1-.*\.json$/);
    expect(JSON.parse(text ?? '').character.name).toBe('Tester');
    expect(parent.textContent).toContain(`Sent to your downloads: ${fileName}`);
  });

  it('copies a code, and shows it too for when the clipboard says no', async () => {
    const character = mount();
    answerAsTheSession(character);
    menuItem('options');
    action('copy-save-code').click();

    const code = writeSaveExport('code', character).text;
    expect(vi.mocked(copyText)).toHaveBeenCalledWith(code);
    const box = parent.querySelector<HTMLTextAreaElement>('[data-action="save-code-output"]');
    expect(box?.hidden).toBe(false);
    expect(box?.value).toBe(code);
    await vi.waitFor(() => expect(parent.textContent).toContain('Copied.'));
  });

  it('says to copy by hand when the clipboard refuses', async () => {
    const character = mount();
    answerAsTheSession(character);
    vi.mocked(copyText).mockResolvedValueOnce(false);
    menuItem('options');
    action('copy-save-code').click();
    await vi.waitFor(() => expect(parent.textContent).toContain('Copy the code below'));
  });

  it('opens the load panel in place of the menu, naming who is playing now', () => {
    mount({ level: 4 });
    events.emit(ZONE_ENTERED_EVENT, 'beach');
    menuItem('options');
    action('open-load-save').click();

    expect(parent.querySelector('[data-action="reset-character"]')).toBeNull();
    expect(parent.textContent).toContain('It replaces Tester.');
    const box = parent.querySelector<HTMLTextAreaElement>('[data-action="save-code-input"]');
    if (!box) throw new Error('no code box');
    box.value = writeSaveExport('code', createNewCharacter('Aria', 'ranger')).text;
    box.dispatchEvent(new Event('input'));
    action('load-save-code').click();
    expect(parent.textContent).toContain('Warrior · Level 4 · Candle Strand');
  });

  it('asks the host to load the character once the second tap confirms it', () => {
    mount();
    menuItem('options');
    action('open-load-save').click();
    const box = parent.querySelector<HTMLTextAreaElement>('[data-action="save-code-input"]');
    if (!box) throw new Error('no code box');
    box.value = writeSaveExport('code', createNewCharacter('Aria', 'ranger')).text;
    box.dispatchEvent(new Event('input'));
    action('load-save-code').click();
    action('confirm-load-save').click();
    action('confirm-load-save').click();

    const [[loaded] = []] = sent(SAVE_IMPORT_REQUESTED_EVENT);
    expect(loaded).toMatchObject({ name: 'Aria', classId: 'ranger' });
    expect(modals()).toHaveLength(0);
  });

  it('closes on Escape like the menu it came from', () => {
    mount();
    menuItem('options');
    action('open-load-save').click();
    press('Escape');
    expect(modals()).toHaveLength(0);
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

  /**
   * Escape means two things: close what is open, and — to the world — drop the
   * target. Closing a panel mid-fight used to do both, since each heard the key
   * on its own. The world's binding is made first here on purpose, which is the
   * order that would hand it the key before the HUD had said it was taken.
   */
  it('lets an Escape that closed a panel leave the target alone', () => {
    unmountHud();
    const input = new InputState();
    const unbind = bindKeyboard(input, window);
    mount();
    const escape = (): void => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', cancelable: true }),
      );
    };

    menuItem('options');
    escape();
    expect(modals()).toHaveLength(0);
    expect(input.takeActions()).toEqual([]);

    escape();
    expect(input.takeActions()).toEqual(['clear-target']);
    unbind();
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
    expect(weightLine()).toBe(`Weight 0 / ${carryCapacity(strength)}`);

    const bag = { 'rat-bones': 3 };
    events.emit(INVENTORY_CHANGED_EVENT, bag);
    expect(weightLine()).toBe(
      `Weight ${Math.round(inventoryWeight(bag))} / ${carryCapacity(strength)}`,
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
    expect(weightLine()).toBe(`Weight 0 / ${carryCapacity(strength)}`);
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

describe('the quest log', () => {
  // A contract sits in the same log as the quests, and what sets it apart is
  // that it comes back — so it wears the board's mark and a quest does not.
  it('marks the contract in hand repeatable and no quest beside it', () => {
    mount({
      bounty: { bountyId: 'rat-cull', baseline: 0 },
      quests: { 'rat-bones': { status: 'active', baseline: 0 } },
    });
    tab('quests').click();

    const names = [...parent.querySelectorAll<HTMLElement>('.hud-quest__name')];
    const marked = names.filter((name) => name.querySelector('.hud-tag'));
    expect(names).toHaveLength(2);
    expect(marked).toHaveLength(1);
    expect(marked[0]?.textContent).toBe('Rat CullRepeatable');
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
    // The training bar is a button around its bar, so a bar is named by
    // whichever of the two carries the column's class.
    const bars = [...parent.querySelectorAll('.hud-player .hud-bar')].map(
      (bar) =>
        [...(bar.closest('[class*="hud-player__"]')?.classList ?? [])].find((name) =>
          name.startsWith('hud-player__'),
        ) ?? '',
    );
    expect(bars).toEqual([
      'hud-player__hp',
      'hud-player__mana',
      'hud-player__quiver',
      'hud-player__xp',
      'hud-player__training',
    ]);

    // A warrior is sent a pool of zero, and no bar at all is what that means.
    expect(column('.hud-player__mana')?.classList.contains('hud-hidden')).toBe(true);
    events.emit(PLAYER_MANA_CHANGED_EVENT, { mana: 12, maxMana: 30 });
    expect(column('.hud-player__mana')?.classList.contains('hud-hidden')).toBe(false);
    expect(column('.hud-player__mana .hud-bar__label')?.textContent).toBe('12 / 30 mana');
  });
});

describe('the quiver', () => {
  const column = (selector: string): HTMLElement | null =>
    parent.querySelector(`.hud-player ${selector}`);

  it('hangs a bar of arrows where a wizard’s mana goes, for a ranger', () => {
    mount(createNewCharacter('Robin', 'ranger'));
    expect(column('.hud-player__mana')?.classList.contains('hud-hidden')).toBe(true);
    expect(column('.hud-player__quiver')?.classList.contains('hud-hidden')).toBe(false);
    expect(column('.hud-player__quiver .hud-bar__label')?.textContent).toBe('50 / 50 arrows');
  });

  it('counts down with every shot, and says so when it runs dry', () => {
    mount(createNewCharacter('Robin', 'ranger'));
    events.emit(QUIVER_CHANGED_EVENT, { itemId: 'crude-arrows', count: 12 });
    expect(column('.hud-player__quiver .hud-bar__label')?.textContent).toBe('12 / 50 arrows');
    events.emit(QUIVER_CHANGED_EVENT, null);
    expect(column('.hud-player__quiver .hud-bar__label')?.textContent).toBe('Out of arrows');
  });

  it('draws no bar at all for anybody not wearing one', () => {
    mount();
    expect(column('.hud-player__quiver')?.classList.contains('hud-hidden')).toBe(true);
  });

  it('shows the sheet a shot’s attack, built on agility, and the arrows beside the quiver', () => {
    mount(createNewCharacter('Robin', 'ranger'));
    const text = parent.querySelector('[data-sheet="character"]')?.textContent ?? '';
    expect(text).toContain('Agility 6');
    expect(text).toContain('Attack 9 (Agility)');
    expect(text).toContain('Worn Quiver — 50 Crude Arrows');

    // Dry, the bow is a pair of fists, and the sheet says the punch.
    events.emit(QUIVER_CHANGED_EVENT, null);
    const dry = parent.querySelector('[data-sheet="character"]')?.textContent ?? '';
    expect(dry).toContain('Attack 6 (Agility)');
    expect(dry).toContain('Worn Quiver — empty');
  });
});

describe('the character sheet’s armour', () => {
  const sheet = (): string => parent.querySelector('[data-sheet="character"]')?.textContent ?? '';

  // Every piece's largest number went into a total no panel showed; the sheet
  // shows it with what it buys, off the curve a hit is actually cut by.
  it('adds up what is worn and says the share of a hit it stops', () => {
    const gear: Gear = { ...createNewCharacter('Tester', 'warrior').gear, helmet: 'brown-helmet' };
    mount({ gear });
    const { armor } = computeEffectiveStats('warrior', gear, 1);
    const share = Math.round(damageReduction(armor) * 100);

    expect(armor).toBeGreaterThan(0);
    expect(sheet()).toContain(`Armour ${armor} (stops ${share}% of a hit)`);
    // The helmet's row says the same stats in the same words, not ARM and HP.
    expect(sheet()).toContain('+2 Armour, +1 Health, Leather');
  });

  it('says a bare total rather than a share of nothing', () => {
    mount({ gear: NO_GEAR });
    expect(sheet()).toContain('Armour 0');
    expect(sheet()).not.toContain('stops');
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

describe('the training bar', () => {
  const bar = (): HTMLButtonElement | null => parent.querySelector('.hud-player__training');
  const shown = (): boolean => bar()?.classList.contains('hud-hidden') === false;
  const fading = (): boolean => bar()?.classList.contains('is-fading') === true;
  const read = (part: 'name' | 'progress'): string =>
    bar()?.querySelector(`.hud-training__${part}`)?.textContent ?? '';
  const gain = (skillId: SkillId, level = 3, xp = 40, xpToNext = 96): void => {
    events.emit(SKILL_XP_GAINED_EVENT, { skillId, level, xp, xpToNext, leveledUp: false });
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is not there until a skill trains', () => {
    mount();
    expect(shown()).toBe(false);
  });

  it('draws the skill just trained, its level and its XP inside the bar', () => {
    mount();
    gain('mining', 3, 40, 96);
    expect(shown()).toBe(true);
    expect(read('name')).toBe('Mining');
    expect(read('progress')).toBe('Lv 3 · 40 / 96 XP');
    expect(bar()?.querySelector<HTMLElement>('.hud-bar__fill')?.style.width).toBe(
      fillPercent(barFill(40, 96)),
    );
  });

  it('follows the weapon through a fight, and not what turns a hit aside', () => {
    mount();
    gain('parry');
    expect(shown()).toBe(false);

    gain('one-handed', 4, 12, 50);
    gain('block');
    gain('parry');
    expect(read('name')).toBe('1 Handed');
  });

  it('hands itself to whichever skill trains next', () => {
    mount();
    gain('mining');
    gain('woodcutting', 2, 10, 96);
    expect(read('name')).toBe('Woodcutting');
    expect(read('progress')).toBe('Lv 2 · 10 / 96 XP');
  });

  it('fades half a minute after the last XP into it, and a gain before then keeps it', () => {
    mount();
    gain('mining');
    vi.advanceTimersByTime(TRAINING_FADE_AFTER_MS - 1000);
    gain('mining');
    vi.advanceTimersByTime(TRAINING_FADE_AFTER_MS - 1000);
    expect(shown() && !fading()).toBe(true);

    // A save is not the skill being trained, so it keeps nothing up.
    gain('block');
    vi.advanceTimersByTime(1000);
    expect(shown() && fading()).toBe(true);
    vi.advanceTimersByTime(TRAINING_FADE_MS);
    expect(shown()).toBe(false);
  });

  it('comes back whole on a gain while it is fading', () => {
    mount();
    gain('fishing');
    vi.advanceTimersByTime(TRAINING_FADE_AFTER_MS);
    expect(fading()).toBe(true);
    gain('fishing');
    expect(shown() && !fading()).toBe(true);
    // Past where the first fade would have taken it down.
    vi.advanceTimersByTime(TRAINING_FADE_MS);
    expect(shown() && !fading()).toBe(true);
  });

  // A roomy screen opens its sheet below the column, so the column's height is
  // where the sheet starts: up a bar while the bar is up, and back after.
  it('costs the column a bar while it is up, and gives it back when it goes', () => {
    setViewport(DESKTOP.width, DESKTOP.height);
    // Without the minimap, which is taller than the column even with the bar,
    // so the sheet under the top row is measuring the column.
    mount({ showMinimap: false });
    const sheetTop = (): number =>
      parseFloat(parent.querySelector<HTMLElement>('[data-sheet="character"]')?.style.top ?? '');
    const before = sheetTop();

    gain('mining');
    const during = sheetTop();
    expect(during).toBeGreaterThan(before);

    vi.advanceTimersByTime(TRAINING_FADE_AFTER_MS + TRAINING_FADE_MS);
    expect(sheetTop()).toBe(before);
  });

  // A combat skill's ceiling is ten a character level, so one at the top of it
  // reads as capped until a level lands with nothing trained in between.
  it('lets a capped combat skill go on the moment a level raises its ceiling', () => {
    mount();
    gain('one-handed', 10, 0, 0);
    expect(read('progress')).toBe('Lv 10 (max)');

    events.emit(LEVEL_UP_EVENT, 2);
    expect(read('progress')).toBe(`Lv 10 · 0 / ${skillXpToNextLevel('one-handed', 10, 2)} XP`);
    expect(skillXpToNextLevel('one-handed', 10, 2)).toBeGreaterThan(0);
  });

  it('opens the skills book at its skill’s page on a tap', () => {
    mount();
    gain('fishing');
    bar()?.click();
    expect(openSheets()).toEqual(['skills']);
    expect(parent.querySelector<HTMLElement>('.hud-sheet[data-sheet="skills"]')?.dataset.page).toBe(
      'fishing',
    );
  });

  it('stops its clock when the HUD is taken down', () => {
    mount();
    gain('mining');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmountHud();
    expect(vi.getTimerCount()).toBe(0);
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
    events.emit(COUNTER_OPENED_EVENT, 'merchant', 'shopkeeper');
    expect(shop()).not.toBeNull();
    events.emit(COUNTER_CLOSED_EVENT, 'merchant');
    expect(shop()).toBeNull();
  });

  it('refreshes while open from the bag and the purse it does not own', () => {
    mount();
    events.emit(COUNTER_OPENED_EVENT, 'merchant', 'shopkeeper');
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
    events.emit(COUNTER_OPENED_EVENT, 'merchant', 'shopkeeper');

    const row = shop()?.querySelector<HTMLElement>(`.hud-list-row[data-item="${gated.itemId}"]`);
    expect(row?.dataset.locked).toBe(gated.itemId);
    expect(row?.querySelector('.hud-list-row__value')?.textContent).toBe(
      `Needs Level ${gateLevel}`,
    );
  });

  /**
   * A quest handed in at this counter pays XP, so a level can land with the
   * panel open and the player looking at the row it stocks. The shelf is drawn
   * from the HUD's own model, which is what makes that a redraw rather than
   * anything the world has to re-send.
   */
  it('puts the row on the shelf the moment the level lands', () => {
    mount();
    events.emit(COUNTER_OPENED_EVENT, 'merchant', 'shopkeeper');
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
    events.emit(COUNTER_OPENED_EVENT, 'merchant', 'shopkeeper');
    events.emit(INVENTORY_CHANGED_EVENT, { 'rat-bones': 12, 'brown-helmet': 1 });

    expect(shop()?.querySelector('[data-sell-all="brown-helmet"]')).toBeNull();
    shop()?.querySelector<HTMLButtonElement>('[data-sell-all="rat-bones"]')?.click();
    expect(emitted.at(-1)).toEqual({ event: SELL_ITEM_REQUESTED_EVENT, args: ['rat-bones', 12] });

    shop()?.querySelector<HTMLButtonElement>('.hud-list-row[data-item="rat-bones"]')?.click();
    expect(emitted.at(-1)).toEqual({ event: SELL_ITEM_REQUESTED_EVENT, args: ['rat-bones', 1] });
  });

  /**
   * Which way a tap trades is said by which side the row is on. The keeper's
   * quests go on the keeper's side, above the stock, since the host puts them
   * at the top of the panel's body and that side is the body.
   */
  it("draws the stock on the keeper's side and the bag on yours, and no quests", () => {
    mount();
    events.emit(COUNTER_OPENED_EVENT, 'merchant', 'shopkeeper');
    events.emit(INVENTORY_CHANGED_EVENT, { 'rat-bones': 2 });

    const theirs = shop()?.querySelector<HTMLElement>('.hud-side[data-side="theirs"]');
    const yours = shop()?.querySelector<HTMLElement>('.hud-side[data-side="yours"]');
    expect(theirs?.querySelector(`[data-item="${nth(SHOP_STOCK).itemId}"]`)).not.toBeNull();
    expect(theirs?.querySelector('[data-item="rat-bones"]')).toBeNull();
    expect(yours?.querySelector('[data-item="rat-bones"]')).not.toBeNull();
    expect(yours?.querySelectorAll('[data-item]')).toHaveLength(1);

    // The shopkeeper's work is offered in the conversation, not over the stock.
    expect(shop()?.querySelector('.hud-talk__quests')).toBeNull();
    expect(yours?.querySelector('.hud-section__hint')?.textContent).toBe('tap to sell');
  });

  // A bag row's price is per item, and says so once there is more than one.
  it('prices a stack in the bag each, and a single one plainly', () => {
    mount();
    events.emit(COUNTER_OPENED_EVENT, 'merchant', 'shopkeeper');
    events.emit(INVENTORY_CHANGED_EVENT, { 'rat-bones': 12, 'brown-helmet': 1 });

    const value = (itemId: string): string | null | undefined =>
      shop()?.querySelector(`[data-item="${itemId}"] .hud-list-row__value`)?.textContent;
    expect(value('rat-bones')).toMatch(/ each$/);
    expect(value('brown-helmet')).not.toMatch(/each/);
  });

  /**
   * Across on a landscape phone, where height is short and one list over the
   * other would leave each a couple of rows; one over the other on a portrait
   * one. A relayout reaches a counter already open, so turning the phone with
   * the shop up moves it.
   */
  it('stands its sides across a landscape phone and one over the other on a portrait one', () => {
    const sides = (): Element | null | undefined => shop()?.querySelector('.hud-sides');
    setViewport(844, 390);
    mount();
    events.emit(COUNTER_OPENED_EVENT, 'merchant', 'shopkeeper');
    expect(sides()?.classList.contains('is-side-by-side')).toBe(true);

    setViewport(PHONE.width, PHONE.height);
    // Anything that re-runs the layout will do; a resize observer is what does
    // it in a browser, and jsdom has none.
    events.emit(QUEST_LOG_CHANGED_EVENT, {});
    expect(sides()?.classList.contains('is-side-by-side')).toBe(false);
  });
});

describe('the bank', () => {
  const bank = (): HTMLElement | null => parent.querySelector('.hud-modal__box--bank');

  it('opens and closes with the world, like the other counter', () => {
    mount();
    expect(bank()).toBeNull();
    events.emit(COUNTER_OPENED_EVENT, 'banker', 'banker');
    expect(bank()).not.toBeNull();
    events.emit(COUNTER_CLOSED_EVENT, 'banker');
    expect(bank()).toBeNull();
  });

  it('draws the shelves the world sent and the pack it already holds', () => {
    mount();
    events.emit(COUNTER_OPENED_EVENT, 'banker', 'banker');
    events.emit(BANK_CHANGED_EVENT, { contents: { logs: 30 }, slots: 8 });
    events.emit(INVENTORY_CHANGED_EVENT, { 'rat-bones': 2 });

    expect(bank()?.textContent).toContain('Logs');
    expect(bank()?.textContent).toContain('Rat Bones');
    expect(bank()?.textContent).toContain('1 / 8 slots');
  });

  // The shop's two sides, for the reason the two panels have always been read
  // the same way: the vault and the price of more of it on the banker's, the
  // bag on yours.
  it("keeps the vault on the banker's side and the bag on yours", () => {
    mount();
    events.emit(COUNTER_OPENED_EVENT, 'banker', 'banker');
    events.emit(BANK_CHANGED_EVENT, { contents: { logs: 30 }, slots: 8 });
    events.emit(INVENTORY_CHANGED_EVENT, { 'rat-bones': 2 });

    const theirs = bank()?.querySelector('.hud-side[data-side="theirs"]');
    const yours = bank()?.querySelector('.hud-side[data-side="yours"]');
    expect(theirs?.querySelector('[data-bank="withdraw"][data-item="logs"]')).not.toBeNull();
    expect(theirs?.querySelector('[data-action="buy-bank-slot"]')).not.toBeNull();
    expect(yours?.querySelector('[data-bank="deposit"][data-item="rat-bones"]')).not.toBeNull();
    expect(yours?.querySelector('[data-bank="withdraw"]')).toBeNull();
  });

  /**
   * Both directions are one gesture: a row moves one across the counter and the
   * smaller button beside it moves the rest, whichever way it is being crossed.
   */
  it('sends a row as one and the button beside it as the stack, both ways', () => {
    mount();
    events.emit(COUNTER_OPENED_EVENT, 'banker', 'banker');
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
    events.emit(COUNTER_OPENED_EVENT, 'banker', 'banker');
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

/** Whoever stands behind a role's counter, which the world names beside the role. */
function personAt(role: NpcRoleId): NpcId {
  return nth(Object.values(NPCS).filter((npc) => npc.role === role)).id;
}

describe('every counter is one panel, keyed by who stands behind it', () => {
  const ROLES: NpcRoleId[] = [
    'merchant',
    'banker',
    'trainer',
    'quartermaster',
    'outfitter',
    'reforger',
  ];
  const COUNTERS: CounterId[] = ['talk', ...ROLES];
  const panels = (): Element[] => [...parent.querySelectorAll('.hud-modal--top')];
  const questRows = (): string[] =>
    [...parent.querySelectorAll<HTMLElement>('.hud-modal--top [data-quest]')].map(
      (row) => row.dataset.quest ?? '',
    );
  // Talking is everybody's, so any person will do for it.
  const someoneAt = (counter: CounterId): NpcId =>
    counter === 'talk' ? 'shopkeeper' : personAt(counter);

  it.each(COUNTERS)('puts up the %s counter and takes it down with the world', (counter) => {
    mount();
    events.emit(COUNTER_OPENED_EVENT, counter, someoneAt(counter));
    expect(panels()).toHaveLength(1);
    events.emit(COUNTER_CLOSED_EVENT, counter);
    expect(panels()).toHaveLength(0);
  });

  it('holds one counter up at a time, the conversation among them', () => {
    mount();
    events.emit(COUNTER_OPENED_EVENT, 'talk', 'shopkeeper');
    events.emit(COUNTER_OPENED_EVENT, 'merchant', 'shopkeeper');
    events.emit(COUNTER_OPENED_EVENT, 'banker', 'banker');
    expect(panels()).toHaveLength(1);
    expect(parent.querySelector('.hud-modal__box--bank')).not.toBeNull();
    // A close meant for the counter that is no longer up takes nothing down.
    events.emit(COUNTER_CLOSED_EVENT, 'merchant');
    events.emit(COUNTER_CLOSED_EVENT, 'talk');
    expect(panels()).toHaveLength(1);
  });

  it.each(COUNTERS)('asks the world to shut the %s counter from its X', (counter) => {
    mount();
    events.emit(COUNTER_OPENED_EVENT, counter, someoneAt(counter));
    parent.querySelector<HTMLButtonElement>('.hud-modal--top .hud-modal__close')?.click();
    expect(emitted.at(-1)).toEqual({ event: COUNTER_CLOSED_EVENT, args: [counter] });
  });

  /**
   * The way back to the conversation is put on every role's counter by the
   * host rather than by each panel, so this asks it of all of them at once.
   */
  it.each(ROLES)('asks the world to talk again from the %s counter', (role) => {
    mount();
    events.emit(COUNTER_OPENED_EVENT, role, personAt(role));
    const head = parent.querySelector('.hud-modal--top .hud-modal__head');
    const back = head?.querySelector<HTMLButtonElement>('[data-action="back-to-talk"]');
    expect(head?.firstElementChild).toBe(back);
    back?.click();
    expect(emitted.at(-1)).toEqual({ event: COUNTER_REQUESTED_EVENT, args: ['talk'] });
  });

  it('puts no way back on the conversation itself', () => {
    mount();
    events.emit(COUNTER_OPENED_EVENT, 'talk', 'banker');
    expect(parent.querySelector('[data-action="back-to-talk"]')).toBeNull();
  });

  /**
   * The rule the HUD's listeners used to spell out panel by panel: whatever is
   * up is drawn from the model, so the model moving redraws it. Asked of every
   * role at once, because a list of refreshes is exactly what a new panel gets
   * left out of.
   */
  it.each(ROLES)('redraws the %s counter when the pack, the purse and the level move', (role) => {
    mount({ gear: { ...createNewCharacter('Tester', 'warrior').gear, helmet: 'brown-helmet' } });
    events.emit(COUNTER_OPENED_EVENT, role, personAt(role));
    const before = panels()[0]?.innerHTML;

    events.emit(INVENTORY_CHANGED_EVENT, {
      'tin-ore': 9,
      'iron-ore': 9,
      coal: 9,
      hardwood: 9,
      'rat-bones': 9,
      'brown-helmet': 1,
      'reforging-stone': 1,
    });
    events.emit(CURRENCY_CHANGED_EVENT, 999999);
    events.emit(LEVEL_UP_EVENT, 8);

    expect(panels()[0]?.innerHTML).not.toBe(before);
  });

  // The conversation's moving part is the work: taking a quest turns its row
  // from an offer into a count, and the pack filling moves the count.
  it('redraws the conversation when the quest log and the pack move', () => {
    mount();
    events.emit(COUNTER_OPENED_EVENT, 'talk', 'shopkeeper');
    const row = (): string | undefined =>
      parent.querySelector('[data-quest="rat-bones"] .hud-list-row__value')?.textContent ?? '';
    expect(row()).toBe('Accept');

    events.emit(QUEST_LOG_CHANGED_EVENT, { 'rat-bones': { status: 'active', baseline: 0 } });
    expect(row()).toBe('0 / 10');
    events.emit(INVENTORY_CHANGED_EVENT, { 'rat-bones': 4 });
    expect(row()).toBe('4 / 10');
  });

  /**
   * A conversation is who somebody is before it is what they sell: their own
   * line, in their own quotation marks, and a button for the counter they work
   * that says what it is for. Asked of everybody, since a person added without
   * a greeting or a counter is what this is here to catch.
   */
  it.each(Object.values(NPCS))('greets as $name and offers their counter', (npc) => {
    mount();
    events.emit(COUNTER_OPENED_EVENT, 'talk', npc.id);

    const box = parent.querySelector('.hud-modal__box--talk');
    expect(box?.querySelector('.hud-modal__title')?.textContent).toBe(npc.name);
    expect(box?.querySelector('.hud-talk__greeting')?.textContent).toBe(
      `\u201c${npc.greeting}\u201d`,
    );

    const services = [...(box?.querySelectorAll<HTMLButtonElement>('.hud-talk__service') ?? [])];
    expect(services.map((button) => button.dataset.counter)).toEqual([npc.role]);
    expect(nth(services).textContent).toContain(ROLE_SERVICES[npc.role].label);
    expect(nth(services).textContent).toContain(ROLE_SERVICES[npc.role].blurb);

    nth(services).click();
    expect(emitted.at(-1)).toEqual({ event: COUNTER_REQUESTED_EVENT, args: [npc.role] });
  });

  /**
   * A quest is a conversation with the person who gives it, so it goes in the
   * conversation with them and on none of their counters — asked of everybody,
   * since the one that forgets is what this rule is here to rule out.
   */
  it.each(Object.values(NPCS))(
    'draws the work $name has going when talked to, and only then',
    (npc) => {
      mount();
      events.emit(COUNTER_OPENED_EVENT, 'talk', npc.id);
      const theirs = QUEST_ORDER.filter((questId) => QUESTS[questId].giverNpcId === npc.id);
      expect(questRows()).toEqual(theirs);

      events.emit(COUNTER_OPENED_EVENT, npc.role, npc.id);
      expect(questRows()).toEqual([]);
    },
  );

  it('asks the world to take and hand in a quest from the conversation', () => {
    mount();
    events.emit(COUNTER_OPENED_EVENT, 'talk', 'shopkeeper');

    parent.querySelector<HTMLButtonElement>('[data-quest="rat-bones"]')?.click();
    expect(emitted.at(-1)).toEqual({ event: ACCEPT_QUEST_REQUESTED_EVENT, args: ['rat-bones'] });

    events.emit(QUEST_LOG_CHANGED_EVENT, { 'rat-bones': { status: 'active', baseline: 0 } });
    events.emit(INVENTORY_CHANGED_EVENT, { 'rat-bones': 10 });
    parent.querySelector<HTMLButtonElement>('[data-quest="rat-bones"]')?.click();
    expect(emitted.at(-1)).toEqual({
      event: TURN_IN_QUEST_REQUESTED_EVENT,
      args: ['rat-bones'],
    });
  });

  // Handed in is finished business: a conversation that listed it would be a
  // row with nothing left to say.
  it('leaves a quest handed in out of the conversation', () => {
    mount({ quests: { 'rat-bones': { status: 'done', baseline: 0 } } });
    events.emit(COUNTER_OPENED_EVENT, 'talk', 'shopkeeper');
    expect(questRows()).not.toContain('rat-bones');
  });
});

/**
 * The skills book is reached two ways: from the menu, where it opens on its
 * index, and from a skill's row on the character sheet, where it opens at that
 * skill's page. Either way it is the one sheet open.
 */
describe('the skills book', () => {
  const page = (): string | undefined =>
    parent.querySelector<HTMLElement>('.hud-sheet[data-sheet="skills"]')?.dataset.page;
  const bookText = (): string =>
    parent.querySelector('.hud-sheet[data-sheet="skills"] .hud-sheet__body')?.textContent ?? '';

  it('opens on its index from the menu, where Mastery used to be', () => {
    mount();
    menuItem('skills');
    expect(openSheets()).toEqual(['skills']);
    expect(page()).toBe('');
    expect(parent.querySelector('[data-menu-tab="mastery"]')).toBeNull();
  });

  it('opens at a skill’s page from that skill’s row on the character sheet', () => {
    mount();
    tab('character').click();
    parent
      .querySelector<HTMLButtonElement>('.hud-sheet[data-sheet="character"] [data-skill="mining"]')
      ?.click();
    expect(openSheets()).toEqual(['skills']);
    expect(page()).toBe('mining');
    expect(bookText()).toContain('Tin Vein');
  });

  it('goes back to the index when reached from the menu after a page', () => {
    mount();
    tab('character').click();
    parent.querySelector<HTMLButtonElement>('[data-skill="mining"]')?.click();
    menuItem('skills');
    expect(openSheets()).toEqual([]);
    menuItem('skills');
    expect(page()).toBe('');
  });

  it('answers its key', () => {
    mount();
    press('k');
    expect(openSheets()).toEqual(['skills']);
  });

  it('redraws an open page off the skill and mastery events', () => {
    mount();
    tab('character').click();
    parent.querySelector<HTMLButtonElement>('[data-skill="woodcutting"]')?.click();
    events.emit(SKILL_XP_GAINED_EVENT, {
      skillId: 'woodcutting',
      level: 4,
      xp: 12,
      xpToNext: 200,
      leveledUp: true,
    });
    expect(bookText()).toContain('At level 4:');
    events.emit(MASTERY_CHANGED_EVENT, { tree: 600 });
    expect(bookText()).toContain('Apprentice');
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
    events.emit(ACTIONS_CHANGED_EVENT, { nearFire: true, nearStations: [] });
    pressAction('raw-fish', 'cook');
    expect(emitted.at(-1)).toEqual({ event: COOK_REQUESTED_EVENT, args: ['raw-fish'] });

    events.emit(COUNTER_OPENED_EVENT, 'merchant', 'shopkeeper');
    pressAction('cooked-fish', 'sell');
    expect(emitted.at(-1)).toEqual({ event: SELL_ITEM_REQUESTED_EVENT, args: ['cooked-fish', 1] });
  });

  // The bulk half of the same request: one event with a count on it, so the
  // counter has one rule about vendoring rather than two.
  it('asks to sell the whole stack, and offers that only on a stack', () => {
    events.emit(COUNTER_OPENED_EVENT, 'merchant', 'shopkeeper');

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
 * What the strip under the bag says about the item tapped, beyond what can be
 * done with it here. Rat meat away from a fire used to say "(nothing to do with
 * this)", which read as junk; `ItemUseSystem.test.ts` holds the lines, and this
 * holds that the strip prints them and keeps them true.
 */
describe('the bag says what an item is for', () => {
  const strip = (): string[] =>
    [...parent.querySelectorAll<HTMLElement>('.hud-item-detail .hud-item-uses__line')].map(
      (line) => line.textContent ?? '',
    );
  const select = (itemId: string): void => {
    parent.querySelector<HTMLButtonElement>(`.hud-item[data-item="${itemId}"]`)?.click();
  };

  beforeEach(() => {
    mount({ inventory: { 'rat-meat': 3, 'rat-bones': 4 } });
    tab('inventory').click();
  });

  it('answers rat meat away from any fire with what it cooks into', () => {
    select('rat-meat');

    expect(strip()).toEqual(['Cook at a campfire → Cooked Rat', 'Sells for 3c']);
    expect(parent.querySelector('.hud-item-detail')?.textContent).not.toContain('nothing to do');
  });

  it('drops a quest from the strip the moment it is handed in', () => {
    select('rat-bones');
    expect(strip()).toContain('Quest: Bones for the Broth wants 10');

    events.emit(QUEST_LOG_CHANGED_EVENT, { 'rat-bones': { status: 'done', baseline: 0 } });

    expect(strip()).not.toContain('Quest: Bones for the Broth wants 10');
    expect(strip()).toContain('Used in: Bone Char, at the Forge (Lampton)');
  });
});

/**
 * The same card, asked for from any row that stands for an item rather than
 * from the bag alone: what a stone on the shelf is for is worth knowing before
 * it is bought. A right click here is the held finger; `longPress.test.ts` holds
 * that the two are one question and that the row's own tap is not also taken.
 */
describe('every row that stands for an item opens its card', () => {
  const card = (): HTMLElement | null => parent.querySelector('.hud-modal__box--inspect');
  const title = (): string | null | undefined =>
    card()?.querySelector('.hud-modal__title')?.textContent;
  const uses = (): (string | null)[] =>
    [...(card()?.querySelectorAll('.hud-item-uses__line') ?? [])].map((line) => line.textContent);
  const ask = (selector: string): void => {
    const row = parent.querySelector<HTMLElement>(selector);
    if (!row) throw new Error(`no ${selector}`);
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 40, clientY: 60 }));
  };

  it('answers a shelf row, locked or not, and buys nothing', () => {
    mount();
    events.emit(COUNTER_OPENED_EVENT, 'merchant', 'shopkeeper');
    ask('.hud-list-row[data-item="reforging-stone"]');

    expect(title()).toBe('Reforging Stone');
    expect(uses()).toContain('Used in: reforging gear, at the Fettler (Greyford Outpost)');
    expect(emitted.some((e) => e.event === BUY_ITEM_REQUESTED_EVENT)).toBe(false);
  });

  it('answers a row of the bank with the thing on the shelf', () => {
    mount();
    events.emit(COUNTER_OPENED_EVENT, 'banker', 'banker');
    events.emit(BANK_CHANGED_EVENT, { contents: { 'crab-meat': 4 }, slots: 8 });
    ask('.hud-list-row[data-bank="withdraw"][data-item="crab-meat"]');

    expect(uses()).toContain('Cook at a campfire → Cooked Crab');
  });

  it('answers a station row with what it makes', () => {
    mount();
    events.emit(ACTIONS_CHANGED_EVENT, { nearFire: false, nearStations: ['forge'] });
    events.emit(STATION_OPENED_EVENT, 'forge');
    ask('.hud-list-row[data-recipe="iron-helmet"]');

    expect(title()).toBe('Iron Helmet');
    expect(uses()).toContain('Made from: Iron Bar ×2, Tin Bar, Bone Char, at the Forge (Lampton)');
  });

  it('answers a row of the skills book with what it makes', () => {
    mount();
    tab('character').click();
    parent.querySelector<HTMLButtonElement>('[data-skill="smithing"]')?.click();
    ask('.hud-book-entry[data-entry="steel-chestplate"]');

    expect(title()).toBe('Steel Chestplate');
  });

  it('answers a worn slot with what is in it, and an empty one not at all', () => {
    mount();
    tab('character').click();
    ask('.hud-slot[data-slot="weapon"]');
    expect(title()).toBe('Rusty Sword');

    press('Escape');
    ask('.hud-slot[data-slot="helmet"]');
    expect(card()).toBeNull();
    expect(emitted.some((e) => e.event === UNEQUIP_SLOT_REQUESTED_EVENT)).toBe(false);
  });

  // From one card to another: the drop list is where "what is this for?" is
  // asked about something before it has ever been carried.
  it("goes from a creature's drops to the card of one of them", () => {
    mount();
    events.emit(CONTEXT_MENU_REQUESTED_EVENT, {
      title: 'Rat (Lv 1)',
      actions: [],
      details: describeEnemy(ENEMIES.rat, 1),
      loot: describeEnemyLoot(ENEMIES.rat),
      at: { x: 120, y: 200 },
    });
    parent
      .querySelector<HTMLButtonElement>('.hud-context__row[data-context-action="Loot"]')
      ?.click();
    ask('.hud-inspect__drop[data-item="rat-meat"]');

    expect(parent.querySelectorAll('.hud-modal__box--inspect')).toHaveLength(1);
    expect(title()).toBe('Rat Meat');
    expect(uses()).toContain('Cook at a campfire → Cooked Rat');
  });
});

/**
 * The right click, and the finger held on a phone. Two menus meet here and are
 * deliberately one component: what the world found under the pointer arrives on
 * the wire, and what a bag cell offers the HUD works out itself.
 */
describe('the context menu', () => {
  const RAT: ContextMenuRequest = {
    title: 'Rat (Lv 2)',
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
      expect(parent.querySelector<HTMLElement>('.hud-context__title')?.textContent).toBe(
        'Rat (Lv 2)',
      );
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

    // A pile has no drop table, only what is in it: its Inspect is the list,
    // with a count where a creature's has a chance.
    it('lists what is in a loot pile, with how many of each', () => {
      events.emit(CONTEXT_MENU_REQUESTED_EVENT, {
        title: 'Loot Pile',
        actions: [{ id: 'take', label: 'Take' }],
        details: describePile([
          { itemId: 'rat-bones', quantity: 1 },
          { itemId: 'rat-meat', quantity: 2 },
        ]),
        at: { x: 120, y: 200 },
      });
      expect(lines()).toEqual(['Take', 'Inspect']);

      line('Inspect').click();

      const held = [...parent.querySelectorAll<HTMLElement>('.hud-inspect__held')];
      expect(held.map((row) => row.dataset.item)).toEqual(['rat-bones', 'rat-meat']);
      expect(held[1]?.textContent).toContain('×2');
    });

    it('replaces itself rather than stacking a second menu', () => {
      events.emit(CONTEXT_MENU_REQUESTED_EVENT, { ...RAT, title: 'Rat (Lv 1)' });
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
      const uses = [...(card()?.querySelectorAll('.hud-item-uses__line') ?? [])].map(
        (use) => use.textContent,
      );
      expect(uses).toContain('Worn by: Warrior, Ranger');
      expect(uses).toContain('Sells for 25c');
    });
  });
});

describe('the away report', () => {
  const parked: PendingNotification = { kind: 'offline-afk', report: REPORT };

  it('shows what idle earned on the boot that resolved it, naming what it fought', () => {
    mount({}, [parked]);
    const modal = modals()[0];
    expect(modal?.textContent).toContain('12 Rat kills, 60 XP');
    expect(modal?.textContent).not.toContain('the most');
  });

  // In the idle panel's words: the panel said "at most half a level" and "up
  // to 8 hours", and the report says when a night reached either.
  it('says when a night reached its ceiling and its hours', () => {
    mount({}, [
      {
        kind: 'offline-afk',
        report: { ...REPORT, elapsedMs: OFFLINE_CAP_MS, capped: true },
      },
    ]);
    const text = modals()[0]?.textContent ?? '';
    expect(text).toContain('Away for 8h 0m, the most that counts');
    expect(text).toContain('Stopped at the most a night pays: half a level');
  });

  it('names the skill level a night of work stopped at', () => {
    mount({}, [
      {
        kind: 'offline-afk',
        report: { ...REPORT, kills: 0, skill: 'fishing', gathers: 20, skillXp: 90, capped: true },
      },
    ]);
    expect(modals()[0]?.textContent).toContain(
      'Stopped at the most a night pays: one Fishing level',
    );
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
    events.emit(COUNTER_OPENED_EVENT, 'merchant', 'shopkeeper');
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
    new OptionsModal({
      sound: DEFAULT_SOUND,
      onSoundChanged: noop,
      tipsOn: true,
      onTipsChanged: noop,
      minimapOn: true,
      onMinimapChanged: noop,
      onExport: noop,
      onOpenLoad: noop,
      onResetCharacter: noop,
      onClose: onClosed,
    }),
    new LoadSaveModal({ current: null, onLoad: noop, onClose: onClosed }),
    new SlotPicker('helmet', [], new DOMRect(), PHONE, noop, onClosed),
    new AwayReportModal(REPORT, onClosed),
    new ShopModal({ onBuy: noop, onSell: noop, onDismiss: noop }, onClosed),
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
    ).toBe('Lampton');
  });

  // Decision 117: where a secret lies is on no map; how many the zone hides,
  // and how many are found, is the one line under it.
  it("counts the zone's secrets found under it, and says nothing where there are none", () => {
    mount();
    menuItem('map');
    events.emit(ZONE_ENTERED_EVENT, 'town');
    const line = (): HTMLElement | null => parent.querySelector('.hud-map__secrets');
    expect(line()?.textContent).toBe('Secrets 0 / 2');

    events.emit(SECRETS_CHANGED_EVENT, ['lamp-stone']);
    expect(line()?.textContent).toBe('Secrets 1 / 2');
    expect(parent.querySelectorAll('.hud-map__svg [data-secret]')).toHaveLength(0);

    events.emit(ZONE_ENTERED_EVENT, 'deep-cut');
    expect(line()?.classList.contains('hud-hidden')).toBe(true);
  });

  /**
   * The keepers of the counters stand inside the buildings they work from, so a
   * name drawn under the markers had a dot through it. Every name comes after
   * every marker, and nothing but the player's own dot comes after the names.
   */
  it('draws every building name over the markers', () => {
    mount();
    events.emit(ZONE_ENTERED_EVENT, 'town');
    const drawn = [...(svg()?.children ?? [])];
    const lastMarker = drawn.reduce(
      (last, node, index) => (node.hasAttribute('data-marker') ? index : last),
      -1,
    );
    const names = drawn.flatMap((node, index) =>
      node.hasAttribute('data-building-name') ? [index] : [],
    );
    expect(names.length).toBeGreaterThan(0);
    expect(Math.min(...names)).toBeGreaterThan(lastMarker);
    expect(drawn.at(-1)).toBe(dot());
  });

  /**
   * Each name was once set to its footprint's width, so "Bank" came out three
   * times the size of "Quartermaster's Post" on the same map (decision 112).
   */
  it('sets every building name at one size, breaking a long one rather than stretching it', () => {
    mount();
    events.emit(ZONE_ENTERED_EVENT, 'town');
    const lines = [...parent.querySelectorAll('[data-building-name]')];
    expect(new Set(lines.map((line) => line.getAttribute('font-size'))).size).toBe(1);
    const linesOf = (name: string): string[] =>
      lines
        .filter((line) => line.getAttribute('data-building-name') === name)
        .map((line) => line.textContent ?? '');
    expect(linesOf('Bank')).toEqual(['Bank']);
    expect(linesOf("Quartermaster's Post")).toEqual(["Quartermaster's", 'Post']);
    const bank = lines.find((line) => line.textContent === 'Bank');
    expect(bank?.hasAttribute('textLength')).toBe(false);
  });

  it("keeps an exit's name on the map at the bottom edge, over its marker", () => {
    mount();
    events.emit(ZONE_ENTERED_EVENT, 'beach');
    const map = zoneMap('beach');
    const exits = map.markers.filter((marker) => marker.kind === 'exit');
    const labels = [...parent.querySelectorAll('.hud-map__label')];
    for (const exit of exits) {
      const label = labels.find((each) => each.textContent === exit.label);
      const baseline = Number(label?.getAttribute('y'));
      expect(baseline).toBeLessThan(map.rows);
      if (exit.y > map.rows / 2) expect(baseline).toBeLessThan(exit.y);
    }
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
 * The minimap (decision 115): the zone map's drawing windowed round the player
 * in the top-right corner, with the creatures near them on it.
 */
describe('the minimap', () => {
  const minimap = (): HTMLButtonElement => {
    const found = parent.querySelector<HTMLButtonElement>('.hud-minimap');
    if (!found) throw new Error('no minimap');
    return found;
  };
  const drawn = (kind: string): SVGElement[] => [
    ...parent.querySelectorAll<SVGElement>(`.hud-minimap__map [data-minimap="${kind}"]`),
  ];
  /** The window's top-left corner and its span, in tiles. */
  const viewBox = (): { left: number; top: number; span: number } => {
    const [left = NaN, top = NaN, span = NaN] = (
      parent.querySelector('.hud-minimap__map')?.getAttribute('viewBox') ?? ''
    )
      .split(' ')
      .map(Number);
    return { left, top, span };
  };
  /** The colour a ringed thing is filled with, inside its ring of ink. */
  const fill = (group: SVGElement | undefined): string | null =>
    group?.children[1]?.getAttribute('fill') ?? null;
  const arrive = (zoneId: ZoneId, tile: { x: number; y: number }): void => {
    events.emit(ZONE_ENTERED_EVENT, zoneId);
    events.emit(PLAYER_TILE_CHANGED_EVENT, tile);
  };

  it('stands in the top-right corner, named for its zone', () => {
    setViewport(PHONE.width, PHONE.height);
    mount();
    arrive('town', { x: 12, y: 9 });
    const box = minimap();
    const right = parseFloat(box.style.left) + parseFloat(box.style.width);
    expect(right).toBe(PHONE.width - THEME.margin);
    expect(parseFloat(box.style.top)).toBe(THEME.margin);
    expect(box.classList.contains('hud-hidden')).toBe(false);
    expect(parent.querySelector('.hud-minimap__name')?.textContent).toBe('Lampton');
  });

  it('draws the zone map’s ground and what stands on it, and nothing round a player not yet placed', () => {
    mount();
    events.emit(ZONE_ENTERED_EVENT, 'town');
    const map = zoneMap('town');
    expect(drawn('player')).toHaveLength(0);
    expect(drawn('building')).toHaveLength(map.buildings.length);
    expect(drawn('node')).toHaveLength(map.markers.filter((m) => m.kind === 'node').length);
    expect(drawn('npc')).toHaveLength(map.markers.filter((m) => m.kind === 'npc').length);

    events.emit(PLAYER_TILE_CHANGED_EVENT, { x: 12, y: 9 });
    expect(drawn('player')).toHaveLength(1);
    expect(drawn('exit')).toHaveLength(map.markers.filter((m) => m.kind === 'exit').length);
  });

  it('keeps the player in the middle, moving the window rather than the ground', () => {
    mount();
    arrive('town', { x: 12, y: 9 });
    const ground = drawn('building')[0];
    const here = viewBox();
    expect(here.left + here.span / 2).toBeCloseTo(12, 0);
    expect(here.top + here.span / 2).toBeCloseTo(9, 0);

    events.emit(PLAYER_TILE_CHANGED_EVENT, { x: 3, y: 4 });
    const moved = viewBox();
    expect(moved.left + moved.span / 2).toBeCloseTo(3, 0);
    expect(moved.top + moved.span / 2).toBeCloseTo(4, 0);
    expect(drawn('building')[0]).toBe(ground);
  });

  it('draws an exit off the window on its rim, and one in it where it is', () => {
    mount();
    arrive('town', { x: 1, y: 9 });
    const exits = drawn('exit');
    const rim = exits.filter((exit) => exit.getAttribute('data-rim') === 'true');
    expect(rim.length).toBeGreaterThan(0);
    expect(rim.length).toBeLessThan(exits.length);
    const { left, top, span } = viewBox();
    for (const exit of rim) {
      for (const pixel of exit.children) {
        const x = Number(pixel.getAttribute('x'));
        const y = Number(pixel.getAttribute('y'));
        expect(x).toBeGreaterThanOrEqual(left);
        expect(x).toBeLessThan(left + span);
        expect(y).toBeGreaterThanOrEqual(top);
        expect(y).toBeLessThan(top + span);
      }
    }
  });

  it('draws each creature in the colour of its name, a boss bigger, and a level moves them', () => {
    mount({ level: 3 });
    arrive('town', { x: 12, y: 9 });
    events.emit(CREATURES_CHANGED_EVENT, [
      { x: 10, y: 9, level: 3, boss: false },
      { x: 14, y: 9, level: 6, boss: true },
    ]);
    const [rat] = drawn('creature');
    const [boss] = drawn('boss');
    expect(fill(rat)).toBe(conColor(3, 3));
    expect(fill(boss)).toBe(conColor(3, 6));
    expect(Number(boss?.children[1]?.getAttribute('width'))).toBeGreaterThan(
      Number(rat?.children[1]?.getAttribute('width')),
    );

    events.emit(LEVEL_UP_EVENT, 6);
    expect(fill(drawn('creature')[0])).toBe(conColor(6, 3));
    expect(conColor(6, 3)).not.toBe(conColor(3, 3));
  });

  it('forgets the last zone’s creatures on the way into the next', () => {
    mount();
    arrive('town', { x: 12, y: 9 });
    events.emit(CREATURES_CHANGED_EVENT, [{ x: 10, y: 9, level: 1, boss: false }]);
    expect(drawn('creature')).toHaveLength(1);

    arrive('beach', { x: 12, y: 1 });
    expect(drawn('creature')).toHaveLength(0);
    expect(parent.querySelector('.hud-minimap__name')?.textContent).toBe('Candle Strand');
  });

  it('opens the zone map on a tap, turns it to the zone from the world, and a second tap shuts it', () => {
    mount();
    arrive('town', { x: 12, y: 9 });
    minimap().click();
    expect(openSheets()).toEqual(['map']);

    parent.querySelector<HTMLButtonElement>('[data-action="toggle-map-zoom"]')?.click();
    expect(parent.querySelector('.hud-map__svg--world')).not.toBeNull();
    minimap().click();
    expect(openSheets()).toEqual(['map']);
    expect(parent.querySelector('.hud-map__svg--world')).toBeNull();

    minimap().click();
    expect(openSheets()).toEqual([]);
  });

  it('puts its switch in Options, on what the save says, and asks the session', () => {
    mount({ showMinimap: false });
    expect(minimap().classList.contains('hud-hidden')).toBe(true);
    menuItem('options');
    const button = parent.querySelector<HTMLButtonElement>('[data-action="toggle-minimap"]');
    expect(button?.textContent).toBe('Minimap: Off');
    button?.click();
    expect(button?.textContent).toBe('Minimap: On');
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(
      emitted.filter((e) => e.event === MINIMAP_SET_REQUESTED_EVENT).map((e) => e.args),
    ).toEqual([[true]]);
  });

  it('gives the corner back to the target frame while it is off', () => {
    setViewport(PHONE.width, PHONE.height);
    mount();
    const frameTop = (): number =>
      parseFloat(parent.querySelector<HTMLElement>('.hud-target')?.style.top ?? '');
    expect(frameTop()).toBeGreaterThan(THEME.margin);

    events.emit(MINIMAP_STATE_CHANGED_EVENT, false);
    expect(minimap().classList.contains('hud-hidden')).toBe(true);
    expect(frameTop()).toBe(THEME.margin);

    events.emit(MINIMAP_STATE_CHANGED_EVENT, true);
    expect(minimap().classList.contains('hud-hidden')).toBe(false);
    expect(frameTop()).toBeGreaterThan(THEME.margin);
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

  /**
   * A map you read, not a control. Tapping a cell used to ask the world to
   * travel there; that went when fast travel did, and nothing replaced it —
   * a cell that still looked pressable and did nothing would be the dead
   * button this HUD does not keep.
   */
  it('asks the world for nothing when a cell is pressed', () => {
    openMap();
    zoom()?.click();

    cell('beach')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(emitted.filter((entry) => entry.event.startsWith('travel'))).toEqual([]);
    // Still the world view: pressing another zone's square did nothing at all.
    expect(cells()).not.toEqual([]);
  });

  // The one press that still means something, and it is about the panel rather
  // than about the world: your own square zooms back in to it.
  it('zooms in on the zone the player is already in', () => {
    openMap();
    zoom()?.click();

    cell('town')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

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

    /**
     * Drawn shut and nothing more. The map used to be a way through a locked
     * door — it cost the key, the same as pushing it open in person — and now
     * that it is a map, the only thing that opens the hideout is walking to it.
     * What the cell still does is *say* it is shut, which is what a player
     * reads a map for.
     */
    it('shows the lock without offering a way through it', () => {
      openMap();
      zoom()?.click();

      cell('bandit-hideout')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(emitted.filter((entry) => entry.event.startsWith('travel'))).toEqual([]);
      expect(cell('bandit-hideout')?.dataset.access).toBe('locked');
    });
  });
});
