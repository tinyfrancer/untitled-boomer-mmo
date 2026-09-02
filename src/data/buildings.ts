import { TILE_SIZE } from '../config/constants';
import type { BodySize } from './enemies';
import type { BuildingId, BuildingShapeId, ZoneEdge } from '../types/ids';

/**
 * A building: the one thing in a zone that is neither spawned nor gathered nor
 * talked to, and simply stands there taking up room.
 *
 * It is a shell now rather than a solid mass — four walls with a gap in one of
 * them — and that reverses a decision this file used to state at length. Being
 * solid was right for as long as click-to-move was a straight line with no
 * pathfinder behind it, because a doorway is exactly the shape a straight line
 * cannot solve: a counter behind one is a counter a tap walks into a wall trying
 * to reach, from three sides of its own shop. `systems/PathSystem.ts` is what
 * changed, and `docs/decisions.md` 25 is where the reversal is argued.
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

/**
 * How thick a wall is, for what stops you and for what is drawn — one number,
 * because those have to be the same number.
 *
 * A quarter of a tile, which is thin, and thin on purpose: what is left over is
 * the room, and the room has to be somewhere a body can be routed to. A wall
 * half a tile thick takes a three-tile building down to a two-tile interior,
 * which is the narrowest thing `footing` will hand back a waypoint in.
 */
export const WALL_THICKNESS = TILE_SIZE / 4;

/**
 * The narrowest opening a body can walk through and turn in.
 *
 * Two tiles, and that is measured rather than chosen — see `docs/decisions.md`
 * 35. `PLAYER_HALF_EXTENT` is half a tile, so a body is exactly one tile wide;
 * a one-tile gap leaves it no slack at all and `footing` refuses to put a
 * waypoint in one. Two tiles leaves a whole tile of it.
 *
 * It lives here rather than in the renderer, which is where the drawn door's
 * width used to live, for the reason `body` does: how wide a doorway *is* is not
 * a decision about how it looks. The gap you walk through and the gap you can
 * see have to be one number.
 */
export const MIN_DOOR_SPAN = TILE_SIZE * 2;

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
  /**
   * Greyford's counter, and a bay like the town's shopfronts because it does the
   * same job: a person stands at the door of it and you walk up to them.
   */
  'trading-post': {
    id: 'trading-post',
    name: 'Trading Post',
    body: { width: BAY, height: BAY },
    shape: 'hall',
    door: 'south',
  },
  // Scenery, the way the mill is: nobody works here and nothing is tapped. It is
  // what makes the outpost read as a place somebody lives rather than one
  // building standing in a field.
  longhouse: {
    id: 'longhouse',
    name: 'Longhouse',
    body: { width: BAY * 2, height: HUT },
    shape: 'cottage',
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

/** A rectangle in world pixels, which is what a wall and a footprint both are. */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * A wall, which is a rectangle that knows which side of the building it is.
 *
 * Structurally still a `Rect`, so `CollisionSystem` takes the list unchanged and
 * never learns the difference. The edge is for the one caller that has to tell
 * the walls apart: a cutaway takes away whichever of them stands between the
 * camera and the room, and "whichever" is not a question a bare rectangle can
 * answer — the door wall arrives in two pieces offset along their own wall, so
 * the side cannot be read back off a centre point.
 */
export interface Wall extends Rect {
  edge: ZoneEdge;
}

/**
 * The opening in the door wall, as the span it covers along that wall.
 *
 * `MIN_DOOR_SPAN` wide, centred — **or the whole wall, when the wall is no wider
 * than that**. Three buildings are in the second case (the smithy, the inn and
 * the cottage), and they are open-fronted rather than doored as a result.
 *
 * That is the honest answer rather than a fallback. Town has no room to grow
 * them: a three-tile cottage was tried in every position the south-west corner
 * allows and each one put a rat's wander disc or a tree's working ground inside
 * a wall. And it is what the `workshop` shape already claims for the smithy —
 * "a roof over an open front rather than a storey" — so for one of the three it
 * is not a compromise at all.
 */
export function doorGap(building: Standing): { from: number; to: number } {
  const { width, height } = building.definition.body;
  const horizontal = building.definition.door === 'north' || building.definition.door === 'south';
  const along = horizontal ? width : height;
  const centre = horizontal ? building.x : building.y;
  const span = Math.min(MIN_DOOR_SPAN, along);
  return { from: centre - span / 2, to: centre + span / 2 };
}

/**
 * What actually stops you: the four walls, with the door wall cut back to the
 * segments either side of its opening.
 *
 * A list rather than the one rect `buildingRect` still answers with, because
 * those are two different questions now — what ground the building covers (the
 * map, the pick box, the fade) against what a body may not walk through. A wall
 * two tiles long has no segments at all and contributes nothing here, which is
 * what an open front *is*.
 */
export function buildingWalls(building: Standing): Wall[] {
  const rect = buildingRect(building);
  const door = building.definition.door;
  const gap = doorGap(building);
  const t = WALL_THICKNESS;

  const walls: Wall[] = [];
  const push = (edge: ZoneEdge, wall: Rect): void => {
    if (wall.right - wall.left > 0.01 && wall.bottom - wall.top > 0.01)
      walls.push({ ...wall, edge });
  };

  // The three whole walls, then the door wall in up to two pieces. Each runs the
  // full span of the footprint, so the four overlap at the corners — which costs
  // nothing, since a blocker is a rectangle a body may not be in and being in
  // two of them is the same as being in one.
  if (door === 'north') {
    push('north', { ...rect, bottom: rect.top + t, right: gap.from });
    push('north', { ...rect, bottom: rect.top + t, left: gap.to });
  } else {
    push('north', { ...rect, bottom: rect.top + t });
  }
  if (door === 'south') {
    push('south', { ...rect, top: rect.bottom - t, right: gap.from });
    push('south', { ...rect, top: rect.bottom - t, left: gap.to });
  } else {
    push('south', { ...rect, top: rect.bottom - t });
  }
  if (door === 'west') {
    push('west', { ...rect, right: rect.left + t, bottom: gap.from });
    push('west', { ...rect, right: rect.left + t, top: gap.to });
  } else {
    push('west', { ...rect, right: rect.left + t });
  }
  if (door === 'east') {
    push('east', { ...rect, left: rect.right - t, bottom: gap.from });
    push('east', { ...rect, left: rect.right - t, top: gap.to });
  } else {
    push('east', { ...rect, left: rect.right - t });
  }
  return walls;
}

/**
 * The room, which is the footprint less the walls around it.
 *
 * Deliberately the *inside* face of the walls rather than the footprint: what it
 * answers is "is the player in this room", and someone still in the wall band is
 * in the doorway rather than indoors. The band is a quarter-tile, so the roof
 * comes off a stride after the threshold rather than as it is stepped on.
 */
export function interiorRect(building: Standing): Rect {
  const rect = buildingRect(building);
  const t = WALL_THICKNESS;
  return {
    left: rect.left + t,
    top: rect.top + t,
    right: rect.right - t,
    bottom: rect.bottom - t,
  };
}

/** Whether a point is in the room, which is what puts the roof away. */
export function isInside(building: Standing, point: { x: number; y: number }): boolean {
  const room = interiorRect(building);
  return point.x > room.left && point.x < room.right && point.y > room.top && point.y < room.bottom;
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
