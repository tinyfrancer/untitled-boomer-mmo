import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial } from 'three';
import { TILE_SIZE } from '../config/constants';
import { WALL_THICKNESS, interiorRect } from '../data/buildings';
import { BUILDING_LOOKS, PALETTE } from './palette';
import type { BuildingDefinition, Rect } from '../data/buildings';
import type { BuildingId, BuildingShapeId, ZoneEdge } from '../types/ids';

/**
 * What is in a room: a floor, and the few things standing against its walls.
 *
 * Empty rooms were phase 4's deliberate stopping point and phase 5 put a person
 * in six of them; this is what the other half of a room is. It lives in the
 * renderer rather than in `data/` for the reason creature colour does — nothing
 * here blocks, is gathered, is tapped or is stood on, so the simulation has no
 * opinion about any of it. A shelf is scenery in the same sense a rat's brown
 * is.
 *
 * **Nothing in here blocks, and that is the room's own arithmetic rather than a
 * shortcut.** A three-tile shop is 160 units of floor with the counter a tile
 * back from its middle and the customer `NPC_INTERACT_RADIUS` in front of that:
 * the two people already fill it. A blocking fitting would be either furniture
 * in the doorway or a cell A\* refuses, and `docs/decisions.md` 46 is the record
 * of what happens when the last cell of a room stops being walkable — `findPath`
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
 * what makes the doorway clear by construction — there is no way to name the
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
 * two-tile hut's floor is 96 units across, so its middle — which is where the
 * "go in" tap lands somebody — leaves 16 units to the wall on either side once
 * the body's own half-extent is taken off. Anything deeper than the wall is
 * furniture a player is standing inside the moment they walk in.
 */
const FITTING_DEPTH = WALL_THICKNESS;

/** How much of its wall a fitting runs along, centred on it. */
const FITTING_RUN = 0.6;

/**
 * How proud of the ground the floor is laid.
 *
 * A board rather than a coat of paint on the terrain: the ground mesh is one
 * vertex-coloured surface at tile resolution and a room is not a whole number of
 * tiles, so a floor painted into it would be a room whose edges are somewhere
 * else. A unit up is under the threshold's own step and enough to read as a
 * floor being stepped onto.
 */
const FLOOR_HEIGHT = 1;

/** How tall each thing stands, against the tile it is measured in. */
const FITTING_HEIGHT: Record<FittingKind, number> = {
  shelves: TILE_SIZE * 0.85,
  hearth: TILE_SIZE * 0.5,
  bench: TILE_SIZE * 0.28,
  crates: TILE_SIZE * 0.42,
  bed: TILE_SIZE * 0.24,
};

/** The colours a room is made of — the interior half of `BUILDING_LOOKS`. */
type RoomLook = (typeof BUILDING_LOOKS)[BuildingShapeId];

/**
 * What stands in each kind of room, keyed by the shape the way every other look
 * here is: a new `BUILDINGS` row is furnished without a line written for it.
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
 * The two rooms that are their own thing, which is the exception
 * `CREATURE_OVERRIDES` already established the shape of: the shape stays the
 * rule, and a row may name itself.
 *
 * Both are fires, and both are the reason this phase is worth doing at all — a
 * room lit differently from the outdoors is what makes going inside feel like
 * going inside, and the smithy and the inn are the two buildings in the game
 * whose whole character is the thing burning in them. Left to their shapes the
 * smithy would be the mill with a chimney and the inn would be a fourth
 * shopfront.
 */
