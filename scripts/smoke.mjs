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
 * how the world is drawn: `window.world` for everything about the simulation,
 * `window.view` for the few questions only whatever is drawing can answer (see
 * src/types/debugView.ts), and `window.events` for the HUD channel between
 * them. That is what let the renderer be replaced under this file, twice,
 * rather than alongside it.
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
import { mkdirSync, readFileSync } from 'node:fs';

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

/**
 * What one drawn frame may cost, in milliseconds, on the throttled pass.
 *
 * Anchored to a measurement rather than chosen. `window.view.drawTime()` read
 * 3.1ms on a full run in CI once the last of Part B's art was drawn (B6), and
 * 2.0ms before it (B4); a dev container, which is loaded, reads 5-6ms. The 3D
 * view it replaced read 25ms under the same throttle against a ceiling of 40,
 * so the 2D view costs about an eighth of it, which is what decision 101's
 * spike found of one scene, found true of the whole game.
 *
 * Read it off a **full run**, which is what the gate sees: the section carries
 * state forward from every one before it, so `--section=throttled` on its own
 * is a different and lighter game.
 *
 * 16ms, where the draw alone stops fitting a 60fps frame on a CPU eight times
 * slower than the runner's: five times what CI reads and three times what a
 * loaded container does. It is a backstop rather than the measurement. What a
 * gate has to catch is the change that made drawing several times more
 * expensive, not the one that cost a millisecond, and a ceiling that fails on
 * whose hardware ran it is a ceiling that gets raised rather than believed.
 * The room above the reading is Part C's, whose zones are three times the size
 * and fuller, and it should not have to re-decide this to spend it.
 *
 * It was 40ms while the game was 3D, and decision 110 brought it down when the
 * 3D view went. Raising it is a decision about the game, not about the run that
 * hit it.
 */
const SLOW_DRAW_BUDGET_MS = 16;

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
 * The view draws on the render loop rather than on our steps, and makes some
 * of its canvases only when a frame first asks for them — so anything about to
 * read a screen coordinate or a canvas count waits for a drawn frame rather
 * than for wall-clock time.
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

/**
 * Switches the spirit's tips off for the character just made, through the same
 * ask the card's No more tips sends. A tip waits for a tap, so one left up by
 * a section that is not about tips would sit over whatever the next one taps;
 * the tips section switches them back on for itself.
 */
const quietTips = () => page.evaluate(() => window.events.emit('tips-set-requested', false));

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
 * Stands the player some tiles north of something, parked as \`park\` does: in
 * a zone twice the old size, what a check taps is often off the screen from the
 * start, and a tap has to land on something drawn.
 *
 * @param {string} what
 * @param {number} [tiles]
 */
const parkNorthOf = async (what, tiles = 4) => {
  await page.evaluate(`(() => {
    const w = window.world;
    const at = ${what};
    w.clearTarget();
    w.player.stopMoving();
    w.teleport(at.x, at.y - ${tiles} * 64);
  })()`);
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
const canvases = () => page.evaluate(() => window.view.canvases());
const tabBarTop = () =>
  page.evaluate(() =>
    Math.round(
      /** @type {HTMLElement} */ (document.querySelector('.hud-tabs')).getBoundingClientRect().top,
    ),
  );

/**
 * The player column's height with the training bar's taken back off.
 *
 * That bar comes up with any skill's XP and goes on a half-minute clock of the
 * HUD's own, which the hand crank does not turn — so a check comparing the
 * column across a stretch of play would otherwise pass or fail on how long
 * the run took to get there. What those checks are about is the rest of it.
 */
const columnHeightBesideTraining = () =>
  page.evaluate(() => {
    const column = /** @type {HTMLElement} */ (document.querySelector('.hud-player'));
    const training = document.querySelector('.hud-player__training');
    const bar =
      training && !training.classList.contains('hud-hidden')
        ? training.getBoundingClientRect().height
        : 0;
    return Math.round(column.getBoundingClientRect().height - bar);
  });

/** What the bottom bar itself holds; everything else is behind the Menu tab. */
const BAR_TABS = ['character', 'inventory', 'quests', 'idle', 'menu'];
/** How many the Menu opens: Map, Feats, Skills, Combat Log, Options. */
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

/** Idle on, the way a thumb does it: the tab opens the panel, and its button starts it. */
const startIdle = async () => {
  await tapTab('idle');
  await page.click('.hud-sheet[data-sheet="idle"] [data-action="start-idle"]');
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
    secrets: window.world.secrets.length,
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
    `every mob, node, npc, signpost, building and secret in the ${zone} is drawn`,
    drawn.ground === 1 &&
      drawn.mobs === spawn.mobs &&
      drawn.nodes === spawn.nodes &&
      drawn.npcs === spawn.npcs &&
      drawn.signposts === spawn.signposts &&
      drawn.buildings === spawn.buildings &&
      drawn.secrets === spawn.secrets,
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
 * The view makes some canvases the first time a frame asks for them — a
 * shadow of a width it has not cut yet, a word while it is on screen — so the
 * count moves with what the camera is looking at. Comparing two snapshots taken
 * from wherever the player happened to be standing would therefore move with a
 * rat wandering into frame. Sweeping first, and parking in the same spot after,
 * makes both snapshots the same view of the zone instead.
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
// The shopfront the shopkeeper works out of, which is what a player aims at
// from outside: the counter is behind a wall with a roof drawn over it.
const GENERAL_STORE = "window.world.buildings.find((b) => b.definition.id === 'general-store')";
const FORGE = "window.world.stations.find((s) => s.station === 'forge')";
const BENCH = "window.world.stations.find((s) => s.station === 'bench')";
const STILL = "window.world.stations.find((s) => s.station === 'still')";
const SOUTH_SIGNPOST = "window.world.signposts.find((s) => s.exit.edge === 'south')";

/**
 * Each gathering skill's first tool, and the name the HUD gives the skill.
 *
 * @type {Record<'woodcutting' | 'fishing' | 'mining', {
 *   tool: import('../src/types/ids').ItemId;
 *   name: string;
 * }>}
 */
const GATHERING = {
  woodcutting: { tool: 'felling-axe', name: 'Woodcutting' },
  fishing: { tool: 'fishing-pole', name: 'Fishing' },
  mining: { tool: 'pickaxe', name: 'Mining' },
};
const PILE = 'window.world.lootPiles[0]';

/**
 * Stands the player a little south of one of those, with nothing selected.
 *
 * How far back is a parameter because a building has two meanings for the same
 * tap: within a tile of its doorstep it is a step inside, and further out it is
 * a walk to whoever works there. A tap meant as the second has to be aimed from
 * outside the first.
 *
 * @param {string} what
 * @param {number} [back]
 */
const standSouthOf = async (what, back = 150) => {
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
    window.world.teleport(at.x, at.y + ${back});
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
 * The conversation a tap on a person opens, and the one button on it that goes
 * on to the counter they work — pressed for real, the way a player asks.
 *
 * Answers whom the conversation was with, since which person a ray reached is
 * the point of every section that calls this with three others standing close.
 *
 * @param {import('../src/data/npcs').NpcRoleId} role
 * @param {string} who
 * @returns {Promise<string | null>}
 */
const talkThenOpen = async (role, who) => {
  await stepUntil(
    () => page.evaluate(() => window.world.counterNpc('talk') !== null),
    `the tapped ${who} to talk`,
  );
  const talkedTo = await page.evaluate(() => window.world.counterNpc('talk')?.npcId ?? null);
  await page.click(`.hud-modal__box--talk .hud-talk__service[data-counter="${role}"]`);
  await stepUntil(
    () => page.evaluate((counter) => window.world.counterNpc(counter) !== null, role),
    `the ${who}'s counter to open from the conversation`,
  );
  return talkedTo;
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

async function boot() {
  // --- Booting: a fresh character through the real creation screen, which is
  // plain HTML — so this is the form a player fills in, typed and clicked. ---
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  // Either branch of the boot flow will do — a previous run leaves a save
  // behind, and what is wanted is only that the page is up before it is
  // cleared. Generous: on a cold Vite cache the first request compiles the
  // whole game, which takes far longer than any later wait in this script.
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
  // A look chosen on the screen (decision 107), drawn on every class's card in
  // the world's own art: the cards' pictures are canvases the browser fills,
  // which jsdom cannot, so only a browser shows the choice redraw them.
  const cardsBefore = await page.evaluate(() =>
    [...document.querySelectorAll('.create__card canvas')].map((canvas) =>
      /** @type {HTMLCanvasElement} */ (canvas).toDataURL(),
    ),
  );
  await page.click('.create__choice[data-look="hairstyle"][data-value="bearded"]');
  await page.click('.create__choice[data-look="hair"][data-value="black"]');
  const cardsAfter = await page.evaluate(() =>
    [...document.querySelectorAll('.create__card canvas')].map((canvas) =>
      /** @type {HTMLCanvasElement} */ (canvas).toDataURL(),
    ),
  );
  check(
    'the creation screen pictures every class in the look chosen, and draws them again',
    cardsBefore.length === 3 &&
      new Set(cardsBefore).size === 3 &&
      cardsAfter.every((after, index) => after !== cardsBefore[index]),
    `${cardsBefore.length} pictures`,
  );
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
  const look = await page.evaluate(() => window.world.character.state.look);
  check(
    'and makes the character in the look chosen',
    look.hairstyle === 'bearded' && look.hair === 'black' && look.skin === 'fair',
    JSON.stringify(look),
  );

  // Version 2's pixel art, drawn at art resolution into a canvas the page
  // scales up by a whole number of device pixels (decision 101), so every art
  // pixel is the same square on screen. The camera's arithmetic is unit-tested;
  // what the page does with the canvas only a browser shows.
  const canvas = await page.evaluate(() => {
    const drawn = /** @type {HTMLCanvasElement} */ (document.querySelector('#app > canvas'));
    return {
      width: drawn.width,
      cssWidth: Number.parseFloat(drawn.style.width),
      rendering: drawn.style.imageRendering,
      dpr: window.devicePixelRatio,
      viewport: window.innerWidth,
    };
  });
  const scale = (canvas.cssWidth * canvas.dpr) / canvas.width;
  check(
    'the world is drawn at art resolution, scaled up by a whole number of device pixels',
    canvas.rendering === 'pixelated' &&
      Math.abs(scale - Math.round(scale)) < 1e-6 &&
      canvas.cssWidth >= canvas.viewport,
    `${canvas.width} art pixels across at ${scale} device pixels each, ${canvas.cssWidth}px wide`,
  );

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
  await quietTips();
}

async function teardown() {
  // --- The view's own teardown, which is the thing here with no other cover at
  // all. A zone change is a view rebuild, so everything the last zone drew has
  // to be let go by hand: a canvas nobody let go is invisible to every state
  // assertion and to the screen, and is memory the page never gets back. Run
  // before anything fights, so no floating number is mid-flight in either
  // count. ---
  await sweep();
  const before = { drawn: await drawnCounts(), canvases: await canvases() };
  check(
    'the zone bakes its ground once',
    before.drawn.ground === 1,
    `${before.drawn.total} objects, ${before.canvases} canvases`,
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
  const after = { drawn: await drawnCounts(), canvases: await canvases() };
  check(
    'three zone round trips let go of every canvas they made',
    before.canvases === after.canvases,
    `${before.canvases} -> ${after.canvases} canvases`,
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
  await stepUntilZone('bandit-camp', 'the east exit to load Redrag Camp');
  await checkZoneDrawn('camp');
  await page.screenshot({ path: `${OUT}/4-bandit-camp.png` });
  await page.evaluate(() => {
    const w = window.world;
    w.teleport(33, w.worldHeight / 2);
  });
  await stepUntilZone('town', 'the west exit to return to town');
  // And the fourth, for the same reason one zone up but about props rather than
  // creatures: an ore vein is drawn nowhere else, and a sprite no browser ever
  // drew is a sprite whose only cover is the unit suite compiling it.
  await page.evaluate(() => {
    const w = window.world;
    w.teleport(w.worldWidth / 2, 33);
  });
  await stepUntilZone('quarry', 'the north exit to load the New Cut');
  await checkZoneDrawn('New Cut');
  await page.screenshot({ path: `${OUT}/5-quarry.png` });
  // Down the shaft, which is the New Cut's only way to the Deep Cut (decision
  // 121): the middle of the mouth through the face, and an arrival across the
  // Deep Cut's own at the shaft's foot, the door and the mark drawn down there.
  /** @param {string} to */
  const mouthMiddle = (to) =>
    page.evaluate((to) => {
      const w = window.world;
      const post = w.signposts.find((sign) => sign.exit.to === to);
      const [first, last] = post?.exit.mouth ?? [0, 0];
      return ((first + last + 1) / 2) * (w.worldWidth / (w.zone.map[0]?.length ?? 1));
    }, to);
  const shaft = await mouthMiddle('deep-cut');
  await page.evaluate((x) => window.world.teleport(x, 33), shaft);
  await stepUntilZone('deep-cut', 'the walk down the shaft into the Deep Cut');
  const foot = await page.evaluate(() => {
    const w = window.world;
    const exit = w.zone.exits.find((each) => each.to === 'quarry');
    const [first, last] = exit?.mouth ?? [0, -1];
    return { column: w.player.x / (w.worldWidth / (w.zone.map[0]?.length ?? 1)), first, last };
  });
  check(
    "and comes down at the shaft's foot, across the Deep Cut's mouth",
    foot.column > foot.first && foot.column < foot.last + 1,
    `column ${foot.column.toFixed(2)} of ${foot.first}-${foot.last}`,
  );
  await checkZoneDrawn('Deep Cut');
  await page.screenshot({ path: `${OUT}/5b-deep-cut.png` });
  const up = await mouthMiddle('quarry');
  await page.evaluate((x) => window.world.teleport(x, window.world.worldHeight - 33), up);
  await stepUntilZone('quarry', 'the walk back up the shaft');
  await page.evaluate(() => {
    const w = window.world;
    w.teleport(w.worldWidth / 2, w.worldHeight - 33);
  });
  await stepUntilZone('town', 'the south exit to return to town');
  // And the fen, two south, for the lantern still burning on its holm: the
  // first secret standing up that loops, as a station's fire does, which
  // nothing but a browser draws.
  /**
   * @param {'north' | 'south'} edge
   * @param {string} zone
   * @param {string} label
   */
  const walkOff = async (edge, zone, label) => {
    await page.evaluate((edge) => {
      const w = window.world;
      w.teleport(w.worldWidth / 2, edge === 'north' ? 33 : w.worldHeight - 33);
    }, edge);
    await stepUntilZone(zone, label);
  };
  await walkOff('south', 'beach', 'the south exit to load the strand');
  await walkOff('south', 'blackwater-fen', 'the strand road south to load the fen');
  await checkZoneDrawn('fen');
  await page.screenshot({ path: `${OUT}/5c-fen.png` });
  await walkOff('north', 'beach', 'the north exit back to the strand');
  await walkOff('north', 'town', 'the north exit back to town');
  check(
    'zone travel round-trips Lampton -> the strand -> Lampton -> Redrag Camp -> Lampton -> the New Cut -> the Deep Cut -> the New Cut -> Lampton -> the strand -> the fen -> the strand -> Lampton',
    true,
  );
}

async function walkCycle() {
  // --- The figure's legs: walking strides and standing still puts the figure
  // back to breathing, whichever of its two idle frames the wall clock is on.
  // The walk belongs to whatever is drawing rather than to the simulation, so
  // it is the view that is asked. ---
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
    standing.walking === false && standing.pose.startsWith('idle'),
    standing.pose,
  );
}

async function tabBar() {
  // --- Nothing in the world may be drawn under the tab bar. The bar is opaque
  // and swallows every tap that lands on it, and the signpost is how a zone is
  // left on a phone — the edge-walk band is untappably thin under a thumb. A
  // perspective camera cannot shrink its viewport to make room, so the rule is
  // held by how the camera is framed, and this is the measurement of it. ---
  // Measured where the camera is pinned hardest against the map's foot: on the
  // strip a traveller arrives on from the strand, below which there is nothing.
  await park();
  await page.evaluate(() => {
    const w = window.world;
    const post = w.signposts.find((s) => s.exit.edge === 'south');
    if (!post) throw new Error('town has no south signpost');
    w.teleport(post.x, w.worldHeight - 96);
  });
  await step(2);
  await draw();
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

async function hudArt() {
  // --- The HUD's look (B8, decision 111): its frames and icons are pixel art
  // compiled at boot and handed to the page as images, and its headings are set
  // in the world's own font, written as a font file in memory. None of it is a
  // file loaded, and a page that refused any of it would fall back without a
  // word to plain borders and the system font, which only a browser can see.
  await park();
  const art = await page.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts].filter(
      (face) => face.family.replaceAll('"', '') === 'World Pixel',
    );
    const label = document.querySelector('.hud-tabs__label');
    const icon = document.querySelector('.hud-tabs__tab .hud-icon');
    const bar = document.querySelector('.hud-tabs');
    const hud = document.querySelector('.hud');
    const box = icon?.getBoundingClientRect();
    // Measured in the font alone: its glyphs' own widths, a pixel apart, add up
    // to 35 for "Quests" at one pixel to the CSS pixel, which no system font
    // standing in for it would.
    const context = document.createElement('canvas').getContext('2d');
    if (context) context.font = "16px 'World Pixel'";
    return {
      faces: faces.map((face) => face.status),
      quests: context ? context.measureText('Quests').width : 0,
      labelFont: label ? getComputedStyle(label).fontFamily : '',
      frame: bar ? getComputedStyle(bar).borderImageSource : '',
      sheet: icon ? getComputedStyle(icon).backgroundImage : '',
      iconBox: box ? [box.width, box.height] : [],
      pixelated: hud ? getComputedStyle(hud).imageRendering : '',
    };
  });
  check(
    "the world's font is written into the page and loads, and draws its own glyphs",
    art.faces.includes('loaded') && art.quests === 35,
    `${art.faces.join(', ')}; "Quests" ${art.quests}px wide`,
  );
  check('a tab is labelled in it', art.labelFont.includes('World Pixel'), art.labelFont);
  check(
    'the tab bar wears its iron frame, drawn as an image',
    art.frame.startsWith('url("data:image/png'),
    art.frame.slice(0, 40),
  );
  check(
    "a tab's picture comes off the sheet of icons at one CSS pixel to the art pixel",
    art.sheet.startsWith('url("data:image/png') && art.iconBox.join('x') === '16x16',
    `${art.sheet.slice(0, 30)}, ${art.iconBox.join('x')}`,
  );
  check('and every picture is scaled nearest-neighbour', art.pixelated === 'pixelated');
}

