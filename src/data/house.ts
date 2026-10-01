import { PLAYER_HALF_EXTENT, TILE_SIZE } from '../config/constants';
import { exhaustive } from '../types/exhaustive';
import type { BuildingId, HouseUpgradeId, ResourceNodeId } from '../types/ids';
import { interiorRect, type BuildingDefinition, type Rect } from './buildings';
import type { StationId } from './recipes';

/**
 * The house in Lampton (F1, decision 88): a building the Company lets to the
 * player once they have earned it, with stands to set trophies on, a wall the
 * plaques hang on and a chest to keep things in.
 *
 * What stands in it is data rather than the renderer's own, unlike the rest of
 * a room's furniture (`art/rooms.ts`), because these are the first things in a
 * room anybody taps: the simulation has to know where each one is to walk up
 * to it, and the view draws them where the simulation says. None of them
 * blocks, for the reason nothing in a room does (decision 48).
 */

/** Which building is the house: the one its fixtures are stood in. */
export const HOUSE_BUILDING: BuildingId = 'house';

/**
 * The room behind the house (F2), shut until it is built: the lot's whole
 * footprint is written into Lampton's text from the start, and buying a room
 * opens its door rather than moving the town about.
 */
export const DRAWING_ROOM: BuildingId = 'drawing-room';

/** The rooms shut until a stage is built, and the stage that opens each. */
export const SHUT_UNTIL: Partial<Record<BuildingId, HouseUpgradeId>> = {
  [DRAWING_ROOM]: 'room',
};

/**
 * How many stands the house will ever have: F1's four in the house, and four
 * more in the drawing room as it is built out (F2). A stand is counted here
 * from the start, built or not, so the save keeps one place a stand for good.
 */
export const HOUSE_STANDS = 8;

/**
 * How many kinds of thing the chest holds: a fixed small store, one slot an
 * item id however deep the stack, the bank's rule at a smaller size. The bank
 * is still the vault (F1's answer); F2 may grow this.
 */
export const CHEST_SLOTS = 8;

/**
 * How near a fixture a body has to stand to use it: a tile, the reach a
 * counter is served across. Every fixture stands against a wall a body can
 * get within half a tile of, so the walk to one ends in reach (`fixtureAccess`).
 */
export const FIXTURE_REACH = TILE_SIZE;

/**
 * Something in the house a tap lands on: a stand by its place in the row, the
 * chest, the wall, or the surveyor's plans the house is built out from (F2).
 */
export type HouseFixture =
  { kind: 'stand'; stand: number } | { kind: 'chest' } | { kind: 'wall' } | { kind: 'plans' };

/**
 * A fixture where it stands, in the house's own frame: the house at the
 * origin, its door south. `rect` is the ground it covers against its wall,
 * `FITTING_DEPTH` deep as every fitting is, so a body in the middle of the
 * room is clear of all of it; the wall's is the strip of floor under the
 * plaques, which is where a walk up to them ends.
 */
export interface FixturePlacement {
  readonly fixture: HouseFixture;
  readonly rect: Rect;
  /** Which room it stands in, in whose frame `rect` is. */
  readonly building: BuildingId;
  /** The stage that puts it there (F2), or nothing for what the house is let with. */
  readonly upgrade?: HouseUpgradeId;
}

const DEPTH = TILE_SIZE / 4;
// The room is 224 by 160 inside: the walls are a quarter tile, the house four
// tiles by three.
const BACK = -80;
const EAST = 112;

const WEST = -112;

/**
 * In the house, two stands against the back wall either side of the chest,
 * with the plaques hung on the wall above it, and two along the east wall; the
 * west wall is the bed's (`art/rooms.ts`), with the plans on a table at its
 * south end, and the south wall is the one the cutaway takes away.
 *
 * In the drawing room (F2), whose door is in its west wall, two stands come
 * with the room against its north wall and two more along its east wall are
 * the last stage. The drawing room is the house's size, so the same numbers
 * stand them; its south wall is the cutaway's as every room's is.
 */
export const HOUSE_FIXTURES: readonly FixturePlacement[] = [
  {
    fixture: { kind: 'stand', stand: 0 },
    rect: { left: -96, right: -64, top: BACK, bottom: BACK + DEPTH },
    building: HOUSE_BUILDING,
  },
  {
    fixture: { kind: 'stand', stand: 1 },
    rect: { left: 64, right: 96, top: BACK, bottom: BACK + DEPTH },
    building: HOUSE_BUILDING,
  },
  {
    fixture: { kind: 'stand', stand: 2 },
    rect: { left: EAST - DEPTH, right: EAST, top: -40, bottom: -8 },
    building: HOUSE_BUILDING,
  },
  {
    fixture: { kind: 'stand', stand: 3 },
    rect: { left: EAST - DEPTH, right: EAST, top: 24, bottom: 56 },
    building: HOUSE_BUILDING,
  },
  {
    fixture: { kind: 'stand', stand: 4 },
    rect: { left: -72, right: -40, top: BACK, bottom: BACK + DEPTH },
    building: DRAWING_ROOM,
    upgrade: 'room',
  },
  {
    fixture: { kind: 'stand', stand: 5 },
    rect: { left: 40, right: 72, top: BACK, bottom: BACK + DEPTH },
    building: DRAWING_ROOM,
    upgrade: 'room',
  },
  {
    fixture: { kind: 'stand', stand: 6 },
    rect: { left: EAST - DEPTH, right: EAST, top: -40, bottom: -8 },
    building: DRAWING_ROOM,
    upgrade: 'stands',
  },
  {
    fixture: { kind: 'stand', stand: 7 },
    rect: { left: EAST - DEPTH, right: EAST, top: 24, bottom: 56 },
    building: DRAWING_ROOM,
    upgrade: 'stands',
  },
  {
    fixture: { kind: 'chest' },
    rect: { left: -24, right: 24, top: BACK, bottom: BACK + DEPTH },
    building: HOUSE_BUILDING,
  },
  {
    fixture: { kind: 'wall' },
    rect: { left: -56, right: 56, top: BACK, bottom: BACK + DEPTH },
    building: HOUSE_BUILDING,
  },
  {
    fixture: { kind: 'plans' },
    rect: { left: WEST, right: WEST + DEPTH, top: 52, bottom: 76 },
    building: HOUSE_BUILDING,
  },
];

