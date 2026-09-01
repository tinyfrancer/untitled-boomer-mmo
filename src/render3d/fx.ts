import {
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  type Material,
  type Object3D,
} from 'three';
import { FLOAT_TONE_COLORS } from '../ui/theme';
import { simToWorld } from './coords';
import { disposeTree } from './dispose';
import { PALETTE } from './palette';
import { buildText } from './text';
import type { Point } from '../systems/MovementSystem';
import type { FloatTone, WorldEvent } from '../world/worldEvents';

/** How long a floating number lives, and how far it climbs. */
const FLOAT_MS = 600;
const FLOAT_RISE = 34;

/** How tall the glyphs are drawn, in world units: twice a nameplate's. */
const FLOAT_SIZE = 24;

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
 * One short-lived thing being drawn, and how far through it is.
 *
 * `play` takes a 0-1 progress rather than a delta because that is what makes a
 * dropped frame invisible: an effect three quarters through is drawn three
 * quarters through whether it got there in four frames or forty.
 */
interface Effect {
  readonly object: Object3D;
  readonly bornAt: number;
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
  // The last frame's clock. An effect born between frames is born at the one
  // before it, which is a millisecond nobody can see.
  private now = 0;

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
      default:
        // `spawn` and `gather-tick` are already visible in the state the actors
        // sync to; `death` is drawn by the corpse's own fade, and `zone-exit`
        // belongs to the session — a frame that changed zone rebuilds instead.
        return;
    }
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
      bornAt: this.now,
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
      bornAt: this.now,
      lifeMs: BOLT_MS,
      play(progress) {
        group.position.lerpVectors(start, end, progress);
      },
    });
  }

  /**
   * Advances everything in flight and retires what has finished, on the view's
   * clock — the same one the walk cycles and the campfire's flicker run on.
   */
  update(elapsedMs: number): void {
    this.now = elapsedMs;
    if (this.effects.length === 0) return;
    this.effects = this.effects.filter((effect) => {
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
