/**
 * Browser smoke check: what only a real run in a real browser can show.
 *
 * The simulation is headless and unit-tested — `tests/world/` drives whole
 * zones through combat, leashing, gathering, trading, camping and casting with
 * nothing rendering them. So this covers the other half, and nothing else:
 *
 *   - the game boots, and the flows that cross between zones work
 *   - real mouse, real touch and real key events reach the game
 *   - the view builds and *unbuilds* itself, which no state assertion can see
 *   - the HUD's geometry at real viewport sizes, and its scrolling and clipping
 *   - the save round trip through an actual page reload
 *
 * It reaches the game through three dev-only handles, none of which mentions
 * the rendering engine: `window.world` for everything about the simulation,
 * `window.view` for the few questions only whatever is drawing can answer (see
 * src/types/debugView.ts), and `window.events` for the HUD channel between
 * them. That is what let the renderer be replaced under this file rather than
 * alongside it.
 *
 * The game runs under `?loop=manual`, so nothing advances until this script
 * cranks it with `view.step()`. Waits are therefore in *game* milliseconds and
 * are deterministic; a loaded CI runner makes the script slower, not flakier.
 *
 * It runs on a portrait phone, which is what the game is laid out for, in a
 * touch-capable context: the drag/tap disambiguation and the `touch-action`
 * policy that decides what the browser may take are phone rules, and a mouse can
 * break neither — it never pans or pinches the page and is never a thumb resting
 * on the screen. Two sections leave that viewport on
 * purpose, a landscape resize and a desktop one, and both say why.
 *
 * It is typechecked by `tsconfig.scripts.json` — `scripts/globals.d.ts` gives
 * the three handles their real types, so a check that reads a field the world
 * stopped having is a compile error rather than an assertion that quietly fails
 * for the wrong reason. That is what the JSDoc annotations below are for; a
 * `.mjs` has nowhere else to put a type.
 *
 * The run is a list of named sections — `SECTIONS`, at the bottom — and
 * `--section=` runs only the ones named. They share one page and carry state
 * forward, so a section is not independent of the ones before it: `boot` always
 * runs, and anything else may need a neighbour named alongside it. The
 * couplings are not obvious either — `bag` measures a sheet whose height
 * depends on the player column, which `achievements` grows by wearing a title,
 * so `--section=bag` alone reports 50px more room and fails its clip check.
 * This is for iterating on a section you are changing; the verdict that counts
 * is still a full run.
 *
 * Usage: npm run dev, then `node scripts/smoke.mjs [--headed] [--section=a,b]`.
 * An unknown section name prints the list. Screenshots land in .smoke/.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SMOKE_URL ?? 'http://localhost:5173';
/** @param {string} params */
const query = (params) => `${BASE}${BASE.includes('?') ? '&' : '?'}${params}`;
const URL = query('loop=manual');
const OUT = '.smoke';
const headed = process.argv.includes('--headed');
/** Sections named on the command line; empty means all of them. */
const requested = process.argv
  .filter((arg) => arg.startsWith('--section='))
  .flatMap((arg) => arg.slice('--section='.length).split(','))
  .map((name) => name.trim())
  .filter(Boolean);

const PHONE = { width: 390, height: 844 };

// One simulated frame. 40ms is 25fps: fast enough that arrival bands behave the
// way they do on a real machine, slow enough that a few hundred frames cover a
// minute of game time.
const FRAME_MS = 40;
const FRAMES_PER_POLL = 12;

mkdirSync(OUT, { recursive: true });

/** @type {{ name: string; passed: boolean; detail: string }[]} */
const results = [];
/**
 * @param {string} name
 * @param {boolean} passed
 * @param {string} [detail]
 */
function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// Rendering and input still run off requestAnimationFrame even with the
// simulation on a hand crank, and headless Chromium will background an idle
// renderer. These flags keep it drawing and listening for the whole session.
const browser = await chromium.launch({
  headless: !headed,
  args: [
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ],
});
const page = await browser.newPage({ viewport: { ...PHONE }, hasTouch: true });

/** @type {string[]} */
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));

// Touch sequences and CPU throttling are both CDP-only; Playwright's
// touchscreen can tap but cannot drag.
const cdp = await page.context().newCDPSession(page);

// --- Driving the game ------------------------------------------------------

/** Advances the simulation by hand. Returns once those frames have been run. */
const step = (frames = 1, deltaMs = FRAME_MS) =>
  page.evaluate(({ f, d }) => window.view.step(d, f), { f: frames, d: deltaMs });

/**
 * Lets the browser draw.
 *
 * The meshes are built and synced on the render loop rather than on our steps,
 * and a geometry is only counted against `info.memory` once it has actually
 * been uploaded — so anything about to read a screen coordinate or a GPU
 * figure waits for a drawn frame rather than for wall-clock time.
 */
const draw = () =>
  page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );

// Distances inside an evaluate are Math.hypot rather than an engine call: the
// scaffolding never needed a game engine for a hypotenuse, and there is no
// longer one on the page to reach for.
const zoneId = () => page.evaluate(() => window.world?.zone.id ?? null);

/**
 * Steps until `fn` holds. The budget is in game milliseconds, so it means the
 * same thing on a fast laptop and a loaded CI runner — which is the whole point
 * of `?loop=manual`.
 *
 * @param {() => Promise<boolean>} fn
 * @param {string} label
 * @param {number} [budgetMs]
 * @param {number} [deltaMs]
 */
const stepUntil = async (fn, label, budgetMs = 60000, deltaMs = FRAME_MS) => {
  for (let elapsed = 0; elapsed < budgetMs; elapsed += FRAMES_PER_POLL * deltaMs) {
    if (await fn()) return;
    await step(FRAMES_PER_POLL, deltaMs);
  }
  throw new Error(`timed out waiting for: ${label}`);
};

/**
 * @param {string} zone
 * @param {string} label
 * @param {number} [budgetMs]
 */
const stepUntilZone = (zone, label, budgetMs) =>
  stepUntil(async () => (await zoneId()) === zone, label, budgetMs);

/**
 * Cranks until `read` returns something `done` accepts, and hands back what it
 * saw. `stepUntil` answers whether a condition held; several checks want the
 * value that satisfied it, which is what would otherwise be read one frame late.
 *
 * @template T
 * @param {() => Promise<T>} read
 * @param {(value: T) => boolean} done
 * @param {string} label
 * @param {number} [budgetMs]
 * @returns {Promise<T>}
 */
const stepFor = async (read, done, label, budgetMs = 60000) => {
  let last = await read();
  for (let elapsed = 0; elapsed < budgetMs; elapsed += FRAMES_PER_POLL * FRAME_MS) {
    if (done(last)) return last;
    await step(FRAMES_PER_POLL);
    last = await read();
  }
  if (done(last)) return last;
  throw new Error(`timed out waiting for: ${label}`);
};

/** Drops the player back on the zone's spawn point with nothing selected. */
const park = async () => {
  await page.evaluate(() => {
    const w = window.world;
    w.clearTarget();
    w.player.stopMoving();
    w.teleport(w.spawnPoint.x, w.spawnPoint.y);
  });
  await step(2);
  await draw();
};

/**
 * A real press-and-release on the canvas, given a frame to be processed.
 *
 * @param {{ x: number; y: number }} point
 */
const clickAt = async (point) => {
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.up();
  await draw();
};

/**
 * A press, a drag of `dx` pixels in eight moves, and a release.
 *
 * @param {{ x: number; y: number }} from
 * @param {number} dx
 */
const drag = async (from, dx) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let move = 1; move <= 8; move += 1) {
    await page.mouse.move(from.x + (dx * move) / 8, from.y);
  }
  await page.mouse.up();
  await draw();
};

/**
 * @param {'touchStart' | 'touchMove' | 'touchEnd'} type
 * @param {{ x: number; y: number }[]} points
 */
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });

/**
 * The same drag, by finger.
 *
 * @param {{ x: number; y: number }} from
 * @param {number} dx
 */
const touchDrag = async (from, dx) => {
  await touch('touchStart', [{ x: from.x, y: from.y }]);
  for (let move = 1; move <= 8; move += 1) {
    await touch('touchMove', [{ x: Math.round(from.x + (dx * move) / 8), y: from.y }]);
  }
  await touch('touchEnd', []);
  await draw();
};

const drawnCounts = () => page.evaluate(() => window.view.drawnCounts());
const gpuMemory = () => page.evaluate(() => window.view.gpuMemory());
const tabBarTop = () =>
  page.evaluate(() =>
    Math.round(
      /** @type {HTMLElement} */ (document.querySelector('.hud-tabs')).getBoundingClientRect().top,
    ),
  );

/** What the bottom bar itself holds; everything else is behind the Menu tab. */
const BAR_TABS = ['character', 'inventory', 'quests', 'camp', 'menu'];
/** How many the Menu opens: Map, Feats, Mastery, Combat Log, Options. */
const MENU_TAB_COUNT = 5;

/**
 * Opens a surface the way a thumb reaches it — off the bar when it is there,
 * and through the menu when it is not. Callers ask for a surface rather than
 * for a route, which is why moving one behind the menu costs them nothing.
 *
 * @param {string} tab
 */
const tapTab = async (tab) => {
  if (!BAR_TABS.includes(tab)) {
    await page.click('.hud-tabs__tab[data-tab="menu"]');
    await page.waitForTimeout(80);
    await page.click(`[data-menu-tab="${tab}"]`);
  } else {
    await page.click(`.hud-tabs__tab[data-tab="${tab}"]`);
  }
  await page.waitForTimeout(80);
};

const spawned = () =>
  page.evaluate(() => ({
    mobs: window.world.mobs.length,
    nodes: window.world.nodes.length,
    npcs: window.world.npcs.length,
    // Not the same number as `npcs` since the banker arrived, which is exactly
    // what the marker check below would otherwise have kept asserting. Two of
    // the four have something to say: the shopkeeper's quests and the
    // quartermaster's contracts, both of which wear the same three glyphs off
    // the same ranking. The banker and the trainer offer neither.
    questGivers: window.world.npcs.filter(
      (npc) => npc.npcId === 'shopkeeper' || npc.npcId === 'quartermaster',
    ).length,
    signposts: window.world.signposts.length,
    buildings: window.world.buildings.length,
  }));

/**
 * Every simulated thing has exactly one thing drawing it. Neither handle can
 * answer that alone — the leak check compares the view only against itself,
 * and `window.world` cannot see whether a rat was ever drawn — so this is
 * where a zone that quietly builds no crabs would show up.
 *
 * @param {string} zone
 */
const checkZoneDrawn = async (zone) => {
  await draw();
  const drawn = await drawnCounts();
  const spawn = await spawned();
  check(
    `every mob, node, npc, signpost and building in the ${zone} is drawn`,
    drawn.ground === 1 &&
      drawn.mobs === spawn.mobs &&
      drawn.nodes === spawn.nodes &&
      drawn.npcs === spawn.npcs &&
      drawn.signposts === spawn.signposts &&
      drawn.buildings === spawn.buildings,
    `drew ${JSON.stringify(drawn)} for ${JSON.stringify(spawn)}`,
  );
  // A sign is counted apart from the labels for the reason a marker is: the
  // label total above is one per drawn *creature*, and a shopfront is not one.
  // It is also the only text in the game jsdom cannot bake, so a browser is the
  // only place the name over a door can be seen to exist at all.
  check(
    `and writes the ${zone}'s buildings' names over their doors`,
    drawn.signs === spawn.buildings,
    `${drawn.signs} signs over ${spawn.buildings} buildings`,
  );
  check(
    `and gives each of them in the ${zone} its floating name`,
    drawn.labels === spawn.mobs + spawn.npcs + spawn.signposts + 1,
    `${drawn.labels} labels`,
  );
  // A marker is counted apart from the labels precisely so the total above
  // stays one-per-drawn-thing. Every zone check runs before anything is taken
  // on at either counter, so everybody with work is still calling — one marker
  // each, and none over the NPCs who have nothing to offer.
  check(
    `and marks the ${zone}'s work givers without adding to that count`,
    drawn.markers === spawn.questGivers,
    `${drawn.markers} markers for ${spawn.questGivers} quest givers of ${spawn.npcs} npcs`,
  );
};

/**
 * Walks the camera over the whole zone, so everything in it has been drawn at
 * least once.
 *
 * `renderer.info.memory` counts what has actually been *uploaded* to the
 * card, which is what makes it an honest measure of a leak — and also means
 * it counts only what the camera has looked at. Comparing two snapshots taken
 * from wherever the player happened to be standing would therefore move with
 * a rat wandering into frame. Sweeping first makes both snapshots the zone's
 * entire GPU footprint instead.
 */
const sweep = async () => {
  const spans = [0.17, 0.5, 0.83];
  for (const fx of spans) {
    for (const fy of spans) {
      await page.evaluate(
        ({ x, y }) => {
          const w = window.world;
          w.teleport(w.worldWidth * x, w.worldHeight * y);
        },
        { x: fx, y: fy },
      );
      await draw();
    }
  }
  await park();
};

// Which thing in the world a tap is aimed at, as an expression the page
// evaluates: a function cannot be handed across to the browser, and naming
// the thing twice — once to stand near, once to click — is what these avoid.
const RAT = 'window.world.mobs.find((m) => m.isAlive())';
const SHOPKEEPER = "window.world.npcs.find((n) => n.npcId === 'shopkeeper')";
// Named rather than indexed now that there are two of them a few steps apart:
// which counter a tap opens is the whole point of the section below.
const BANKER = "window.world.npcs.find((n) => n.npcId === 'banker')";
const TRAINER = "window.world.npcs.find((n) => n.npcId === 'trainer')";
const QUARTERMASTER = "window.world.npcs.find((n) => n.npcId === 'quartermaster')";
const FORGE = "window.world.stations.find((s) => s.station === 'forge')";
const SOUTH_SIGNPOST = "window.world.signposts.find((s) => s.exit.edge === 'south')";

/**
 * Stands the player a little south of one of those, with nothing selected.
 *
 * @param {string} what
 */
const standSouthOf = async (what) => {
  await page.evaluate(`(() => {
    const at = ${what};
    window.world.clearTarget();
    // And shut whatever counter is open. A panel is only closed by walking out
    // of NPC_CLOSE_RADIUS, so one opened by an earlier section survives a
    // teleport that happens to land nearby — and then swallows the very tap
    // this helper exists to set up, three sections later.
    window.world.closeCounters();
    // Stopped as well as moved. A walk left pending by an earlier section
    // survives a teleport, and the player then drifts off the spot this put
    // them on — which moves the camera between reading a screen point and
    // clicking it, and reads as a tap that missed what it was aimed at.
    window.world.player.stopMoving();
    window.world.teleport(at.x, at.y + 150);
  })()`);
  // Everything else the HUD may be holding up. `closeCounters` reaches the
  // shop, the bank and the trainer, and Escape reaches the rest — an inspect
  // card, a loot table, the away report, the options menu. All of them are
  // `.hud-modal`, all of them swallow taps that land on them, and any of them
  // can be left open by a section that ran ten sections ago.
  await page.keyboard.press('Escape');
  await step(2);
  // Settled, not merely placed. Anything still driving the player — a camp
  // re-issuing a pursuit, an approach part-way through — moves the camera
  // between reading a screen point and clicking it, which reads as a tap that
  // missed rather than as the walk it actually is.
  await stepUntil(
    () => page.evaluate(() => !window.world.player.hasMoveTarget()),
    'the player to come to a stop',
  );
  await draw();
};
/**
 * Where it is drawn — the feet, which is what a player aims at.
 *
 * @param {string} what
 * @returns {Promise<{ x: number; y: number }>}
 */
const screenAt = (what) =>
  page.evaluate(`(() => {
    const at = ${what};
    return window.view.worldToScreen(at.x, at.y);
  })()`);

// Where a fixed spot in the world is drawn, which is how the camera's angle
// is read without a handle for it: turn the camera and the world swings.
const northOfPlayer = () =>
  page.evaluate(() =>
    window.view.worldToScreen(window.world.player.x, window.world.player.y - 200),
  );

async function boot() {
  // --- Booting: a fresh character through the real creation screen, which is
  // plain HTML — so this is the form a player fills in, typed and clicked. ---
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  // Either branch of the boot flow will do — a previous run leaves a save
  // behind, and what is wanted is only that the page is up before it is
  // cleared. Generous: on a cold Vite cache the first request compiles all of
  // Three.js, which takes far longer than any later wait in this script.
  await page.waitForFunction(
    () => document.querySelector('.create') !== null || window.world != null,
    null,
    { timeout: 120000 },
  );
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.create', { timeout: 60000 });
  check(
    'the creation screen boots with no class chosen',
    (await page.isDisabled('.create__begin')) === true,
  );
  await page.screenshot({ path: `${OUT}/1-character-create.png` });

  await page.fill('.create__name', 'Adventurer');
  await page.click('.create__card[data-class="warrior"]');
  check(
    'choosing a class arms the begin button',
    (await page.isDisabled('.create__begin')) === false,
  );
  await page.click('.create__begin');
  await page.waitForFunction(() => window.world != null && window.view != null, null, {
    timeout: 60000,
  });
  check('the game boots a session through the creation screen', true);

  const town = await spawned();
  // Against the zone's own table rather than against four constants: what town
  // holds is `data/zones.ts`'s business and is unit-tested there, and a check
  // that repeats the numbers here fails on every row anyone adds to it. What
  // this is for is that the world was populated from the zone it was handed at
  // all, and that none of the four kinds came back empty.
  const table = await page.evaluate(() => ({
    mobs: window.world.zone.mobSpawns.length,
    nodes: window.world.zone.nodeSpawns.length,
    npcs: window.world.zone.npcSpawns.length,
    signposts: window.world.zone.exits.length,
  }));
  check(
    'the view is built against a zone with something in it',
    town.mobs === table.mobs &&
      town.nodes === table.nodes &&
      town.npcs === table.npcs &&
      town.signposts === table.signposts &&
      Math.min(town.mobs, town.nodes, town.npcs, town.signposts) > 0,
    `${town.mobs} mobs, ${town.nodes} nodes, ${town.npcs} npcs, ${town.signposts} signposts`,
  );
}

