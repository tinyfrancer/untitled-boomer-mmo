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
import { itemIcon } from '../ui/itemIcons';
import { WATER_DEPTH } from './ground';
import { castsShadow } from './lights';
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

/**
 * Which body a node is drawn with comes from the data, as `shape` — the same
 * bargain `buildCreature` makes, and the reason a switch over the id is what
 * this is not: a vein picked out by `solid` would have been drawn as a tree.
 */
export function buildNode(node: ResourceNode): NodeProp {
  switch (node.definition.shape) {
    case 'tree':
      return buildTree(node);
    case 'ripple':
      return buildFishingSpot(node);
    case 'vein':
      return buildVein(node);
  }
}

/**
 * A trunk you cannot walk through and a canopy you can walk under.
 *
 * The trunk is sized from `node.blockerRect()` rather than from the node's
 * whole footprint, so what stops you is what you can see stopping you — the
 * canopy is the wider half and blocks nothing, which is the convention the
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
    object: castsShadow(group),
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
    // The one prop that casts nothing. It is drawn transparent on purpose and
    // lies flat on the water, so what it would cast is a hard ring of shadow
    // on the pond bed under something you can see through — which reads as a
    // bug rather than as a fishing spot.
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
 * An outcrop of rock with the metal still showing in it, sized off the blocker
 * for the reason the trunk is: what stops you should be what you can see
 * stopping you.
 *
 * What a mined-out vein leaves is the rock with the metal gone — the same
 * bargain the felled tree makes with its stump, and for the same reason. A node
 * that vanished on the last swing would take with it the thing a player aims at
 * to check whether it is back yet.
 */
function buildVein(node: ResourceNode): NodeProp {
  const { height } = node.definition.body;
  const blocker = node.blockerRect();
  const span = blocker.right - blocker.left;
  const rockHeight = height * 0.72;

  const group = new Group();
  const rock = new Mesh(
    // Six-sided and squashed, which is a boulder where the smooth sphere the
    // canopy is built from would read as a bush without its leaves.
    new SphereGeometry(span / 2, 6, 4),
    new MeshLambertMaterial({ color: PALETTE.stone, flatShading: true }),
  );
  rock.name = 'rock';
  rock.scale.y = rockHeight / span;
  rock.position.y = rockHeight / 2;
  group.add(rock);

  // The seam itself: a handful of nuggets sat proud of the rock's shoulders,
  // which is the only thing telling a tin vein from an iron one at any distance
  // anyone plays at.
  const seam = new Group();
  seam.name = 'seam';
  const nuggets: Array<[number, number, number, number]> = [
    [-span * 0.16, rockHeight * 0.74, span * 0.14, 0.13],
    [span * 0.22, rockHeight * 0.56, -span * 0.1, 0.11],
    [span * 0.02, rockHeight * 0.86, -span * 0.2, 0.09],
  ];
  nuggets.forEach(([x, y, z, radius]) => {
    const nugget = new Mesh(
      new SphereGeometry(span * radius, 6, 5),
      new MeshLambertMaterial({ color: nodeOreColor(node), flatShading: true }),
    );
    nugget.position.set(x, y, z);
    seam.add(nugget);
  });
  group.add(seam);

  return {
    object: castsShadow(group),
    setAvailable(available) {
      seam.visible = available;
    },
    // The rock is there whether or not the metal is, so what it hides never
    // changes — unlike a tree, which is a canopy one swing and a stump the next.
    sightBlock: () => ({ width: span, height: rockHeight }),
  };
}

/**
 * What the metal in a vein is drawn in: the colour of the ore it yields, read
 * off the bag's own palette rather than chosen here.
 *
 * This is the one thing about a prop that is not the renderer's to decide, and
 * it is the same argument `TILE_COLORS` makes: which metal is in the rock is a
 * fact the whole game shares, and a lump of tin that is grey in the pack and
 * rust-red in the ground is two answers to one question.
 */
function nodeOreColor(node: ResourceNode): number {
  return itemIcon(node.definition.yieldItemId).color;
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

  return castsShadow(group);
}

