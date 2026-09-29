import { ART_PIXEL } from '../art/budget';
import { buildingArt, buildingPlan, type Picture } from '../art/building';
import { TILE_SIZE } from '../config/constants';
import { buildingRect, doorPoint, isInside } from '../data/buildings';
import type { Point } from '../systems/MovementSystem';
import type { WorldBuilding, WorldNpc, WorldTap } from '../world/ZoneWorld';
import type { Pickable2D, PickRect } from './picking';

/**
 * How near the doorstep counts as standing on it: a tile, the 3D view's
 * number (`render3d/actors.ts`), since it is a rule about the walk to the door
 * rather than about what draws it.
 */
const DOOR_REACH = TILE_SIZE;

/**
 * Turns a picture into something to draw, or into nothing where there is no
 * canvas to draw on: the unit suite asks a building what a tap on it means with
 * no pixels anywhere.
 */
export type Bake = (picture: Picture) => HTMLCanvasElement | null;

interface Baked {
  canvas: HTMLCanvasElement | null;
  /** Where the picture's corner is in the world, in art pixels, and how big it is. */
  left: number;
  top: number;
  width: number;
}

/**
 * One building, drawn: from outside, or with its roof off and its front walls
 * cut down while the player stands in it (`art/building.ts` puts the pictures
 * together). What a tap on it means is the 3D view's answer word for word, and
 * `docs/architecture/buildings.md` has why: whoever works there, or the ground
 * at its door, and nothing at all from inside.
 */
export class BuildingSprite implements Pickable2D {
  readonly building: WorldBuilding;
  readonly baseY: number;
  private readonly counter: WorldNpc | null;
  private readonly outside: Baked;
  private readonly floor: Baked;
  private readonly backWall: Baked;
  private readonly backWallBase: number;
  private inside = false;
  private atDoor = false;

  constructor(building: WorldBuilding, counter: WorldNpc | null, bake: Bake) {
    this.building = building;
    this.counter = counter;
    const rect = buildingRect(building);
    this.baseY = rect.bottom;
    const art = buildingArt(buildingPlan(building));
    const left = Math.round(rect.left / ART_PIXEL);
    const top = Math.round(rect.top / ART_PIXEL);
    const baked = (picture: Picture): Baked => ({
      canvas: bake(picture),
      left: left + picture.left,
      top: top + picture.top,
      width: picture.width,
    });
    this.outside = baked(art.outside);
    this.floor = baked(art.floor);
    this.backWall = baked(art.backWall);
    // The back wall stands at the foot of its inside face, which is where the
    // room begins: anyone in the room is in front of it.
    this.backWallBase = rect.top + buildingPlan(building).wall * ART_PIXEL;
  }

  /** Whether the player is in the room, and whether they are on its doorstep. */
  sync(player: Point): void {
    this.inside = isInside(this.building, player);
    const door = doorPoint(this.building);
    this.atDoor = Math.hypot(player.x - door.x, player.y - door.y) <= DOOR_REACH;
  }

  get isInside(): boolean {
    return this.inside;
  }

  /** The line a standing picture of it is sorted on: its front, or its back wall once inside. */
  get standingBase(): number {
    return this.inside ? this.backWallBase : this.baseY;
  }

  /** The room's floor, drawn with the ground while the player is in it. */
  drawFloor(context: CanvasRenderingContext2D, left: number, top: number): void {
    if (!this.inside || !this.floor.canvas) return;
    context.drawImage(this.floor.canvas, this.floor.left - left, this.floor.top - top);
  }

  /**
   * What stands: the building from outside, or its back wall from inside.
   * Faded while the player is behind it, since you cannot tap what you cannot
   * see and a roof is the one thing big enough to hide them outright.
   */
  drawStanding(
    context: CanvasRenderingContext2D,
    left: number,
    top: number,
    behind: boolean,
  ): void {
    const picture = this.inside ? this.backWall : this.outside;
    if (!picture.canvas) return;
    if (behind && !this.inside) context.globalAlpha = 0.5;
    context.drawImage(picture.canvas, picture.left - left, picture.top - top);
    context.globalAlpha = 1;
  }

  /** The picture from outside, in simulation units: what a thumb aims at and what hides the player. */
  outsideRect(): PickRect {
    return {
      left: this.outside.left * ART_PIXEL,
      top: this.outside.top * ART_PIXEL,
      right: (this.outside.left + this.outside.width) * ART_PIXEL,
      bottom: this.baseY,
    };
  }

  /** Where its sign goes: over the ridge, in art pixels. */
  signAt(): Point {
    return {
      x: this.outside.left + Math.round(this.outside.width / 2),
      y: this.outside.top,
    };
  }

  pickRect(): PickRect | null {
    return this.inside ? null : this.outsideRect();
  }

  tapAnswer(): WorldTap {
    if (this.counter && !this.atDoor) return { kind: 'npc', npc: this.counter };
    const point = this.atDoor
      ? { x: this.building.x, y: this.building.y }
      : doorPoint(this.building);
    return { kind: 'ground', point };
  }

  /** The canvases it was baked onto, for whoever made them to let go. */
  canvases(): HTMLCanvasElement[] {
    return [this.outside.canvas, this.floor.canvas, this.backWall.canvas].flatMap((canvas) =>
      canvas ? [canvas] : [],
    );
  }
}
