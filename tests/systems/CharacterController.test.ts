import { describe, expect, it } from 'vitest';
import { MAX_BANK_SLOTS, STARTING_BANK_SLOTS, bankSlotPrice } from '../../src/systems/BankSystem';
import { CharacterController } from '../../src/systems/CharacterController';
import { STARTING_COPPER, createNewCharacter } from '../../src/persistence/CharacterState';
import { QUESTS } from '../../src/data/quests';
import { itemWeight } from '../../src/data/items';
import { questStatus } from '../../src/systems/QuestSystem';
import type { QuestId } from '../../src/types/ids';
import { xpToNextLevel } from '../../src/systems/LevelingSystem';
import { xpToReachLevel } from '../../src/data/xpTable';

function makeController(): CharacterController {
  return new CharacterController(createNewCharacter('Testy', 'warrior'));
}

describe('CharacterController inventory', () => {
  it('adds and removes items through the state', () => {
    const character = makeController();
    character.addItem('logs', 3);
    expect(character.itemCount('logs')).toBe(3);
    character.removeItem('logs', 2);
    expect(character.itemCount('logs')).toBe(1);
    character.removeItem('logs', 1);
    expect(character.state.inventory.logs).toBeUndefined();
  });

  it('counts a missing item as zero', () => {
    expect(makeController().itemCount('logs')).toBe(0);
  });
});

describe('CharacterController encumbrance', () => {
  it('starts a fresh character with an empty pack and room in it', () => {
    const character = makeController();
    expect(character.carriedWeight()).toBe(0);
    expect(character.carryCapacity()).toBeGreaterThan(0);
  });

  it('takes an item that fits', () => {
    const character = makeController();
    expect(character.tryAddItem('logs', 2)).toBe(true);
    expect(character.itemCount('logs')).toBe(2);
  });

  it('refuses an item that does not fit, and adds nothing at all', () => {
    const character = makeController();
    const capacity = character.carryCapacity();
    // Fill the pack to the brim with weight-1 bones, then ask for one more.
    character.addItem('rat-bones', capacity);
    expect(character.tryAddItem('rat-bones', 1)).toBe(false);
    expect(character.itemCount('rat-bones')).toBe(capacity);
    expect(character.carriedWeight()).toBe(capacity);
  });

  it('reports what it would refuse before being asked to do it', () => {
    const character = makeController();
    character.addItem('rat-bones', character.carryCapacity());
    expect(character.canCarryItem('logs', 1)).toBe(false);
  });

  // Capacity comes from effective strength, so the leather that raises it
  // raises what the character can haul too.
  it('grows capacity with the strength gear buys', () => {
    const character = makeController();
    const bare = character.carryCapacity();
    character.addItem('brown-chestplate', 1);
    character.equip('brown-chestplate');
    expect(character.carryCapacity()).toBeGreaterThan(bare);
  });

  // What comes off a station: spent for before it was handed over, so never
  // refused, and still through the quiver the way anything arriving is.
  it('never refuses what a bench made, and quivers made arrows first', () => {
    const character = new CharacterController(createNewCharacter('Fletch', 'ranger'));
    character.state.quiver = null;
    character.addItem('rat-bones', character.carryCapacity());

    character.addMadeItem('crude-arrows', 15);
    character.addMadeItem('bone-char', 2);

    expect(character.state.quiver).toEqual({ itemId: 'crude-arrows', count: 15 });
    expect(character.itemCount('crude-arrows')).toBe(0);
    expect(character.itemCount('bone-char')).toBe(2);
  });

  it('stops charging for gear once it is worn rather than carried', () => {
    const character = makeController();
    character.addItem('brown-helmet', 1);
    const carried = character.carriedWeight();
    character.equip('brown-helmet');
    expect(character.carriedWeight()).toBeLessThan(carried);
  });
});

describe('CharacterController currency', () => {
  it('adds and spends copper against the state', () => {
    const character = makeController();
    const start = character.state.currency;
    character.addCurrency(50);
    expect(character.state.currency).toBe(start + 50);
    expect(character.spendCurrency(30)).toBe(true);
    expect(character.state.currency).toBe(start + 20);
  });

  it('refuses to overspend and deducts nothing', () => {
    const character = makeController();
    const start = character.state.currency;
    expect(character.spendCurrency(start + 1)).toBe(false);
    expect(character.state.currency).toBe(start);
  });

  it('ignores negative amounts on both sides', () => {
    const character = makeController();
    const start = character.state.currency;
    character.addCurrency(-100);
    expect(character.state.currency).toBe(start);
    expect(character.spendCurrency(-5)).toBe(false);
  });
});

