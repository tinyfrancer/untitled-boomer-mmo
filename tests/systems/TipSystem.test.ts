import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../../src/data/abilities';
import { createNewCharacter, type CharacterState } from '../../src/persistence';
import { formatCurrency } from '../../src/systems/CurrencySystem';
import { inventoryWeight } from '../../src/systems/EncumbranceSystem';
import { TIP_ORDER, nextTip, tipLine, type TipFacts } from '../../src/systems/TipSystem';
import type { TipId } from '../../src/types/ids';

function facts(overrides: Partial<TipFacts> = {}, character: Partial<CharacterState> = {}) {
  return {
    character: { ...createNewCharacter('Tester', 'warrior'), ...character },
    hp: 100,
    maxHp: 100,
    capacity: 1000,
    idle: false,
    deathPaid: null,
    ...overrides,
  } satisfies TipFacts;
}

/**
 * A character to whom every tip applies at once: hurt, just dead, a full pack
 * of raw meat, ore and food, a tool, a contract, a lesson waiting, a title and
 * a mastery rank, and idle. What a save from before tips existed looks like.
 */
function veteran(): TipFacts {
  const inventory = { 'cooked-fish': 2, 'rat-meat': 3, 'tin-ore': 4, 'felling-axe': 1 };
  return facts(
    { hp: 20, idle: false, deathPaid: 45, capacity: inventoryWeight(inventory) },
    {
      level: 2,
      learnedAbilities: [],
      inventory,
      bounty: { bountyId: 'rat-cull', baseline: 0 },
      kills: { rat: 30 },
      activeTitleId: 'rat-culler',
      mastery: { tree: 600 },
    },
  );
}

describe('the order tips come in', () => {
  it('offers a fresh character how to ask about things, and nothing else', () => {
    const fresh = facts();
    expect(nextTip(fresh)?.tipId).toBe('hold-to-inspect');
    const others = TIP_ORDER.filter((tipId) => tipId !== 'hold-to-inspect');
    expect(others.filter((tipId) => tipLine(tipId, fresh) !== null)).toEqual([]);
  });

  /**
   * Every tip is reachable, and heard one by one they come in `TIP_ORDER` —
   * which is the order a character from before tips hears them in.
   */
  it('walks a veteran through every tip in order, then falls quiet', () => {
    const state = veteran();
    const heard: TipId[] = [];
    // Idle eats for itself, so the food tip keeps quiet through it: the
    // veteran goes idle once that one is heard.
    const next = (): TipId | undefined =>
      nextTip({
        ...state,
        idle: heard.includes('hurt-with-food'),
        character: { ...state.character, tips: { heard, off: false } },
      })?.tipId;
    for (const expected of TIP_ORDER) {
      expect(next()).toBe(expected);
      heard.push(expected);
    }
    expect(next()).toBeUndefined();
  });

  it('says nothing to a character who switched tips off', () => {
    const state = veteran();
    expect(
      nextTip({ ...state, character: { ...state.character, tips: { heard: [], off: true } } }),
    ).toBeNull();
  });
});

describe('what each tip says', () => {
  it('names the food in the bag once hurt, and not while idle eats for itself', () => {
    const hurt = facts({ hp: 40 }, { inventory: { 'cooked-fish': 1 } });
    expect(tipLine('hurt-with-food', hurt)).toContain('Cooked Fish');
    expect(tipLine('hurt-with-food', { ...hurt, idle: true })).toBeNull();
    expect(tipLine('hurt-with-food', { ...hurt, hp: 60 })).toBeNull();
    expect(tipLine('hurt-with-food', facts({ hp: 40 }))).toBeNull();
  });

  it('says what getting up cost, or that there was nothing to pay', () => {
    expect(tipLine('first-death', facts({ deathPaid: 45 }))).toContain(formatCurrency(45));
    expect(tipLine('first-death', facts({ deathPaid: 0 }))).toContain('none to pay');
    expect(tipLine('first-death', facts())).toBeNull();
  });

  it('sends a full pack to the shop and the bank, and says how long a pile waits', () => {
    const inventory = { 'tin-ore': 10 };
    const full = facts({ capacity: inventoryWeight(inventory) }, { inventory });
    const line = tipLine('pack-full', full);
    expect(line).toContain('a minute');
    expect(line).toContain('Shopkeeper (Lampton)');
    expect(line).toContain('Banker (Lampton)');
    expect(tipLine('pack-full', { ...full, capacity: 1000 })).toBeNull();
  });

  it('says raw food wants a fire, and how to light one', () => {
    const line = tipLine('raw-food', facts({}, { inventory: { 'rat-meat': 1 } }));
    expect(line).toContain("Rat Meat won't mend you raw");
    expect(line).toContain('Light Fire');
  });

  it("reads idle's share of the XP and a closed game's ceiling off the rules", () => {
    const line = tipLine('going-idle', facts({ idle: true }));
    expect(line).toContain('half the XP');
    expect(line).toContain('8 hours');
    expect(tipLine('going-idle', facts())).toBeNull();
  });

  it('tells the first contract that it comes round again', () => {
    const line = tipLine(
      'first-contract',
      facts({}, { bounty: { bountyId: 'rat-cull', baseline: 0 } }),
    );
    expect(line).toContain('posted again');
  });

  it('puts a tool in the hand, and says what to tap once it is there', () => {
    expect(tipLine('first-tool', facts({}, { inventory: { pickaxe: 1 } }))).toContain(
      'tap a Tin Vein to mine ore',
    );
    const held = createNewCharacter('Tester', 'warrior');
    const line = tipLine(
      'first-tool',
      facts({}, { gear: { ...held.gear, weapon: 'felling-axe' } }),
    );
    expect(line).toContain('With the Felling Axe in hand, tap a Tree to chop wood.');
  });

  it('sends a material to the station that takes it, and not logs to the fletcher', () => {
    expect(tipLine('first-material', facts({}, { inventory: { 'tin-ore': 1 } }))).toContain(
      'Tin Ore is worked at the Forge (Lampton)',
    );
    expect(tipLine('first-material', facts({}, { inventory: { logs: 5 } }))).toBeNull();
  });

  it('names the lesson a level opened, its price and who teaches it', () => {
    const line = tipLine('first-level', facts({}, { level: 2, learnedAbilities: [] }));
    expect(line).toContain('Trainer (Lampton)');
    expect(line).toContain(ABILITIES['battle-fury'].name);
    expect(line).toContain(formatCurrency(120));
    expect(tipLine('first-level', facts({}, { level: 1, learnedAbilities: [] }))).toBeNull();
    expect(
      tipLine('first-level', facts({}, { level: 2, learnedAbilities: ['battle-fury'] })),
    ).toBeNull();
  });

  it('names a title earned, worn or not, and where the rest are', () => {
    const line = tipLine('first-title', facts({}, { kills: { rat: 25 } }));
    expect(line).toContain('Rat Culler');
    expect(line).toContain('Feats');
  });

  it('names the first rank that pays, and what it pays', () => {
    expect(tipLine('first-mastery', facts({}, { mastery: { tree: 499 } }))).toBeNull();
    expect(tipLine('first-mastery', facts({}, { mastery: { tree: 500 } }))).toContain(
      'Tree is Apprentice now: a 5% chance',
    );
  });
});
