import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { facingYaw, simToWorld, worldToSim } from '../../src/render3d/coords';

describe('simToWorld', () => {
  it('maps the simulation plane onto the ground plane, one pixel per unit', () => {
    const point = simToWorld(800, 608);
    expect(point.x).toBe(800);
    expect(point.y).toBe(0);
    expect(point.z).toBe(608);
  });

  it('puts height on the axis the simulation does not have', () => {
    expect(simToWorld(10, 20, 32).y).toBe(32);
  });

  it('round-trips through worldToSim', () => {
    expect(worldToSim(simToWorld(123, -45, 7))).toEqual({ x: 123, y: -45 });
  });

  it('reads a point that came out of the scene, height and all', () => {
    expect(worldToSim(new Vector3(64, 12, 128))).toEqual({ x: 64, y: 128 });
  });
});

// The sign trap the port plan warned would cost a day. A mesh whose forward is
// +z has to end up pointing the way the simulation says it is moving.
describe('facingYaw', () => {
  const cardinals: Array<[string, number, number, number]> = [
    ['south, which the default camera looks along', 0, 1, 0],
    ['east', 1, 0, Math.PI / 2],
    ['north', 0, -1, Math.PI],
    ['west', -1, 0, -Math.PI / 2],
  ];

  it.each(cardinals)('faces %s', (_name, vx, vy, expected) => {
    expect(facingYaw(vx, vy)).toBeCloseTo(expected, 6);
  });

  it('turns a mesh forward onto the heading it was given', () => {
    const heading = { vx: 3, vy: -4 };
    const forward = new Vector3(0, 0, 1).applyAxisAngle(
      new Vector3(0, 1, 0),
      facingYaw(heading.vx, heading.vy),
    );
    expect(forward.x).toBeCloseTo(0.6, 6);
    expect(forward.z).toBeCloseTo(-0.8, 6);
  });

  it('keeps the facing it had when nothing is moving', () => {
    expect(facingYaw(0, 0, 1.25)).toBe(1.25);
    expect(facingYaw(0, 0)).toBe(0);
  });
});