async function landscape() {
  // --- A resize, which has to move two things that can be forgotten
  // separately: the drawing buffer and the camera's window. A buffer that
  // never resized would still draw, stretched, and every assertion in this file
  // that reads a screen coordinate would still pass.
  //
  // Landscape on purpose. `layout.ts` keys its breakpoint on height as well as
  // width because a landscape phone is wide by any measure and has less
  // vertical room than a portrait one. The camera frames its ten tiles across
  // the smaller side, which in landscape is the height, so the south signpost
  // is far further down the screen from the spawn point than on a portrait
  // phone. What has to hold is that walking toward it brings it into reach,
  // which is measured below. ---
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
      // What the canvas is actually drawn at, in art pixels, which is the half
      // of a resize that has no visible failure mode.
      bufferW: canvas.width,
      bufferH: canvas.height,
      dpr: window.devicePixelRatio,
      innerH: window.innerHeight,
      appH: /** @type {HTMLElement} */ (document.getElementById('app')).clientHeight,
      hudMounted: document.querySelector('.hud') !== null,
      post: { x: post.x, y: post.y },
    };
  });
  // The buffer is in art pixels, a whole number of device pixels each, and
  // covers the screen: turned on its side, it is wider than it is tall.
  const landscapeScale = (landscape.cssW * landscape.dpr) / landscape.bufferW;
  check(
    'a landscape resize retargets the canvas and its drawing buffer',
    landscape.cssW >= 844 &&
      landscape.bufferW > landscape.bufferH &&
      Math.abs(landscapeScale - Math.round(landscapeScale)) < 1e-6 &&
      Math.abs((landscape.cssH * landscape.dpr) / landscape.bufferH - landscapeScale) < 1e-6,
    `${landscape.cssW}x${landscape.cssH} css, ${landscape.bufferW}x${landscape.bufferH} art ` +
      `pixels at ${landscapeScale} device pixels each`,
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
  // tests/render2d/picking.test.ts. What only a browser shows is the wiring
  // either side of it: a real PointerEvent landing on the canvas, in page
  // coordinates, against a camera the render loop has already moved this
  // frame. ---

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

  // And from a drop to what the drop is for. The row that was held is inside
  // the card that the new one replaces, so the release lands on a page it has
  // left — which is where the new card's scrim could hear it as a tap outside
  // and shut before it was read.
  const meatRow = await page.evaluate(() => {
    const box = /** @type {HTMLElement} */ (
      document.querySelector('.hud-inspect__drop[data-item="rat-meat"]')
    ).getBoundingClientRect();
    return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  });
  await touch('touchStart', [meatRow]);
  await page.waitForTimeout(700);
  await touch('touchEnd', []);
  await draw();
  const meatCard = await page.evaluate(() => ({
    cards: document.querySelectorAll('.hud-modal__box--inspect').length,
    title: document.querySelector('.hud-modal__box--inspect .hud-modal__title')?.textContent,
  }));
  check(
    "a finger held on a drop opens that item's card in place of the drop list, and it stays",
    meatCard.cards === 1 && meatCard.title === 'Rat Meat',
    `${meatCard.cards} cards, showing ${meatCard.title}`,
  );
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

  // How a shop is actually reached now that the shopkeeper is behind a wall:
  // there is no pixel a thumb can put on them from outside, so what a player
  // aims at is the shopfront — and what has to happen is the whole of phases 3
  // to 5 at once, a route round the corner and in through the door, ending
  // *inside the room* rather than in the street outside it. Stood well back, so
  // the tap is a walk rather than the doorstep's second meaning.
  await standSouthOf(GENERAL_STORE, 320);
  await clickAt(await screenAt(GENERAL_STORE));
  await stepUntil(
    () => page.evaluate(() => window.world.counterNpc('talk')?.npcId === 'shopkeeper'),
    'the tapped shopfront to walk the player in and talk to the shopkeeper',
  );
  /** @type {{ x: number; y: number; store: { x: number; y: number; width: number; height: number } }} */
  const served = await page.evaluate(`(() => {
    const store = ${GENERAL_STORE};
    const p = window.world.player;
    return {
      x: p.x,
      y: p.y,
      store: { x: store.x, y: store.y, ...store.definition.body },
    };
  })()`);
  check(
    'a real click on a shopfront walks in through its door and talks to the keeper inside',
    Math.abs(served.x - served.store.x) < served.store.width / 2 &&
      Math.abs(served.y - served.store.y) < served.store.height / 2,
    `served at ${Math.round(served.x)},${Math.round(served.y)} for a shop at ${served.store.x},${served.store.y}`,
  );

  // And the shopkeeper themselves, from inside the room: the case the pick boxes
  // exist for, since a ray at a figure's real geometry goes straight down the
  // gap between its legs and out the other side.
  await standSouthOf(SHOPKEEPER);
  await clickAt(await screenAt(SHOPKEEPER));
  await stepUntil(
    () => page.evaluate(() => window.world.counterNpc('talk')?.npcId === 'shopkeeper'),
    'the tapped shopkeeper to talk',
  );
  // Talk first: a tap on a person opens a conversation with them — their
  // greeting, the counter they work as a button saying what it is for, and the
  // work they have going — rather than their counter.
  const talk = await page.evaluate(() => {
    const box = document.querySelector('.hud-modal__box--talk');
    const rect = box?.getBoundingClientRect();
    const bar = document.querySelector('.hud-tabs')?.getBoundingClientRect();
    return {
      title: box?.querySelector('.hud-modal__title')?.textContent ?? '',
      greeting: box?.querySelector('.hud-talk__greeting')?.textContent ?? '',
      services: [...(box?.querySelectorAll('.hud-talk__service') ?? [])].map(
        (b) => /** @type {HTMLElement} */ (b).dataset.counter ?? '',
      ),
      quests: box?.querySelectorAll('[data-quest]').length ?? 0,
      shop: window.world.counterNpc('merchant') !== null,
      clear:
        rect && bar ? rect.bottom <= bar.top && rect.left >= 0 && rect.right <= innerWidth : false,
    };
  });
  check(
    'a real click on the shopkeeper talks first: a greeting, the Shop button and their work, clear of the tab bar',
    talk.title === 'Shopkeeper' &&
      /^\u201c.+\u201d$/.test(talk.greeting) &&
      talk.services.length === 1 &&
      talk.services[0] === 'merchant' &&
      talk.quests > 0 &&
      !talk.shop &&
      talk.clear,
    JSON.stringify(talk),
  );
  await page.screenshot({ path: `${OUT}/8-talk.png` });

  // The conversation is a DOM panel, so this is the row the player actually taps
  // rather than the event behind it. The quest rules themselves are covered in
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
    lockedQuest.drawn &&
      lockedQuest.locked &&
      lockedQuest.says.includes('Needs Bones for the Broth') &&
      !lockedQuest.taken,
    lockedQuest.says,
  );
  // A quest row deliberately has no icon, since a quest is not an item.
  const questIcons = await page.evaluate(
    () => document.querySelectorAll('.hud-modal__box--talk [data-quest] .hud-icon').length,
  );

  // On from the conversation to the counter, by its button, and the work stays
  // behind in the conversation it belongs to.
  await page.click('.hud-modal__box--talk .hud-talk__service[data-counter="merchant"]');
  await stepUntil(
    () => page.evaluate(() => window.world.counterNpc('merchant') !== null),
    'the Shop button to open the shop',
  );
  // The shop's stock and its sell list get the bag's icons.
  const shopIcons = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.hud-modal .hud-list-row')];
    return {
      items: rows.filter((r) => /** @type {HTMLElement} */ (r).dataset.item).length,
      withIcon: rows.filter((r) => r.querySelector('.hud-icon')).length,
      quests: rows.filter((r) => /** @type {HTMLElement} */ (r).dataset.quest).length,
      talking: document.querySelector('.hud-modal__box--talk') !== null,
    };
  });
  check(
    'Shop opens the shop in place of the conversation, an icon on every item row and no quests',
    shopIcons.items > 0 &&
      shopIcons.withIcon === shopIcons.items &&
      shopIcons.quests === 0 &&
      !shopIcons.talking &&
      questIcons === 0,
    `${shopIcons.withIcon}/${shopIcons.items} item rows, ${shopIcons.quests} quest rows, ${questIcons} quest icons`,
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

  // The stock and the bag are two sides, and which way they stand is a
  // question about real pixels: one over the other on this phone with both in
  // view at once — the point of splitting them, since the bag used to be below
  // the whole shelf — and across once it is turned on its side. The bag gets a
  // stack back so its side has a row to find.
  await page.evaluate(() => {
    const w = window.world;
    w.character.state.inventory = { ...w.character.state.inventory, 'rat-bones': 4 };
    window.events.emit('inventory-changed', w.character.state.inventory);
  });
  const shopSides = () =>
    page.evaluate(() => {
      /** @param {string} selector */
      const rect = (selector) => {
        const box = document.querySelector(selector)?.getBoundingClientRect();
        return box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom } : null;
      };
      return {
        theirs: rect('.hud-modal__box--shop .hud-side[data-side="theirs"]'),
        yours: rect('.hud-modal__box--shop .hud-side[data-side="yours"]'),
        stock: rect('.hud-modal__box--shop .hud-side[data-side="theirs"] [data-item]'),
        bag: rect('.hud-modal__box--shop .hud-side[data-side="yours"] [data-item="rat-bones"]'),
        box: rect('.hud-modal__box--shop'),
        tabBar: rect('.hud-tabs'),
        width: window.innerWidth,
        height: window.innerHeight,
      };
    });
  const stacked = await shopSides();
  check(
    "the shop's stock and bag stand one over the other on a portrait phone, both in view",
    stacked.theirs !== null &&
      stacked.yours !== null &&
      stacked.stock !== null &&
      stacked.bag !== null &&
      stacked.theirs.bottom <= stacked.yours.top &&
      Math.abs(stacked.theirs.left - stacked.yours.left) < 1 &&
      stacked.stock.bottom <= stacked.theirs.bottom &&
      stacked.bag.bottom <= stacked.yours.bottom &&
      stacked.box !== null &&
      stacked.tabBar !== null &&
      stacked.box.bottom <= stacked.tabBar.top,
    JSON.stringify({ theirs: stacked.theirs, yours: stacked.yours, bag: stacked.bag }),
  );
  await page.screenshot({ path: `${OUT}/8-shop.png` });

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(
    () => document.querySelector('.hud-sides.is-side-by-side') !== null,
    undefined,
    { timeout: 5000 },
  );
  await step(2);
  const across = await shopSides();
  check(
    "a phone turned on its side stands the shop's two sides across it, clear of the tab bar",
    across.theirs !== null &&
      across.yours !== null &&
      across.box !== null &&
      across.bag !== null &&
      across.tabBar !== null &&
      across.theirs.right <= across.yours.left &&
      Math.abs(across.theirs.top - across.yours.top) < 1 &&
      across.box.left >= 0 &&
      across.box.right <= across.width &&
      across.box.bottom <= across.tabBar.top &&
      across.bag.bottom <= across.yours.bottom,
    JSON.stringify({ theirs: across.theirs, yours: across.yours, box: across.box }),
  );
  await page.screenshot({ path: `${OUT}/8b-shop-landscape.png` });
  await page.setViewportSize({ ...PHONE });
  await page.waitForFunction(
    () => document.querySelector('.hud-sides:not(.is-side-by-side)') !== null,
    undefined,
    { timeout: 5000 },
  );
  await step(2);

  // A finger held on a row asks what the thing is for rather than buying it —
  // which is a clock and a release, so only a real touch can say the release
  // was swallowed. Logs, because a tap on them would buy some.
  const logsRow = await page.evaluate(() => {
    const box = /** @type {HTMLElement} */ (
      document.querySelector('.hud-modal__box--shop .hud-list-row[data-item="logs"]')
    ).getBoundingClientRect();
    return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  });
  const before = await page.evaluate(() => ({
    logs: window.world.character.state.inventory.logs ?? 0,
    currency: window.world.character.state.currency,
  }));
  await touch('touchStart', [logsRow]);
  await page.waitForTimeout(700);
  await touch('touchEnd', []);
  await step(2);
  const asked = await page.evaluate(() => ({
    title: document.querySelector('.hud-modal__box--inspect .hud-modal__title')?.textContent,
    uses: [...document.querySelectorAll('.hud-modal__box--inspect .hud-item-uses__line')].map(
      (line) => line.textContent ?? '',
    ),
    logs: window.world.character.state.inventory.logs ?? 0,
    currency: window.world.character.state.currency,
  }));
  check(
    'a finger held on a shop row opens what the item is for, and buys nothing',
    asked.title === 'Logs' &&
      asked.uses.includes('Lights a campfire, one a fire') &&
      asked.logs === before.logs &&
      asked.currency === before.currency,
    `${asked.title}: ${asked.uses.length} uses, logs ${before.logs} -> ${asked.logs}`,
  );
  await page.screenshot({ path: `${OUT}/8a-shop-item-card.png` });
  await page.click('[data-action="close-inspect"]');

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

  // Back to the conversation from the shop's head, and on again from it: the
  // way back is the host's, so one panel standing for all of them is enough.
  await page.click('.hud-modal__box--shop [data-action="back-to-talk"]');
  await stepUntil(
    () => page.evaluate(() => window.world.counterNpc('talk')?.npcId === 'shopkeeper'),
    'Back to return to the conversation',
  );
  const backed = await page.evaluate(() => ({
    shop: window.world.counterNpc('merchant') !== null,
    panel: document.querySelector('.hud-modal__box--shop') !== null,
    talk: document.querySelector('.hud-modal__box--talk') !== null,
  }));
  check(
    "Back on the shop's head goes back to talking to the shopkeeper",
    !backed.shop && !backed.panel && backed.talk,
    JSON.stringify(backed),
  );
  await page.click('.hud-modal__box--talk .hud-talk__service[data-counter="merchant"]');
  await stepUntil(
    () => page.evaluate(() => window.world.counterNpc('merchant') !== null),
    'the Shop button to open the shop again',
  );

  // Closing from the panel's own X, which asks the world rather than telling it.
  await page.click('.hud-modal [data-action="close-shop"]');
  await stepUntil(
    () => page.evaluate(() => window.world.counterNpc('merchant') === null),
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

async function lootPiles() {
  // --- Loot piles: what a kill leaves on the ground when the pack is full.
  //
  // The rules — exactly what a pile holds, its minute, taking what fits, a
  // death leaving it and a zone change dropping it — are
  // tests/world/lootPiles.test.ts. What only a browser shows is the sack, and
  // it is the one thing drawn that comes and goes mid-zone in numbers: built on
  // the frame a pile appears and handed back on the frame it goes, with no zone
  // change to sweep it up, which is a teardown the round trips above never
  // exercise. Then the two presses on it, through a real camera. The 2D view
  // draws a sack off the sheet it draws everything else from, so it holds
  // nothing of its own: what is checked is that it leaves nothing behind. ---
  await page.evaluate(() => window.world.mobs.forEach((m) => m.disengage()));
  // Every canvas town asks for made before the first reading, so the camera
  // walking a few steps to the sack cannot bring anything new into it.
  await sweep();
  // The floats a fight leaves are text on a canvas, faded on the view's wall
  // clock rather than the game's, so a reading waits them out.
  const settled = async () => {
    for (let wait = 0; wait < 40 && (await drawnCounts()).fx > 0; wait += 1) {
      await page.waitForTimeout(100);
    }
    await draw();
    return canvases();
  };
  const before = await settled();
  const bag = await page.evaluate(() => ({ ...window.world.character.state.inventory }));

  // A full pack and a rat on the spawn point, killed through the funnel both
  // kill paths end in until one of them drops something — the dice are the
  // page's own, and a rat carries nothing one time in five.
  const dropped = await page.evaluate(() => {
    const w = window.world;
    const c = w.character;
    c.addItem('crab-meat', Math.max(0, Math.floor(c.carryCapacity() - c.carriedWeight())));
    for (const rat of w.mobs.filter((m) => m.isAlive() && m.definition.id === 'rat')) {
      if (w.lootPiles.length > 0) break;
      rat.setPosition(w.spawnPoint.x, w.spawnPoint.y);
      rat.takeDamage(rat.maxHp);
      w.resolveKill(rat);
    }
    return w.lootPiles.flatMap((pile) => pile.contents().map((drop) => drop.itemId));
  });
  await step(2);
  const during = await settled();
  const shown = await drawnCounts();
  check(
    'a kill the pack cannot hold leaves one sack where it fell',
    dropped.length > 0 && shown.piles === 1,
    `holding ${dropped.join(', ')}; ${shown.piles} drawn, ${before} -> ${during} canvases`,
  );
  await standSouthOf(PILE);
  await page.screenshot({ path: `${OUT}/8b-loot-pile.png` });

  // Asked about, it says Take; the card behind Inspect is what is in it.
  const sack = await screenAt(PILE);
  await page.mouse.move(sack.x, sack.y);
  await page.mouse.click(sack.x, sack.y, { button: 'right' });
  await draw();
  const menu = await page.evaluate(() =>
    [...document.querySelectorAll('.hud-context__row')].map((n) => n.textContent),
  );
  await page.click('.hud-context__row[data-context-action="Inspect"]');
  const listed = await page.evaluate(() =>
    [...document.querySelectorAll('.hud-inspect__held')].map(
      (row) => /** @type {HTMLElement} */ (row).dataset.item ?? '',
    ),
  );
  check(
    'a right click on the sack offers Take, and Inspect lists what is in it',
    menu.join(',') === 'Take,Inspect' && listed.join(',') === dropped.join(','),
    `${menu.join(' | ')}; listed ${listed.join(', ')}`,
  );
  await page.click('[data-action="close-inspect"]');

  // Room made, and a plain tap on it: the walk over and everything in it taken.
  const held = await page.evaluate(() => {
    const c = window.world.character;
    c.removeItem('crab-meat', c.itemCount('crab-meat'));
    window.events.emit('inventory-changed', c.state.inventory);
    return { ...c.state.inventory };
  });
  await clickAt(await screenAt(PILE));
  await stepUntil(
    () => page.evaluate(() => window.world.lootPiles.length === 0),
    'the tapped sack to be walked to and taken up',
  );
  // Counted against the bag before the tap rather than read as "any", since a
  // pile that lapsed would empty the list just the same.
  const carried = await page.evaluate(
    ({ items, was }) =>
      items.every(
        (itemId) =>
          (window.world.character.state.inventory[itemId] ?? 0) >
          (was[/** @type {keyof typeof was} */ (itemId)] ?? 0),
      ),
    { items: dropped, was: held },
  );
  await step(2);
  const after = await settled();
  // At most where it was rather than exactly: a word is kept while it is
  // drawn, and the rat that died for the sack takes its name with it until it
  // is back.
  check(
    'a tap takes the sack up, and nothing it was drawn with is left behind',
    carried && (await drawnCounts()).piles === 0 && after <= before,
    `carried: ${carried}, ${before} -> ${after} canvases`,
  );

  // The bag as the sections after this one expect to find it.
  await page.evaluate((inventory) => {
    window.world.character.state.inventory = inventory;
    window.events.emit('inventory-changed', inventory);
  }, bag);
  await park();
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
  const bankTalk = await talkThenOpen('banker', 'banker');
  const opened = await page.evaluate(() => ({
    bank: window.world.counterNpc('banker')?.npcId ?? null,
    shop: window.world.counterNpc('merchant')?.npcId ?? null,
    panel: document.querySelector('.hud-modal__box--bank') !== null,
  }));
  check(
    'a click on the banker talks to the banker, whose Bank opens the bank and not the shop beside it',
    bankTalk === 'banker' && opened.bank === 'banker' && opened.shop === null && opened.panel,
    `talked to: ${bankTalk}, bank: ${opened.bank}, shop: ${opened.shop}`,
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
    stored.deposits === 0 && stored.withdraws === 1 && stored.slots === '1 / 8 slots',
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
    () => page.evaluate(() => window.world.counterNpc('banker') === null),
    'the bank panel to close the counter',
  );
  check(
    'the bank panel closes the counter it was opened by',
    (await page.evaluate(() => document.querySelector('.hud-modal__box--bank') === null)) === true,
  );

  // The other way to a counter, for somebody visited every trip: a right click
  // on the person offers Talk and their counter, and the counter goes straight
  // there with no conversation on the way — the same walk a tap makes, ending
  // at a different panel.
  await standSouthOf(BANKER);
  const teller = await screenAt(BANKER);
  await page.mouse.move(teller.x, teller.y);
  await page.mouse.click(teller.x, teller.y, { button: 'right' });
  await draw();
  const menu = await page.evaluate(() =>
    [...document.querySelectorAll('.hud-context__row')].map((n) => n.textContent),
  );
  await page.click('.hud-context__row[data-context-action="Bank"]');
  await stepUntil(
    () => page.evaluate(() => window.world.counterNpc('banker') !== null),
    "the menu's Bank to open the bank",
  );
  const straight = await page.evaluate(() => ({
    talked:
      window.world.counterNpc('talk') !== null ||
      document.querySelector('.hud-modal__box--talk') !== null,
    bank: document.querySelector('.hud-modal__box--bank') !== null,
  }));
  check(
    'a right click on the banker offers Talk and Bank, and Bank opens the bank with no conversation first',
    JSON.stringify(menu) === JSON.stringify(['Talk', 'Bank', 'Inspect']) &&
      straight.bank &&
      !straight.talked,
    `${menu.join(', ')}; ${JSON.stringify(straight)}`,
  );
  await page.click('.hud-modal [data-action="close-bank"]');
  await stepUntil(
    () => page.evaluate(() => window.world.counterNpc('banker') === null),
    'the bank panel to close the counter',
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
  const trainerTalk = await talkThenOpen('trainer', 'trainer');
  const opened = await page.evaluate(() => ({
    trainer: window.world.counterNpc('trainer')?.npcId ?? null,
    shop: window.world.counterNpc('merchant')?.npcId ?? null,
    bank: window.world.counterNpc('banker')?.npcId ?? null,
    panel: document.querySelector('.hud-modal__box--trainer') !== null,
  }));
  check(
    'a click on the trainer talks to the trainer, whose Train opens the trainer and neither counter beside it',
    trainerTalk === 'trainer' &&
      opened.trainer === 'trainer' &&
      opened.shop === null &&
      opened.bank === null &&
      opened.panel,
    `talked to: ${trainerTalk}, trainer: ${opened.trainer}, shop: ${opened.shop}, bank: ${opened.bank}`,
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
  // panel redraws off the level-up rather than off the tap that caused it. At
  // the top level every gate a level holds is open, and what is still shut is a
  // second rank waiting on the rank below it, which says so instead.
  await page.evaluate(() => {
    const w = window.world;
    w.character.state.currency = 1000;
    window.events.emit('currency-changed', 1000);
    w.character.state.level = 8;
    window.events.emit('level-up', 8);
  });
  await step(2);
  const unlocked = await page.evaluate(() => {
    const locked = [...document.querySelectorAll('.hud-modal__box--trainer [data-locked]')];
    return {
      locked: locked.filter((r) =>
        /^Level /.test(r.querySelector('.hud-list-row__value')?.textContent ?? ''),
      ).length,
      rows: document.querySelectorAll('.hud-modal__box--trainer .hud-list-row[data-ability]')
        .length,
    };
  });
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
    `${unlocked.locked}/${unlocked.rows} rows still shut by a level at level 8`,
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
    () => page.evaluate(() => window.world.counterNpc('trainer') === null),
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
  const boardTalk = await talkThenOpen('quartermaster', 'quartermaster');
  const opened = await page.evaluate(() => ({
    board: window.world.counterNpc('quartermaster')?.npcId ?? null,
    shop: window.world.counterNpc('merchant')?.npcId ?? null,
    bank: window.world.counterNpc('banker')?.npcId ?? null,
    trainer: window.world.counterNpc('trainer')?.npcId ?? null,
    panel: document.querySelector('.hud-modal__box--bounty') !== null,
    // Every row carries what it asks for on the line under it.
    rows: document.querySelectorAll('.hud-modal__box--bounty .hud-list-row[data-bounty]').length,
    notes: document.querySelectorAll('.hud-modal__box--bounty .hud-list-row__note').length,
    locked: [...document.querySelectorAll('.hud-modal__box--bounty [data-locked]')].map(
      (r) => /** @type {HTMLElement} */ (r).dataset.locked ?? '',
    ),
  }));
  check(
    'a click on the quartermaster talks to them, whose Contracts opens the board and none of the three counters beside it',
    boardTalk === 'quartermaster' &&
      opened.board === 'quartermaster' &&
      opened.shop === null &&
      opened.bank === null &&
      opened.trainer === null &&
      opened.panel,
    `talked to: ${boardTalk}, board: ${opened.board}, shop: ${opened.shop}, bank: ${opened.bank}, trainer: ${opened.trainer}`,
  );
  // Ten contracts, each a row and a line, is the longest list any counter
  // draws — the one that ran down over the tab bar and took its taps.
  const boardClear = await page.evaluate(() => {
    const box = document.querySelector('.hud-modal__box--bounty')?.getBoundingClientRect();
    const bar = document.querySelector('.hud-tabs')?.getBoundingClientRect();
    return box && bar ? { bottom: box.bottom, bar: bar.top } : null;
  });
  check(
    'the longest counter stops above the tab bar and scrolls instead',
    boardClear !== null && boardClear.bottom <= boardClear.bar,
    JSON.stringify(boardClear),
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
    'taking a contract puts a line on the tracker and an Abandon button under it',
    taken.held === 'rat-cull' &&
      taken.tracked.length === trackedBefore + 1 &&
      taken.tracked.some((line) => line.includes('Rat Cull') && line.includes('0 / 15')) &&
      taken.drop === 1 &&
      !taken.heldIsButton,
    `held ${taken.held}, tracker: ${taken.tracked.join(' | ')}, abandon ${taken.drop}`,
  );
  await page.screenshot({ path: `${OUT}/10b-bounty.png` });

  // Abandon used to sit against the row that hands the work in, a thumb's
  // width from it. It is under the contract now, a clear gap down and not
  // beside the row at all — a question about where things are drawn, which is
  // the browser's.
  const apart = await page.evaluate(() => {
    const row = document
      .querySelector('.hud-modal__box--bounty .hud-list-row[data-bounty="rat-cull"]')
      ?.getBoundingClientRect();
    const button = document
      .querySelector('.hud-modal__box--bounty [data-abandon-bounty]')
      ?.getBoundingClientRect();
    return row && button ? { gap: button.top - row.bottom } : null;
  });
  check(
    'Abandon stands under the contract in hand, a clear gap below the row that hands it in',
    apart !== null && apart.gap >= 20,
    `gap ${apart?.gap.toFixed(1)}px`,
  );

  // It asks twice, by real taps: the first arms it and gives nothing back, the
  // second gives the contract up and takes its line off the tracker.
  await page.click('.hud-modal__box--bounty [data-abandon-bounty]');
  await step(2);
  const armed = await page.evaluate(() => ({
    held: window.world.character.state.bounty?.bountyId ?? null,
    says: document.querySelector('.hud-modal__box--bounty [data-abandon-bounty]')?.textContent,
  }));
  await page.click('.hud-modal__box--bounty [data-abandon-bounty]');
  await step(2);
  const givenBack = await page.evaluate(() => ({
    held: window.world.character.state.bounty,
    tracked: document.querySelectorAll('.hud-tracker__line').length,
    button: document.querySelector('.hud-modal__box--bounty [data-abandon-bounty]') !== null,
  }));
  check(
    'abandoning asks twice: one tap arms it, the second gives the contract back',
    armed.held === 'rat-cull' &&
      armed.says === 'Tap again to abandon' &&
      givenBack.held === null &&
      givenBack.tracked === trackedBefore &&
      !givenBack.button,
    `after one tap: ${armed.held}, "${armed.says}"; after two: ${JSON.stringify(givenBack.held)}`,
  );

  // Taken again, since the rest of this section hands it in.
  await page.click('.hud-modal__box--bounty .hud-list-row[data-bounty="rat-cull"]');
  await step(2);

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
    ready.tracked.some((line) => line.includes('15 / 15')) && ready.values.includes('Hand in'),
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
    () => page.evaluate(() => window.world.counterNpc('quartermaster') === null),
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
  const away = await page.evaluate(
    () => document.querySelector('.hud-modal__box--station') === null,
  );

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
    () => document.querySelector('.hud-modal__box--station') === null,
  );

  await draw();
  await clickAt(await screenAt(FORGE));
  await step(2);
  const opened = await page.evaluate(() => ({
    panel: document.querySelector('.hud-modal__box--station') !== null,
    rows: document.querySelectorAll('.hud-modal__box--station [data-recipe]').length,
    locked: document.querySelectorAll('.hud-modal__box--station [data-locked]').length,
  }));
  check(
    'a real click on the forge opens its list, where standing beside it does not',
    away && standing && opened.panel && opened.rows > 0,
    `${opened.rows} recipes, ${opened.locked} of them still shut`,
  );

  // A real tap on a real row, and the channel that follows it.
  await page.click('.hud-modal__box--station [data-recipe="tin-bar"]');
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
    (await page.evaluate(() => document.querySelector('.hud-modal__box--station') === null)) ===
      true,
  );

  // Put the bag back the way the sections after this one expect to find it.
  await page.evaluate(() => {
    window.world.character.state.inventory = {};
    window.events.emit('inventory-changed', {});
  });
  await step(2);
}

async function secrets() {
  // --- Secrets (decision 117): drawn where they lie and named nowhere, found by
  // walking up to one, said once on the card the tips are said on, and counted
  // under the zone map. The walk is a real tap on the ground by the stone, and
  // the card and the count are what only a browser shows. Started from nothing
  // found, since the town's crossroads are walked through by the sections
  // above. ---
  await park();
  const start = await page.evaluate(() => {
    window.world.character.state.secrets = [];
    return {
      zone: window.world.zone.id,
      drawn: window.view.drawnCounts().secrets,
      hidden: window.world.secrets.length,
    };
  });
  check(
    'every secret in Lampton is drawn where it lies',
    start.zone === 'town' && start.hidden === 2 && start.drawn === start.hidden,
    `${start.drawn} drawn of ${start.hidden} in ${start.zone}`,
  );

  const STONE = "window.world.secrets.find((s) => s.secretId === 'lamp-stone')";
  await parkNorthOf(STONE, -3);
  const foot = await page.evaluate(`(() => {
    const at = ${STONE};
    return window.view.worldToScreen(at.x, at.y + 48);
  })()`);
  await clickAt(foot);
  const card = await stepFor(
    () =>
      page.evaluate(() => {
        const found = document.querySelector('.hud-tip[data-find]');
        return found && !found.classList.contains('hud-hidden')
          ? { find: found.getAttribute('data-find'), text: found.textContent ?? '' }
          : null;
      }),
    (value) => value !== null,
    'the walk up to the Lamp Stone to find it',
  );
  check(
    'a tap by the Lamp Stone walks up to it, and the card says what was found',
    card?.find === 'lamp-stone' && (card?.text ?? '').includes("The Lamp Stone's Words"),
    `${card?.find}: ${card?.text}`,
  );
  await page.screenshot({ path: `${OUT}/45-secret-found.png` });
  await page.click('.hud-tip [data-action="tip-heard"]');
  await draw();
  check(
    'and Got it puts it away',
    await page.evaluate(
      () => document.querySelector('.hud-tip')?.classList.contains('hud-hidden') === true,
    ),
  );

  await tapTab('map');
  const count = await page.evaluate(
    () => document.querySelector('.hud-map__secrets')?.textContent ?? '',
  );
  check('the zone map counts it under the map', count === 'Secrets 1 / 2', count);
  await tapTab('map');
}

async function interiors() {
  // --- Going indoors, which is a thing the world could not do at all until this
  // phase: a building was one solid rect, and its inside was somewhere nothing
  // could be.
  //
  // The geometry either side of this is unit-tested — the walls and the gap in
  // `tests/world/buildings.test.ts`, the route in `tests/systems/PathSystem.ts`
  // and `BuildingSystem.test.ts`, the cutaway in `tests/art/building.test.ts`
  // and the two meanings of a tap in `tests/render2d/picking.test.ts`. What only
  // a browser has is the whole of it at once: a real press on the canvas,
  // through a camera the render loop has already moved, a route round a wall,
  // and a roof that has to come off at the end of it. ---

  await park();

  // Which building is asked at the last moment rather than written down:
  // `pickTap` is a priority and not a depth sort, so a wandering rat drawn over
  // a building is picked over it — and a person standing at a door is picked
  // over their own shop. Both are correct behaviour and neither is what this is about.
  const target = await page.evaluate(() => {
    const w = window.world;
    /** @type {{ x: number; y: number }[]} */
    const spots = [...w.mobs.filter((mob) => mob.isAlive()), ...w.npcs];
    return w.buildings
      .map((building) => {
        const at = window.view.worldToScreen(building.x, building.y);
        const gaps = spots.map((thing) => {
          const spot = window.view.worldToScreen(thing.x, thing.y);
          return Math.hypot(spot.x - at.x, spot.y - at.y);
        });
        const half = building.definition.body;
        return {
          id: building.definition.id,
          x: building.x,
          y: building.y,
          width: half.width,
          depth: half.height,
          clearance: gaps.length === 0 ? Infinity : Math.min(...gaps),
        };
      })
      .reduce((best, one) => (one.clearance > best.clearance ? one : best));
  });

  // South of it and stopped, which is where a player walking up the high street
  // would be, and where the camera frames the whole shopfront.
  await page.evaluate((at) => {
    window.world.clearTarget();
    window.world.closeCounters();
    window.world.player.stopMoving();
    window.world.teleport(at.x, at.y + at.depth / 2 + 160);
  }, target);
  await step(2);
  await draw();

  const roof = await page.evaluate((at) => window.view.worldToScreen(at.x, at.y), target);
  await clickAt(roof);
  const atDoor = await stepFor(
    () =>
      page.evaluate(() => ({
        x: window.world.player.x,
        y: window.world.player.y,
        walking: window.world.player.hasMoveTarget(),
      })),
    (spot) => !spot.walking,
    'the player to reach the door',
    20000,
  );
  const outside = Math.abs(atDoor.y - target.y) > target.depth / 2;
  check(
    `a tap on the ${target.id} walks to its door rather than through it`,
    outside,
    `player at ${Math.round(atDoor.x)},${Math.round(atDoor.y)}, door wall at ${
      target.y + target.depth / 2
    }`,
  );

  // And the second tap is the one that has no other way of being asked for: from
  // out here the roof is drawn over the floor, so there is no pixel a thumb
  // could put on it.
  await draw();
  await clickAt(await page.evaluate((at) => window.view.worldToScreen(at.x, at.y), target));
  const inside = await stepFor(
    () =>
      page.evaluate(() => ({
        x: window.world.player.x,
        y: window.world.player.y,
        walking: window.world.player.hasMoveTarget(),
      })),
    (spot) => !spot.walking,
    'the player to walk inside',
    30000,
  );
  check(
    `and a second tap walks in through the door of the ${target.id}`,
    Math.abs(inside.x - target.x) < target.width / 2 &&
      Math.abs(inside.y - target.y) < target.depth / 2,
    `player at ${Math.round(inside.x)},${Math.round(inside.y)} for a room at ${target.x},${
      target.y
    }`,
  );

  // The roof coming off is `tests/art/building.test.ts`'s to assert, since the
  // room is a picture of its own. What is only true here is that the screenshot
  // below is of a room rather than of a lid.
  await page.screenshot({ path: `${OUT}/6b-interior.png` });

  // And back out, so the sections after this one find the player in the open.
  await park();
}

async function canvasDrag() {
  // --- The drag, which is the same stream of PointerEvents as the tap and has
  // to be told apart from it. The camera never turns, so a drag is the gesture
  // that asks for nothing: what only a browser has is a real press-move-release
  // and a pointer capture being told apart from a tap made of the same three
  // events. ---
  await park();

  const stood = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));

  await drag({ x: 195, y: 400 }, 140);
  const stayed = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
    walking: window.world.player.hasMoveTarget(),
  }));
  check(
    'a drag on the canvas asks the world for nothing',
    !stayed.walking && Math.hypot(stayed.x - stood.x, stayed.y - stood.y) < 1,
    `player at ${Math.round(stayed.x)},${Math.round(stayed.y)}, walking: ${stayed.walking}`,
  );

  // And the gesture has to hand back: a tap straight after a drag is still a
  // tap.
  //
  // South of the spawn point rather than north of it, which is the high street
  // and its shopfronts. *Which* lane of it is asked at the last moment rather
  // than written down: `pickTap` is a priority and not a depth sort, so a rat
  // wandering across the lane is picked over the ground, and a tap that lands
  // on it selects it and walks to melee range instead — correct behaviour, and
  // not what this check is about.
  const destination = await page.evaluate((from) => {
    const lanes = [0, -160, 160, -80, 80].map((dx) => ({ x: from.x + dx, y: from.y + 200 }));
    const mobs = window.world.mobs
      .filter((mob) => mob.isAlive())
      .map((mob) => window.view.worldToScreen(mob.x, mob.y));
    const scored = lanes.map((to) => {
      const at = window.view.worldToScreen(to.x, to.y);
      const gaps = mobs.map((spot) => Math.hypot(spot.x - at.x, spot.y - at.y));
      return { to, clearance: gaps.length === 0 ? Infinity : Math.min(...gaps) };
    });
    return scored.reduce((best, lane) => (lane.clearance > best.clearance ? lane : best)).to;
  }, stood);
  await clickAt(await page.evaluate((to) => window.view.worldToScreen(to.x, to.y), destination));
  await step(60);
  const walked = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));
  check(
    'a tap after a drag still walks the player',
    Math.hypot(walked.x - destination.x, walked.y - destination.y) < 24,
    `player at ${Math.round(walked.x)},${Math.round(walked.y)} for ${Math.round(destination.x)},${Math.round(destination.y)}`,
  );
}

