import { describe, expect, it } from 'vitest';
import { drawnHeight } from '../../src/art/compile';
import { SPRITES } from '../../src/art/index';
import { TILE_SIZE } from '../../src/config/constants';
import { doorPoint, occupant } from '../../src/data/buildings';
import { ZONES } from '../../src/data/zones';
import { BuildingSprite } from '../../src/render2d/buildings';
import {
  MIN_PICK_SPAN,
  pickScene,
  pickTap,
  standingRect,
  type PickScene2D,
} from '../../src/render2d/picking';
import { LOOT_PILE_LIFETIME_MS } from '../../src/systems/LootSystem';
import { LootPile } from '../../src/world/LootPile';
import { SPIRIT_HEIGHT } from '../../src/world/Spirit';
import { nth } from '../nth';
import { harness } from '../world/harness';
import type { CharacterController } from '../../src/systems/CharacterController';
import type { Point } from '../../src/systems/MovementSystem';
import type { ZoneId } from '../../src/types/ids';
import type { Mob } from '../../src/world/Mob';
import type { ZoneWorld } from '../../src/world/ZoneWorld';

const HEIGHTS = new Map(SPRITES.map((def) => [def.id, drawnHeight(def)]));
const heightOf = (id: string): number => HEIGHTS.get(id) ?? 0;

/** A building with no pixels behind it: the unit suite only asks what a tap on it means. */
function buildingsOf(world: ZoneWorld): BuildingSprite[] {
  return world.buildings.map(
    (building) => new BuildingSprite(building, occupant(building, world.npcs), () => null),
  );
}

function tapIn(world: ZoneWorld, point: Point, buildings = buildingsOf(world)) {
  buildings.forEach((building) => building.sync(world.player));
  return pickTap(point, pickScene(world, heightOf, buildings));
}

/**
 * A pile where `mob` fell, left the way the game leaves one: killed with a pack
 * too full to take what it dropped (the harness's dice loaded so it drops).
 */
function pileUnder(world: ZoneWorld, character: CharacterController, mob: Mob): LootPile {
  character.addItem('crab-meat', Math.floor(character.carryCapacity() - character.carriedWeight()));
  mob.takeDamage(mob.maxHp);
  world.resolveKill(mob);
  return nth(world.lootPiles);
}

describe('standingRect', () => {
  it('stands up the screen from the feet, a little below them, and no smaller than a thumb', () => {
    const rect = standingRect(100, 200, 10, 10);
    expect(rect.right - rect.left).toBe(MIN_PICK_SPAN);
    expect(rect.bottom).toBeGreaterThan(200);
    expect(rect.top).toBeLessThanOrEqual(200 - MIN_PICK_SPAN);
  });
});