async function teardown() {
  // --- The view's own teardown, which is the thing here with no other cover at
  // all. A zone change is a view rebuild, so everything the last zone drew has
  // to come down by hand: a geometry nobody disposed is invisible to every
  // state assertion and to the screen, and is memory the card never gets back.
  // Run before anything fights, so no floating number is mid-flight in either
  // count. ---
  await sweep();
  const before = { drawn: await drawnCounts(), gpu: await gpuMemory() };
  check(
    'the zone builds its terrain as a single mesh',
    before.drawn.ground === 1,
    `${before.drawn.total} objects, ${before.gpu.geometries} geometries`,
  );
  await checkZoneDrawn('town');
  await page.screenshot({ path: `${OUT}/2-town.png` });

  for (let trip = 0; trip < 3; trip += 1) {
    await page.evaluate(() => {
      const w = window.world;
      w.teleport(w.worldWidth / 2, w.worldHeight - 33);
    });
    await stepUntilZone('beach', 'the south exit to load the beach');
    if (trip === 0) {
      await checkZoneDrawn('beach');
      await page.screenshot({ path: `${OUT}/3-beach.png` });
    }
    await page.evaluate(() => {
      const w = window.world;
      w.teleport(w.worldWidth / 2, 33);
    });
    await stepUntilZone('town', 'the north exit to return to town');
  }
  await sweep();
  const after = { drawn: await drawnCounts(), gpu: await gpuMemory() };
  check(
    'three zone round trips hand every geometry back to the GPU',
    JSON.stringify(before.gpu) === JSON.stringify(after.gpu),
    `${JSON.stringify(before.gpu)} -> ${JSON.stringify(after.gpu)}`,
  );
  check(
    'three zone round trips leave the scene exactly as they found it',
    JSON.stringify(before.drawn) === JSON.stringify(after.drawn),
    `${JSON.stringify(before.drawn)} -> ${JSON.stringify(after.drawn)}`,
  );

  // The third zone, so every creature the game has is drawn at least once: the
  // bandit is a figure where the rat and the crab are beasts, and it is the
  // only zone that has none of the other two.
  await page.evaluate(() => {
    const w = window.world;
    w.teleport(w.worldWidth - 33, w.worldHeight / 2);
  });
  await stepUntilZone('bandit-camp', 'the east exit to load the bandit camp');
  await checkZoneDrawn('bandit camp');
  await page.screenshot({ path: `${OUT}/4-bandit-camp.png` });
  await page.evaluate(() => {
    const w = window.world;
    w.teleport(33, w.worldHeight / 2);
  });
  await stepUntilZone('town', 'the west exit to return to town');
  // And the fourth, for the same reason one zone up but about props rather than
  // creatures: an ore vein is the first new prop since the port, and the quarry
  // is the only place one is drawn. A shape built and never uploaded to a real
  // GPU is a shape whose only cover is jsdom counting its meshes.
  await page.evaluate(() => {
    const w = window.world;
    w.teleport(w.worldWidth / 2, 33);
  });
  await stepUntilZone('quarry', 'the north exit to load the quarry');
  await checkZoneDrawn('quarry');
  await page.screenshot({ path: `${OUT}/5-quarry.png` });
  await page.evaluate(() => {
    const w = window.world;
    w.teleport(w.worldWidth / 2, w.worldHeight - 33);
  });
  await stepUntilZone('town', 'the south exit to return to town');
  check(
    'zone travel round-trips town -> beach -> town -> bandit camp -> town -> quarry -> town',
    true,
  );
}

async function walkCycle() {
  // --- The figure's legs: walking swings them and standing still puts them
  // back on the neutral pose. The walk belongs to whatever is drawing rather
  // than to the simulation, so it is the view that is asked. ---
  await park();
  await page.evaluate(() => {
    const w = window.world;
    w.player.moveTo(w.player.x + 300, w.player.y);
  });
  await step(4);
  await draw();
  const walking = await page.evaluate(() => window.view.playerFigure());
  await page.evaluate(() => {
    window.world.player.stopMoving();
    window.world.player.setVelocity(0, 0);
  });
  await step(1);
  await draw();
  const standing = await page.evaluate(() => window.view.playerFigure());
  check('the figure swings its legs while walking', walking.walking === true, walking.pose);
  check(
    'and returns to its standing pose when it stops',
    standing.walking === false && standing.pose.endsWith(':0'),
    standing.pose,
  );
}

async function tabBar() {
  // --- Nothing in the world may be drawn under the tab bar. The bar is opaque
  // and swallows every tap that lands on it, and the signpost is how a zone is
  // left on a phone — the edge-walk band is untappably thin under a thumb. A
  // perspective camera cannot shrink its viewport to make room, so the rule is
  // held by how the camera is framed, and this is the measurement of it. ---
  await park();
  const signpost = await page.evaluate(() => {
    const post = window.world.signposts.find((s) => s.exit.edge === 'south');
    if (!post) throw new Error('town has no south signpost');
    return window.view.worldToScreen(post.x, post.y);
  });
  check(
    'the camera keeps the south signpost clear of the tab bar',
    signpost.y < (await tabBarTop()),
    `signpost at y=${Math.round(signpost.y)}, tab bar at ${await tabBarTop()}`,
  );
}

async function landscape() {
  // --- A resize, which has to move two things that can be forgotten
  // separately: the drawing buffer and the camera's aspect ratio. A buffer that
  // never resized would still draw, stretched, and every assertion in this file
  // that reads a screen coordinate would still pass.
  //
  // Landscape on purpose. `layout.ts` keys its breakpoint on height as well as
  // width because a landscape phone is wide by any measure and has less
  // vertical room than a portrait one, and `tests/render3d/camera.test.ts`
  // measures the tab-bar rule only at portrait sizes. This is the other
  // orientation of the same rule, and it is not the same statement — a
  // landscape camera frames twelve tiles of *depth* rather than of width, so
  // the south signpost is eight tiles behind the player at the spawn point and
  // simply out of frame there. What has to hold is that walking toward it
  // brings it into reach, which is measured below. ---
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  await draw();
  const landscape = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const post = window.world.signposts.find((s) => s.exit.edge === 'south');
    if (!canvas || !post) throw new Error('no canvas, or no south signpost');
    const box = canvas.getBoundingClientRect();
    return {
      cssW: Math.round(box.width),
      cssH: Math.round(box.height),
      // What the card is actually asked to fill, which is the half of a resize
      // that has no visible failure mode.
      bufferW: canvas.width,
      bufferH: canvas.height,
      dpr: window.devicePixelRatio,
      innerH: window.innerHeight,
      appH: /** @type {HTMLElement} */ (document.getElementById('app')).clientHeight,
      hudMounted: document.querySelector('.hud') !== null,
      post: { x: post.x, y: post.y },
    };
  });
  check(
    'a landscape resize retargets the canvas and its drawing buffer',
    landscape.cssW === 844 &&
      landscape.bufferW === Math.round(844 * landscape.dpr) &&
      landscape.bufferH === Math.round(landscape.cssH * landscape.dpr),
    `${landscape.cssW}x${landscape.cssH} css, ${landscape.bufferW}x${landscape.bufferH} buffer at dpr ${landscape.dpr}`,
  );
  // The tab bar sits flush against the bottom of the canvas, so a canvas taller
  // than the visible viewport hides it outright — which is what 100vh did on
  // iOS Safari, where vh is the viewport as if the toolbars were retracted.
  // Headless Chromium can't reproduce that discrepancy, so this is a guard
  // against a fixed or overhanging height rather than a reproduction.
  check(
    'the canvas never overhangs the visible viewport',
    landscape.appH <= landscape.innerH && landscape.cssH <= landscape.innerH,
    `app ${landscape.appH}, canvas ${landscape.cssH}, viewport ${landscape.innerH}`,
  );
  check('the HUD overlay survives a resize', landscape.hudMounted === true);

  // Walking up to the signpost has to bring it into reach, which is the
  // landscape form of "the way out of a zone is tappable". Three tiles is the
  // range a player has closed to by the time they aim at it, and it clears the
  // bar by a comfortable margin there — the camera follows all the way to the
  // map edge rather than clamping to the world bounds, so approaching keeps
  // lifting it up the screen.
  await page.evaluate(() => {
    const w = window.world;
    const post = w.signposts.find((s) => s.exit.edge === 'south');
    if (!post) throw new Error('town has no south signpost');
    w.clearTarget();
    w.teleport(post.x, post.y - 3 * 64);
  });
  await step(2);
  await draw();
  const approached = await page.evaluate(
    (post) => Math.round(window.view.worldToScreen(post.x, post.y).y),
    landscape.post,
  );
  check(
    'and walking up to the south signpost brings it clear of the tab bar in landscape',
    approached < (await tabBarTop()),
    `three tiles out it draws at y=${approached}, tab bar at ${await tabBarTop()}`,
  );
  await page.screenshot({ path: `${OUT}/5-landscape.png` });

  // Back to the portrait phone every screen coordinate below is written for.
  await page.setViewportSize({ ...PHONE });
  await page.waitForTimeout(300);
  await draw();
}

async function picking() {
  // --- Picking: a real press and release on the canvas, at the screen point
  // the view says a thing is drawn at.
  //
  // The priority order and the boxes themselves are unit-tested in
  // tests/render3d/picking.test.ts, which can cast a ray with no GPU in the
  // room. What only a browser shows is the wiring either side of it: a real
  // PointerEvent landing on the canvas, in page coordinates, against a camera
  // the render loop has already moved this frame. ---

  await standSouthOf(RAT);
  await clickAt(await screenAt(RAT));
  check(
    'a real click on a rat selects it',
    (await page.evaluate(() => window.world.target?.name ?? null)) === 'Rat',
  );
  await page.screenshot({ path: `${OUT}/6-picking.png` });
}

async function contextMenu() {
  // --- The context menu: the other thing a press on the world can mean.
  //
  // What it says and what it does with the answer are unit-tested either side
  // of the wire (tests/world/ContextMenuSession.test.ts, tests/hud/Hud.test.ts),
  // and both halves fake the press. Three things are only true in a browser.
  //
  // The first is the button: `contextmenu` and a right `pointerdown` are one
  // gesture to the platform and two events to us, and getting that wrong walks
  // the player to whatever they asked about.
  //
  // The second is that a held finger is a *clock*, not an event. `LONG_PRESS_MS`
  // is wall clock — the same reason `TAP_MAX_MS` is checked under the throttle
  // below — so nothing on the hand crank can produce one and no fake pointer
  // stream contains one.
  //
  // The third is the ray. The menu is opened from the same pick as a tap, so it
  // is cast through a camera the render loop has already moved this frame, at a
  // rat 18 screen pixels wide. ---

  await park();
  await standSouthOf(RAT);
  const rat = await screenAt(RAT);

  await page.mouse.move(rat.x, rat.y);
  await page.mouse.click(rat.x, rat.y, { button: 'right' });
  await draw();
  const opened = await page.evaluate(() => ({
    lines: [...document.querySelectorAll('.hud-context__row')].map((n) => n.textContent),
    title: document.querySelector('.hud-context__title')?.textContent ?? null,
    target: window.world.target?.name ?? null,
    walking: window.world.player.hasMoveTarget(),
  }));
  check(
    'a real right click on a rat opens a menu and asks the world for nothing',
    opened.lines.join(',') === 'Attack,Inspect,Loot' && opened.target === null && !opened.walking,
    `${opened.title}: ${opened.lines.join(' | ')}, target ${opened.target}`,
  );

  // The drop table, which is the whole reason the menu is worth having: the
  // percentages come off LOOT_TABLES, so what is on screen is what the roll
  // uses rather than a second copy of it written into the UI.
  await page.click('.hud-context__row[data-context-action="Loot"]');
  const drops = await page.evaluate(() =>
    [...document.querySelectorAll('.hud-inspect__drop')].map((row) => ({
      item: /** @type {HTMLElement} */ (row).dataset.item ?? '',
      text: row.textContent ?? '',
    })),
  );
  check(
    'Loot lists every drop with the chance the roll actually uses',
    drops.length === 2 && drops.some((d) => d.item === 'rat-bones' && d.text.includes('60%')),
    drops.map((d) => d.text).join(' | '),
  );
  await page.screenshot({ path: `${OUT}/6b-loot.png` });
  // Closed by its own button rather than by Escape, which a phone does not
  // have — and which the *world* also hears as clear-target, off a queue it
  // drains on the next step rather than when the key was pressed.
  await page.click('[data-action="close-inspect"]');

  // A finger resting on the same rat. Held past LONG_PRESS_MS in wall clock,
  // and — the half that is easy to get wrong — released afterwards, which is
  // still inside the tap window by the clock alone. Only the latch stops the
  // release also walking the player to the thing they were asking about.
  const stood = await page.evaluate(() => ({ x: window.world.player.x, y: window.world.player.y }));
  await touch('touchStart', [{ x: Math.round(rat.x), y: Math.round(rat.y) }]);
  await page.waitForTimeout(700);
  const held = await page.evaluate(() => document.querySelectorAll('.hud-context__row').length);
  await touch('touchEnd', []);
  await draw();
  const afterRelease = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
    walking: window.world.player.hasMoveTarget(),
    target: window.world.target?.name ?? null,
  }));
  check(
    'a finger held on a rat opens the same menu, and letting go walks nowhere',
    held === 3 &&
      !afterRelease.walking &&
      afterRelease.target === null &&
      Math.hypot(afterRelease.x - stood.x, afterRelease.y - stood.y) < 1,
    `${held} lines, walking: ${afterRelease.walking}, target ${afterRelease.target}`,
  );
  await page.screenshot({ path: `${OUT}/6c-context-menu.png` });

  // And the line that does reach the world, which is the same road a tap takes:
  // the HUD sends an action id and the world resolves it against the rat it is
  // still holding.
  await page.click('.hud-context__row[data-context-action="Attack"]');
  await step(2);
  check(
    'Attack from the menu selects the rat the menu was opened over',
    (await page.evaluate(() => window.world.target?.name ?? null)) === 'Rat',
  );
}

