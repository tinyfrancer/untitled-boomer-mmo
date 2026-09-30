import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial } from 'three';
import { fittingRects, type FittingKind } from '../art/rooms';
import { TILE_SIZE } from '../config/constants';
import { interiorRect } from '../data/buildings';
import { BUILDING_LOOKS, PALETTE } from './palette';
import type { BuildingDefinition, Rect } from '../data/buildings';
import type { BuildingShapeId } from '../types/ids';

/**
 * What is in a room, drawn in 3D: a floor, and the few things standing against
 * its walls, where `art/rooms.ts` says they stand. The layout moved there in
 * B6 so the 2D view furnishes the same rooms the same way (decision 109); this
 * is only how the 3D view builds each piece, until B7 deletes it.
 */

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