/**
 * One stage of the house's growing (F2): what it costs and what it puts on
 * the lot, in the words the plans print.
 */
export interface HouseUpgrade {
  readonly id: HouseUpgradeId;
  /** What the plans call it. */
  readonly name: string;
  /** In copper, as every price is. */
  readonly price: number;
  /** What it builds, in a line. */
  readonly builds: string;
}

/**
 * The order the stages are bought in, each opening the next: the garden first
 * and cheap, then the bench beside it, then the room, then its last stands.
 * The lot together costs about two thirds of what the climb to the cap picks up
 * by the pace bot's count (`tests/world/pace.test.ts` holds it), so it is a
 * goal a character saves toward over the whole climb rather than a purchase.
 */
export const HOUSE_UPGRADE_ORDER = exhaustive<HouseUpgradeId>()([
  'garden',
  'workbench',
  'room',
  'stands',
]);

export const HOUSE_UPGRADES: Record<HouseUpgradeId, HouseUpgrade> = {
  garden: {
    id: 'garden',
    name: 'The Herb Garden',
    price: 500,
    builds: 'Two beds in the yard, of samphire and of meadowsweet, to cut with a sickle',
  },
  workbench: {
    id: 'workbench',
    name: 'The Workbench',
    price: 1200,
    builds: "A fletcher's bench in the yard, standing there all night",
  },
  room: {
    id: 'room',
    name: 'The Drawing Room',
    price: 2500,
    builds: 'The room behind the house opened, with two stands in it',
  },
  stands: {
    id: 'stands',
    name: 'More Stands',
    price: 3800,
    builds: 'Two more stands in the drawing room',
  },
};

/**
 * What the yard grows and holds (F2), in the house's frame, each put there by
 * a stage. The thing it is everywhere else: a bed is a herb patch that is cut
 * and grows back, the bench a station that persists for a parked night.
 *
 * Placed off the house rather than written into Lampton's text, as the
 * fixtures are, and for one more reason: a zone's spawns are where a herb grows
 * wild and where a bench stands for anybody, which the skills book, the parked
 * payout and E2's "no herbs in Lampton" all read, and a garden bought by one
 * character is neither.
 */
export type YardPlacement =
  | { readonly upgrade: HouseUpgradeId; readonly at: Point; readonly node: ResourceNodeId }
  | { readonly upgrade: HouseUpgradeId; readonly at: Point; readonly station: StationId };

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The yard west of the drawing room, off the lane: the two beds side by side
 * and the bench below them, beside the quartermaster's back wall rather than
 * behind it, where its roof would stand over them, and clear of the cottage's
 * doorstep (`tests/world/house.test.ts` sweeps them).
 */
export const HOUSE_YARD: readonly YardPlacement[] = [
  { upgrade: 'garden', at: { x: -544, y: -192 }, node: 'samphire' },
  { upgrade: 'garden', at: { x: -480, y: -192 }, node: 'meadowsweet' },
  { upgrade: 'workbench', at: { x: -544, y: -64 }, station: 'bench' },
];

/** One fixture's key, for comparing two of them and naming one in the DOM. */
export function fixtureKey(fixture: HouseFixture): string {
  return fixture.kind === 'stand' ? `stand-${fixture.stand}` : fixture.kind;
}

/** The stage that puts a stand in the house, or nothing for F1's four. */
export function standUpgrade(stand: number): HouseUpgradeId | null {
  const placement = HOUSE_FIXTURES.find(
    ({ fixture }) => fixture.kind === 'stand' && fixture.stand === stand,
  );
  return placement?.upgrade ?? null;
}

/** Where a fixture stands in the world, as the middle of the ground it covers. */
export function fixturePoint(
  house: { x: number; y: number },
  placement: FixturePlacement,
): { x: number; y: number } {
  const { rect } = placement;
  return { x: house.x + (rect.left + rect.right) / 2, y: house.y + (rect.top + rect.bottom) / 2 };
}

/**
 * Where a body stands to use a fixture: in front of it, as near as the room
 * lets a body stand, which is a hair inside half a tile off the wall.
 *
 * What the walk to one is aimed at, rather than the fixture itself. A\* walks
 * tile centres, and a stand in a back corner is nearer the middle of the cell
 * outside the side wall than of any cell in the room, so a walk aimed at the
 * stand went round the outside of the house and pressed against the wall
 * behind it, never in reach (`tests/world/house.test.ts` found it). Aimed here,
 * the nearest place to stand is the room's.
 */
export function fixtureAccess(
  house: { x: number; y: number; definition: BuildingDefinition },
  placement: FixturePlacement,
): { x: number; y: number } {
  const room = interiorRect(house);
  const clear = PLAYER_HALF_EXTENT + 1;
  const at = fixturePoint(house, placement);
  return {
    x: Math.min(Math.max(at.x, room.left + clear), room.right - clear),
    y: Math.min(Math.max(at.y, room.top + clear), room.bottom - clear),
  };
}