async function feedback() {
  // --- The feedback layer, which the tap above has just started a fight for.
  //
  // What only a browser can show here is the text itself: a damage number is
  // baked onto a 2D canvas and jsdom has none, so the unit suite draws every
  // float against a stub. The rise, the fade, the tone-to-colour table and the
  // corpse's topple are all covered there; this is the check that a real canvas,
  // a real texture upload and the whole WorldEvent path exist between the swing
  // and something on screen. ---
  await stepUntil(
    () => page.evaluate(() => window.view.drawnCounts().fx > 0),
    'the fight to float a damage number',
  );
  check('a hit floats a number over what it landed on', true);
  await page.screenshot({ path: `${OUT}/7-combat.png` });

  // The other channel out of the same fight. The HUD's bus is forty lines of
  // our own (`world/eventBus.ts`) with two semantics that would bite if they
  // were wrong — a listener identified by its function *and* its context, and a
  // handler unsubscribing mid-delivery. Nothing else in this script makes it
  // carry a stream of events to the overlay, and a bus that quietly dropped
  // every second one would still open a shop.
  await stepUntil(
    () =>
      page.evaluate(() => {
        const p = window.world.player;
        return p.hp < p.maxHp && window.world.mobs.some((m) => m.isEngaged() && m.hp < m.maxHp);
      }),
    'the fight to land hits in both directions',
  );
  const logged = await page.evaluate(() =>
    [...document.querySelectorAll('.hud-log__line')].map((n) => n.textContent),
  );
  check(
    'both directions of a fight reach the HUD over its event bus',
    logged.some((l) => l.includes('You hit')) && logged.some((l) => l.includes('hits you for')),
    `last: ${logged.filter((l) => l.trim()).at(-1)}`,
  );

  // The shopkeeper is the case the pick boxes exist for: a ray at a figure's
  // real geometry goes straight down the gap between its legs and out the other
  // side, so aiming at the feet would open nothing.
  await standSouthOf(SHOPKEEPER);
  await clickAt(await screenAt(SHOPKEEPER));
  await stepUntil(
    () => page.evaluate(() => window.world.shopNpc !== null),
    'the tapped shopkeeper to open the shop',
  );
  check('a real click on the shopkeeper walks over and opens the shop', true);

  // The shop is a DOM panel, so this is the row the player actually taps rather
  // than the event behind it. The quest rules themselves are covered in
  // tests/world/quests.test.ts; what needs a browser is the round trip — a tap
  // on the panel, the world deciding, and the tracker redrawing off the answer.
  await page.click('.hud-modal .hud-list-row[data-quest="rat-bones"]');
  await page.waitForTimeout(150);
  const questHeard = await page.evaluate(() => ({
    status: window.world.character.state.quests['rat-bones']?.status,
    tracker: [...document.querySelectorAll('.hud-tracker__line')].map((n) => n.textContent),
  }));
  check(
    'a quest taken at the shopkeeper reaches the world and the tracker',
    questHeard.status === 'active' && questHeard.tracker.length === 1,
    questHeard.tracker.join(' | '),
  );
  // A quest still behind its chain is drawn like a gated shelf row, carrying
  // what it waits on where its progress would sit — and, being neither
  // available nor ready, doing nothing when it is tapped.
  const lockedQuest = await page.evaluate(async () => {
    const row = document.querySelector('.hud-modal .hud-list-row[data-quest="crab-feast"]');
    /** @type {HTMLElement | null} */ (row)?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      drawn: row !== null,
      locked: /** @type {HTMLElement | null} */ (row)?.dataset.locked === 'crab-feast',
      says: row?.textContent ?? '',
      taken: window.world.character.state.quests['crab-feast'] !== undefined,
    };
  });
  check(
    'a locked quest is drawn with what it waits on, and a tap on it takes nothing on',
    lockedQuest.drawn && lockedQuest.locked && !lockedQuest.taken,
    lockedQuest.says,
  );
  // The shop's stock and its sell list get the bag's icons; its quest rows
  // deliberately do not, since a quest is not an item.
  const shopIcons = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.hud-modal .hud-list-row')];
    return {
      items: rows.filter((r) => /** @type {HTMLElement} */ (r).dataset.item).length,
      withIcon: rows.filter((r) => r.querySelector('.hud-icon')).length,
      quests: rows.filter((r) => /** @type {HTMLElement} */ (r).dataset.quest).length,
      questIcons: rows.filter(
        (r) => /** @type {HTMLElement} */ (r).dataset.quest && r.querySelector('.hud-icon'),
      ).length,
    };
  });
  check(
    'the shop draws an icon on every item row and none on a quest row',
    shopIcons.items > 0 &&
      shopIcons.withIcon === shopIcons.items &&
      shopIcons.quests > 0 &&
      shopIcons.questIcons === 0,
    `${shopIcons.withIcon}/${shopIcons.items} item rows, ${shopIcons.questIcons}/${shopIcons.quests} quest rows`,
  );
  // Half the shelf is earned. A locked row is drawn like any other and tapped
  // like any other — what needs a browser is the same round trip the locked zone
  // cell gets: a real tap on the panel, the world refusing, and the reason
  // arriving on the toast, which on a phone is the only place it can.
  // `data-locked` marks any row drawn shut, and a quest still behind its chain
  // wears it too — so this asks for the shut rows *of the shelf* rather than
  // taking the first one in the panel, which is a quest id and not an item.
  const shelf = await page.evaluate(() => ({
    rows: document.querySelectorAll('.hud-modal__box--shop .hud-list-row[data-item]').length,
    locked: [
      ...document.querySelectorAll('.hud-modal__box--shop .hud-list-row[data-item][data-locked]'),
    ].map((r) => /** @type {HTMLElement} */ (r).dataset.locked ?? ''),
  }));
  const shut = /** @type {import('../src/types/ids').ItemId} */ (shelf.locked[0] ?? '');
  const purseBefore = await page.evaluate(() => window.world.character.state.currency);
  await page.click(`.hud-modal__box--shop .hud-list-row[data-item="${shut}"]`);
  await step(2);
  const refusedStock = await page.evaluate(
    (itemId) => ({
      held: window.world.character.state.inventory[itemId] ?? 0,
      currency: window.world.character.state.currency,
      toast: document.querySelector('.hud-toast')?.textContent ?? '',
    }),
    shut,
  );
  check(
    'a shop row not yet earned is drawn shut, and tapping it is refused rather than sold',
    shelf.locked.length > 0 &&
      shelf.rows > shelf.locked.length &&
      refusedStock.held === 0 &&
      refusedStock.currency === purseBefore &&
      refusedStock.toast.length > 0,
    `${shelf.locked.length}/${shelf.rows} rows shut, tapped ${shut}, toast: "${refusedStock.toast}"`,
  );

  // A stack grows a second button that empties it. What needs a browser here is
  // that the two are separate targets on a real panel: the row still parts with
  // one, and only the button beside it takes the lot.
  await page.evaluate(() => {
    const w = window.world;
    w.character.state.inventory = { ...w.character.state.inventory, 'rat-bones': 12 };
    window.events.emit('inventory-changed', w.character.state.inventory);
  });
  const purse = await page.evaluate(() => window.world.character.state.currency);
  await page.click('.hud-modal .hud-list-row[data-item="rat-bones"]');
  await page.waitForTimeout(100);
  const one = await page.evaluate(() => window.world.character.state.inventory['rat-bones'] ?? 0);
  await page.click('.hud-modal [data-sell-all="rat-bones"]');
  await page.waitForTimeout(150);
  const sold = await page.evaluate(() => ({
    left: window.world.character.state.inventory['rat-bones'] ?? 0,
    currency: window.world.character.state.currency,
    button: document.querySelector('.hud-modal [data-sell-all="rat-bones"]') !== null,
  }));
  check(
    'a shop row sells one and the button beside it sells the rest of the stack',
    one === 11 && sold.left === 0 && sold.currency > purse && !sold.button,
    `12 -> ${one} -> ${sold.left} bones, ${purse} -> ${sold.currency} copper`,
  );
  await page.screenshot({ path: `${OUT}/8-shop.png` });

  // The marker over that shopkeeper is *polled* off the character rather than
  // pushed by an event, because what moves it is a quest finishing or an item
  // landing in the bag and neither publishes anything. So this writes the log
  // straight onto the character — no event, no HUD request — and asks whether
  // the glyph noticed. Nothing else in the run can tell a poll from a listener.
  const taken = await page.evaluate(() => ({ ...window.world.character.state.quests }));
  await page.evaluate(() => {
    window.world.character.state.quests = {
      'rat-bones': { status: 'done', baseline: 0 },
      'quarry-road': { status: 'done', baseline: 0 },
      'crab-feast': { status: 'done', baseline: 0 },
      'bandit-trouble': { status: 'done', baseline: 0 },
      'the-cutthroat': { status: 'done', baseline: 0 },
    };
  });
  await draw();
  const cleared = (await drawnCounts()).markers;
  await page.evaluate((quests) => {
    window.world.character.state.quests = quests;
  }, taken);
  await draw();
  const restored = (await drawnCounts()).markers;
  // One marker stays up through both halves, and it is the quartermaster's: a
  // board is standing work, so it has something to offer on every frame the
  // game has ever drawn. That it does *not* move while the quest log is wiped
  // and put back is the other half of what this check is worth.
  check(
    'the quest marker follows the character with no event to tell it to',
    cleared === 1 && restored === 2,
    `${cleared} markers with every quest done, ${restored} with one to take`,
  );

  // Closing from the panel's own X, which asks the world rather than telling it.
  await page.click('.hud-modal [data-action="close-shop"]');
  await stepUntil(
    () => page.evaluate(() => window.world.shopNpc === null),
    'the shop panel to close the shop',
  );
  check(
    'the shop panel closes the shop it was opened by',
    (await page.evaluate(() => document.querySelector('.hud-modal__box--shop') === null)) === true,
  );

  // Ground: the tap has to come back out in the coordinates the simulation
  // walks in, so this asks for a spot well north of the player and checks they
  // arrive at it rather than setting off in some mirrored direction.
  const destination = await page.evaluate(() => {
    const w = window.world;
    w.clearTarget();
    w.teleport(w.spawnPoint.x, w.spawnPoint.y);
    return { x: w.spawnPoint.x, y: w.spawnPoint.y - 200 };
  });
  await step(2);
  await draw();
  await clickAt(await page.evaluate((to) => window.view.worldToScreen(to.x, to.y), destination));
  await step(60);
  const walked = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));
  check(
    'a real click on the ground walks the player to that spot in the simulation',
    Math.hypot(walked.x - destination.x, walked.y - destination.y) < 24,
    `player at ${Math.round(walked.x)},${Math.round(walked.y)} for ${destination.x},${destination.y}`,
  );
}

async function bank() {
  // --- The second counter, and the reason an NPC has a role at all.
  //
  // Every NPC in the game opened the shop until the banker existed, and no
  // state assertion would have caught the banker selling felling axes — the two
  // stand a few steps apart either side of the crossroads, so what has to be
  // true is that a ray cast at *this* figure reaches *this* counter. That is
  // the same pick-box case the shopkeeper is here for, asked of the person
  // standing next to them. ---
  await standSouthOf(BANKER);
  await clickAt(await screenAt(BANKER));
  await stepUntil(
    () => page.evaluate(() => window.world.bankNpc !== null),
    'the tapped banker to open the bank',
  );
  const opened = await page.evaluate(() => ({
    bank: window.world.bankNpc?.npcId ?? null,
    shop: window.world.shopNpc?.npcId ?? null,
    panel: document.querySelector('.hud-modal__box--bank') !== null,
  }));
  check(
    'a click on the banker opens the bank and not the shop standing beside it',
    opened.bank === 'banker' && opened.shop === null && opened.panel,
    `bank: ${opened.bank}, shop: ${opened.shop}`,
  );

  // The panel round trip: a real click on a real row, the world deciding, and
  // the panel redrawing off the answer rather than off what it just asked for.
  await page.evaluate(() => {
    const w = window.world;
    w.character.state.inventory = { ...w.character.state.inventory, logs: 6 };
    window.events.emit('inventory-changed', w.character.state.inventory);
  });
  await page.click('.hud-modal .hud-list-row[data-bank="deposit"][data-item="logs"]');
  await page.waitForTimeout(150);
  const one = await page.evaluate(() => ({
    bag: window.world.character.state.inventory.logs ?? 0,
    vault: window.world.character.state.bank.logs ?? 0,
  }));
  await page.click('.hud-modal [data-bank-all="logs"]');
  await page.waitForTimeout(150);
  const stored = await page.evaluate(() => ({
    bag: window.world.character.state.inventory.logs ?? 0,
    vault: window.world.character.state.bank.logs ?? 0,
    slots: /** @type {HTMLElement | null} */ (document.querySelector('.hud-bank__slots'))
      ?.textContent,
    // The deposit row is gone with the stack, and a withdraw row stands in its
    // place — the panel is drawn from what the world sent, not from the tap.
    deposits: document.querySelectorAll('.hud-modal [data-bank="deposit"][data-item="logs"]')
      .length,
    withdraws: document.querySelectorAll('.hud-modal [data-bank="withdraw"][data-item="logs"]')
      .length,
  }));
  check(
    'a bank row stores one and the button beside it stores the rest of the stack',
    one.bag === 5 && one.vault === 1 && stored.bag === 0 && stored.vault === 6,
    `6 -> ${one.bag} -> ${stored.bag} carried, 0 -> ${one.vault} -> ${stored.vault} stored`,
  );
  check(
    'the panel redraws from the shelves the world answered with',
    stored.deposits === 0 && stored.withdraws === 1 && stored.slots === '1/8 slots',
    `${stored.deposits} deposit rows, ${stored.withdraws} withdraw rows, "${stored.slots}"`,
  );
  await page.screenshot({ path: `${OUT}/9-bank.png` });

  // The second coin sink, bought through the panel's own row.
  const purse = await page.evaluate(() => {
    window.world.character.state.currency = 500;
    window.events.emit('currency-changed', 500);
    return window.world.character.state.bankSlots;
  });
  await page.click('.hud-modal [data-action="buy-bank-slot"]');
  await page.waitForTimeout(150);
  const rented = await page.evaluate(() => ({
    slots: window.world.character.state.bankSlots,
    currency: window.world.character.state.currency,
  }));
  check(
    'renting a slot takes the coin and the panel says so',
    rented.slots === purse + 1 && rented.currency < 500,
    `${purse} -> ${rented.slots} slots, 500 -> ${rented.currency} copper`,
  );

  // Closing from the panel's own X, which asks the world rather than telling it.
  await page.click('.hud-modal [data-action="close-bank"]');
  await stepUntil(
    () => page.evaluate(() => window.world.bankNpc === null),
    'the bank panel to close the counter',
  );
  check(
    'the bank panel closes the counter it was opened by',
    (await page.evaluate(() => document.querySelector('.hud-modal__box--bank') === null)) === true,
  );
}

async function trainer() {
  // --- The third counter, and the one whose purchase changes what the player
  // can do rather than what they are carrying.
  //
  // Three things need a browser here and nothing else does: that a ray cast at
  // *this* figure reaches *this* counter with two others standing nearby, that
  // a row the character has not earned is drawn and refused rather than sold,
  // and that a lesson bought rebuilds the action bar underneath the panel that
  // sold it — which is a DOM element appearing, and the one thing no state
  // assertion can see. ---
  await standSouthOf(TRAINER);
  await clickAt(await screenAt(TRAINER));
  await stepUntil(
    () => page.evaluate(() => window.world.trainerNpc !== null),
    'the tapped trainer to open the syllabus',
  );
  const opened = await page.evaluate(() => ({
    trainer: window.world.trainerNpc?.npcId ?? null,
    shop: window.world.shopNpc?.npcId ?? null,
    bank: window.world.bankNpc?.npcId ?? null,
    panel: document.querySelector('.hud-modal__box--trainer') !== null,
  }));
  check(
    'a click on the trainer opens the trainer and neither counter beside it',
    opened.trainer === 'trainer' && opened.shop === null && opened.bank === null && opened.panel,
    `trainer: ${opened.trainer}, shop: ${opened.shop}, bank: ${opened.bank}`,
  );

  // A level 1 character has not earned anything on this list, so every row on
  // it is a locked one — drawn, tappable, and refused with the reason.
  const shut = await page.evaluate(() => ({
    rows: document.querySelectorAll('.hud-modal__box--trainer .hud-list-row[data-ability]').length,
    locked: [...document.querySelectorAll('.hud-modal__box--trainer [data-locked]')].map(
      (r) => /** @type {HTMLElement} */ (r).dataset.locked ?? '',
    ),
    // Every row carries what it does, which is the whole of the decision.
    notes: document.querySelectorAll('.hud-modal__box--trainer .hud-list-row__note').length,
  }));
  const lesson = /** @type {import('../src/types/ids').AbilityId} */ (shut.locked[0] ?? '');
  const purseBefore = await page.evaluate(() => window.world.character.state.currency);
  await page.click(`.hud-modal__box--trainer .hud-list-row[data-ability="${lesson}"]`);
  await step(2);
  const refused = await page.evaluate(() => ({
    learned: window.world.character.state.learnedAbilities.length,
    currency: window.world.character.state.currency,
    toast: document.querySelector('.hud-toast')?.textContent ?? '',
    buttons: document.querySelectorAll('.hud-actions .hud-ability__key').length,
  }));
  check(
    'a lesson not yet earned is drawn shut, and tapping it is refused rather than taught',
    shut.locked.length > 0 &&
      shut.notes === shut.rows &&
      refused.learned === 0 &&
      refused.currency === purseBefore &&
      refused.toast.length > 0 &&
      refused.buttons === 1,
    `${shut.locked.length}/${shut.rows} shut, ${refused.buttons} button(s) on the bar, toast: "${refused.toast}"`,
  );
  await page.screenshot({ path: `${OUT}/10-trainer.png` });

  // Earn it, in the two ways a row here opens: the level, and the coin. The
  // panel redraws off the level-up rather than off the tap that caused it.
  await page.evaluate(() => {
    const w = window.world;
    w.character.state.currency = 1000;
    window.events.emit('currency-changed', 1000);
    w.character.state.level = 5;
    window.events.emit('level-up', 5);
  });
  await step(2);
  const unlocked = await page.evaluate(() => ({
    locked: document.querySelectorAll('.hud-modal__box--trainer [data-locked]').length,
    rows: document.querySelectorAll('.hud-modal__box--trainer .hud-list-row[data-ability]').length,
  }));
  await page.click(`.hud-modal__box--trainer .hud-list-row[data-ability="${lesson}"]`);
  await step(2);
  const taught = await page.evaluate(() => ({
    learned: window.world.character.state.learnedAbilities,
    currency: window.world.character.state.currency,
    // The bar is rebuilt from what is known, so the new button is a real
    // element with a real slot number under it.
    buttons: [...document.querySelectorAll('.hud-actions .hud-ability__key')].map(
      (b) => /** @type {HTMLElement} */ (b).dataset.ability ?? '',
    ),
    slots: [...document.querySelectorAll('.hud-actions .hud-ability__slot')].map(
      (n) => n.textContent ?? '',
    ),
    // And the row that sold it stops being for sale, in the panel still open.
    known: [...document.querySelectorAll('.hud-modal__box--trainer .hud-list-row__value')]
      .map((n) => n.textContent ?? '')
      .filter((text) => text === 'Known').length,
  }));
  check(
    'a level opens the rows it gates, in the panel already on screen',
    unlocked.locked === 0 && unlocked.rows > 0,
    `${unlocked.locked}/${unlocked.rows} rows still shut at level 5`,
  );
  check(
    'buying a lesson adds its button to the bar and marks the row known',
    taught.learned.includes(lesson) &&
      taught.currency < 1000 &&
      taught.buttons.includes(lesson) &&
      taught.slots.join(',') === '1,2' &&
      taught.known >= 2,
    `learned ${taught.learned.join(', ')}, bar: ${taught.buttons.join(', ')}, slots ${taught.slots.join(',')}`,
  );

  // Closing from the panel's own X, which asks the world rather than telling it.
  await page.click('.hud-modal [data-action="close-trainer"]');
  await stepUntil(
    () => page.evaluate(() => window.world.trainerNpc === null),
    'the trainer panel to close the counter',
  );
  check(
    'the trainer panel closes the counter it was opened by',
    (await page.evaluate(() => document.querySelector('.hud-modal__box--trainer') === null)) ===
      true,
  );

  // Put the character back where the rest of the run expects to find them: the
  // sections after this one are written against a level 1 with a thin purse.
  await page.evaluate(() => {
    const w = window.world;
    w.character.state.level = 1;
    w.character.state.currency = 0;
    window.events.emit('level-up', 1);
    window.events.emit('currency-changed', 0);
  });
  await step(2);
}