describe('CharacterController gear', () => {
  it('equips from the inventory and swaps the old piece back in', () => {
    const character = makeController();
    character.addItem('felling-axe', 1);
    // the warrior starts with the rusty sword equipped
    expect(character.state.gear.weapon).toBe('rusty-sword');
    character.equip('felling-axe');
    expect(character.state.gear.weapon).toBe('felling-axe');
    expect(character.itemCount('rusty-sword')).toBe(1);
    expect(character.itemCount('felling-axe')).toBe(0);
  });

  it('unequips back into the inventory', () => {
    const character = makeController();
    character.unequip('weapon');
    expect(character.state.gear.weapon).toBeNull();
    expect(character.itemCount('rusty-sword')).toBe(1);
  });
});

describe('CharacterController xp', () => {
  it('accumulates combat xp and reports the distance to the next level', () => {
    const character = makeController();
    const gain = character.awardXp(3);
    expect(gain.leveledUp).toBe(false);
    expect(gain.level).toBe(1);
    expect(gain.xp).toBe(3);
    expect(gain.xpToNext).toBe(xpToNextLevel(1));
    expect(character.state.xp).toBe(3);
  });

  it('levels up the underlying state', () => {
    const character = makeController();
    const gain = character.awardXp(xpToReachLevel(2));
    expect(gain.leveledUp).toBe(true);
    expect(gain.level).toBe(2);
    expect(character.state.level).toBe(2);
  });

  it('accumulates skill xp with the skill id in the result', () => {
    const character = makeController();
    const gain = character.awardSkillXp('woodcutting', 10);
    expect(gain.skillId).toBe('woodcutting');
    expect(gain.xp).toBe(10);
    expect(gain.leveledUp).toBe(false);
    expect(character.state.skills.woodcutting.xp).toBe(10);
    expect(character.skillLevelOf('woodcutting')).toBe(1);
  });
});

