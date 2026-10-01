import { PLAYER_HALF_EXTENT, TILE_SIZE } from '../config/constants';
import type { BuildingId } from '../types/ids';
import { interiorRect, type BuildingDefinition, type Rect } from './buildings';

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

/** How many stands there are (F1's answer; F2 may add more). */
export const HOUSE_STANDS = 4;

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

/** Something in the house a tap lands on: a stand by its place in the row, the chest, or the wall. */
export type HouseFixture = { kind: 'stand'; stand: number } | { kind: 'chest' } | { kind: 'wall' };

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
}

const DEPTH = TILE_SIZE / 4;
// The room is 224 by 160 inside: the walls are a quarter tile, the house four
// tiles by three.
const BACK = -80;
const EAST = 112;

/**
 * Two stands against the back wall either side of the chest, with the plaques
 * hung on the wall above it, and two along the east wall. The west wall is the
 * bed's (`art/rooms.ts`), and the south wall is the one the cutaway takes away.
 */
export const HOUSE_FIXTURES: readonly FixturePlacement[] = [
  {
    fixture: { kind: 'stand', stand: 0 },
    rect: { left: -96, right: -64, top: BACK, bottom: BACK + DEPTH },
  },
  {
    fixture: { kind: 'stand', stand: 1 },
    rect: { left: 64, right: 96, top: BACK, bottom: BACK + DEPTH },
  },
  {
    fixture: { kind: 'stand', stand: 2 },
    rect: { left: EAST - DEPTH, right: EAST, top: -40, bottom: -8 },
  },
  {
    fixture: { kind: 'stand', stand: 3 },
    rect: { left: EAST - DEPTH, right: EAST, top: 24, bottom: 56 },
  },
  { fixture: { kind: 'chest' }, rect: { left: -24, right: 24, top: BACK, bottom: BACK + DEPTH } },
  { fixture: { kind: 'wall' }, rect: { left: -56, right: 56, top: BACK, bottom: BACK + DEPTH } },
];

/** One fixture's key, for comparing two of them and naming one in the DOM. */
export function fixtureKey(fixture: HouseFixture): string {
  return fixture.kind === 'stand' ? `stand-${fixture.stand}` : fixture.kind;
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