/**
 * Holds W for six frames and answers where the player went, in the world and on
 * screen, both projected through the camera as it stands after.
 */
const holdW = async () => {
  const from = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));
  await page.keyboard.down('w');
  // Six frames is ~76 simulation pixels: far enough to read a direction off,
  // short enough that the spawn point's clear ground is all it crosses.
  await step(6);
  await page.keyboard.up('w');
  await draw();
  const held = await page.evaluate((start) => {
    const p = window.world.player;
    return {
      to: { x: p.x, y: p.y },
      fromScreen: window.view.worldToScreen(start.x, start.y),
      toScreen: window.view.worldToScreen(p.x, p.y),
    };
  }, from);
  return {
    walked: Math.hypot(held.to.x - from.x, held.to.y - from.y),
    // How far off due north the simulation heading ended up, in degrees.
    offNorth: Math.round(
      (Math.abs(Math.atan2(held.to.x - from.x, from.y - held.to.y)) * 180) / Math.PI,
    ),
    fromY: held.fromScreen.y,
    toY: held.toScreen.y,
  };
};

async function heading() {
  // --- W means up the screen, which is north, always, since the camera never
  // turns; what a browser adds is a real key reaching the game and the ground
  // the player left sliding down the screen. ---
  await park();
  const w = await holdW();
  check(
    'a real W press walks the player up the screen, which is north',
    w.walked > 40 && w.toY < w.fromY - 10 && w.offNorth < 5,
    `walked ${Math.round(w.walked)}px, ${w.offNorth}° off north, screen y ` +
      `${Math.round(w.fromY)} -> ${Math.round(w.toY)}`,
  );
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
  // The real buttons rather than the event behind them: the tab opens the idle
  // panel, and the panel's own button starts it.
  await startIdle();
  await stepUntil(
    () => page.evaluate(() => window.world.afkActive && window.world.target !== null),
    'idle to pick a fight',
  );
  check('idle fights unprompted', true);

  await page.keyboard.down('w');
  await step(2);
  const released = await page.evaluate(() => window.world.afkActive);
  await page.keyboard.up('w');
  check('a real movement key takes the controls back from idle', released === false);

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
  const stoodTouch = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));
  await touchDrag({ x: 195, y: 400 }, 140);
  const stayedTouch = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
    walking: window.world.player.hasMoveTarget(),
  }));
  check(
    'a finger dragged across the canvas asks the world for nothing, rather than walking where it started',
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
  await parkNorthOf(SOUTH_SIGNPOST);
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
  // The minimap has the corner itself (decision 115), and on a phone held
  // upright the frame stands under it rather than beside the column.
  const minimap = await box('.hud-minimap');
  check(
    'the enemy details sit on the far side, clear of the character details and under the minimap',
    frame !== null &&
      column !== null &&
      minimap !== null &&
      frame.x >= column.right &&
      frame.right <= viewportWidth &&
      frame.y >= minimap.bottom,
    `column ends x=${Math.round(column?.right ?? 0)}, frame runs ${Math.round(
      frame?.x ?? 0,
    )}-${Math.round(frame?.right ?? 0)} of ${viewportWidth} from y=${Math.round(
      frame?.y ?? 0,
    )}, minimap ends y=${Math.round(minimap?.bottom ?? 0)}`,
  );
  await page.screenshot({ path: `${OUT}/13-top-corners.png` });
  await park();

  // --- Buffs, driven the way a player raises one: a real press on the real
  // ability button. Battle Fury is the warrior's, costs nothing and cannot
  // fizzle, so what lands here lands every time. ---
  const bare = await columnHeightBesideTraining();
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
    };
  });
  const buffedHeight = await columnHeightBesideTraining();
  check(
    'using an ability puts its buff in the column, and the column grows for it',
    buffed.shown && buffedHeight > bare,
    `column ${bare} -> ${buffedHeight}, reads "${buffed.time}"`,
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
  const expired = {
    icons: await page.evaluate(() => document.querySelectorAll('.hud-effect').length),
    height: await columnHeightBesideTraining(),
  };
  check(
    'and the row is taken back off the column when it runs out',
    expired.icons === 0 && expired.height === bare,
    `${expired.icons} icons, column back to ${expired.height} from ${bare}`,
  );
}