async function bountyBoard() {
  // --- The fourth counter, and the only one that hands coin *out*.
  //
  // Three things need a browser and nothing else does: that a ray cast at this
  // figure reaches this counter with three others standing a few steps away,
  // that taking a contract grows a real line on the tracker strip over the
  // action bar — which is a DOM element appearing and is the one thing no state
  // assertion can see — and that handing one in leaves the row *takeable again*
  // in the panel still on screen, which is the whole of what "repeatable"
  // means. ---
  await standSouthOf(QUARTERMASTER);
  await clickAt(await screenAt(QUARTERMASTER));
  await stepUntil(
    () => page.evaluate(() => window.world.bountyNpc !== null),
    'the tapped quartermaster to open the board',
  );
  const opened = await page.evaluate(() => ({
    board: window.world.bountyNpc?.npcId ?? null,
    shop: window.world.shopNpc?.npcId ?? null,
    bank: window.world.bankNpc?.npcId ?? null,
    trainer: window.world.trainerNpc?.npcId ?? null,
    panel: document.querySelector('.hud-modal__box--bounty') !== null,
    // Every row carries what it asks for on the line under it.
    rows: document.querySelectorAll('.hud-modal__box--bounty .hud-list-row[data-bounty]').length,
    notes: document.querySelectorAll('.hud-modal__box--bounty .hud-list-row__note').length,
    locked: [...document.querySelectorAll('.hud-modal__box--bounty [data-locked]')].map(
      (r) => /** @type {HTMLElement} */ (r).dataset.locked ?? '',
    ),
  }));
  check(
    'a click on the quartermaster opens the board and none of the three counters beside it',
    opened.board === 'quartermaster' &&
      opened.shop === null &&
      opened.bank === null &&
      opened.trainer === null &&
      opened.panel,
    `board: ${opened.board}, shop: ${opened.shop}, bank: ${opened.bank}, trainer: ${opened.trainer}`,
  );
  check(
    'the board draws what it is holding back as well as what it is posting',
    opened.rows > 0 && opened.notes === opened.rows && opened.locked.length > 0,
    `${opened.locked.length}/${opened.rows} shut, ${opened.notes} notes`,
  );

  // A contract posted above this character's level is drawn, tapped like any
  // other row, and refused with the sentence — the version a phone with no
  // tooltip to hover ever gets.
  await page.click(`.hud-modal__box--bounty .hud-list-row[data-bounty="${opened.locked[0]}"]`);
  await step(2);
  const refused = await page.evaluate(() => ({
    held: window.world.character.state.bounty,
    toast: document.querySelector('.hud-toast')?.textContent ?? '',
  }));
  check(
    'a contract posted above your level is refused rather than taken',
    refused.held === null && refused.toast.length > 0,
    `held: ${JSON.stringify(refused.held)}, toast: "${refused.toast}"`,
  );

  // Take the one that is open, which is what puts a line on the strip.
  const trackedBefore = await page.evaluate(
    () => document.querySelectorAll('.hud-tracker__line').length,
  );
  await page.click('.hud-modal__box--bounty .hud-list-row[data-bounty="rat-cull"]');
  await step(2);
  const taken = await page.evaluate(() => ({
    held: window.world.character.state.bounty?.bountyId ?? null,
    tracked: [...document.querySelectorAll('.hud-tracker__line')].map((n) => n.textContent ?? ''),
    // The row it was taken from stops being an offer and grows a way to give
    // it back, in the panel that is still open.
    drop: document.querySelectorAll('.hud-modal__box--bounty [data-abandon-bounty]').length,
    // And stops being a button at all, which is the one row here that is not
    // one: the contract in hand is waiting on nothing the player can say to
    // this counter, where a gated row and a blocked one both are.
    heldIsButton:
      document.querySelector(
        '.hud-modal__box--bounty button.hud-list-row[data-bounty="rat-cull"]',
      ) !== null,
  }));
  check(
    'taking a contract puts a line on the tracker and a Drop button on its row',
    taken.held === 'rat-cull' &&
      taken.tracked.length === trackedBefore + 1 &&
      taken.tracked.some((line) => line.includes('Rat Cull') && line.includes('0/15')) &&
      taken.drop === 1 &&
      !taken.heldIsButton,
    `held ${taken.held}, tracker: ${taken.tracked.join(' | ')}, drop ${taken.drop}`,
  );
  await page.screenshot({ path: `${OUT}/10b-bounty.png` });

  // Finish it out in the world. The board publishes no progress of its own —
  // every row is derived from the tallies the HUD already holds — so a kill
  // count landing is what has to redraw the panel and the strip together.
  await page.evaluate(() => {
    window.world.creditKill('rat', 15);
  });
  await step(2);
  const ready = await page.evaluate(() => ({
    tracked: [...document.querySelectorAll('.hud-tracker__line')].map((n) => n.textContent ?? ''),
    values: [...document.querySelectorAll('.hud-modal__box--bounty .hud-list-row__value')].map(
      (n) => n.textContent ?? '',
    ),
  }));
  check(
    'a kill made away from the counter redraws the row and the strip together',
    ready.tracked.some((line) => line.includes('15/15')) && ready.values.includes('Hand in'),
    `tracker: ${ready.tracked.join(' | ')}, values: ${ready.values.join(', ')}`,
  );

  const purseBefore = await page.evaluate(() => window.world.character.state.currency);
  await page.click('.hud-modal__box--bounty .hud-list-row[data-bounty="rat-cull"]');
  await step(2);
  const paid = await page.evaluate(() => ({
    held: window.world.character.state.bounty,
    currency: window.world.character.state.currency,
    tracked: document.querySelectorAll('.hud-tracker__line').length,
    // The row is an offer again rather than a finished thing, which is the one
    // way this counter differs from the shopkeeper's quest log.
    offered: [
      ...document.querySelectorAll(
        '.hud-modal__box--bounty button.hud-list-row[data-bounty="rat-cull"]',
      ),
    ].length,
    drop: document.querySelectorAll('.hud-modal__box--bounty [data-abandon-bounty]').length,
  }));
  check(
    'handing a contract in pays it and posts it again in the panel still on screen',
    paid.held === null &&
      paid.currency > purseBefore &&
      paid.tracked === trackedBefore &&
      paid.offered === 1 &&
      paid.drop === 0,
    `purse ${purseBefore} → ${paid.currency}, ${paid.tracked} tracker line(s), ${paid.offered} offer`,
  );

  // Closing from the panel's own X, which asks the world rather than telling it.
  await page.click('.hud-modal [data-action="close-bounty"]');
  await stepUntil(
    () => page.evaluate(() => window.world.bountyNpc === null),
    'the board to close the counter it was opened by',
  );
  check(
    'the board closes the counter it was opened by',
    (await page.evaluate(() => document.querySelector('.hud-modal__box--bounty') === null)) ===
      true,
  );

  // Put the character back where the rest of the run expects to find them: the
  // sections after this one are written against a thin purse and no kills.
  await page.evaluate(() => {
    const w = window.world;
    w.character.state.currency = 0;
    w.character.state.kills = {};
    window.events.emit('currency-changed', 0);
    window.events.emit('kills-changed', {});
  });
  await step(2);
}

async function forge() {
  // --- The one crafting surface that needed a panel, and the only station in
  // the game that came with the zone.
  //
  // What needs a browser: that walking *to* a thing in the world opens a panel
  // with nothing owning whether it is open, that walking away closes it again,
  // and that a real tap on a real row runs the channel. None of those is a
  // state assertion — the panel is a DOM element whose whole lifecycle is a
  // distance. ---
  await page.evaluate(() => {
    const w = window.world;
    const forge = w.stations.find((s) => s.station === 'forge');
    w.clearTarget();
    w.character.state.inventory = { 'tin-ore': 8 };
    window.events.emit('inventory-changed', w.character.state.inventory);
    // Past the failure curve, so a swing is a bar rather than a coin toss.
    // Set rather than awarded: `awardSkillXp` would level the skill nine times
    // over and put nine toasts on screen, and a toast is HUD furniture that
    // swallows whatever lands on it — which is how this section reached out and
    // broke a finger tap three sections later.
    w.character.state.skills.smithing = { level: 9, xp: 0 };
    w.teleport((forge?.x ?? 0) + 400, forge?.y ?? 0);
  });
  await step(2);
  const away = await page.evaluate(() => document.querySelector('.hud-modal__box--forge') === null);

  // Standing next to it is deliberately *not* enough — a panel that opened on
  // proximity would put itself in front of anyone walking past, which on this
  // map is most of the reasons to be near one.
  await page.evaluate(() => {
    const w = window.world;
    const forge = w.stations.find((s) => s.station === 'forge');
    w.teleport(forge?.x ?? 0, (forge?.y ?? 0) + 40);
  });
  await step(2);
  const standing = await page.evaluate(
    () => document.querySelector('.hud-modal__box--forge') === null,
  );

  await draw();
  await clickAt(await screenAt(FORGE));
  await step(2);
  const opened = await page.evaluate(() => ({
    panel: document.querySelector('.hud-modal__box--forge') !== null,
    rows: document.querySelectorAll('.hud-modal__box--forge [data-recipe]').length,
    locked: document.querySelectorAll('.hud-modal__box--forge [data-locked]').length,
  }));
  check(
    'a real click on the forge opens its list, where standing beside it does not',
    away && standing && opened.panel && opened.rows > 0,
    `${opened.rows} recipes, ${opened.locked} of them still shut`,
  );

  // A real tap on a real row, and the channel that follows it.
  await page.click('.hud-modal__box--forge [data-recipe="tin-bar"]');
  await step(2);
  const casting = await page.evaluate(() => ({
    bar: document.querySelector('.hud-channel') !== null,
    label: document.querySelector('.hud-channel__label')?.textContent ?? '',
  }));
  // Long enough for several swings at 2200ms each, in game time rather than
  // frames: the crank is what makes that a number rather than a wait.
  await step(20, 200);
  const smelted = await page.evaluate(() => ({
    ore: window.world.character.state.inventory['tin-ore'] ?? 0,
    bars: window.world.character.state.inventory['tin-bar'] ?? 0,
  }));
  check(
    'a tap on a forge row smelts, on the same bar a gather and a cast use',
    casting.bar && smelted.bars > 0 && smelted.ore + smelted.bars === 8,
    `"${casting.label}" bar, ${smelted.ore} ore + ${smelted.bars} bars`,
  );
  await page.screenshot({ path: `${OUT}/11-forge.png` });

  // Walking off it is the whole of closing it — there is no session to ask.
  await page.evaluate(() => {
    const w = window.world;
    const forge = w.stations.find((s) => s.station === 'forge');
    w.teleport((forge?.x ?? 0) + 400, forge?.y ?? 0);
  });
  await step(2);
  check(
    'walking away from the forge closes the list behind you',
    (await page.evaluate(() => document.querySelector('.hud-modal__box--forge') === null)) === true,
  );

  // Put the bag back the way the sections after this one expect to find it.
  await page.evaluate(() => {
    window.world.character.state.inventory = {};
    window.events.emit('inventory-changed', {});
  });
  await step(2);
}

async function orbit() {
  // --- The drag, which is the same stream of PointerEvents as the tap and has
  // to be told apart from it. The gesture arithmetic and the camera framing are
  // both unit-tested; what only a browser has is a real press-move-release, a
  // pointer capture, and the fact that both readings of it are the same three
  // events arriving in the same order. ---
  await park();

  const beforeDrag = await northOfPlayer();
  const stood = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));

  await drag({ x: 195, y: 400 }, 140);
  const afterDrag = await northOfPlayer();
  const stayed = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
    walking: window.world.player.hasMoveTarget(),
  }));
  check(
    'a drag on the canvas turns the camera',
    afterDrag.x - beforeDrag.x > 40,
    `the ground north of the player moved from x=${Math.round(beforeDrag.x)} to ${Math.round(afterDrag.x)}`,
  );
  check(
    'a drag on the canvas asks the world for nothing',
    !stayed.walking && Math.hypot(stayed.x - stood.x, stayed.y - stood.y) < 1,
    `player at ${Math.round(stayed.x)},${Math.round(stayed.y)}, walking: ${stayed.walking}`,
  );
  await page.screenshot({ path: `${OUT}/9-orbit.png` });

  // And the gesture has to hand back: a tap straight after a drag is still a
  // tap, and it has to come back out of the *turned* camera in the coordinates
  // the simulation walks in.
  //
  // South of the spawn point rather than north of it, which is where the other
  // tap checks aim. North is the high street, and once the camera is turned a
  // shopfront stands between it and that patch of road — so the ray meets the
  // general store and answers with its door, which is right (a point you cannot
  // see because a wall is in front of it was never what the finger meant) and
  // is not what this check is about. The open country south of the crossroads is
  // walkable ground with nothing built on it from any angle.
  const turnedDestination = { x: stood.x, y: stood.y + 200 };
  await clickAt(
    await page.evaluate((to) => window.view.worldToScreen(to.x, to.y), turnedDestination),
  );
  await step(60);
  const walkedTurned = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));
  check(
    'a tap after a drag still walks the player, through the turned camera',
    Math.hypot(walkedTurned.x - turnedDestination.x, walkedTurned.y - turnedDestination.y) < 24,
    `player at ${Math.round(walkedTurned.x)},${Math.round(walkedTurned.y)} for ${Math.round(turnedDestination.x)},${Math.round(turnedDestination.y)}`,
  );
}

async function heading() {
  // --- W means up the screen, not north.
  //
  // The camera is still turned from the drag above, which is the only state in
  // which this can be wrong: the two meant the same thing until a camera could
  // be dragged round, and `InputState.setViewYaw` is what keeps them apart. The
  // failure is a character walking off at an angle to the key that was pressed,
  // which no state assertion would call a bug. Asserted as what a player sees
  // (the ground they left slides down the screen) plus the proof it is not
  // simply north. ---
  await park();
  const fromW = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));
  await page.keyboard.down('w');
  // Six frames is ~76 simulation pixels: far enough to read a direction off,
  // short enough that the spawn point's clear ground is all it crosses.
  await step(6);
  await page.keyboard.up('w');
  await draw();
  const heldW = await page.evaluate((from) => {
    const p = window.world.player;
    return {
      to: { x: p.x, y: p.y },
      // Both projected through the camera as it stands now, so the pair is one
      // question about one frame.
      fromScreen: window.view.worldToScreen(from.x, from.y),
      toScreen: window.view.worldToScreen(p.x, p.y),
    };
  }, fromW);
  const walkedW = Math.hypot(heldW.to.x - fromW.x, heldW.to.y - fromW.y);
  // How far off due north the simulation heading ended up, in degrees.
  const offNorth = Math.round(
    (Math.abs(Math.atan2(heldW.to.x - fromW.x, fromW.y - heldW.to.y)) * 180) / Math.PI,
  );
  check(
    'a real W press walks the player up the screen rather than north',
    walkedW > 40 && heldW.toScreen.y < heldW.fromScreen.y - 10 && offNorth > 20,
    `walked ${Math.round(walkedW)}px, ${offNorth}° off north, screen y ` +
      `${Math.round(heldW.fromScreen.y)} -> ${Math.round(heldW.toScreen.y)}`,
  );

  // Straightened out again, so what follows is the framing the camera test
  // measures rather than whatever the drag left behind.
  await drag({ x: 195, y: 400 }, -140);
}

