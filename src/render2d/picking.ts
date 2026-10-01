import { ART_PIXEL } from '../art/budget';
import { creatureSprite, npcSprite } from '../art/cast';
import { stationSprite } from '../art/places';
import { CHEST, STAND } from '../art/sprites/fittings';
import { TILE_SIZE } from '../config/constants';
import { isInside } from '../data/buildings';
import type { Point } from '../systems/MovementSystem';
import type { LootPile } from '../world/LootPile';
import type { Mob } from '../world/Mob';
import type { ResourceNode } from '../world/ResourceNode';
import { SPIRIT_HEIGHT } from '../world/Spirit';
import type {
  WorldBuilding,
  WorldFixture,
  WorldNpc,
  WorldSignpost,
  WorldStation,
  WorldTap,
  ZoneWorld,
} from '../world/ZoneWorld';

/**
 * What a tap is on (`docs/architecture/rendering.md` has why each rule is what
 * it is): a tap is picked against boxes the game chooses, not against the
 * pixels drawn, and the kinds are asked in a **priority** — node, signpost,
 * NPC, mob, station, fixture, spirit, building, loot pile, ground — rather than a depth
 * sort,
 * so a rat in front of the shopkeeper does not stop you shopping. A box is a
 * rectangle on the ground's plane, standing up the screen from where a thing's
 * feet are, and within one kind the one drawn in front wins.
 */

/**
 * The smallest a pick box may be either way: a crab is a thumb's width at
 * best, and the things being picked are tiles apart.
 */
export const MIN_PICK_SPAN = TILE_SIZE * 0.75;

/**
 * How far below its feet a thing can be tapped. A thumb aims at a figure's feet
 * as often as its middle, and `view.worldToScreen(x, y)` answers the feet.
 */
const BELOW_FEET = TILE_SIZE / 4;

/** Every drawn figure's tap target is at least a tile across, whatever its body. */
const FIGURE_FOOTPRINT = TILE_SIZE;

/** A box in simulation units, top-down: `top` is north. */
export interface PickRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The box of something standing at `(x, y)`, drawn `width` across and `height`
 * up the screen (both in simulation units), no smaller than a thumb.
 */
export function standingRect(x: number, y: number, width: number, height: number): PickRect {
  const half = Math.max(width, MIN_PICK_SPAN) / 2;
  return {
    left: x - half,
    right: x + half,
    top: y - Math.max(height, MIN_PICK_SPAN),
    bottom: y + BELOW_FEET,
  };
}

/**
 * The box of something lying flat at `(x, y)`, centred on it, no smaller than
 * a thumb: a fishing spot, which is a patch of water rather than a thing
 * standing on it.
 */
export function lyingRect(x: number, y: number, width: number, depth: number): PickRect {
  const halfWidth = Math.max(width, MIN_PICK_SPAN) / 2;
  const halfDepth = Math.max(depth, MIN_PICK_SPAN) / 2;
  return { left: x - halfWidth, right: x + halfWidth, top: y - halfDepth, bottom: y + halfDepth };
}

/** Something a tap can land on, and where its feet are for telling which is in front. */
export interface Pickable2D {
  /** The box a tap has to land in, or `null` while it cannot be picked at all. */
  pickRect(): PickRect | null;
  /** How far down the screen it stands: the one further down is drawn in front. */
  readonly baseY: number;
}

export interface PickScene2D {
  readonly nodes: readonly (Pickable2D & { readonly node: ResourceNode })[];
  readonly signposts: readonly (Pickable2D & { readonly signpost: WorldSignpost })[];
  readonly npcs: readonly (Pickable2D & { readonly npc: WorldNpc })[];
  readonly mobs: readonly (Pickable2D & { readonly mob: Mob })[];
  /** Wick, the one of its kind, under anything a fight or a counter is asked of. */
  readonly spirit: Pickable2D;
  readonly stations: readonly (Pickable2D & { readonly station: WorldStation })[];
  readonly fixtures: readonly (Pickable2D & { readonly fixture: WorldFixture })[];
  readonly buildings: readonly (Pickable2D & {
    readonly building: WorldBuilding;
    tapAnswer(): WorldTap;
  })[];
  readonly piles: readonly (Pickable2D & { readonly pile: LootPile })[];
}

function contains(rect: PickRect, point: Point): boolean {
  return (
    point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
  );
}

/** The one of these under the point that is drawn in front, if any is under it. */
function frontmost<T extends Pickable2D>(point: Point, candidates: readonly T[]): T | null {
  let front: T | null = null;
  for (const candidate of candidates) {
    const rect = candidate.pickRect();
    if (!rect || !contains(rect, point)) continue;
    if (!front || candidate.baseY > front.baseY) front = candidate;
  }
  return front;
}

/**
 * What a tap at a point in the world is on, in priority order. Every point is
 * ground at worst: a flat view has no sky to miss into.
 */