describe('CharacterController quests', () => {
  it('accepts a quest once and ignores a second attempt', () => {
    const character = makeController();
    expect(character.acceptQuest('rat-bones')).toBe(true);
    expect(character.acceptQuest('rat-bones')).toBe(false);
    expect(character.state.quests['rat-bones']).toEqual({ status: 'active', baseline: 0 });
  });

  it('reads progress off the bag', () => {
    const character = makeController();
    character.acceptQuest('rat-bones');
    expect(character.questProgress('rat-bones')).toEqual({ have: 0, need: 10, met: false });
    character.addItem('rat-bones', 10);
    expect(character.questProgress('rat-bones').met).toBe(true);
  });

  it('pays out coin, xp and the class-appropriate gear, and eats the objective', () => {
    const character = makeController();
    character.acceptQuest('rat-bones');
    character.addItem('rat-bones', 12);
    const before = character.state.currency;

    const result = character.turnInQuest('rat-bones');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.copper).toBe(QUESTS['rat-bones'].reward.copper);
    expect(result.rewardItemId).toBe('brown-helmet');
    expect(result.xp.level).toBeGreaterThanOrEqual(1);
    expect(character.state.currency).toBe(before + QUESTS['rat-bones'].reward.copper);
    // Exactly the objective is consumed; the surplus stays in the bag.
    expect(character.itemCount('rat-bones')).toBe(2);
    expect(character.itemCount('brown-helmet')).toBe(1);
    expect(questStatus(character.state.quests, 'rat-bones')).toBe('done');
  });

  it('hands a wizard cloth where a warrior gets leather', () => {
    const wizard = new CharacterController(createNewCharacter('Aria', 'wizard'));
    wizard.acceptQuest('rat-bones');
    wizard.addItem('rat-bones', 10);
    const result = wizard.turnInQuest('rat-bones');
    expect(result.ok && result.rewardItemId).toBe('brown-cloth-hat');
  });

  it('refuses a turn-in without the goods, changing nothing', () => {
    const character = makeController();
    character.acceptQuest('rat-bones');
    character.addItem('rat-bones', 9);
    const result = character.turnInQuest('rat-bones');
    expect(result.ok).toBe(false);
    expect(character.itemCount('rat-bones')).toBe(9);
    expect(questStatus(character.state.quests, 'rat-bones')).toBe('active');
  });

  it('refuses a quest that was never accepted', () => {
    const character = makeController();
    character.addItem('rat-bones', 10);
    expect(character.turnInQuest('rat-bones').ok).toBe(false);
  });

  // The baseline is read off the character at the accept and nowhere else, so
  // the kills that are already on the sheet are the ones this quest is not
  // about.
  it('baselines a kill objective against the kills already made', () => {
    const character = makeController();
    character.recordKill('bandit', 40);
    character.state.quests = { 'rat-bones': { status: 'done', baseline: 0 } };
    character.state.quests['crab-feast'] = { status: 'done', baseline: 0 };

    expect(character.acceptQuest('bandit-trouble')).toBe(true);

    expect(character.state.quests['bandit-trouble']).toEqual({ status: 'active', baseline: 40 });
    expect(character.questProgress('bandit-trouble').have).toBe(0);
    character.recordKill('bandit', 12);
    expect(character.questProgress('bandit-trouble').met).toBe(true);
  });

  // A visit and a kill are paid for out in the world, so the counter has
  // nothing to take: the hand-in is coin and XP alone, and the pack is
  // untouched by it.
  it('takes nothing at the counter for a quest that asks for no items', () => {
    const character = makeController();
    character.addItem('logs', 4);
    expect(character.acceptQuest('quarry-road')).toBe(true);
    character.recordVisit('quarry');
    const before = character.state.currency;

    const result = character.turnInQuest('quarry-road');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rewardItemId).toBe(null);
    expect(character.state.currency).toBe(before + QUESTS['quarry-road'].reward.copper);
    expect(character.itemCount('logs')).toBe(4);
    expect(questStatus(character.state.quests, 'quarry-road')).toBe('done');
  });

  it('counts an arrival per world walked into, not per zone ever seen', () => {
    const character = makeController();
    expect(character.state.visits).toEqual({});
    character.recordVisit('quarry');
    character.recordVisit('quarry');
    character.recordVisit('beach');
    expect(character.state.visits).toEqual({ quarry: 2, beach: 1 });
  });

  // Neither shipped quest can strand a player, because both hand over more
  // weight than they give back. Worth asserting rather than assuming: it is the
  // reason a full pack never blocks the starter arc.
  it('keeps every quest reward lighter than the objective it consumes', () => {
    Object.values(QUESTS).forEach((quest) => {
      const objective = quest.objective;
      // Only a collect objective is handed over at the counter; the other two
      // free no weight, so a reward on one has to fit the pack as it stands.
      const handedOver =
        objective.kind === 'collect' ? itemWeight(objective.itemId) * objective.quantity : 0;
      Object.values(quest.reward.gear ?? {}).forEach((rewardItemId) => {
        expect(itemWeight(rewardItemId)).toBeLessThanOrEqual(handedOver);
      });
    });
  });

  // ...and the guard for a future quest that doesn't hold that property. Taking
  // the objective and then finding no room for the reward is the one outcome
  // that can't be undone, so the whole turn-in has to fail together.
  it('refuses rather than half-applies when the pack cannot hold the reward', () => {
    const heavyReward = 'test-heavy-reward' as QuestId;
    QUESTS[heavyReward] = {
      id: heavyReward,
      name: 'Test',
      giverNpcId: 'shopkeeper',
      description: '',
      objective: { kind: 'collect', itemId: 'raw-fish', quantity: 1 },
      reward: {
        copper: 50,
        xp: 10,
        gear: { warrior: 'brown-chestplate', wizard: 'brown-robe', ranger: 'brown-chestplate' },
      },
    };
    try {
      const character = makeController();
      character.acceptQuest(heavyReward);
      character.addItem('raw-fish', 1);
      // Fill to the brim: handing over one 1-weight fish cannot make room for a
      // 6-weight chestplate.
      const room = character.carryCapacity() - character.carriedWeight();
      character.addItem('logs', Math.floor(room / itemWeight('logs')));

      const result = character.turnInQuest(heavyReward);

      expect(result.ok).toBe(false);
      expect(result.ok ? '' : result.reason).toContain('pack');
      expect(character.itemCount('raw-fish')).toBe(1);
      expect(character.itemCount('brown-chestplate')).toBe(0);
      expect(questStatus(character.state.quests, heavyReward)).toBe('active');
      expect(character.state.currency).toBe(STARTING_COPPER);
    } finally {
      delete QUESTS[heavyReward];
    }
  });
});