describe('pickTap in 2D', () => {
  it('answers with the ground wherever nothing stands', () => {
    const { world } = harness({ zoneId: 'beach' });
    const point = { x: 30, y: 30 };
    expect(tapIn(world, point)).toEqual({ kind: 'ground', point });
  });

  it('selects the mob tapped at its feet and at its middle', () => {
    const { world } = harness();
    const rat = world.mobs[0] as Mob;
    expect(tapIn(world, { x: rat.x, y: rat.y })).toMatchObject({ kind: 'mob', mob: rat });
    expect(tapIn(world, { x: rat.x, y: rat.y - 20 })).toMatchObject({ kind: 'mob', mob: rat });
  });

  it('hands a tap on a corpse to the ground', () => {
    const { world } = harness();
    const rat = world.mobs[0] as Mob;
    rat.takeDamage(rat.hp);
    expect(tapIn(world, { x: rat.x, y: rat.y }).kind).toBe('ground');
  });

  it('prefers a person to a creature, whichever is in front', () => {
    const { world } = harness();
    const npc = world.npcs[0];
    const rat = world.mobs[0] as Mob;
    if (!npc) throw new Error('town has nobody in it');
    rat.setPosition(npc.x, npc.y + 10);
    expect(tapIn(world, { x: npc.x, y: npc.y })).toMatchObject({ kind: 'npc', npc });
  });

  it('picks the one drawn in front of two creatures standing on each other', () => {
    const { world } = harness();
    const [back, front] = world.mobs as [Mob, Mob];
    back.setPosition(600, 600);
    front.setPosition(610, 620);
    expect(tapIn(world, { x: 605, y: 605 })).toMatchObject({ kind: 'mob', mob: front });
  });

  it('answers a tap on a shopfront with whoever works there, and on a cottage with its door', () => {
    const { world } = harness();
    const store = world.buildings.find(({ definition }) => definition.id === 'general-store');
    const cottage = world.buildings.find(({ definition }) => definition.id === 'cottage');
    if (!store || !cottage) throw new Error('town has no shop or no cottage');
    world.teleport(world.spawnPoint.x, world.spawnPoint.y + TILE_SIZE * 3);
    expect(tapIn(world, { x: store.x, y: store.y - TILE_SIZE })).toMatchObject({
      kind: 'npc',
      npc: occupant(store, world.npcs),
    });
    expect(tapIn(world, { x: cottage.x, y: cottage.y })).toEqual({
      kind: 'ground',
      point: doorPoint(cottage),
    });
  });

  it('stops swallowing taps once the player is in the room', () => {
    const { world } = harness();
    const cottage = world.buildings.find(({ definition }) => definition.id === 'cottage');
    if (!cottage) throw new Error('town has no cottage');
    world.teleport(cottage.x, cottage.y);
    const point = { x: cottage.x + 10, y: cottage.y - 10 };
    expect(tapIn(world, point)).toEqual({ kind: 'ground', point });
  });

  /**
   * A node is picked by its body: a tree up its trunk and the lower half of
   * its crown, not the whole crown, and a fishing spot as the patch of water it
   * is, on either side of the spot.
   */
  it('picks a tree by its body and a fishing spot lying flat round it', () => {
    const { world } = harness();
    const tree = world.nodes.find((node) => node.definition.shape === 'tree');
    const pool = world.nodes.find((node) => node.definition.shape === 'ripple');
    if (!tree || !pool) throw new Error('town has a tree and a fishing spot');
    const body = tree.definition.body.height;
    expect(tapIn(world, { x: tree.x, y: tree.y - body + 4 })).toMatchObject({ node: tree });
    expect(tapIn(world, { x: tree.x, y: tree.y - body - 8 }).kind).not.toBe('node');
    expect(tapIn(world, { x: pool.x, y: pool.y - 20 })).toMatchObject({ node: pool });
    expect(tapIn(world, { x: pool.x, y: pool.y + 20 })).toMatchObject({ node: pool });
  });

  it('leaves a zone from a tap on its signpost', () => {
    const { world } = harness();
    const signpost = world.signposts[0];
    if (!signpost) throw new Error('town has no signposts');
    expect(tapIn(world, { x: signpost.x, y: signpost.y - 10 })).toMatchObject({
      kind: 'signpost',
      signpost,
    });
  });

  /**
   * The order is a priority rather than a depth sort, which is the whole reason
   * each kind is asked separately: a rat wandering in front of the shopkeeper
   * does not stop you shopping. One box on one spot, offered by every kind, so
   * that only the order can decide.
   */
  it('asks node, signpost, NPC, mob, spirit, station, fixture, building, pile, then ground', () => {
    const { world } = harness();
    const spot = { x: 700, y: 700 };
    const door = { x: 0, y: 0 };
    const standing = { baseY: spot.y, pickRect: () => standingRect(spot.x, spot.y, 64, 64) };
    const full: PickScene2D = {
      nodes: [{ ...standing, node: nth(world.nodes) }],
      signposts: [{ ...standing, signpost: nth(world.signposts) }],
      npcs: [{ ...standing, npc: nth(world.npcs) }],
      mobs: [{ ...standing, mob: nth(world.mobs) }],
      spirit: standing,
      stations: [{ ...standing, station: nth(world.stations) }],
      fixtures: [{ ...standing, fixture: nth(world.fixtures) }],
      buildings: [
        {
          ...standing,
          building: nth(world.buildings),
          tapAnswer: () => ({ kind: 'ground', point: door }),
        },
      ],
      piles: [{ ...standing, pile: new LootPile(spot, [{ itemId: 'rat-bones', quantity: 1 }]) }],
    };
    const order = [
      'nodes',
      'signposts',
      'npcs',
      'mobs',
      'spirit',
      'stations',
      'fixtures',
      'buildings',
      'piles',
    ] as const;
    const answered = order.map((_, taken) => {
      const scene = { ...full };
      order.slice(0, taken).forEach((kind) => {
        if (kind === 'spirit') scene.spirit = { baseY: 0, pickRect: () => null };
        else scene[kind] = [];
      });
      const tapped = pickTap(spot, scene);
      return tapped.kind === 'ground' && tapped.point === door ? 'building' : tapped.kind;
    });
    expect(answered).toEqual([
      'node',
      'signpost',
      'npc',
      'mob',
      'spirit',
      'station',
      'fixture',
      'building',
      'pile',
    ]);
  });

  it('takes from a loot pile tapped where it lies, and hands a lapsed one to the ground', () => {
    const { world, character } = harness({ rolls: () => 0 });
    const pile = pileUnder(world, character, nth(world.mobs));
    expect(tapIn(world, { x: pile.x, y: pile.y })).toEqual({ kind: 'pile', pile });

    // The corpse's twin: a pile that has lapsed offers no box in the frame
    // before the view stops drawing its sack.
    pile.update(LOOT_PILE_LIFETIME_MS);
    expect(tapIn(world, { x: pile.x, y: pile.y }).kind).toBe('ground');
  });

  // Below everything but the ground: a pile lies wherever something died, which
  // is wherever the next one is standing.
  it('gives a tap on a pile to the creature standing over it', () => {
    const { world, character } = harness({ rolls: () => 0 });
    const pile = pileUnder(world, character, nth(world.mobs, 0));
    const rat = nth(world.mobs, 1);
    rat.setPosition(pile.x, pile.y);
    expect(tapIn(world, { x: pile.x, y: pile.y })).toMatchObject({ kind: 'mob', mob: rat });
  });

  /**
   * Into a building on the second tap, from its own doorstep, which is the only
   * way there is onto a floor: from outside the roof is drawn over the room and
   * every point on it is the building's, so without a second meaning for the
   * same tap a room would be reachable by keyboard alone.
   */
  it('walks into a building on a second tap, from its own doorstep, shop or not', () => {
    const { world } = harness();
    for (const building of buildingsOf(world)) {
      const { x, y } = building.building;
      building.sync(doorPoint(building.building));
      expect(building.tapAnswer(), building.building.definition.id).toEqual({
        kind: 'ground',
        point: { x, y },
      });
    }
  });

  // On the doorstep, the one spot where a creature and the front it stands
  // before are drawn over each other: the case a depth sort gets wrong.
  it('lets a rat on a shopfront doorstep still be attacked', () => {
    const { world } = harness();
    const store = world.buildings.find(({ definition }) => definition.id === 'general-store');
    if (!store) throw new Error('town has no general store');
    const rat = world.mobs[0] as Mob;
    const door = doorPoint(store);
    rat.setPosition(door.x, door.y);
    world.teleport(door.x, door.y + TILE_SIZE * 3);
    // High on the rat, where it is drawn over the shopfront's wall.
    const aim = { x: rat.x, y: rat.y - TILE_SIZE * 0.6 };
    const front = new BuildingSprite(store, null, () => null).outsideRect();
    expect(aim.y).toBeLessThan(front.bottom);
    expect(tapIn(world, aim)).toMatchObject({ kind: 'mob', mob: rat });
  });
});