async function trainingBar() {
  // --- The skill last trained, as a bar in the player column. Which skill it
  // follows and when it fades are held in tests/hud/Hud.test.ts against a fake
  // clock; what needs a browser is that a real gather puts it under the XP bar
  // with its numbers inside it and none of them cut, that a real touch on it
  // opens the skills book at that skill's page, and that on a landscape phone
  // the column it lengthens still clears the ability buttons. The fade itself
  // is not waited for: it runs on the HUD's own half-minute clock, which the
  // hand crank does not turn. ---
  //
  // Gathered in whichever zone the run has walked to by now (the beach, after
  // the touch section), so the node is whatever that zone grows. Its skill is
  // raised to the node's level by setting it rather than awarding it, as the
  // forge section does with smithing, and the tool goes in the weapon hand the
  // way the bag puts one there. The tap that starts a gather is not what this
  // is about, so the gather is asked of the world directly.
  const { held: weapon, skill } = await page.evaluate((gathering) => {
    const w = window.world;
    const node = w.nodes.find((n) => n.isAvailable() && n.definition.skill in gathering);
    if (!node) throw new Error(`nothing to gather in ${w.zone.id}`);
    const skill = /** @type {keyof typeof gathering} */ (node.definition.skill);
    const held = w.character.state.gear.weapon;
    if (w.character.state.skills[skill].level < node.definition.requiredLevel) {
      w.character.state.skills[skill] = { level: node.definition.requiredLevel, xp: 0 };
    }
    const tool = gathering[skill].tool;
    w.character.state.inventory = { [tool]: 1 };
    window.events.emit('inventory-changed', w.character.state.inventory);
    window.events.emit('equip-item-requested', tool);
    return { held, skill };
  }, GATHERING);
  await park();
  await stepUntil(
    () =>
      page.evaluate(
        ({ skill, name }) => {
          const w = window.world;
          const shown = document.querySelector('.hud-player__training .hud-training__name');
          if (shown?.textContent === name) return true;
          // Started again whenever nothing is under way: a hit breaks a
          // gather, and whatever lives here may have come over to deliver one.
          if (!w.gatherState && !w.player.hasMoveTarget()) {
            const node = w.nodes.find((n) => n.isAvailable() && n.definition.skill === skill);
            if (node) w.approachAndGather(node);
          }
          return false;
        },
        { skill, name: GATHERING[skill].name },
      ),
    'a gather to land',
  );
  await page.evaluate(() => window.world.stopGathering());
  await step(2);

  const training = () =>
    page.evaluate(() => {
      /** @param {string} selector */
      const rect = (selector) => {
        const node = document.querySelector(selector);
        return node ? node.getBoundingClientRect().toJSON() : null;
      };
      const progress = /** @type {HTMLElement} */ (
        document.querySelector('.hud-training__progress')
      );
      return {
        text: document.querySelector('.hud-player__training')?.textContent ?? '',
        bar: rect('.hud-training__bar'),
        label: rect('.hud-training__label'),
        xp: rect('.hud-player__xp'),
        column: rect('.hud-player'),
        actions: rect('.hud-actions'),
        uncut: progress.scrollWidth <= progress.clientWidth,
      };
    });
  const portrait = await training();
  check(
    'a real gather puts its skill on a bar under the XP bar, inside the column',
    portrait.bar !== null &&
      portrait.xp !== null &&
      portrait.column !== null &&
      portrait.bar.top >= portrait.xp.bottom &&
      portrait.bar.bottom <= portrait.column.bottom + 1 &&
      portrait.bar.right <= portrait.column.right + 1,
    `"${portrait.text}", bar ${JSON.stringify(portrait.bar)}`,
  );
  check(
    'and its level and XP are printed inside it, with nothing cut',
    portrait.label !== null &&
      portrait.bar !== null &&
      portrait.label.top >= portrait.bar.top - 1 &&
      portrait.label.bottom <= portrait.bar.bottom + 1 &&
      portrait.text.includes('Lv ') &&
      portrait.text.endsWith(' XP') &&
      portrait.uncut,
    `"${portrait.text}"`,
  );
  await page.screenshot({ path: `${OUT}/13-training-bar.png` });

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  await draw();
  const landscape = await training();
  check(
    'on a landscape phone the column it lengthens still clears the ability buttons',
    landscape.column !== null &&
      landscape.actions !== null &&
      landscape.column.bottom <= landscape.actions.top,
    `column ends ${landscape.column?.bottom}, buttons start ${landscape.actions?.top}`,
  );
  await page.setViewportSize({ ...PHONE });
  await page.waitForTimeout(300);
  await draw();

  // A touch, since this is a phone and the bar is short: the gap above it is
  // part of the button so a thumb has more than the bar itself to land on.
  await page.tap('.hud-player__training');
  await page.waitForTimeout(150);
  const opened = await page.evaluate(() => {
    const sheet = /** @type {HTMLElement} */ (
      document.querySelector('.hud-sheet[data-sheet="skills"]')
    );
    return {
      visible: getComputedStyle(sheet).display !== 'none',
      page: sheet.dataset.page ?? '',
    };
  });
  check(
    'and a touch on it opens the skills book at that skill’s page',
    opened.visible && opened.page === skill,
    `page "${opened.page}"`,
  );
  await tapTab('skills');

  // Put the weapon back in hand and the bag the way the sections after this
  // one expect to find it.
  await page.evaluate((held) => {
    if (held) window.events.emit('equip-item-requested', held);
    window.world.character.state.inventory = {};
    window.events.emit('inventory-changed', {});
  }, weapon);
  await park();
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

  // Ten tiles across a desktop's height drew the world three CSS pixels to the
  // art pixel here, and every name three times the height of the HUD's words
  // beside it; a big screen sees more of the world instead (decision 112). The
  // arithmetic is unit-tested; what a browser shows is the canvas the page
  // actually sized.
  const desktopWorld = await page.evaluate(() => {
    const drawn = /** @type {HTMLCanvasElement} */ (document.querySelector('#app > canvas'));
    return {
      cssPerArt: Number.parseFloat(drawn.style.width) / drawn.width,
      tilesTall: drawn.height / 32,
    };
  });
  check(
    'a desktop draws the world at no more than two CSS pixels to the art pixel, seeing more of it',
    desktopWorld.cssPerArt <= 2 && desktopWorld.tilesTall > 12,
    `${desktopWorld.cssPerArt} CSS pixels to the art pixel, ${desktopWorld.tilesTall.toFixed(1)} tiles tall`,
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
      earnedTiers: sheet.querySelectorAll('.hud-feat-title.is-earned').length,
      titles: [...sheet.querySelectorAll('.hud-feat-title')].map(
        (n) => /** @type {HTMLElement} */ (n).dataset.title,
      ),
    };
  });
  check(
    'the Feats tab opens the achievements sheet, populated from the world',
    slayer.visible && slayer.rat === 'Rat100 slain' && slayer.earnedTiers === unlockedTiers,
    `${unlockedTiers} tier(s) unlocked, sheet shows "${slayer.rat}"`,
  );
  check(
    'a completed chain offers every one of its ranks as a title to wear',
    ['rat-culler', 'rat-hunter', 'rat-slayer'].every((title) => slayer.titles.includes(title)),
    slayer.titles.join(', '),
  );
  await page.screenshot({ path: `${OUT}/11-achievements.png` });

  // A rank is one line, its title on the left and its count whole on the
  // right, where a long name had split both halves into two ragged columns.
  // Only real text measures this, so it is asked of the sheet at the width it
  // opens at here and on a portrait phone, the narrowest the game is laid for.
  const rankLines = () =>
    page.evaluate(() => {
      const ranks = [
        ...document.querySelectorAll(
          '.hud-sheet[data-sheet="feats"] :is(.hud-row--tier, .hud-feat-title)',
        ),
      ];
      const broken = ranks.filter((rank) =>
        [...rank.children].some((half) => {
          const style = getComputedStyle(half);
          const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.3;
          return half.getBoundingClientRect().height > line * 1.5;
        }),
      );
      return { ranks: ranks.length, broken: broken.map((rank) => rank.textContent) };
    });
  const roomy = await rankLines();
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(200);
  const narrow = await rankLines();
  if (viewport) await page.setViewportSize(viewport);
  await page.waitForTimeout(200);
  // Growing back to a roomy screen hands it the character sheet, so the ranks
  // are opened again for the title the rest of this section wears.
  const featsShut = await page.evaluate(
    () =>
      document.querySelector('.hud-sheet[data-sheet="feats"]')?.classList.contains('hud-hidden') ??
      true,
  );
  if (featsShut) await tapTab('feats');
  check(
    'every rank on the Feats sheet is one line, here and on a portrait phone',
    roomy.ranks > 0 && roomy.broken.length === 0 && narrow.broken.length === 0,
    `${roomy.ranks} ranks; broken here: ${roomy.broken.join(' | ') || 'none'}; ` +
      `on a phone: ${narrow.broken.join(' | ') || 'none'}`,
  );

  // The title has to survive the round trip the picker actually uses: the HUD
  // asks, the world re-checks the kills back it, and the player column redraws.
  // It gets its own line there, so the column has to grow to hold it.
  const beforeTitle = await columnHeightBesideTraining();
  await page.click('.hud-feat-title[data-title="rat-slayer"]');
  await page.waitForTimeout(250);
  const wornTitle = await page.evaluate(() => {
    const line = /** @type {HTMLElement} */ (document.querySelector('.hud-player__title'));
    return {
      model: window.world.character.state.activeTitleId,
      shown: line.textContent === 'Rat Slayer' && getComputedStyle(line).display !== 'none',
    };
  });
  const afterTitle = await columnHeightBesideTraining();
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