async function keyboard() {
  // --- The rest of the keyboard, which the host binds itself. `bindKeyboard`
  // is shared and unit-tested; what is not shared is the call site, and a host
  // that forgot it would leave a game that plays perfectly with a mouse and
  // ignores every key. ---
  await page.evaluate(() => {
    const w = window.world;
    const rat = w.mobs.find((m) => m.level === 1 && m.isAlive());
    if (!rat) throw new Error('no level 1 rat alive in town');
    w.clearTarget();
    w.teleport(rat.x - 60, rat.y);
    w.player.restoreToFull();
  });
  // The real button rather than the event behind it.
  await tapTab('camp');
  await stepUntil(
    () => page.evaluate(() => window.world.afkActive && window.world.target !== null),
    'the camp to pick a fight',
  );
  check('the AFK camp fights unprompted', true);

  await page.keyboard.down('w');
  await step(2);
  const released = await page.evaluate(() => window.world.afkActive);
  await page.keyboard.up('w');
  check('a real movement key takes the controls back from the camp', released === false);

  // Escape reaches the world as a drained action rather than a listener. The
  // furthest live mob, so it is not auto-attacked to death before the key
  // arrives — a kill clears the target by itself.
  const selected = await page.evaluate(() => {
    const w = window.world;
    const furthest = w.mobs
      .filter((m) => m.isAlive())
      .sort(
        (a, b) =>
          Math.hypot(b.x - w.player.x, b.y - w.player.y) -
          Math.hypot(a.x - w.player.x, a.y - w.player.y),
      )[0];
    if (!furthest) return null;
    w.setTarget(furthest);
    return w.target?.name ?? null;
  });
  await page.keyboard.press('Escape');
  await step(2);
  check(
    'a real Escape press clears the selected target',
    selected !== null && (await page.evaluate(() => window.world.target)) === null,
    `had ${selected} selected`,
  );

  // A tap that lands on the opaque bar must never also be a move order. The
  // canvas has its own `pointerdown` listener underneath, so it is worth asking
  // whether the HTML overlay still gets there first.
  await park();
  const beforeBarTap = await page.evaluate(() => ({
    x: Math.round(window.world.player.x),
    y: Math.round(window.world.player.y),
  }));
  // The bar's own padding rather than a button in it, so the tap proves the
  // background swallows it without also toggling a sheet.
  const barBox = await page.evaluate(() => {
    const rect = /** @type {HTMLElement} */ (
      document.querySelector('.hud-tabs')
    ).getBoundingClientRect();
    return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.bottom - 3) };
  });
  await page.touchscreen.tap(barBox.x, barBox.y);
  await step(6);
  const afterBarTap = await page.evaluate(() => ({
    x: Math.round(window.world.player.x),
    y: Math.round(window.world.player.y),
  }));
  check(
    'a tap on the tab bar never falls through to the world as a move order',
    afterBarTap.x === beforeBarTap.x && afterBarTap.y === beforeBarTap.y,
    `${beforeBarTap.x},${beforeBarTap.y} -> ${afterBarTap.x},${afterBarTap.y}`,
  );
}

async function touchGestures() {
  // --- The same gestures under a thumb. Every drag above was a mouse, and a
  // mouse cannot break either phone-only rule: it never pans the page, so the
  // canvas's `touch-action` is untested by it, and it is never a thumb resting
  // on the screen. Chromium synthesises the pointer events these listeners are
  // written against, so this is the real path a phone takes. ---
  const beforeTouch = await northOfPlayer();
  const stoodTouch = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));
  await touchDrag({ x: 195, y: 400 }, 140);
  const afterTouch = await northOfPlayer();
  const stayedTouch = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
    walking: window.world.player.hasMoveTarget(),
  }));
  check(
    'a finger dragged across the canvas turns the camera',
    afterTouch.x - beforeTouch.x > 40,
    `the ground north of the player moved from x=${Math.round(beforeTouch.x)} to ${Math.round(afterTouch.x)}`,
  );
  check(
    'and asks the world for nothing, rather than walking where it started',
    !stayedTouch.walking &&
      Math.hypot(stayedTouch.x - stoodTouch.x, stayedTouch.y - stoodTouch.y) < 1,
    `player at ${Math.round(stayedTouch.x)},${Math.round(stayedTouch.y)}, walking: ${stayedTouch.walking}`,
  );

  // And a real finger tap, which is the other reading of the same three events.
  //
  // Pinned to one rat by index rather than re-asking for "the first living
  // one" twice. Rats die and respawn while the run goes on, so between standing
  // south of one and reading where it is on screen the answer can become a
  // *different* rat — and the tap then lands where nothing is.
  const ratIndex = await page.evaluate(() => window.world.mobs.findIndex((mob) => mob.isAlive()));
  const theRat = `window.world.mobs[${ratIndex}]`;
  await standSouthOf(theRat);
  const ratTouch = await screenAt(theRat);
  /**
   * Dispatched as two CDP events rather than through `touchscreen.tap`.
   *
   * `TAP_MAX_MS` is wall clock — deliberately, since it is the rule a slow
   * device has to keep passing — so how long a press *lasts* is the one thing
   * about this gesture that a loaded machine can change. Playwright's tap is a
   * convenience with its own timing between the two events; sending them back
   * to back is the only way to ask "was this read as a tap" without also
   * measuring the runner.
   */
  const ratPoint = /** @type {{x: number, y: number}[]} */ ([
    { x: Math.round(ratTouch.x), y: Math.round(ratTouch.y) },
  ]);
  await touch('touchStart', ratPoint);
  await touch('touchEnd', /** @type {{x: number, y: number}[]} */ ([]));
  await draw();
  // Reported in full rather than as a bare pass/fail. This check inherits the
  // state of every section before it, and when it broke the useful question was
  // never "did it hit" but "what was in the way" — a panel left open by a
  // counter three sections back reads exactly like a tap that missed.
  const tapped = await page.evaluate(() => ({
    target: window.world.target?.name ?? null,
    walking: window.world.player.hasMoveTarget(),
    panel: document.querySelector('.hud-modal__box')?.className ?? 'none',
  }));
  check(
    'and a finger tap still selects what it landed on',
    tapped.target === 'Rat',
    `target ${tapped.target}, walking ${tapped.walking}, panel ${tapped.panel}`,
  );
  await touchDrag({ x: 195, y: 400 }, -140);

  // --- Page zoom, which is not a gesture the game handles but one it must not
  // trap the player inside. A phone that double-taps its way to a zoomed page
  // and cannot pinch back out is stuck there until the tab is closed.
  //
  // The obvious check — pinch with `Input.synthesizePinchGesture` and read
  // `window.visualViewport.scale` — is deliberately absent: headless Chromium
  // does not report page zoom through it at all, verified against a plain
  // zoomable page with no `touch-action` anywhere, so the assertion would pass
  // just as happily against a canvas that refuses the pinch. What is left is
  // the policy that decides whether the gesture can ever be delivered, and the
  // behaviour that policy must not have broken. A real phone is the verdict on
  // the pinch itself. ---
  const zoomPolicy = await page.evaluate(() => {
    const of = (/** @type {string} */ selector) => {
      const node = document.querySelector(selector);
      return node === null ? null : getComputedStyle(node).touchAction;
    };
    return {
      canvas: of('canvas'),
      hud: of('.hud'),
      scalable: document
        .querySelector('meta[name="viewport"]')
        ?.getAttribute('content')
        ?.includes('user-scalable=no'),
    };
  });
  check(
    'a two-finger pinch over the world is left to the browser, so the page can always be unzoomed',
    zoomPolicy.canvas === 'pinch-zoom' && zoomPolicy.scalable === false,
    `canvas touch-action: ${zoomPolicy.canvas}, user-scalable=no present: ${zoomPolicy.scalable}`,
  );
  check(
    'and the HUD takes double-tap zoom away from every button under it',
    zoomPolicy.hud === 'manipulation',
    `.hud touch-action: ${zoomPolicy.hud}`,
  );

  // Which must leave a tab reading as two ordinary presses rather than as one
  // gesture the browser took for itself: open, then closed again. A click and
  // not `touchscreen.tap`, because a tab listens for `click` and Chromium only
  // synthesises one from a touch under mobile emulation, which this context
  // does not turn on — the tap path itself is covered by the two touch checks
  // above and by the tab bar's own section.
  const sheetOpen = () =>
    page.evaluate(() => {
      const sheet = document.querySelector('.hud-sheet[data-sheet="inventory"]');
      return sheet !== null && getComputedStyle(sheet).display !== 'none';
    });
  const tab = '.hud-tabs__tab[data-tab="inventory"]';
  await page.click(tab);
  const openedOnFirstPress = await sheetOpen();
  await page.click(tab);
  const closedOnSecondPress = !(await sheetOpen());
  check(
    'two quick presses on a tab are still two presses, not one swallowed gesture',
    openedOnFirstPress && closedOnSecondPress,
    `opened: ${openedOnFirstPress}, closed again: ${closedOnSecondPress}`,
  );

  // And the one that matters most on a phone: the signpost is how a zone is
  // left, since the edge-walk band is untappably thin under a thumb.
  await park();
  await clickAt(await screenAt(SOUTH_SIGNPOST));
  await stepUntilZone('beach', 'the tapped signpost to walk the player to the beach');
  check('a real click on a signpost walks over and changes zone', true);

  // The tab bar is the HUD's only permanent furniture, and its width is split
  // evenly, so every seat costs every other seat. Seven of them left four
  // tenths of a pixel of headroom at 375px; five leave twenty-two, which is
  // what folding the cold surfaces behind Menu bought.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(400);
  const tabWidth = await page.evaluate(() => {
    // The rendered boxes, not the formula: getBoundingClientRect is exactly the
    // area a thumb has to land on.
    const boxes = [...document.querySelectorAll('.hud-tabs__tab')].map((tab) =>
      tab.getBoundingClientRect(),
    );
    return {
      viewport: window.innerWidth,
      count: boxes.length,
      narrowest: Math.min(...boxes.map((box) => box.width)),
      shortest: Math.min(...boxes.map((box) => box.height)),
    };
  });
  check(
    'five tabs clear the 44px touch minimum on a 375px phone with room to spare',
    tabWidth.viewport === 375 &&
      tabWidth.count === 5 &&
      tabWidth.narrowest >= 44 &&
      tabWidth.shortest >= 44,
    `${tabWidth.count} tabs, narrowest ${tabWidth.narrowest.toFixed(1)}x${tabWidth.shortest.toFixed(1)}px at ${tabWidth.viewport}px`,
  );

  // The menu is the reason the bar is short, so its own buttons have to clear
  // the same minimum — a surface moved somewhere untappable is not moved.
  await page.click('.hud-tabs__tab[data-tab="menu"]');
  await page.waitForTimeout(120);
  const menuBoxes = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('[data-menu-tab]')].map((item) =>
      item.getBoundingClientRect(),
    );
    return {
      count: boxes.length,
      narrowest: Math.min(...boxes.map((box) => box.width)),
      shortest: Math.min(...boxes.map((box) => box.height)),
    };
  });
  check(
    'and the menu behind it gives its own buttons a full touch target',
    // Counted against the table rather than against a number written here: the
    // menu is where a new surface goes, so this grows and the minimum does not.
    menuBoxes.count === MENU_TAB_COUNT && menuBoxes.narrowest >= 44 && menuBoxes.shortest >= 44,
    `${menuBoxes.count} items, narrowest ${menuBoxes.narrowest.toFixed(1)}x${menuBoxes.shortest.toFixed(1)}px`,
  );
  await page.screenshot({ path: `${OUT}/10-menu-375.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${OUT}/10-tabbar-375.png` });
}

async function playerColumn() {
  // --- The two top corners, which are read at a glance mid-fight or not at
  // all. jsdom lays nothing out, so *which line* a value sits on is a question
  // only a browser answers: a level that wrapped under the name, or an XP count
  // that fell out of the bar it is printed inside, would pass every unit test
  // in tests/hud and be exactly the thing this change was made to stop. ---
  await park();

  /**
   * @param {string} selector
   * @returns {Promise<{ x: number; y: number; width: number; height: number; right: number;
   *   bottom: number } | null>}
   */
  const box = (selector) =>
    page.evaluate((sel) => {
      const node = document.querySelector(sel);
      if (!node) return null;
      const { x, y, width, height, right, bottom } = node.getBoundingClientRect();
      return { x, y, width, height, right, bottom };
    }, selector);

  const name = await box('.hud-player__name');
  const level = await box('.hud-player__level');
  check(
    'the level shares the name’s line rather than taking one of its own',
    name !== null &&
      level !== null &&
      Math.abs(name.y - level.y) < name.height &&
      level.x >= name.right - 1,
    `name ${JSON.stringify(name)} level ${JSON.stringify(level)}`,
  );

  // A bar's numbers are inside it now, which is the whole of what "merge the
  // XP text with the bar" bought: three bars and three captions was six rows of
  // eye travel for three facts.
  const insideItsBar = async (/** @type {string} */ bar) => {
    const outer = await box(bar);
    const label = await box(`${bar} .hud-bar__label`);
    return (
      outer !== null &&
      label !== null &&
      label.width > 0 &&
      label.y >= outer.y - 1 &&
      label.bottom <= outer.bottom + 1
    );
  };
  check('the XP progress is printed inside the XP bar', await insideItsBar('.hud-player__xp'));
  check('and the health readout inside the health bar', await insideItsBar('.hud-player__hp'));

  const hp = await box('.hud-player__hp');
  const xp = await box('.hud-player__xp');
  const column = await box('.hud-player');
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  check(
    'health is stacked above XP and the whole column stays clear of the tab bar',
    hp !== null &&
      xp !== null &&
      column !== null &&
      hp.y < xp.y &&
      column.right <= viewportWidth &&
      column.bottom < (await tabBarTop()),
    `hp at ${hp?.y}, xp at ${xp?.y}, column ends ${column?.bottom}, bar at ${await tabBarTop()}`,
  );

  // --- The two corners share the top row rather than stacking, which is what
  // buys the column the top of the screen. Nothing checks that in vitest at a
  // real width: `ui/layout.ts` holds them apart with arithmetic, and whether
  // the elements it places actually clear each other is the browser's answer.
  // The frame only exists while something is selected, so pick a rat first. ---
  check(
    'the player column starts at the very top of the screen',
    column !== null && column.y < 20,
    `column top at ${column?.y}`,
  );

  // Stood next to first: this section runs after a zone change, so whatever is
  // alive may be nowhere near the spawn point and a click aimed at it would
  // land on open ground.
  await standSouthOf(RAT);
  await clickAt(await screenAt(RAT));
  await step(2);
  const frame = await box('.hud-target');
  check(
    'the enemy details sit in the opposite corner, clear of the character details',
    frame !== null &&
      column !== null &&
      frame.x >= column.right &&
      frame.right <= viewportWidth &&
      Math.abs(frame.y - column.y) < 2,
    `column ends x=${Math.round(column?.right ?? 0)}, frame runs ${Math.round(
      frame?.x ?? 0,
    )}-${Math.round(frame?.right ?? 0)} of ${viewportWidth}`,
  );
  await page.screenshot({ path: `${OUT}/13-top-corners.png` });
  await park();

  // --- Buffs, driven the way a player raises one: a real press on the real
  // ability button. Battle Fury is the warrior's, costs nothing and cannot
  // fizzle, so what lands here lands every time. ---
  const bare = column?.height ?? 0;
  await page.click('.hud-ability__key[data-ability="battle-fury"]');
  await step(2);
  const buffed = await page.evaluate(() => {
    const icon = document.querySelector('.hud-effect[data-effect="haste"]');
    const sweep = /** @type {HTMLElement | null} */ (
      document.querySelector('.hud-effect[data-effect="haste"] .hud-effect__sweep')
    );
    return {
      shown: icon !== null,
      time: document.querySelector('.hud-effect__time')?.textContent ?? '',
      sweep: sweep?.getBoundingClientRect().height ?? 0,
      height: document.querySelector('.hud-player')?.getBoundingClientRect().height ?? 0,
    };
  });
  check(
    'using an ability puts its buff in the column, and the column grows for it',
    buffed.shown && buffed.height > bare,
    `column ${Math.round(bare)} -> ${Math.round(buffed.height)}, reads "${buffed.time}"`,
  );
  await page.screenshot({ path: `${OUT}/13-buff-row.png` });

  // The sweep is drawn from a 0-1 share of the buff's own clock, so it has to
  // have crept down the square by the time half of it is gone — and the icon
  // has to be gone itself once the whole of it is.
  await step(30, 140);
  const midway = await page.evaluate(
    () =>
      /** @type {HTMLElement | null} */ (
        document.querySelector('.hud-effect__sweep')
      )?.getBoundingClientRect().height ?? 0,
  );
  check(
    'and its sweep fills as the buff is spent',
    midway > buffed.sweep,
    `${Math.round(buffed.sweep)}px -> ${Math.round(midway)}px`,
  );

  await stepUntil(
    async () => !(await page.evaluate(() => window.world.player.isHasted())),
    'Battle Fury to expire',
    20000,
  );
  const expired = await page.evaluate(() => ({
    icons: document.querySelectorAll('.hud-effect').length,
    height: document.querySelector('.hud-player')?.getBoundingClientRect().height ?? 0,
  }));
  check(
    'and the row is taken back off the column when it runs out',
    expired.icons === 0 && Math.round(expired.height) === Math.round(bare),
    `${expired.icons} icons, column back to ${Math.round(expired.height)} from ${Math.round(bare)}`,
  );
}

