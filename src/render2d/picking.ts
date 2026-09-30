import { ART_PIXEL } from '../art/budget';
import { creatureSprite, npcSprite } from '../art/cast';
import { stationSprite } from '../art/places';
import { TILE_SIZE } from '../config/constants';
import type { Point } from '../systems/MovementSystem';
import type { LootPile } from '../world/LootPile';
import type { Mob } from '../world/Mob';
import type { ResourceNode } from '../world/ResourceNode';
import type {
  WorldBuilding,
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
 * NPC, mob, station, building, loot pile, ground — rather than a depth sort,
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
  readonly stations: readonly (Pickable2D & { readonly station: WorldStation })[];
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
 * and a fishing spot lying flat on the water.
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
    stations: world.stations.map((station) => ({
      station,
      baseY: station.y,
      pickRect: () =>
        standingRect(station.x, station.y, TILE_SIZE, tall(stationSprite(station.station))),
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
