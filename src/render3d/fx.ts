import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { RESOURCE_NODES } from '../data/resourceNodes';
import { FLOAT_TONE_COLORS } from '../ui/theme';
import { itemIcon } from '../ui/itemIcons';
import type { ResourceNodeId } from '../types/ids';
import { simToWorld } from './coords';
import { disposeTree } from './dispose';
import { PALETTE } from './palette';
import { buildText } from './text';
import type { Point } from '../systems/MovementSystem';
import type { FloatTone, WorldEvent } from '../world/worldEvents';

/** How long a floating number lives, and how far it climbs. */
const FLOAT_MS = 600;
const FLOAT_RISE = 34;

/**
 * How tall the glyphs are drawn, in world units: half again a nameplate's, so a
 * number is read before the name it rises past.
 */
const FLOAT_SIZE = 32;

/**
 * How far above the ground a number starts.
 *
 * A `hit` names the point it happened at and nothing about how tall the thing
 * it happened to is — the simulation is 2D and has no opinion on height. So the
 * lift is a fixed one, chosen to clear the tallest thing it can be thrown off:
 * a standing figure's nameplate, which is higher than a rat's whole body.
 */
const FLOAT_LIFT = 90;

/** How far a soaked hit floats above the wound it soaked, so both can be read at once. */
const ABSORB_LIFT = 22;

/** A bolt's flight. Cosmetic, so short enough not to lag the hit it announces. */
const BOLT_MS = 180;
const BOLT_RADIUS = 8;

/** Chest height, so a bolt flies between the caster and the target rather than along the floor. */
const BOLT_HEIGHT = 34;

/**
 * An arrow's flight: quicker than a bolt, since a bow shoots every second where
 * a spell waits on its cooldown, and a shaft long and thin enough to read as one
 * at the distance the camera sits. It flies at the bolt's height for the bolt's
 * reason.
 */
const ARROW_MS = 140;
const ARROW_LENGTH = 26;
const ARROW_RADIUS = 1.4;
const UP = new Vector3(0, 1, 0);

/**
 * A spray of short-lived points: sparks off a crit, chips off a gather. One
 * geometry per burst and one draw call, since a crit in a long fight is every
 * few seconds and a chop is every second, and a mesh a spark would be a dozen
 * uploads a time.
 */
interface BurstStyle {
  readonly count: number;
  readonly lift: number;
  /** How fast the points leave, in world units a second, and how far they fall. */
  readonly speed: number;
  readonly gravity: number;
  readonly size: number;
  readonly lifeMs: number;
}

const CRIT_SPARKS: BurstStyle = {
  count: 14,
  lift: 40,
  speed: 170,
  gravity: 260,
  size: 7,
  lifeMs: 420,
};
const GATHER_CHIPS: BurstStyle = {
  count: 7,
  lift: 22,
  speed: 90,
  gravity: 320,
  size: 6,
  lifeMs: 380,
};

/** A level-up: a ring spreading across the ground and a column of light over it. */
const LEVEL_UP_MS = 1100;
const LEVEL_UP_RING = 90;
const LEVEL_UP_COLUMN = 150;

/**
 * One short-lived thing being drawn, and how far through it is.
 *
 * `play` takes a 0-1 progress rather than a delta because that is what makes a
 * dropped frame invisible: an effect three quarters through is drawn three
 * quarters through whether it got there in four frames or forty.
 */
interface Effect {
  readonly object: Object3D;
  // Null until the first frame that draws it, which is when its clock starts.
  bornAt: number | null;
  readonly lifeMs: number;
  play(progress: number): void;
}

/**
 * The moments: damage numbers rising off a corpse, a bolt in flight.
 *
 * This is the other half of the `WorldEvent` channel — the half a view cannot
 * recover from state, because by the next frame there is nothing left in the
 * simulation to say it happened. `ZoneView3D` hands events here as they arrive
 * and this draws them out over the frames that follow.
 *
 * The clock is the *view's*, not the world's, and that split is deliberate: how
 * long a number takes to fade is a decision about what is comfortable to read,
 * where how long a corpse takes to disappear is the world's, since it has to
 * respawn on time with nothing drawing it at all (see `MobActor`).
 *
 * The layer outlives a zone — it is furniture, like the camera and the lights —
 * but its contents do not: a number rising off a rat in town has nowhere to
 * land once the beach is loaded, so `clear()` is part of a zone teardown.
 */
export class FxLayer {
  readonly object = new Group();
  private effects: Effect[] = [];

