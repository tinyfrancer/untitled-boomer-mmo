import { TILE_SIZE } from '../config/constants';
import type { BodySize } from './enemies';
import type { BuildingId, BuildingShapeId, ZoneEdge } from '../types/ids';

/**
 * A building: the one thing in a zone that is neither spawned nor gathered nor
 * talked to, and simply stands there taking up room.
 *
 * It is solid all the way through, and that is a decision rather than a
 * shortcut. Click-to-move is a straight line with collision sliding and no
 * pathfinding anywhere, so a counter behind a doorway is a counter a tap walks
 * into a wall trying to reach — the shopkeeper would be unreachable from three
 * sides of their own shop. What a building is for, then, is the *outside* of it:
 * the door is where the person stands, and walking up to them is what walking
 * into a shop means here.
 */
export interface BuildingDefinition {
  id: BuildingId;
  /** What is written over the door, on the map, and on the inspect card. */
  name: string;
  /**
   * The ground it covers, in world pixels. A footprint like a node's and for the
   * same reason (see `BodySize`): how tall a roof looks is the renderer's
   * decision, and how much room the building takes up is not. `height` here is
   * the north-south span — the drawn height comes off the shape.
   */
  body: BodySize;
  shape: BuildingShapeId;
  /**
   * Which wall the door is in, which is two facts at once: which way the
   * building faces, and which side the person who works there stands on. Reusing
   * `ZoneEdge` rather than a union of its own because it is the same four
   * compass points meaning the same four things.
   */
  door: ZoneEdge;
}

const BAY = TILE_SIZE * 3;
const HUT = TILE_SIZE * 2;

export const BUILDINGS: Record<BuildingId, BuildingDefinition> = {
  'general-store': {
    id: 'general-store',
    name: 'General Store',
    body: { width: BAY, height: BAY },
    shape: 'hall',
    door: 'south',
  },
  // Named apart from the `bank` the counter is called everywhere else: a
  // BuildingId and an NpcRoleId sharing a string reads as a link the code does
  // not have, and the day a second bank exists is the day that matters.
  'bank-house': {
    id: 'bank-house',
    name: 'Bank',
    body: { width: BAY, height: BAY },
    shape: 'hall',
    door: 'south',
  },
  'training-hall': {
    id: 'training-hall',
    name: 'Training Hall',
    body: { width: BAY, height: BAY },
    shape: 'hall',
    door: 'south',
  },
  'quartermasters-post': {
    id: 'quartermasters-post',
    name: "Quartermaster's Post",
    body: { width: BAY, height: HUT },
    shape: 'cottage',
    door: 'south',
  },
  /**
   * Shallower than it is wide and open at the front, because the anvil it is
   * named for stands *outside* it: a station is tapped, and a tile of furniture
   * parked indoors would be a station nobody can reach.
   *
   * The one door in town that does not face south, and the road west is what
   * did it. Opening that road reserved a strip of town's west edge for arrivals,
   * which is where this stood — so the smithy moved up into the north-west block
   * and the only open ground left beside it is to the west. A south door there
   * would put the forge on the training hall's roof.
   */
  smithy: {
    id: 'smithy',
    name: 'Smithy',
    body: { width: BAY, height: HUT },
    shape: 'workshop',
    door: 'west',
  },
  // Narrow and deep where the shopfronts are square, and that is a layout rule
  // rather than a look: it stands on the south side of the street, between two
  // counters' approaches, and a full bay there would leave no lane to walk up.
  inn: {
    id: 'inn',
    name: 'The Wet Boot',
    body: { width: HUT, height: BAY },
    shape: 'hall',
    door: 'north',
  },
  // The only row here that is spawned more than once, and the only one with
  // nothing behind the door. A town of four counters in a field is a menu; the
  // houses are what make the counters part of somewhere.
  cottage: {
    id: 'cottage',
    name: 'Cottage',
    body: { width: HUT, height: HUT },
    shape: 'cottage',
    door: 'south',
  },
  /**
   * What the road west is named after, and the first building outside a town.
   *
   * The widest footprint in the table, because it is the one thing here that is
   * meant to be seen from across a zone rather than walked up to — there is
   * nobody behind the door and nothing to tap it for. That makes it the first
   * piece of pure scenery in the game, which is a thing a zone could not have
   * until a zone could have buildings at all.
   *
   * The door still faces south like every shopfront's, and for the reason that
   * is a rule rather than a habit: the camera stands south, so the wall a player
   * sees is the south one, and a door drawn on the far side is a door nobody
   * ever sees.
   */
  mill: {
    id: 'mill',
    name: 'The Old Mill',
    body: { width: BAY, height: BAY },
    shape: 'workshop',
    door: 'south',
  },
};

/** A building where a zone put it. What everything below asks about. */
interface Standing {
  x: number;
  y: number;
  definition: BuildingDefinition;
}

/**
 * The ground it stands on, in world pixels.
 *
 * Structurally a `CollisionSystem.Bounds`, and deliberately not imported as one:
 * nothing else in `data/` reaches into `systems/`, and a footprint is a fact
 * about the table rather than about what collides with it.
 */
export function buildingRect(building: Standing): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const { width, height } = building.definition.body;
  return {
    left: building.x - width / 2,
    top: building.y - height / 2,
    right: building.x + width / 2,
    bottom: building.y + height / 2,
  };
}

/** Which way is out through the door, as a unit step in simulation space. */
const DOOR_STEP: Record<ZoneEdge, { x: number; y: number }> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
  east: { x: 1, y: 0 },
};

/**
 * How far off the wall the doorstep sits: half a tile, which is exactly the
 * player's own half-extent. Any less and the point a tap walks to is inside the
 * building, where collision stops them short of it and the walk never arrives.
 */
const DOORSTEP = TILE_SIZE / 2;

/**
 * Where standing at the door means standing — outside it, on the ground.
 *
 * This is what a tap on a building resolves to, and what a counter's NPC is
 * placed against. One function rather than two coordinates written twice in
 * `zones.ts`, so a building that is moved takes its doorstep with it.
 */
export function doorPoint(building: Standing): { x: number; y: number } {
  const { width, height } = building.definition.body;
  const step = DOOR_STEP[building.definition.door];
  return {
    x: building.x + step.x * (width / 2 + DOORSTEP),
    y: building.y + step.y * (height / 2 + DOORSTEP),
  };
}
