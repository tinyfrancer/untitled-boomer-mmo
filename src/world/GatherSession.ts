import { consumableFor } from '../data/items';
import {
  STATION_RADIUS,
  FIRE_INPUT_ITEM_ID,
  type CraftingRecipe,
  type StationId,
} from '../data/recipes';
import {
  advanceCraft,
  beginCraft,
  canCraft,
  findCraftableFrom,
  recipeById,
  recipeFromItem,
  rollCraft,
  type CraftState,
} from '../systems/CraftingSystem';
import {
  advanceGather,
  beginGather,
  canGather,
  rollGatherQuantity,
  type GatherState,
} from '../systems/GatherSystem';
import { distance, withinRadius } from '../systems/MovementSystem';
import type { ItemId, RecipeId } from '../types/ids';
import { CHANNEL_ENDED_EVENT, CHANNEL_PROGRESS_EVENT, CHANNEL_STARTED_EVENT } from '../ui/uiEvents';
import { Campfire } from './Campfire';
import type { ResourceNode } from './ResourceNode';
import type { WorldStation } from './zoneEntities';
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
  /** Every fixed station in this zone, for the range check the forge needs. */
  stations: WorldStation[];
  /**
   * Whether nobody is at the keyboard, which is the whole of what decides what
   * a full pack means: an attended player is stopped so they can make room, an
   * unattended one keeps working and loses the haul.
   */
  isCamping(): boolean;
}

export class GatherSession {
  /** The gather channel in flight, or null. */
  state: GatherState | null = null;
  /**
   * What is in the pan, or null. It is the gather's twin rather than a second
   * kind of thing: one bar draws both, and only one of them can ever be running.
   */
  cooking: CraftState | null = null;
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