  /**
   * One moment, turned into something you can see.
   *
   * What an event becomes is the view's decision — a `WorldEvent` names a tone
   * and a place and says nothing about colour or duration, which is the whole
   * point of having the channel.
   */
  draw(event: WorldEvent): void {
    switch (event.kind) {
      case 'hit': {
        const tone = event.on === 'player' ? 'player-damage' : 'damage';
        if (event.absorbed > 0) {
          // Above the wound, so a soak and the damage through it can both be
          // read when a mana shield eats part of a swing.
          this.float(event.at, `(${event.absorbed} absorbed)`, 'skill', ABSORB_LIFT);
        }
        if (event.damage > event.absorbed) {
          const shown = event.on === 'player' ? event.damage - event.absorbed : event.damage;
          // The bang as well as the colour: a crit has to read as one on a
          // screen being looked at rather than watched.
          const text = event.crit ? `-${shown}!` : `-${shown}`;
          const hue = event.via === 'ability' ? 'reward' : tone;
          this.float(event.at, text, event.crit ? 'crit' : hue);
        }
        if (event.crit) this.burst(event.at, PALETTE.critSpark, CRIT_SPARKS);
        return;
      }
      case 'defend':
        this.float(event.at, event.skillName, 'heal');
        return;
      case 'heal':
        this.float(event.at, `+${event.amount}`, 'heal');
        return;
      case 'float':
        this.float(event.at, event.text, event.tone);
        return;
      case 'bolt-cast':
        this.bolt(event.from, event.to);
        return;
      case 'shot':
        this.arrow(event.from, event.to);
        return;
      case 'level-up':
        this.levelUp(event.at);
        return;
      default:
        // `spawn` is already visible in the state the actors sync to; `death`
        // is drawn by the corpse's own fade; `swing` and a gather's beat are
        // played by the actors, whom the view hands them to; and `zone-exit`
        // belongs to the session — a frame that changed zone rebuilds instead.
        return;
    }
  }

  /** The chips a gather's beat knocks off whatever is being worked. */
  gatherChips(at: Point, nodeId: ResourceNodeId): void {
    this.burst(at, chipColor(nodeId), GATHER_CHIPS);
  }

  /** A number or a word over a spot in the world, rising as it fades. */
  float(at: Point, text: string, tone: FloatTone, lift = 0): void {
    const sprite = buildText(text, FLOAT_TONE_COLORS[tone], FLOAT_SIZE);
    // Null is jsdom, which has no canvas to bake text onto. Nothing to draw is
    // not an error here — the unit suite runs whole fights through this.
    if (!sprite) return;

    const start = simToWorld(at.x, at.y, FLOAT_LIFT + lift);
    sprite.position.copy(start);
    this.add({
      object: sprite,
      bornAt: null,
      lifeMs: FLOAT_MS,
      play(progress) {
        sprite.position.y = start.y + FLOAT_RISE * progress;
        setAlpha(sprite, 1 - progress);
      },
    });
  }

  /**
   * A projectile between two points. Purely cosmetic, but a ranged nuke that
   * produced only a number over the mob read as nothing happening.
   */
  bolt(from: Point, to: Point): void {
    // Unfogged, like the floats and the nameplates: a bolt is feedback that a
    // spell left the caster's hand, and it is thrown at the far end of a reach
    // the haze has already started on.
    const head = new Mesh(
      new SphereGeometry(BOLT_RADIUS, 10, 8),
      new MeshBasicMaterial({ color: PALETTE.bolt, fog: false }),
    );
    const halo = new Mesh(
      new SphereGeometry(BOLT_RADIUS * 1.6, 10, 8),
      new MeshBasicMaterial({
        color: PALETTE.boltGlow,
        transparent: true,
        opacity: 0.35,
        fog: false,
      }),
    );
    const group = new Group();
    group.add(head, halo);

    const start = simToWorld(from.x, from.y, BOLT_HEIGHT);
    const end = simToWorld(to.x, to.y, BOLT_HEIGHT);
    group.position.copy(start);
    this.add({
      object: group,
      bornAt: null,
      lifeMs: BOLT_MS,
      play(progress) {
        group.position.lerpVectors(start, end, progress);
      },
    });
  }

  /** An arrow between two points, pointing the way it flies. */
  arrow(from: Point, to: Point): void {
    const start = simToWorld(from.x, from.y, BOLT_HEIGHT);
    const end = simToWorld(to.x, to.y, BOLT_HEIGHT);
    // Unfogged like a bolt, for the same reason: it is feedback thrown to the
    // far end of a reach the haze has already started on.
    const shaft = new Mesh(
      new CylinderGeometry(ARROW_RADIUS, ARROW_RADIUS, ARROW_LENGTH, 4),
      new MeshBasicMaterial({ color: PALETTE.arrow, fog: false }),
    );
    const heading = end.clone().sub(start);
    if (heading.lengthSq() > 0) {
      shaft.quaternion.setFromUnitVectors(UP, heading.normalize());
    }
    shaft.position.copy(start);
    this.add({
      object: shaft,
      bornAt: null,
      lifeMs: ARROW_MS,
      play(progress) {
        shaft.position.lerpVectors(start, end, progress);
      },
    });
  }

