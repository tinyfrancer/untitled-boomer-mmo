import { describe, expect, it } from 'vitest';
import { BOUNTIES, BOUNTY_ORDER, type BountyDefinition } from '../../src/data/bounties';
import { ENEMIES } from '../../src/data/enemies';
import { itemValue } from '../../src/data/items';
import { RECIPES } from '../../src/data/recipes';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { SHOP_STOCK } from '../../src/data/shop';
import { ZONES } from '../../src/data/zones';
import { MAX_CHARACTER_LEVEL } from '../../src/config/constants';
import { scaleEnemyStats } from '../../src/systems/EnemySystem';
import {
  bountyAccess,
  bountyMarker,
  bountyOffers,
  bountyProgress,
  bountyState,
  canAcceptBounty,
  canTurnInBounty,
  type BoardContext,
} from '../../src/systems/BountySystem';
import type { BountyId, EnemyId, ItemId } from '../../src/types/ids';

const board = (overrides: Partial<BoardContext> = {}): BoardContext => ({
  inventory: {},
  kills: {},
  visits: {},
  level: 1,
  bounty: null,
  ...overrides,
});

const bounty = (id: BountyId): BountyDefinition => BOUNTIES[id];

describe('bountyAccess', () => {
  it('posts an ungated contract from the first visit', () => {
    expect(bountyAccess(bounty('rat-cull'), { level: 1 }).kind).toBe('offered');
  });

  it('holds a gated one back and says what it is waiting on', () => {
    const access = bountyAccess(bounty('road-contract'), { level: 1 });

    expect(access.kind).toBe('gated');
    expect(access.kind === 'gated' && access.requirement).toBe('Level 3');
    // The full sentence, which is the only version a phone with no tooltip gets.
    expect(access.kind === 'gated' && access.reason).toContain('level 3');
  });

  it('posts it the moment the level arrives', () => {
    expect(bountyAccess(bounty('road-contract'), { level: 3 }).kind).toBe('offered');
  });
});

describe('bountyProgress', () => {
  /**
   * The baseline rule, which is the whole reason a contract stores a number:
   * kills are a lifetime tally, so "fifteen rats" read straight off one is
   * already finished for anybody who has been playing.
   */
  it('counts kills from where the tally stood when the contract was taken', () => {
    const held = { bountyId: 'rat-cull' as const, baseline: 60 };

    expect(bountyProgress(bounty('rat-cull'), held, board({ kills: { rat: 60 } }))).toEqual({
      have: 0,
      need: 15,
      met: false,
    });
    expect(bountyProgress(bounty('rat-cull'), held, board({ kills: { rat: 70 } }))).toEqual({
      have: 10,
      need: 15,
      met: false,
    });
    expect(bountyProgress(bounty('rat-cull'), held, board({ kills: { rat: 80 } }))).toEqual({
      have: 15,
      need: 15,
      met: true,
    });
  });

  // A bag is not a tally: it goes down as well as up, so a collect contract
  // counts what is actually held rather than what has arrived since.
  it('counts a gather contract straight off the bag', () => {
    const held = { bountyId: 'timber-order' as const, baseline: 0 };

    expect(
      bountyProgress(bounty('timber-order'), held, board({ inventory: { logs: 9 } })).have,
    ).toBe(9);
    expect(
      bountyProgress(bounty('timber-order'), held, board({ inventory: { logs: 2 } })).have,
    ).toBe(2);
  });

  // A row nobody has taken previews from where taking it now would start, which
  // is none of whatever it counts — the same arithmetic one moment earlier.
  it('shows an untaken kill contract at zero however many are already dead', () => {
    expect(bountyProgress(bounty('rat-cull'), null, board({ kills: { rat: 400 } })).have).toBe(0);
  });
});

