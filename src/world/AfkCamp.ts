import {
  AFK_ANCHOR_RADIUS,
  afkCampJob,
  afkJobSkill,
  chooseAfkFood,
  chooseAfkNode,
  decideAfkAction,
  shouldAfkEat,
  type AfkCampJob,
  type AfkNodeCandidate,
} from '../systems/AfkSystem';
import { SKILLS } from '../data/skills';
import type { CraftingRecipe, StationId } from '../data/recipes';
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
  /** Both of them: nobody trades or banks while the character is parked. */
  closeCounters(): void;
  eat(itemId: ItemId): void;
  /** Walk over and start the channel — the same approach a tap on a node uses. */
  gatherAt(node: ResourceNode): void;
  /** Which stations the player is standing at, which is half of what a camp is. */
  stationsInReach(): StationId[];
  /** Put something on the station being stood at — the pan, or the forge. */
  craft(recipe: CraftingRecipe): void;
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
 * **What it does is decided by what is in hand and what is underfoot, not by a
 * mode.** A fishing pole or an axe in the weapon slot makes this a gathering
 * camp; a fire or a forge in reach with something on the bench makes it a making
 * one; a sword, a wand or an empty hand makes it the fighting one. Nothing is
 * stored and nothing is chosen twice — see `afkCampJob`, which is where the
 * order between the three is argued.
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
    const job = active ? this.job() : null;
    if (job) {
      this.deps.closeCounters();
      this.anchor = this.ctx.playerPoint();
      const skill = afkJobSkill(job);
      // A channel already in flight is left running — settling in beside the
      // tree you were chopping, or over the pan you were watching, should not
      // stop you doing it.
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
      this.packFull = !this.canKeepWhatItFinds(job);
      if (this.packFull) {
        this.ctx.log(logNotice('Your pack is full — nothing you find will be kept.'));
      }
    } else {
      this.ctx.log(logNotice('You snap out of it.'));
    }
    // Written to the save, not just held here: it is the only record that
    // survives the tab closing, and the only thing offline progress is paid on.
    //
    // The station is what the camp *settled to work at* rather than whatever
    // happened to be within reach, which is why a gathering or fighting camp
    // records none: it is the same precedence the awake loop runs on, decided
    // once at the toggle, so the morning's payout is the job the player walked
    // away from. Whether a fire counts is `OfflineAfkSystem`'s ruling, not this
    // one's — the save says where they stood either way.
    this.ctx.character.state.afk = job
      ? {
          startedAt: new Date().toISOString(),
          zoneId: this.ctx.zoneId,
          station: job.kind === 'craft' ? job.recipe.station : null,
        }
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
      classId: character.state.classId,
      characterLevel: character.state.level,
      inventory: character.state.inventory,
      capacity: character.carryCapacity(),
      gear: character.state.gear,
      skills: character.state.skills,
      quiver: character.state.quiver,
      reforges: character.state.reforges,
      rng: this.ctx.rolls,
    });
    if (report.kills <= 0 && report.gathers <= 0 && report.crafts <= 0) {
      this.ctx.persistCharacter();
      // A bow with nothing to shoot is the one parked camp that earned nothing
      // for a reason the player can do something about, so it is still news.
      return report.outOfArrows ? { report, unlocks: [] } : null;
    }

    // Spent before handed over, and in that order: a making camp works through
    // the pack, so paying out the bars without taking the ore would be minting
    // metal. Everything else leaves this empty.
    for (const [itemId, quantity] of inventoryEntries(report.consumed)) {
      character.removeItem(itemId, quantity);
    }
    for (const [itemId, quantity] of inventoryEntries(report.drops)) {
      character.addItem(itemId, quantity);
    }
    // After the drops rather than before, since the report counted the arrows
    // off each body as arrows to shoot at the next one.
    character.spendArrows(report.arrowsSpent);
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
    // The same number into the pool it was worked out of: a target is taught by
    // the XP its action paid, so a session that trained the skill by half taught
    // the tree by half too. Nothing floats and nothing toasts for the reason the
    // line above is silent — the away report is the one thing anybody reads on
    // this boot, and it says which pool moved.
    if (report.masteryTargetId && report.skillXp > 0) {
      character.awardMastery(report.masteryTargetId, report.skillXp);
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
    // could never finish until it died. A pan and a forge break the same way,
    // which is why this is asked of the job rather than of the gather.
    if (!this.hunted() && this.work(this.job())) {
      return;
    }
    this.fight();
  }

  /**
   * What this camp is working. Re-derived every frame rather than latched, so a
   * gear swap, a fire going out or the last bar coming off the bench changes
   * what the camp does without anything having to notice.
   */
  private job(): AfkCampJob {
    const { character } = this.ctx;
    return afkCampJob({
      gear: character.state.gear,
      skills: character.state.skills,
      inventory: character.state.inventory,
      stations: this.deps.stationsInReach(),
    });
  }

  private hunted(): boolean {
    return this.deps.mobs.some((mob) => mob.isAlive() && mob.isEngaged());
  }

  /** Every node in the zone, measured from the anchor rather than the player. */
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

  /**
   * One frame of a making or gathering camp. Returns false when there is no
   * work of that kind here at all, which is the caller's cue to fall back to
   * fighting.
   */
  private work(job: AfkCampJob): boolean {
    if (job.kind === 'craft') return this.make(job.recipe);
    if (job.kind === 'gather') return this.gather(job.skill);
    return false;
  }

  /**
   * One frame at a station. There is nothing to walk to and nothing to choose
   * between — the job named the row and the player is already standing at it —
   * so this is only ever "start it, or leave the one running alone". The channel
   * re-arms itself down the stack, and when the inputs run out `canCraft`
   * refuses, the channel stops, and next frame the job derives to something
   * else.
   */
  private make(recipe: CraftingRecipe): boolean {
    this.deps.targeting.clearTarget();
    if (this.deps.isChanneling()) {
      return true;
    }
    this.ctx.player.stopMoving();
    this.deps.craft(recipe);
    return true;
  }

  /**
   * One frame of a gathering camp. Returns false when this tool has no work in
   * this zone at all, which is the caller's cue to fall back to fighting — a
   * fishing pole in the bandit camp is a camp with nothing to fish, not a camp
   * that should stand still until the tab closes.
   */
  private gather(skill: SkillId): boolean {
    const { character } = this.ctx;
    const action = chooseAfkNode(this.nodeCandidates(), skill);
    if (action.kind === 'none') {
      return false;
    }

    this.deps.targeting.clearTarget();
    // The channel re-arms itself and the walk finishes on its own; re-issuing
    // either every frame would restart it and it would never complete. Any
    // channel counts, not only a gather — a pan the player left on the fire
    // finishes its stack before the axe comes out.
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
  private canKeepWhatItFinds(job: AfkCampJob): boolean {
    const { character } = this.ctx;
    // A making camp always can: it spends what it is carrying to make what it
    // makes, so a bench full of ore is a pack getting lighter rather than one
    // about to overflow. It is the one job a full pack is no warning about.
    if (job.kind === 'craft') {
      return true;
    }
    if (job.kind === 'fight') {
      return character.carriedWeight() < character.carryCapacity();
    }
    const node = this.chosenNode(job.skill);
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
