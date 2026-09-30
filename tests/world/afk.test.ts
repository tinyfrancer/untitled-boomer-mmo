import { beforeEach, describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { TILE_SIZE } from '../../src/config/constants';
import { harness, mobsByReach } from './harness';
import {
  AFK_SET_REQUESTED_EVENT,
  AFK_STATE_CHANGED_EVENT,
  IDLE_FOOD_CHANGED_EVENT,
  IDLE_FOOD_KEEP_REQUESTED_EVENT,
  IDLE_FOOD_MOVE_REQUESTED_EVENT,
} from '../../src/ui/uiEvents';
import { AFK_ANCHOR_RADIUS } from '../../src/systems/AfkSystem';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';

/**
 * The camp: a deliberately worse player than the person it stands in for. What
 * matters is that it fights on its own, stays where it was left, and gives the
 * controls straight back to a hand on the keyboard.
 */

beforeEach(() => {
  localStorage.clear();
});

/** Parked beside a level 1 rat, whole, with nothing selected. */
function camped(): ReturnType<typeof harness> {
  const kit = harness();
  const rat = kit.world.mobs.find((mob) => mob.level === 1 && mob.isAlive());
  if (!rat) throw new Error('town has no live level 1 rat');
  kit.world.teleport(rat.x - 60, rat.y);
  kit.world.player.restoreToFull();
  kit.bus.emit(AFK_SET_REQUESTED_EVENT, true);
  return kit;
}

describe('camping', () => {
  it('starts with nothing selected, and says so', () => {
    const { world, emissions } = camped();

    expect(world.afkActive).toBe(true);
    expect(world.target).toBeNull();
    expect(emissions(AFK_STATE_CHANGED_EVENT).at(-1)).toEqual([true]);
  });

  it('picks a fight and opens combat with no input at all', () => {
    const { world, until } = camped();

    until(() => world.target !== null, 'the camp to pick a target on its own');
    until(() => world.mobs.some((mob) => mob.isEngaged()), 'the camp to open combat');
  });

  it('parks the session in the save, which is what pays out offline', () => {
    const { state } = camped();

    expect(state.afk).toMatchObject({ zoneId: 'town' });
  });

  it('drops a fight that has wandered off the spot it was left at', () => {
    const { world, until, tick } = camped();
    until(() => world.target !== null, 'the camp to pick a target');
    const dragged = world.target;
    if (!dragged) throw new Error('no target to drag away');

    // Everything else pushed out of reach first, so the only thing that can
    // drop this target is the anchor and not the camp preferring a nearer mob.
    world.mobs.filter((mob) => mob !== dragged).forEach((mob) => mob.setPosition(0, 0));
    // A mob that leashed off and went home. The anchor is the player's spot at
    // the toggle, so moving the mob is what takes the fight out of the camp
    // rather than moving the player. Anything still chasing is answered
    // whatever the distance — that is the rule this one sits behind.
    dragged.setPosition(world.player.x + AFK_ANCHOR_RADIUS * 2, world.player.y);
    dragged.disengage();
    tick(1);

    expect(world.target).toBeNull();
  });

  it('hands the controls back the moment a movement key goes down', () => {
    const { world, input, tick } = camped();

    input.press('KeyW');
    tick(1);

    expect(world.afkActive).toBe(false);
  });

  it('ends when the player dies, rather than feeding the same mob unattended', () => {
    // In the bandit camp, where standing still is not an option: the camp's own
    // answer to being hurt is to stop pulling and rest, which a town rat is
    // happy to allow and a bandit is not.
    const { world, state, bus, until } = harness({ zoneId: 'bandit-camp' });
    const bandit = nth(world.mobs, 0);
    world.teleport(bandit.x, bandit.y);
    bus.emit(AFK_SET_REQUESTED_EVENT, true);
    world.player.takeDamage(world.player.hp - 1);

    until(() => !world.afkActive, 'the camp to end with the player');
    expect(state.afk).toBeNull();
  });
});

/**
 * The camp with a tool in its hands, driven in a real town: it walks to a tree,
 * chops it, moves to the next one when that is spent, and trains the skill —
 * all with nothing touching the controls. What decides any of it is the weapon
 * slot, so the whole setup here is "equip an axe".
 */
describe('camping a gathering skill', () => {
  /** An axe in hand, parked in the grove in the town's south-west. */
  function woodcutting(): ReturnType<typeof harness> {
    const kit = harness();
    const tree = kit.world.nodes.find((node) => node.definition.skill === 'woodcutting');
    if (!tree) throw new Error('town has no tree');
    kit.character.addItem('felling-axe', 1);
    kit.character.equip('felling-axe');
    kit.world.teleport(tree.x, tree.y + 60);
    kit.bus.emit(AFK_SET_REQUESTED_EVENT, true);
    return kit;
  }

  it('chops with no input at all, and pockets the logs', () => {
    const { world, character, until } = woodcutting();

    until(() => character.itemCount('logs') > 0, 'the camp to chop its first logs');
    expect(world.afkActive).toBe(true);
  });

  it('trains the skill it is working', () => {
    const { character, until } = woodcutting();
    const before = character.skillLevelOf('woodcutting');

    until(
      () =>
        character.state.skills.woodcutting.xp > 0 || character.skillLevelOf('woodcutting') > before,
      'woodcutting xp to come in',
    );
  });

  // The whole point of a camp over tapping one tree: a tree is four swings and
  // then fifteen seconds of nothing, so it works the stand rather than waiting.
  it('keeps going past what a single tree holds', () => {
    const { character, until } = woodcutting();
    const oneTree = RESOURCE_NODES.tree.charges ?? 0;

    until(
      () => character.itemCount('logs') > oneTree,
      'the camp to out-chop a single tree',
      120000,
    );
  });

  it('parks the session so a closed tab still pays the skill', () => {
    const { state } = woodcutting();
    expect(state.afk).toMatchObject({ zoneId: 'town' });
  });

  // Fishing is the same rule with a different tool, and the town pond needs no
  // level at all — so this is the whole of what "AFK fishing" required.
  it('fishes instead when that is what is in hand', () => {
    const kit = harness();
    const spot = kit.world.nodes.find((node) => node.definition.skill === 'fishing');
    if (!spot) throw new Error('town has no fishing spot');
    kit.character.addItem('fishing-pole', 1);
    kit.character.equip('fishing-pole');
    kit.world.teleport(spot.x, spot.y + 60);
    kit.bus.emit(AFK_SET_REQUESTED_EVENT, true);

    kit.until(() => kit.character.itemCount('raw-fish') > 0, 'the camp to land a fish');
  });
});

/**
 * The camp with a station under it rather than a tool in it, driven in a real
 * town. This is the hole PR 11 was named after: cooking has no tool at all, so
 * the skill with the deepest active loop was the one skill nobody could camp,
 * and smithing would have inherited the same problem the day the forge landed.
 *
 * What is worth holding here is that the station is enough on its own — nothing
 * is equipped, nothing is stored, and no second button was pressed.
 */
describe('camping a making skill', () => {
  /** Parked at the town forge with ore in the pack and no tool in hand. */
  function smithing(): ReturnType<typeof harness> {
    const kit = harness();
    const forge = kit.world.stations.find((station) => station.station === 'forge');
    if (!forge) throw new Error('town has no forge');
    kit.character.addItem('tin-ore', 8);
    kit.world.teleport(forge.x, forge.y + 40);
    kit.tick(1);
    kit.bus.emit(AFK_SET_REQUESTED_EVENT, true);
    return kit;
  }

  it('smelts with no input at all, and works down the pile', () => {
    const { world, character, until } = smithing();

    until(() => character.itemCount('tin-bar') > 0, 'the camp to pull its first bar', 120000);
    expect(world.afkActive).toBe(true);
    expect(character.itemCount('tin-ore')).toBeLessThan(8);
  });

  // A camp is a derivation and not a mode, so the thing that decides what it is
  // doing keeps being asked. Ore runs out, the bench goes bare, and what is
  // left is a character standing in a town full of rats.
  it('goes back to fighting once the bench is bare', () => {
    const { world, character, until } = smithing();

    character.removeItem('tin-ore', character.itemCount('tin-ore'));
    // A rat wandered up to the smithy: the forge is up the quarry road, out of
    // reach of the town's rats where they live.
    const forge = world.stations.find((station) => station.station === 'forge');
    const rat = nth(mobsByReach(world));
    if (forge) rat.setPosition(forge.x + TILE_SIZE * 2, forge.y + TILE_SIZE);

    until(() => world.target !== null, 'the camp to pick a fight instead', 60000);
  });

  // Cooking is the same rule at the other station, and the one the tool rule
  // could never have reached: there is no pan to equip.
  it('cooks at a fire lit by the player, with nothing in hand', () => {
    const kit = harness();
    kit.character.addItem('logs', 1);
    kit.character.addItem('raw-fish', 6);
    kit.world.handleLightFireRequested();
    kit.tick(1);
    kit.bus.emit(AFK_SET_REQUESTED_EVENT, true);

    kit.until(
      () => kit.character.itemCount('cooked-fish') + kit.character.itemCount('burnt-fish') > 0,
      'the camp to put a fish in the pan',
      60000,
    );
  });

  // What the save has to carry that the zone cannot: a forge is one tile of a
  // town, so where the character stood is not something the morning could
  // re-derive.
  it('parks the station in the session, not just the zone', () => {
    const { state } = smithing();
    expect(state.afk).toMatchObject({ zoneId: 'town', station: 'forge' });
  });

  // And the other half of that: a camp that settled to gather or to fight
  // records none, which is what keeps the offline precedence the same
  // precedence the awake loop ran on.
  it('records no station for a camp that settled to fight', () => {
    const kit = harness();
    kit.bus.emit(AFK_SET_REQUESTED_EVENT, true);
    expect(kit.state.afk).toMatchObject({ station: null });
  });
});

describe('the keyboard', () => {
  it('clears the selected target on Escape, drained as an action', () => {
    const { world, input, tick } = harness();
    world.setTarget(nth(world.mobs));

    input.press('Escape');
    tick(1);

    expect(world.target).toBeNull();
  });
});

/**
 * What idle eats is set from the idle panel (decision 96), and the world is
 * what hears the asks: the HUD sends an item and a direction, and the answer
 * is the whole choice, saved with the character.
 */
describe("setting idle's food from the panel", () => {
  it('moves and keeps a food on the save, and answers with the choice', () => {
    const { bus, state, character, emissions } = harness();
    character.addItem('cooked-rat', 2);
    character.addItem('cooked-crab', 1);

    bus.emit(IDLE_FOOD_MOVE_REQUESTED_EVENT, 'cooked-crab', 'earlier');
    bus.emit(IDLE_FOOD_KEEP_REQUESTED_EVENT, 'cooked-rat', true);

    expect(state.idleFood.order.indexOf('cooked-crab')).toBeLessThan(
      state.idleFood.order.indexOf('cooked-rat'),
    );
    expect(state.idleFood.keep).toEqual(['cooked-rat']);
    expect(emissions(IDLE_FOOD_CHANGED_EVENT).at(-1)).toEqual([state.idleFood]);
  });
});