describe('bountyState', () => {
  it('is offered when the level is met and nothing is in hand', () => {
    expect(bountyState(bounty('rat-cull'), board())).toBe('offered');
  });

  it('is gated below the level it is posted at', () => {
    expect(bountyState(bounty('smith-order'), board({ level: 3 }))).toBe('gated');
  });

  it('is taken, then ready, as the one in hand fills up', () => {
    const held = { bountyId: 'rat-cull' as const, baseline: 0 };

    expect(bountyState(bounty('rat-cull'), board({ bounty: held, kills: { rat: 3 } }))).toBe(
      'taken',
    );
    expect(bountyState(bounty('rat-cull'), board({ bounty: held, kills: { rat: 15 } }))).toBe(
      'ready',
    );
  });

  /**
   * The one-at-a-time rule, seen from every other row. It is a rule rather than
   * a limitation: five contracts taken together are five contracts one afternoon
   * of rats finishes together, which is one decision paid five times.
   */
  it('is busy on every other row while a contract is in hand', () => {
    const context = board({ bounty: { bountyId: 'rat-cull', baseline: 0 } });

    expect(bountyState(bounty('timber-order'), context)).toBe('busy');
    expect(canAcceptBounty(bounty('timber-order'), context)).toBe(false);
  });

  // A gated row stays gated rather than becoming busy: what it is waiting on is
  // the more useful of the two things to be told, and the level outlives the
  // contract in hand.
  it('keeps saying the level on a row that is gated as well as blocked', () => {
    expect(
      bountyState(bounty('smith-order'), board({ bounty: { bountyId: 'rat-cull', baseline: 0 } })),
    ).toBe('gated');
  });

  it('only lets the finished one be handed in', () => {
    const held = { bountyId: 'timber-order' as const, baseline: 0 };

    expect(
      canTurnInBounty(bounty('timber-order'), board({ bounty: held, inventory: { logs: 14 } })),
    ).toBe(false);
    expect(
      canTurnInBounty(bounty('timber-order'), board({ bounty: held, inventory: { logs: 15 } })),
    ).toBe(true);
    // And never one that is not the contract in hand, however full the bag is.
    expect(canTurnInBounty(bounty('rat-cull'), board({ kills: { rat: 900 } }))).toBe(false);
  });
});

describe('bountyOffers', () => {
  it('draws a gated row rather than hiding it', () => {
    const posted = bountyOffers('quartermaster', board({ level: 1 }));

    expect(posted).toHaveLength(BOUNTY_ORDER.length);
    expect(posted.filter((offer) => offer.state === 'gated').length).toBeGreaterThan(0);
    expect(
      posted.every((offer) => (offer.state === 'gated') === (offer.requirement !== null)),
    ).toBe(true);
  });

  it('lists nothing for somebody who posts nothing', () => {
    expect(bountyOffers('shopkeeper', board())).toEqual([]);
  });
});

describe('bountyMarker', () => {
  it('says there is work to take when the board has any', () => {
    expect(bountyMarker('quartermaster', board())).toBe('available');
  });

  it('says the contract is ready once it is', () => {
    expect(
      bountyMarker(
        'quartermaster',
        board({ bounty: { bountyId: 'rat-cull', baseline: 0 }, kills: { rat: 15 } }),
      ),
    ).toBe('ready');
  });

  it('says a contract is being worked while it is', () => {
    expect(
      bountyMarker('quartermaster', board({ bounty: { bountyId: 'rat-cull', baseline: 0 } })),
    ).toBe('active');
  });

  it('leaves a head bare for somebody who posts nothing', () => {
    expect(bountyMarker('banker', board())).toBeNull();
  });
});

/**
 * The tuning contract, and the reason the board is thirteenth in
 * `docs/archive/systems_plan.md` rather than third.
 *
 * Every bounty *mints currency*, which is the one thing in this game that has
 * no natural ceiling — a kill is gated by a respawn and a gather by a regrow,
 * but a faucet is gated by nothing except what it pays. These four rules are
 * what keep it a bonus on work already being done rather than the reason to do
 * the work, and they are held here because the table is hand-written.
 */
