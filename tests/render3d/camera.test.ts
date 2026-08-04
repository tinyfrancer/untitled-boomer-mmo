import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../../src/config/constants';
import { TOWN_MAP } from '../../src/data/townMap';
import { signpostPoint } from '../../src/systems/ZoneSystem';
import { worldViewportHeight } from '../../src/ui/layout';
import {
  CAMERA_PITCH,
  cameraDistance,
  createCamera,
  frameCamera,
  projectToScreen,
  resizeCamera,
} from '../../src/render3d/camera';
import { simToWorld } from '../../src/render3d/coords';
import { OrbitGesture } from '../../src/render3d/orbit';

const WORLD = {
  width: TOWN_MAP[0].length * TILE_SIZE,
  height: TOWN_MAP.length * TILE_SIZE,
};
const SPAWN = { x: WORLD.width / 2, y: WORLD.height / 2 };

function screenAt(
  width: number,
  height: number,
  player: { x: number; y: number },
  point: { x: number; y: number },
  yaw = 0,
): { x: number; y: number } {
  const camera = createCamera();
  resizeCamera(camera, width, height);
  frameCamera(camera, player, yaw);
  return projectToScreen(camera, simToWorld(point.x, point.y), width, height);
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
