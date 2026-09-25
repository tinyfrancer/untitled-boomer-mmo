import { beforeEach, describe, expect, it } from 'vitest';
import { Group, Mesh, type Object3D } from 'three';
import { DEFAULT_LABEL_HEIGHT, Nameplate } from '../../src/render3d/nameplate';
import { FIELD_OF_VIEW, cameraDistance } from '../../src/render3d/camera';
import { PLAYER_PLATE } from '../../src/render3d/actors';
import { stubCanvas } from './canvasStub';

const WIDTH = 64;
const HEIGHT = 10;

/** The bar meshes of one group: the backing and the fill that drains over it. */
function fillOf(root: Object3D): Mesh {
  const bars = root.children.filter((child): child is Mesh => child instanceof Mesh);
  expect(bars).toHaveLength(2);
  // The fill is the one pushed in front of the backing.
  return bars[1]!;
}

function manaGroup(plate: Nameplate): Group {
  const group = plate.object.children.find((child): child is Group => child instanceof Group);
  if (!group) throw new Error('the plate has no mana bar');
  return group;
}

beforeEach(stubCanvas);

describe('the health bar', () => {
  it('drains off the right end rather than from both', () => {
    const plate = new Nameplate(20, { width: WIDTH, height: HEIGHT });
    const fill = fillOf(plate.object);

    plate.setHealth(10, 10);
    expect(fill.scale.x).toBe(WIDTH);
    expect(fill.position.x).toBeCloseTo(0, 10);

    plate.setHealth(5, 10);
    expect(fill.scale.x).toBe(WIDTH / 2);
    // Scaling a centred plane eats both ends, so the fill slides left by half
    // of what it lost — otherwise a half-full bar would be centred in its slot.
    expect(fill.position.x).toBe(-WIDTH / 4);

    plate.setHealth(0, 10);
    expect(fill.visible).toBe(false);
  });
});

/**
 * A plate takes its whole stack in when it is asked to squish, rather than
 * shrinking the bar and keeping a mob's gaps around it. Every line is a
 * fraction of the bar or the name it hangs off, so one number does it.
 */
describe('squishing a plate', () => {
  const spriteY = (plate: Nameplate, kind: string): number => {
    const sprite = plate.object.children.find((child) => child.userData.kind === kind);
    if (!sprite) throw new Error(`no ${kind} on the plate`);
    return sprite.position.y;
  };

  const built = (options: object): Nameplate => {
    const plate = new Nameplate(20, options);
    plate.setLabel('Adventurer', '#ffffff');
    plate.setTitle('Rat Slayer', '#ffd54f');
    return plate;
  };

  it('pulls every line closer to the bar rather than only shrinking one', () => {
    const roomy = built({ width: WIDTH, height: HEIGHT, manaBar: true });
    const squished = built({ width: 54, height: 7, labelHeight: 10, manaBar: true });

    expect(spriteY(squished, 'label')).toBeLessThan(spriteY(roomy, 'label'));
    expect(spriteY(squished, 'title')).toBeLessThan(spriteY(roomy, 'title'));
    expect(manaGroup(squished).position.y).toBeGreaterThan(manaGroup(roomy).position.y);
  });

  // The bar is still the thing at the origin that everything else is measured
  // from, and the title still goes under the name rather than through it.
  it('keeps the order of the stack it took in', () => {
    const barHeight = 7;
    const squished = built({ width: 54, height: barHeight, labelHeight: 10, manaBar: true });

    expect(spriteY(squished, 'label')).toBeGreaterThan(spriteY(squished, 'title'));
    // Clear of the top of the bar, which stays at the origin, and the pool
    // still below it.
    expect(spriteY(squished, 'title')).toBeGreaterThan(barHeight / 2);
    expect(manaGroup(squished).position.y).toBeLessThan(-barHeight / 2);
  });
});

describe('the mana bar', () => {
  it('hangs under the health bar, which does not move for it', () => {
    const bare = new Nameplate(20, { width: WIDTH, height: HEIGHT });
    const pooled = new Nameplate(20, { width: WIDTH, height: HEIGHT, manaBar: true });

    // The one thing on a plate read at a glance mid-fight stays where the eye
    // already is, exactly as it does when a title is put on.
    expect(fillOf(pooled.object).position.y).toBe(fillOf(bare.object).position.y);
    expect(manaGroup(pooled).position.y).toBeLessThan(-HEIGHT / 2);
  });

  it('drains the same way the health bar does', () => {
    const plate = new Nameplate(20, { width: WIDTH, height: HEIGHT, manaBar: true });
    const fill = fillOf(manaGroup(plate));

    plate.setMana(30, 30);
    expect(fill.scale.x).toBe(WIDTH);

    plate.setMana(15, 30);
    expect(fill.scale.x).toBe(WIDTH / 2);
    expect(fill.position.x).toBe(-WIDTH / 4);
  });

  // A warrior has no pool at all, and an empty bar under their feet would read
  // as a caster who is out of mana.
  it('disappears outright for a class with no pool', () => {
    const plate = new Nameplate(20, { width: WIDTH, height: HEIGHT, manaBar: true });

    plate.setMana(0, 0);
    expect(manaGroup(plate).visible).toBe(false);

    plate.setMana(5, 30);
    expect(manaGroup(plate).visible).toBe(true);
  });

  it('is left off every plate that did not ask for one', () => {
    const plate = new Nameplate(20, { width: WIDTH, height: HEIGHT });
    expect(plate.object.children.some((child) => child instanceof Group)).toBe(false);
    // A shopkeeper's plate has neither bar and must not throw for being asked.
    expect(() => new Nameplate(20, { healthBar: false }).setMana(1, 1)).not.toThrow();
  });
});

/**
 * What a name comes out as on the phone the game is laid out for. Held in pixels
 * rather than world units, because a world unit is worth whatever the camera
 * makes it: a portrait camera stands a long way back to fit ten tiles across,
 * and the twelve units a name used to be came out five pixels tall there.
 */
describe('a name on a portrait phone', () => {
  const PHONE = { width: 390, height: 844 };
  // A baked line is the glyphs plus the room either side of them.
  const GLYPH_FRACTION = 1 / 1.4;
  const pixelsPerUnit = (): number => {
    const distance = cameraDistance(PHONE.width / PHONE.height);
    const halfFov = (FIELD_OF_VIEW * Math.PI) / 360;
    return PHONE.height / (2 * distance * Math.tan(halfFov));
  };

  it('is at least nine pixels of glyph over a creature', () => {
    expect(DEFAULT_LABEL_HEIGHT * GLYPH_FRACTION * pixelsPerUnit()).toBeGreaterThanOrEqual(9);
  });

  it('is at least seven over the player, whose plate is squished on purpose', () => {
    expect(PLAYER_PLATE.labelHeight * GLYPH_FRACTION * pixelsPerUnit()).toBeGreaterThanOrEqual(7);
    expect(PLAYER_PLATE.labelHeight).toBeLessThan(DEFAULT_LABEL_HEIGHT);
  });
});