async function skillsBook() {
  // --- The skills book, where mastery lives now. What a page *says* is derived
  // and held in tests/systems/SkillBookSystem.test.ts; what needs a browser is
  // that the book is behind the menu, that a real tap on a skill's row on the
  // character sheet opens its page, that a page redraws off the event rather
  // than off a copy taken when it was built, and that a long page stops above
  // the tab bar and scrolls inside itself on a portrait phone. The viewport is
  // put back afterwards, since the bag's section is written against the one
  // the sheets' section left. ---
  const viewport = page.viewportSize();
  await page.setViewportSize({ ...PHONE });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const w = window.world;
    // Set and then published on the HUD channel, which is the pair the world
    // does on a swing. Six hundred is one rung up, so the row has something to
    // say beyond the free first one everybody starts on.
    w.character.state.mastery = { tree: 600 };
    window.events.emit('mastery-changed', w.character.state.mastery);
  });

  const book = () =>
    page.evaluate(() => {
      const sheet = /** @type {HTMLElement} */ (
        document.querySelector('.hud-sheet[data-sheet="skills"]')
      );
      const body = /** @type {HTMLElement} */ (sheet.querySelector('.hud-sheet__body'));
      const box = sheet.getBoundingClientRect();
      const bar = /** @type {HTMLElement} */ (document.querySelector('.hud-tabs'));
      /** @param {string} id */
      const entry = (id) => sheet.querySelector(`.hud-book-entry[data-entry="${id}"]`);
      return {
        visible: getComputedStyle(sheet).display !== 'none',
        page: sheet.dataset.page ?? '',
        title: sheet.querySelector('.hud-sheet__title')?.textContent ?? '',
        skills: sheet.querySelectorAll('.hud-skill[data-skill]').length,
        tree: entry('tree')?.querySelector('.hud-book-entry__mastery')?.textContent ?? '',
        willowLocked: entry('willow')?.classList.contains('is-locked') ?? false,
        willow: entry('willow')?.textContent ?? '',
        entries: sheet.querySelectorAll('.hud-book-entry').length,
        aboveBar: box.bottom <= bar.getBoundingClientRect().top + 0.5,
        scrolls: body.scrollHeight > body.clientHeight,
      };
    });

  await tapTab('skills');
  const index = await book();
  check(
    'the Skills tab opens the book on an index of every skill',
    index.visible && index.page === '' && index.skills === 15,
    `${index.skills} skill(s), page "${index.page}"`,
  );
  await tapTab('skills');

  await tapTab('character');
  await page.click('.hud-sheet[data-sheet="character"] .hud-skill[data-skill="woodcutting"]');
  await page.waitForTimeout(150);
  const woodcutting = await book();
  check(
    "a skill's row on the character sheet opens the book at that skill's page",
    woodcutting.visible &&
      woodcutting.page === 'woodcutting' &&
      woodcutting.title === 'Woodcutting',
    `page "${woodcutting.page}", titled "${woodcutting.title}"`,
  );
  check(
    'and a pool beside its row says which rank it stands on',
    woodcutting.tree.includes('Apprentice') && woodcutting.tree.includes('rank 2 / 5'),
    `tree: "${woodcutting.tree}"`,
  );
  check(
    'and a row out of reach is drawn greyed, naming the level it waits on',
    woodcutting.willowLocked && woodcutting.willow.includes('Needs Woodcutting 8'),
    `willow: "${woodcutting.willow.slice(0, 60)}"`,
  );
  await page.screenshot({ path: `${OUT}/13-skills-book.png` });

  await page.click('.hud-sheet[data-sheet="skills"] [data-action="skills-back"]');
  await page.waitForTimeout(80);
  const back = await book();
  check('and Back goes to the index', back.page === '' && back.skills === 15, `"${back.page}"`);

  await page.click('.hud-sheet[data-sheet="skills"] .hud-skill[data-skill="smithing"]');
  await page.waitForTimeout(150);
  const smithing = await book();
  check(
    'a long page stops above the tab bar and scrolls inside itself',
    smithing.page === 'smithing' && smithing.aboveBar && smithing.scrolls,
    `${smithing.entries} recipes, above the bar ${smithing.aboveBar}, scrolls ${smithing.scrolls}`,
  );
  await tapTab('skills');
  if (viewport) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(300);
  }
}

