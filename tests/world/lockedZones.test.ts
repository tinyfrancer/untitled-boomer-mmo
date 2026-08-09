import { describe, expect, it } from 'vitest';
import { harness, type Harness } from './harness';
import { EXIT_MARGIN } from '../../src/config/constants';
import {
  INVENTORY_CHANGED_EVENT,
  NOTICE_EVENT,
  UNLOCKED_ZONES_CHANGED_EVENT,
} from '../../src/ui/uiEvents';
import type { WorldSignpost } from '../../src/world/zoneEntities';

/**
 * The locked door, from all three sides.
 *
 * A zone is reached by walking into the map edge, by tapping its signpost, or by
 * travelling from the world map — and a lock that only one of them respects is
 * not a lock. Every one of these goes through `ZoneWorld.openWayInto`, which is
 * also the only place a key is ever spent.
 */

const HIDEOUT = 'bandit-hideout';

/** Standing against the bandit camp's east edge, which is the way in. */
function leanOnTheEastEdge(kit: Harness): void {
  kit.world.teleport(kit.world.worldWidth - EXIT_MARGIN / 2, kit.world.worldHeight / 2);
}

function hideoutSignpost(kit: Harness): WorldSignpost {
  const post = kit.world.signposts.find((candidate) => candidate.exit.to === HIDEOUT);
  if (!post) throw new Error('the bandit camp has no signpost to the hideout');
  return post;
}

function camp(): Harness {
  return harness({ zoneId: 'bandit-camp' });
}

describe('walking into a locked zone', () => {
  it('refuses at the edge and says what is missing', () => {
    const kit = camp();
    leanOnTheEastEdge(kit);

    expect(kit.tick(1)).toEqual([]);
    expect(kit.world.changingZone).toBe(false);
    expect(kit.emissions(NOTICE_EVENT).at(-1)).toEqual([
      'The Bandit Hideout is locked. You need a Hideout Key.',
    ]);
  });

  /**
   * A refusal is a toast, and a player pressed against a shut door is there for
   * more than one frame — without the latch this is sixty of them a second.
   */
  it('says it once however long they lean on it', () => {
    const kit = camp();
    leanOnTheEastEdge(kit);

    kit.tick(30);

    expect(kit.emissions(NOTICE_EVENT)).toHaveLength(1);
  });

  it('says it again after they walk away and come back', () => {
    const kit = camp();
    leanOnTheEastEdge(kit);
    kit.tick(1);

    kit.world.teleport(kit.world.worldWidth / 2, kit.world.worldHeight / 2);
    kit.tick(1);
    leanOnTheEastEdge(kit);
    kit.tick(1);

    expect(kit.emissions(NOTICE_EVENT)).toHaveLength(2);
  });

  it('lets them through on the key, and spends it', () => {
    const kit = camp();
    kit.character.addItem('hideout-key', 1);
    leanOnTheEastEdge(kit);

    expect(kit.tick(1)).toContainEqual({
      kind: 'zone-exit',
      to: HIDEOUT,
      edge: 'west',
      fraction: 0.5,
    });
    expect(kit.character.itemCount('hideout-key')).toBe(0);
    expect(kit.state.unlockedZones).toEqual([HIDEOUT]);
  });

  // The key is gone by the second visit, which is the whole point of storing
  // the door rather than reading the bag.
  it('lets them back in afterwards with an empty pack', () => {
    const kit = camp();
    kit.state.unlockedZones = [HIDEOUT];
    leanOnTheEastEdge(kit);

    expect(kit.world.changingZone).toBe(false);
    kit.tick(1);
    expect(kit.world.changingZone).toBe(true);
  });
});

describe('the signpost to a locked zone', () => {
  /**
   * Asked on arrival rather than on the tap: the walk across a bandit camp is
   * long enough to loot a key on the way, and a door that refused before the
   * first step would be answering about a moment that had not happened.
   */
  it('walks there before it decides', () => {
    const kit = camp();
    const post = hideoutSignpost(kit);
    kit.world.teleport(post.x - 400, post.y);

    kit.world.approachSignpost(post);
    expect(kit.emissions(NOTICE_EVENT)).toEqual([]);

    kit.character.addItem('hideout-key', 1);
    kit.until(() => kit.world.changingZone, 'the walk to the hideout signpost to finish');
    expect(kit.character.itemCount('hideout-key')).toBe(0);
  });

  it('refuses on arrival with nothing to open it', () => {
    const kit = camp();
    const post = hideoutSignpost(kit);
    kit.world.teleport(post.x - 200, post.y);

    kit.world.approachSignpost(post);
    kit.until(() => kit.emissions(NOTICE_EVENT).length > 0, 'the signpost to refuse');

    expect(kit.world.changingZone).toBe(false);
  });
});

describe('travelling to a locked zone from the world map', () => {
  it('is refused like every other way in', () => {
    const kit = camp();

    kit.world.handleTravelRequested(HIDEOUT);

    expect(kit.world.changingZone).toBe(false);
    expect(kit.emissions(NOTICE_EVENT).at(-1)).toEqual([
      'The Bandit Hideout is locked. You need a Hideout Key.',
    ]);
  });

  // Travel is a shortcut past the walk, not past the key: it costs one, the
  // same as pushing the door open in person.
  it('spends the key when the map is what opens the door', () => {
    const kit = camp();
    kit.character.addItem('hideout-key', 1);

    kit.world.handleTravelRequested(HIDEOUT);

    expect(kit.world.changingZone).toBe(true);
    expect(kit.state.unlockedZones).toEqual([HIDEOUT]);
    // The bag the HUD is holding has to lose the key too, or a cell for one
    // nobody owns is left on the bag sheet.
    expect(kit.emissions(INVENTORY_CHANGED_EVENT).at(-1)).toEqual([{}]);
  });
});

describe('what the HUD is told about locks', () => {
  // On the wire because the key is *spent* opening the door: a pack with no key
  // in it means "never found one" or "already used it", and the world map draws
  // those two cells very differently.
  it('publishes the opened doors on the first frame of a world', () => {
    const kit = harness({ zoneId: 'town' });
    kit.state.unlockedZones = [HIDEOUT];

    kit.tick(1);

    expect(kit.emissions(UNLOCKED_ZONES_CHANGED_EVENT)).toEqual([[[HIDEOUT]]]);
  });

  it('says nothing more while nothing opens', () => {
    const kit = harness({ zoneId: 'town' });

    kit.tick(20);

    expect(kit.emissions(UNLOCKED_ZONES_CHANGED_EVENT)).toEqual([[[]]]);
  });
});
