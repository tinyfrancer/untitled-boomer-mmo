import {
  AFK_ANCHOR_RADIUS,
  afkGatherSkill,
  chooseAfkFood,
  chooseAfkNode,
  decideAfkAction,
  shouldAfkEat,
  type AfkNodeCandidate,
} from '../systems/AfkSystem';
import { SKILLS } from '../data/skills';
import { logNotice } from '../systems/CombatLogSystem';
import { canGather } from '../systems/GatherSystem';
import { inventoryEntries } from '../systems/InventorySystem';
import { resolveOfflineAfk, type OfflineAfkReport } from '../systems/OfflineAfkSystem';
import { distance, withinRadius, type Point } from '../systems/MovementSystem';
import type { EnemyId, ItemId, SkillId } from '../types/ids';
import { AFK_STATE_CHANGED_EVENT, type AchievementUnlock } from '../ui/uiEvents';
import type { Mob } from './Mob';
import type { ResourceNode } from './ResourceNode';
import type { Targeting } from './targeting';
import type { WorldContext } from './WorldContext';

/** What the camp needs from the rest of the zone, and the whole of it. */
export interface AfkCampDeps {
  mobs: Mob[];
  nodes: ResourceNode[];
  targeting: Targeting;
  /** Settling in gives up both of the things a hand on the mouse was doing. */
  stopGathering(): void;
  closeShop(): void;
  eat(itemId: ItemId): void;
  /** Walk over and start the channel — the same approach a tap on a node uses. */
  gatherAt(node: ResourceNode): void;
  /**
   * Whether a channel is already running — a gather, or something in the pan —
   * which is the loop's "leave it alone".
   */
  isChanneling(): boolean;
  /** The choke point the camp's own XP penalty is applied at. */
  awardXp(reward: number): void;
  /** A kill either happened or it didn't, so an offline count is credited in full. */
  creditKill(enemyId: EnemyId, count: number): AchievementUnlock[];
}

/** The offline camp's payout, for a host that has somewhere to put it. */
export interface ParkedAfkResult {
  report: OfflineAfkReport;
  unlocks: AchievementUnlock[];
}

/**
 * The unattended player: it works whatever is in its hands, stays where it was
 * left, and eats when it is hurt.
 *
 * **What it does is decided by the tool, not by a mode.** A fishing pole or an
 * axe in the weapon slot makes this a gathering camp; a sword, a wand or an
 * empty hand makes it the fighting one. Nothing is stored and nothing is chosen
 * twice — it is the same question `canGather` asks before letting anyone swing
 * at a tree, so a player who wants to camp a skill does what they would do
 * anyway.
 *
 * As a fighter it is deliberately a worse player than the person it stands in
 * for. It never uses an ability — the action bar is an advantage only a hand on
 * the keyboard gets — and everything it earns is halved on the way in, which is
 * the world's job rather than this one's (see `ZoneWorld.awardXp`).
 *
 * As a gatherer it is not, and deliberately: an attended player gathers by
 * tapping a node and watching it auto-repeat, which is the same standing still
 * this does. There is no skill being simulated away to charge for, and a camp
 * that paid half would be strictly worse than the tap it replaces. What it adds
 * is walking to the next tree when one is chopped out, fighting back when
 * something starts chewing, and paying out for time offline — where the
 * offline rate and the one-level cap do apply, exactly as they do to a fight.
 */
export class AfkCamp {
  active = false;

  private readonly ctx: WorldContext;
  private readonly deps: AfkCampDeps;
  // The spot the character settled at — fights and nodes are both leashed to it
  // — and whether they are currently standing down to heal rather than pulling.
  private anchor: Point = { x: 0, y: 0 };
  private recovering = false;
  // Whether the pack was full last time a haul was due. Latched so the refusal
  // is said once rather than every frame for as long as the camp runs.
  private packFull = false;

  constructor(ctx: WorldContext, deps: AfkCampDeps) {
    this.ctx = ctx;
    this.deps = deps;
  }

  toggle(): void {
    this.set(!this.active);
  }

