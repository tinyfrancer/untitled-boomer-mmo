import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { describeItemName } from '../../src/data/items';
import { LOOT_TABLES } from '../../src/data/lootTables';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { QUEST_ORDER } from '../../src/data/quests';
import { SHOP_STOCK } from '../../src/data/shop';
import { ZONES } from '../../src/data/zones';
import { STARTING_BANK_SLOTS, bankSlotPrice } from '../../src/systems/BankSystem';
import { formatCurrency } from '../../src/systems/CurrencySystem';
import { scaleEnemyStats } from '../../src/systems/EnemySystem';
import {
  describeEnemy,
  describeEnemyLoot,
  describeItem,
  describeNode,
  describeNpc,
  describeSignpost,
  formatChance,
  type InspectPanel,
} from '../../src/systems/InspectSystem';
import { nth } from '../nth';

/**
 * What the game says about itself when asked. All of it is a pure function of
 * the data tables, which is the whole reason these panels are worth having:
 * a drop rate a player reads off the screen and the one `rollLootTable` rolls
 * against are the same number, and this is where that stays true.
 */

function valueOf(panel: InspectPanel, label: string): string | undefined {
  return panel.lines.find((line) => line.label === label)?.value;
}

describe('formatChance', () => {
  it('reads a drop rate as whole percent', () => {
    expect(formatChance(0.6)).toBe('60%');
    expect(formatChance(0.06)).toBe('6%');
    expect(formatChance(1)).toBe('100%');
  });

  /**
   * The one case rounding gets dangerously wrong: "0%" reads as never, and a
   * player who believes it stops farming something that does in fact drop.
   */
  it('never prints a real drop as impossible', () => {
    expect(formatChance(0.004)).toBe('<1%');
    expect(formatChance(0)).toBe('0%');
  });
});

describe('describing an enemy', () => {
  it('states the stats of the level actually standing there', () => {
    const scaled = scaleEnemyStats(ENEMIES.rat, 3);
    const panel = describeEnemy(ENEMIES.rat, 3);

    expect(panel.subtitle).toBe('Level 3 Beast');
    expect(valueOf(panel, 'Health')).toBe(String(scaled.maxHp));
    expect(valueOf(panel, 'Attack')).toBe(String(scaled.attackPower));
    expect(valueOf(panel, 'XP')).toBe(String(scaled.xpReward));
  });

  // The bandit camp is the one place walking too close is a decision, so the
  // panel has to be the place a player can find that out before it happens.
  it('says which ones start the fight', () => {
    expect(valueOf(describeEnemy(ENEMIES.bandit, 1), 'Behaviour')).toBe('Attacks on sight');
    expect(valueOf(describeEnemy(ENEMIES.crab, 1), 'Behaviour')).toBe('Only fights back');
  });
});

describe('describing a drop table', () => {
  it('lists every entry at the chance the roll uses', () => {
    const panel = describeEnemyLoot(ENEMIES.rat);
    const bones = nth(panel.drops?.filter((drop) => drop.itemId === 'rat-bones') ?? [], 0);

    expect(panel.drops).toHaveLength(LOOT_TABLES.rat.entries.length);
    expect(bones.chance).toBe(nth(LOOT_TABLES.rat.entries, 0).chance);
  });

  it('puts what you are farming for at the top', () => {
    const chances = describeEnemyLoot(ENEMIES.bandit).drops?.map((drop) => drop.chance) ?? [];
    expect(chances).toEqual([...chances].sort((left, right) => right - left));
  });

  /**
   * A percentage list with no such line reads as one wheel being spun, and a
   * player would conclude the 6% helmet costs them the 15% fish. Every entry is
   * its own roll (see `rollLootTable`), so the note is the load-bearing part of
   * the panel rather than decoration.
   */
  it('says the chances are independent', () => {
    expect(describeEnemyLoot(ENEMIES.bandit).subtitle).toBe('Each drop is rolled separately');
  });

  it('gives coin its own line, since only humanoids carry any', () => {
    const currency = LOOT_TABLES.bandit.currency;
    expect(valueOf(describeEnemyLoot(ENEMIES.bandit), 'Coin')).toBe(
      `${currency?.min}-${currency?.max}c at 90%`,
    );
    expect(valueOf(describeEnemyLoot(ENEMIES.rat), 'Coin')).toBeUndefined();
  });
});