async function idlePanel() {
  // --- The idle panel (decision 96). The Idle tab opens a panel saying what
  // idle will do rather than starting it; the panel's own button starts it,
  // and the food rows are set with a real thumb. What the panel says is derived
  // and held in tests/systems/IdlePlanSystem.test.ts; what needs a browser is
  // that on a portrait phone, where a food with three buttons beside it is
  // tightest, every button is a thumb target inside the panel, the panel stops
  // above the tab bar, and a tap goes round the world and back. ---
  const viewport = page.viewportSize();
  await page.setViewportSize({ ...PHONE });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const w = window.world;
    w.clearTarget();
    w.character.addItem('cooked-rat', 3);
    w.character.addItem('cooked-crab', 2);
    window.events.emit('inventory-changed', { ...w.character.state.inventory });
  });

  const panel = () =>
    page.evaluate(() => {
      const sheet = /** @type {HTMLElement} */ (
        document.querySelector('.hud-sheet[data-sheet="idle"]')
      );
      const box = sheet.getBoundingClientRect();
      const bar = /** @type {HTMLElement} */ (document.querySelector('.hud-tabs'));
      const buttons = [...sheet.querySelectorAll('.hud-idle-food button, .hud-idle__button')].map(
        (button) => button.getBoundingClientRect(),
      );
      /** @param {string} selector */
      const foods = (selector) =>
        [...sheet.querySelectorAll(selector)].map(
          (row) => /** @type {HTMLElement} */ (row).dataset.food,
        );
      return {
        visible: getComputedStyle(sheet).display !== 'none',
        button: sheet.querySelector('.hud-idle__button')?.textContent ?? '',
        foods: foods('.hud-idle-food'),
        kept: foods('.hud-idle-food.is-kept'),
        smallest: Math.round(Math.min(...buttons.map((rect) => Math.min(rect.width, rect.height)))),
        inside: buttons.every(
          (rect) => rect.left >= box.left - 0.5 && rect.right <= box.right + 0.5,
        ),
        aboveBar: box.bottom <= bar.getBoundingClientRect().top + 0.5,
        lit:
          document.querySelector('.hud-tabs__tab[data-tab="idle"]')?.classList.contains('is-lit') ??
          false,
        idle: window.world.afkActive,
      };
    });

  await tapTab('idle');
  const opened = await panel();
  check(
    'the Idle tab opens its panel rather than starting idle',
    opened.visible && !opened.idle && opened.button === 'Start idle',
    `visible ${opened.visible}, idle ${opened.idle}, button "${opened.button}"`,
  );
  check(
    'every button on it is a thumb target, inside the panel, above the tab bar',
    opened.smallest >= 44 && opened.inside && opened.aboveBar,
    `smallest ${opened.smallest}px, inside ${opened.inside}, above the bar ${opened.aboveBar}`,
  );
  check(
    'it lists the food in the bag in the order idle eats it',
    JSON.stringify(opened.foods) === JSON.stringify(['cooked-rat', 'cooked-crab']),
    opened.foods.join(', '),
  );
  await page.screenshot({ path: `${OUT}/13b-idle-panel.png` });

  await page.tap('.hud-idle-food[data-food="cooked-crab"] [data-action="food-earlier"]');
  await page.tap('.hud-idle-food[data-food="cooked-crab"] [data-action="food-keep"]');
  await page.waitForTimeout(80);
  const set = await panel();
  const saved = await page.evaluate(() => window.world.character.state.idleFood);
  check(
    'a real tap moves a food and keeps one, through the world and back',
    JSON.stringify(set.foods) === JSON.stringify(['cooked-crab', 'cooked-rat']) &&
      JSON.stringify(set.kept) === JSON.stringify(['cooked-crab']) &&
      saved.keep.includes('cooked-crab'),
    `${set.foods.join(', ')}; kept ${set.kept.join(', ')}`,
  );

  await page.tap('.hud-sheet[data-sheet="idle"] [data-action="start-idle"]');
  await page.waitForTimeout(80);
  const started = await panel();
  check(
    'Start sets idle going, puts the panel away and lights the tab',
    started.idle && !started.visible && started.lit,
    `idle ${started.idle}, panel ${started.visible}, lit ${started.lit}`,
  );

  await tapTab('idle');
  const running = await panel();
  await page.tap('.hud-sheet[data-sheet="idle"] [data-action="stop-idle"]');
  await page.waitForTimeout(80);
  const stopped = await panel();
  check(
    'while it runs, the lit tab opens the panel with Stop in it',
    running.visible && running.button === 'Stop idle' && !stopped.idle && !stopped.lit,
    `"${running.button}", then idle ${stopped.idle}`,
  );

  await tapTab('idle');
  await page.evaluate(() => {
    const w = window.world;
    w.character.removeItem('cooked-rat', 3);
    w.character.removeItem('cooked-crab', 2);
    w.character.state.idleFood = { order: [], keep: [] };
    window.events.emit('inventory-changed', { ...w.character.state.inventory });
    window.events.emit('idle-food-changed', w.character.state.idleFood);
  });
  if (viewport) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(300);
  }
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
  // A bag of one of most things. A grid holds several to a row where the old
  // list gave each item the full width, so the fixture has to be wide enough for
  // the bag to overflow by more than a row of cells, or the scroll and the clip
  // below are not exercised at all — and it gives the icon check further down
  // gear, tools, food and materials to draw.
  const ONE_OF_EACH = {
    'rusty-sword': 1,
    'apprentice-staff': 1,
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
    'tin-ore': 2,
    'iron-bar': 1,
    shortbow: 1,
    'brown-shield': 1,
    'apprentice-orb': 1,
    'crude-arrows': 25,
    'lurker-hide': 1,
    charcoal: 1,
    'raw-eel': 1,
    'cooked-eel': 1,
    'iron-ore': 2,
    coal: 2,
    'tin-bar': 1,
    'steel-bar': 1,
    hardwood: 2,
    willow: 2,
    'arrow-shafts': 15,
    'iron-arrowheads': 15,
    'crawler-shell': 1,
    'cured-leather': 1,
    'reforging-stone': 1,
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

  // Waited out rather than slept through, which is the rule everywhere else in
  // this file and was the one place it was broken. A wheel is one of the few
  // things here that cannot go on the hand crank — it is a real input event, and
  // Chromium animates the scroll it starts on the compositor — so a fixed
  // wall-clock wait is a guess about how loaded the machine is, and on a CI
  // runner it guessed wrong: `scrollTop=0` against 159px of overflow, on a check
  // that passes locally every time. Settling on two equal readings measures the
  // animation instead of predicting it, and a scroll that never happens still
  // reads 0 and still fails the check below rather than hanging.
  const bagScrolled = await (async () => {
    let last = -1;
    for (let tries = 0; tries < 40; tries += 1) {
      const seen = await bag();
      if (seen.scrollTop > 0 && seen.scrollTop === last) return seen;
      last = seen.scrollTop;
      await page.waitForTimeout(50);
    }
    return bag();
  })();
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

  // Every cell carries a drawn icon. Which picture each item is is unit-tested;
  // what needs a browser is that the sheet of them reached the page and each
  // cell shows its own square of it — an icon that lost its sheet would leave a
  // grid of empty boxes and no error.
  const icons = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.hud-sheet[data-sheet="inventory"] .hud-item')];
    return cells.map((cell) => {
      const icon = /** @type {HTMLElement | null} */ (cell.querySelector('.hud-icon'));
      const box = icon?.getBoundingClientRect();
      return {
        item: /** @type {HTMLElement} */ (cell).dataset.item,
        key: icon?.dataset.icon ?? null,
        drawn: !!box && box.width === 32 && box.height === 32,
        sheet: icon
          ? getComputedStyle(icon).backgroundImage.startsWith('url("data:image/png')
          : false,
        at: icon?.style.backgroundPosition ?? '',
      };
    });
  });
  check(
    'every item in the bag is drawn as its own square of the sheet of icons',
    icons.length > 0 &&
      icons.every((icon) => icon.key && icon.drawn && icon.sheet && icon.at) &&
      new Set(icons.map((icon) => icon.at)).size === icons.length,
    `${icons.length} cells, e.g. ${icons[0]?.item}: ${icons[0]?.key} at ${icons[0]?.at}`,
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

  // What an item is for, on the tap that selects it. Rat meat away from a fire
  // used to read "(nothing to do with this)"; what needs a browser is that the
  // longest list any of these has still leaves the grid a row and the sheet
  // clear of the tab bar, since the strip sits outside the scrolling body.
  const strip = () =>
    page.evaluate(() => {
      const sheet = /** @type {HTMLElement} */ (
        document.querySelector('.hud-sheet[data-sheet="inventory"]')
      );
      return {
        uses: [...sheet.querySelectorAll('.hud-item-detail .hud-item-uses__line')].map(
          (line) => line.textContent ?? '',
        ),
        bottom: Math.round(sheet.getBoundingClientRect().bottom),
        grid: Math.round(
          /** @type {HTMLElement} */ (sheet.querySelector('.hud-sheet__body')).clientHeight,
        ),
      };
    });
  await page.click('.hud-sheet[data-sheet="inventory"] .hud-item[data-item="rat-meat"]');
  const ratMeat = await strip();
  check(
    'tapping rat meat says what it cooks into rather than that it is junk',
    ratMeat.uses.includes('Cook at a campfire → Cooked Rat'),
    ratMeat.uses.join(' | '),
  );
  await page.click('.hud-sheet[data-sheet="inventory"] .hud-item[data-item="logs"]');
  const logs = await strip();
  check(
    'a long list of uses leaves the grid a row and the bag clear of the tab bar',
    logs.uses.length >= 4 && logs.grid >= 60 && logs.bottom <= (await tabBarTop()),
    `${logs.uses.length} lines, grid ${logs.grid}px, bottom ${logs.bottom}`,
  );
  await page.screenshot({ path: `${OUT}/13a-item-uses.png` });

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

/**
 * The character sheet's figure as drawn: what it wears, and its pixels, which
 * only a browser fills.
 */
const paperdoll = () =>
  page.evaluate(() => {
    const doll = /** @type {HTMLCanvasElement | null} */ (document.querySelector('.hud-paperdoll'));
    const data = doll?.getContext('2d')?.getImageData(0, 0, doll.width, doll.height).data;
    let painted = 0;
    for (let at = 3; data && at < data.length; at += 4) if ((data[at] ?? 0) > 0) painted += 1;
    return {
      gear: doll?.dataset.gear ?? '',
      size: doll ? [doll.width, doll.height, doll.clientWidth, doll.clientHeight] : [],
      painted,
      pixels: data ? Array.from(data).join() : '',
    };
  });

async function characterSheet() {
  // --- The character sheet: the figure on it is the world's (decision 111),
  // put together from what is worn, and an empty slot opens a picker rather
  // than needing the bag. Equipping from it is the round trip that proves the
  // sheet is self-sufficient. ---
  await tapTab('character');
  const before = await paperdoll();
  check(
    "the sheet draws the world's figure, at a whole scale",
    before.painted > 200 && before.size.join('x') === '32x48x64x96',
    `${before.painted} pixels painted, ${before.size.join('x')}`,
  );
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
  await draw();
  const undressed = await page.evaluate(() => ({
    wearing: window.view.playerFigure().wearing,
    canvases: window.view.canvases(),
  }));
  await page.click('.hud-picker__row[data-item="brown-helmet"]');
  await page.waitForTimeout(200);
  await draw();
  // The figure in the world is put together from what is worn (decision 107):
  // compiled again when the gear changes, the old one let go as the new one is
  // made, so a change of helmet is not a canvas that never comes back.
  const redressed = await page.evaluate(() => ({
    wearing: window.view.playerFigure().wearing,
    canvases: window.view.canvases(),
  }));
  check(
    'and puts the helmet on the figure in the world, letting the old figure go',
    !undressed.wearing.includes('brown-helmet') &&
      redressed.wearing.includes('brown-helmet') &&
      redressed.canvases === undressed.canvases,
    `${undressed.canvases} -> ${redressed.canvases} canvases`,
  );
  const equipped = await page.evaluate(() => ({
    world: window.world.character.state.gear.helmet,
    shown: /** @type {HTMLElement} */ (
      document.querySelector('.hud-slot[data-slot="helmet"] .hud-slot__item')
    ).textContent,
    pickerGone: document.querySelector('.hud-picker') === null,
  }));
  // The figure is drawn again in the new gear — the one thing a static picture
  // could not show.
  const after = await paperdoll();
  check(
    'picking an item equips it and redraws the sheet, the figure in its new helmet',
    equipped.world === 'brown-helmet' &&
      equipped.shown === 'Brown Helmet' &&
      equipped.pickerGone &&
      after.gear.includes('brown-helmet') &&
      after.pixels !== before.pixels,
    `${equipped.shown}, figure wearing ${after.gear}`,
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
      // Which of them are drawn open. A shut door is drawn shut, which since
      // the map stopped being a way of going anywhere is the whole of what it
      // has to say about one.
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
    'and gives each one a cell big enough to read, and to press where it is pressable',
    overview.smallest >= 44,
    `smallest cell ${Math.round(overview.smallest)}px`,
  );
  await page.screenshot({ path: `${OUT}/22-world-map.png` });

  /**
   * A map you read, not a control.
   *
   * Tapping a cell used to travel there; that went with fast travel, and what
   * is worth checking in a browser is that the element still in the DOM does
   * nothing when a real click lands on it. The zone below is reached by walking
   * into the edge, which is the only way there is now.
   */
  const elsewhere = overview.open.find((zone) => zone !== overview.current);
  await page.click(`.hud-map__zone[data-zone="${elsewhere}"]`);
  await step(4);
  check(
    'and pressing another zone on it goes nowhere at all',
    (await zoneId()) === overview.current,
    `pressed ${elsewhere}, still in ${await zoneId()}`,
  );
  await page.screenshot({ path: `${OUT}/22b-map-inert.png` });

  // Back to the zone view, which is what the checks below are about.
  await page.click('[data-action="toggle-map-zoom"]');
  await page.waitForTimeout(120);

  // A zone walk rebuilds the world, and the map has to follow it across. Which
  // exit is taken is read off the zone too, so this works from wherever it ran.
  const leaving = await zoneId();
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

async function minimapCorner() {
  // --- The minimap (decision 115). What it draws is unit-tested against the
  // zone map's tables and a list of creatures handed to it; what needs a
  // browser is that it is laid out in the corner at a real size and meets
  // nothing else at a portrait phone, a landscape one and a desktop, that the
  // creatures on it are the world's own on the real frame loop, that a real tap
  // opens the map, and that its switch outlives a reload. ---
  const furniture = () =>
    page.evaluate(() => {
      /** @param {Element | null} node */
      const box = (node) => {
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      };
      // Placed by the layout whether or not anything is targeted, so read off
      // its style rather than off a box that is not drawn.
      const frame = /** @type {HTMLElement} */ (document.querySelector('.hud-target'));
      const minimap = document.querySelector('.hud-minimap');
      return {
        shown: minimap !== null && !minimap.classList.contains('hud-hidden'),
        minimap: box(minimap),
        map: box(document.querySelector('.hud-minimap__map')),
        column: box(document.querySelector('.hud-player')),
        tabs: box(document.querySelector('.hud-tabs')),
        frame: {
          x: parseFloat(frame.style.left),
          y: parseFloat(frame.style.top),
          width: parseFloat(frame.style.width),
          height: parseFloat(frame.style.height),
        },
        viewport: { width: window.innerWidth, height: window.innerHeight },
      };
    });
  /**
   * @param {{ x: number; y: number; width: number; height: number } | null} a
   * @param {{ x: number; y: number; width: number; height: number } | null} b
   */
  const apart = (a, b) =>
    a !== null &&
    b !== null &&
    (a.x + a.width <= b.x ||
      b.x + b.width <= a.x ||
      a.y + a.height <= b.y ||
      b.y + b.height <= a.y);

  for (const [name, viewport] of /** @type {const} */ ([
    ['a portrait phone', PHONE],
    ['a landscape phone', { width: 844, height: 390 }],
    ['a desktop', { width: 1280, height: 800 }],
  ])) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(300);
    await park();
    const at = await furniture();
    const { minimap, map } = at;
    check(
      `the minimap stands in the top-right corner of ${name}, its map square and drawn`,
      at.shown &&
        minimap !== null &&
        map !== null &&
        Math.round(minimap.x + minimap.width) <= at.viewport.width &&
        minimap.y < 20 &&
        at.viewport.width - (minimap.x + minimap.width) < 20 &&
        map.width === map.height &&
        map.width >= 100,
      `${JSON.stringify(minimap)}, map ${map?.width}x${map?.height}`,
    );
    check(
      `and meets neither the player column, the target frame nor the tab bar on ${name}`,
      apart(minimap, at.column) && apart(minimap, at.frame) && apart(minimap, at.tabs),
      `minimap ${JSON.stringify(minimap)}, frame ${JSON.stringify(at.frame)}`,
    );
  }
  await page.setViewportSize({ ...PHONE });
  await page.waitForTimeout(300);
  await park();

  // A creature stood three tiles east of the player has to turn up three tiles
  // east of the cross in the middle: the world's publisher, the tile crossing
  // and the HUD's drawing, on the real loop.
  const placed = await page.evaluate(() => {
    const w = window.world;
    const mob = w.mobs.find((m) => m.isAlive());
    if (!mob) return false;
    mob.setPosition(w.player.x + 3 * 64, w.player.y);
    return true;
  });
  await step(2);
  await draw();
  const dots = await page.evaluate(() => {
    const centre = (/** @type {Element | null | undefined} */ node) => {
      const rect = node?.getBoundingClientRect();
      return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
    };
    const you = centre(document.querySelector('.hud-minimap__map [data-minimap="player"] rect'));
    const creatures = [
      ...document.querySelectorAll(
        '.hud-minimap__map [data-minimap="creature"], .hud-minimap__map [data-minimap="boss"]',
      ),
    ].map((dot) => centre(dot.firstElementChild));
    return { you, creatures, alive: window.world.mobs.filter((m) => m.isAlive()).length };
  });
  const tile = 4;
  const east = dots.creatures.find(
    (dot) =>
      dots.you !== null &&
      dot !== null &&
      Math.abs(dot.x - dots.you.x - 3 * tile) <= tile &&
      Math.abs(dot.y - dots.you.y) <= tile,
  );
  check(
    'the minimap draws the creatures in reach where they stand, beside the player',
    placed && east !== undefined && dots.creatures.length <= dots.alive,
    `player at ${JSON.stringify(dots.you)}, ${dots.creatures.length} of ${dots.alive} creatures drawn`,
  );
  await page.screenshot({ path: `${OUT}/20c-minimap.png` });

  // A tap on it opens the zone map, and another puts it away, as the tab would.
  await page.tap('.hud-minimap');
  await page.waitForTimeout(120);
  const opened = await page.evaluate(
    () => document.querySelector('.hud-sheet[data-sheet="map"]:not(.hud-hidden)') !== null,
  );
  // On a phone the sheet is the screen and covers the minimap, so the second
  // ask comes the way a thumb would make it there: the menu.
  await tapTab('map');
  const closed = await page.evaluate(
    () => document.querySelector('.hud-sheet[data-sheet="map"]:not(.hud-hidden)') === null,
  );
  check('a tap on the minimap opens the zone map', opened && closed);

  // The switch in Options: off gives the corner back to the target frame, and
  // the character keeps it across a reload.
  await tapTab('options');
  await page.click('[data-action="toggle-minimap"]');
  await page.keyboard.press('Escape');
  await step(2);
  const off = await furniture();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.world != null && window.view != null, null, {
    timeout: 60000,
  });
  await step(2);
  const reloaded = await furniture();
  check(
    'switched off in Options, the minimap goes, the target frame takes the corner, and a reload keeps it off',
    !off.shown && off.frame.y < 20 && !reloaded.shown,
    `off: shown ${off.shown}, frame at y=${off.frame.y}; after a reload shown ${reloaded.shown}`,
  );
  await tapTab('options');
  await page.click('[data-action="toggle-minimap"]');
  await page.keyboard.press('Escape');
  await step(2);
  check('and switched back on, it is back', (await furniture()).shown);
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
    // Walked, because the map stopped being a way of going anywhere. The
    // section above leaves the player in town and the camp is one road east.
    await page.evaluate(() => {
      const w = window.world;
      w.teleport(w.worldWidth - 33, w.worldHeight / 2);
    });
    await stepUntilZone('bandit-camp', 'the east road into the bandit camp');
  }
  await park();

  check('a zone behind a lock is drawn shut on the world map', (await cellAccess()) === 'locked');

  /**
   * The map says a door is shut; it is not a way through one.
   *
   * Pressing this cell used to ask the world to travel and earn the refusal
   * toast back. With the map read-only the lock is something a player reads
   * here and meets at the edge, so what a browser is needed for is that the
   * element is genuinely inert — still drawn, still labelled shut, and doing
   * nothing at all when a real click lands on it.
   */
  await page.click('.hud-map__zone[data-zone="bandit-hideout"]');
  await step(2);
  const pressed = await page.evaluate(() => ({
    zone: window.world.zone.id,
    access:
      document
        .querySelector('.hud-map__zone[data-zone="bandit-hideout"]')
        ?.getAttribute('data-access') ?? 'open',
  }));
  check(
    'and pressing it neither opens the door nor pretends to',
    pressed.zone === 'bandit-camp' && pressed.access === 'locked',
    `still in ${pressed.zone}, cell drawn ${pressed.access}`,
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
  // an open zone. The Cellar is east of the camp, and only the lane's end leads
  // down to it: the exit's mouth (decision 119), whose middle this stands on.
  await page.evaluate(() => {
    const w = window.world;
    const post = w.signposts.find((sign) => sign.exit.to === 'bandit-hideout');
    const [first, last] = post?.exit.mouth ?? [0, 0];
    w.teleport(w.worldWidth, ((first + last + 1) / 2) * (w.worldHeight / w.zone.map.length));
  });
  await stepUntilZone('bandit-hideout', "the walk into the Cutthroat's Cellar");
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
  await checkZoneDrawn("Cutthroat's Cellar");
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
  await page.evaluate(() => {
    const w = window.world;
    const post = w.signposts.find((sign) => sign.exit.to === 'bandit-camp');
    const [first, last] = post?.exit.mouth ?? [0, 0];
    w.teleport(0, ((first + last + 1) / 2) * (w.worldHeight / w.zone.map.length));
  });
  await stepUntilZone('bandit-camp', "the walk back out of the Cutthroat's Cellar");
  await park();
}

