import { beforeEach, describe, expect, it } from 'vitest';
import { RECIPES, STATION_RADIUS } from '../../src/data/recipes';
import { AFK_TOGGLE_REQUESTED_EVENT, NOTICE_EVENT } from '../../src/ui/uiEvents';
import { harness } from './harness';

/**
 * The tannery at Greyford, driven as a place.
 *
 * `tests/systems/greyfordTannery.test.ts` holds what the tables claim; this is
 * the half only a running zone can answer — that a second station is a station
 * rather than a second forge with the wrong sign over it, that the panel and the
 * refusal name the one being stood at, and that a camp left in the yard actually
 * settles to the vat rather than standing about in a zone with nothing to fight.
 */

beforeEach(() => {
  localStorage.clear();
});

const TAN = RECIPES['cured-leather'];
const swings = (durationMs: number): number => Math.ceil(durationMs / 200) + 1;

function atTheVat(options: { level?: number } = {}) {
  const kit = harness({ zoneId: 'greyford', level: options.level ?? 5 });
  const vat = kit.world.stations.find((station) => station.station === 'tannery');
  if (!vat) throw new Error('greyford has no tannery');
  kit.world.teleport(vat.x, vat.y + 40);
  kit.tick(1);
  return { ...kit, vat };
}

describe('the vat', () => {
  it('stands in the yard and is what makes tanning legal', () => {
    const kit = atTheVat();
    // Past the failure curve, so one job is one leather rather than a coin
    // toss: this is about the station being there, not about the dice.
    kit.character.awardSkillXp('leatherworking', 100_000);
    kit.state.inventory = { 'lurker-hide': 2 };

    kit.world.handleCraftRequested('cured-leather');
    kit.tick(swings(TAN.durationMs));

    expect(kit.state.inventory['cured-leather'] ?? 0).toBeGreaterThan(0);
  });

  /**
   * The refusal names the tannery rather than the forge, which is the whole of
   * what generalising the panel bought. It read "You need a forge" from every
   * station in the game for as long as there was only one.
   */
  it('refuses from across the yard, and says which station it wanted', () => {
    const kit = atTheVat();
    kit.state.inventory = { 'lurker-hide': 2 };
    kit.world.teleport(kit.vat.x + STATION_RADIUS * 4, kit.vat.y);
    kit.tick(1);

    kit.world.handleCraftRequested('cured-leather');

    expect(kit.state.inventory['cured-leather'] ?? 0).toBe(0);
    const notice = String(kit.emissions(NOTICE_EVENT).at(-1));
    expect(notice).toContain('tannery');
    expect(notice).not.toContain('forge');
  });

  // Standing at one station is not standing at the other, which is the rule that
  // did not have to exist while every built station in the game was a forge.
  it('will not smelt, however much ore is in the pack', () => {
    const kit = atTheVat();
    kit.character.awardSkillXp('smithing', 10_000);
    kit.state.inventory = { 'tin-ore': 4 };

    kit.world.handleCraftRequested('tin-bar');
    kit.tick(30);

    expect(kit.state.inventory['tin-bar'] ?? 0).toBe(0);
    expect(kit.state.inventory['tin-ore']).toBe(4);
  });

  it('holds the vest back below its level, and says which skill', () => {
    const kit = atTheVat();
    kit.state.inventory = { 'cured-leather': 8, 'tin-bar': 4, 'bone-char': 4 };

    kit.world.handleCraftRequested('fenhide-vest');
    kit.tick(30);

    expect(kit.state.inventory['fenhide-vest'] ?? 0).toBe(0);
    expect(String(kit.emissions(NOTICE_EVENT).at(-1))).toContain('Leatherwork');
  });

  /**
   * A piece of fenhide is where the fen, the quarry, a rat and a tree meet, and
   * the whole basket has to be on the bench before any of it is spent — the same
   * rule the plate tier is held to, asked of the other vertical.
   */
  it('finishes a cowl only once the leather, the tin and the char are all there', () => {
    const kit = atTheVat();
    kit.character.awardSkillXp('leatherworking', 100_000);
    kit.state.inventory = { 'cured-leather': 2, 'tin-bar': 1 };

    kit.world.handleCraftRequested('fenhide-cowl');
    kit.tick(swings(RECIPES['fenhide-cowl'].durationMs));
    expect(kit.state.inventory['fenhide-cowl'] ?? 0).toBe(0);
    expect(kit.state.inventory['cured-leather']).toBe(2);

    kit.character.addItem('bone-char', 1);
    kit.world.handleCraftRequested('fenhide-cowl');
    kit.tick(swings(RECIPES['fenhide-cowl'].durationMs));

    expect(kit.state.inventory['fenhide-cowl'] ?? 0).toBe(1);
    expect(kit.state.inventory['cured-leather'] ?? 0).toBe(0);
    expect(kit.state.inventory['tin-bar'] ?? 0).toBe(0);
    expect(kit.state.inventory['bone-char'] ?? 0).toBe(0);
  });

  /**
   * A bad roll keeps the hide. Tanned in a loop with the dice left unloaded,
   * because what is held here is a relationship over however the rolls fell —
   * a single swing asserting a failure would pass for the wrong reason most
   * runs.
   *
   * The forge's twin of this asserts flat conservation — ore plus bars always
   * adds back to twenty — and that is only true there by accident of the rate: a
   * tin bar pays 10 XP, so twenty swings leave its mastery pool short of the
   * first rung that pays anything. A hide pays 90, so this run crosses
   * Apprentice part-way through and some of these come off the frame two at a
   * time. What the rule actually says is a **bound**: every hide gone produced
   * at least one leather, so a failure cannot have eaten one.
   */
  it('never spends a hide it did not turn into leather', () => {
    const kit = atTheVat();
    kit.state.inventory = { 'lurker-hide': 20 };

    kit.world.handleCraftRequested('cured-leather');
    kit.tick(250);

    const left = kit.state.inventory['lurker-hide'] ?? 0;
    const leather = kit.state.inventory['cured-leather'] ?? 0;
    const spent = 20 - left;

    expect(spent).toBeGreaterThan(0);
    expect(leather).toBeGreaterThanOrEqual(spent);
    // And the other side of it, so a doubled hide is still a doubled *hide*
    // rather than a leak: the pool pays a second one, never a third.
    expect(leather).toBeLessThanOrEqual(spent * 2);
  });
});

