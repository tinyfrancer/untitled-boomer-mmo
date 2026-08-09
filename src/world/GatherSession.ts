import { consumableFor } from '../data/items';
import { FIRE_COOK_RADIUS, FIRE_INPUT_ITEM_ID } from '../data/recipes';
import { canCook, findCookableItem, recipeForInput, rollCook } from '../systems/CookingSystem';
import {
  advanceGather,
  beginGather,
  canGather,
  rollGatherQuantity,
  type GatherState,
} from '../systems/GatherSystem';
import { distance, withinRadius } from '../systems/MovementSystem';
import type { ItemId } from '../types/ids';
import { GATHER_ENDED_EVENT, GATHER_PROGRESS_EVENT, GATHER_STARTED_EVENT } from '../ui/uiEvents';
import { Campfire } from './Campfire';
import type { ResourceNode } from './ResourceNode';
import type { WorldContext } from './WorldContext';

/**
 * Everything the player does with their hands rather than a weapon: the gather
 * channel, the fire it feeds, the pan over that fire, and eating what comes off
 * it.
 *
 * The four belong together because the fire is what joins them — it is lit from
 * gathered logs, it is what makes cooking legal, and whether one is in reach is
 * the only thing the item buttons in the bag are driven off.
 */
/** What the gather channel needs from the rest of the zone, and the whole of it. */
export interface GatherSessionDeps {
  /**
   * Whether nobody is at the keyboard, which is the whole of what decides what
   * a full pack means: an attended player is stopped so they can make room, an
   * unattended one keeps working and loses the haul.
   */
  isCamping(): boolean;
}

export class GatherSession {
  /** The channel in flight, or null. The HUD's progress bar is drawn off it. */
  state: GatherState | null = null;
  /** One fire at a time, and it burns out on its own clock. */
  campfire: Campfire | null = null;

  private readonly ctx: WorldContext;
  private readonly deps: GatherSessionDeps;
  private node: ResourceNode | null = null;

  constructor(ctx: WorldContext, deps: GatherSessionDeps) {
    this.ctx = ctx;
    this.deps = deps;
  }

  start(node: ResourceNode): void {
    if (!node.isAvailable()) {
      this.ctx.notice(`The ${node.definition.name} is spent.`);
      return;
    }

    const { character } = this.ctx;
    const check = canGather(node.definition, character.state.skills, character.state.gear);
    if (!check.ok) {
      this.ctx.notice(check.reason);
      return;
    }

    this.node = node;
    this.state = beginGather(node.definition, character.skillLevelOf(node.definition.skill));
    this.ctx.events.emit(GATHER_STARTED_EVENT, node.definition.name);
  }

  stop(): void {
    if (!this.state) return;
    this.state = null;
    this.node = null;
    this.ctx.events.emit(GATHER_ENDED_EVENT);
  }

  /**
   * Being hit breaks the channel, so gathering is never a way to ignore a mob
   * already chewing on you. Silent when there was nothing to break.
   */
  interrupt(): void {
    if (!this.state) return;
    this.ctx.notice('You are interrupted!');
    this.stop();
  }

  update(deltaMs: number): void {
    if (this.campfire?.update(deltaMs)) {
      this.campfire = null;
    }
    if (!this.state || !this.node) return;

    const node = this.node;
    const outcome = advanceGather(this.state, deltaMs, distance(this.ctx.player, node));

    if (outcome.status === 'gathering') {
      this.state = outcome.state;
      this.ctx.events.emit(GATHER_PROGRESS_EVENT, outcome.progress);
      this.ctx.push({
        kind: 'gather-tick',
        at: { x: node.x, y: node.y },
        nodeId: node.definition.id,
        progress: outcome.progress,
      });
      return;
    }

    if (outcome.status === 'cancelled') {
      this.stop();
      return;
    }

    this.complete(node);
  }

  isNearFire(): boolean {
    if (!this.campfire?.isLit()) return false;
    return withinRadius(this.ctx.player, this.campfire, FIRE_COOK_RADIUS);
  }

  lightFire(): void {
    const { character, player } = this.ctx;
    if (character.itemCount(FIRE_INPUT_ITEM_ID) <= 0) {
      this.ctx.notice('You have no logs to burn.');
      return;
    }

    // One fire at a time: lighting a new one replaces the old, rather than
    // letting the player carpet the town in campfires.
    this.campfire?.extinguish();
    character.removeItem(FIRE_INPUT_ITEM_ID, 1);
    this.campfire = new Campfire(player.x, player.y + 32);
    this.ctx.publishInventory();
  }

  /**
   * With an item selected in the bag the HUD names what to cook; without one
   * (dev console, older callers) fall back to the first cookable thing.
   */
  cook(itemId?: ItemId): void {
    const { character } = this.ctx;
    const recipe =
      (itemId ? recipeForInput(itemId) : null) ?? findCookableItem(character.state.inventory);
    if (!recipe) {
      this.ctx.notice('You have nothing to cook.');
      return;
    }

    const check = canCook(
      recipe,
      character.state.skills,
      character.state.inventory,
      this.isNearFire(),
    );
    if (!check.ok) {
      this.ctx.notice(check.reason);
      return;
    }

    const result = rollCook(recipe, character.skillLevelOf('cooking'));
    character.removeItem(recipe.inputItemId, 1);
    character.addItem(result.itemId, 1);
    this.ctx.publishInventory();
    if (result.burnt) {
      this.ctx.notice('You burn it.');
    } else {
      this.ctx.awardSkillXp('cooking', result.xp);
    }
  }

  eat(itemId: ItemId): void {
    const { character, player } = this.ctx;
    if (character.itemCount(itemId) <= 0 || !consumableFor(itemId)) {
      return;
    }
    if (player.hp >= player.maxHp) {
      this.ctx.notice('You are already at full health.');
      return;
    }
    if (!player.eat(itemId)) {
      return;
    }

    character.removeItem(itemId, 1);
    this.ctx.publishInventory();
  }

  private complete(node: ResourceNode): void {
    const { character } = this.ctx;
    const { definition } = node;

    const quantity = rollGatherQuantity(character.skillLevelOf(definition.skill));
    /**
     * What a full pack means depends on who is watching.
     *
     * An attended player is stopped: they are right there, the node keeps its
     * charge, and nothing is destroyed while they go and make room. An
     * unattended one keeps working and loses the haul — the swing happened and
     * the skill is what the swing teaches, so stopping the camp dead would cost
     * them the whole night rather than the logs. What it cost is itemised on
     * the away report; see `OfflineAfkSystem`.
     */
    if (!character.tryAddItem(definition.yieldItemId, quantity)) {
      if (!this.deps.isCamping()) {
        this.ctx.notice('Your pack is full.');
        this.stop();
        return;
      }
    } else {
      this.ctx.publishInventory();
    }
    this.ctx.awardSkillXp(definition.skill, definition.xpReward);

    if (node.consumeCharge()) {
      this.stop();
      return;
    }

    // Auto-repeat: re-arm the channel so gathering runs unattended until
    // something interrupts it.
    this.state = beginGather(definition, character.skillLevelOf(definition.skill));
    this.ctx.events.emit(GATHER_PROGRESS_EVENT, 0);
  }
}
