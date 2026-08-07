import {
  AFK_ANCHOR_RADIUS,
  chooseAfkFood,
  decideAfkAction,
  shouldAfkEat,
} from '../systems/AfkSystem';
import { logNotice } from '../systems/CombatLogSystem';
import { distance, withinRadius, type Point } from '../systems/MovementSystem';
import type { ItemId } from '../types/ids';
import { AFK_STATE_CHANGED_EVENT } from '../ui/uiEvents';
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
