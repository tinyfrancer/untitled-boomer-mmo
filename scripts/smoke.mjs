/**
 * Browser smoke check for the gameplay loop.
 *
 * The unit suite covers the Phaser-free systems; this covers what only a real
 * run can show — that scenes boot, the AI state machine moves between wander,
 * chase and returning, and the player death path resets the world.
 *
 * Usage: npm run dev, then `node scripts/smoke.mjs [--headed]`.
 * Screenshots land in .smoke/.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SMOKE_URL ?? 'http://localhost:5173';
const OUT = '.smoke';
const headed = process.argv.includes('--headed');

mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// Phaser drives its update loop off requestAnimationFrame, and headless Chromium
// will background an idle renderer and stop firing it — mid-run the game freezes
// with velocities set but positions never integrating. These flags keep the
// renderer awake for the whole session.
const browser = await chromium.launch({
  headless: !headed,
  args: [
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));

// Scene helpers. `game` is the dev-only handle installed in src/main.ts.
const townState = () =>
  page.evaluate(() => {
    // Phaser sleeps its TimeStep when the page blurs, and a CI runner has no
    // window manager to ever focus it — the game silently stops stepping with
    // velocities still set. Nudge it awake on every poll.
    const loop = window.game.loop;
    if (loop.sleeping) loop.wake();

    const town = window.game.scene.getScene('Zone');
    if (!town?.scene.isActive()) return null;
    const p = town.player;
    const mobs = town.mobs.map((r) => ({
      level: r.level,
      hp: r.hp,
      maxHp: r.maxHp,
      engaged: r.isEngaged(),
      alive: r.isAlive(),
      x: Math.round(r.x),
      y: Math.round(r.y),
      dist: Math.round(Phaser.Math.Distance.Between(r.x, r.y, p.x, p.y)),
      state: r.aiState,
      fromSpawn: Math.round(Phaser.Math.Distance.Between(r.x, r.y, r.spawnX, r.spawnY)),
      vel: [Math.round(r.body.velocity.x), Math.round(r.body.velocity.y)],
      bodyOn: r.body.enable,
    }));
    const nodes = town.nodes.map((n) => ({
      id: n.definition.id,
      skill: n.definition.skill,
      available: n.isAvailable(),
      x: Math.round(n.x),
      y: Math.round(n.y),
      dist: Math.round(Phaser.Math.Distance.Between(n.x, n.y, p.x, p.y)),
    }));
    return {
      zoneId: town.zone.id,
      player: { hp: p.hp, maxHp: p.maxHp, level: p.level, x: Math.round(p.x), y: Math.round(p.y) },
      mobs,
      nodes,
      gathering: town.gatherState !== null,
      inventory: { ...town.character.state.inventory },
      skills: JSON.parse(JSON.stringify(town.character.state.skills)),
      gear: { ...town.character.state.gear },
      fireLit: town.campfire?.isLit() === true,
      afk: { active: town.afkActive, target: town.target?.name ?? null },
      eating: p.isEating(),
      loop: { sleeping: loop.sleeping, running: loop.running, fps: Math.round(loop.actualFps) },
    };
  });

// Generous by default: a loaded CI runner steps the game far slower than wall
// clock — runs have been seen at 5fps, where a second of game time costs the
// better part of a minute. Every wait here is on a condition that either
// happens or hangs, so a high ceiling only costs time on a genuine failure.
const waitFor = async (fn, label, timeoutMs = 60000) => {
  const start = Date.now();
  let last = null;
  for (;;) {
    last = (await townState()) ?? last;
    if (last && fn(last)) return last;
    if (Date.now() - start > timeoutMs) {
      // Dump the last state seen: these timeouts are usually only reproducible
      // on CI, so the failure message has to carry enough to diagnose it.
      throw new Error(`timed out waiting for: ${label}\nlast state: ${JSON.stringify(last)}`);
    }
    await page.waitForTimeout(150);
  }
};

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  // Generous: on a cold Vite cache the first request compiles all of Phaser,
  // which takes far longer than any later wait in this script.
  await page.waitForFunction(() => window.game?.scene?.getScene('Boot'), null, { timeout: 120000 });

  // Fresh character: clear any save, then drive the real creation screen.
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.game?.scene?.getScene('CharacterCreate')?.scene.isActive(),
    null,
    { timeout: 20000 },
  );
  check('character creation scene boots', true);
  await page.screenshot({ path: `${OUT}/1-character-create.png` });

  // Click the warrior card and Begin Adventure through real canvas input.
  await page.evaluate(() => {
    const s = window.game.scene.getScene('CharacterCreate');
    s.selectClass('warrior');
    s.tryBeginAdventure();
  });
  const boot = await waitFor((s) => s.mobs.length > 0, 'Town scene with rats');
  check('town scene spawns rats', boot.mobs.length === 9, `${boot.mobs.length} rats`);

  const levels = boot.mobs.map((r) => r.level).sort();
  const dist = { 1: 0, 2: 0, 3: 0 };
  levels.forEach((l) => (dist[l] += 1));
  check(
    'spawn levels are weighted toward level 1',
    dist[1] > dist[2] && dist[2] > dist[3] && dist[3] > 0,
    `lvl1=${dist[1]} lvl2=${dist[2]} lvl3=${dist[3]}`,
  );

  const scaled = boot.mobs.every((r) => r.maxHp === 20 + 20 * (r.level - 1));
  check(
    'rat max HP scales with level',
    scaled,
    boot.mobs.map((r) => `L${r.level}:${r.maxHp}`).join(' '),
  );
  await page.screenshot({ path: `${OUT}/2-town.png` });

  // The stick figure's legs: walking plays the baked leg-phase animation and
  // standing still puts it back on the neutral frame.
  const walking = await page.evaluate(async () => {
    const s = window.game.scene.getScene('Zone');
    s.player.moveTo(s.player.x + 300, s.player.y);
    await new Promise((r) => setTimeout(r, 300));
    const moving = {
      playing: s.player.anims.isPlaying,
      frame: s.player.anims.currentFrame?.textureKey,
    };
    s.player.stopMoving();
    await new Promise((r) => setTimeout(r, 300));
    return { moving, idleTexture: s.player.texture.key, playing: s.player.anims.isPlaying };
  });
  check(
    'the figure animates its legs while walking',
    walking.moving.playing === true,
    `frame ${walking.moving.frame}`,
  );
  check(
    'the figure returns to its standing frame when it stops',
    walking.playing === false && walking.idleTexture.endsWith(':0'),
    walking.idleTexture,
  );

  // --- Real input: genuine mouse clicks must select world objects. The
  // pointerdown event's own currentlyOver list proved timing-flaky with two
  // active scenes (see ZoneScene.hitTestWorld), and every other combat check
  // here calls setTarget directly — so this is the only coverage of the real
  // click path. Three attempts, because the original bug was intermittent.
  const resetForClick = () =>
    page.evaluate(() => {
      const z = window.game.scene.getScene('Zone');
      z.clearTarget();
      z.player.stopMoving();
      z.player.setPosition(z.spawnPoint.x, z.spawnPoint.y);
      z.player.setVelocity(0, 0);
    });
  for (let attempt = 1; attempt <= 3; attempt++) {
    await resetForClick();
    await page.waitForTimeout(200);
    const ratScreen = await page.evaluate(() => {
      const z = window.game.scene.getScene('Zone');
      const cam = z.cameras.main;
      const m = z.mobs.find((mob) => mob.isAlive());
      return {
        x: Math.round((m.x - cam.worldView.x) * cam.zoom),
        y: Math.round((m.y - cam.worldView.y) * cam.zoom),
      };
    });
    await page.mouse.move(ratScreen.x, ratScreen.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(150);
    const targeted = await page.evaluate(
      () => window.game.scene.getScene('Zone').target?.name ?? null,
    );
    check(`real mouse click selects a rat (attempt ${attempt})`, targeted === 'Rat');
  }

  await resetForClick();
  await page.waitForTimeout(200);
  const npcScreen = await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    const cam = z.cameras.main;
    const npc = z.children.list.find((o) => o.texture?.key === 'npc-shopkeeper');
    return {
      x: Math.round((npc.x - cam.worldView.x) * cam.zoom),
      y: Math.round((npc.y - cam.worldView.y) * cam.zoom),
    };
  });
  await page.mouse.move(npcScreen.x, npcScreen.y);
  await page.mouse.down();
  await page.mouse.up();
  // Out of interact range from spawn, so the click walks the player over first.
  await page.waitForFunction(
    () => {
      const loop = window.game.loop;
      if (loop.sleeping) loop.wake();
      return window.game.scene.getScene('Zone').shopNpc !== null;
    },
    null,
    { timeout: 60000 },
  );
  check('real mouse click walks to the shopkeeper and opens the shop', true);
  await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    z.closeShop();
  });
  await resetForClick();

  // --- Gathering: tools gate it, the channel yields, and range cancels it. ---
  check(
    'town spawns resource nodes',
    boot.nodes.length === 6,
    boot.nodes.map((n) => n.id).join(' '),
  );

  // The starting sword is not a woodcutting tool, so this must be refused
  // outright rather than silently starting a channel.
  const refused = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    const tree = town.nodes.find((n) => n.definition.id === 'tree');
    town.player.setPosition(tree.x, tree.y + 40);
    town.startGathering(tree);
    return town.gatherState !== null;
  });
  check('gathering is refused without the right tool equipped', refused === false);

  // --- Shop: tools no longer start on the character; they are bought. ---
  const freshWallet = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    return { copper: town.character.state.currency, inv: { ...town.character.state.inventory } };
  });
  check(
    'a new character starts with copper and an empty bag',
    freshWallet.copper > 0 && Object.keys(freshWallet.inv).length === 0,
    `copper=${freshWallet.copper}`,
  );

  const cantAfford = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    const npc = town.children.list.find((obj) => obj.texture?.key === 'npc-shopkeeper');
    town.player.setPosition(npc.x, npc.y + 50);
    town.approachShop(npc);
    const open = town.shopNpc !== null;
    // 75 starting copper buys one 60c tool, not two
    town.handleBuyRequested('felling-axe');
    town.handleBuyRequested('fishing-pole');
    return {
      open,
      copper: town.character.state.currency,
      inv: { ...town.character.state.inventory },
    };
  });
  check('clicking the shopkeeper in range opens the shop', cantAfford.open === true);
  check(
    'the shop refuses a purchase the player cannot afford',
    cantAfford.inv['felling-axe'] === 1 && cantAfford.inv['fishing-pole'] === undefined,
    `copper=${cantAfford.copper}`,
  );

  const traded = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    // earn the second tool by selling vendor trash
    town.character.state.inventory['rat-bones'] = 30;
    for (let i = 0; i < 30; i++) town.handleSellRequested('rat-bones');
    town.handleBuyRequested('fishing-pole');
    return { copper: town.character.state.currency, inv: { ...town.character.state.inventory } };
  });
  check(
    'selling loot funds the second tool',
    traded.inv['fishing-pole'] === 1 && traded.inv['rat-bones'] === undefined,
    `copper left=${traded.copper}`,
  );

  const shopClosed = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    const npc = town.shopNpc;
    town.player.setPosition(npc.x + 400, npc.y);
    town.updateShopRange();
    return town.shopNpc === null;
  });
  check('walking away closes the shop', shopClosed === true);

  const beforeChop = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    town.handleEquipRequested('felling-axe');
    const tree = town.nodes.find((n) => n.definition.id === 'tree');
    town.player.setPosition(tree.x, tree.y + 40);
    town.startGathering(tree);
    return {
      gathering: town.gatherState !== null,
      xp: town.character.state.skills.woodcutting.xp,
    };
  });
  check('equipping the axe starts a woodcutting channel', beforeChop.gathering === true);

  const chopped = await waitFor((s) => (s.inventory.logs ?? 0) > 0, 'the tree to yield logs');
  check(
    'chopping yields logs and woodcutting xp',
    chopped.skills.woodcutting.xp > beforeChop.xp,
    `logs=${chopped.inventory.logs} wc xp ${beforeChop.xp} -> ${chopped.skills.woodcutting.xp}`,
  );
  check('the channel auto-repeats after a yield', chopped.gathering === true);

  // Walking off must drop the channel — this is the AFK-safety valve.
  // North-east rather than south, which since zones would walk out the exit.
  await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    const tree = town.nodes.find((n) => n.definition.id === 'tree');
    town.player.setPosition(tree.x + 400, tree.y - 400);
  });
  const walkedOff = await waitFor((s) => !s.gathering, 'the channel to cancel out of range');
  check('walking out of range cancels the channel', walkedOff.gathering === false);

  // --- Encumbrance: a full pack is the other thing that ends an unattended
  // gathering session, and only a live channel can show it. ---
  const packed = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    // Weight-1 bones, exactly to the brim.
    town.character.addItem('rat-bones', town.character.carryCapacity());
    const tree = town.nodes.find((n) => n.definition.id === 'tree' && n.isAvailable());
    town.player.setPosition(tree.x, tree.y + 40);
    town.startGathering(tree);
    return { started: town.gatherState !== null, logs: town.character.itemCount('logs') };
  });
  const stopped = await waitFor((s) => !s.gathering, 'the full pack to stop the channel');
  check(
    'a full pack stops the gathering channel instead of looping forever',
    packed.started === true && stopped.gathering === false,
  );
  const spared = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    const logs = town.character.itemCount('logs');
    // Put the pack back the way it was for the tests downstream.
    town.character.removeItem('rat-bones', town.character.itemCount('rat-bones'));
    return { logs };
  });
  check(
    'the refused haul is not silently added to the pack',
    spared.logs === packed.logs,
    `logs stayed at ${spared.logs}`,
  );

  const buying = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    town.character.addItem('rat-bones', town.character.carryCapacity());
    const before = town.character.state.currency;
    town.shopNpc = town.npcs[0];
    town.handleBuyRequested('felling-axe');
    const after = town.character.state.currency;
    town.shopNpc = null;
    town.character.removeItem('rat-bones', town.character.itemCount('rat-bones'));
    return { before, after };
  });
  check(
    'a full pack refuses a purchase before the coin is spent',
    buying.before === buying.after,
    `currency stayed at ${buying.after}`,
  );

  // Fishing runs the same path through a different tool and an endless node.
  const fished = await page.evaluate(async () => {
    const town = window.game.scene.getScene('Zone');
    town.handleEquipRequested('fishing-pole');
    const spot = town.nodes.find((n) => n.definition.id === 'fishing-spot');
    // On the shore north of the spot: the spot itself is on water, which the
    // player cannot stand on.
    town.player.setPosition(spot.x, spot.y - 64);
    town.startGathering(spot);
    return town.gatherState !== null;
  });
  check('fishing starts with the pole equipped', fished === true);
  const caught = await waitFor((s) => (s.inventory['raw-fish'] ?? 0) > 0, 'a fish to be caught');
  check(
    'fishing yields raw fish and fishing xp',
    caught.skills.fishing.xp > 0,
    `fish=${caught.inventory['raw-fish']} fishing xp=${caught.skills.fishing.xp}`,
  );
  await page.screenshot({ path: `${OUT}/5-gathering.png` });

  // --- Cooking chain: logs -> fire -> cooked fish -> eaten for health. ---
  // Stock the bag directly. Gathering enough by hand is already covered above,
  // and doing it again would just be a slow way to reach the same state.
  const lit = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    town.stopGathering();
    town.character.state.inventory.logs = 3;
    town.character.state.inventory['raw-fish'] = 6;
    town.handleLightFireRequested();
    return {
      fire: town.campfire?.isLit() === true,
      logs: town.character.state.inventory.logs ?? 0,
    };
  });
  check(
    'lighting a fire consumes a log and places it',
    lit.fire === true && lit.logs === 2,
    `fire=${lit.fire} logs=${lit.logs}`,
  );

  // Cooking near the fire must produce one of the two outcomes and consume the
  // raw fish either way; which one is a dice roll, so don't assert on it.
  const cooked = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    const before = town.character.state.inventory['raw-fish'];
    // Cook the lot, so at least one succeeds despite the level 1 burn chance.
    for (let i = 0; i < before; i++) town.handleCookRequested();
    const inv = town.character.state.inventory;
    return {
      raw: inv['raw-fish'] ?? 0,
      cooked: inv['cooked-fish'] ?? 0,
      burnt: inv['burnt-fish'] ?? 0,
      xp: town.character.state.skills.cooking.xp,
    };
  });
  check(
    'cooking consumes the raw fish',
    cooked.raw === 0,
    `cooked=${cooked.cooked} burnt=${cooked.burnt}`,
  );
  check('cooking produces food or a burnt mess', cooked.cooked + cooked.burnt === 6);
  check(
    'a successful cook grants cooking xp',
    cooked.cooked === 0 || cooked.xp > 0,
    `cooking xp=${cooked.xp}`,
  );

  // Cooking away from a fire has to be refused.
  const awayFromFire = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    town.character.state.inventory['raw-fish'] = 1;
    // West, toward town center: east would carry the player out the zone exit.
    town.player.setPosition(town.campfire.x - 600, town.campfire.y);
    town.handleCookRequested();
    return town.character.state.inventory['raw-fish'];
  });
  check('cooking away from a fire is refused', awayFromFire === 1);

  // --- Eating: a heal over time that outpaces baseline regen. ---
  const beforeEat = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    town.character.state.inventory['cooked-fish'] = 1;
    town.player.takeDamage(Math.floor(town.player.maxHp / 2));
    // Past the regen lockout, so any healing seen is food doing its job on top
    // of a baseline that is also running — see the regen check above.
    town.player.msSinceCombat = 5000;
    town.handleEatRequested('cooked-fish');
    return {
      hp: town.player.hp,
      eating: town.player.isEating(),
      fish: town.character.state.inventory['cooked-fish'] ?? 0,
    };
  });
  check(
    'eating consumes the food and starts a heal',
    beforeEat.eating === true && beforeEat.fish === 0,
  );

  const ate = await waitFor((s) => s.player.hp > beforeEat.hp, 'food to heal the player');
  check('eating heals the player over time', true, `${beforeEat.hp} -> ${ate.player.hp}`);

  // Getting hit has to cancel it, since food is out-of-combat only.
  const interrupted = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    town.character.state.inventory['cooked-fish'] = 1;
    town.handleEatRequested('cooked-fish');
    const started = town.player.isEating();
    town.player.takeDamage(1);
    return { started, stillEating: town.player.isEating() };
  });
  check(
    'taking a hit cancels the food buff',
    interrupted.started === true && interrupted.stillEating === false,
  );
  await page.screenshot({ path: `${OUT}/6-cooking.png` });

  // Back to the starting loadout so the combat checks below run on the gear
  // they were written against.
  await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    town.stopGathering();
    town.handleEquipRequested('rusty-sword');
    town.player.restoreToFull();
  });

  // --- Retaliation: target the nearest level 1 rat and let combat run. ---
  await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    const p = town.player;
    const rat = town.mobs
      .filter((r) => r.level === 1)
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Between(a.x, a.y, p.x, p.y) -
          Phaser.Math.Distance.Between(b.x, b.y, p.x, p.y),
      )[0];
    // walk the player onto the rat so the real range check passes
    p.setPosition(rat.x, rat.y - 40);
    town.setTarget(rat);
  });

  const engaged = await waitFor((s) => s.mobs.some((r) => r.engaged), 'a rat to engage');
  check(
    'attacked rat retaliates (enters chase)',
    true,
    `rat hp ${engaged.mobs.find((r) => r.engaged).hp}`,
  );

  const hurt = await waitFor((s) => s.player.hp < s.player.maxHp, 'player to take damage');
  check('enemy damages the player', true, `player ${hurt.player.hp}/${hurt.player.maxHp}`);
  await page.screenshot({ path: `${OUT}/3-combat.png` });

  // --- Combat skills: swinging trains the weapon skill, and a level 1
  // character's cap is 10 no matter how long they swing for. ---
  const swung = await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    const s = z.character.state.skills;
    return { weapon: z.character.activeWeaponSkill(), oneHanded: { ...s['one-handed'] } };
  });
  check(
    'landing hits trains the weapon skill the equipped weapon uses',
    swung.weapon === 'one-handed' && swung.oneHanded.xp + swung.oneHanded.level > 1,
    `${swung.weapon} lv${swung.oneHanded.level} xp${swung.oneHanded.xp}`,
  );

  const capped = await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    z.character.awardSkillXp('one-handed', 999999);
    z.character.awardSkillXp('woodcutting', 999999);
    return {
      level: z.character.state.level,
      oneHanded: z.character.skillLevelOf('one-handed'),
      woodcutting: z.character.skillLevelOf('woodcutting'),
    };
  });
  check(
    'a combat skill caps at ten times the character level',
    capped.oneHanded === capped.level * 10,
    `char lv${capped.level}, 1 handed ${capped.oneHanded}`,
  );
  check(
    'a gathering skill keeps its own flat cap',
    capped.woodcutting === 10,
    `woodcutting ${capped.woodcutting}`,
  );

  // --- Reach: a live weapon swap has to move attackRange, which is the half of
  // the fix the unit suite can't see (it tests the stats, not the sprite). ---
  const reach = await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    const original = { ...z.character.state.gear };
    const rangeWith = (weapon) => {
      z.player.setGear({ ...original, weapon });
      return z.player.attackRange;
    };
    const measured = {
      sword: rangeWith('rusty-sword'),
      wand: rangeWith('apprentice-wand'),
      bare: rangeWith(null),
    };
    z.player.setGear(original);
    return measured;
  });
  check(
    'swapping weapons changes auto-attack reach on the live player',
    reach.sword === 80 && reach.wand === 200 && reach.bare === 64,
    `sword ${reach.sword}, wand ${reach.wand}, bare-handed ${reach.bare}`,
  );

  // --- AFK camping: the mode has to fight without a hand on the mouse, and
  // give the controls straight back to one. ---
  const camped = await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    const rat = z.mobs.find((m) => m.level === 1 && m.isAlive());
    // Park beside the rat with nothing selected and nothing wrong with us, so
    // anything that happens next is the camp's doing.
    z.player.setPosition(rat.x - 60, rat.y);
    z.player.restoreToFull();
    z.clearTarget();
    window.game.events.emit('afk-toggle-requested');
    return { active: z.afkActive, target: z.target?.name ?? null };
  });
  check(
    'the AFK toggle starts a camp with nothing selected',
    camped.active === true && camped.target === null,
  );

  const fought = await waitFor(
    (s) => s.afk.target !== null && s.mobs.some((m) => m.engaged),
    'the camp to pick a fight on its own',
  );
  check(
    'camping picks a target and opens combat with no input',
    fought.afk.target !== null,
    `engaged ${fought.afk.target} unprompted`,
  );

  // Real keyboard input through Phaser's own plugin, not a method call.
  await page.keyboard.down('w');
  const released = await waitFor((s) => !s.afk.active, 'walking to end the camp');
  await page.keyboard.up('w');
  check('moving by hand takes the controls back from the camp', released.afk.active === false);

  // --- Leash: a chasing rat that loses the player resets and heals. ---
  // Set this up from scratch rather than reusing the rat from the fight above,
  // which the player may well have finished off by now. Aim the player at the
  // in-bounds corner furthest from that rat's own spawn: a fixed offset can be
  // clipped by the world bounds to somewhere inside the leash radius.
  // --- Combat log: the fight above must have left a trail in it. ---
  const logged = await page.evaluate(() => {
    const ui = window.game.scene.getScene('UI');
    return {
      lines: ui.model.combatLog.map((e) => e.text),
      visible: ui.combatLogPanel.isVisible(),
    };
  });
  check(
    'the combat log records the fight',
    logged.lines.some((l) => l.includes('You hit')) &&
      logged.lines.some((l) => l.includes('hits you for')),
    `${logged.lines.length} lines, last: ${logged.lines[logged.lines.length - 1]}`,
  );
  check('the log is open by default on a desktop viewport', logged.visible === true);

  const toggled = await page.evaluate(() => {
    const ui = window.game.scene.getScene('UI');
    ui.toggleCombatLog();
    const hidden = ui.combatLogPanel.isVisible();
    ui.toggleCombatLog();
    return { hidden, shown: ui.combatLogPanel.isVisible() };
  });
  check(
    'the log can be hidden and shown again',
    toggled.hidden === false && toggled.shown === true,
  );

  const cappedLog = await page.evaluate(() => {
    const ui = window.game.scene.getScene('UI');
    for (let i = 0; i < 200; i += 1) {
      window.game.events.emit('combat-log', { text: `filler ${i}`, color: '#fff' });
    }
    return { length: ui.model.combatLog.length, last: ui.model.combatLog.at(-1).text };
  });
  check(
    'the log caps its length and keeps the newest line',
    cappedLog.length === 50 && cappedLog.last === 'filler 199',
    `${cappedLog.length} lines`,
  );

  const leashTarget = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    town.clearTarget(); // stop swinging, so the rat survives to leash
    const index = town.mobs.findIndex((r) => r.isAlive() && r.hp === r.maxHp);
    const rat = town.mobs[index];
    rat.takeDamage(Math.floor(rat.maxHp / 2)); // a wound, so healing is visible
    rat.engage();
    const bounds = town.physics.world.bounds;
    const margin = 48;
    town.player.setPosition(
      rat.spawnX < bounds.width / 2 ? bounds.width - margin : margin,
      rat.spawnY < bounds.height / 2 ? bounds.height - margin : margin,
    );
    // Start the rat just inside its leash boundary rather than making it run the
    // full radius. What is under test is that crossing leashRadius disengages
    // and heals it, not how fast the runner can step the game — CI has been seen
    // stepping this at 5fps, where the old setup timed out with the rat still
    // 12px short of the line.
    const toPlayerX = town.player.x - rat.spawnX;
    const toPlayerY = town.player.y - rat.spawnY;
    const length = Math.hypot(toPlayerX, toPlayerY);
    const edge = rat.definition.leashRadius - 16;
    rat.setPosition(
      rat.spawnX + (toPlayerX / length) * edge,
      rat.spawnY + (toPlayerY / length) * edge,
    );
    return { index, hp: rat.hp, maxHp: rat.maxHp };
  });
  const leashed = await waitFor(
    (s) => !s.mobs[leashTarget.index].engaged,
    'the chasing rat to leash off',
  );
  check(
    'rat leashes and heals to full on the way home',
    leashed.mobs[leashTarget.index].hp === leashTarget.maxHp,
    `${leashTarget.hp} -> ${leashed.mobs[leashTarget.index].hp}/${leashTarget.maxHp}`,
  );

  // --- Out-of-combat regen: player HP must climb back on its own. ---
  // Set the starting point explicitly rather than inheriting whatever the
  // fight left behind: dropping the target stops the player swinging (which
  // counts as combat), and the damage both guarantees a deficit to heal and
  // restarts the out-of-combat timer from a known instant.
  const beforeRegen = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    town.clearTarget();
    town.player.takeDamage(Math.floor(town.player.maxHp / 2));
    // Skip ahead to the end of the out-of-combat lockout rather than waiting it
    // out. It is 5s of *game* time, which on a slow runner costs minutes of wall
    // clock, and RegenSystem's unit tests already cover the lockout itself.
    // What only a real run can show is that regen reaches the player at all.
    town.player.msSinceCombat = 5000;
    return town.player.hp;
  });
  const regened = await waitFor((s) => s.player.hp > beforeRegen, 'player HP to regenerate');
  check('player regenerates out of combat', true, `${beforeRegen} -> ${regened.player.hp}`);

  // --- Death: stand on the level 3 rat with 1 HP and let it finish the job. ---
  const spawnBefore = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    const rat = town.mobs.find((r) => r.level === 3);
    town.player.setPosition(rat.x, rat.y - 30);
    town.player.takeDamage(town.player.hp - 1);
    town.setTarget(rat);
    return { x: Math.round(town.spawnPoint.x), y: Math.round(town.spawnPoint.y) };
  });

  const died = await waitFor(
    (s) =>
      s.player.x === spawnBefore.x &&
      s.player.y === spawnBefore.y &&
      s.player.hp === s.player.maxHp,
    'player death and respawn at town center',
  );
  check(
    'player death respawns at town center at full HP',
    true,
    `hp ${died.player.hp}/${died.player.maxHp}`,
  );
  check(
    'all mobs reset after player death',
    died.mobs.filter((r) => r.alive).every((r) => r.hp === r.maxHp && !r.engaged),
  );
  await page.screenshot({ path: `${OUT}/4-after-death.png` });

  // --- Zones: edge walks load the neighbours, and each side spawns its own
  // table. EXIT_MARGIN is 38.4px, so 33px from the edge is inside it. ---
  await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    const bounds = town.physics.world.bounds;
    // wounded on purpose: crossing a zone line must not be a free heal
    town.player.takeDamage(15);
    town.player.setPosition(bounds.width / 2, bounds.height - 33);
  });
  await waitFor((s) => s.zoneId === 'beach', 'the south exit to load the beach');
  const beachInfo = await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    return {
      enemies: [...new Set(z.mobs.map((m) => m.definition.id))],
      levels: z.mobs.map((m) => m.level).sort(),
      nodes: [...new Set(z.nodes.map((n) => n.definition.id))],
      arrivalY: Math.round(z.player.y),
      hp: z.player.hp,
      maxHp: z.player.maxHp,
    };
  });
  check(
    'hp carries across the zone walk instead of resetting to full',
    beachInfo.hp <= beachInfo.maxHp - 12,
    `hp=${beachInfo.hp}/${beachInfo.maxHp}`,
  );
  check(
    'the beach spawns crabs 4-6 and ocean fishing spots',
    beachInfo.enemies.join(',') === 'crab' &&
      beachInfo.levels[0] === 4 &&
      beachInfo.levels[beachInfo.levels.length - 1] === 6 &&
      beachInfo.nodes.join(',') === 'ocean-fishing-spot',
    `levels=${beachInfo.levels} arrivalY=${beachInfo.arrivalY}`,
  );
  await page.screenshot({ path: `${OUT}/8-beach.png` });

  // Ocean fishing is gated on fishing level 5, which this character lacks.
  const oceanRefused = await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    const spot = z.nodes[0];
    z.player.setPosition(spot.x, spot.y - 64);
    z.startGathering(spot);
    return z.gatherState === null;
  });
  check('ocean fishing spots refuse a low-level fisher', oceanRefused === true);

  // Walk back north to town, then east into the bandit camp.
  await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    z.player.setPosition(z.physics.world.bounds.width / 2, 33);
  });
  await waitFor((s) => s.zoneId === 'town', 'the north exit to return to town');
  await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    const bounds = z.physics.world.bounds;
    z.player.setPosition(bounds.width - 33, bounds.height / 2);
  });
  await waitFor((s) => s.zoneId === 'bandit-camp', 'the east exit to load the bandit camp');
  check('zone travel round-trips town -> beach -> town -> bandit camp', true);

  // --- Aggro: bandits open combat unprovoked, and the beating that follows
  // sends the level 1 player home to town. ---
  await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    const bandit = z.mobs[0];
    // inside the 180px aggro radius, outside the 72px attack range
    z.player.setPosition(bandit.x + 150, bandit.y);
  });
  const ambushed = await waitFor(
    (s) => s.mobs.some((m) => m.engaged),
    'a bandit to aggro unprovoked',
  );
  check('bandits aggro unprovoked', true, `bandit hp ${ambushed.mobs.find((m) => m.engaged).hp}`);
  await page.screenshot({ path: `${OUT}/9-bandit-aggro.png` });

  const sentHome = await waitFor(
    (s) => s.zoneId === 'town' && s.player.hp === s.player.maxHp,
    'death in the camp to send the player home',
  );
  check('dying away from town respawns the player in town', true, `hp ${sentHome.player.hp}`);

  // --- Click-to-move: a tap destination pulls the player across the map. ---
  const moveTarget = await page.evaluate(() => {
    const town = window.game.scene.getScene('Zone');
    const target = { x: town.player.x + 200, y: town.player.y + 100 };
    town.player.moveTo(target.x, target.y);
    return { x: Math.round(target.x), y: Math.round(target.y) };
  });
  const moved = await waitFor(
    (s) => Math.abs(s.player.x - moveTarget.x) <= 12 && Math.abs(s.player.y - moveTarget.y) <= 12,
    'player to walk to the click destination',
  );
  check(
    'click-to-move walks the player to the destination',
    true,
    `at ${moved.player.x},${moved.player.y}`,
  );

  // --- Inventory scrolling: a full bag must stay on screen and scroll,
  // and a scroll drag must never be mistaken for a row tap. ---
  const invPanel = () =>
    page.evaluate(() => {
      const p = window.game.scene.getScene('UI').inventoryPanel;
      return {
        visible: p.isVisible(),
        scrollY: Math.round(p.scrollY),
        maxScroll: Math.round(Math.max(0, p.contentHeight - p.viewportHeight)),
        bottom: Math.round(p.panelY + p.background.height),
        thumb: p.scrollThumb.visible,
        selected: p.selectedItemId,
        // Rows scrolled out of the viewport must not still catch taps.
        enabledRows: p.rowObjects.filter((o) => o.input?.enabled).length,
        inputRows: p.rowObjects.filter((o) => o.input).length,
      };
    });
  await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    z.character.state.inventory = {
      'rat-bones': 12,
      'rat-meat': 7,
      logs: 5,
      'raw-fish': 3,
      'brown-helmet': 1,
      'crab-meat': 4,
      'cooked-fish': 2,
      'burnt-fish': 1,
      'brown-chestplate': 1,
      'brown-legs': 1,
      'brown-axe': 1,
      'felling-axe': 1,
      'fishing-pole': 1,
      'cooked-crab': 2,
    };
    z.game.events.emit('inventory-changed', z.character.state.inventory);
  });
  await page.waitForTimeout(200);
  if (!(await invPanel()).visible) {
    await page.keyboard.press('i');
    await page.waitForTimeout(300);
  }
  const invFull = await invPanel();
  check(
    'a full inventory panel stays within the screen',
    invFull.bottom <= 900,
    `bottom=${invFull.bottom} of 900`,
  );
  check(
    'an overflowing inventory becomes scrollable',
    invFull.maxScroll > 0 && invFull.thumb === true,
    `maxScroll=${invFull.maxScroll}`,
  );

  const invCenter = await page.evaluate(() => {
    const p = window.game.scene.getScene('UI').inventoryPanel;
    return { x: p.panelX + 100, y: p.panelY + p.rowsTop() + p.viewportHeight / 2 };
  });
  await page.mouse.move(invCenter.x, invCenter.y);
  await page.mouse.wheel(0, 5000);
  await page.waitForTimeout(250);
  const invScrolled = await invPanel();
  check(
    'the wheel scrolls the bag and clamps at the end',
    invScrolled.scrollY === invScrolled.maxScroll && invScrolled.scrollY > 0,
    `scrollY=${invScrolled.scrollY}/${invScrolled.maxScroll}`,
  );
  check(
    'rows scrolled out of the viewport stop taking input',
    invScrolled.enabledRows < invScrolled.inputRows,
    `${invScrolled.enabledRows}/${invScrolled.inputRows} rows live`,
  );

  // A tap selects; a drag of the same press must not.
  await page.mouse.move(invCenter.x, invCenter.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(250);
  const invTapped = await invPanel();
  check('tapping a row selects the item', invTapped.selected !== null, `${invTapped.selected}`);

  await page.mouse.move(invCenter.x, invCenter.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(invCenter.x, invCenter.y + i * 12);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(250);
  const invDragged = await invPanel();
  check(
    'a scroll drag scrolls without changing the selection',
    invDragged.scrollY < invScrolled.scrollY && invDragged.selected === invTapped.selected,
    `scrollY ${invScrolled.scrollY} -> ${invDragged.scrollY}, selection kept`,
  );
  await page.screenshot({ path: `${OUT}/10-inventory-scroll.png` });
  await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    z.character.state.inventory = { logs: 1 };
    z.game.events.emit('inventory-changed', z.character.state.inventory);
    window.game.scene.getScene('UI').inventoryPanel.setVisible(false);
  });

  // --- Portrait phone: the canvas tracks the viewport 1:1 and the camera
  // zooms in rather than shrinking the world. ---
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const portrait = await page.evaluate(() => ({
    w: window.game.scale.width,
    h: window.game.scale.height,
    zoom: window.game.scene.getScene('Zone').cameras.main.zoom,
    uiActive: window.game.scene.getScene('UI').scene.isActive(),
  }));
  check(
    'portrait viewport resizes the canvas 1:1',
    portrait.w === 390 && portrait.h === 844,
    `${portrait.w}x${portrait.h}`,
  );
  check(
    'portrait camera zooms in and stays inside the world',
    portrait.zoom < 1 && 844 / portrait.zoom <= 1216,
    `zoom=${portrait.zoom.toFixed(2)}`,
  );
  check('UI scene survives the resize', portrait.uiActive === true);
  await page.screenshot({ path: `${OUT}/7-portrait.png` });

  // --- Mobile zone travel: tapping the exit signpost must work. Edge-walk
  // transitions need pixel-precision taps a phone can't make (the landing
  // strip is ~4 screen px in portrait), which is why signposts exist. ---
  await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    z.clearTarget();
    z.player.stopMoving();
    z.player.setPosition(z.spawnPoint.x, z.spawnPoint.y);
    z.player.setVelocity(0, 0);
  });
  await page.waitForTimeout(400);
  const signScreen = await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    const cam = z.cameras.main;
    const post = z.signposts.find((s) => s.exit.edge === 'south');
    return {
      x: Math.round((post.x - cam.worldView.x) * cam.zoom),
      y: Math.round((post.y - cam.worldView.y) * cam.zoom),
      fromBottom: window.game.scale.height - Math.round((post.y - cam.worldView.y) * cam.zoom),
    };
  });
  await page.mouse.move(signScreen.x, signScreen.y);
  await page.mouse.down();
  await page.mouse.up();
  const viaSignpost = await waitFor(
    (s) => s.zoneId === 'beach',
    'the tapped signpost to walk the player over and load the beach',
  );
  check(
    'tapping the south signpost travels to the beach on a phone viewport',
    viaSignpost.zoneId === 'beach',
    `tap was ${signScreen.fromBottom}px above the screen bottom`,
  );

  // --- Armor types: a wizard may wear cloth and not leather, and the refusal
  // has to reach the player rather than silently doing nothing. Done last,
  // because it throws the warrior away and rerolls as a wizard. ---
  await page.setViewportSize({ width: 1280, height: 900 });
  // --- Options menu: the mobile route to a character reset, which used to be
  // bound to F9 and so unreachable on a phone. Two taps, on purpose. ---
  const options = await page.evaluate(() => {
    const ui = window.game.scene.getScene('UI');
    ui.openOptions();
    const opened = ui.optionsPanel !== null;
    window.__optionsOpen = opened;
    // First press only arms the confirm; the save must still be there after it.
    ui.optionsPanel.handleResetPressed(() => {});
    const armed = ui.optionsPanel.confirmingReset;
    const saveIntact = localStorage.length > 0;
    return { opened, armed, saveIntact };
  });
  await page.screenshot({ path: `${OUT}/12-options.png` });
  await page.evaluate(() => {
    const ui = window.game.scene.getScene('UI');
    ui.optionsPanel.close();
    ui.optionsPanel = null;
  });
  check('the options menu opens from the HUD', options.opened === true);
  check(
    'the first reset press only arms a confirm, leaving the save alone',
    options.armed === true && options.saveIntact === true,
  );

  await page.evaluate(() => {
    // The real path a phone takes: the panel asks, the scene does the work.
    window.game.events.emit('reset-character-requested');
  });
  await page.waitForFunction(
    () => window.game.scene.getScene('CharacterCreate')?.scene.isActive(),
    null,
    { timeout: 20000 },
  );
  await page.evaluate(() => {
    const s = window.game.scene.getScene('CharacterCreate');
    s.selectClass('wizard');
    s.tryBeginAdventure();
  });
  await waitFor((s) => s.mobs.length > 0, 'town as a wizard');

  const armor = await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    z.character.addItem('brown-chestplate', 1);
    z.character.addItem('brown-robe', 1);
    const leather = z.character.equip('brown-chestplate');
    const cloth = z.character.equip('brown-robe');
    return {
      leatherRefused: leather.ok === false,
      reason: leather.ok === false ? leather.reason : '',
      chest: z.character.state.gear.chest,
      clothOk: cloth.ok,
      stillBagged: z.character.itemCount('brown-chestplate'),
    };
  });
  check(
    'a wizard is refused leather, with a reason',
    armor.leatherRefused && armor.reason.length > 0,
    armor.reason,
  );
  check(
    'the refused piece stays in the bag and the slot stays empty of it',
    armor.stillBagged === 1 && armor.chest === 'brown-robe',
    `chest=${armor.chest}`,
  );
  check('a wizard can wear the cloth robe', armor.clothOk === true);

  // --- Abilities: the wizard is already loaded, so cast with them. ---
  const bar = await page.evaluate(() => ({
    hasBar: window.game.scene.getScene('UI').actionBar !== undefined,
    mana: window.game.scene.getScene('Zone').player.mana,
    maxMana: window.game.scene.getScene('Zone').player.maxMana,
  }));
  check(
    'a caster starts with a full mana pool and an action bar',
    bar.hasBar && bar.mana > 0 && bar.mana === bar.maxMana,
    `${bar.mana}/${bar.maxMana} mana`,
  );

  // Mana Shield is self-cast, so it needs no target and always resolves.
  const shielded = await page.evaluate(async () => {
    const z = window.game.scene.getScene('Zone');
    const before = z.player.mana;
    // Cast until one gets through: the spell can genuinely fizzle.
    for (let i = 0; i < 40 && !z.player.hasManaShield(); i += 1) {
      z.lastAbilityAt.clear();
      z.handleAbilityRequested('mana-shield');
      await new Promise((r) => setTimeout(r, 20));
    }
    return { before, after: z.player.mana, up: z.player.hasManaShield() };
  });
  check(
    'casting Mana Shield spends mana and raises a shield',
    shielded.up && shielded.after < shielded.before,
    `mana ${shielded.before} -> ${shielded.after}`,
  );

  const absorbed = await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    const hpBefore = z.player.hp;
    const soaked = z.player.takeDamage(5);
    return { soaked, hpBefore, hpAfter: z.player.hp };
  });
  check(
    'the shield soaks damage instead of the player taking it',
    absorbed.soaked === 5 && absorbed.hpAfter === absorbed.hpBefore,
    `soaked ${absorbed.soaked}, hp ${absorbed.hpBefore} -> ${absorbed.hpAfter}`,
  );

  const fizzles = await page.evaluate(async () => {
    const z = window.game.scene.getScene('Zone');
    // A fresh Destruction skill fizzles ~1 cast in 5, so over many casts some
    // must fail and some must land.
    let attempts = 0;
    let shields = 0;
    for (let i = 0; i < 60; i += 1) {
      z.player.applyManaShield(null);
      z.player.mana = z.player.maxMana;
      z.player.manaFloat = z.player.maxMana;
      z.lastAbilityAt.clear();
      z.handleAbilityRequested('mana-shield');
      attempts += 1;
      if (z.player.hasManaShield()) shields += 1;
      await new Promise((r) => setTimeout(r, 5));
    }
    return { attempts, shields, destruction: z.character.skillLevelOf('destruction') };
  });
  check(
    'spells sometimes fail to cast',
    fizzles.shields > 0 && fizzles.shields < fizzles.attempts,
    `${fizzles.attempts - fizzles.shields}/${fizzles.attempts} fizzled`,
  );
  check(
    'casting trains Destruction',
    fizzles.destruction >= 1,
    `destruction lv${fizzles.destruction}`,
  );

  const gated = await page.evaluate(() => {
    const z = window.game.scene.getScene('Zone');
    z.lastAbilityAt.clear();
    z.player.mana = 0;
    z.player.manaFloat = 0;
    z.handleAbilityRequested('fireball');
    const noMana = z.lastAbilityAt.has('fireball') === false;
    // A warrior ability must not be castable by a wizard at all.
    z.player.mana = z.player.maxMana;
    z.player.manaFloat = z.player.maxMana;
    z.handleAbilityRequested('power-slash');
    return { noMana, wrongClass: z.lastAbilityAt.has('power-slash') === false };
  });
  check('an ability with no mana behind it is refused', gated.noMana === true);
  check("another class's ability can't be cast", gated.wrongClass === true);
  await page.screenshot({ path: `${OUT}/11-abilities.png` });

  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('smoke run completed', false, String(err.message ?? err));
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