    // One bar, so a swing at a tree takes it off whatever was in the pan.
    this.cooking = null;
    this.node = node;
    this.state = beginGather(node.definition, character.skillLevelOf(node.definition.skill));
    this.ctx.events.emit(CHANNEL_STARTED_EVENT, node.definition.name);
  }

  /** Drops whichever channel is running: the gather, or the pan over the fire. */
  stop(): void {
    if (!this.isChanneling()) return;
    this.state = null;
    this.node = null;
    this.cooking = null;
    this.ctx.events.emit(CHANNEL_ENDED_EVENT);
  }

  /** Whether either channel is running, which is a camp's "leave it alone". */
  isChanneling(): boolean {
    return this.state !== null || this.cooking !== null;
  }

  /**
   * Being hit breaks the channel, so neither gathering nor cooking is a way to
   * ignore a mob already chewing on you. Silent when there was nothing to break.
   */
  interrupt(): void {
    if (!this.isChanneling()) return;
    this.ctx.notice('You are interrupted!');
    this.stop();
  }

  update(deltaMs: number): void {
    if (this.campfire?.update(deltaMs)) {
      this.campfire = null;
    }
    this.updateCooking(deltaMs);
    if (!this.state || !this.node) return;

    const node = this.node;
    const outcome = advanceGather(this.state, deltaMs, distance(this.ctx.player, node));

    if (outcome.status === 'gathering') {
      this.state = outcome.state;
      this.ctx.events.emit(CHANNEL_PROGRESS_EVENT, outcome.progress);
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

  /**
   * Whether a forge is in reach.
   *
   * The fire's twin, and deliberately the same shape: a station is a thing in
   * the world with a radius round it, so what "at the forge" means is the same
   * question asked of a different object. What differs is only that a forge came
   * with the zone and cannot go out.
   */
  isNearForge(): boolean {
    return this.deps.stations.some(
      (station) =>
        station.station === 'forge' && withinRadius(this.ctx.player, station, STATION_RADIUS),
    );
  }

  /** Whether the station a recipe names is in reach right now. */
  private atStation(station: StationId): boolean {
    return station === 'fire' ? this.isNearFire() : this.isNearForge();
  }

  /**
   * Starts a named recipe, which is how anything with a list of inputs is
   * asked for: a bag cell cannot say which of three things four bars were meant
   * to become, so the forge's panel names the row and this runs it.
   */
  smith(recipeId: RecipeId): void {
    this.craft(recipeById(recipeId));
  }

  isNearFire(): boolean {
    if (!this.campfire?.isLit()) return false;
    return withinRadius(this.ctx.player, this.campfire, STATION_RADIUS);
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
   * Puts something in the pan, which is a channel rather than a tap: a fish
   * takes `cookMs` over the fire, and standing there for it is what the burn is
   * now worth avoiding. With an item selected in the bag the HUD names what to
   * cook; without one (dev console, older callers) fall back to the first
   * cookable thing.
   */
  cook(itemId?: ItemId): void {
    const { character } = this.ctx;
    const recipe =
      (itemId ? recipeFromItem(itemId, 'fire') : null) ??
      findCraftableFrom(character.state.inventory, 'fire');
    if (!recipe) {
      this.ctx.notice('You have nothing to cook.');
      return;
    }
    this.craft(recipe);
  }

  /**
   * Puts something on a station, which is a channel rather than a tap: it takes
   * the recipe's `durationMs` and standing there for it is what a failure is
   * worth avoiding. One path for both stations — a fish over a fire and a bar in
   * a forge are the same job with different data.
   */
  private craft(recipe: CraftingRecipe): void {
    const { character } = this.ctx;
    // Already running: pressing again is nothing rather than a restart, or a
    // double tap would keep putting the same fish back on a cold clock.
    if (this.cooking?.recipe.id === recipe.id) return;

    const check = canCraft(
      recipe,
      character.state.skills,
      character.state.inventory,
      this.atStation(recipe.station),
    );
    if (!check.ok) {
      this.ctx.notice(check.reason);
      return;
    }

    // One bar between them, so whatever was running gives it up.
    this.stop();
    this.cooking = beginCraft(recipe);
    this.ctx.events.emit(CHANNEL_STARTED_EVENT, recipe.name);
    this.ctx.events.emit(CHANNEL_PROGRESS_EVENT, 0);
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

  private updateCooking(deltaMs: number): void {
    const cooking = this.cooking;
    if (!cooking) return;

    // The fire is the pan's range check, and it answers for both ways of losing
    // one: walking off it, and letting it burn out under you.
    const outcome = advanceCraft(cooking, deltaMs, this.atStation(cooking.recipe.station));
    if (outcome.status === 'crafting') {
      this.cooking = outcome.state;
      this.ctx.events.emit(CHANNEL_PROGRESS_EVENT, outcome.progress);
      return;
    }
    if (outcome.status === 'cancelled') {
      this.stop();
      return;
    }

    this.completeCook(cooking.recipe);
  }

  private completeCook(recipe: CraftingRecipe): void {
    const { character } = this.ctx;

    const result = rollCraft(recipe, character.skillLevelOf(recipe.skill));
    // A failure with nothing to show for it spends nothing: see `rollCraft`.
    if (result.consumed) {
      for (const input of recipe.inputs) {
        character.removeItem(input.itemId, input.quantity);
      }
    }
    if (result.itemId) {
      character.addItem(result.itemId, 1);
    }
    this.ctx.publishInventory();
    if (result.failed) {
      // What a failure is called is what it cost: a burnt fish is gone, where a
      // botched bar is still on the bench and only the time is lost.
      this.ctx.notice(result.consumed ? 'You burn it.' : `You ruin the ${recipe.name}.`);
    } else {
      this.ctx.awardSkillXp(recipe.skill, result.xp);
    }

    // Auto-repeat down the stack, the way the gather channel re-arms itself: a
    // bag of twenty fish is one decision rather than twenty. Asked again rather
    // than counted, since the fire can go out and the bag can empty — and a
    // refusal here is the stack finishing, so it is silent.
    const again = canCraft(
      recipe,
      character.state.skills,
      character.state.inventory,
      this.atStation(recipe.station),
    );
    if (!again.ok) {
      this.stop();
      return;
    }
    this.cooking = beginCraft(recipe);
    this.ctx.events.emit(CHANNEL_PROGRESS_EVENT, 0);
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
    this.ctx.events.emit(CHANNEL_PROGRESS_EVENT, 0);
  }
}
