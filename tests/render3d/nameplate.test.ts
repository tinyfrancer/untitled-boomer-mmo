import { beforeEach, describe, expect, it } from 'vitest';
import { Group, Mesh, type Object3D } from 'three';
import { Nameplate } from '../../src/render3d/nameplate';
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
