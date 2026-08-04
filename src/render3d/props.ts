import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  RingGeometry,
  SphereGeometry,
} from 'three';
import { TILE_SIZE } from '../config/constants';
import { WATER_DEPTH } from './ground';
import { PALETTE } from './palette';
import type { ResourceNode } from '../world/ResourceNode';

/** A gatherable thing, and how it changes once it has been gathered out. */
export interface NodeProp {
  readonly object: Group;
  setAvailable(available: boolean): void;
  /**
   * How much of the view this prop blocks right now, or `null` for one that
   * cannot hide anything. Deliberately not the collision body and not the pick
   * box: what stops you walking is the trunk, what a thumb aims at is a
   * thumb-sized minimum, and what hides the player is the canopy — three
   * different questions about the same tree.
   */
  sightBlock(): { width: number; height: number } | null;
}

export function buildNode(node: ResourceNode): NodeProp {
  return node.definition.solid ? buildTree(node) : buildFishingSpot(node);
}

/**
 * A trunk you cannot walk through and a canopy you can walk under.
 *
 * The trunk is sized from `node.blockerRect()` rather than from the sprite's
 * footprint, so what stops you is what you can see stopping you — the canopy
 * is the wider half and blocks nothing, which is the top-down convention the
 * collision box already encodes.
 */
function buildTree(node: ResourceNode): NodeProp {
  const { width, height } = node.definition.body;
  const blocker = node.blockerRect();
  const trunkRadius = (blocker.right - blocker.left) / 2;
  const trunkHeight = height * 0.62;

  const group = new Group();
  const trunk = new Mesh(
    new CylinderGeometry(trunkRadius * 0.85, trunkRadius, trunkHeight, 7),
    new MeshLambertMaterial({ color: PALETTE.wood }),
  );
  trunk.name = 'trunk';
  trunk.position.y = trunkHeight / 2;
  group.add(trunk);

  const canopy = new Group();
  canopy.name = 'canopy';
  const crown = new Mesh(
    new SphereGeometry(width * 0.42, 10, 8),
    new MeshLambertMaterial({ color: PALETTE.leafDark }),
  );
  crown.position.y = height * 0.76;
  canopy.add(crown);
  const boughs: Array<[number, number, number]> = [
    [-width * 0.22, height * 0.66, width * 0.12],
    [width * 0.24, height * 0.86, -width * 0.1],
  ];
  boughs.forEach(([x, y, z]) => {
    const bough = new Mesh(
      new SphereGeometry(width * 0.26, 8, 6),
      new MeshLambertMaterial({ color: PALETTE.leafLight }),
    );
    bough.position.set(x, y, z);
    canopy.add(bough);
  });
  group.add(canopy);

  // What a gathered-out tree leaves: the same trunk with a cut face on top, so
  // the node does not move when it depletes.
  const cut = new Mesh(
    new CylinderGeometry(trunkRadius * 1.1, trunkRadius * 1.1, trunkHeight * 0.06, 7),
    new MeshLambertMaterial({ color: PALETTE.woodLight }),
  );
  cut.name = 'cut';
  cut.position.y = trunkHeight;
  cut.visible = false;
  group.add(cut);

  // The crown is the widest and highest thing here, so it is what decides how
  // much sky the tree takes up; a felled one is the trunk and nothing else.
  const crownTop = crown.position.y + width * 0.42;

  let standing = true;
  return {
    object: group,
    setAvailable(available) {
      standing = available;
      canopy.visible = available;
      cut.visible = !available;
    },
    sightBlock: () => ({ width, height: standing ? crownTop : trunkHeight }),
  };
}

/**
 * Ripple rings lying on the water's surface.
 *
 * A fishing spot is a marking rather than an object — nothing to walk into, and
 * it sits on a water tile, which the ground mesh sinks by `WATER_DEPTH`. Drawn
 * at ground level it would be buried under the pond.
 */
function buildFishingSpot(node: ResourceNode): NodeProp {
  const size = node.definition.body.width;
  const group = new Group();
  group.position.y = -WATER_DEPTH + 0.5;

  const ripple = (inner: number, outer: number, opacity: number): Mesh => {
    const mesh = new Mesh(
      new RingGeometry(inner, outer, 20),
      new MeshBasicMaterial({ color: PALETTE.ripple, transparent: true, opacity }),
    );
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  };
  group.add(ripple(size * 0.36, size * 0.42, 0.85), ripple(size * 0.2, size * 0.26, 0.55));

  const centre = new Mesh(
    new CircleGeometry(size * 0.08, 12),
    new MeshBasicMaterial({ color: PALETTE.ripple, transparent: true, opacity: 0.7 }),
  );
  centre.rotation.x = -Math.PI / 2;
  group.add(centre);

  return {
    object: group,
    setAvailable(available) {
      group.visible = available;
    },
    // Rings lying flat on the water hide nothing, and they are the one prop
    // drawn transparent on purpose — fading them and restoring them to solid
    // would be the fade putting them back wrong.
    sightBlock: () => null,
  };
}

/**
 * The tappable exit marker. Chunky on purpose: on a phone this is how you leave
 * a zone, so it has to be easy to hit — and PR 15's raycast will pick it by the
 * same geometry a thumb aims at.
 */
export function buildSignpost(): Group {
  const height = TILE_SIZE;
  const group = new Group();

  const post = new Mesh(
    new CylinderGeometry(height * 0.05, height * 0.06, height * 0.78, 6),
    new MeshLambertMaterial({ color: PALETTE.wood }),
  );
  post.position.y = height * 0.39;
  group.add(post);

  const board = new Mesh(
    new BoxGeometry(height * 0.72, height * 0.26, height * 0.06),
    new MeshLambertMaterial({ color: PALETTE.woodLight }),
  );
  board.position.y = height * 0.72;
  group.add(board);

  return group;
}

/** Crossed logs under a flame. The flicker is decoration; the burn clock is the sim's. */
export function buildCampfire(): { object: Group; flicker(elapsedMs: number): void } {
  const size = TILE_SIZE * 0.8;
  const group = new Group();

  [-1, 1].forEach((side) => {
    const log = new Mesh(
      new CylinderGeometry(size * 0.06, size * 0.06, size * 0.62, 6),
      new MeshLambertMaterial({ color: PALETTE.wood }),
    );
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (side * Math.PI) / 5;
    log.position.y = size * 0.06;
    group.add(log);
  });

  const flames = new Group();
  const layers: Array<[number, number, number]> = [
    [size * 0.26, size * 0.58, PALETTE.ember],
    [size * 0.16, size * 0.42, PALETTE.emberMid],
    [size * 0.08, size * 0.28, PALETTE.emberCore],
  ];
  layers.forEach(([radius, tall, color]) => {
    const flame = new Mesh(
      new ConeGeometry(radius, tall, 8),
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    flame.position.y = size * 0.1 + tall / 2;
    flames.add(flame);
  });
  group.add(flames);

  return {
    object: group,
    flicker(elapsedMs) {
      // The same 420ms yoyo the 2D tween runs, on the view's own clock.
      const wobble = Math.sin((elapsedMs / 420) * Math.PI);
      flames.scale.set(1, 0.92 + wobble * 0.14, 1);
    },
  };
}
