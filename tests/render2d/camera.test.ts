import { describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { ART_PIXEL, TILE_PIXELS } from '../../src/art/budget';
import { TILE_SIZE } from '../../src/config/constants';
import { ZONES } from '../../src/data/zones';
import {
  Camera2D,
  MAX_CSS_PER_ART,
  TARGET_TILES_ACROSS,
  pixelScale,
} from '../../src/render2d/camera';
import { signpostPoint } from '../../src/systems/ZoneSystem';
import { worldViewportHeight } from '../../src/ui/layout';

const TOWN = ZONES.town;
const WORLD = {
  width: nth(TOWN.map, 0).length * TILE_SIZE,
  height: TOWN.map.length * TILE_SIZE,
};
const SPAWN = TOWN.start;

/** Phones and a small desktop, in CSS pixels and device pixels to one. */
const PHONES = [
  { name: 'a 390-point phone', width: 390, height: 844, dpr: 3 },
  { name: 'a 375-point phone', width: 375, height: 812, dpr: 3 },
  { name: 'a 414-point phone at two', width: 414, height: 896, dpr: 2 },
  { name: 'a 414-point phone at three', width: 414, height: 896, dpr: 3 },
  { name: 'a 360-point phone', width: 360, height: 800, dpr: 2 },
  { name: 'a landscape phone', width: 844, height: 390, dpr: 3 },
  { name: 'a desktop', width: 1280, height: 720, dpr: 1 },
] as const;

/** Screens big enough that ten tiles would draw an art pixel wider than the cap. */
const BIG_SCREENS = [
  { name: 'a 1280x800 desktop', width: 1280, height: 800, dpr: 1 },
  { name: 'a 1920x1080 desktop', width: 1920, height: 1080, dpr: 1 },
  { name: 'a laptop at two', width: 1440, height: 900, dpr: 2 },
  { name: 'a laptop at a quarter over one', width: 1536, height: 864, dpr: 1.25 },
  { name: 'a tablet', width: 820, height: 1180, dpr: 2 },
] as const;

const SCREENS = [...PHONES, ...BIG_SCREENS];

function cameraOn(screen: (typeof SCREENS)[number], player = SPAWN): Camera2D {
  const camera = new Camera2D();
  camera.resize(screen);
  camera.follow(player);
  return camera;
}

describe('pixelScale', () => {
  it("frames the ten tiles across the style guide's examples ask for", () => {
    expect(pixelScale(390, 844, 3)).toBe(4);
    expect(pixelScale(360, 800, 2)).toBe(2);
    expect(pixelScale(1280, 720, 1)).toBe(2);
  });

  it.each(PHONES)('draws $name about ten tiles across its smaller side', (screen) => {
    const scale = pixelScale(screen.width, screen.height, screen.dpr);
    expect(Number.isInteger(scale)).toBe(true);
    const across = (Math.min(screen.width, screen.height) * screen.dpr) / scale / TILE_PIXELS;
    expect(Math.abs(across - TARGET_TILES_ACROSS)).toBeLessThan(3);
  });

  it.each(SCREENS)('never draws an art pixel wider than the cap on $name', (screen) => {
    const scale = pixelScale(screen.width, screen.height, screen.dpr);
    expect(Number.isInteger(scale)).toBe(true);
    expect(scale / screen.dpr).toBeLessThanOrEqual(MAX_CSS_PER_ART);
  });

  /**
   * Ten tiles across a desktop's height drew a figure a hand tall and names at
   * three times the HUD's type, beside a character sheet drawing the same
   * figure at two. A big screen sees more of the world instead.
   */
  it.each(BIG_SCREENS)('shows $name more than ten tiles across its smaller side', (screen) => {
    const scale = pixelScale(screen.width, screen.height, screen.dpr);
    const across = (Math.min(screen.width, screen.height) * screen.dpr) / scale / TILE_PIXELS;
    expect(across).toBeGreaterThan(TARGET_TILES_ACROSS + 2);
  });
});

describe('Camera2D', () => {
  it.each(SCREENS)('covers the whole of $name in whole art pixels', (screen) => {
    const camera = cameraOn(screen);
    expect(camera.artWidth * camera.scale).toBeGreaterThanOrEqual(screen.width * screen.dpr);
    expect(camera.artHeight * camera.scale).toBeGreaterThanOrEqual(screen.height * screen.dpr);
    expect((camera.artWidth - 1) * camera.scale).toBeLessThan(screen.width * screen.dpr);
  });

  it.each(SCREENS)('stands the player in the middle of what can be tapped on $name', (screen) => {
    const camera = cameraOn(screen);
    const player = camera.toScreen(SPAWN.x, SPAWN.y);
    const band = worldViewportHeight(screen.width, screen.height);
    expect(Math.abs(player.x - screen.width / 2)).toBeLessThanOrEqual(camera.cssPerArt);
    expect(Math.abs(player.y - band / 2)).toBeLessThanOrEqual(camera.cssPerArt);
  });

  it('puts north up the screen and east to the right, and never turns', () => {
    const camera = cameraOn(nth(SCREENS, 0));
    const player = camera.toScreen(SPAWN.x, SPAWN.y);
    expect(camera.toScreen(SPAWN.x, SPAWN.y - 200).y).toBeLessThan(player.y);
    expect(camera.toScreen(SPAWN.x + 200, SPAWN.y).x).toBeGreaterThan(player.x);
  });

  it('follows the player to the edge of the map rather than stopping at it', () => {
    const screen = nth(SCREENS, 0);
    const atSpawn = cameraOn(screen).toScreen(SPAWN.x, SPAWN.y);
    const corner = { x: TILE_SIZE, y: TILE_SIZE };
    const atCorner = cameraOn(screen, corner).toScreen(corner.x, corner.y);
    expect(atCorner).toEqual(atSpawn);
  });

  it('draws the player at the same pixel however far between two pixels they are', () => {
    const screen = nth(SCREENS, 0);
    const still = cameraOn(screen).toScreen(SPAWN.x, SPAWN.y);
    for (const nudge of [0.3, 0.9, 1.4, 1.99]) {
      const at = { x: SPAWN.x + nudge, y: SPAWN.y - nudge };
      expect(cameraOn(screen, at).toScreen(at.x, at.y)).toEqual(still);
    }
  });

  it('reads a point on screen back to where it was drawn from, to the art pixel', () => {
    const camera = cameraOn(nth(SCREENS, 0));
    for (const point of [SPAWN, { x: 100, y: 1100 }, { x: 1500, y: 64 }]) {
      const screen = camera.toScreen(point.x, point.y);
      const back = camera.toWorld(screen.x, screen.y);
      expect(Math.abs(back.x - point.x)).toBeLessThanOrEqual(ART_PIXEL);
      expect(Math.abs(back.y - point.y)).toBeLessThanOrEqual(ART_PIXEL);
    }
  });

  /**
   * Held by where the camera puts the player: the tab bar is opaque and eats
   * every tap on it, and the south signpost in town once rendered inside it
   * with no way to reach it.
   */
  describe('the south signpost stays clear of the tab bar', () => {
    const post = signpostPoint('south', WORLD.width, WORLD.height);

    it.each(SCREENS.filter((screen) => screen.height > screen.width))(
      'on $name, with the player on the spawn point',
      (screen) => {
        const barTop = worldViewportHeight(screen.width, screen.height);
        expect(cameraOn(screen).toScreen(post.x, post.y).y).toBeLessThan(barTop);
      },
    );

    it.each(SCREENS)('on $name, from three tiles out', (screen) => {
      const barTop = worldViewportHeight(screen.width, screen.height);
      const near = { x: post.x, y: post.y - TILE_SIZE * 3 };
      expect(cameraOn(screen, near).toScreen(post.x, post.y).y).toBeLessThan(barTop);
    });
  });
});
