import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nth } from '../nth';
import { Sprite, type Material, type Mesh, type Object3D } from 'three';
import { FxLayer } from '../../src/render3d/fx';
import { FLOAT_TONE_COLORS } from '../../src/ui/theme';
import { lastPainted, stubCanvas, type Painted } from './canvasStub';
import type { WorldEvent } from '../../src/world/worldEvents';

const AT = { x: 300, y: 500 };

/** What every float in flight is currently saying, oldest first. */
function texts(painted: Painted[]): string[] {
  return painted.map((entry) => entry.text);
}

function opacityOf(object: Object3D): number {
  return ((object as Mesh).material as Material).opacity;
}

describe('FxLayer', () => {
  let painted: Painted[];
  beforeEach(() => {
    painted = stubCanvas();
  });

  it('floats a number that rises and fades, and hands it back when it is done', () => {
    const fx = new FxLayer();
    fx.update(0);
    fx.float(AT, '-7', 'damage');

    const sprite = nth(fx.object.children, 0);
    expect(fx.count()).toBe(1);
    expect(sprite.position.x).toBe(AT.x);
    expect(sprite.position.z).toBe(AT.y);
    // Over a standing figure's head rather than at its feet, which is all the
    // point a `hit` carries.
    const bornAt = sprite.position.y;
    expect(bornAt).toBeGreaterThan(0);
    expect(opacityOf(sprite)).toBe(1);

    fx.update(300);
    expect(sprite.position.y).toBeGreaterThan(bornAt);
    expect(opacityOf(sprite)).toBeCloseTo(0.5, 3);

    const freed = vi.spyOn((sprite as Sprite).material, 'dispose');
    fx.update(600);
    expect(fx.count()).toBe(0);
    expect(fx.object.children).toHaveLength(0);
    expect(freed).toHaveBeenCalled();
  });

  // A dropped frame must not leave an effect stranded: progress is read off the
  // clock, so an effect that gets four frames plays the same as one that gets
  // forty. This is the 7fps phone, asked for rather than throttled into being.
  it('draws an effect where its clock says, however few frames it gets', () => {
    const fx = new FxLayer();
    fx.update(1000);
    fx.bolt({ x: 0, y: 0 }, { x: 180, y: 0 });
    const bolt = nth(fx.object.children, 0);

    fx.update(1090);
    expect(bolt.position.x).toBeCloseTo(90, 3);
    expect(bolt.position.z).toBe(0);

    // Landed and gone, in a single 140ms frame rather than the ten it would
    // have taken at 60fps.
    fx.update(1230);
    expect(fx.count()).toBe(0);
  });

  it('takes its colours from the table both renderers read', () => {
    const fx = new FxLayer();
    fx.float(AT, '+4', 'heal');
    expect(lastPainted(painted).color).toBe(FLOAT_TONE_COLORS.heal);

    fx.float(AT, '-4', 'player-damage');
    expect(lastPainted(painted).color).toBe(FLOAT_TONE_COLORS['player-damage']);
  });

  it('drops everything in flight when the zone under it is torn down', () => {
    const fx = new FxLayer();
    fx.float(AT, '-1', 'damage');
    fx.bolt(AT, { x: 0, y: 0 });
    expect(fx.count()).toBe(2);

    fx.clear();
    expect(fx.count()).toBe(0);
    expect(fx.object.children).toHaveLength(0);
  });
});

describe('what a WorldEvent is drawn as', () => {
  let painted: Painted[];
  beforeEach(() => {
    painted = stubCanvas();
  });

  const hit = (over: Partial<Extract<WorldEvent, { kind: 'hit' }>> = {}): WorldEvent => ({
    kind: 'hit',
    on: 'mob',
    via: 'weapon',
    at: AT,
    damage: 6,
    absorbed: 0,
    ...over,
  });

  it('shows the damage a swing did', () => {
    const fx = new FxLayer();
    fx.draw(hit());
    expect(texts(painted)).toEqual(['-6']);
    expect(lastPainted(painted).color).toBe(FLOAT_TONE_COLORS.damage);
  });

  // Being hit and hitting are the same event with `on` the other way round, and
  // reading which is which at a glance is the whole job of the colour.
  it('shows damage to the player in their own colour', () => {
    const fx = new FxLayer();
    fx.draw(hit({ on: 'player' }));
    expect(lastPainted(painted).color).toBe(FLOAT_TONE_COLORS['player-damage']);
  });

  it('marks a spell apart from a swing', () => {
    const fx = new FxLayer();
    fx.draw(hit({ via: 'ability' }));
    expect(lastPainted(painted).color).toBe(FLOAT_TONE_COLORS.reward);
  });

  // A mana shield eats part of a swing, and both halves have to be readable:
  // what it soaked, and what got through anyway.
  it('shows a soak and the wound under it as two numbers, one above the other', () => {
    const fx = new FxLayer();
    fx.draw(hit({ on: 'player', damage: 6, absorbed: 4 }));

    expect(texts(painted)).toEqual(['(4 absorbed)', '-2']);
    expect(fx.count()).toBe(2);
    const soak = nth(fx.object.children, 0);
    const wound = nth(fx.object.children, 1);
    expect(soak.position.y).toBeGreaterThan(wound.position.y);
  });

  it('says nothing when a shield ate the whole swing', () => {
    const fx = new FxLayer();
    fx.draw(hit({ on: 'player', damage: 4, absorbed: 4 }));
    expect(texts(painted)).toEqual(['(4 absorbed)']);
  });

  it('names the skill that turned a swing aside, and what a heal restored', () => {
    const fx = new FxLayer();
    fx.draw({ kind: 'defend', at: AT, skillName: 'Parry' });
    expect(lastPainted(painted).text).toBe('Parry');

    fx.draw({ kind: 'heal', at: AT, amount: 9 });
    expect(lastPainted(painted).text).toBe('+9');
  });

  it('passes a plain float through with the tone it was given', () => {
    const fx = new FxLayer();
    fx.draw({ kind: 'float', at: AT, text: 'Fishing up', tone: 'skill' });
    expect(lastPainted(painted)).toEqual({ text: 'Fishing up', color: FLOAT_TONE_COLORS.skill });
  });

  it('throws a bolt from the caster to the target', () => {
    const fx = new FxLayer();
    fx.update(0);
    fx.draw({ kind: 'bolt-cast', abilityId: 'fireball', from: { x: 0, y: 0 }, to: AT });

    const bolt = nth(fx.object.children, 0);
    expect(bolt.position.x).toBe(0);
    fx.update(180 / 2);
    expect(bolt.position.x).toBeCloseTo(AT.x / 2, 3);
    expect(bolt.position.z).toBeCloseTo(AT.y / 2, 3);
  });

  // These are either already visible in the state the actors sync to, or the
  // session's to act on. Drawing them here would be drawing them twice.
  it('draws nothing for the events that are not moments', () => {
    const fx = new FxLayer();
    fx.draw({ kind: 'zone-exit', to: 'beach', edge: 'south', fraction: 0.5 });
    fx.draw({ kind: 'gather-tick', at: AT, nodeId: 'tree', progress: 0.4 });
    expect(fx.count()).toBe(0);
    expect(painted).toHaveLength(0);
  });
});