async function sheets() {
  // --- The HUD's own behaviour, on the roomy viewport it has a different rule
  // for: one sheet is open at a time either way, but a desktop opens one at
  // launch where a phone leaves the world clear. Everything below is a real
  // click on a real element — the DOM is the HUD, so there is no model to
  // inspect instead. ---
  await page.setViewportSize({ width: 1280, height: 900 });
  // The resize rebuilds the HUD and closes any open panel, so let it land
  // before opening one.
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.world != null && window.view != null, null, {
    timeout: 60000,
  });

  const sheetVisibility = () =>
    page.evaluate(() => {
      // Computed display, not the class: a hidden sheet that still lays out is
      // an invisible wall over the tab bar, and asking the class would have
      // called that closed.
      /** @param {string} id */
      const open = (id) => {
        const node = document.querySelector(`.hud-sheet[data-sheet="${id}"]`);
        return node !== null && getComputedStyle(node).display !== 'none';
      };
      return {
        character: open('character'),
        inventory: open('inventory'),
        quests: open('quests'),
        feats: open('feats'),
        log: open('log'),
        selectedTab:
          /** @type {HTMLElement | null} */ (document.querySelector('.hud-tabs__tab.is-selected'))
            ?.dataset.tab ?? null,
      };
    });

  check(
    'the character sheet is the default sheet on a desktop viewport',
    (await sheetVisibility()).selectedTab === 'character',
  );

  await tapTab('log');
  const tabbedOpen = await sheetVisibility();
  await tapTab('log');
  const tabbedClosed = await sheetVisibility();
  check(
    'a tab opens its sheet and closes the one already open',
    tabbedOpen.log === true && tabbedOpen.character === false,
  );
  // The log lives behind the menu, and the menu is the only seat it has on the
  // bar — so that is what lights. Without it the bar goes dark while a panel is
  // open and nothing on screen says where the panel came from.
  check(
    'a sheet opened from the menu lights the Menu tab rather than nothing',
    tabbedOpen.selectedTab === 'menu' && tabbedClosed.selectedTab === null,
  );
  check('tapping the open tab again closes it', tabbedClosed.log === false);

  // The menu has to get out of the way of what it opened, or the first thing a
  // player sees of a sheet is the menu still sitting on top of it.
  const menuDismissed = await page.evaluate(
    () => document.querySelectorAll('.hud-modal--bottom').length,
  );
  check('and the menu closes behind the sheet it opened', menuDismissed === 0);

  const exclusive = [];
  for (const tab of ['character', 'inventory', 'quests', 'log']) {
    await tapTab(tab);
    const seen = await sheetVisibility();
    exclusive.push([seen.character, seen.inventory, seen.quests, seen.log].filter(Boolean).length);
  }
  check(
    'only one sheet is ever open at a time',
    exclusive.every((count) => count === 1),
    `open counts ${exclusive.join(',')}`,
  );

  // How long the log is kept is CombatLogSystem's business and unit-tested
  // there; what only a browser shows is that the sheet stays pinned to the
  // newest line rather than scrolling away from it. Two hundred lines is
  // cheaper to ask the HUD channel for than to fight for.
  const cappedLog = await page.evaluate(() => {
    for (let i = 0; i < 200; i += 1) {
      window.events.emit('combat-log', { text: `filler ${i}`, color: '#fff' });
    }
    const lines = [...document.querySelectorAll('.hud-log__line')].map((n) => n.textContent);
    return { shown: lines.length, last: lines.at(-1) };
  });
  check(
    'the log keeps the newest line on screen after two hundred more',
    cappedLog.shown === 8 && cappedLog.last === 'filler 199',
    `${cappedLog.shown} lines, last: ${cappedLog.last}`,
  );
}

async function achievements() {
  // --- Achievements in the HUD. Crediting the chain and earning the title are
  // tested headlessly; what needs a browser is the sheet and the player column
  // redrawing around a worn title. ---
  const unlockedTiers = await page.evaluate(() => {
    const w = window.world;
    w.character.state.kills = {};
    w.character.state.activeTitleId = null;
    return w.creditKill('rat', 100).length;
  });
  await tapTab('feats');
  const slayer = await page.evaluate(() => {
    const sheet = /** @type {HTMLElement} */ (
      document.querySelector('.hud-sheet[data-sheet="feats"]')
    );
    const rows = [...sheet.querySelectorAll('.hud-row--group')].map((n) => n.textContent);
    return {
      visible: getComputedStyle(sheet).display !== 'none',
      rat: rows.find((row) => row.startsWith('Rat')) ?? '',
      earnedTiers: sheet.querySelectorAll('.hud-row--tier.is-earned').length,
      titles: [...sheet.querySelectorAll('.hud-titles .hud-button')].map((n) => n.textContent),
    };
  });
  check(
    'the Feats tab opens the achievements sheet, populated from the world',
    slayer.visible && slayer.rat === 'Rat100 slain' && slayer.earnedTiers === unlockedTiers,
    `${unlockedTiers} tier(s) unlocked, sheet shows "${slayer.rat}"`,
  );
  check(
    'a completed chain offers its title in the picker',
    slayer.titles.includes('Rat Slayer'),
    slayer.titles.join(', '),
  );
  await page.screenshot({ path: `${OUT}/11-achievements.png` });

  // The title has to survive the round trip the picker actually uses: the HUD
  // asks, the world re-checks the kills back it, and the player column redraws.
  // It gets its own line there, so the column has to grow to hold it.
  const columnHeight = () =>
    page.evaluate(() =>
      Math.round(
        /** @type {HTMLElement} */ (document.querySelector('.hud-player')).getBoundingClientRect()
          .height,
      ),
    );
  const beforeTitle = await columnHeight();
  await page.click('.hud-titles .hud-button[data-title="rat-slayer"]');
  await page.waitForTimeout(250);
  const wornTitle = await page.evaluate(() => {
    const line = /** @type {HTMLElement} */ (document.querySelector('.hud-player__title'));
    return {
      model: window.world.character.state.activeTitleId,
      shown: line.textContent === 'Rat Slayer' && getComputedStyle(line).display !== 'none',
    };
  });
  const afterTitle = await columnHeight();
  check(
    'wearing a title redraws the player column with room for it',
    wornTitle.model === 'rat-slayer' && wornTitle.shown && afterTitle > beforeTitle,
    `column ${beforeTitle} -> ${afterTitle}`,
  );

  // The same title over the player in the world, which is the other half of
  // wearing one. It rides on the nameplate and is counted apart from the labels
  // — the one-per-creature total above must not move for it — and it is polled
  // off the character rather than pushed, so it has to be *drawn* to be seen.
  await draw();
  const withTitle = await drawnCounts();
  await page.evaluate(() => {
    window.world.character.state.activeTitleId = null;
  });
  await draw();
  const withoutTitle = await drawnCounts();
  await page.evaluate(() => {
    window.world.character.state.activeTitleId = 'rat-slayer';
  });
  await draw();
  check(
    'the worn title follows the player into the world without adding a label',
    withTitle.titles === 1 && withoutTitle.titles === 0 && withTitle.labels === withoutTitle.labels,
    `${withTitle.titles} -> ${withoutTitle.titles} titles, labels steady at ${withTitle.labels}`,
  );
  await page.screenshot({ path: `${OUT}/12-title-worn.png` });

  // --- Mastery: the other sheet behind the menu that is drawn from a stored
  // counter. What the pools *pay* is arithmetic and lives in
  // tests/systems/MasterySystem.test.ts; what needs a browser is that the sheet
  // is reachable behind the menu and redraws off the event rather than off a
  // copy taken when it was built. ---
  await page.evaluate(() => {
    const w = window.world;
    // Set and then published on the HUD channel, which is the pair the world
    // does on a swing. Six hundred is one rung up, so the row has something to
    // say beyond the free first one everybody starts on.
    w.character.state.mastery = { tree: 600 };
    window.events.emit('mastery-changed', w.character.state.mastery);
  });
  await tapTab('mastery');
  const pools = await page.evaluate(() => {
    const sheet = /** @type {HTMLElement} */ (
      document.querySelector('.hud-sheet[data-sheet="mastery"]')
    );
    const rows = [...sheet.querySelectorAll('.hud-skill__line')].map((n) => n.textContent ?? '');
    return {
      visible: getComputedStyle(sheet).display !== 'none',
      count: rows.length,
      tree: rows.find((row) => row.startsWith('Tree')) ?? '',
    };
  });
  check(
    'the Mastery tab opens a sheet with a pool per node and recipe',
    pools.visible && pools.count >= 13,
    `${pools.count} pool(s) drawn`,
  );
  check(
    'and a pool that crossed a rung says which one it stands on',
    pools.tree.includes('Apprentice') && pools.tree.includes('2/5'),
    `tree row: "${pools.tree}"`,
  );
  await page.screenshot({ path: `${OUT}/13-mastery.png` });
}

async function bagSheet() {
  // --- The bag: a full one must stay on screen, scroll inside itself, and clip
  // what hangs over. What is worth asserting is the consequence rather than the
  // implementation: a row scrolled out of view is not on screen and cannot be
  // hit. ---
  const bag = () =>
    page.evaluate(() => {
      const sheet = /** @type {HTMLElement} */ (
        document.querySelector('.hud-sheet[data-sheet="inventory"]')
      );
      const body = /** @type {HTMLElement} */ (sheet.querySelector('.hud-sheet__body'));
      const selected = /** @type {HTMLElement | null} */ (
        sheet.querySelector('.hud-item.is-selected')
      );
      return {
        visible: getComputedStyle(sheet).display !== 'none',
        scrollTop: Math.round(body.scrollTop),
        maxScroll: Math.round(body.scrollHeight - body.clientHeight),
        bottom: Math.round(sheet.getBoundingClientRect().bottom),
        rows: sheet.querySelectorAll('.hud-item').length,
        selected: selected?.dataset.item ?? null,
        actions: [...sheet.querySelectorAll('[data-item-action]')].map((n) => n.textContent),
      };
    });
  // One of everything in the game. A grid holds several to a row where the old
  // list gave each item the full width, so the fixture has to be the widest a
  // bag can get for the scroll and the clip below to be exercised at all — and
  // it makes the icon check further down cover every shape there is.
  const ONE_OF_EACH = {
    'rusty-sword': 1,
    'apprentice-wand': 1,
    'rat-bones': 12,
    'rat-meat': 7,
    'brown-chestplate': 1,
    'brown-helmet': 1,
    'brown-legs': 1,
    'brown-robe': 1,
    'brown-cloth-hat': 1,
    'brown-cloth-pants': 1,
    'brown-axe': 1,
    'felling-axe': 1,
    'fishing-pole': 1,
    logs: 5,
    'raw-fish': 3,
    'cooked-fish': 2,
    'burnt-fish': 1,
    'crab-meat': 4,
    'cooked-crab': 2,
    'burnt-crab': 1,
  };
  await page.evaluate((inventory) => {
    const w = window.world;
    w.character.state.inventory = inventory;
    window.events.emit('inventory-changed', w.character.state.inventory);
  }, ONE_OF_EACH);
  await tapTab('inventory');
  const bagFull = await bag();
  check(
    'a full bag stays clear of the tab bar rather than running off the screen',
    bagFull.bottom <= (await tabBarTop()),
    `bag bottom ${bagFull.bottom}, tab bar at ${await tabBarTop()}`,
  );
  check(
    'an overflowing bag becomes scrollable',
    bagFull.maxScroll > 0 && bagFull.rows === Object.keys(ONE_OF_EACH).length,
    `${bagFull.rows} cells, ${bagFull.maxScroll}px of overflow`,
  );

  const bagCenter = await page.evaluate(() => {
    const box = /** @type {HTMLElement} */ (
      document.querySelector('.hud-sheet[data-sheet="inventory"] .hud-sheet__body')
    ).getBoundingClientRect();
    return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  });
  await page.mouse.move(bagCenter.x, bagCenter.y);
  await page.mouse.wheel(0, 5000);
  await page.waitForTimeout(250);
  const bagScrolled = await bag();
  check(
    'the wheel scrolls the bag and clamps at the end',
    bagScrolled.scrollTop === bagScrolled.maxScroll && bagScrolled.scrollTop > 0,
    `scrollTop=${bagScrolled.scrollTop}/${bagScrolled.maxScroll}`,
  );

  // The clip, asserted by its consequence: the first row is scrolled out of the
  // body now, so it must be outside the sheet and whatever is at that point
  // must not be it.
  const clipped = await page.evaluate(() => {
    const sheet = /** @type {HTMLElement} */ (
      document.querySelector('.hud-sheet[data-sheet="inventory"]')
    );
    const first = /** @type {HTMLElement} */ (sheet.querySelector('.hud-item'));
    const row = first.getBoundingClientRect();
    const box = sheet.getBoundingClientRect();
    const at = document.elementFromPoint(Math.round(row.x + 4), Math.round(row.y + 4));
    return { above: row.bottom <= box.top, hits: first.contains(at) };
  });
  check(
    'a row scrolled out of the bag is clipped away rather than drawn over the world',
    clipped.above && !clipped.hits,
    `off the top: ${clipped.above}, still hittable: ${clipped.hits}`,
  );

  // Every cell carries a drawn icon. The shapes are unit-tested; what needs a
  // browser is that the SVG survives being built, hung and laid out — an icon
  // that collapsed to nothing would leave a grid of empty boxes and no error.
  const icons = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.hud-sheet[data-sheet="inventory"] .hud-item')];
    return cells.map((cell) => {
      const svg = cell.querySelector('.hud-icon');
      const box = svg?.getBoundingClientRect();
      return {
        item: /** @type {HTMLElement} */ (cell).dataset.item,
        shape: svg ? /** @type {HTMLElement} */ (svg).dataset.shape : null,
        drawn: !!box && box.width > 0 && box.height > 0,
        parts: svg?.childElementCount ?? 0,
      };
    });
  });
  check(
    'every item in the bag is drawn as an icon with a size and something in it',
    icons.length > 0 && icons.every((icon) => icon.shape && icon.drawn && icon.parts > 0),
    `${icons.length} cells, e.g. ${icons[0]?.item}: ${icons[0]?.shape} (${icons[0]?.parts} parts)`,
  );

  // The grid packs several to a row where the list gave each one the full width,
  // which is the whole point of the change and is a question about the rendered
  // box rather than about the markup. How many fit is the browser's answer to
  // whatever width the sheet was given, so this asks only for more than a list.
  const columns = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.hud-sheet[data-sheet="inventory"] .hud-item')];
    const top = cells[0]?.getBoundingClientRect().top ?? 0;
    return cells.filter((cell) => Math.abs(cell.getBoundingClientRect().top - top) < 2).length;
  });
  check('the bag lays its cells out several to a row', columns >= 2, `${columns} columns`);

  // A tap selects and unfolds the row's actions. Whether a scroll drag also
  // counts as a tap is the browser's business — a touch drag scrolls the list
  // and the click that would follow is suppressed.
  await page.click('.hud-sheet[data-sheet="inventory"] .hud-item[data-item="brown-legs"]');
  await page.waitForTimeout(200);
  const bagTapped = await bag();
  check(
    'tapping a row selects the item and unfolds its actions',
    bagTapped.selected === 'brown-legs' && bagTapped.actions.includes('Equip'),
    `${bagTapped.selected}: ${bagTapped.actions.join(', ')}`,
  );
  await page.screenshot({ path: `${OUT}/13-inventory-scroll.png` });

  // A resize is a reflow rather than a rebuild, so the open row survives by
  // construction — on a phone a tap hides the URL bar, which resizes.
  await page.setViewportSize({ width: 1280, height: 864 });
  await page.waitForTimeout(300);
  const bagResized = await bag();
  check(
    'the selected item and its Equip button survive a resize',
    bagResized.selected === 'brown-legs' && bagResized.actions.includes('Equip'),
    `${bagResized.selected}: ${bagResized.actions.join(', ')}`,
  );

  // A selection whose item is gone must clear rather than linger.
  await page.evaluate(() => {
    const w = window.world;
    w.character.removeItem('brown-legs', w.character.itemCount('brown-legs'));
    window.events.emit('inventory-changed', w.character.state.inventory);
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(300);
  check(
    'a selection whose item is gone clears rather than lingering',
    (await bag()).selected === null,
  );
}

async function characterSheet() {
  // --- The character sheet: the paperdoll is SVG built from the same rig the
  // figure in the world is built from, and an empty slot opens a picker rather
  // than needing the bag. Equipping from it is the round trip that proves the
  // sheet is self-sufficient. ---
  await tapTab('character');
  await page.click('.hud-sheet[data-sheet="character"] .hud-slot[data-slot="helmet"]');
  await page.waitForTimeout(200);
  const picker = await page.evaluate(() => {
    const node = document.querySelector('.hud-picker');
    if (!node) return null;
    const box = node.getBoundingClientRect();
    return {
      title: /** @type {HTMLElement} */ (node.querySelector('.hud-picker__title')).textContent,
      items: [...node.querySelectorAll('.hud-picker__row')].map(
        (n) => /** @type {HTMLElement} */ (n).dataset.item,
      ),
      // The same icon the bag draws, reached through the shared row helper —
      // which is the point of putting it there rather than in the bag alone.
      icons: [...node.querySelectorAll('.hud-picker__row .hud-icon')].length,
      onScreen: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth,
    };
  });
  check(
    'an empty gear slot opens a picker of what fits it, kept on screen',
    picker !== null && picker.items.includes('brown-helmet') && picker.onScreen,
    picker ? `${picker.title}: ${picker.items.join(', ')}` : 'no picker',
  );
  check(
    'and gives every row in it the same icon the bag draws',
    picker !== null && picker.icons === picker.items.length && picker.icons > 0,
    `${picker?.icons} icons for ${picker?.items.length} rows`,
  );
  await page.click('.hud-picker__row[data-item="brown-helmet"]');
  await page.waitForTimeout(200);
  const equipped = await page.evaluate(() => ({
    world: window.world.character.state.gear.helmet,
    shown: /** @type {HTMLElement} */ (
      document.querySelector('.hud-slot[data-slot="helmet"] .hud-slot__item')
    ).textContent,
    pickerGone: document.querySelector('.hud-picker') === null,
    // The paperdoll is redrawn from the new gear, so the helmet's colour is on
    // the head circle — the one thing a static picture could not show.
    headFill: /** @type {SVGElement} */ (
      document.querySelector('.hud-paperdoll circle')
    ).getAttribute('fill'),
  }));
  check(
    'picking an item equips it and redraws the sheet',
    equipped.world === 'brown-helmet' && equipped.shown === 'Brown Helmet' && equipped.pickerGone,
    `${equipped.shown}, head drawn ${equipped.headFill}`,
  );
  await page.screenshot({ path: `${OUT}/14-character-sheet.png` });
}

async function zoneMapSheet() {
  // --- The zone map. Everything on it except the dot is a pure function of the
  // zone's id and is checked in vitest; what only a browser can answer is that
  // the SVG is actually built and laid out inside the sheet, that the dot moves
  // when the player does, and that walking to another zone redraws it. ---
  await page.setViewportSize({ ...PHONE });
  await page.waitForTimeout(300);
  await park();
  await tapTab('map');

  const drawn = () =>
    page.evaluate(() => {
      const svg = document.querySelector('.hud-map__svg');
      const dot = document.querySelector('.hud-map__player');
      const box = svg?.getBoundingClientRect();
      return {
        title:
          document.querySelector('.hud-sheet[data-sheet="map"] .hud-sheet__title')?.textContent ??
          '',
        terrain: document.querySelectorAll('.hud-map__svg rect[fill]').length,
        nodes: document.querySelectorAll('.hud-map__svg [data-marker="node"]').length,
        exits: document.querySelectorAll('.hud-map__svg [data-marker="exit"]').length,
        npcs: document.querySelectorAll('.hud-map__svg [data-marker="npc"]').length,
        buildings: [...document.querySelectorAll('.hud-map__svg [data-building]')].map((n) =>
          n.getAttribute('data-building'),
        ),
        labels: [...document.querySelectorAll('.hud-map__label')].map((n) => n.textContent),
        dot: dot ? { x: Number(dot.getAttribute('cx')), y: Number(dot.getAttribute('cy')) } : null,
        shown: dot?.getAttribute('visibility') ?? 'hidden',
        width: Math.round(box?.width ?? 0),
        height: Math.round(box?.height ?? 0),
      };
    });

  // Whichever zone the sections above left the player in — the map is checked
  // against `window.world` rather than against a zone named here, which is
  // also the stronger question: the two have to agree.
  const world = await page.evaluate(() => ({
    name: window.world.zone.name,
    nodes: window.world.nodes.length,
    npcs: window.world.npcs.length,
    exits: window.world.signposts.map((post) => post.label),
    buildings: window.world.buildings.map((building) => building.definition.name),
  }));
  const here = await drawn();
  check(
    'the map draws the zone the player is standing in, with its exits named',
    here.title === world.name &&
      here.terrain > 0 &&
      here.nodes === world.nodes &&
      here.npcs === world.npcs &&
      here.exits === world.exits.length &&
      world.exits.every((label) => here.labels.includes(label)),
    `${here.title}: ${here.terrain} terrain, ${here.nodes}/${world.nodes} nodes, ` +
      `${here.npcs}/${world.npcs} npcs, exits to ${here.labels.join(', ')}`,
  );
  // The one thing on the sheet that is an area rather than a dot, and the whole
  // reason a map of a town is worth opening: where the walls are.
  check(
    'and draws every building in it, named',
    here.buildings.length === world.buildings.length &&
      world.buildings.every((name) => here.buildings.includes(name)),
    `${here.buildings.length}/${world.buildings.length} footprints: ${here.buildings.join(', ')}`,
  );
  check(
    'and lays it out inside the sheet rather than at zero size',
    here.width > 100 && here.height > 100 && here.width <= PHONE.width,
    `${here.width}x${here.height} in a ${PHONE.width}px viewport`,
  );
  check(
    'and puts the player on it',
    here.shown === 'visible' && here.dot !== null,
    `dot at ${JSON.stringify(here.dot)}`,
  );
  await page.screenshot({ path: `${OUT}/20-map.png` });

  // The dot rides a tile crossing, so this moves several tiles.
  await page.evaluate(() => {
    const w = window.world;
    w.teleport(w.spawnPoint.x - 320, w.spawnPoint.y - 256);
  });
  await step(2);
  const moved = await drawn();
  check(
    'the dot follows the player without redrawing the terrain under it',
    moved.dot !== null &&
      here.dot !== null &&
      (moved.dot.x !== here.dot.x || moved.dot.y !== here.dot.y) &&
      moved.terrain === here.terrain,
    `dot ${JSON.stringify(here.dot)} -> ${JSON.stringify(moved.dot)}, terrain steady at ${moved.terrain}`,
  );

  // --- The zoomed-out view, which is how a phone is meant to change zone: no
  // remembering that the beach is off the south edge. Its layout is derived
  // from the exits and unit-tested; what needs a browser is that the cells are
  // laid out at a real size, and that tapping one actually moves the player. ---
  await page.click('[data-action="toggle-map-zoom"]');
  await page.waitForTimeout(120);
  const overview = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.hud-map__zone')];
    const boxes = cells.map((cell) => cell.getBoundingClientRect());
    return {
      zones: cells.map((cell) => cell.getAttribute('data-zone')),
      // Which of them can actually be walked into right now. A shut door is
      // drawn shut, and travelling to one is refused rather than obeyed.
      open: cells
        .filter((cell) => cell.getAttribute('data-access') === null)
        .map((cell) => cell.getAttribute('data-zone')),
      here: cells.find((cell) => cell.getAttribute('data-here'))?.getAttribute('data-zone') ?? null,
      roads: document.querySelectorAll('.hud-map__svg--world line').length,
      smallest: Math.min(...boxes.map((box) => Math.min(box.width, box.height))),
      current: window.world.zone.id,
    };
  });
  // How many cells there are and where each one sits is `worldMap()`'s answer
  // and is unit-tested against ZONES; what only a browser can say is that they
  // are joined up, that the roads were drawn, and that the highlight found the
  // zone the world is actually running.
  check(
    'the world view draws every zone, the roads between them, and where you are',
    overview.zones.length > 1 &&
      overview.roads >= overview.zones.length - 1 &&
      overview.here === overview.current,
    `${overview.zones.join(', ')} — here: ${overview.here}, ${overview.roads} roads`,
  );
  check(
    'and gives each one a cell a thumb can hit',
    overview.smallest >= 44,
    `smallest cell ${Math.round(overview.smallest)}px`,
  );
  await page.screenshot({ path: `${OUT}/22-world-map.png` });

  // The whole point of it. Travel is refused mid-fight, so park first, and
  // somewhere open — a locked door refuses this the same way it refuses a walk.
  await park();
  const goingTo = overview.open.find((zone) => zone !== overview.current);
  await page.click(`.hud-map__zone[data-zone="${goingTo}"]`);
  await stepUntil(async () => (await zoneId()) === goingTo, `travel to ${goingTo}`);
  await step(2);
  const travelled = await page.evaluate(() => ({
    zone: window.world.zone.id,
    title:
      document.querySelector('.hud-sheet[data-sheet="map"] .hud-sheet__title')?.textContent ?? '',
    mobs: window.world.mobs.length,
  }));
  check(
    'and tapping a zone on it actually takes the player there',
    travelled.zone === goingTo && travelled.mobs > 0,
    `${overview.current} -> ${travelled.zone}, ${travelled.mobs} mobs in the rebuilt world`,
  );
  // Back to the zone view, which is what the checks below are about.
  await page.click('[data-action="toggle-map-zoom"]');
  await page.waitForTimeout(120);

  // A zone walk rebuilds the world, and the map has to follow it across. Which
  // exit is taken is read off the zone too, so this works from wherever it ran.
  const leaving = await zoneId();
  // Read here rather than from the top of the section: the travel check above
  // has moved the player since, so the zone being left is not the one that was
  // measured then.
  const before = await page.evaluate(() => window.world.zone.name);
  await page.evaluate(() => {
    const w = window.world;
    const post = w.signposts[0];
    if (!post) throw new Error('zone has no exit');
    // Onto the edge the exit sits on, which is what the world watches for.
    if (post.exit.edge === 'north') w.teleport(post.x, 0);
    else if (post.exit.edge === 'south') w.teleport(post.x, w.worldHeight);
    else if (post.exit.edge === 'west') w.teleport(0, post.y);
    else w.teleport(w.worldWidth, post.y);
  });
  await stepUntil(async () => (await zoneId()) !== leaving, 'the walk out of the zone');
  await step(2);
  const next = await page.evaluate(() => window.world.zone.name);
  const arrived = await drawn();
  check(
    'and it follows the player into the next zone',
    arrived.title === next && arrived.title !== before && arrived.shown === 'visible',
    `${before} -> ${arrived.title}, dot ${JSON.stringify(arrived.dot)}`,
  );
  await page.screenshot({ path: `${OUT}/21-map-next-zone.png` });
}