/**
 * The forge: an anvil on a stone block, with the coals glowing beside it.
 *
 * Built rather than lit, and drawn to say so — a campfire is logs and a flame
 * where this is a squat mass of stone and iron. It never flickers, because
 * unlike a fire there is no clock on it: the zone came with it and it is still
 * there when the player walks back.
 */
export function buildForge(): Group {
  const size = TILE_SIZE;
  const group = new Group();

  const base = new Mesh(
    new BoxGeometry(size * 0.9, size * 0.42, size * 0.7),
    new MeshLambertMaterial({ color: PALETTE.forgeStone }),
  );
  base.position.y = size * 0.21;
  group.add(base);

  // The coals, sunk into the top of the block. Unlit-looking geometry would
  // make this read as a rock, and a forge with no heat in it is a table.
  const coals = new Mesh(
    new BoxGeometry(size * 0.42, size * 0.06, size * 0.34),
    new MeshBasicMaterial({ color: PALETTE.emberCore }),
  );
  coals.position.set(size * 0.2, size * 0.44, 0);
  group.add(coals);

  // The anvil: a block with a horn, which at this size is two boxes.
  const anvil = new Mesh(
    new BoxGeometry(size * 0.34, size * 0.16, size * 0.22),
    new MeshLambertMaterial({ color: PALETTE.anvil }),
  );
  anvil.position.set(-size * 0.22, size * 0.5, 0);
  group.add(anvil);

  const stem = new Mesh(
    new BoxGeometry(size * 0.14, size * 0.12, size * 0.14),
    new MeshLambertMaterial({ color: PALETTE.anvil }),
  );
  stem.position.set(-size * 0.22, size * 0.4, 0);
  group.add(stem);

  return castsShadow(group);
}

/**
 * The tannery: a vat with a hide stretched on a frame behind it.
 *
 * Built to read as the forge's opposite number at a glance, which is most of
 * what a station's look is for on a map with no art on it — the forge is a squat
 * hot mass of stone and iron, and this is a wooden thing full of liquid with
 * something soft hanging off it. The frame stands at the back so the vat is what
 * the camera sees first from the south, where the camera always is.
 */
export function buildTannery(): Group {
  const size = TILE_SIZE;
  const group = new Group();

  const vat = new Mesh(
    new BoxGeometry(size * 0.7, size * 0.34, size * 0.55),
    new MeshLambertMaterial({ color: PALETTE.tanVat }),
  );
  vat.position.set(0, size * 0.17, size * 0.16);
  group.add(vat);

  // The liquor, sitting just proud of the rim: a vat drawn as a closed box is a
  // crate, and what makes this one read as full is seeing into it.
  const liquor = new Mesh(
    new BoxGeometry(size * 0.58, size * 0.04, size * 0.43),
    new MeshLambertMaterial({ color: PALETTE.tanLiquor }),
  );
  liquor.position.set(0, size * 0.35, size * 0.16);
  group.add(liquor);

  // The frame: two posts and a rail, with a hide laced across them.
  [-1, 1].forEach((side) => {
    const post = new Mesh(
      new BoxGeometry(size * 0.08, size * 0.8, size * 0.08),
      new MeshLambertMaterial({ color: PALETTE.wood }),
    );
    post.position.set(side * size * 0.3, size * 0.4, -size * 0.28);
    group.add(post);
  });

  const rail = new Mesh(
    new BoxGeometry(size * 0.68, size * 0.07, size * 0.08),
    new MeshLambertMaterial({ color: PALETTE.wood }),
  );
  rail.position.set(0, size * 0.76, -size * 0.28);
  group.add(rail);

  const hide = new Mesh(
    new BoxGeometry(size * 0.5, size * 0.46, size * 0.03),
    new MeshLambertMaterial({ color: PALETTE.stretchedHide }),
  );
  hide.position.set(0, size * 0.48, -size * 0.26);
  group.add(hide);

  return castsShadow(group);
}

/**
 * The fletcher's bench: a plank on two trestles, a bundle of shafts on it, and a
 * bow stave standing at the back.
 *
 * The third built station and the third silhouette, which is the job a station's
 * look has on a map with no art on it: the forge is a squat hot block, the vat a
 * dark tub with a hide behind it, and this is a pale, flat, open table — nothing
 * on it but long thin things and the white of the feathers.
 */
