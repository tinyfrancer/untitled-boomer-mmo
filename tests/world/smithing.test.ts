import { beforeEach, describe, expect, it } from 'vitest';
import { RECIPES, STATION_RADIUS } from '../../src/data/recipes';
import { NOTICE_EVENT } from '../../src/ui/uiEvents';
import { harness } from './harness';

/**
 * The forge, driven as a place rather than as a counter.
 *
 * What is worth holding here is the half that is *not* the pan: that a station
 * standing in the zone is what makes a recipe legal, that walking off one
 * cancels the job the way losing a fire does, and that a failed smith keeps the
 * bar — which is the one rule the widening added and the one a cooking test
 * cannot cover, since a burnt fish is gone by design.
 */

beforeEach(() => {
  localStorage.clear();
});

const TIN = RECIPES['tin-bar'];

function atTheForge(options: { level?: number } = {}) {
  const kit = harness({ zoneId: 'town', level: options.level ?? 1 });
  const forge = kit.world.stations.find((station) => station.station === 'forge');
  if (!forge) throw new Error('town has no forge');
  kit.world.teleport(forge.x, forge.y + 40);
  kit.tick(1);
  return { ...kit, forge };
}

describe('the forge', () => {
  it('stands in town and is what makes smelting legal', () => {
    const kit = atTheForge();
    // Levelled past the failure curve so one swing is one bar: this is about
    // the station being there, not about the dice.
    kit.character.awardSkillXp('smithing', 10_000);
    kit.state.inventory = { 'tin-ore': 2 };

    kit.world.handleCraftRequested('tin-bar');
    kit.tick(Math.ceil(TIN.durationMs / 200) + 1);

    expect(kit.state.inventory['tin-bar'] ?? 0).toBeGreaterThan(0);
  });

  it('refuses from across town, and says why', () => {
    const kit = atTheForge();
    kit.state.inventory = { 'tin-ore': 2 };
    kit.world.teleport(kit.forge.x + STATION_RADIUS * 4, kit.forge.y);
    kit.tick(1);

    kit.world.handleCraftRequested('tin-bar');

    expect(kit.state.inventory['tin-bar'] ?? 0).toBe(0);
    expect(String(kit.emissions(NOTICE_EVENT).at(-1))).toContain('forge');
  });

  // The same rule the pan lives by, asked of the other station: a channel is
  // cancelled by losing what it is being done at.
  it('cancels the job when the player walks away mid-swing', () => {
    const kit = atTheForge();
    kit.state.inventory = { 'tin-ore': 2 };

    kit.world.handleCraftRequested('tin-bar');
    kit.tick(1);
    kit.world.teleport(kit.forge.x + STATION_RADIUS * 4, kit.forge.y);
    kit.tick(Math.ceil(TIN.durationMs / 200) + 2);

    expect(kit.state.inventory['tin-bar'] ?? 0).toBe(0);
    expect(kit.state.inventory['tin-ore']).toBe(2);
  });

  it('holds a recipe back below its level', () => {
    const kit = atTheForge();
    kit.state.inventory = { 'iron-ore': 4 };

    kit.world.handleCraftRequested('iron-bar');
    kit.tick(20);

    expect(kit.state.inventory['iron-bar'] ?? 0).toBe(0);
    expect(String(kit.emissions(NOTICE_EVENT).at(-1))).toContain('Smithing');
  });

  /**
   * The forge's one recipe that makes nothing anybody wears, and the reason it
   * is here: bones and logs were two of the four materials in the game that led
   * nowhere, and this is where both of them go.
   */
  it('burns bones and a log down into the char the plate tier is hardened with', () => {
    const kit = atTheForge();
    kit.character.awardSkillXp('smithing', 10_000);
    kit.state.inventory = { 'rat-bones': 2, logs: 1 };

    kit.world.handleCraftRequested('bone-char');
    kit.tick(Math.ceil(RECIPES['bone-char'].durationMs / 200) + 1);

    expect(kit.state.inventory['bone-char'] ?? 0).toBe(1);
    expect(kit.state.inventory['rat-bones'] ?? 0).toBe(0);
    expect(kit.state.inventory['logs'] ?? 0).toBe(0);
  });

  // A piece of plate is where the quarry, the trees and the town rats meet, and
  // the whole basket has to be on the bench before any of it is spent.
  it('finishes a helmet only once the bars, the tin and the char are all there', () => {
    const kit = atTheForge();
    kit.character.awardSkillXp('smithing', 10_000);
    kit.state.inventory = { 'iron-bar': 2, 'tin-bar': 1 };

    kit.world.handleCraftRequested('iron-helmet');
    kit.tick(Math.ceil(RECIPES['iron-helmet'].durationMs / 200) + 1);
    expect(kit.state.inventory['iron-helmet'] ?? 0).toBe(0);
    expect(kit.state.inventory['iron-bar']).toBe(2);

    kit.character.addItem('bone-char', 1);
    kit.world.handleCraftRequested('iron-helmet');
    kit.tick(Math.ceil(RECIPES['iron-helmet'].durationMs / 200) + 1);

    expect(kit.state.inventory['iron-helmet'] ?? 0).toBe(1);
    expect(kit.state.inventory['tin-bar'] ?? 0).toBe(0);
    expect(kit.state.inventory['bone-char'] ?? 0).toBe(0);
  });

  it('refuses a recipe whose inputs are not all in the pack', () => {
    const kit = atTheForge();
    kit.character.awardSkillXp('smithing', 10_000);
    kit.state.inventory = { 'iron-bar': 1 };

    kit.world.handleCraftRequested('iron-helmet');
    kit.tick(30);

    expect(kit.state.inventory['iron-helmet'] ?? 0).toBe(0);
    expect(kit.state.inventory['iron-bar']).toBe(1);
  });
});

describe('what a failed smith costs', () => {
  /**
   * The rule the widening exists for. A burnt fish is gone — that is what makes
   * cooking worth levelling — but ore is heavy and took a pack-filling trip to
   * carry home, so a bad roll at the forge costs the time and nothing else.
   *
   * Smelted in a loop with the dice left unloaded: what is held is a
   * conservation over however the rolls fell, and a single swing asserting a
   * failure would be a test that passes for the wrong reason most runs.
   */
  it('spends exactly one rock per bar, however many swings failed', () => {
    const kit = atTheForge();
    kit.state.inventory = { 'tin-ore': 20 };

    kit.world.handleCraftRequested('tin-bar');
    // Long enough for the channel to re-arm down the stack many times over, and
    // at a level where roughly half of those swings fail.
    kit.tick(200);

    const ore = kit.state.inventory['tin-ore'] ?? 0;
    const bars = kit.state.inventory['tin-bar'] ?? 0;
    // The conservation law, which is the whole of the rule: a bar cost a rock
    // and a failure cost nothing, so the two always add back up to twenty.
    expect(ore + bars).toBe(20);
    expect(bars).toBeGreaterThan(0);
  });
});
