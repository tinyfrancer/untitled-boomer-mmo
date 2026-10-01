import {
  WALL_THICKNESS,
  interiorRect,
  type BuildingDefinition,
  type Rect,
} from '../data/buildings';
import type { HouseFixture } from '../data/house';
import type { BuildingId, BuildingShapeId, SlayerRank, ZoneEdge } from '../types/ids';
import { variantId } from './compile';
import {
  BED,
  BENCH,
  BENCH_SIDE,
  CHEST,
  COUNTER,
  CRATES,
  HEARTH,
  HEARTH_EAST,
  HEARTH_LOW,
  HEARTH_WEST,
  PLAQUE,
  SHELVES,
  STAND,
  STAND_TOP,
} from './sprites/fittings';

/**
 * What is in a room: the few things standing against its walls, and the
 * counter whoever works there is served across.
 *
 * The renderer's own rather than the simulation's, as creature colour is:
 * nothing here blocks, is gathered, is tapped or is stood on. It moved here
 * from the 3D view's interiors in B6 (decision 109), so both views stood the
 * same furniture in the same places while there were two.
 *
 * **Nothing in here blocks, and that is the room's own arithmetic rather than a
 * shortcut.** A three-tile shop is 160 units of floor with the counter a tile
 * back from its middle and the customer `NPC_INTERACT_RADIUS` in front of that:
 * the two people already fill it. A blocking fitting would be either furniture
 * in the doorway or a cell A\* refuses, and `docs/decisions.md` 46 is the record
 * of what happens when the last cell of a room stops being walkable: `findPath`
 * answers `null` for the whole walk rather than for the last few pixels of it.
 * So the fittings stand against the walls, and `FITTING_DEPTH` is what keeps
 * them out of the space the people occupy.
 */
export type FittingKind = 'shelves' | 'hearth' | 'bench' | 'crates' | 'bed';

/**
 * Which wall a thing stands against, read from the doorway looking in.
 *
 * Door-relative rather than compass, which is what lets one row furnish a
 * building whichever way it faces: the smithy's door is west and its "back" is
 * the east wall, and nothing in the table below has to know that. It is also
 * what makes the doorway clear by construction: there is no way to name the
 * wall the door is in.
 */
export type FittingWall = 'back' | 'left' | 'right';

export interface Fitting {
  readonly kind: FittingKind;
  readonly against: FittingWall;
}

/**
 * How deep a fitting stands into the room: exactly the thickness of the wall it
 * is against.
 *
 * Measured rather than chosen, and the smallest room is what measures it. A
 * two-tile hut's floor is 96 units across, so its middle, which is where the
 * "go in" tap lands somebody, leaves 16 units to the wall on either side once
 * the body's own half-extent is taken off. Anything deeper than the wall is
 * furniture a player is standing inside the moment they walk in.
 */
export const FITTING_DEPTH = WALL_THICKNESS;

/** How much of its wall a fitting runs along, centred on it. */
const FITTING_RUN = 0.6;

/**
 * What stands in each kind of room, keyed by the shape the way every other look
 * is: a new `BUILDINGS` row is furnished without a line written for it.
 *
 * A hall is somewhere business is done, so it is shelves behind whoever is
 * standing there; a workshop is a bench and what has not been carried out yet;
 * a cottage is somewhere somebody lives.
 */
const ROOM_FITTINGS: Record<BuildingShapeId, readonly Fitting[]> = {
  hall: [
    { kind: 'shelves', against: 'back' },
    { kind: 'crates', against: 'left' },
  ],
  workshop: [
    { kind: 'bench', against: 'back' },
    { kind: 'crates', against: 'right' },
  ],
  cottage: [
    { kind: 'bed', against: 'left' },
    { kind: 'bench', against: 'right' },
  ],
};

/**
 * The rooms that are their own thing: the shape stays the rule, and a row may
 * name itself.
 *
 * Two are fires. The smithy and the inn are the two buildings in the game
 * whose whole character is the thing burning in them; left to their shapes the
 * smithy would be the mill with a chimney and the inn would be a fourth
 * shopfront. The third is the fettler's store, which is a cottage's roof over
 * nobody's bed: crates either side, and the middle of the floor left to what
 * is waiting in it.
 */