export function buildFletchingBench(): Group {
  const size = TILE_SIZE;
  const group = new Group();

  const top = new Mesh(
    new BoxGeometry(size * 0.9, size * 0.07, size * 0.5),
    new MeshLambertMaterial({ color: PALETTE.benchTop }),
  );
  top.position.y = size * 0.4;
  group.add(top);

  [-1, 1].forEach((side) => {
    const trestle = new Mesh(
      new BoxGeometry(size * 0.08, size * 0.37, size * 0.44),
      new MeshLambertMaterial({ color: PALETTE.wood }),
    );
    trestle.position.set(side * size * 0.34, size * 0.185, 0);
    group.add(trestle);
  });

  // The shafts, lying lengthways, with their fletched ends together at one end:
  // one box for the bundle, since at this size a dozen sticks are one shape.
  const bundle = new Mesh(
    new BoxGeometry(size * 0.6, size * 0.06, size * 0.14),
    new MeshLambertMaterial({ color: PALETTE.shaftBundle }),
  );
  bundle.position.set(-size * 0.04, size * 0.465, size * 0.06);
  group.add(bundle);

  const feathers = new Mesh(
    new BoxGeometry(size * 0.12, size * 0.09, size * 0.16),
    new MeshLambertMaterial({ color: PALETTE.fletching }),
  );
  feathers.position.set(size * 0.28, size * 0.48, size * 0.06);
  group.add(feathers);

  // The stave, taller than anything else here, stood at the back so the table
  // is what the camera sees first from the south.
  const stave = new Mesh(
    new CylinderGeometry(size * 0.025, size * 0.03, size * 0.95, 6),
    new MeshLambertMaterial({ color: PALETTE.woodLight }),
  );
  stave.position.set(-size * 0.3, size * 0.475, -size * 0.2);
  stave.rotation.z = 0.12;
  group.add(stave);

  return castsShadow(group);
}

/** Crossed logs under a flame. The flicker is decoration; the burn clock is the sim's. */
/**
 * What a full pack left on the ground: a sack, tied at the neck.
 *
 * Small, because it is something dropped rather than furniture, and never
 * mistaken for the thing that dropped it — a creature is the one here with legs.
 */
export function buildLootSack(): Group {
  const size = TILE_SIZE * 0.5;
  const group = new Group();

  const body = new Mesh(
    new SphereGeometry(size / 2, 10, 8),
    new MeshLambertMaterial({ color: PALETTE.sack }),
  );
  body.scale.set(1, 0.8, 1);
  body.position.y = size * 0.4;

  const neck = new Mesh(
    new CylinderGeometry(size * 0.1, size * 0.2, size * 0.3, 8),
    new MeshLambertMaterial({ color: PALETTE.sack }),
  );
  neck.position.y = size * 0.88;

  const tie = new Mesh(
    new CylinderGeometry(size * 0.16, size * 0.16, size * 0.07, 8),
    new MeshLambertMaterial({ color: PALETTE.sackTie }),
  );
  tie.position.y = size * 0.8;

  group.add(body, neck, tie);
  return castsShadow(group);
}

export function buildCampfire(): { object: Group; flicker(elapsedMs: number): void } {
  const size = TILE_SIZE * 0.8;
  const group = new Group();

  // The logs cast and the flames do not: a cone of fire is drawn transparent
  // and is the thing doing the lighting, so a hard shadow of one would be the
  // fire putting out a shadow of itself.
  const logs = new Group();
  [-1, 1].forEach((side) => {
    const log = new Mesh(
      new CylinderGeometry(size * 0.06, size * 0.06, size * 0.62, 6),
      new MeshLambertMaterial({ color: PALETTE.wood }),
    );
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (side * Math.PI) / 5;
    log.position.y = size * 0.06;
    logs.add(log);
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
  group.add(castsShadow(logs), flames);

  return {
    object: group,
    flicker(elapsedMs) {
      // A 420ms yoyo on the view's own clock: how a flame flickers is nothing
      // the simulation has an opinion about.
      const wobble = Math.sin((elapsedMs / 420) * Math.PI);
      flames.scale.set(1, 0.92 + wobble * 0.14, 1);
    },
  };
}
