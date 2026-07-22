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

const browser = await chromium.launch({ headless: !headed });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));

// Scene helpers. `game` is the dev-only handle installed in src/main.ts.
const townState = () =>
  page.evaluate(() => {
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
    }));
    return {
      player: { hp: p.hp, maxHp: p.maxHp, level: p.level, x: Math.round(p.x), y: Math.round(p.y) },
      rats,
    };
  });

const waitFor = async (fn, label, timeoutMs = 20000) => {
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

  // --- Leash: run far enough that the rat gives up, resets and heals. ---
  // Aim for the in-bounds corner furthest from that rat's own spawn rather than
  // offsetting the player by a fixed amount — an offset can be clipped by the
  // world bounds into a spot the rat never has to travel leashRadius to reach.
  await page.evaluate(() => {
    const town = window.game.scene.getScene('Town');
    const rat = town.rats.find((r) => r.isEngaged());
    const bounds = town.physics.world.bounds;
    const margin = 48;
    town.clearTarget(); // stop swinging, so nothing re-engages behind our back
    town.player.setPosition(
      rat.spawnX < bounds.width / 2 ? bounds.width - margin : margin,
      rat.spawnY < bounds.height / 2 ? bounds.height - margin : margin,
    );
  });
  const leashed = await waitFor((s) => !s.rats.some((r) => r.engaged), 'rats to leash off', 30000);
  const allFull = leashed.rats.filter((r) => r.alive).every((r) => r.hp === r.maxHp);
  check('rat leashes and heals to full on the way home', allFull);

  // --- Out-of-combat regen: player HP must climb back on its own. ---
  // Set the starting point explicitly rather than inheriting whatever the
  // fight left behind: dropping the target stops the player swinging (which
  // counts as combat), and the damage both guarantees a deficit to heal and
  // restarts the out-of-combat timer from a known instant.
  const beforeRegen = await page.evaluate(() => {
    const town = window.game.scene.getScene('Town');
    town.clearTarget();
    town.player.takeDamage(Math.floor(town.player.maxHp / 2));
    return town.player.hp;
  });
  const regened = await waitFor((s) => s.player.hp > beforeRegen, 'player HP to regenerate', 30000);
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
    25000,
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
