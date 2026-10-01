import { beforeEach, describe, expect, it } from 'vitest';
import { harness } from './harness';
import { PLAYER_HALF_EXTENT } from '../../src/config/constants';
import { BUILDINGS, doorPoint, interiorRect, isInside, type Rect } from '../../src/data/buildings';
import { ENEMIES } from '../../src/data/enemies';
import {
  CHEST_SLOTS,
  FIXTURE_REACH,
  HOUSE_BUILDING,
  HOUSE_FIXTURES,
  HOUSE_STANDS,
  fixtureKey,
} from '../../src/data/house';
import { ITEMS } from '../../src/data/items';
import { LOOT_TABLES } from '../../src/data/lootTables';
import { QUESTS, QUEST_ORDER } from '../../src/data/quests';
import { SHOP_STOCK } from '../../src/data/shop';
import { ZONES } from '../../src/data/zones';
import { fittingRects } from '../../src/art/rooms';
import {
  HOUSE_QUEST,
  allTrophies,
  emptyHouse,
  isTrophy,
  ownsHouse,
  plaques,
} from '../../src/systems/HouseSystem';
import { itemUses } from '../../src/systems/ItemUseSystem';
import { findPath, standNear } from '../../src/systems/PathSystem';
import { withinRadius } from '../../src/systems/MovementSystem';
import { HOUSE_CLOSED_EVENT, HOUSE_OPENED_EVENT, NOTICE_EVENT } from '../../src/ui/uiEvents';
import type { ItemId } from '../../src/types/ids';
import type { WorldFixture } from '../../src/world/ZoneWorld';

/**
 * The house in Lampton (F1): whose it is, what may stand on a stand, the chest,
 * the wall, and the walk up to each of them. The fixtures are data
 * (`data/house.ts`) the simulation walks to and the view draws, so where they
 * stand is held here the way `tests/art/rooms.test.ts` holds a room's
 * furniture.
 */

beforeEach(() => {
  localStorage.clear();
});

type Kit = ReturnType<typeof harness>;

function fixtureNamed(kit: Kit, key: string): WorldFixture {
  const fixture = kit.world.fixtures.find((each) => fixtureKey(each.fixture) === key);
  if (!fixture) throw new Error(`the house has no ${key}`);
  return fixture;
}

/** Lets the house to the character, the way handing its quest in does. */
function letHouse(kit: Kit): void {
  kit.state.quests = { ...kit.state.quests, [HOUSE_QUEST]: { status: 'done', baseline: 0 } };
}

/** Stands the player in the middle of the house's room. */
function standInside(kit: Kit): void {
  const house = fixtureNamed(kit, 'chest').house;
  kit.world.teleport(house.x, house.y);
}

/** Walks up to a fixture from wherever the player is, and uses it on arrival. */
function walkTo(kit: Kit, key: string): WorldFixture {
  const fixture = fixtureNamed(kit, key);
  kit.world.tap({ kind: 'fixture', fixture });
  kit.until(() => !kit.world.player.hasMoveTarget(), `the walk to the ${key}`);
  return fixture;
}

const opened = (kit: Kit): string[] =>
  kit
    .emissions(HOUSE_OPENED_EVENT)
    .map(([fixture]) => fixtureKey(fixture as WorldFixture['fixture']));
const notices = (kit: Kit): string[] => kit.emissions(NOTICE_EVENT).map(([line]) => String(line));