async function tips() {
  // --- The spirit's tips (decision 98). A card that waits for a tap, placed
  // clear of both top corners, held while a panel covers the playfield, and
  // answered with a real thumb. Which tip applies and what it says are held in
  // tests/systems/TipSystem.test.ts, and the desk's timing in
  // tests/world/tips.test.ts; what needs a browser is where the card lands at
  // a real phone's size, in both orientations, and that its buttons are
  // thumbs' and go round the world and back.
  //
  // Late in the run, since it cranks a minute and more of game time and every
  // creature wanders through it: the sections before it are staged against
  // where the town's rats are, and the one after it starts a new character.
  // Which tip comes first depends on what this character has done by now, so
  // nothing here asks which. Holding a finger on anything applies to everyone,
  // so there is always a first, and raw meat in the bag stages a second. ---
  await page.setViewportSize({ ...PHONE });
  await page.waitForTimeout(300);
  // A card waits out anything over the playfield, which is the point, so the
  // sheet and the overlay the last section left up go first.
  await page.keyboard.press('Escape');
  const sheet = await page.evaluate(
    () => document.querySelector('.hud-sheet:not(.hud-hidden)')?.getAttribute('data-sheet') ?? null,
  );
  if (sheet) await tapTab(sheet);
  await park();

  const card = () =>
    page.evaluate(() => {
      const root = /** @type {HTMLElement} */ (document.querySelector('.hud-tip'));
      const box = root.getBoundingClientRect();
      /** @param {DOMRect} a @param {DOMRect | undefined} b */
      const clear = (a, b) =>
        !b || a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
      const buttons = [...root.querySelectorAll('button')].map((b) => b.getBoundingClientRect());
      return {
        tip: getComputedStyle(root).display === 'none' ? null : (root.dataset.tip ?? null),
        text: root.querySelector('.hud-tip__line')?.textContent ?? '',
        smallest: Math.round(Math.min(...buttons.map((rect) => Math.min(rect.width, rect.height)))),
        onScreen: box.left >= 0 && box.right <= window.innerWidth && box.top >= 0,
        clearOfCorners:
          clear(box, document.querySelector('.hud-player')?.getBoundingClientRect()) &&
          clear(box, document.querySelector('.hud-target')?.getBoundingClientRect()),
        aboveActions:
          box.bottom <=
          (document.querySelector('.hud-actions')?.getBoundingClientRect().top ?? Infinity),
        heard: window.world.character.state.tips.heard,
        off: window.world.character.state.tips.off,
      };
    });

  // A target up, so the right-hand corner is drawn for the card to clear.
  await page.evaluate(() => {
    const mob = window.world.mobs[0];
    if (mob) window.world.setTarget(mob);
  });
  // Back on, which waits a tip's gap rather than arriving with the tap.
  await page.evaluate(() => window.events.emit('tips-set-requested', true));
  const offered = await stepFor(card, (seen) => seen.tip !== null, 'a tip offered', 90000);
  check(
    "a tip comes as a card with the spirit's line, and two buttons a thumb can take",
    offered.text.length > 20 && offered.smallest >= 44,
    `${offered.tip}: "${offered.text}", smallest button ${offered.smallest}px`,
  );
  check(
    'on a portrait phone it sits on screen, under both corners and above the ability bar',
    offered.onScreen && offered.clearOfCorners && offered.aboveActions,
    `on screen ${offered.onScreen}, clear ${offered.clearOfCorners}, above ${offered.aboveActions}`,
  );
  await page.screenshot({ path: `${OUT}/2b-tip-card.png` });

  await tapTab('inventory');
  const held = await card();
  await tapTab('inventory');
  const back = await card();
  check(
    'it waits out a sheet over the playfield, and is still there when it closes',
    held.tip === null && back.tip === offered.tip,
    `under the bag ${held.tip}, after ${back.tip}`,
  );

  await page.setViewportSize({ width: PHONE.height, height: PHONE.width });
  await page.waitForTimeout(300);
  const sideways = await card();
  check(
    'on a landscape phone it sits between the two corners, clear of both',
    sideways.tip !== null && sideways.onScreen && sideways.clearOfCorners,
    `on screen ${sideways.onScreen}, clear ${sideways.clearOfCorners}`,
  );
  await page.setViewportSize({ ...PHONE });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.world.clearTarget());

  await page.tap('.hud-tip [data-action="tip-heard"]');
  await page.waitForTimeout(80);
  const heard = await card();
  check(
    'Got it takes the card down and the character keeps what it heard',
    heard.tip === null && heard.heard.some((tipId) => tipId === offered.tip),
    `card ${heard.tip}, heard ${heard.heard.join(', ')}`,
  );

  await page.evaluate(() => {
    window.world.character.addItem('rat-meat', 1);
    window.events.emit('inventory-changed', { ...window.world.character.state.inventory });
  });
  // Ten seconds of game time, well inside the gap.
  await step(250);
  const quiet = await card();
  const next = await stepFor(card, (seen) => seen.tip !== null, 'the next tip', 90000);
  await page.tap('.hud-tip [data-action="tips-off"]');
  await page.waitForTimeout(80);
  const silenced = await card();
  check(
    'the next waits out a gap, and No more tips switches them off for good',
    quiet.tip === null && next.tip !== offered.tip && silenced.tip === null && silenced.off,
    `quiet ${quiet.tip}, then ${next.tip}, then card ${silenced.tip}, off ${silenced.off}`,
  );
  await page.evaluate(() => {
    window.world.character.removeItem('rat-meat', 1);
    window.events.emit('inventory-changed', { ...window.world.character.state.inventory });
  });
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
      ).textContent === 'Tap again to reset',
    // The save's own key rather than "anything stored": sound settings sit in
    // the same storage and would make a deleted save look intact.
    saveIntact: localStorage.getItem('untitled-boomer-mmo:character:v1') !== null,
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

  // Sound is the one thing in here about the device rather than the character,
  // so it is the one thing the reset below must leave standing. Muted here and
  // checked again on the far side of the reset.
  await tapTab('options');
  const soundControls = await page.evaluate(() => {
    const button = document.querySelector('.hud-modal [data-action="toggle-sound"]');
    const slider = document.querySelector('.hud-modal [data-action="volume"]');
    if (!button || !slider) return null;
    const b = button.getBoundingClientRect();
    const s = slider.getBoundingClientRect();
    return {
      shortest: Math.min(b.height, s.height),
      right: Math.max(b.right, s.right),
      width: window.innerWidth,
    };
  });
  check(
    'the options menu offers sound, sized for a thumb and on the screen',
    soundControls !== null &&
      soundControls.shortest >= 44 &&
      soundControls.right <= soundControls.width,
    JSON.stringify(soundControls),
  );
  await page.click('.hud-modal [data-action="toggle-sound"]');
  /** @param {string | null} raw */
  const mutedIn = (raw) => raw !== null && JSON.parse(raw).muted === true;
  check(
    'muting is kept on the device',
    mutedIn(await page.evaluate(() => localStorage.getItem('untitled-boomer-mmo:sound:v1'))),
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);

  await tapTab('options');
  await page.click('.hud-modal [data-action="reset-character"]');
  await page.click('.hud-modal [data-action="reset-character"]');
  await page.waitForSelector('.create', { timeout: 20000 });
  check(
    'a reset tears the renderer down and returns to character creation',
    // The world's canvas, not any: the creation screen draws its cards on canvases of its own.
    (await page.evaluate(
      () =>
        document.querySelector('.hud') === null && document.querySelector('#app > canvas') === null,
    )) === true,
  );
  await page.click('.create__card[data-class="wizard"]');
  await page.click('.create__begin');
  // `window.world` is cleared when a view is torn down, so this cannot pass on
  // the world the reset just ended.
  await page.waitForFunction(() => window.world != null, null, { timeout: 20000 });
  await quietTips();
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

  await tapTab('options');
  const soundAfter = await page.evaluate(() => ({
    stored: localStorage.getItem('untitled-boomer-mmo:sound:v1'),
    label: document.querySelector('.hud-modal [data-action="toggle-sound"]')?.textContent,
  }));
  check(
    "and leaves the device muted, which is not the character's to wipe",
    mutedIn(soundAfter.stored) && soundAfter.label === 'Sound: Off',
    `${soundAfter.label}`,
  );
  // Back on for everything after this, so the throttled draw is measured with
  // the sound a player would actually have running.
  await page.click('.hud-modal [data-action="toggle-sound"]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);

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

async function saveTransfer() {
  // --- The save taken away and brought back (decision 97). What only a page
  // can show: a real download reaching the browser with the character as it
  // stands, a file chosen through a real picker, and a load that ends one
  // session and starts another under the same host — a reset's teardown that
  // ends somewhere other than the creation screen. What a save may hold, and
  // what is refused, is `tests/persistence/saveFile.test.ts`'s. ---
  await page.setViewportSize({ ...PHONE });
  await page.waitForTimeout(300);
  // Staged, so the save that leaves can be told apart from what the page holds
  // afterwards. Parked on a mob's spawn point, as `save-resume` is, for a spot
  // known to be walkable and well off centre.
  const staged = await page.evaluate(() => {
    const w = window.world;
    const anchor = w.mobs[0];
    if (!anchor) throw new Error('the zone has no mob to park on');
    const spot = { x: Math.round(anchor.spawnX), y: Math.round(anchor.spawnY) };
    w.clearTarget();
    w.teleport(spot.x, spot.y);
    w.character.state.currency = 4321;
    return { name: w.character.state.name, zoneId: w.zone.id, spot };
  });

  await tapTab('options');
  const saveButtons = await page.evaluate(() =>
    ['download-save', 'copy-save-code', 'open-load-save'].map((action) => {
      const box = document
        .querySelector(`.hud-modal [data-action="${action}"]`)
        ?.getBoundingClientRect();
      return box ? { height: box.height, right: box.right, bottom: box.bottom } : null;
    }),
  );
  check(
    'the options menu offers the save, sized for a thumb and on the screen',
    saveButtons.every(
      (box) =>
        box !== null && box.height >= 44 && box.right <= PHONE.width && box.bottom <= PHONE.height,
    ),
    JSON.stringify(saveButtons),
  );

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('.hud-modal [data-action="download-save"]'),
  ]);
  const savePath = `${OUT}/save.json`;
  await download.saveAs(savePath);
  const file = JSON.parse(readFileSync(savePath, 'utf8'));
  const left = file.character?.position ?? { x: NaN, y: NaN };
  check(
    'Download Save hands the browser a file of the character as it stands',
    file.game === 'untitled-boomer-mmo' &&
      file.character.name === staged.name &&
      file.character.currency === 4321 &&
      file.character.zoneId === staged.zoneId &&
      Math.hypot(left.x - staged.spot.x, left.y - staged.spot.y) <= 4 &&
      /^untitled-boomer-mmo-.+-level-\d+-\d{4}-\d{2}-\d{2}\.json$/.test(
        download.suggestedFilename(),
      ),
    `${download.suggestedFilename()}: ${file.character?.name}, ${file.character?.currency} copper at ${left.x},${left.y}`,
  );

  await page.click('.hud-modal [data-action="copy-save-code"]');
  // Either answer will do: the clipboard is the browser's to refuse, and the
  // code on screen is the half that must always be there.
  await page.waitForFunction(() =>
    /Copied|Copy the code/.test(document.querySelector('.hud-modal')?.textContent ?? ''),
  );
  const code = await page.evaluate(
    () =>
      /** @type {HTMLTextAreaElement | null} */ (
        document.querySelector('.hud-modal [data-action="save-code-output"]')
      )?.value ?? '',
  );
  check(
    'Copy Save Code shows the code as well as copying it',
    /^[A-Za-z0-9+/]+=*$/.test(code) && code.length > 100,
    `${code.length} characters`,
  );
  await page.screenshot({ path: `${OUT}/40-options-save.png` });

  // A landscape phone is shorter than the whole menu, so it scrolls, and Close
  // is outside what scrolls — above the tab bar, where every counter stops.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  const short = await page.evaluate(() => {
    const box = document.querySelector('.hud-modal__box');
    const body = box?.querySelector('.hud-modal__body');
    const close = [...(box?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent === 'Close',
    );
    if (!box || !body || !close) throw new Error('the options menu has lost its parts');
    return {
      box: Math.round(box.getBoundingClientRect().bottom),
      close: Math.round(close.getBoundingClientRect().bottom),
      scrolls: body.scrollHeight > body.clientHeight,
      bar: Math.round(document.querySelector('.hud-tabs')?.getBoundingClientRect().top ?? 0),
    };
  });
  check(
    'on a landscape phone the options menu scrolls, and stops above the tab bar',
    short.scrolls && short.bar > 0 && short.box <= short.bar && short.close <= short.bar,
    JSON.stringify(short),
  );
  await page.screenshot({ path: `${OUT}/41-options-landscape.png` });
  await page.setViewportSize({ ...PHONE });
  await page.waitForTimeout(300);

  // The game moves on after the save left, so bringing it back is visible.
  await page.evaluate(() => {
    window.world.character.state.currency = 5;
  });
  await page.click('.hud-modal [data-action="open-load-save"]');
  await page.fill('[data-action="save-code-input"]', code);
  await page.click('[data-action="load-save-code"]');
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll('.hud-save__card')].map((card) => card.textContent ?? ''),
  );
  check(
    'a pasted code is shown beside the character playing now before anything is replaced',
    cards.length === 2 && cards.every((card) => card.includes(staged.name)),
    cards.join(' | '),
  );
  await page.screenshot({ path: `${OUT}/42-load-preview.png` });
  await page.click('[data-action="confirm-load-save"]');
  const armed = await page.evaluate(() => ({
    label: document.querySelector('[data-action="confirm-load-save"]')?.textContent ?? '',
    currency: window.world.character.state.currency,
  }));
  check(
    'the first Replace only arms it',
    armed.label.startsWith('Tap again') && armed.currency === 5,
    armed.label,
  );
  await page.click('[data-action="confirm-load-save"]');
  await page.waitForFunction(() => window.world?.character.state.currency === 4321, null, {
    timeout: 20000,
  });
  await draw();
  const loaded = await page.evaluate(() => ({
    x: Math.round(window.world.player.x),
    y: Math.round(window.world.player.y),
    zoneId: window.world.zone.id,
    huds: document.querySelectorAll('.hud').length,
    // The view's, not the HUD's: the character sheet draws its figure on a
    // canvas of its own, which comes and goes with the HUD it is in.
    canvases: [...document.querySelectorAll('canvas')].filter((c) => !c.closest('.hud')).length,
    modals: document.querySelectorAll('.hud-modal').length,
    ground: window.view.drawnCounts().ground,
    stored: JSON.parse(localStorage.getItem('untitled-boomer-mmo:character:v1') ?? '{}').currency,
  }));
  check(
    'the second tap loads it: one session ended and the save started where it left',
    loaded.zoneId === staged.zoneId &&
      Math.hypot(loaded.x - staged.spot.x, loaded.y - staged.spot.y) <= 4 &&
      loaded.stored === 4321,
    `${loaded.zoneId} at ${loaded.x},${loaded.y}, ${loaded.stored} copper stored`,
  );
  check(
    'and rebuilds one HUD over one view, with nothing left open',
    loaded.huds === 1 && loaded.canvases === 1 && loaded.ground === 1 && loaded.modals === 0,
    JSON.stringify(loaded),
  );

  // A new device: nobody to replace, so the creation screen offers the file.
  await tapTab('options');
  await page.click('.hud-modal [data-action="reset-character"]');
  await page.click('.hud-modal [data-action="reset-character"]');
  await page.waitForSelector('.create', { timeout: 20000 });
  await page.click('.create [data-action="open-load-save"]');
  await page.setInputFiles('[data-action="save-file-input"]', savePath);
  await page.waitForSelector('[data-action="confirm-load-save"]');
  const offer = await page.evaluate(() => ({
    label: document.querySelector('[data-action="confirm-load-save"]')?.textContent ?? '',
    cards: document.querySelectorAll('.hud-save__card').length,
  }));
  check(
    'the creation screen loads a chosen file, with nobody to replace',
    offer.label === `Play as ${staged.name}` && offer.cards === 1,
    `${offer.label}, ${offer.cards} card(s)`,
  );
  await page.screenshot({ path: `${OUT}/43-load-at-creation.png` });
  await page.click('[data-action="confirm-load-save"]');
  await page.waitForFunction(() => window.world != null && window.view != null, null, {
    timeout: 20000,
  });
  const resumed = await page.evaluate(() => ({
    name: window.world.character.state.name,
    currency: window.world.character.state.currency,
    create: document.querySelector('.create') !== null,
  }));
  check(
    'and plays as the character in it',
    resumed.name === staged.name && resumed.currency === 4321 && !resumed.create,
    `${resumed.name}, ${resumed.currency} copper`,
  );

  // Version 1's characters retire (decision 82): a save written before version
  // 2 is dropped on the next load, and the creation screen names who was in it,
  // the once. Marked through the live game, since the unload handler writes the
  // character on the way out and would overwrite a hand-written save.
  const retiring = await page.evaluate(() => {
    const { state } = window.world.character;
    state.version = 27;
    return { name: state.name, level: state.level, classId: state.classId };
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.create', { timeout: 60000 });
  const retiredLine = await page.evaluate(
    () => document.querySelector('.create__retired')?.textContent ?? null,
  );
  check(
    'a version 1 save retires on the next load, and the creation screen says who',
    retiredLine ===
      `${retiring.name}, level ${retiring.level} ${retiring.classId}, retired with version 1. ` +
        'Version 2 is a fresh start.',
    `${retiredLine}`,
  );
  await page.screenshot({ path: `${OUT}/44-retired.png` });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.create', { timeout: 60000 });
  check(
    'and says it the once, since the save is gone',
    await page.evaluate(() => document.querySelector('.create__retired') === null),
  );
  // Back as the character in the file, for everything after this.
  await page.click('.create [data-action="open-load-save"]');
  await page.setInputFiles('[data-action="save-file-input"]', savePath);
  await page.click('[data-action="confirm-load-save"]');
  await page.waitForFunction(() => window.world != null && window.view != null, null, {
    timeout: 20000,
  });
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
  await startIdle();
  await page.evaluate(() => {
    const w = window.world;
    w.character.state.level = 1;
    w.character.state.xp = 0;
    w.character.state.inventory = { 'rat-bones': w.character.carryCapacity() };
    const afk = w.character.state.afk;
    if (!afk) throw new Error('the idle panel left no parked session behind');
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
  // Everything above runs at 40ms a frame on a machine that draws one in a
  // fraction of that. A cheap phone that cannot keep up is the case the
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
  // is a slow device's, and whether the camera a tap is read through has been
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
  const stoodSlow = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));
  await touchDrag({ x: 195, y: 400 }, 140);
  const stayedSlow = await page.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
    walking: window.world.player.hasMoveTarget(),
  }));
  check(
    'a finger drag still asks for nothing at 7fps',
    !stayedSlow.walking && Math.hypot(stayedSlow.x - stoodSlow.x, stayedSlow.y - stoodSlow.y) < 1,
    `player at ${Math.round(stayedSlow.x)},${Math.round(stayedSlow.y)}, walking: ${stayedSlow.walking}`,
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

  // --- The frame budget, read where it actually bites.
  //
  // This is the gate a change to what is drawn is measured against, and it is
  // here rather than on the unthrottled sections above because a machine that
  // draws a frame in a fraction of a millisecond has no budget to blow. The reading
  // is a rolling mean over the last frames drawn, every one of which was drawn
  // under the throttle set at the top of this section.
  //
  // On the mean rather than the worst: one GC pause in thirty frames is not a
  // regression, and a ceiling that fails on it is a ceiling nobody trusts. The
  // worst is printed anyway, because when this does fail the shape of the
  // failure is the first question. ---
  const slowDraw = await page.evaluate(() => window.view.drawTime());
  check(
    'a frame draws inside the budget on an eight-times slower CPU',
    slowDraw.samples >= 20 && slowDraw.averageMs < SLOW_DRAW_BUDGET_MS,
    `${slowDraw.averageMs.toFixed(2)}ms mean over ${slowDraw.samples} frames ` +
      `(worst ${slowDraw.worstMs.toFixed(2)}ms), budget ${SLOW_DRAW_BUDGET_MS}ms`,
  );
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
}