export function pickTap(point: Point, scene: PickScene2D): WorldTap {
  const node = frontmost(point, scene.nodes);
  if (node) return { kind: 'node', node: node.node };
  const signpost = frontmost(point, scene.signposts);
  if (signpost) return { kind: 'signpost', signpost: signpost.signpost };
  const npc = frontmost(point, scene.npcs);
  if (npc) return { kind: 'npc', npc: npc.npc };
  const mob = frontmost(point, scene.mobs);
  if (mob) return { kind: 'mob', mob: mob.mob };
  const station = frontmost(point, scene.stations);
  if (station) return { kind: 'station', station: station.station };
  // What stands in the house, from inside it only (F1): from outside the roof
  // is over all of it, and the building answers.
  const fixture = frontmost(point, scene.fixtures);
  if (fixture) return { kind: 'fixture', fixture: fixture.fixture };
  // Wick after what the player walks up to and before what a tap only walks
  // toward: it floats at the shoulder, over the stand or the station the
  // player is standing at, and what it has to say waits for a tap while they
  // do not; over a building's box it is still the light, since that tap would
  // only walk to a door (settled at wave 1's fold, between D4 and F1).
  if (frontmost(point, [scene.spirit])) return { kind: 'spirit' };
  // A building answers as whoever works in it, or the ground at its door: see
  // `docs/architecture/buildings.md`.
  const building = frontmost(point, scene.buildings);
  if (building) return building.tapAnswer();
  const pile = frontmost(point, scene.piles);
  if (pile) return { kind: 'pile', pile: pile.pile };
  return { kind: 'ground', point };
}

/**
 * Everything in a world a tap can land on, each as the box it is picked by: a
 * thing's own width or its body's, standing as tall as its sprite is drawn
 * (`heightOf`, in art pixels), and never smaller than a thumb. A node is the
 * exception, picked by its body: a tree a tile and a half tall rather than the
 * whole of its crown, so a creature behind the crown is still the creature,
 * and a fishing spot lying flat on the water. Wick is the other, picked by a
 * box round the light where it floats rather than one standing on the ground
 * under it, which would be the player's shoulder.
 */
export function pickScene(
  world: ZoneWorld,
  heightOf: (spriteId: string) => number,
  buildings: PickScene2D['buildings'],
): PickScene2D {
  const tall = (sprite: string): number => heightOf(sprite) * ART_PIXEL;
  return {
    nodes: world.nodes.map((node) => {
      const { width, height } = node.definition.body;
      const flat = node.definition.shape === 'ripple';
      return {
        node,
        baseY: node.y,
        pickRect: () =>
          flat
            ? lyingRect(node.x, node.y, width, height)
            : standingRect(node.x, node.y, width, height),
      };
    }),
    signposts: world.signposts.map((signpost) => ({
      signpost,
      baseY: signpost.y,
      // A tile every way, which is more than the post covers: on a phone this
      // is how a zone is left.
      pickRect: () => standingRect(signpost.x, signpost.y, TILE_SIZE, TILE_SIZE),
    })),
    npcs: world.npcs.map((npc) => ({
      npc,
      baseY: npc.y,
      pickRect: () => standingRect(npc.x, npc.y, FIGURE_FOOTPRINT, tall(npcSprite(npc.npcId))),
    })),
    mobs: world.mobs.map((mob) => ({
      mob,
      baseY: mob.y,
      // A corpse still falling is not a target.
      pickRect: () =>
        mob.isAlive()
          ? standingRect(
              mob.x,
              mob.y,
              mob.definition.body.width,
              tall(creatureSprite(mob.definition.id, mob.definition.shape)),
            )
          : null,
    })),
    spirit: {
      baseY: world.spirit.y,
      pickRect: () => {
        const { x, y } = world.spirit;
        return lyingRect(x, y - SPIRIT_HEIGHT, TILE_SIZE / 2, TILE_SIZE / 2);
      },
    },
    stations: world.stations.map((station) => ({
      station,
      baseY: station.y,
      pickRect: () =>
        standingRect(station.x, station.y, TILE_SIZE, tall(stationSprite(station.station))),
    })),
    fixtures: world.fixtures.map((fixture) => ({
      fixture,
      baseY: fixture.area.bottom,
      pickRect: () => (isInside(fixture.house, world.player) ? fixtureRect(fixture, tall) : null),
    })),
    buildings,
    piles: world.lootPiles.map((pile) => ({
      pile,
      baseY: pile.y,
      pickRect: () =>
        pile.isGone() ? null : standingRect(pile.x, pile.y, TILE_SIZE / 2, TILE_SIZE / 2),
    })),
  };
}

/**
 * A fixture in the house, as a thumb aims at it (F1): a stand as tall as a
 * trophy standing on it, the chest as it is drawn, and the wall as the face of
 * it the plaques hang on. The chest stands in front of the wall's foot, so
 * where the two boxes meet the chest is the one picked.
 */
function fixtureRect(fixture: WorldFixture, tall: (sprite: string) => number): PickRect {
  const { area } = fixture;
  const x = (area.left + area.right) / 2;
  switch (fixture.fixture.kind) {
    case 'stand':
      return standingRect(x, area.bottom, TILE_SIZE * 0.75, tall(STAND.id) + TILE_SIZE / 2);
    case 'chest':
      return standingRect(x, area.bottom, TILE_SIZE * 0.75, tall(CHEST.id));
    case 'wall':
      return {
        left: area.left,
        right: area.right,
        top: area.top - TILE_SIZE * 1.5,
        bottom: area.top,
      };
  }
}