describe('whose the house is', () => {
  it('is let by the quartermaster, after the starter arc, for timber', () => {
    const quest = QUESTS[HOUSE_QUEST];
    expect(quest.giverNpcId).toBe('quartermaster');
    expect(quest.requires).toEqual(['the-cutthroat']);
    expect(quest.objective).toEqual({ kind: 'collect', itemId: 'logs', quantity: 20 });
    expect(QUEST_ORDER.filter((questId) => QUESTS[questId].reward.house)).toEqual([HOUSE_QUEST]);
  });

  it('is nobody but the Company’s until the quest is handed in, and the player’s after', () => {
    const kit = harness();
    expect(ownsHouse(kit.state.quests)).toBe(false);
    kit.state.quests = {
      'the-cutthroat': { status: 'done', baseline: 0 },
      [HOUSE_QUEST]: { status: 'active', baseline: 0 },
    };
    kit.state.inventory = { logs: 20 };
    const result = kit.character.turnInQuest(HOUSE_QUEST);
    expect(result.ok).toBe(true);
    expect(ownsHouse(kit.state.quests)).toBe(true);
    expect(kit.state.inventory.logs ?? 0).toBe(0);
  });

  it('says so when the quest is handed in at the quartermaster', () => {
    const kit = harness();
    const quartermaster = kit.world.npcs.find((npc) => npc.npcId === 'quartermaster');
    if (!quartermaster) throw new Error('town has no quartermaster');
    kit.state.quests = {
      'the-cutthroat': { status: 'done', baseline: 0 },
      [HOUSE_QUEST]: { status: 'active', baseline: 0 },
    };
    kit.state.inventory = { logs: 20 };
    kit.world.teleport(quartermaster.x, quartermaster.y + 50);
    kit.world.approachNpc(quartermaster);
    kit.bus.emit('turn-in-quest-requested', HOUSE_QUEST);
    expect(notices(kit)).toContain(`${BUILDINGS[HOUSE_BUILDING].name} is yours.`);
  });

  it('turns a tap on a stand away while the house is not theirs, and opens nothing', () => {
    const kit = harness();
    standInside(kit);
    walkTo(kit, 'stand-0');
    expect(opened(kit)).toEqual([]);
    expect(notices(kit).at(-1)).toContain('until the quartermaster lets it to you');
  });
});

describe('a stand', () => {
  it('opens bare, and sets a trophy from the bag on it', () => {
    const kit = harness();
    letHouse(kit);
    kit.state.inventory = { 'barrow-crown': 1, logs: 4 };
    standInside(kit);
    walkTo(kit, 'stand-0');
    expect(opened(kit)).toEqual(['stand-0']);

    kit.bus.emit('display-trophy-requested', 'barrow-crown');
    expect(kit.state.house.stands[0]).toBe('barrow-crown');
    expect(kit.state.inventory['barrow-crown'] ?? 0).toBe(0);
    // There is nothing more to choose on a stand that holds something.
    expect(kit.emissions(HOUSE_CLOSED_EVENT).length).toBeGreaterThan(0);
  });

  it('takes nothing that is not a trophy', () => {
    const kit = harness();
    letHouse(kit);
    kit.state.inventory = { logs: 4 };
    standInside(kit);
    walkTo(kit, 'stand-1');
    kit.bus.emit('display-trophy-requested', 'logs');
    expect(kit.state.house.stands[1]).toBeNull();
    expect(kit.state.inventory.logs).toBe(4);
  });

  it('hands its trophy back on a tap, since displaying is not spending', () => {
    const kit = harness();
    letHouse(kit);
    kit.state.house = { ...emptyHouse(), stands: ['pells-cart-bell', null, null, null] };
    standInside(kit);
    walkTo(kit, 'stand-0');
    expect(opened(kit)).toEqual([]);
    expect(kit.state.house.stands[0]).toBeNull();
    expect(kit.state.inventory['pells-cart-bell']).toBe(1);
  });

  it('keeps its trophy standing when the pack has no room for it', () => {
    const kit = harness();
    letHouse(kit);
    kit.state.house = { ...emptyHouse(), stands: ['barrow-crown', null, null, null] };
    kit.state.inventory = { 'iron-ore': 999 };
    standInside(kit);
    walkTo(kit, 'stand-0');
    expect(kit.state.house.stands[0]).toBe('barrow-crown');
    expect(kit.state.inventory['barrow-crown'] ?? 0).toBe(0);
  });
});

describe('the chest', () => {
  it('holds what the bag puts in it and hands it back, weighing nothing', () => {
    const kit = harness();
    letHouse(kit);
    kit.state.inventory = { logs: 6 };
    standInside(kit);
    walkTo(kit, 'chest');
    expect(opened(kit)).toEqual(['chest']);

    kit.bus.emit('chest-deposit-requested', 'logs', 6);
    expect(kit.state.house.chest.logs).toBe(6);
    expect(kit.state.inventory.logs ?? 0).toBe(0);

    kit.bus.emit('chest-withdraw-requested', 'logs', 2);
    expect(kit.state.house.chest.logs).toBe(4);
    expect(kit.state.inventory.logs).toBe(2);
  });

  it(`holds ${CHEST_SLOTS} kinds of thing and no more, however many of each`, () => {
    const kit = harness();
    letHouse(kit);
    const kinds = (Object.keys(ITEMS) as ItemId[])
      .filter((id) => ITEMS[id].kind === 'material')
      .slice(0, CHEST_SLOTS + 1);
    kit.state.inventory = Object.fromEntries(kinds.map((id) => [id, 1]));
    standInside(kit);
    walkTo(kit, 'chest');
    kinds.forEach((id) => kit.bus.emit('chest-deposit-requested', id, 1));
    expect(Object.keys(kit.state.house.chest)).toHaveLength(CHEST_SLOTS);
    const last = kinds.at(-1) as ItemId;
    expect(kit.state.inventory[last]).toBe(1);
    expect(notices(kit).at(-1)).toContain('no room');
  });
});

