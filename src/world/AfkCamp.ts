import {
  AFK_ANCHOR_RADIUS,
  chooseAfkFood,
  decideAfkAction,
  shouldAfkEat,
} from '../systems/AfkSystem';
import { logNotice } from '../systems/CombatLogSystem';
import { inventoryEntries } from '../systems/InventorySystem';
import { resolveOfflineAfk, type OfflineAfkReport } from '../systems/OfflineAfkSystem';
import { distance, withinRadius, type Point } from '../systems/MovementSystem';
import type { EnemyId, ItemId } from '../types/ids';
import { AFK_STATE_CHANGED_EVENT, type AchievementUnlock } from '../ui/uiEvents';
import type { Mob } from './Mob';
import type { Targeting } from './targeting';
import type { WorldContext } from './WorldContext';

/** What the camp needs from the rest of the zone, and the whole of it. */
export interface AfkCampDeps {
  mobs: Mob[];
  targeting: Targeting;
  /** Settling in gives up both of the things a hand on the mouse was doing. */
  stopGathering(): void;
  closeShop(): void;
  eat(itemId: ItemId): void;
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
 * The unattended player: it picks fights, stays where it was left, and eats when
 * it is hurt.
 *
 * Deliberately a worse player than the person it stands in for. It never uses an
 * ability — the action bar is an advantage only a hand on the keyboard gets —
 * and everything it earns is halved on the way in, which is the world's job
 * rather than this one's (see `ZoneWorld.awardXp`).
 */
export class AfkCamp {
  active = false;

  private readonly ctx: WorldContext;
  private readonly deps: AfkCampDeps;
  // The spot the character settled at — fights are leashed to it — and whether
  // they are currently standing down to heal rather than pulling.
  private anchor: Point = { x: 0, y: 0 };
  private recovering = false;

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
    if (active) {
      this.deps.stopGathering();
      this.deps.closeShop();
      this.anchor = this.ctx.playerPoint();
      this.ctx.log(logNotice('You settle in to camp.'));
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
    });
    if (report.kills <= 0) {
      this.ctx.persistCharacter();
      return null;
    }

    for (const [itemId, quantity] of inventoryEntries(report.drops)) {
      character.addItem(itemId, quantity);
    }
    character.addCurrency(report.copper);
    this.deps.awardXp(report.xp);
    const unlocks = report.enemyId ? this.deps.creditKill(report.enemyId, report.kills) : [];
    this.ctx.publishInventory();
    this.ctx.publishCurrency();
    this.ctx.persistCharacter();
    return { report, unlocks };
  }

  update(): void {
    if (!this.active || !this.ctx.player.isAlive()) return;
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