  set(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.recovering = false;
    this.packFull = false;
    if (active) {
      this.deps.closeShop();
      this.anchor = this.ctx.playerPoint();
      const skill = this.gatherSkill();
      // A gather already in flight is left running — settling in beside the
      // tree you were chopping should not stop you chopping it.
      if (skill === null) {
        this.deps.stopGathering();
      }
      this.ctx.log(
        logNotice(
          skill === null ? 'You settle in to camp.' : `You settle in to ${SKILLS[skill].verb}.`,
        ),
      );
      // Settling in with a full pack is allowed — the XP is worth having on its
      // own — but it is not what anyone means to do, so it is said up front
      // rather than discovered on the away report in the morning.
      this.packFull = !this.canKeepWhatItFinds();
      if (this.packFull) {
        this.ctx.log(logNotice('Your pack is full — nothing you find will be kept.'));
      }
    } else {
      this.ctx.log(logNotice('You snap out of it.'));
    }
    // Written to the save, not just held here: it is the only record that
    // survives the tab closing, and the only thing offline progress is paid on.
    this.ctx.character.state.afk = active
      ? { startedAt: new Date().toISOString(), zoneId: this.ctx.zoneId }
      : null;
    this.ctx.persistCharacter();
    this.ctx.events.emit(AFK_STATE_CHANGED_EVENT, this.active);
  }

  /**
   * Pays out a camp that was left running when the tab closed, and hands the
   * report back rather than announcing it: the only load that can find a parked
   * session is the first boot into a world, and the HUD is not listening yet at
   * that point. Runs once and clears the session either way — a session that
   * paid nothing must not be able to pay again on the next load.
   */
  resolveParked(): ParkedAfkResult | null {
    const { character } = this.ctx;
    const session = character.state.afk;
    if (!session) return null;
    character.state.afk = null;

    const report = resolveOfflineAfk(session, {
      now: Date.now(),
      characterLevel: character.state.level,
      inventory: character.state.inventory,
      capacity: character.carryCapacity(),
      gear: character.state.gear,
      skills: character.state.skills,
    });
    if (report.kills <= 0 && report.gathers <= 0) {
      this.ctx.persistCharacter();
      return null;
    }

    for (const [itemId, quantity] of inventoryEntries(report.drops)) {
      character.addItem(itemId, quantity);
    }
    character.addCurrency(report.copper);
    // A gathering session earns no character XP at all, and awarding zero would
    // still float a "+0 XP" over the boot it was resolved on.
    if (report.xp > 0) {
      this.deps.awardXp(report.xp);
    }
    if (report.skill && report.skillXp > 0) {
      // Silent: this is resolved on the boot that finds the parked session, so
      // there is no one at the keyboard for a number to float past. The away
      // report is where the player is told, and it says the total.
      this.ctx.awardSkillXp(report.skill, report.skillXp, { silent: true });
    }
    const unlocks = report.enemyId ? this.deps.creditKill(report.enemyId, report.kills) : [];
    this.ctx.publishInventory();
    this.ctx.publishCurrency();
    this.ctx.persistCharacter();
    return { report, unlocks };
  }

  update(): void {
    if (!this.active || !this.ctx.player.isAlive()) return;

    // Anything already chasing is answered before anything else, whichever kind
    // of camp this is: being hit breaks a gather channel, so a woodcutter that
    // ignored the thing chewing on it would stand there re-arming a channel it
    // could never finish until it died.
    const skill = this.gatherSkill();
    if (skill !== null && !this.hunted() && this.work(skill)) {
      return;
    }
    this.fight();
  }

  /** Which skill this camp is working, or null for the fighting one. */
  private gatherSkill(): SkillId | null {
    return afkGatherSkill(this.ctx.character.state.gear);
  }

  private hunted(): boolean {
    return this.deps.mobs.some((mob) => mob.isAlive() && mob.isEngaged());
  }

  /**
   * One frame of a gathering camp. Returns false when this tool has no work in
   * this zone at all, which is the caller's cue to fall back to fighting — a
   * fishing pole in the bandit camp is a camp with nothing to fish, not a camp
   * that should stand still until the tab closes.
   */
  private nodeCandidates(): AfkNodeCandidate[] {
    const { character } = this.ctx;
    return this.deps.nodes.map((node, index) => ({
      index,
      distance: distance(this.anchor, node),
      available: node.isAvailable(),
      skill: node.definition.skill,
      workable: canGather(node.definition, character.state.skills, character.state.gear).ok,
    }));
  }