describe('what is open in the house', () => {
  it('shuts when the player walks out of the house', () => {
    const kit = harness();
    letHouse(kit);
    standInside(kit);
    walkTo(kit, 'chest');
    const house = fixtureNamed(kit, 'chest').house;
    const door = doorPoint(house);
    kit.world.teleport(door.x, door.y + 64);
    kit.tick(1);
    expect(kit.emissions(HOUSE_CLOSED_EVENT).length).toBeGreaterThan(0);
  });

  it('shuts when a counter opens, since one thing is served at a time', () => {
    const kit = harness();
    letHouse(kit);
    standInside(kit);
    walkTo(kit, 'wall');
    expect(opened(kit)).toEqual(['wall']);
    const banker = kit.world.npcs.find((npc) => npc.npcId === 'banker');
    if (!banker) throw new Error('town has no banker');
    kit.world.teleport(banker.x, banker.y + 50);
    kit.world.approachNpc(banker, 'banker');
    expect(kit.emissions(HOUSE_CLOSED_EVENT).length).toBeGreaterThan(0);
  });
});

describe('the trophies', () => {
  it('are every boss drop and every keepsake, and nothing the shelf sells', () => {
    const bossDrops = Object.values(ENEMIES)
      .filter((enemy) => enemy.boss && enemy.lootTableId)
      .flatMap((enemy) => LOOT_TABLES[enemy.lootTableId as keyof typeof LOOT_TABLES].entries)
      .map((entry) => entry.itemId);
    const keepsakes = (Object.keys(ITEMS) as ItemId[]).filter(
      (id) => ITEMS[id].kind === 'keepsake',
    );
    expect(new Set(allTrophies())).toEqual(new Set([...bossDrops, ...keepsakes]));
    SHOP_STOCK.forEach((entry) => expect(isTrophy(entry.itemId), entry.itemId).toBe(false));
  });

  it('gives every keepsake one quest to hand it over, no price, and a stand to go on', () => {
    const keepsakes = (Object.keys(ITEMS) as ItemId[]).filter(
      (id) => ITEMS[id].kind === 'keepsake',
    );
    expect(keepsakes.length).toBeGreaterThan(0);
    keepsakes.forEach((id) => {
      const from = QUEST_ORDER.filter((questId) => QUESTS[questId].reward.keepsake === id);
      expect(from, id).toHaveLength(1);
      expect(ITEMS[id].value, id).toBeUndefined();
      expect(
        itemUses(id).some((line) => line.startsWith('Display at home')),
        id,
      ).toBe(true);
    });
  });

  it("are handed over at a chain's end, and refused whole when the pack is full", () => {
    const kit = harness();
    kit.state.quests = { 'the-cutthroat': { status: 'active', baseline: 0 } };
    kit.state.kills = { 'bandit-chief': 1 };
    kit.state.inventory = { 'iron-ore': 999 };
    expect(kit.character.turnInQuest('the-cutthroat').ok).toBe(false);
    kit.state.inventory = {};
    const paid = kit.character.turnInQuest('the-cutthroat');
    expect(paid.ok && paid.keepsake).toBe('pells-cart-bell');
    expect(kit.state.inventory['pells-cart-bell']).toBe(1);
  });

  it('say where they go before the house is theirs, and after', () => {
    const before = itemUses('barrow-crown');
    const after = itemUses('barrow-crown', {
      quests: { [HOUSE_QUEST]: { status: 'done', baseline: 0 } },
    });
    expect(before.find((line) => line.startsWith('Display'))).toContain('once');
    expect(after.find((line) => line.startsWith('Display'))).toContain('on a stand in');
  });
});

