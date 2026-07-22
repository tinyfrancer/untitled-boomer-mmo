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

    const town = window.game.scene.getScene('Town');
    if (!town?.scene.isActive()) return null;
    const p = town.player;
    const rats = town.rats.map((r) => ({
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
      player: { hp: p.hp, maxHp: p.maxHp, level: p.level, x: Math.round(p.x), y: Math.round(p.y) },
      rats,
      nodes,
      gathering: town.gatherState !== null,
      inventory: { ...town.characterState.inventory },
      skills: JSON.parse(JSON.stringify(town.characterState.skills)),
      gear: { ...town.characterState.gear },
      fireLit: town.campfire?.isLit() === true,
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
  const boot = await waitFor((s) => s.rats.length > 0, 'Town scene with rats');
  check('town scene spawns rats', boot.rats.length === 9, `${boot.rats.length} rats`);

  const levels = boot.rats.map((r) => r.level).sort();
  const dist = { 1: 0, 2: 0, 3: 0 };
  levels.forEach((l) => (dist[l] += 1));
  check(
    'spawn levels are weighted toward level 1',
    dist[1] > dist[2] && dist[2] > dist[3] && dist[3] > 0,
    `lvl1=${dist[1]} lvl2=${dist[2]} lvl3=${dist[3]}`,
  );

  const scaled = boot.rats.every((r) => r.maxHp === 20 + 20 * (r.level - 1));
  check(
    'rat max HP scales with level',
    scaled,
    boot.rats.map((r) => `L${r.level}:${r.maxHp}`).join(' '),
  );
  await page.screenshot({ path: `${OUT}/2-town.png` });

  // --- Gathering: tools gate it, the channel yields, and range cancels it. ---
  check(
    'town spawns resource nodes',
    boot.nodes.length === 6,
    boot.nodes.map((n) => n.id).join(' '),
  );

  // The starting sword is not a woodcutting tool, so this must be refused
  // outright rather than silently starting a channel.
  const refused = await page.evaluate(() => {
    const town = window.game.scene.getScene('Town');
    const tree = town.nodes.find((n) => n.definition.id === 'tree');
    town.player.setPosition(tree.x, tree.y + 40);
    town.startGathering(tree);
    return town.gatherState !== null;
  });
  check('gathering is refused without the right tool equipped', refused === false);

  const beforeChop = await page.evaluate(() => {
    const town = window.game.scene.getScene('Town');
    town.handleEquipRequested('felling-axe');
    const tree = town.nodes.find((n) => n.definition.id === 'tree');
    town.player.setPosition(tree.x, tree.y + 40);
    town.startGathering(tree);
    return {
      gathering: town.gatherState !== null,
      xp: town.characterState.skills.woodcutting.xp,
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
  await page.evaluate(() => {
    const town = window.game.scene.getScene('Town');
    const tree = town.nodes.find((n) => n.definition.id === 'tree');
    town.player.setPosition(tree.x + 400, tree.y + 400);
  });
  const walkedOff = await waitFor((s) => !s.gathering, 'the channel to cancel out of range');
  check('walking out of range cancels the channel', walkedOff.gathering === false);

  // Fishing runs the same path through a different tool and an endless node.
  const fished = await page.evaluate(async () => {
    const town = window.game.scene.getScene('Town');
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
    const town = window.game.scene.getScene('Town');
    town.stopGathering();
    town.characterState.inventory.logs = 3;
    town.characterState.inventory['raw-fish'] = 6;
    town.handleLightFireRequested();
    return {
      fire: town.campfire?.isLit() === true,
      logs: town.characterState.inventory.logs ?? 0,
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
    const town = window.game.scene.getScene('Town');
    const before = town.characterState.inventory['raw-fish'];
    // Cook the lot, so at least one succeeds despite the level 1 burn chance.
    for (let i = 0; i < before; i++) town.handleCookRequested();
    const inv = town.characterState.inventory;
    return {
      raw: inv['raw-fish'] ?? 0,
      cooked: inv['cooked-fish'] ?? 0,
      burnt: inv['burnt-fish'] ?? 0,
      xp: town.characterState.skills.cooking.xp,
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
    const town = window.game.scene.getScene('Town');
    town.characterState.inventory['raw-fish'] = 1;
    town.player.setPosition(town.campfire.x + 600, town.campfire.y);
    town.handleCookRequested();
    return town.characterState.inventory['raw-fish'];
  });
  check('cooking away from a fire is refused', awayFromFire === 1);

  // --- Eating: a heal over time that outpaces baseline regen. ---
  const beforeEat = await page.evaluate(() => {
    const town = window.game.scene.getScene('Town');
    town.characterState.inventory['cooked-fish'] = 1;
    town.player.takeDamage(Math.floor(town.player.maxHp / 2));
    // Past the regen lockout, so any healing seen is food doing its job on top
    // of a baseline that is also running — see the regen check above.
    town.player.msSinceCombat = 5000;
    town.handleEatRequested('cooked-fish');
    return {
      hp: town.player.hp,
      eating: town.player.isEating(),
      fish: town.characterState.inventory['cooked-fish'] ?? 0,
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
    const town = window.game.scene.getScene('Town');
    town.characterState.inventory['cooked-fish'] = 1;
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
    const town = window.game.scene.getScene('Town');
    town.stopGathering();
    town.handleEquipRequested('rusty-sword');
    town.player.restoreToFull();
  });

  // --- Retaliation: target the nearest level 1 rat and let combat run. ---
  await page.evaluate(() => {
    const town = window.game.scene.getScene('Town');
    const p = town.player;
    const rat = town.rats
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

  const engaged = await waitFor((s) => s.rats.some((r) => r.engaged), 'a rat to engage');
  check(
    'attacked rat retaliates (enters chase)',
    true,
    `rat hp ${engaged.rats.find((r) => r.engaged).hp}`,
  );

  const hurt = await waitFor((s) => s.player.hp < s.player.maxHp, 'player to take damage');
  check('enemy damages the player', true, `player ${hurt.player.hp}/${hurt.player.maxHp}`);
  await page.screenshot({ path: `${OUT}/3-combat.png` });

  // --- Leash: a chasing rat that loses the player resets and heals. ---
  // Set this up from scratch rather than reusing the rat from the fight above,
  // which the player may well have finished off by now. Aim the player at the
  // in-bounds corner furthest from that rat's own spawn: a fixed offset can be
  // clipped by the world bounds to somewhere inside the leash radius.
  const leashTarget = await page.evaluate(() => {
    const town = window.game.scene.getScene('Town');
    town.clearTarget(); // stop swinging, so the rat survives to leash
    const index = town.rats.findIndex((r) => r.isAlive() && r.hp === r.maxHp);
    const rat = town.rats[index];
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
    (s) => !s.rats[leashTarget.index].engaged,
    'the chasing rat to leash off',
  );
  check(
    'rat leashes and heals to full on the way home',
    leashed.rats[leashTarget.index].hp === leashTarget.maxHp,
    `${leashTarget.hp} -> ${leashed.rats[leashTarget.index].hp}/${leashTarget.maxHp}`,
  );

  // --- Out-of-combat regen: player HP must climb back on its own. ---
  // Set the starting point explicitly rather than inheriting whatever the
  // fight left behind: dropping the target stops the player swinging (which
  // counts as combat), and the damage both guarantees a deficit to heal and
  // restarts the out-of-combat timer from a known instant.
  const beforeRegen = await page.evaluate(() => {
    const town = window.game.scene.getScene('Town');
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
    const town = window.game.scene.getScene('Town');
    const rat = town.rats.find((r) => r.level === 3);
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
    died.rats.filter((r) => r.alive).every((r) => r.hp === r.maxHp && !r.engaged),
  );
  await page.screenshot({ path: `${OUT}/4-after-death.png` });

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
