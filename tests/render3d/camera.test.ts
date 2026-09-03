import { describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { Vector3 } from 'three';
import { TILE_SIZE } from '../../src/config/constants';
import { TOWN_MAP } from '../../src/data/townMap';
import { signpostPoint } from '../../src/systems/ZoneSystem';
import { worldViewportHeight } from '../../src/ui/layout';
import {
  CAMERA_PITCH,
  cameraDistance,
  createCamera,
  fogRange,
  frameCamera,
  projectToScreen,
  resizeCamera,
} from '../../src/render3d/camera';
import { simToWorld } from '../../src/render3d/coords';
import { OrbitGesture } from '../../src/render3d/orbit';

const WORLD = {
  width: nth(TOWN_MAP, 0).length * TILE_SIZE,
  height: TOWN_MAP.length * TILE_SIZE,
};
const SPAWN = { x: WORLD.width / 2, y: WORLD.height / 2 };

function screenAt(
  width: number,
  height: number,
  player: { x: number; y: number },
  point: { x: number; y: number },
  yaw = 0,
  standing = 0,
): { x: number; y: number } {
  const camera = createCamera();
  resizeCamera(camera, width, height);
  frameCamera(camera, player, yaw);
  return projectToScreen(camera, simToWorld(point.x, point.y).setY(standing), width, height);
}

describe('frameCamera', () => {
  it('stands behind and above the player, on the south side', () => {
    const camera = createCamera();
    resizeCamera(camera, 1280, 900);
    frameCamera(camera, SPAWN);

    expect(camera.position.x).toBeCloseTo(SPAWN.x, 6);
    expect(camera.position.z).toBeGreaterThan(SPAWN.y);
    expect(camera.position.y).toBeCloseTo(
      cameraDistance(camera.aspect) * Math.sin(CAMERA_PITCH),
      6,
    );
  });

  it('keeps the player horizontally centred and above the middle of the screen', () => {
    const player = screenAt(390, 844, SPAWN, SPAWN);
    expect(player.x).toBeCloseTo(195, 0);
    expect(player.y).toBeLessThan(844 / 2);
    expect(player.y).toBeGreaterThan(844 * 0.35);
  });

  it('puts north up the screen and east to the right', () => {
    const north = screenAt(390, 844, SPAWN, { x: SPAWN.x, y: SPAWN.y - 200 });
    const east = screenAt(390, 844, SPAWN, { x: SPAWN.x + 200, y: SPAWN.y });
    const player = screenAt(390, 844, SPAWN, SPAWN);

    expect(north.y).toBeLessThan(player.y);
    expect(east.x).toBeGreaterThan(player.x);
  });

  it('follows the player rather than the world', () => {
    const walked = { x: SPAWN.x + 300, y: SPAWN.y + 300 };
    const under = screenAt(390, 844, walked, walked);
    const atSpawn = screenAt(390, 844, SPAWN, SPAWN);
    expect(under.x).toBeCloseTo(atSpawn.x, 4);
    expect(under.y).toBeCloseTo(atSpawn.y, 4);
  });

  /**
   * The requirement that used to be met by shrinking the 2D world camera to
   * `worldViewportHeight`: the tab bar is opaque HUD furniture that eats every
   * tap landing on it, and the south signpost in town once rendered four pixels
   * inside it on a portrait phone with no way to reach it at all. The 3D canvas
   * is full-bleed — the bar simply sits over it — so the only thing holding
   * this now is how the camera is framed.
   */
  describe('the south signpost stays clear of the tab bar', () => {
    const post = signpostPoint('south', WORLD.width, WORLD.height);

    it.each([
      [390, 844],
      [375, 812],
      [414, 896],
    ])('at %ix%i, with the player on the spawn point', (width, height) => {
      const barTop = worldViewportHeight(width, height);
      expect(screenAt(width, height, SPAWN, post).y).toBeLessThan(barTop);
    });
  });

  /**
   * The drag. Written as consequences on screen rather than as expected values
   * of `camera.position`, for the same reason `facingYaw` is tested by rotating
   * a forward vector and seeing where it lands: a sign error in the yaw and a
   * matching one in the look point cancel out in the arithmetic and are obvious
   * here.
   */
  describe('orbiting', () => {
    const north = { x: SPAWN.x, y: SPAWN.y - 200 };

    /** What a real drag of `dx` pixels is worth, through the gesture itself. */
    const dragYaw = (dx: number): number => {
      const gesture = new OrbitGesture();
      gesture.start(0, 0, 0);
      let yaw = 0;
      const step = Math.sign(dx);
      for (let x = step; Math.abs(x) <= Math.abs(dx); x += step) yaw += gesture.move(x, 0);
      return yaw;
    };

    it('carries the scene the way the thumb went', () => {
      const still = screenAt(390, 844, SPAWN, north);
      const dragged = screenAt(390, 844, SPAWN, north, dragYaw(90));
      expect(dragged.x).toBeGreaterThan(still.x);
      expect(screenAt(390, 844, SPAWN, north, dragYaw(-90)).x).toBeLessThan(still.x);
    });

    it('stands the camera on the far side when turned all the way round', () => {
      // Half a turn puts the camera north of the player, so north is now the
      // near side of the screen rather than the far one.
      const player = screenAt(390, 844, SPAWN, SPAWN, Math.PI);
      expect(screenAt(390, 844, SPAWN, north, Math.PI).y).toBeGreaterThan(player.y);
    });

    it('keeps the player in the same place on screen at every angle', () => {
      const straight = screenAt(390, 844, SPAWN, SPAWN);
      for (const yaw of [0.4, 1.2, Math.PI / 2, 2.5, Math.PI, -1.9]) {
        const turned = screenAt(390, 844, SPAWN, SPAWN, yaw);
        expect(turned.x).toBeCloseTo(straight.x, 4);
        expect(turned.y).toBeCloseTo(straight.y, 4);
      }
    });

    /**
     * The rotation-invariant form of the south-signpost rule below. What that
     * check really asserts is that ground *behind* the player — the side the
     * camera stands on, where the perspective squeezes hardest — stays clear of
     * the tab bar, and once the camera turns, "behind" stops meaning south.
     */
    it('keeps the ground behind the player clear of the tab bar at every angle', () => {
      const post = signpostPoint('south', WORLD.width, WORLD.height);
      const behind = Math.hypot(post.x - SPAWN.x, post.y - SPAWN.y);
      const barTop = worldViewportHeight(390, 844);

      for (const yaw of [0, 0.7, Math.PI / 2, 2.2, Math.PI, -1.1]) {
        const point = {
          x: SPAWN.x - Math.sin(yaw) * behind,
          y: SPAWN.y + Math.cos(yaw) * behind,
        };
        expect(screenAt(390, 844, SPAWN, point, yaw).y).toBeLessThan(barTop);
      }
    });
  });

  /**
   * What the pitch is for, and the only thing holding it from being wound back
   * up. A world unit standing up is worth `cos(pitch)` on screen and one lying
   * flat is worth `sin(pitch)`, so a steep camera spends the screen on ground
   * and draws everything on it as a lid: at 58° a wall was worth 0.62 of its
   * own footprint and a building read as a roof plane. At 45 the two are worth
   * the same, which is the whole of what "the world stands up" means here.
   *
   * The tab bar is the floor under the pitch — ground behind the player has to
   * stay clear of it — and this is the ceiling over it. Between them the angle
   * is a band rather than a number somebody liked.
   */
  it('draws a wall standing up rather than as a line under a roof', () => {
    const ahead = { x: SPAWN.x, y: SPAWN.y - TILE_SIZE * 3 };
    const foot = screenAt(390, 844, SPAWN, ahead).y;
    const standing = foot - screenAt(390, 844, SPAWN, ahead, 0, TILE_SIZE).y;
    const lyingFlat = foot - screenAt(390, 844, SPAWN, { x: ahead.x, y: ahead.y - TILE_SIZE }).y;
    expect(standing / lyingFlat).toBeGreaterThan(0.95);
  });

  /**
   * The floor under the pitch that has nothing to do with the tab bar: the
   * camera is tilted further down than half its field of view, so the horizon
   * is off the top of the screen at every angle. That is what makes every pixel
   * ground, which is what lets `pickTap` fall through to the `y = 0` plane
   * rather than having a tap that hits sky.
   */
  it('keeps the horizon off the top of the screen at every angle', () => {
    for (const [width, height] of [
      [390, 844],
      [844, 390],
    ]) {
      const camera = createCamera();
      resizeCamera(camera, width ?? 0, height ?? 0);
      for (const yaw of [0, 1.1, Math.PI, -2.4]) {
        frameCamera(camera, SPAWN, yaw);
        camera.updateMatrixWorld();
        // The middle of the top edge of the screen, as a direction out of it.
        const top = new Vector3(0, 1, 0.5).unproject(camera).sub(camera.position);
        expect(top.y).toBeLessThan(0);
      }
    }
  });

  /**
   * How much world is on screen sideways, which is the thing a pitch change can
   * move without anybody noticing: framed by its depth, tilting the camera down
   * to 45° also pulled it 17% closer and took a tile and a half off either side.
   * Framed by its width there is nothing for the pitch to spend here.
   */
  it('shows about ten tiles of ground across a portrait phone', () => {
    const eastOf = (tiles: number) =>
      screenAt(390, 844, SPAWN, { x: SPAWN.x + TILE_SIZE * tiles, y: SPAWN.y }).x;
    expect(eastOf(4)).toBeLessThan(390);
    expect(eastOf(6)).toBeGreaterThan(390);
  });

  it('shows more of the long axis, not more of the short one', () => {
    // Seven tiles east of the player is off a portrait phone's screen and
    // inside a landscape one's, because the framing targets the *smaller* axis:
    // both show twelve tiles across it and the longer axis gets what is left.
    const far = { x: SPAWN.x + TILE_SIZE * 7, y: SPAWN.y };
    expect(screenAt(390, 844, SPAWN, far).x).toBeGreaterThan(390);
    expect(screenAt(1280, 900, SPAWN, far).x).toBeLessThan(1280);
  });
});

describe('cameraDistance', () => {
  it('pulls back further the narrower the viewport gets', () => {
    expect(cameraDistance(390 / 844)).toBeGreaterThan(cameraDistance(1280 / 900));
  });

  it('measures a landscape viewport by its height', () => {
    expect(cameraDistance(2)).toBe(cameraDistance(1));
  });
});

describe('fogRange', () => {
  /**
   * The player stands `cameraDistance` from the camera by construction, and the
   * haze deliberately starts *nearer* than that — three's fog ramps on a
   * smoothstep, so the near end of it is flat and the player sits a few percent
   * into a cue that has to reach much further to be worth anything. What must
   * not happen is the player standing anywhere near the middle of the ramp.
   */
  it('has the player barely into the haze rather than in the thick of it', () => {
    const aspect = 390 / 844;
    const { near, far } = fogRange(aspect);
    const atThePlayer = (cameraDistance(aspect) - near) / (far - near);
    expect(atThePlayer).toBeGreaterThan(0);
    expect(atThePlayer).toBeLessThan(0.2);
  });

  /**
   * The cue measured where it is read — in tiles of ground — rather than in the
   * multiples it is written in. A multiple of the camera's distance is only a
   * distance in the world by way of the pitch, so `FOG_FAR` stops meaning what
   * it says the moment the camera moves: at 1.8 under the 45° camera the grass
   * six tiles ahead was 31% hazed where it had been 15, and nothing in this
   * file would have said so.
   */
  describe('measured in tiles ahead of the player', () => {
    /** What the fog shader does: smoothstep over the depth along the view axis. */
    const haze = (tiles: number, width = 390, height = 844): number => {
      const camera = createCamera();
      resizeCamera(camera, width, height);
      frameCamera(camera, SPAWN);
      camera.updateMatrixWorld();
      const point = simToWorld(SPAWN.x, SPAWN.y - tiles * TILE_SIZE);
      const depth = -point.applyMatrix4(camera.matrixWorldInverse).z;
      const { near, far } = fogRange(camera.aspect);
      const along = Math.min(1, Math.max(0, (depth - near) / (far - near)));
      return along * along * (3 - 2 * along);
    };

    it('leaves the ground the player is walking over alone', () => {
      expect(haze(6)).toBeLessThan(0.2);
    });

    it('has the far side of a zone hazed, and still legible', () => {
      // The north edge of town from the spawn point in the middle of it.
      const edge = TOWN_MAP.length / 2;
      expect(haze(edge)).toBeGreaterThan(0.2);
      expect(haze(edge)).toBeLessThan(0.5);
    });

    it('thickens with the distance rather than all at once', () => {
      const along = [0, 3, 6, 9, 12].map((tiles) => haze(tiles));
      for (let i = 1; i < along.length; i += 1) {
        expect(along[i]).toBeGreaterThan(along[i - 1] ?? 0);
      }
    });
  });

  it('starts before it ends, at every viewport shape', () => {
    [390 / 844, 844 / 390, 1, 1280 / 900].forEach((aspect) => {
      const { near, far } = fogRange(aspect);
      expect(far).toBeGreaterThan(near);
    });
  });

  /**
   * Measured in camera distances rather than world units, which is the thing
   * that keeps the cue the same *cue* in both orientations: a landscape camera
   * sits less than half as far back, so a fixed world range would swallow half
   * the zone on one and graze the horizon on the other.
   */
  it('pulls in with the camera when the viewport turns', () => {
    const portrait = fogRange(390 / 844);
    const landscape = fogRange(844 / 390);
    expect(landscape.near).toBeLessThan(portrait.near);
    expect(landscape.far / landscape.near).toBeCloseTo(portrait.far / portrait.near, 6);
  });
});

describe('resizeCamera', () => {
  it('takes its aspect from the box it is drawing into', () => {
    const camera = createCamera();
    resizeCamera(camera, 800, 400);
    expect(camera.aspect).toBe(2);
  });

  it('survives a viewport with no height, which is what a hidden tab reports', () => {
    const camera = createCamera();
    resizeCamera(camera, 800, 0);
    expect(camera.aspect).toBe(1);
  });
});