const ROOM_OVERRIDES: Partial<Record<BuildingId, readonly Fitting[]>> = {
  // The house's bed, against the one wall its stands and chest leave
  // (`data/house.ts`): somebody lives here, and the rest is theirs to fill.
  house: [{ kind: 'bed', against: 'left' }],
  store: [
    { kind: 'crates', against: 'left' },
    { kind: 'crates', against: 'right' },
  ],
  smithy: [
    { kind: 'hearth', against: 'back' },
    { kind: 'bench', against: 'right' },
  ],
  inn: [
    { kind: 'hearth', against: 'back' },
    { kind: 'bench', against: 'left' },
    { kind: 'bench', against: 'right' },
  ],
};

/** What stands in this room: its own list, or its shape's. */
export function roomFittings(definition: BuildingDefinition): readonly Fitting[] {
  return ROOM_OVERRIDES[definition.id] ?? ROOM_FITTINGS[definition.shape];
}

/** The wall opposite the door, which is the one a counter has its back to. */
const OPPOSITE: Record<ZoneEdge, ZoneEdge> = {
  north: 'south',
  south: 'north',
  west: 'east',
  east: 'west',
};

/** The two walls either side, as [left, right] for somebody looking in. */
const FLANKS: Record<ZoneEdge, readonly [ZoneEdge, ZoneEdge]> = {
  south: ['west', 'east'],
  north: ['east', 'west'],
  west: ['north', 'south'],
  east: ['south', 'north'],
};

function wallOf(door: ZoneEdge, against: FittingWall): ZoneEdge {
  if (against === 'back') return OPPOSITE[door];
  return FLANKS[door][against === 'left' ? 0 : 1];
}

/** A fitting where it stands, in the building's own frame, and the wall it is against. */
export interface StandingFitting {
  readonly kind: FittingKind;
  readonly rect: Rect;
  readonly wall: ZoneEdge;
}

/**
 * The ground each fitting covers, around a building standing at the origin.
 *
 * A pure function of the table, and the one both views draw from, the same
 * bargain the walls make with `CollisionSystem`: what is asserted about a room
 * and what is drawn in it have to be one answer. It matters more here than for
 * the walls, since nothing in a room stops anybody, so the only thing keeping
 * the furniture out of the space people stand in is arithmetic nobody can see.
 */
export function fittingRects(definition: BuildingDefinition): StandingFitting[] {
  const room = interiorRect({ x: 0, y: 0, definition });
  return roomFittings(definition).map(({ kind, against }) => {
    const wall = wallOf(definition.door, against);
    return { kind, rect: alongWall(room, wall), wall };
  });
}

function alongWall(room: Rect, edge: ZoneEdge): Rect {
  const midX = (room.left + room.right) / 2;
  const midY = (room.top + room.bottom) / 2;
  const horizontal = edge === 'north' || edge === 'south';
  const run = ((horizontal ? room.right - room.left : room.bottom - room.top) * FITTING_RUN) / 2;
  if (horizontal) {
    const [top, bottom] =
      edge === 'north'
        ? [room.top, room.top + FITTING_DEPTH]
        : [room.bottom - FITTING_DEPTH, room.bottom];
    return { left: midX - run, right: midX + run, top, bottom };
  }
  const [left, right] =
    edge === 'west'
      ? [room.left, room.left + FITTING_DEPTH]
      : [room.right - FITTING_DEPTH, room.right];
  return { left, right, top: midY - run, bottom: midY + run };
}

/**
 * What each fitting is drawn as against each wall. Against the north or south
 * wall a thing is seen from the front; against a side wall it is seen along
 * its length, so a bench there is a drawing of its own, and a hearth's mouth
 * faces the room from whichever side it stands on. Against the south wall a
 * hearth is only the stone it burns on, since the cutaway takes that wall
 * away and its chimney with it. A crate is the same box
 * from any side, and a bed is seen from above lying along its wall, its head
 * to the north.
 */
