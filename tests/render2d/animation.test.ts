import { describe, expect, it } from 'vitest';
import { PLACEHOLDERS, SPRITES } from '../../src/art/index';
import { RAT } from '../../src/art/sprites/rat';
import { Motion, deathPose, facingOf, frameIndex, playMs } from '../../src/render2d/animation';
import { RANGER, WARRIOR, WIZARD, starting } from '../art/outfits';

const SHOPKEEPER = SPRITES.find((def) => def.id === 'shopkeeper');
if (!SHOPKEEPER) throw new Error('the shopkeeper is not drawn');

describe('facingOf', () => {
  it('faces the way it mostly moves, and keeps facing that way standing still', () => {
    expect(facingOf(3, 1, 'down')).toBe('right');
    expect(facingOf(-3, 1, 'down')).toBe('left');
    expect(facingOf(1, -3, 'down')).toBe('up');
    expect(facingOf(1, 3, 'up')).toBe('down');
    expect(facingOf(0, 0, 'left')).toBe('left');
  });
});

describe('frameIndex', () => {
  it("plays a walk round on the budget's clock", () => {
    // Four frames of 150ms.
    expect(frameIndex(WARRIOR, 'walk', 0)).toBe(0);
    expect(frameIndex(WARRIOR, 'walk', 160)).toBe(1);
    expect(frameIndex(WARRIOR, 'walk', 600)).toBe(0);
  });

  it('holds a one-off on its last frame', () => {
    expect(frameIndex(RAT, 'death', 10_000)).toBe(2);
    expect(playMs(RAT, 'death')).toBe(450);
  });
});

describe('Motion', () => {
  it('breathes standing still, and walks moving', () => {
    const motion = new Motion();
    expect(motion.pose(WARRIOR, 0, 0, 0).animation).toBe('idle');
    expect(motion.pose(WARRIOR, 0, 10, 0)).toMatchObject({ animation: 'walk', facing: 'right' });
  });

  it('turns to swing at what it swung at, plays the blow through once, then stands', () => {
    const motion = new Motion();
    motion.strike(1000, 0, -40);
    expect(motion.pose(WARRIOR, 1000, 0, 0)).toMatchObject({ animation: 'attack', facing: 'up' });
    expect(motion.pose(WARRIOR, 1150, 0, 0)).toMatchObject({ animation: 'attack', index: 1 });
    expect(motion.pose(WARRIOR, 1000 + playMs(WARRIOR, 'attack'), 0, 0)).toMatchObject({
      animation: 'idle',
      facing: 'up',
    });
  });

  it('flinches when struck', () => {
    const motion = new Motion();
    motion.flinch(0);
    expect(motion.pose(RAT, 50, 0, 0).animation).toBe('hurt');
    expect(motion.pose(RAT, 200, 0, 0).animation).toBe('idle');
  });

  it('casts and shoots with the figures that do, and swings with the ones that do not', () => {
    const motion = new Motion();
    motion.strike(0, 0, 10, 'cast');
    expect(motion.pose(WIZARD, 10, 0, 0).animation).toBe('cast');
    // A shield on the other arm leaves no hand to cast from, so a spell is a swing.
    expect(motion.pose(starting('warrior', { offhand: 'brown-shield' }), 10, 0, 0).animation).toBe(
      'attack',
    );
    motion.strike(0, 0, 10, 'shoot');
    expect(motion.pose(RANGER, 10, 0, 0).animation).toBe('shoot');
  });

  it('goes on standing when told of a moment its sprite has not drawn', () => {
    const motion = new Motion();
    motion.strike(0, 10, 0);
    expect(motion.pose(SHOPKEEPER, 10, 0, 0)).toMatchObject({ animation: 'idle', facing: 'right' });
  });
});

describe('deathPose', () => {
  it('falls on the world clock, drawn once whichever way it faced', () => {
    expect(deathPose(RAT, 0)).toEqual({ animation: 'death', facing: null, index: 0 });
    expect(deathPose(PLACEHOLDERS.beast, 400)).toEqual({
      animation: 'death',
      facing: null,
      index: 2,
    });
  });
});