async function ranger() {
  // --- The ranger: the third card on the creation screen, the arrows in the
  // corner, and a shot through the real renderer.
  //
  // The rules — an arrow a shot, the refill, fists when dry, the two hands, the
  // shop's bundle — are tests/world/ranger.test.ts. What only a browser shows is
  // the card actually offered, the quiver's bar laid out beside the target frame
  // at phone size, and an arrow drawn in flight and handed back when it lands.
  // Last, since it rerolls the character every section above was written for. ---
  await tapTab('options');
  await page.click('.hud-modal [data-action="reset-character"]');
  await page.click('.hud-modal [data-action="reset-character"]');
  await page.waitForSelector('.create', { timeout: 20000 });
  const offered = await page.evaluate(() =>
    [...document.querySelectorAll('.create__card')].map(
      (card) => /** @type {HTMLElement} */ (card).dataset.class ?? '',
    ),
  );
  check(
    'the creation screen offers all three classes',
    offered.join(',') === 'warrior,wizard,ranger',
    offered.join(', '),
  );
  await page.click('.create__card[data-class="ranger"]');
  await page.click('.create__begin');
  await page.waitForFunction(() => window.world != null, null, { timeout: 20000 });
  await quietTips();

  const corner = () =>
    page.evaluate(() => {
      const bar = document.querySelector('.hud-player__quiver');
      const column = document.querySelector('.hud-player')?.getBoundingClientRect();
      const target = document.querySelector('.hud-target')?.getBoundingClientRect();
      return {
        shown: bar !== null && !bar.classList.contains('hud-hidden'),
        label: bar?.querySelector('.hud-bar__label')?.textContent ?? '',
        // The last bar sits inside the column it was laid out for, and the
        // column stays clear of the target frame across the top row.
        inside:
          column !== undefined &&
          (bar?.getBoundingClientRect().bottom ?? Infinity) <= column.bottom + 1,
        clear: column !== undefined && target !== undefined && column.right <= target.left,
        quiver: window.world.character.state.quiver,
        weapon: window.world.character.state.gear.weapon,
      };
    });
  const start = await corner();
  check(
    'a ranger boots holding a bow, with a full quiver counted in the corner',
    start.weapon === 'shortbow' && start.shown && start.label === '50 / 50 arrows',
    `${start.weapon}; "${start.label}"`,
  );

  // Something selected and let go once first, so the ring under a target —
  // uploaded the first time anything is selected — is counted before the
  // reading the arrow is measured against rather than after it.
  await page.evaluate(() => {
    const w = window.world;
    w.mobs.forEach((m) => m.disengage());
    const rat = w.mobs.find((m) => m.isAlive() && m.definition.id === 'rat');
    if (!rat) throw new Error('town has no rat to shoot');
    w.setTarget(rat);
  });
  await draw();
  await page.evaluate(() => window.world.clearTarget());
  await sweep();
  const settled = async () => {
    for (let wait = 0; wait < 40 && (await drawnCounts()).fx > 0; wait += 1) {
      await page.waitForTimeout(100);
    }
    await draw();
    return canvases();
  };
  const before = await settled();
  // Then a rat stood inside the bow's reach and outside a fist's, and made the target.
  await page.evaluate(() => {
    const w = window.world;
    const rat = w.mobs.find((m) => m.isAlive() && m.definition.id === 'rat');
    if (!rat) throw new Error('town has no rat to shoot');
    rat.setPosition(w.player.x, w.player.y - 150);
    w.setTarget(rat);
  });
  // Read with a target up, since the frame it has to clear is hidden without
  // one — and before the shot, which a crit can make the rat's last.
  await draw();
  const framed = await corner();
  const shot = await stepFor(
    () =>
      page.evaluate(() => ({
        left: window.world.character.state.quiver?.count ?? 0,
        label: document.querySelector('.hud-player__quiver .hud-bar__label')?.textContent ?? '',
      })),
    (seen) => seen.left < 50,
    'the ranger to loose an arrow',
    10000,
  );
  await draw();
  const flying = await drawnCounts();
  check(
    "the quiver's bar fits the player column and clears the target frame",
    framed.inside && framed.clear,
    JSON.stringify({ inside: framed.inside, clear: framed.clear }),
  );
  check(
    'a shot spends an arrow, and the corner counts it',
    shot.left === 49 && shot.label === '49 / 50 arrows',
    `${shot.left} left; "${shot.label}"`,
  );
  check('and draws the arrow in flight', flying.fx > 0, `${flying.fx} effect(s) drawn`);
  await page.screenshot({ path: `${OUT}/20-ranger.png` });

  await page.evaluate(() => {
    window.world.clearTarget();
    window.world.mobs.forEach((m) => m.disengage());
  });
  const after = await settled();
  check(
    'an arrow that has landed leaves nothing behind',
    after <= before,
    `${before} -> ${after} canvases`,
  );
}

/**
 * Into Greyford from wherever the player is, the way a player gets there: west
 * out of Lampton onto the mill road, and north off it inside its mouth.
 */
async function toGreyford() {
  if ((await zoneId()) === 'greyford') return;
  if ((await zoneId()) !== 'old-mill-road') {
    await park();
    await page.evaluate(() => {
      const w = window.world;
      w.teleport(33, w.worldHeight / 2);
    });
    await stepUntilZone('old-mill-road', 'the west road out of town');
  }
  await page.evaluate(() => {
    const w = window.world;
    w.teleport(w.worldWidth / 2, 33);
  });
  await stepUntilZone('greyford', 'the road north into Greyford');
}

async function fletchersBench() {
  // --- The fletcher's bench, the third station built into a zone and the only
  // one in a zone nothing above visits.
  //
  // The rules — fifteen a job, arrows into the quiver, the camp settling to two
  // inputs — are tests/world/fletching.test.ts. What only a browser shows is the
  // prop drawn and picked by a real click, the panel headed for it and saying
  // how many a row makes, a real tap running the channel, and the bench let go
  // of when the zone comes down. Walked to, since walking is the
  // only way into a zone: west to the mill road and north into Greyford. ---
  await toGreyford();
  await sweep();
  const before = await canvases();

  await page.evaluate(() => {
    const w = window.world;
    const bench = w.stations.find((s) => s.station === 'bench');
    w.clearTarget();
    w.character.state.inventory = { logs: 2 };
    window.events.emit('inventory-changed', w.character.state.inventory);
    // Set rather than awarded, for the reason the forge section gives: a run of
    // level-up toasts is HUD furniture that swallows the taps after it.
    w.character.state.skills.fletching = { level: 9, xp: 0 };
    w.teleport(bench?.x ?? 0, (bench?.y ?? 0) + 40);
  });
  await step(2);
  await draw();
  await clickAt(await screenAt(BENCH));
  await step(2);
  const opened = await page.evaluate(() => ({
    title: document.querySelector('.hud-modal__box--station .hud-modal__title')?.textContent ?? '',
    note:
      document.querySelector('.hud-modal__box--station [data-recipe="arrow-shafts"]')?.parentElement
        ?.lastElementChild?.textContent ?? '',
  }));
  check(
    "a real click on the fletcher's bench opens its list, saying how many a job makes",
    opened.title === "Fletcher's Bench" && opened.note.includes('makes 15'),
    `"${opened.title}", "${opened.note}"`,
  );

  await page.click('.hud-modal__box--station [data-recipe="arrow-shafts"]');
  await step(12, 200);
  const cut = await page.evaluate(() => ({
    logs: window.world.character.state.inventory.logs ?? 0,
    shafts: window.world.character.state.inventory['arrow-shafts'] ?? 0,
  }));
  check(
    'a tap on a bench row cuts a log into fifteen shafts',
    cut.shafts === 15 && cut.logs === 1,
    `${cut.logs} logs, ${cut.shafts} shafts`,
  );
  await page.screenshot({ path: `${OUT}/22-fletchers-bench.png` });

  // Off the bench and out of the yard, then back: the bench is built with the
  // zone, so it has to come down with it and go back up without a leak.
  await page.evaluate(() => {
    const w = window.world;
    w.clearTarget();
    w.character.state.inventory = {};
    window.events.emit('inventory-changed', {});
    w.teleport(w.worldWidth / 2, w.worldHeight - 33);
  });
  await stepUntilZone('old-mill-road', 'the road south out of Greyford');
  await page.evaluate(() => {
    const w = window.world;
    w.teleport(w.worldWidth / 2, 33);
  });
  await stepUntilZone('greyford', 'the road north back into Greyford');
  await sweep();
  const after = await canvases();
  check(
    'a round trip out of Greyford lets go of everything the bench was drawn with',
    after <= before,
    `${before} -> ${after} canvases`,
  );
}

async function still() {
  // --- The still at Greyford, brewing's station (version 2 phase E2), and the
  // potion it makes drunk out of the bag.
  //
  // The rules — two herbs a tonic, a clock on game time, what each potion does —
  // are tests/systems/brewing.test.ts and tests/world/brewing.test.ts. What only
  // a browser shows is the still drawn and picked by a real click, its panel
  // headed for it, a real tap brewing, a real tap on Drink putting the potion's
  // icon in the player column, and the still let go of with the zone. ---
  await toGreyford();
  await sweep();
  const before = await canvases();

  await page.evaluate(() => {
    const w = window.world;
    const still = w.stations.find((s) => s.station === 'still');
    w.clearTarget();
    w.character.state.inventory = { samphire: 2 };
    window.events.emit('inventory-changed', w.character.state.inventory);
    // Set rather than awarded, for the reason the forge section gives.
    w.character.state.skills.brewing = { level: 9, xp: 0 };
    w.teleport(still?.x ?? 0, (still?.y ?? 0) + 40);
  });
  await step(2);
  await draw();
  await clickAt(await screenAt(STILL));
  await step(2);
  const title = await page.evaluate(
    () => document.querySelector('.hud-modal__box--station .hud-modal__title')?.textContent ?? '',
  );
  check('a real click on the still opens its list', title === 'Still', `"${title}"`);

  await page.click('.hud-modal__box--station [data-recipe="samphire-tonic"]');
  await step(16, 200);
  const brewed = await page.evaluate(
    () => window.world.character.state.inventory['samphire-tonic'] ?? 0,
  );
  check('a tap on a still row brews two samphire into a tonic', brewed === 1, `${brewed} tonic`);
  await page.screenshot({ path: `${OUT}/23-still.png` });

  await page.click('.hud-modal [data-action="close-station"]');
  await step(2);
  await tapTab('inventory');
  await page.click('.hud-sheet[data-sheet="inventory"] .hud-item[data-item="samphire-tonic"]');
  await page.click('.hud-sheet[data-sheet="inventory"] [data-item-action="drink"]');
  await step(2);
  const drunk = await page.evaluate(() => ({
    left: window.world.character.state.inventory['samphire-tonic'] ?? 0,
    icons: document.querySelectorAll('.hud-player .hud-effect').length,
  }));
  check(
    'a real tap on Drink spends the tonic and puts its mark in the player column',
    drunk.left === 0 && drunk.icons > 0,
    `${drunk.left} left, ${drunk.icons} icon(s)`,
  );
  await tapTab('inventory');

  // Out of the yard and back: the still is built with the zone, so it has to
  // come down with it and go back up without a leak.
  await page.evaluate(() => {
    const w = window.world;
    w.clearTarget();
    w.character.state.inventory = {};
    w.character.state.potions = {};
    window.events.emit('inventory-changed', {});
    w.teleport(w.worldWidth / 2, w.worldHeight - 33);
  });
  await stepUntilZone('old-mill-road', 'the road south out of Greyford');
  await page.evaluate(() => {
    const w = window.world;
    w.teleport(w.worldWidth / 2, 33);
  });
  await stepUntilZone('greyford', 'the road north back into Greyford');
  await sweep();
  const after = await canvases();
  check(
    'a round trip out of Greyford lets go of everything the still was drawn with',
    after <= before,
    `${before} -> ${after} canvases`,
  );
}

async function backRoom() {
  // --- The fettler's store at Greyford: the one door nobody sees from the
  // yard, since it is round the back, and the one secret that lies in a room
  // (decision 120). A tap on the store walks round to its door and a second
  // goes in, where the back room is found and said on the card. What only a
  // browser has is the pick on a building whose front is behind another's roof,
  // the walk round, and the room cut away round the find. ---
  await toGreyford();
  const store = await page.evaluate(() => {
    const w = window.world;
    const found = w.buildings.find((each) => each.definition.id === 'store');
    w.character.state.secrets = w.character.state.secrets.filter((id) => id !== 'back-room');
    w.clearTarget();
    w.closeCounters();
    w.player.stopMoving();
    return found
      ? {
          x: found.x,
          y: found.y,
          width: found.definition.body.width,
          depth: found.definition.body.height,
        }
      : null;
  });
  if (!store) {
    check('Greyford has a store behind the longhouse', false);
    return;
  }
  await page.evaluate((at) => window.world.teleport(at.x, at.y + 300), store);
  await step(2);
  await draw();

  // Its roof over the longhouse's, which is the store's alone: the longhouse
  // in front stands taller than the store is deep, so its roof is drawn over
  // the whole of the store's footprint, and a tap there is the fettler's.
  /** @param {{ x: number; y: number; depth: number }} at */
  const back = (at) => window.view.worldToScreen(at.x, at.y - at.depth / 2 - 60);
  await clickAt(await page.evaluate(back, store));
  const round = await stepFor(
    () =>
      page.evaluate(() => ({
        y: window.world.player.y,
        walking: window.world.player.hasMoveTarget(),
      })),
    (spot) => !spot.walking,
    'the walk round the longhouse to the store door',
    30000,
  );
  check(
    'a tap on the store walks round the back to its door',
    round.y < store.y - store.depth / 2,
    `player at y ${Math.round(round.y)}, back wall at ${store.y - store.depth / 2}`,
  );

  await draw();
  await clickAt(await page.evaluate(back, store));
  const card = await stepFor(
    () =>
      page.evaluate(() => {
        const found = document.querySelector('.hud-tip[data-find]');
        return found && !found.classList.contains('hud-hidden')
          ? found.getAttribute('data-find')
          : null;
      }),
    (value) => value !== null,
    'the walk into the store to find the back room',
    30000,
  );
  check(
    'and a second tap goes in, where the back room is found',
    card === 'back-room' &&
      (await page.evaluate(() => window.world.character.state.secrets.includes('back-room'))),
    `${card}`,
  );
  await draw();
  await page.screenshot({ path: `${OUT}/22b-back-room.png` });
  await page.click('.hud-tip [data-action="tip-heard"]');
  await draw();
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
  ['hud-art', hudArt],
  ['landscape', landscape],
  ['picking', picking],
  ['interiors', interiors],
  ['secrets', secrets],
  ['context-menu', contextMenu],
  ['feedback', feedback],
  ['loot-piles', lootPiles],
  ['bank', bank],
  ['trainer', trainer],
  ['bounty-board', bountyBoard],
  ['forge', forge],
  ['drag', canvasDrag],
  ['heading', heading],
  ['keyboard', keyboard],
  ['touch', touchGestures],
  ['player-column', playerColumn],
  ['training-bar', trainingBar],
  ['sheets', sheets],
  ['achievements', achievements],
  ['skills-book', skillsBook],
  ['idle-panel', idlePanel],
  ['bag', bagSheet],
  ['character-sheet', characterSheet],
  ['zone-map', zoneMapSheet],
  ['minimap', minimapCorner],
  ['locked-zone', lockedZone],
  ['tips', tips],
  ['reset', reset],
  ['save-resume', saveResume],
  ['save-transfer', saveTransfer],
  ['offline-camping', offlineCamping],
  ['throttled', throttled],
  ['ranger', ranger],
  ['fletchers-bench', fletchersBench],
  ['back-room', backRoom],
  ['still', still],
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