  private work(skill: SkillId): boolean {
    const { character } = this.ctx;
    const action = chooseAfkNode(this.nodeCandidates(), skill);
    if (action.kind === 'none') {
      return false;
    }

    this.deps.targeting.clearTarget();
    // The channel re-arms itself and the walk finishes on its own; re-issuing
    // either every frame would restart it and it would never complete. A pan
    // left on the fire counts: settling in beside one finishes the stack before
    // the axe comes out, the same way a gather already under way is left alone.
    if (this.deps.isChanneling() || this.ctx.player.hasMoveTarget()) {
      return true;
    }
    if (action.kind === 'wait') {
      this.ctx.player.stopMoving();
      return true;
    }

    const node = this.deps.nodes[action.index];
    if (!node) return true;
    // A full pack does not stop the camp, it only stops it keeping anything.
    // Said once rather than every frame for as long as the camp runs, and
    // re-armed if the player makes room and fills it again.
    this.warnIfFull(!character.canCarryItem(node.definition.yieldItemId));
    this.deps.gatherAt(node);
    return true;
  }

  /**
   * The one line an unattended player gets about a full pack while they are
   * still watching. What it actually cost them is itemised on the away report,
   * which is the only place a whole session's losses can be added up.
   */
  private warnIfFull(full: boolean): void {
    if (full && !this.packFull) {
      this.ctx.notice('Your pack is full — nothing you find will be kept.');
    }
    this.packFull = full;
  }

  /**
   * Whether anything this camp collects would actually fit, which is a
   * different question for each kind: a gatherer knows exactly what it is about
   * to pick up, where a fight could drop anything and only "no room at all"
   * answers for it.
   */
  private canKeepWhatItFinds(): boolean {
    const { character } = this.ctx;
    const skill = this.gatherSkill();
    if (skill === null) {
      return character.carriedWeight() < character.carryCapacity();
    }
    const node = this.chosenNode(skill);
    return node === null || character.canCarryItem(node.definition.yieldItemId);
  }

  private chosenNode(skill: SkillId): ResourceNode | null {
    const action = chooseAfkNode(this.nodeCandidates(), skill);
    return action.kind === 'gather' ? (this.deps.nodes[action.index] ?? null) : null;
  }

  private fight(): void {
    const { targeting } = this.deps;

    // A fight that wandered off the camp is dropped rather than followed: the
    // anchor is what keeps an unattended character where they were left.
    if (targeting.target && !withinRadius(this.anchor, targeting.target, AFK_ANCHOR_RADIUS)) {
      targeting.clearTarget();
    }

    const action = decideAfkAction(
      this.deps.mobs.map((mob, index) => ({
        index,
        distance: distance(this.anchor, mob),
        alive: mob.isAlive(),
        engaged: mob.isEngaged(),
        boss: mob.definition.boss === true,
      })),
      {
        hp: this.ctx.player.hp,
        maxHp: this.ctx.player.maxHp,
        recovering: this.recovering,
      },
    );
    this.recovering = action.kind === 'recover';

    if (action.kind === 'recover') {
      targeting.clearTarget();
      this.ctx.player.stopMoving();
      this.eat();
      return;
    }
    if (action.kind === 'idle') {
      targeting.stopPursuit();
      return;
    }

    const mob = this.deps.mobs[action.index];
    if (!mob) return;
    // The world's own approach code walks into range and its combat swings, so
    // camping is the same fight, just without a hand on the mouse.
    targeting.pursueTarget(mob);
  }

  private eat(): void {
    const { player } = this.ctx;
    if (player.isEating() || !shouldAfkEat(player.hp, player.maxHp, player.isInCombat())) {
      return;
    }
    const food = chooseAfkFood(this.ctx.character.state.inventory);
    if (food) {
      this.deps.eat(food);
    }
  }
}
