import { SKILLS } from '../data/skills';
import { saveService } from '../persistence';
import { logMasteryTier, logSkillLevelUp, type CombatLogEntry } from '../systems/CombatLogSystem';
import type { CharacterController } from '../systems/CharacterController';
import type { Point } from '../systems/MovementSystem';
import { masteryTarget } from '../systems/MasterySystem';
import type { MasteryTargetId, SkillId, ZoneId } from '../types/ids';
import {
  COMBAT_LOG_EVENT,
  CURRENCY_CHANGED_EVENT,
  INVENTORY_CHANGED_EVENT,
  MASTERY_CHANGED_EVENT,
  MASTERY_TIER_REACHED_EVENT,
  NOTICE_EVENT,
  SKILL_XP_GAINED_EVENT,
} from '../ui/uiEvents';
import type { Player } from './Player';
import type { EventBus, FloatTone, WorldEvent } from './worldEvents';

/**
 * The zone, as one of its collaborators sees it: the clock, the character, the
 * two channels out of the simulation, and the handful of publishers more than
 * one of them needs. `GameContext` is the session's scope; this is the scope
 * inside a single zone, and `ZoneWorld` owns exactly one.
 *
 * It is deliberately the *shared* part and no more. Anything only one
 * collaborator needs — the mobs, the target, the campfire — is a constructor
 * argument of that collaborator rather than a member here, which is what keeps
 * this from growing back into the class it was split out of.
 */
export class WorldContext {
  /** Milliseconds since this zone opened. Starts at zero, which is why "never
   * happened" is marked with -Infinity rather than with 0. */
  now = 0;

  readonly character: CharacterController;
  readonly events: EventBus;
  readonly player: Player;

  /** Which zone this is, for the save and for anything parked in it. */
  readonly zoneId: ZoneId;

  /**
   * The die every roll in the zone is thrown with: a swing, a crit, a dodge, a
   * block, a drop, a gather, a burn, a fizzle, a reforge.
   *
   * Its own source rather than the wander's, so a test that pins where the rats
   * walk does not also pin every swing, and one that loads the dice does not
   * move the rats. The systems each take an rng already; this is the one they
   * are handed, where every collaborator used to leave them on `Math.random`.
   */
  readonly rolls: () => number;

  private pending: WorldEvent[] = [];

  constructor(
    character: CharacterController,
    events: EventBus,
    player: Player,
    zoneId: ZoneId,
    rolls: () => number = Math.random,
  ) {
    this.character = character;
    this.events = events;
    this.player = player;
    this.zoneId = zoneId;
    this.rolls = rolls;
  }

  /** The view channel: a moment that happened this frame. */
  push(event: WorldEvent): void {
    this.pending.push(event);
  }

  /** Hands the frame's moments to whoever is drawing, and starts the next one. */
  drain(): WorldEvent[] {
    const events = this.pending;
    this.pending = [];
    return events;
  }

  playerPoint(): Point {
    return { x: this.player.x, y: this.player.y };
  }

  /** Text that rises off the player. `rise` is how far above their feet it starts. */
  float(text: string, tone: FloatTone, rise = 0): void {
    this.push({
      kind: 'float',
      at: { x: this.player.x, y: this.player.y - rise },
      text,
      tone,
    });
  }

  log(entry: CombatLogEntry): void {
    this.events.emit(COMBAT_LOG_EVENT, entry);
  }

  /** The muted toast: a refusal, or something that happened without being asked for. */
  notice(text: string): void {
    this.events.emit(NOTICE_EVENT, text);
  }

  publishInventory(): void {
    this.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
  }

  publishCurrency(): void {
    this.events.emit(CURRENCY_CHANGED_EVENT, this.character.state.currency);
  }

  /**
   * Combat skills tick up a point at a time on every swing, which would bury the
   * screen in floating text — those pass `silent` and are seen only on the sheet
   * and at the level-up toast.
   */
  awardSkillXp(skill: SkillId, amount: number, options?: { silent: boolean }): void {
    const gain = this.character.awardSkillXp(skill, amount);
    if (!options?.silent) {
      this.float(`+${amount} ${SKILLS[skill].name} XP`, 'skill', 20);
    }
    this.events.emit(SKILL_XP_GAINED_EVENT, gain);
    if (gain.leveledUp) {
      this.log(logSkillLevelUp(SKILLS[skill].name, gain.level));
      this.persistCharacter();
    }
  }

  /**
   * Credits what an action taught about the thing it was done to, and says so
   * when that crossed a rung.
   *
   * Deliberately quieter than `awardSkillXp`: nothing floats, because a gather
   * already floats its skill XP and a second number off the same swing is two
   * ways of saying one thing happened. What is worth interrupting for is the
   * rung, which is rare and changes what the next swing pays.
   *
   * Persisted on a crossing for the reason a skill level is — it is the one
   * moment here a player would be sore about losing to a closed tab.
   */
  awardMastery(targetId: MasteryTargetId, amount: number): void {
    const crossed = this.character.awardMastery(targetId, amount);
    this.events.emit(MASTERY_CHANGED_EVENT, this.character.state.mastery);
    const reached = crossed.at(-1);
    if (!reached) return;

    const target = masteryTarget(targetId);
    this.events.emit(MASTERY_TIER_REACHED_EVENT, {
      targetId,
      targetName: target.name,
      tierName: reached.name,
      rank: reached.rank,
    });
    this.log(logMasteryTier(target.name, reached.name));
    this.persistCharacter();
  }

  persistCharacter(): void {
    this.character.recordLocation(this.zoneId, this.player);
    saveService.save(this.character.state);
  }
}