describe('CharacterController location', () => {
  it('records zone, rounded position, and touches updatedAt', () => {
    const character = makeController();
    const before = character.state.updatedAt;
    character.recordLocation('town', { x: 123.6, y: 456.4 });
    expect(character.state.zoneId).toBe('town');
    expect(character.state.position).toEqual({ x: 124, y: 456 });
    expect(Date.parse(character.state.updatedAt)).toBeGreaterThanOrEqual(Date.parse(before));
  });

  // A character who owes a respawn has a zone but no spot in it.
  it('records a zone with no position at all', () => {
    const character = makeController();
    character.recordLocation('beach', { x: 10, y: 20 });
    character.recordLocation('town', null);
    expect(character.state.zoneId).toBe('town');
    expect(character.state.position).toBeNull();
  });
});

describe('CharacterController achievements', () => {
  it('counts kills per creature', () => {
    const character = makeController();
    character.recordKill('rat');
    character.recordKill('rat');
    character.recordKill('crab');
    expect(character.state.kills).toEqual({ rat: 2, crab: 1 });
  });

  it('reports the achievement a kill completed', () => {
    const character = makeController();
    character.recordKill('rat', 24);
    expect(character.recordKill('rat').map((a) => a.id)).toEqual(['rat-slayer-25']);
  });

  it('reports nothing for a kill that completed no tier', () => {
    const character = makeController();
    expect(character.recordKill('rat')).toEqual([]);
  });

  // An offline camp credits its whole session at once, so it has to be able to
  // report more than one achievement from a single call.
  it('reports every tier a whole camp session cleared', () => {
    const character = makeController();
    expect(character.recordKill('bandit', 100).map((a) => a.id)).toEqual([
      'bandit-slayer-25',
      'bandit-slayer-50',
      'bandit-slayer-100',
    ]);
  });

  // A title nobody put on is not a reward anyone sees, so the first one is
  // worn automatically. Later ones do not steal the player's choice.
  it('wears the first title earned, then leaves the choice alone', () => {
    const character = makeController();
    character.recordKill('rat', 100);
    expect(character.state.activeTitleId).toBe('rat-slayer');
    character.recordKill('crab', 100);
    expect(character.state.activeTitleId).toBe('rat-slayer');
  });

  it('lets an earned title be chosen and taken off again', () => {
    const character = makeController();
    character.recordKill('rat', 100);
    character.recordKill('crab', 100);
    expect(character.setActiveTitle('crab-slayer')).toBe(true);
    expect(character.displayName()).toBe('Testy, Crab Slayer');
    expect(character.setActiveTitle(null)).toBe(true);
    expect(character.displayName()).toBe('Testy');
  });

  it('refuses a title the kills do not back, leaving the worn one alone', () => {
    const character = makeController();
    character.recordKill('rat', 100);
    expect(character.setActiveTitle('bandit-slayer')).toBe(false);
    expect(character.state.activeTitleId).toBe('rat-slayer');
  });

  it('tracks progress toward a tier off the stored count', () => {
    const character = makeController();
    character.recordKill('crab', 30);
    expect(character.achievementProgress('crab-slayer-50')).toEqual({
      have: 30,
      need: 50,
      met: false,
    });
    // Thirty is past the first rank, which is a title of its own.
    expect(character.earnedTitles()).toEqual(['crab-culler']);
  });

  // A camp session can cross two ranks in one payout. What goes on is the rank
  // just earned at the top, not the one it passed on the way.
  it('wears the best rank a single payout crossed', () => {
    const character = makeController();
    character.recordKill('crab', 60);
    expect(character.state.activeTitleId).toBe('crab-hunter');
  });
});

describe('CharacterController locked zones', () => {
  it('starts with every door still shut', () => {
    const character = makeController();
    expect(character.state.unlockedZones).toEqual([]);
    expect(character.hasUnlocked('bandit-hideout')).toBe(false);
  });

  it('spends exactly one key and remembers the door', () => {
    const character = makeController();
    character.addItem('hideout-key', 2);

    expect(character.unlockZone('bandit-hideout', 'hideout-key')).toBe(true);
    expect(character.itemCount('hideout-key')).toBe(1);
    expect(character.hasUnlocked('bandit-hideout')).toBe(true);
  });

  // The one outcome that cannot be undone is taking the key and not opening
  // anything, so this refuses as a whole rather than half-applying.
  it('refuses without a key, and takes nothing', () => {
    const character = makeController();

    expect(character.unlockZone('bandit-hideout', 'hideout-key')).toBe(false);
    expect(character.hasUnlocked('bandit-hideout')).toBe(false);
    expect(character.state.unlockedZones).toEqual([]);
  });

  // Every route into a zone asks, so the same door can be opened twice in a
  // session; a second key is not what that should cost.
  it('opens an already-open door for free', () => {
    const character = makeController();
    character.addItem('hideout-key', 1);
    character.unlockZone('bandit-hideout', 'hideout-key');
    character.addItem('hideout-key', 1);

    expect(character.unlockZone('bandit-hideout', 'hideout-key')).toBe(true);
    expect(character.itemCount('hideout-key')).toBe(1);
    expect(character.state.unlockedZones).toEqual(['bandit-hideout']);
  });
});