async function lockedZone() {
  // --- The locked door. What a key does to the world is unit-tested from all
  // three sides in tests/world/lockedZones.test.ts; what needs a browser is the
  // round trip through the HUD — that a shut zone is *drawn* shut on the world
  // map, that the cell changes when the key lands in the bag, and that walking
  // through spends it and rebuilds the view in a zone nothing else reaches. ---
  await page.setViewportSize({ ...PHONE });
  await page.waitForTimeout(300);
  // Both tabs toggle, so this asks what is already showing rather than assuming
  // what the section before it left behind.
  const showing = () =>
    page.evaluate(() => ({
      map: document.querySelector('.hud-sheet[data-sheet="map"]')?.classList.contains('hud-hidden'),
      world: document.querySelector('[data-action="toggle-map-zoom"]')?.textContent === 'Zone',
    }));
  if ((await showing()).map !== false) await tapTab('map');
  if (!(await showing()).world) {
    await page.click('[data-action="toggle-map-zoom"]');
    await page.waitForTimeout(120);
  }

  const cellAccess = () =>
    page.evaluate(
      () =>
        document
          .querySelector('.hud-map__zone[data-zone="bandit-hideout"]')
          ?.getAttribute('data-access') ?? 'open',
    );

  // Standing next door, which is where the key is found and the only zone the
  // hideout can be walked into from.
  if ((await zoneId()) !== 'bandit-camp') {
    await park();
    await page.click('.hud-map__zone[data-zone="bandit-camp"]');
    await stepUntilZone('bandit-camp', 'travel to the bandit camp');
  }
  await park();

  check('a zone behind a lock is drawn shut on the world map', (await cellAccess()) === 'locked');

  // Tapped like any other cell: whether a door opens is the world's answer, and
  // it is the toast that a phone with nothing to hover reads it off.
  await page.click('.hud-map__zone[data-zone="bandit-hideout"]');
  await step(2);
  const refused = await page.evaluate(() => ({
    zone: window.world.zone.id,
    toast: document.querySelector('.hud-toast')?.textContent ?? '',
  }));
  check(
    'and tapping it is refused with the reason rather than obeyed',
    refused.zone === 'bandit-camp' && refused.toast.includes('Hideout Key'),
    `still in ${refused.zone}, toast: "${refused.toast}"`,
  );
  await page.screenshot({ path: `${OUT}/23-locked-zone.png` });

  // Granted rather than farmed: the key is a 3% drop off a bandit, which is a
  // grind rather than a smoke check.
  await page.evaluate(() => {
    const w = window.world;
    w.character.addItem('hideout-key', 1);
    window.events.emit('inventory-changed', w.character.state.inventory);
  });
  await page.waitForTimeout(80);
  check(
    'the cell turns to an invitation the moment the key lands in the bag',
    (await cellAccess()) === 'unlockable',
  );

  // In through the map edge, which is the route the previous section proved for
  // an open zone. The hideout is east of the camp.
  await page.evaluate(() => {
    const w = window.world;
    w.teleport(w.worldWidth, w.worldHeight / 2);
  });
  await stepUntilZone('bandit-hideout', 'the walk into the hideout');
  await step(2);
  await draw();
  const inside = await page.evaluate(() => ({
    keys: window.world.character.itemCount('hideout-key'),
    unlocked: [...window.world.character.state.unlockedZones],
    mobs: window.world.mobs.length,
    drawnMobs: window.view.drawnCounts().mobs,
    access:
      document
        .querySelector('.hud-map__zone[data-zone="bandit-hideout"]')
        ?.getAttribute('data-access') ?? 'open',
  }));
  check(
    'walking in spends the key and opens the door for good',
    inside.keys === 0 && inside.unlocked.includes('bandit-hideout') && inside.access === 'open',
    `${inside.keys} keys left, unlocked: ${inside.unlocked.join(', ')}, cell: ${inside.access}`,
  );
  check(
    'and the view rebuilds itself in a zone nothing else reaches',
    inside.mobs > 0 && inside.drawnMobs === inside.mobs,
    `${inside.drawnMobs}/${inside.mobs} bandits drawn`,
  );
  await page.screenshot({ path: `${OUT}/24-hideout.png` });

  // --- The named mob at the back of it. What he is and what he drops is
  // unit-tested; what a browser adds is that a creature drawn at a size no
  // other one uses still gets exactly one nameplate, is still picked by a real
  // tap, and does not arrive wearing the same face as his own men. ---

  // The map sheet has been open since the top of this section, and the checks
  // below are real taps on the *world*. The HUD swallows anything that lands on
  // it on purpose (the overlay is `pointer-events: none` and each piece of
  // furniture opts back in), so the sheet has to be shut first. It was not, and
  // the tap below passed anyway for as long as the world map happened to be
  // short enough to leave the chief's corner of the screen uncovered — which
  // stopped being true the moment a fifth zone added a row to it. A check that
  // depends on how tall an unrelated panel is is not checking what it says.
  if ((await showing()).map === false) await tapTab('map');

  await page.evaluate(() => {
    const w = window.world;
    const chief = w.mobs.find((mob) => mob.definition.id === 'bandit-chief');
    if (!chief) throw new Error('the hideout has no chief');
    // Alongside rather than on top of him: close enough to tap, far enough that
    // the ray is cast at a figure standing clear of the player's own.
    w.teleport(chief.x - 120, chief.y);
  });
  await step(4);
  await draw();
  const chief = await page.evaluate(() => {
    const w = window.world;
    const mob = w.mobs.find((m) => m.definition.id === 'bandit-chief');
    if (!mob) throw new Error('the hideout has no chief');
    return {
      name: mob.definition.name,
      level: mob.level,
      at: window.view.worldToScreen(mob.x, mob.y),
      counts: window.view.drawnCounts(),
      // Everything with a name over it, plus the player's own — the same total
      // the boot section holds every zone to.
      named: w.mobs.length + w.npcs.length + w.signposts.length + 1,
    };
  });
  check(
    'the chief is drawn like everything else, one nameplate and no more',
    chief.counts.labels === chief.named && chief.level === 4,
    `${chief.name} (${chief.level}), ${chief.counts.labels} labels for ${chief.named} named things`,
  );

  // A real tap on him, which is the whole reason `pickBox` is a box: he is
  // drawn at a size nothing else is, and picking has to follow the body.
  await clickAt(chief.at);
  await step(2);
  const targeted = await page.evaluate(() => ({
    target: window.world.target?.definition.id ?? null,
    frame: document.querySelector('.hud-target__name')?.textContent ?? '',
  }));
  check(
    'and a tap on him selects him by name',
    targeted.target === 'bandit-chief' && targeted.frame.includes('Hollis'),
    `target ${targeted.target}, frame "${targeted.frame}"`,
  );
  await page.screenshot({ path: `${OUT}/25-chief.png` });

  // --- His Cleave. What it does is unit-tested; what needs a browser is the
  // half of the telegraph that is a DOM element — the target frame is where a
  // player is already looking mid-fight, and a line only there when something
  // is coming is the warning. ---
  // The map has been open over the target frame since the top of this section,
  // and the frame is the thing being read now.
  await tapTab('map');
  await page.evaluate(() => {
    const w = window.world;
    const mob = w.mobs.find((m) => m.definition.id === 'bandit-chief');
    if (!mob) throw new Error('the hideout has no chief');
    // Nobody else in the fight, and a shield deep enough to stand in a Cleave:
    // this section is about whether the warning is drawn, not about whether a
    // level 1 survives the thing it is warning about.
    w.mobs.forEach((other) => other.disengage());
    w.player.restoreToFull();
    w.player.applyManaShield({ remaining: 10000, remainingMs: 600000, durationMs: 600000 });
    // Toe to toe and already fighting: he only winds up at somebody.
    w.teleport(mob.x - 40, mob.y);
    w.setTarget(mob);
    mob.engage();
  });
  const winding = await stepFor(
    () =>
      page.evaluate(
        () => document.querySelector('.hud-target__winding:not(.hud-hidden)')?.textContent ?? '',
      ),
    (text) => text.length > 0,
    'the chief to wind up',
  );
  check(
    'a wound-up enemy ability names itself in the target frame',
    winding === 'Cleave',
    `frame says "${winding}"`,
  );
  await page.screenshot({ path: `${OUT}/27-cleave.png` });

  // And is gone again once it has landed or missed, so the line is only ever
  // there when something is actually coming.
  const cleared = await stepFor(
    () =>
      page.evaluate(() => document.querySelector('.hud-target__winding:not(.hud-hidden)') === null),
    (gone) => gone === true,
    'the cleave to land or miss',
  );
  check('and takes it back down once it lands', cleared === true);

  // Back out to the camp, with the fight called off first: the sections after
  // this one should not be standing in a room full of things that hit back.
  await page.evaluate(() => {
    const w = window.world;
    w.mobs.forEach((mob) => mob.disengage());
    w.clearTarget();
    w.player.applyManaShield(null);
    w.player.restoreToFull();
  });
  await park();
  await page.evaluate(() => window.world.teleport(0, window.world.worldHeight / 2));
  await stepUntilZone('bandit-camp', 'the walk back out of the hideout');
  await park();
}