describe('what the board is allowed to pay', () => {
  const contracts = BOUNTY_ORDER.map((id) => BOUNTIES[id]);

  /** Every level a creature actually spawns at, anywhere in the world. */
  function spawnLevels(enemyId: EnemyId): number[] {
    return Object.values(ZONES)
      .flatMap((zone) => zone.mobSpawns)
      .filter((spawn) => spawn.enemyId === enemyId)
      .map((spawn) => spawn.level);
  }

  /** What the kills a contract asks for already pay, at the thinnest end. */
  function killXp(enemyId: EnemyId, quantity: number): number {
    const levels = spawnLevels(enemyId);
    const worst = Math.min(...levels);
    return scaleEnemyStats(ENEMIES[enemyId], worst).xpReward * quantity;
  }

  /** What the shopkeeper charges for one, or null for something not stocked. */
  function shelfPrice(itemId: ItemId): number | null {
    return SHOP_STOCK.find((entry) => entry.itemId === itemId)?.price ?? null;
  }

  it('asks only for creatures the world actually spawns', () => {
    for (const contract of contracts) {
      if (contract.objective.kind !== 'kill') continue;
      expect(spawnLevels(contract.objective.enemyId).length, contract.id).toBeGreaterThan(0);
    }
  });

  /**
   * A kill contract is a bonus on a grind somebody was already making, so it
   * has to pay less than that grind does — otherwise the board, and not the
   * fight, is where the XP is, and the right way to play becomes walking back
   * to town more often.
   */
  it('pays less XP than the kills it asks for already pay', () => {
    for (const contract of contracts) {
      if (contract.objective.kind !== 'kill') continue;
      const { enemyId, quantity } = contract.objective;
      expect(contract.reward.xp, contract.id).toBeLessThan(killXp(enemyId, quantity));
    }
  });

  /**
   * The other half of that, and the one that is easy to get backwards: a
   * contract nobody would take over walking six steps to the shopkeeper is a row
   * that may as well not be drawn.
   */
  it('pays a gather contract more than vendoring the same haul would', () => {
    for (const contract of contracts) {
      if (contract.objective.kind !== 'collect') continue;
      const { itemId, quantity } = contract.objective;
      const vendored = (itemValue(itemId) ?? 0) * quantity;
      expect(vendored, `${contract.id} asks for something with no value`).toBeGreaterThan(0);
      expect(contract.reward.copper, contract.id).toBeGreaterThan(vendored);
    }
  });

  /**
   * And the one that is not obvious at all. The shop *sells* logs, so a timber
   * order paying more per log than the shelf charges is coin printed by walking
   * between two people standing forty feet apart — an infinite faucet with no
   * work in it whatsoever. The spread that stops it is the same vendor spread
   * `SHOP_STOCK` was already built around.
   */
  it('never pays more per item than the shopkeeper charges for the same thing', () => {
    for (const contract of contracts) {
      if (contract.objective.kind !== 'collect') continue;
      const { itemId, quantity } = contract.objective;
      const price = shelfPrice(itemId);
      if (price === null) continue;
      expect(contract.reward.copper / quantity, `${contract.id} undercuts the shelf`).toBeLessThan(
        price,
      );
    }
  });

  /**
   * A contract has to be finishable by somebody the level lets take it. What a
   * gather asks for is only reachable through a node or a recipe, and both carry
   * their own gates — so the deepest ask on the board must not be posted before
   * the work behind it is possible at all.
   */
  it('asks for nothing the game does not produce', () => {
    for (const contract of contracts) {
      if (contract.objective.kind !== 'collect') continue;
      const { itemId } = contract.objective;
      const gathered = Object.values(RESOURCE_NODES).some((node) => node.yieldItemId === itemId);
      const made = Object.values(RECIPES).some((recipe) => recipe.outputItemId === itemId);
      expect(gathered || made, `${contract.id} asks for ${itemId}`).toBe(true);
    }
  });

  it('posts nothing past the level anyone can reach', () => {
    for (const contract of contracts) {
      expect(contract.requiredLevel ?? 1, contract.id).toBeLessThanOrEqual(MAX_CHARACTER_LEVEL);
    }
  });

  // A board whose every row is posted at once is a board with nothing to come
  // back for, which is the phase this PR is in.
  it('holds some of itself back for later levels', () => {
    const open = contracts.filter((contract) => contract.requiredLevel === undefined);
    expect(open.length).toBeGreaterThan(0);
    expect(open.length).toBeLessThan(contracts.length);
  });

  /**
   * The gap the upper band's four closed: the board topped out at the mill
   * road, so from level 5 on it posted nothing that was not starter work. A
   * character near the cap should still find something up there worth taking.
   */
  it('keeps posting work into the top of the band', () => {
    const highest = Math.max(...contracts.map((contract) => contract.requiredLevel ?? 1));
    expect(highest).toBeGreaterThanOrEqual(MAX_CHARACTER_LEVEL - 2);
  });

  it('is a complete table with no id spelled two ways', () => {
    expect(new Set(BOUNTY_ORDER).size).toBe(BOUNTY_ORDER.length);
    expect(new Set(BOUNTY_ORDER)).toEqual(new Set(Object.keys(BOUNTIES)));
    for (const [id, contract] of Object.entries(BOUNTIES)) {
      expect(contract.id).toBe(id);
    }
  });
});