describe('describing a node', () => {
  it('names the tool and the level a locked node is waiting on', () => {
    const panel = describeNode(RESOURCE_NODES['ocean-fishing-spot']);

    expect(panel.subtitle).toBe('Fishing (level 5)');
    expect(valueOf(panel, 'Tool')).toBe('Fishing Pole');
    expect(valueOf(panel, 'Yields')).toBe('Raw Fish');
  });

  // Whether it runs out is the difference between a spot worth settling at and
  // one worth four swings.
  it('tells a pond from a tree', () => {
    expect(valueOf(describeNode(RESOURCE_NODES['fishing-spot']), 'Charges')).toBe('Never runs out');
    expect(valueOf(describeNode(RESOURCE_NODES.tree), 'Charges')).toBe('4, then regrows');
  });
});

describe('describing the rest of the world', () => {
  it('tells a signpost what is at the other end of it', () => {
    const panel = describeSignpost(nth(ZONES.town.exits, 0));

    expect(panel.title).toBe('Signpost: Beach');
    expect(panel.subtitle).toBe('South edge');
    expect(panel.note).toBe(ZONES.beach.description);
  });

  /**
   * The merchant's card names no stock, for a reason the banker's card only
   * half shares: this one is a pure function of an id and so cannot read the
   * player at all, and half the shelf is gated behind a level or a finished
   * quest. A list here would promise a stranger things they have not earned.
   */
  it('says what the shopkeeper is for without promising a shelf they cannot see', () => {
    const panel = describeNpc('shopkeeper');
    const stocked = SHOP_STOCK.filter((entry) => !entry.requires).length;

    expect(panel.title).toBe('Shopkeeper');
    expect(valueOf(panel, 'Sells')).toBe('Tools, food and supplies');
    expect(valueOf(panel, 'Stocks')).toBe(`${stocked} to start, up to ${SHOP_STOCK.length}`);
    expect(valueOf(panel, 'Quests')).toBe(String(QUEST_ORDER.length));
    expect(panel.note).toContain('the work you finish');
    // No item name appears anywhere on it, gated or not.
    const said = [...panel.lines.map((line) => line.value), panel.note ?? ''].join(' ');
    SHOP_STOCK.forEach((entry) => expect(said).not.toContain(describeItemName(entry.itemId)));
  });

  /**
   * The second counter gets a card about the *service* rather than about this
   * character's shelves: a panel is settled the moment it opens, so a slot
   * count read off a player would be stale the first time they used it.
   */
  it('describes the banker by what the counter does, not by what is on it', () => {
    const panel = describeNpc('banker');

    expect(panel.title).toBe('Banker');
    expect(panel.subtitle).toBe('Banker');
    expect(valueOf(panel, 'Stores')).toContain('no weight');
    expect(valueOf(panel, 'Slots')).toContain(String(STARTING_BANK_SLOTS));
    expect(valueOf(panel, 'Charges')).toContain(
      formatCurrency(bankSlotPrice(STARTING_BANK_SLOTS) ?? 0),
    );
    expect(panel.note).toContain('one kind of thing');
    // Nothing about the shop leaks into it.
    expect(valueOf(panel, 'Sells')).toBeUndefined();
  });
});

describe('describing an item', () => {
  it('spells out what the bag has no room to say', () => {
    const panel = describeItem('brown-chestplate');

    expect(panel.subtitle).toBe('Leather armour');
    expect(valueOf(panel, 'Health')).toBe('+1');
    expect(valueOf(panel, 'Strength')).toBe('+1');
    // The line the bag never had room for, and the reason a wizard looting one
    // in the camp is looking at a vendor trash item rather than an upgrade.
    expect(valueOf(panel, 'Worn by')).toBe('Warrior');
    expect(valueOf(panel, 'Weight')).toBe('6');
    expect(valueOf(panel, 'Value')).toBe('35c');
  });

  it('reads a wand as a weapon and a pole as a tool', () => {
    expect(describeItem('apprentice-wand').subtitle).toBe('Weapon');
    expect(valueOf(describeItem('apprentice-wand'), 'Reach')).toBe('200');
    expect(describeItem('fishing-pole').subtitle).toBe('Tool');
    expect(valueOf(describeItem('fishing-pole'), 'Gathers')).toBe('Fishing');
  });

  it('says what food is worth eating rather than what it is worth wearing', () => {
    const panel = describeItem('cooked-crab');

    expect(panel.subtitle).toBe('Food');
    expect(valueOf(panel, 'Restores')).toBe('25 HP over 10s');
  });
});
