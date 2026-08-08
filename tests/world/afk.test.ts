import { beforeEach, describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { harness } from './harness';
import { AFK_STATE_CHANGED_EVENT, AFK_TOGGLE_REQUESTED_EVENT } from '../../src/ui/uiEvents';
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
  kit.bus.emit(AFK_TOGGLE_REQUESTED_EVENT);
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
    bus.emit(AFK_TOGGLE_REQUESTED_EVENT);
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
    kit.bus.emit(AFK_TOGGLE_REQUESTED_EVENT);
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
    kit.bus.emit(AFK_TOGGLE_REQUESTED_EVENT);

    kit.until(() => kit.character.itemCount('raw-fish') > 0, 'the camp to land a fish');
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
