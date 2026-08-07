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
    signposts: window.world.signposts.length,
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
    `every mob, node, npc and signpost in the ${zone} is drawn`,
    drawn.ground === 1 &&
      drawn.mobs === spawn.mobs &&
      drawn.nodes === spawn.nodes &&
      drawn.npcs === spawn.npcs &&
      drawn.signposts === spawn.signposts,
    `drew ${JSON.stringify(drawn)} for ${JSON.stringify(spawn)}`,
  );
  check(
    `and gives each of them in the ${zone} its floating name`,
    drawn.labels === spawn.mobs + spawn.npcs + spawn.signposts + 1,
    `${drawn.labels} labels`,
  );
  // A quest marker is counted apart from the labels precisely so the total
  // above stays one-per-drawn-thing. Every zone check runs before anything is
  // taken on at the shopkeeper, so every quest giver is still calling — which
  // makes one marker per NPC the answer, and none at all where there is no NPC.
  check(
    `and marks the ${zone}'s quest givers without adding to that count`,
    drawn.markers === spawn.npcs,
    `${drawn.markers} markers for ${spawn.npcs} npcs`,
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
const SHOPKEEPER = 'window.world.npcs[0]';
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
    window.world.teleport(at.x, at.y + 150);
  })()`);
  await step(2);
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
  check(
    'the view is built against a zone with something in it',
    town.mobs === 9 && town.nodes === 6 && town.npcs === 1 && town.signposts === 2,
    `${town.mobs} mobs, ${town.nodes} nodes, ${town.npcs} npc, ${town.signposts} signposts`,
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
  check('zone travel round-trips town -> beach -> town -> bandit camp -> town', true);
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
    world: { ...window.world.character.state.quests },
    tracker: [...document.querySelectorAll('.hud-tracker__line')].map((n) => n.textContent),
  }));
  check(
    'a quest taken at the shopkeeper reaches the world and the tracker',
    questHeard.world['rat-bones'] === 'active' && questHeard.tracker.length === 1,
    questHeard.tracker.join(' | '),
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
  await page.screenshot({ path: `${OUT}/8-shop.png` });

  // The marker over that shopkeeper is *polled* off the character rather than
  // pushed by an event, because what moves it is a quest finishing or an item
  // landing in the bag and neither publishes anything. So this writes the log
  // straight onto the character — no event, no HUD request — and asks whether
  // the glyph noticed. Nothing else in the run can tell a poll from a listener.
  const taken = await page.evaluate(() => ({ ...window.world.character.state.quests }));
  await page.evaluate(() => {
    window.world.character.state.quests = { 'rat-bones': 'done', 'crab-feast': 'done' };
  });
  await draw();
  const cleared = (await drawnCounts()).markers;
  await page.evaluate((quests) => {
    window.world.character.state.quests = quests;
  }, taken);
  await draw();
  const restored = (await drawnCounts()).markers;
  check(
    'the quest marker follows the character with no event to tell it to',
    cleared === 0 && restored === 1,
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
  // the simulation walks in. The same spot the tap check above used, which is
  // known to be walkable ground.
  const turnedDestination = { x: stood.x, y: stood.y - 200 };
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
  await standSouthOf(RAT);
  const ratTouch = await screenAt(RAT);
  await page.touchscreen.tap(Math.round(ratTouch.x), Math.round(ratTouch.y));
  await draw();
  check(
    'and a finger tap still selects what it landed on',
    (await page.evaluate(() => window.world.target?.name ?? null)) === 'Rat',
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
    menuBoxes.count === 3 && menuBoxes.narrowest >= 44 && menuBoxes.shortest >= 44,
    `${menuBoxes.count} items, narrowest ${menuBoxes.narrowest.toFixed(1)}x${menuBoxes.shortest.toFixed(1)}px`,
  );
  await page.screenshot({ path: `${OUT}/10-menu-375.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${OUT}/10-tabbar-375.png` });
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
  await step(1);
  const cast = await page.evaluate(() => window.view.drawnCounts().fx);
  check(
    'a real cast draws itself — a bolt in flight, or a fizzle over the caster',
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
    const spot = { x: Math.round(anchor.spawnX), y: Math.round(anchor.spawnY) };
    w.clearTarget();
    w.teleport(spot.x, spot.y);
    return {
      spot,
      zoneId: w.zone.id,
      fromCentre: Math.round(Math.hypot(spot.x - w.spawnPoint.x, spot.y - w.spawnPoint.y)),
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
  }));
  check(
    'a save resumes where it was left, with a rebuilt view',
    resumed.zoneId === parked.zoneId &&
      parked.fromCentre > 32 &&
      Math.hypot(resumed.x - parked.spot.x, resumed.y - parked.spot.y) <= 4 &&
      resumed.ground === 1,
    `left at ${parked.spot.x},${parked.spot.y} (${parked.fromCentre}px off centre), back at ${resumed.x},${resumed.y}`,
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
  await tapTab('camp');
  await page.evaluate(() => {
    const w = window.world;
    w.character.state.level = 1;
    w.character.state.xp = 0;
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
  ['feedback', feedback],
  ['orbit', orbit],
  ['heading', heading],
  ['keyboard', keyboard],
  ['touch', touchGestures],
  ['sheets', sheets],
  ['achievements', achievements],
  ['bag', bagSheet],
  ['character-sheet', characterSheet],
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