const ROOM_OVERRIDES: Partial<Record<BuildingId, readonly Fitting[]>> = {
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

/** A fitting where it stands, in the building's own frame. */
export interface StandingFitting {
  readonly kind: FittingKind;
  readonly rect: Rect;
}

/**
 * The ground each fitting covers, around a building standing at the origin.
 *
 * A pure function of the table, and the one `buildInterior` draws from — the
 * same bargain the walls make with `CollisionSystem`. What is asserted about a
 * room and what is drawn in it have to be one answer, and here that matters for
 * a reason the walls do not have: nothing in a room stops anybody, so the only
 * thing keeping the furniture out of the space people stand in is arithmetic
 * nobody can see.
 */
export function fittingRects(definition: BuildingDefinition): StandingFitting[] {
  const room = interiorRect({ x: 0, y: 0, definition });
  return roomFittings(definition).map(({ kind, against }) => ({
    kind,
    rect: alongWall(room, wallOf(definition.door, against)),
  }));
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
 * The room, drawn: a floor and whatever stands on it.
 *
 * Added to the building **after** `castsShadow` has run over the shell, so
 * nothing in here casts. That is not thrift for its own sake — the ground is the
 * only surface that receives (`docs/decisions.md` 31), and the ground under a
 * room is under a roof already casting over the whole of it. A shelf's shadow
 * has nowhere to land and would cost a shadow-map draw to land it there.
 */
export function buildInterior(definition: BuildingDefinition): Group {
  const look = BUILDING_LOOKS[definition.shape];
  const group = new Group();
  group.name = 'interior';
  group.add(floor(definition, look));
  for (const { kind, rect } of fittingRects(definition)) {
    const fitting = FITTINGS[kind](rect, look);
    fitting.name = `fitting:${kind}`;
    group.add(fitting);
  }
  return group;
}

function floor(definition: BuildingDefinition, look: RoomLook): Mesh {
  const room = interiorRect({ x: 0, y: 0, definition });
  const board = new Mesh(
    new BoxGeometry(room.right - room.left, FLOOR_HEIGHT, room.bottom - room.top),
    new MeshLambertMaterial({ color: look.floor }),
  );
  board.name = 'floor';
  board.position.set((room.left + room.right) / 2, FLOOR_HEIGHT / 2, (room.top + room.bottom) / 2);
  return board;
}

/**
 * A box standing on the floor over some part of a fitting's ground.
 *
 * `across` and `deep` are fractions of the rect and `from` is where the box
 * starts up the fitting's height, so every piece of furniture below is written
 * in the fitting's own terms and none of them can reach outside it.
 */
function piece(
  rect: Rect,
  color: number,
  box: {
    across?: number;
    deep?: number;
    from?: number;
    to: number;
    height: number;
    shift?: number;
    glow?: boolean;
  },
): Mesh {
  const width = rect.right - rect.left;
  const depth = rect.bottom - rect.top;
  // The long axis is whichever way the wall runs, so a fraction "across" means
  // along the wall whichever wall it is.
  const horizontal = width >= depth;
  const across = box.across ?? 1;
  const thick = box.deep ?? 1;
  const from = box.from ?? 0;
  const material = box.glow ? new MeshBasicMaterial({ color }) : new MeshLambertMaterial({ color });
  const mesh = new Mesh(
    new BoxGeometry(
      (horizontal ? across : thick) * width,
      (box.to - from) * box.height,
      (horizontal ? thick : across) * depth,
    ),
    material,
  );
  const shift = (box.shift ?? 0) * (horizontal ? width : depth) * 0.5;
  mesh.position.set(
    (rect.left + rect.right) / 2 + (horizontal ? shift : 0),
    FLOOR_HEIGHT + ((from + box.to) / 2) * box.height,
    (rect.top + rect.bottom) / 2 + (horizontal ? 0 : shift),
  );
  return mesh;
}

/**
 * Uprights with boards across them, rather than a cupboard.
 *
 * A solid box against a wall reads as a crate the size of a wall; the gaps
 * between the boards are the whole of what says "shelves" at the distance the
 * camera stands.
 */
function shelves(rect: Rect, look: RoomLook): Group {
  const height = FITTING_HEIGHT.shelves;
  const group = new Group();
  [-1, 1].forEach((end) => {
    group.add(piece(rect, look.fitting, { across: 0.06, to: 1, height, shift: end * 0.94 }));
  });
  [0.3, 0.62, 0.94].forEach((at) => {
    group.add(piece(rect, PALETTE.woodLight, { from: at - 0.05, to: at, height }));
  });
  return group;
}

/**
 * A stone hearth with something still burning in it.
 *
 * The one fitting that takes no colour from the room it is in: fire and hot
 * stone are the same fire and the same stone in a forge and in a taproom, which
 * is the same call `PALETTE` already makes about the campfire's flames.
 */
function hearth(rect: Rect): Group {
  const height = FITTING_HEIGHT.hearth;
  const group = new Group();
  group.add(piece(rect, PALETTE.forgeStone, { to: 1, height }));
  // Unlit geometry, the same call `buildForge` makes about its coals: a fire
  // shaded like a rock is a rock, and this is the one thing in a room that has
  // to look like it is giving off the light the room is lit by.
  group.add(
    piece(rect, PALETTE.ember, { across: 0.7, deep: 0.6, from: 1, to: 1.12, height, glow: true }),
  );
  group.add(
    piece(rect, PALETTE.emberCore, {
      across: 0.4,
      deep: 0.35,
      from: 1.08,
      to: 1.2,
      height,
      glow: true,
    }),
  );
  return group;
}

/** A top on two legs. */
function bench(rect: Rect, look: RoomLook): Group {
  const height = FITTING_HEIGHT.bench;
  const group = new Group();
  group.add(piece(rect, look.fitting, { from: 0.7, to: 1, height }));
  [-1, 1].forEach((end) => {
    group.add(
      piece(rect, look.fitting, {
        across: 0.12,
        deep: 0.6,
        to: 0.7,
        height,
        shift: end * 0.88,
      }),
    );
  });
  return group;
}

/** Two on the floor and one on top, which is what a corner of a store is. */
function crates(rect: Rect, look: RoomLook): Group {
  const height = FITTING_HEIGHT.crates;
  const group = new Group();
  [-1, 1].forEach((end) => {
    group.add(piece(rect, look.fitting, { across: 0.5, to: 0.7, height, shift: end * 0.5 }));
  });
  group.add(piece(rect, PALETTE.woodLight, { across: 0.44, deep: 0.8, from: 0.7, to: 1, height }));
  return group;
}

/** A frame with bedding on it — the one thing that says somebody lives here. */
function bed(rect: Rect, look: RoomLook): Group {
  const height = FITTING_HEIGHT.bed;
  const group = new Group();
  group.add(piece(rect, look.fitting, { to: 0.55, height }));
  group.add(piece(rect, PALETTE.bedding, { across: 0.92, deep: 0.9, from: 0.55, to: 1, height }));
  return group;
}

const FITTINGS: Record<FittingKind, (rect: Rect, look: RoomLook) => Group> = {
  shelves,
  hearth,
  bench,
  crates,
  bed,
};