/**
 * Every creature, everywhere its wander can take it, can be tapped from where a
 * player stands to fight it, with every counter, station and shopfront in the
 * scene. A kind ranked above the mobs wins wherever its box is, so one box
 * drawn too big eats every tap on the rat standing in it. The forge in town was
 * moved for exactly that, and this is what holds it now, over every zone and
 * every spawn at once.
 */
/**
 * Wick (D4): picked by a box round the light where it floats, at the player's
 * shoulder, rather than standing on the ground under it. In every zone, from
 * where a character starts, the light answers as the spirit and the player's
 * own feet do not, and a creature come up to that shoulder is still the
 * creature.
 */
describe('Wick in 2D', () => {
  const light = (world: ZoneWorld): Point => ({
    x: world.spirit.x,
    y: world.spirit.y - SPIRIT_HEIGHT,
  });

  it.each(Object.keys(ZONES) as ZoneId[])('is tapped where it floats in %s', (zoneId) => {
    const { world } = harness({ zoneId });
    world.update(16);
    expect(tapIn(world, light(world))).toEqual({ kind: 'spirit' });
    expect(tapIn(world, { x: world.player.x, y: world.player.y }).kind).not.toBe('spirit');
  });

  it('gives a tap at the shoulder to a creature standing there', () => {
    const { world } = harness();
    const rat = nth(world.mobs);
    const at = light(world);
    rat.setPosition(at.x, at.y + TILE_SIZE / 4);
    expect(tapIn(world, at)).toMatchObject({ kind: 'mob', mob: rat });
  });
});

describe('the approach to a creature in 2D', () => {
  function reachableSpots(mob: Mob): Point[] {
    const { radius } = mob.definition.wander;
    const spots: Point[] = [{ x: mob.spawnX, y: mob.spawnY }];
    for (let step = 0; step < 8; step += 1) {
      const angle = (step / 8) * Math.PI * 2;
      for (const out of [radius / 2, radius]) {
        spots.push({
          x: mob.spawnX + Math.cos(angle) * out,
          y: mob.spawnY + Math.sin(angle) * out,
        });
      }
    }
    return spots;
  }

  it.each(Object.keys(ZONES) as ZoneId[])(
    'is clear of every counter and station in %s',
    (zoneId) => {
      const { world } = harness({ zoneId });
      const buildings = buildingsOf(world);
      const swallowed: string[] = [];
      for (const mob of world.mobs) {
        for (const spot of reachableSpots(mob)) {
          mob.setPosition(spot.x, spot.y);
          for (const back of [80, 150]) {
            world.player.setPosition(mob.x, mob.y + back);
            // Counters, stations and shopfronts: a node or a signpost ranks above
            // a creature by design, and stands at a map's edges.
            buildings.forEach((building) => building.sync(world.player));
            const tapped = pickTap(
              { x: spot.x, y: spot.y - 10 },
              { ...pickScene(world, heightOf, buildings), nodes: [], signposts: [] },
            );
            if (tapped.kind === 'mob') continue;
            swallowed.push(
              `the ${mob.definition.name} at ${Math.round(spot.x)},${Math.round(spot.y)} by ${tapped.kind}`,
            );
          }
        }
        mob.setPosition(mob.spawnX, mob.spawnY);
      }
      expect(swallowed, `taps ${zoneId} swallows`).toEqual([]);
    },
  );
});