describe('a camp left in the yard', () => {
  /** Parked at the vat with hides in the pack and nothing in hand. */
  function tanning() {
    const kit = atTheVat();
    kit.character.addItem('lurker-hide', 8);
    kit.bus.emit(AFK_TOGGLE_REQUESTED_EVENT);
    return kit;
  }

  /**
   * The derivation that made a station worth being a place rather than a menu:
   * what a camp does is read off the tool in hand and the station underfoot, so
   * a vat plus a pack of hides is a tanning camp with nothing stored, nothing
   * equipped and no second button pressed.
   *
   * Greyford has no mobs and no nodes, so a station is the only thing an
   * unattended character could possibly do here.
   */
  it('settles to the vat with nothing in hand', () => {
    const { world, character, until } = tanning();

    until(
      () => character.itemCount('cured-leather') > 0,
      'the camp to cure its first hide',
      120000,
    );
    expect(world.afkActive).toBe(true);
    expect(character.itemCount('lurker-hide')).toBeLessThan(8);
  });

  // What the save has to carry that the zone cannot: an outpost is a zone and a
  // vat is one tile of it, so where the character stood is not something the
  // morning could re-derive.
  it('parks the station in the session, not just the zone', () => {
    const { state } = tanning();
    expect(state.afk).toMatchObject({ zoneId: 'greyford', station: 'tannery' });
  });
});