async function reset() {
  // --- Resetting: the mobile route to a fresh character, which used to be
  // bound to F9 and so unreachable on a phone. Two taps, on purpose. It is also
  // the only path that disposes a renderer and builds another one. ---
  await page.setViewportSize({ ...PHONE });
  await page.waitForTimeout(500);
  await tapTab('options');
  const opened = await page.evaluate(() => document.querySelector('.hud-modal') !== null);
  // First press only arms the confirm; the save must still be there after it.
  await page.click('.hud-modal [data-action="reset-character"]');
  const options = await page.evaluate(() => ({
    armed:
      /** @type {HTMLElement} */ (
        document.querySelector('.hud-modal [data-action="reset-character"]')
      ).textContent === 'Tap again to confirm',
    saveIntact: localStorage.length > 0,
  }));
  await page.screenshot({ path: `${OUT}/15-options.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  check('the options menu opens from the HUD', opened === true);
  check(
    'the first reset press only arms a confirm, leaving the save alone',
    options.armed === true && options.saveIntact === true,
  );
  check(
    'escape closes the options modal',
    await page.evaluate(() => document.querySelector('.hud-modal') === null),
  );

  await tapTab('options');
  await page.click('.hud-modal [data-action="reset-character"]');
  await page.click('.hud-modal [data-action="reset-character"]');
  await page.waitForSelector('.create', { timeout: 20000 });
  check(
    'a reset tears the renderer down and returns to character creation',
    (await page.evaluate(
      () => document.querySelector('.hud') === null && document.querySelector('canvas') === null,
    )) === true,
  );
  await page.click('.create__card[data-class="wizard"]');
  await page.click('.create__begin');
  // `window.world` is cleared when a view is torn down, so this cannot pass on
  // the world the reset just ended.
  await page.waitForFunction(() => window.world != null, null, { timeout: 20000 });
  const caster = await page.evaluate(() => ({
    hasBar: document.querySelectorAll('.hud-ability').length > 0,
    mana: window.world.player.mana,
    maxMana: window.world.player.maxMana,
    ground: window.view.drawnCounts().ground,
  }));
  check(
    'and builds a fresh view for the next character',
    caster.ground === 1,
    `${caster.ground} ground layer(s)`,
  );
  check(
    'rerolling as a caster brings up an action bar and a full mana pool',
    caster.hasBar && caster.mana > 0 && caster.mana === caster.maxMana,
    `${caster.mana}/${caster.maxMana} mana`,
  );
  await page.screenshot({ path: `${OUT}/16-wizard.png` });

  // A caster is the only class with a projectile to draw, which is why this
  // waits for the wizard the reset just rolled: the bolt is the one WorldEvent
  // that exists purely so a ranged nuke does not read as nothing happening.
  // What is asserted is that the cast drew *something*, because a spell may
  // fizzle — and a fizzle is a float over the caster rather than a bolt, which
  // is a moment the player has to see just as much.
  await page.evaluate(() => {
    const w = window.world;
    const rat = w.mobs.find((m) => m.isAlive());
    if (!rat) throw new Error('nothing alive to cast at');
    w.teleport(rat.x, rat.y + 120);
    w.setTarget(rat);
  });
  // Long enough for the world to publish an ability state the bar can enable
  // its button from: out of range or with nothing targeted it is disabled, and
  // a disabled button is not clickable.
  await step(3);
  await page.click('.hud-ability__key[data-ability="fireball"]');
  // The bar the spell is cast behind, which only a real DOM can be asked about:
  // it is shown on the press and gone once the spell goes off.
  await step(1);
  const channel = await page.evaluate(() => {
    const bar = document.querySelector('.hud-channel');
    const fill = document.querySelector('.hud-channel .hud-bar__fill');
    return {
      shown: bar !== null && !bar.classList.contains('hud-hidden'),
      label: document.querySelector('.hud-channel__label')?.textContent ?? '',
      box: bar?.getBoundingClientRect().width ?? 0,
      fill: /** @type {HTMLElement | null} */ (fill)?.style.width ?? '',
    };
  });
  check(
    'a spell with a cast time puts a bar on screen while it is being cast',
    channel.shown && channel.label === 'Fireball' && channel.box > 0,
    `"${channel.label}" bar ${Math.round(channel.box)}px wide, filled to ${channel.fill}`,
  );
  await page.screenshot({ path: `${OUT}/26-casting.png` });

  // Standing still for the whole cast, which is the only way one lands.
  await step(Math.ceil(1400 / FRAME_MS) + 2);
  const cast = await page.evaluate(() => window.view.drawnCounts().fx);
  check(
    'and the cast lands when the clock runs out — a bolt in flight, or a fizzle',
    cast > 0,
    `${cast} effect(s) in flight`,
  );
  await page.screenshot({ path: `${OUT}/17-cast.png` });
}

async function saveResume() {
  // --- The save round trip, through a real reload.
  //
  // Two things only this can show. `bindUnloadPersist` is the host's own call
  // site rather than shared code, so a session that never persisted would look
  // perfect until the tab was closed. And every zone reached above came through
  // the creation screen — this is the *resume* branch of `bootFlow`, which is
  // the one every session after the first takes. Parked on a mob's spawn point:
  // known walkable, known well off centre, and the player does not collide with
  // mobs. ---
  const parked = await page.evaluate(() => {
    const w = window.world;
    const anchor = w.mobs[0];
    if (!anchor) throw new Error('the zone has no mob to park on');
    // Staged here rather than left over from the `bank` section: `reset`
    // rerolls the character in between, so anything stored back there is gone
    // along with the character who stored it.
    w.character.state.bank = { logs: 7 };
    const spot = { x: Math.round(anchor.spawnX), y: Math.round(anchor.spawnY) };
    w.clearTarget();
    w.teleport(spot.x, spot.y);
    return {
      spot,
      zoneId: w.zone.id,
      fromCentre: Math.round(Math.hypot(spot.x - w.spawnPoint.x, spot.y - w.spawnPoint.y)),
      bank: { ...w.character.state.bank },
      bankSlots: w.character.state.bankSlots,
    };
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.world != null && window.view != null, null, {
    timeout: 60000,
  });
  const resumed = await page.evaluate(() => ({
    x: Math.round(window.world.player.x),
    y: Math.round(window.world.player.y),
    zoneId: window.world.zone.id,
    ground: window.view.drawnCounts().ground,
    bank: { ...window.world.character.state.bank },
    bankSlots: window.world.character.state.bankSlots,
  }));
  check(
    'a save resumes where it was left, with a rebuilt view',
    resumed.zoneId === parked.zoneId &&
      parked.fromCentre > 32 &&
      Math.hypot(resumed.x - parked.spot.x, resumed.y - parked.spot.y) <= 4 &&
      resumed.ground === 1,
    `left at ${parked.spot.x},${parked.spot.y} (${parked.fromCentre}px off centre), back at ${resumed.x},${resumed.y}`,
  );

  // The vault is the newest thing in `CharacterState`, and a reload is the only
  // place the save, the migration chain and the boot's resume branch all run
  // for real — a stack put away and gone by morning is the one bank bug that
  // costs a player something they cannot get back.
  check(
    'what was banked is still on the shelves after a reload',
    JSON.stringify(resumed.bank) === JSON.stringify(parked.bank) &&
      Object.keys(parked.bank).length > 0 &&
      resumed.bankSlots === parked.bankSlots,
    `stored ${JSON.stringify(parked.bank)} in ${parked.bankSlots} slots, back with ${JSON.stringify(resumed.bank)} in ${resumed.bankSlots}`,
  );
}

async function offlineCamping() {
  // --- Offline camping: a session parked in the save pays out on the next
  // load, and the report waits in the notification queue until the HUD mounts.
  // Travelling an hour back in the save is the only way to reach that path —
  // hence the unit tests around resolveOfflineAfk, with `now` injected, doing
  // the harder cases. Written through the live game rather than into
  // localStorage directly: the page's own unload handler persists on reload and
  // would overwrite a hand-written save. Only the clock is faked. ---
  // Parked with a pack stuffed to the brim, which is the case worth driving
  // through a real reload: a full pack does not stop an unattended session, so
  // the report has to come back with the night's XP *and* an itemised list of
  // what it could not carry.
  await tapTab('camp');
  await page.evaluate(() => {
    const w = window.world;
    w.character.state.level = 1;
    w.character.state.xp = 0;
    w.character.state.inventory = { 'rat-bones': w.character.carryCapacity() };
    const afk = w.character.state.afk;
    if (!afk) throw new Error('the camp tab left no parked session behind');
    afk.startedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.world != null, null, { timeout: 60000 });
  const away = await page.evaluate(() => {
    const state = window.world.character.state;
    return {
      xp: state.xp,
      level: state.level,
      afk: state.afk,
      panel: document.querySelector('[data-action="dismiss-away-report"]') !== null,
      heading: document.body.textContent?.includes('Could not carry:') ?? false,
      missed: [...document.querySelectorAll('.hud-modal__missed')].map((n) => n.textContent),
    };
  });
  check(
    'an hour parked in the save pays xp out on the next load',
    away.xp > 0 || away.level > 1,
    `level ${away.level}, xp ${away.xp}`,
  );
  check('the away report reaches a HUD that was not listening yet', away.panel === true);
  // Cleared on the load that paid it, so a second load can't pay it twice.
  check('the parked session is cleared once resolved', away.afk === null);
  check(
    'a night with a full pack still pays, and names what it could not carry',
    away.xp > 0 && away.heading && away.missed.length > 0,
    `${away.xp} xp, could not carry: ${away.missed.join(', ') || 'nothing'}`,
  );
  await page.screenshot({ path: `${OUT}/18-away-report.png` });
  await page.click('[data-action="dismiss-away-report"]');
}

async function throttled() {
  // --- The same game on a phone that cannot keep up.
  //
  // Everything above runs at 40ms a frame on a machine that renders one in a
  // fraction of that. A cheap phone drawing a WebGL scene is the case the
  // simulation was written to survive and the case nothing here has yet asked
  // for: `Emulation.setCPUThrottlingRate` makes each real frame roughly eight
  // times more expensive, and the hand crank is turned at 140ms — 7fps, which
  // carries the player ~45 simulation pixels in a single step.
  //
  // Both halves matter and they are different questions. The simulation's is
  // arithmetic and is unit-tested: `arriveRadius` scales the arrival band with
  // the frame's travel, because a fixed one leaves the player orbiting a
  // destination forever. The renderer's cannot be unit-tested at all — whether
  // a real press and release still reads as a tap when the clock between them
  // is a slow device's, and whether the camera a ray is cast through has been
  // moved this frame. ---
  const SLOW_FRAME_MS = 140;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 });
  const errorsBeforeSlow = consoleErrors.length;

  /**
   * Cranks the throttled page at 7fps until `fn`, in game milliseconds.
   *
   * @param {() => Promise<boolean>} fn
   * @param {string} label
   * @param {number} [budgetMs]
   */
  const stepUntilSlow = (fn, label, budgetMs = 30000) =>
    stepUntil(fn, `${label} at 7fps`, budgetMs, SLOW_FRAME_MS);

  await park();

  // Arrival at 45px a frame. The tap is real and so is the walk: a fixed
  // arrival band would step over the destination and turn back every frame,
  // which presents as a character vibrating on the spot and never stopping.
  const slowDestination = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y - 200,
  }));
  await clickAt(
    await page.evaluate((to) => window.view.worldToScreen(to.x, to.y), slowDestination),
  );
  await stepUntilSlow(
    () => page.evaluate(() => !window.world.player.hasMoveTarget()),
    'the player to stop walking',
  );
  const slowWalked = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));
  check(
    'a tap walks the player to its destination and stops there at 7fps',
    Math.hypot(slowWalked.x - slowDestination.x, slowWalked.y - slowDestination.y) < 48,
    `player at ${Math.round(slowWalked.x)},${Math.round(slowWalked.y)} for ${Math.round(slowDestination.x)},${Math.round(slowDestination.y)}`,
  );

  // A tap that is still a tap. `TAP_MAX_MS` is wall clock, and wall clock is
  // exactly what a slow device inflates: press and release are two real events
  // and the gap between them is the device's, not the game's. A limit that a
  // cheap phone cannot meet is a phone on which nothing can be tapped at all.
  await standSouthOf(RAT);
  await clickAt(await screenAt(RAT));
  check(
    'a real tap still selects what it landed on at 7fps',
    (await page.evaluate(() => window.world.target?.name ?? null)) === 'Rat',
    'press and release are a slow device apart',
  );

  // And the other reading of it, which must not have become the easy one.
  await park();
  const beforeSlowDrag = await northOfPlayer();
  const stoodSlow = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));
  await touchDrag({ x: 195, y: 400 }, 140);
  const afterSlowDrag = await northOfPlayer();
  const stayedSlow = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
    walking: window.world.player.hasMoveTarget(),
  }));
  check(
    'a finger drag still turns the camera and asks for nothing at 7fps',
    afterSlowDrag.x - beforeSlowDrag.x > 40 &&
      !stayedSlow.walking &&
      Math.hypot(stayedSlow.x - stoodSlow.x, stayedSlow.y - stoodSlow.y) < 1,
    `the ground north of the player moved from x=${Math.round(beforeSlowDrag.x)} to ` +
      `${Math.round(afterSlowDrag.x)}, walking: ${stayedSlow.walking}`,
  );

  // Leaving a zone is the case the slow frame was always most likely to break:
  // 45px of travel is most of the way through the exit band, and the
  // world-bounds clamp stops the player `PLAYER_HALF_EXTENT` from the edge —
  // which has to stay inside `EXIT_MARGIN` or the transition silently never
  // fires. Walked into rather than teleported onto, so the clamp is in play.
  await page.evaluate(() => {
    const w = window.world;
    w.clearTarget();
    w.teleport(w.worldWidth / 2, w.worldHeight - 240);
    w.player.moveTo(w.worldWidth / 2, w.worldHeight + 200);
  });
  await stepUntilSlow(
    async () => (await zoneId()) === 'beach',
    'the player to walk off the south edge',
  );
  check('walking into the map edge at 7fps still changes zone', true);
  await page.screenshot({ path: `${OUT}/19-throttled.png` });

  // The render loop itself, which the simulation's hand crank does not drive: a
  // frame still has to arrive and still has to draw the zone it was handed.
  await draw();
  const slowDrawn = await drawnCounts();
  check(
    'the render loop keeps drawing the zone under an eight-times slower CPU',
    slowDrawn.ground === 1 && slowDrawn.mobs > 0,
    `${slowDrawn.total} objects, ${slowDrawn.mobs} mobs`,
  );
  check(
    'and nothing on the page threw while it was struggling',
    consoleErrors.length === errorsBeforeSlow,
    consoleErrors.slice(errorsBeforeSlow, errorsBeforeSlow + 3).join(' | '),
  );
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
}

/**
 * The run, in the order it happens. Each entry is one of the `// ---` banners
 * above and is what `--section=` names.
 *
 * @type {[string, () => Promise<void>][]}
 */
const SECTIONS = [
  ['boot', boot],
  ['teardown', teardown],
  ['walk-cycle', walkCycle],
  ['tab-bar', tabBar],
  ['landscape', landscape],
  ['picking', picking],
  ['context-menu', contextMenu],
  ['feedback', feedback],
  ['bank', bank],
  ['trainer', trainer],
  ['bounty-board', bountyBoard],
  ['forge', forge],
  ['orbit', orbit],
  ['heading', heading],
  ['keyboard', keyboard],
  ['touch', touchGestures],
  ['player-column', playerColumn],
  ['sheets', sheets],
  ['achievements', achievements],
  ['bag', bagSheet],
  ['character-sheet', characterSheet],
  ['zone-map', zoneMapSheet],
  ['locked-zone', lockedZone],
  ['reset', reset],
  ['save-resume', saveResume],
  ['offline-camping', offlineCamping],
  ['throttled', throttled],
];

const known = SECTIONS.map(([name]) => name);
const unknown = requested.filter((name) => !known.includes(name));
if (unknown.length > 0) {
  console.error(`unknown section: ${unknown.join(', ')}`);
  console.error(`known sections: ${known.join(', ')}`);
  await browser.close();
  process.exit(2);
}

try {
  for (const [name, run] of SECTIONS) {
    // `boot` is never skipped: it clears the save and creates the character
    // every other section is written against.
    if (requested.length > 0 && name !== 'boot' && !requested.includes(name)) continue;
    console.log(`\n--- ${name} ---`);
    await run();
  }

  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('smoke run completed', false, String(err instanceof Error ? err.message : err));
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