const FITTING_SPRITES: Readonly<Record<FittingKind, Readonly<Record<ZoneEdge, string>>>> = {
  shelves: { north: SHELVES.id, south: SHELVES.id, west: SHELVES.id, east: SHELVES.id },
  hearth: { north: HEARTH.id, south: HEARTH_LOW.id, west: HEARTH_WEST.id, east: HEARTH_EAST.id },
  bench: { north: BENCH.id, south: BENCH.id, west: BENCH_SIDE.id, east: BENCH_SIDE.id },
  crates: { north: CRATES.id, south: CRATES.id, west: CRATES.id, east: CRATES.id },
  bed: { north: BED.id, south: BED.id, west: BED.id, east: BED.id },
};

/** The sprite a fitting is drawn with, against the wall it stands against. */
export function fittingSprite(fitting: StandingFitting): string {
  return FITTING_SPRITES[fitting.kind][fitting.wall];
}

/**
 * Where a fitting's drawing stands: the middle of the front edge of the ground
 * it covers, the point a prop's anchor goes on, so it stands on its own ground
 * and is sorted with whoever is in the room by where its foot is.
 */
export function fittingAnchor(rect: Rect): { x: number; y: number } {
  return { x: (rect.left + rect.right) / 2, y: rect.bottom };
}

/** The counter whoever works in a room is served across. */
export const COUNTER_SPRITE = COUNTER.id;

/**
 * How far in front of whoever works in a room their counter stands, toward
 * the door: far enough in front to hide their legs to the knee, and short of
 * where the walk up to them ends (`NPC_INTERACT_RADIUS`), so the customer
 * stands on the near side of it (`tests/art/rooms.test.ts` holds both).
 */
export const COUNTER_AHEAD = 24;

const TOWARD_DOOR: Record<ZoneEdge, { x: number; y: number }> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
  east: { x: 1, y: 0 },
};

/** Where the counter stands in front of somebody working in a room whose door is `door`. */
export function counterAt(
  worker: { x: number; y: number },
  door: ZoneEdge,
): { x: number; y: number } {
  const step = TOWARD_DOOR[door];
  return { x: worker.x + step.x * COUNTER_AHEAD, y: worker.y + step.y * COUNTER_AHEAD };
}

/*
 * The house's fixtures (F1): where they stand is `data/house.ts`, since the
 * simulation walks up to them, and what they are drawn as is here, with the
 * rest of the room.
 */

/** What a fixture is drawn as, or null for the wall, which is its plaques. */
export function fixtureSprite(fixture: HouseFixture): string | null {
  switch (fixture.kind) {
    case 'stand':
      return STAND.id;
    case 'chest':
      return CHEST.id;
    case 'wall':
      return null;
  }
}

/** How far over a stand's foot a trophy on it stands, in art pixels. */
export const TROPHY_LIFT = STAND_TOP;

/** How many plaques hang in a row, and how far apart, in simulation units. */
const PLAQUES_A_ROW = 4;
const PLAQUE_SPACING = 24;
/** How far up the back wall the lowest row hangs, and how far apart the rows are. */
const PLAQUE_LOW = 24;
const PLAQUE_ROW = 24;

/**
 * Where the nth plaque hangs, in the house's frame: across the back wall over
 * the chest, between the two stands against it, four a row from the bottom
 * up. `y` is where the plaque's foot is drawn; `wall` is the foot of the wall
 * it hangs on, which is what it is sorted by.
 */
export function plaqueAt(index: number, wall: number): { x: number; y: number } {
  const row = Math.floor(index / PLAQUES_A_ROW);
  const across = index % PLAQUES_A_ROW;
  return {
    x: (across - (PLAQUES_A_ROW - 1) / 2) * PLAQUE_SPACING,
    y: wall - PLAQUE_LOW - row * PLAQUE_ROW,
  };
}

/** A plaque's sprite: gold for a Slayer, dyed for the ranks below. */
export function plaqueSprite(rank: SlayerRank): string {
  return rank === 'slayer' ? PLAQUE.id : variantId(PLAQUE.id, rank);
}