  /**
   * Points thrown out from a spot, arcing up and falling as they fade. Where
   * each goes is fixed at birth off the golden angle rather than rolled, so a
   * burst is the same shape every time and the view never touches a random
   * source the simulation might one day want to own.
   */
  private burst(at: Point, color: number, style: BurstStyle): void {
    const start = simToWorld(at.x, at.y, style.lift);
    const positions = new Float32Array(style.count * 3);
    const velocities: number[] = [];
    for (let i = 0; i < style.count; i += 1) {
      const around = i * 2.399963;
      const up = 0.45 + 0.5 * ((i * 0.618034) % 1);
      const out = style.speed * (0.55 + 0.45 * ((i * 0.381966) % 1));
      velocities.push(Math.cos(around) * out, up * style.speed, Math.sin(around) * out);
      positions.set([start.x, start.y, start.z], i * 3);
    }
    const geometry = new BufferGeometry();
    const attribute = new BufferAttribute(positions, 3);
    geometry.setAttribute('position', attribute);
    const material = new PointsMaterial({
      color,
      size: style.size,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    const points = new Points(geometry, material);
    const seconds = style.lifeMs / 1000;
    this.add({
      object: points,
      bornAt: null,
      lifeMs: style.lifeMs,
      play(progress) {
        const t = progress * seconds;
        for (let i = 0; i < style.count; i += 1) {
          attribute.setXYZ(
            i,
            start.x + (velocities[i * 3] ?? 0) * t,
            start.y + (velocities[i * 3 + 1] ?? 0) * t - 0.5 * style.gravity * t * t,
            start.z + (velocities[i * 3 + 2] ?? 0) * t,
          );
        }
        attribute.needsUpdate = true;
        material.opacity = 1 - progress * progress;
      },
    });
  }

  /**
   * A level: a ring spreading out across the ground from the player's feet and
   * a column of light standing over them, both gone in about a second. The
   * toast says which level; this says where, and that it was the player.
   */
  private levelUp(at: Point): void {
    const ring = new Mesh(
      new RingGeometry(0.82, 1, 40),
      new MeshBasicMaterial({
        color: PALETTE.levelUp,
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
        fog: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 2;
    const column = new Mesh(
      new CylinderGeometry(22, 30, LEVEL_UP_COLUMN, 20, 1, true),
      new MeshBasicMaterial({
        color: PALETTE.levelUp,
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
        fog: false,
      }),
    );
    column.position.y = LEVEL_UP_COLUMN / 2;
    const group = new Group();
    group.add(ring, column);
    group.position.copy(simToWorld(at.x, at.y));
    this.add({
      object: group,
      bornAt: null,
      lifeMs: LEVEL_UP_MS,
      play(progress) {
        const spread = 10 + LEVEL_UP_RING * Math.sqrt(progress);
        ring.scale.set(spread, spread, 1);
        setAlpha(ring, 0.9 * (1 - progress));
        column.scale.set(1 - 0.4 * progress, 0.4 + 0.8 * progress, 1 - 0.4 * progress);
        setAlpha(column, 0.45 * (1 - progress) * Math.min(1, progress * 6));
      },
    });
  }

  /**
   * Advances everything in flight and retires what has finished, on the view's
   * clock — the same one the walk cycles and the campfire's flicker run on.
   */
  update(elapsedMs: number): void {
    if (this.effects.length === 0) return;
    this.effects = this.effects.filter((effect) => {
      // Timed from the first frame that draws it, not the last one before it
      // was born. That gap was taken for a millisecond nobody could see, and on
      // a phone taking 150ms a frame it is longer than an arrow's whole flight:
      // an arrow dated to the frame before was retired without being drawn.
      effect.bornAt ??= elapsedMs;
      const progress = (elapsedMs - effect.bornAt) / effect.lifeMs;
      if (progress >= 1) {
        disposeTree(effect.object);
        return false;
      }
      effect.play(Math.max(progress, 0));
      return true;
    });
  }

  /** Whatever is in flight, dropped where it stands: a zone change. */
  clear(): void {
    this.effects.forEach((effect) => disposeTree(effect.object));
    this.effects = [];
  }

  /** How many effects are running — what `drawnCounts().fx` answers. */
  count(): number {
    return this.effects.length;
  }

  dispose(): void {
    this.clear();
    disposeTree(this.object);
  }

  private add(effect: Effect): void {
    this.object.add(effect.object);
    this.effects.push(effect);
    effect.play(0);
  }
}

// Opacity only. `setOpacity` in dispose.ts also switches `transparent` off at
// full alpha, which is right for a solid figure fading out and wrong for text:
// a glyph sprite is mostly its own transparency, and drawn opaque it is a black
// card with a number on it.
function setAlpha(object: Object3D, alpha: number): void {
  const material = (object as Object3D & { material?: Material }).material;
  if (material) material.opacity = alpha;
}

/**
 * What a gather knocks loose: wood off a tree, spray off a fishing spot, and a
 * vein's own ore — read off the item it yields, the way the vein's prop is
 * coloured, so a chip of tin is the grey a tin ore is in the bag.
 */
function chipColor(nodeId: ResourceNodeId): number {
  const definition = RESOURCE_NODES[nodeId];
  switch (definition.shape) {
    case 'tree':
      return PALETTE.woodChip;
    case 'ripple':
      return PALETTE.splash;
    case 'vein':
      return itemIcon(definition.yieldItemId).color;
  }
}
