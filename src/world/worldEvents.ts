import type { ZoneEdge } from '../data/zones';
import type { Point } from '../systems/MovementSystem';
import type { AbilityId, ResourceNodeId, ZoneId } from '../types/ids';
import type { UiEventMap, UiEventName } from '../ui/uiEvents';
import type { Mob } from './Mob';

/**
 * What a renderer has to be told about, because it cannot see it in the state.
 *
 * The HUD's channel is different and stays an event emitter (see EventBus):
 * those events carry state the HUD re-renders from, and the last one always
 * describes the present. These are moments — a bolt left the caster's hand, a
 * number floated off a corpse — and a view that misses one has no way to
 * recover it from anywhere. `ZoneWorld.update` hands the frame's list back to
 * whoever is drawing.
 *
 * Deliberately says nothing about colour or duration: a tone names what kind of
 * thing happened and the view decides what that looks like, which is the whole
 * point of having the channel at all.
 */
export type FloatTone = 'damage' | 'player-damage' | 'heal' | 'reward' | 'skill' | 'dim';

export type WorldEvent =
  /**
   * Damage landed. `absorbed` is the part a mana shield ate, so a view can show
   * the soak and the wound separately; `via` is there because a spell and a
   * swing have always been drawn differently.
   */
  | {
      kind: 'hit';
      on: 'player' | 'mob';
      via: 'weapon' | 'ability';
      at: Point;
      damage: number;
      absorbed: number;
    }
  /** A swing turned aside. `skillName` is the skill that turned it. */
  | { kind: 'defend'; at: Point; skillName: string }
  | { kind: 'heal'; at: Point; amount: number }
  | { kind: 'float'; at: Point; text: string; tone: FloatTone }
  /** The player died. A non-null `respawnZone` is one the host has to load. */
  | { kind: 'death'; on: 'player'; respawnZone: ZoneId | null }
  | { kind: 'death'; on: 'mob'; mob: Mob }
  | { kind: 'spawn'; mob: Mob }
  /** A projectile to draw between two points; instant-hit abilities omit it. */
  | { kind: 'bolt-cast'; abilityId: AbilityId; from: Point; to: Point }
  | { kind: 'gather-tick'; at: Point; nodeId: ResourceNodeId; progress: number }
  /** The player walked onto an exit. The host loads the zone — the world does not. */
  | { kind: 'zone-exit'; to: ZoneId; edge: ZoneEdge; fraction: number };

/**
 * The HUD channel, as much of an emitter as ZoneWorld needs. `createEventBus`
 * satisfies it, and so does a bare stub in a test — which is the point:
 * nothing here knows what is on the other end.
 *
 * What it carries is `UiEventMap`, so both ends of every event are checked
 * against one declaration: an emit with the wrong payload, or a listener typed
 * for a payload the emitter does not send, is a compile error. The map is the
 * whole of the typing — the methods stay as thin as they were.
 */
export interface EventBus {
  emit<K extends UiEventName>(event: K, ...args: UiEventMap[K]): unknown;
  on<K extends UiEventName>(
    event: K,
    fn: (...args: UiEventMap[K]) => void,
    context?: unknown,
  ): unknown;
  off<K extends UiEventName>(
    event: K,
    fn: (...args: UiEventMap[K]) => void,
    context?: unknown,
  ): unknown;
}