/**
 * The vault, at the level the state is actually changed. `BankSession` covers
 * the counter's refusals; what is worth saying here is that both directions
 * either happen whole or leave both sides exactly as they were.
 */
describe('CharacterController banking', () => {
  it('starts with the free shelves and nothing on them', () => {
    const character = makeController();
    expect(character.state.bank).toEqual({});
    expect(character.state.bankSlots).toBe(STARTING_BANK_SLOTS);
    expect(character.bankSlotsUsed()).toBe(0);
  });

  it('moves a stack across and back, clamped to what is really there', () => {
    const character = makeController();
    character.addItem('logs', 4);

    expect(character.deposit('logs', 99)).toEqual({ ok: true, moved: 4 });
    expect(character.itemCount('logs')).toBe(0);
    expect(character.bankCount('logs')).toBe(4);

    expect(character.withdraw('logs', 99)).toMatchObject({ ok: true, moved: 4 });
    expect(character.bankCount('logs')).toBe(0);
  });

  it('refuses a deposit of nothing, and one with no shelf for it', () => {
    const character = makeController();
    character.state.bankSlots = 1;
    character.state.bank = { logs: 1 };
    character.addItem('raw-fish', 1);

    expect(character.deposit('logs', 0).ok).toBe(false);
    expect(character.deposit('cooked-fish', 1).ok).toBe(false);
    expect(character.deposit('raw-fish', 1).ok).toBe(false);
    expect(character.itemCount('raw-fish')).toBe(1);
  });

  // A slot is spent on the id, so the vault is never full for something that
  // already has a shelf.
  it('always stacks onto a shelf it already has', () => {
    const character = makeController();
    character.state.bankSlots = 1;
    character.state.bank = { logs: 1 };
    character.addItem('logs', 9);

    expect(character.deposit('logs', 9)).toEqual({ ok: true, moved: 9 });
    expect(character.bankCount('logs')).toBe(10);
  });

  /**
   * One of the two acquisitions deliberately not all-or-nothing: what will not
   * fit is still the player's, sitting on the shelf, rather than destroyed by
   * the refusal the way a gather's yield would be.
   */
  it('withdraws what the pack will hold and reports what stayed behind', () => {
    const character = makeController();
    character.state.bank = { logs: 200 };

    const result = character.withdraw('logs', 200);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.moved).toBeGreaterThan(0);
    expect(result.left).toBe(200 - result.moved);
    expect(character.bankCount('logs')).toBe(result.left);
  });

  // The other is a loot pile, which asks the same question without a bank.
  it('adds what fits of a stack and says how many that was', () => {
    const character = makeController();
    const room = character.carryCapacity() - character.carriedWeight();
    character.addItem('rat-bones', room - 3 * itemWeight('rat-meat'));

    expect(character.addWhatFits('rat-meat', 5)).toBe(3);
    expect(character.itemCount('rat-meat')).toBe(3);
    expect(character.addWhatFits('rat-meat', 5)).toBe(0);
    expect(character.itemCount('rat-meat')).toBe(3);
  });

  it('refuses a withdrawal into a pack with no room, keeping the shelf intact', () => {
    const character = makeController();
    character.state.bank = { logs: 5 };
    character.addItem('rat-bones', character.carryCapacity());

    expect(character.withdraw('logs', 5).ok).toBe(false);
    expect(character.bankCount('logs')).toBe(5);
  });

  it('buys a shelf, and refuses as a whole when short or at the cap', () => {
    const character = makeController();
    const price = bankSlotPrice(character.state.bankSlots) ?? 0;

    character.state.currency = price - 1;
    expect(character.buyBankSlot().ok).toBe(false);
    expect(character.state.currency).toBe(price - 1);

    character.state.currency = price;
    expect(character.buyBankSlot()).toEqual({
      ok: true,
      price,
      slots: STARTING_BANK_SLOTS + 1,
    });
    expect(character.state.currency).toBe(0);

    character.state.bankSlots = MAX_BANK_SLOTS;
    character.state.currency = 10000;
    expect(character.buyBankSlot().ok).toBe(false);
    expect(character.state.currency).toBe(10000);
  });
});
