import { describe, expect, it } from 'vitest';
import { HUD_FRAMES, HUD_SPRITES, framePicture, type HudFrameName } from '../../src/art/hud';
import { FRAME_ACCENTS } from '../../src/art/sprites/frames';

/**
 * The HUD's frames (`art/hud.ts`, decision 111). The page cuts each in nine
 * and stretches its edges and middle to whatever box it goes round, which is
 * only a picture of the frame if an edge is the same all along its length.
 */

const NAMES = Object.keys(HUD_FRAMES) as HudFrameName[];

function pixel(picture: ReturnType<typeof framePicture>, x: number, y: number): string {
  const at = (y * picture.width + x) * 4;
  return [...picture.pixels.subarray(at, at + 4)].join(',');
}

describe('the frames', () => {
  it.each(NAMES)('%s is drawn, and leaves a middle between its slices', (name) => {
    const picture = framePicture(name);
    const { slice } = HUD_FRAMES[name];
    expect(picture.width - 2 * slice).toBeGreaterThanOrEqual(1);
    expect(picture.height - 2 * slice).toBeGreaterThanOrEqual(1);
  });

  it.each(NAMES)('%s has edges the same all along, and a middle of one colour', (name) => {
    const picture = framePicture(name);
    const { slice } = HUD_FRAMES[name];
    const { width, height } = picture;
    for (let x = slice; x < width - slice; x += 1) {
      for (let y = 0; y < slice; y += 1) {
        expect(pixel(picture, x, y), `top ${x},${y}`).toBe(pixel(picture, slice, y));
        const bottom = height - 1 - y;
        expect(pixel(picture, x, bottom), `bottom ${x},${bottom}`).toBe(
          pixel(picture, slice, bottom),
        );
      }
    }
    for (let y = slice; y < height - slice; y += 1) {
      for (let x = 0; x < slice; x += 1) {
        expect(pixel(picture, x, y), `left ${x},${y}`).toBe(pixel(picture, x, slice));
        const right = width - 1 - x;
        expect(pixel(picture, right, y), `right ${right},${y}`).toBe(pixel(picture, right, slice));
      }
    }
    const middle = new Set<string>();
    for (let y = slice; y < height - slice; y += 1) {
      for (let x = slice; x < width - slice; x += 1) middle.add(pixel(picture, x, y));
    }
    expect([...middle]).toHaveLength(1);
  });

  // The face a panel's rows and buttons stand on is solid, or the world
  // shows through what is being read.
  it('fills the middle of every panel and button', () => {
    for (const name of NAMES) {
      const picture = framePicture(name);
      const { slice } = HUD_FRAMES[name];
      expect(pixel(picture, slice, slice).split(',')[3], name).toBe('255');
    }
  });

  it('says which counter is up by its accent alone', () => {
    const faces = FRAME_ACCENTS.map((accent) => framePicture(`panel-${accent}`).pixels.join());
    expect(new Set([framePicture('panel').pixels.join(), ...faces]).size).toBe(
      FRAME_ACCENTS.length + 1,
    );
  });

  it('draws every frame it names from a sprite it holds', () => {
    for (const name of NAMES) {
      const base = HUD_FRAMES[name].sprite.split('@')[0];
      expect(
        HUD_SPRITES.map(({ id }) => id),
        name,
      ).toContain(base);
    }
  });
});