describe('the wall', () => {
  it('hangs a plaque a creature, at the highest slayer rank earned against it', () => {
    expect(plaques({})).toEqual([]);
    expect(plaques({ rat: 24 })).toEqual([]);
    expect(plaques({ rat: 60, crab: 25 })).toEqual([
      { enemyId: 'rat', rank: 'hunter', name: 'Rat Hunter' },
      { enemyId: 'crab', rank: 'culler', name: 'Crab Culler' },
    ]);
    expect(plaques({ rat: 100 })[0]?.rank).toBe('slayer');
  });
});

describe('where the fixtures stand', () => {
  const house = { x: 0, y: 0, definition: BUILDINGS[HOUSE_BUILDING] };
  const room = interiorRect(house);
  const body = (at: { x: number; y: number }): Rect => ({
    left: at.x - PLAYER_HALF_EXTENT,
    right: at.x + PLAYER_HALF_EXTENT,
    top: at.y - PLAYER_HALF_EXTENT,
    bottom: at.y + PLAYER_HALF_EXTENT,
  });
  const overlaps = (a: Rect, b: Rect): boolean =>
    a.left < b.right - 0.01 &&
    a.right > b.left + 0.01 &&
    a.top < b.bottom - 0.01 &&
    a.bottom > b.top + 0.01;

  it('assumes a door to the south, which is the wall none of them stands against', () => {
    expect(house.definition.door).toBe('south');
  });

  it(`stands ${HOUSE_STANDS} stands, the chest and the wall, each inside the room`, () => {
    const kinds = HOUSE_FIXTURES.map((placement) => fixtureKey(placement.fixture));
    expect(kinds).toEqual([
      ...Array.from({ length: HOUSE_STANDS }, (_, stand) => `stand-${stand}`),
      'chest',
      'wall',
    ]);
    HOUSE_FIXTURES.forEach(({ fixture, rect }) => {
      const key = fixtureKey(fixture);
      expect(rect.left, key).toBeGreaterThanOrEqual(room.left);
      expect(rect.right, key).toBeLessThanOrEqual(room.right);
      expect(rect.top, key).toBeGreaterThanOrEqual(room.top);
      expect(rect.bottom, key).toBeLessThanOrEqual(room.bottom);
    });
  });

  /**
   * Nothing in a room blocks (decision 48), so this is all that keeps a stand
   * out of where the game stands somebody: the middle of the room, where the
   * second tap to go in lands, and the walk in from the doorstep. The wall's
   * ground is the strip under the plaques, which the chest and the two back
   * stands stand on, so it is left out of the one test about overlapping.
   */
  it('keeps the middle of the room and the way in clear, and stands nothing in anything else', () => {
    const door = body(doorPoint(house));
    const middle = body({ x: 0, y: 0 });
    const lane: Rect = {
      left: Math.min(door.left, middle.left),
      right: Math.max(door.right, middle.right),
      top: Math.min(door.top, middle.top),
      bottom: Math.max(door.bottom, middle.bottom),
    };
    const things = [
      ...HOUSE_FIXTURES.filter(({ fixture }) => fixture.kind !== 'wall').map(
        ({ fixture, rect }) => ({ what: fixtureKey(fixture), rect }),
      ),
      ...fittingRects(house.definition).map(({ kind, rect }) => ({ what: kind, rect })),
    ];
    things.forEach(({ what, rect }) => {
      expect(overlaps(rect, lane), `the ${what} is in the way in`).toBe(false);
      things.forEach((other) => {
        if (other === things.find((each) => each.what === what)) return;
        if (other.what === what) return;
        expect(overlaps(rect, other.rect), `the ${what} stands in the ${other.what}`).toBe(false);
      });
    });
  });

  it('lets every fixture be walked up to from where Lampton puts a player, and used there', () => {
    const kit = harness();
    letHouse(kit);
    const entities = kit.world;
    for (const fixture of kit.world.fixtures) {
      const key = fixtureKey(fixture.fixture);
      kit.world.teleport(ZONES.town.start.x, ZONES.town.start.y);
      const goal = standNear(
        entities.collisionWorld,
        kit.world.player,
        fixture.access,
        PLAYER_HALF_EXTENT,
      );
      const route = findPath(entities.collisionWorld, kit.world.player, goal, PLAYER_HALF_EXTENT);
      expect(route, `no way to the ${key}`).not.toBeNull();
      walkTo(kit, key);
      expect(isInside(fixture.house, kit.world.player), `${key}: walked to from outside`).toBe(
        true,
      );
      expect(withinRadius(kit.world.player, fixture, FIXTURE_REACH), `${key}: in reach`).toBe(true);
      kit.world.closeCounters();
    }
  });
});
