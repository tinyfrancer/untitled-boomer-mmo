import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  SphereGeometry,
} from 'three';
import { TILE_SIZE } from '../config/constants';
import { stickFigure } from '../systems/AppearanceSystem';
import { FIGURE_HEIGHT, buildFigure, type Figure } from './figure';
import { PALETTE, beastLook, humanoidLook, type BeastLook, type PersonLook } from './palette';
import type { EnemyDefinition } from '../data/enemies';

/**
 * What draws an enemy, in the same shape a person is drawn in — position, a
 * height for its nameplate, and legs that do something while it moves.
 *
 * The footprint of each one comes from `EnemyDefinition.body`, which is the box
 * `CollisionSystem` stops the player at. Sizing the mesh off anything else is
 * how a creature ends up visibly wider than the thing you can actually walk
 * into — and the body is data precisely so how big a rat looks is never what
 * decides how big a rat is.
 *
 * Which body it is comes from the data too, as `shape` — a switch over the id
 * would have made every new `ENEMIES` row a change to this file.
 */
export function buildCreature(definition: EnemyDefinition): Figure {
  switch (definition.shape) {
    case 'quadruped':
      return buildQuadruped(definition, beastLook(definition.id, 'quadruped'));
    case 'crustacean':
      return buildCrustacean(definition, beastLook(definition.id, 'crustacean'));
    case 'humanoid':
      return buildHumanoid(definition, humanoidLook(definition.id));
  }
}

/**
 * Long and low, nose forward and tail behind — so the box's long side is its
 * forward axis (+z, which `facingYaw` turns onto the heading) and the short one
 * is across.
 */
function buildQuadruped(definition: EnemyDefinition, look: BeastLook): Figure {
  const length = definition.body.width;
  const width = definition.body.height;
  const height = width * 0.72;
  const fur = (): MeshLambertMaterial => new MeshLambertMaterial({ color: look.body });
  const trim = (): MeshLambertMaterial => new MeshLambertMaterial({ color: look.limb });

  const group = new Group();
  const body = new Mesh(new BoxGeometry(width, height, length * 0.6), fur());
  body.position.y = height / 2;
  group.add(body);

  const head = new Mesh(new BoxGeometry(width * 0.6, height * 0.7, length * 0.2), fur());
  head.position.set(0, height * 0.55, length * 0.38);
  group.add(head);

  [-1, 1].forEach((side) => {
    const ear = new Mesh(new BoxGeometry(width * 0.18, height * 0.3, width * 0.1), trim());
    ear.position.set(side * width * 0.2, height * 0.95, length * 0.34);
    group.add(ear);
    const eye = new Mesh(
      new SphereGeometry(width * 0.06, 6, 5),
      new MeshLambertMaterial({ color: PALETTE.eye }),
    );
    eye.position.set(side * width * 0.18, height * 0.62, length * 0.44);
    group.add(eye);
  });

  // Trailing off the rump and kinked up, and still inside the collision box,
  // which is a tile and a quarter long precisely because the tail has to live
  // somewhere.
  const tail = new Mesh(new CylinderGeometry(width * 0.05, width * 0.03, length * 0.3, 5), trim());
  tail.rotation.x = Math.PI / 2.4;
  tail.position.set(0, height * 0.5, -length * 0.3);
  group.add(tail);

  return bobbing(group, height * 1.3, height * 0.06);
}

/** Wider than it is long, claws forward, riding low on splayed legs. */
function buildCrustacean(definition: EnemyDefinition, look: BeastLook): Figure {
  const width = definition.body.width;
  const length = definition.body.height;
  const height = length * 0.55;

  const group = new Group();
  const shell = new Mesh(
    new SphereGeometry(1, 12, 8),
    new MeshLambertMaterial({ color: look.body }),
  );
  shell.scale.set(width * 0.35, height * 0.6, length * 0.4);
  shell.position.y = height * 0.62;
  group.add(shell);

  [-1, 1].forEach((side) => {
    const claw = new Mesh(
      new SphereGeometry(width * 0.11, 8, 6),
      new MeshLambertMaterial({ color: look.limb }),
    );
    claw.position.set(side * width * 0.38, height * 0.5, length * 0.34);
    group.add(claw);

    // Three splayed legs a side.
    [-0.18, 0, 0.18].forEach((along) => {
      const leg = new Mesh(
        new CylinderGeometry(width * 0.02, width * 0.02, width * 0.24, 4),
        new MeshLambertMaterial({ color: look.limb }),
      );
      leg.rotation.z = Math.PI / 2.6;
      leg.position.set(side * width * 0.28, height * 0.3, along * length);
      leg.rotation.y = side * along * 2;
      group.add(leg);
    });

    const eye = new Mesh(
      new SphereGeometry(width * 0.035, 6, 5),
      new MeshLambertMaterial({ color: PALETTE.eye }),
    );
    eye.position.set(side * width * 0.09, height * 0.95, length * 0.18);
    group.add(eye);
  });

  return bobbing(group, height * 1.5, height * 0.08);
}

/**
 * A person, in outlaw colours, with the bandana the rig has no room for — at
 * the size its body says it is.
 *
 * Everyone drawn this way stood exactly `FIGURE_HEIGHT` tall while there was
 * one of them; the height comes off the collision footprint now, so a creature
 * that takes up half again the room a bandit does looks it. Same direction as
 * everything else here: how big it is decides how big it looks, never the other
 * way round.
 */
function buildHumanoid(definition: EnemyDefinition, look: PersonLook): Figure {
  const size = FIGURE_HEIGHT * (definition.body.width / TILE_SIZE);
  const figure = buildFigure(look.appearance, size);
  const rig = stickFigure(size);
  const mask = new Mesh(
    new BoxGeometry(rig.headRadius * 1.7, rig.headRadius * 0.75, rig.headRadius * 1.7),
    new MeshLambertMaterial({ color: look.mask }),
  );
  mask.position.y = rig.footY - rig.headCenterY - rig.headRadius * 0.35;
  figure.object.add(mask);
  return figure;
}

/**
 * A beast's walk. It has no hips to swing, so moving bobs it instead — enough
 * that a scuttling crab reads as alive, and it costs one sine.
 */
function bobbing(group: Group, height: number, amplitude: number): Figure {
  const BOB_PERIOD_MS = 320;
  let walkingNow = false;
  let phase = 0;

  return {
    object: group,
    height,
    stride(walking, elapsedMs) {
      walkingNow = walking;
      const swing = walking ? Math.sin((elapsedMs / BOB_PERIOD_MS) * Math.PI * 2) : 0;
      group.position.y = Math.abs(swing) * amplitude;
      phase = !walking ? 0 : swing >= 0 ? 1 : 2;
    },
    pose() {
      return `${walkingNow ? 'walk' : 'stand'}:${phase}`;
    },
  };
}
