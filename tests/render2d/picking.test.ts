import { describe, expect, it } from 'vitest';
import { drawnHeight } from '../../src/art/compile';
import { SPRITES } from '../../src/art/index';
import { TILE_SIZE } from '../../src/config/constants';
import { doorPoint, occupant } from '../../src/data/buildings';
import { ZONES } from '../../src/data/zones';
import { BuildingSprite } from '../../src/render2d/buildings';
import { MIN_PICK_SPAN, pickScene, pickTap, standingRect } from '../../src/render2d/picking';
import { harness } from '../world/harness';
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
   * A node is picked by its body, as the 3D view picked it: a tree up its
   * trunk and the lower half of its crown, not the whole crown, and a fishing
   * spot as the patch of water it is, on either side of the spot.
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
});

/**
 * The 3D view's sweep (`tests/render3d/picking.test.ts`), asked of the flat
 * one: every creature, everywhere its wander can take it, can be tapped from
 * where a player stands to fight it, with every counter, station and shopfront
 * in the scene. A kind ranked above the mobs wins wherever its box is, so a
 * box drawn too big in 2D eats a rat the 3D view never lost.
 */
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
            // Counters, stations and shopfronts, as the 3D sweep has it: a node or a
            // signpost ranks above a creature by design, and stands at a map's edges.
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
