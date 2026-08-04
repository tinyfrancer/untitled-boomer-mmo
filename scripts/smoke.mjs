/**
 * Browser smoke check: what only a real run in a real browser can show.
 *
 * The simulation is headless and unit-tested now — `tests/world/` drives whole
 * zones through combat, leashing, gathering, trading, camping and casting with
 * no engine underneath. So this covers the other half, and nothing else:
 *
 *   - the scenes boot, and the flows that cross between them work
 *   - real mouse and real key events reach the game
 *   - the view builds and *unbuilds* itself, which no state assertion can see
 *   - the HUD's geometry at real viewport sizes, and its scrolling and clipping
 *   - the save round trip through an actual page reload
 *
 * It reaches the game through two dev-only handles, neither of which mentions
 * Phaser: `window.world` for everything about the simulation and `window.view`
 * for the few questions only the renderer can answer (see src/types/debugView.ts).
 * That is deliberate — most of this file should survive the Three.js port
 * unchanged.
 *
 * The game runs under `?loop=manual`, so nothing advances until this script
 * cranks it with `view.step()`. Waits are therefore in *game* milliseconds and
 * are deterministic; a loaded CI runner makes the script slower, not flakier.
 *
 * The second half is that check again in `?renderer=3d`, on its own page. It is
 * not a duplicate: the two hosts are peers until Phaser is deleted, so a duty
 * one of them forgot — binding the keyboard, persisting on unload, resizing the
 * drawing buffer — is invisible to the other's coverage. It also covers what
 * only that renderer has: the GPU teardown, a real finger rather than a mouse,
 * a landscape resize, and a pass under a CPU throttled eight times down.
 *
 * Usage: npm run dev, then `node scripts/smoke.mjs [--headed]`.
 * Screenshots land in .smoke/.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SMOKE_URL ?? 'http://localhost:5173';
const URL = `${BASE}${BASE.includes('?') ? '&' : '?'}loop=manual`;
const OUT = '.smoke';
const headed = process.argv.includes('--headed');

// One simulated frame. 40ms is 25fps: fast enough that arrival bands behave the
// way they do on a real machine, slow enough that a few hundred frames cover a
// minute of game time.
const FRAME_MS = 40;
const FRAMES_PER_POLL = 12;

mkdirSync(OUT, { recursive: true });

const results = [];
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
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));

// --- Driving the game ------------------------------------------------------

/** Advances the simulation by hand. Returns once those frames have been run. */
const step = (frames = 1, deltaMs = FRAME_MS) =>
  page.evaluate(([f, d]) => window.view.step(d, f), [frames, deltaMs]);

/**
 * Lets the browser draw. The camera follows the player on the render loop
 * rather than on our steps, so anything about to read a screen coordinate has
 * to give it a frame first.
 */
const draw = () => page.waitForTimeout(80);

// Distances here are Math.hypot rather than Phaser.Math.Distance.Between:
// Phaser 3 left a `Phaser` global these evaluate bodies could reach and Phaser
// 4 does not, so the engine call threw ReferenceError inside the browser. The
// scaffolding never needed the engine for a hypotenuse anyway.
const worldState = () =>
  page.evaluate(() => {
    const world = window.world;
    if (!world) return null;
    const p = world.player;
    return {
      zoneId: world.zone.id,
      player: { hp: p.hp, maxHp: p.maxHp, level: p.level, x: Math.round(p.x), y: Math.round(p.y) },
      mobs: world.mobs.map((m) => ({
        name: m.name,
        level: m.level,
        hp: m.hp,
        maxHp: m.maxHp,
        alive: m.isAlive(),
        engaged: m.isEngaged(),
        dist: Math.round(Math.hypot(m.x - p.x, m.y - p.y)),
      })),
      nodes: world.nodes.map((n) => n.definition.id),
      target: world.target?.name ?? null,
      shopOpen: world.shopNpc !== null,
      afk: world.afkActive,
      inventory: { ...world.character.state.inventory },
    };
  });

/**
 * Steps until the world satisfies `fn`. The budget is in game milliseconds, so
 * it means the same thing on a fast laptop and a loaded CI runner — which is
 * the whole point of `?loop=manual`.
 */
const stepUntil = async (fn, label, budgetMs = 120000) => {
  let last = await worldState();
  for (let elapsed = 0; elapsed < budgetMs; elapsed += FRAMES_PER_POLL * FRAME_MS) {
    if (last && fn(last)) return last;
    await step(FRAMES_PER_POLL);
    last = (await worldState()) ?? last;
  }
  if (last && fn(last)) return last;
  throw new Error(`timed out waiting for: ${label}\nlast state: ${JSON.stringify(last)}`);
};

/** Drops the player back on the zone's spawn point with nothing selected. */
const park = async () => {
  await page.evaluate(() => {
    window.world.clearTarget();
    window.world.teleport(window.world.spawnPoint.x, window.world.spawnPoint.y);
  });
  await step(2);
  await draw();
};

/** A real press-and-release at a screen point, given a frame to be processed. */
const clickAt = async (point) => {
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.up();
  await draw();
};

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  // Generous: on a cold Vite cache the first request compiles all of Phaser,
  // which takes far longer than any later wait in this script.
  await page.waitForFunction(() => window.game?.scene?.getScene('Preload'), null, {
    timeout: 120000,
  });

  // --- Booting: a fresh character through the real creation screen, which is
  // plain HTML — so this is the form a player fills in, typed and clicked. ---
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.create', { timeout: 20000 });
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
    timeout: 20000,
  });
  const boot = await worldState();
  check(
    'the zone scene builds a view of the world it was handed',
    boot.mobs.length === 9 && boot.nodes.length === 6,
    `${boot.mobs.length} mobs, ${boot.nodes.length} nodes`,
  );

  // Collision boxes are data now (EnemyDefinition.body, ResourceNodeDefinition
  // .body) rather than measurements off a texture that is going away with the
  // 2D renderer. Nothing in the unit suite can see a generated texture, so this
  // is the only place the two can be held together — and a drift here is a mob
  // that collides with something other than what you can see.
  const bodies = await page.evaluate(() => {
    const drawn = (key) => {
      const frame = window.game.textures.get(key).get();
      return { width: frame.width, height: frame.height };
    };
    const rat = window.world.mobs.find((m) => m.definition.id === 'rat');
    const tree = window.world.nodes.find((n) => n.definition.id === 'tree');
    return [
      { id: 'rat', body: rat.definition.body, texture: drawn(rat.definition.textureKey) },
      { id: 'tree', body: tree.definition.body, texture: drawn(tree.definition.textureKey) },
    ];
  });
  // The old canvases truncated to whole pixels, so a fraction of a pixel apart
  // is the data being right rather than the texture disagreeing.
  const bodiesMatch = bodies.every(
    (b) =>
      Math.abs(b.body.width - b.texture.width) < 1 &&
      Math.abs(b.body.height - b.texture.height) < 1,
  );
  check(
    'collision bodies match the textures drawn for them',
    bodiesMatch,
    bodies.map((b) => `${b.id} ${b.body.width}x${b.body.height}`).join(', '),
  );
  await page.screenshot({ path: `${OUT}/2-town.png` });

  // --- The view's own teardown. A zone change is a view rebuild, not a scene
  // restart, so everything the last zone drew has to come down by hand. This is
  // invisible to every state assertion: ten round trips once took the display
  // list from 44 objects to 764 with the whole unit suite still green. Run
  // before anything fights, so no floating number is mid-flight in either
  // count. ---
  const drawn = () => page.evaluate(() => window.view.drawnCounts());
  const beforeTrip = await drawn();
  for (let trip = 0; trip < 3; trip += 1) {
    await page.evaluate(() => {
      const w = window.world;
      w.teleport(w.worldWidth / 2, w.worldHeight - 33);
    });
    await stepUntil((s) => s.zoneId === 'beach', 'the south exit to load the beach');
    await page.evaluate(() => {
      const w = window.world;
      w.teleport(w.worldWidth / 2, 33);
    });
    await stepUntil((s) => s.zoneId === 'town', 'the north exit to return to town');
  }
  const afterTrip = await drawn();
  check(
    'three zone round trips leave the view exactly as they found it',
    JSON.stringify(beforeTrip) === JSON.stringify(afterTrip),
    `${JSON.stringify(beforeTrip)} -> ${JSON.stringify(afterTrip)}`,
  );
  check(
    'the rebuilt view has one of everything it should',
    afterTrip.ground === 1 && afterTrip.signposts === 2 && afterTrip.npcs === 1,
    `${afterTrip.ground} ground layer(s), ${afterTrip.signposts} signpost(s), ` +
      `${afterTrip.npcs} shopkeeper(s), ${afterTrip.labels} label(s)`,
  );

  // Walking east into the third zone, so the round trip above is not the only
  // exit ever taken.
  await page.evaluate(() => {
    const w = window.world;
    w.teleport(w.worldWidth - 33, w.worldHeight / 2);
  });
  await stepUntil((s) => s.zoneId === 'bandit-camp', 'the east exit to load the bandit camp');
  await page.screenshot({ path: `${OUT}/9-bandit-camp.png` });
  await page.evaluate(() => {
    const w = window.world;
    w.teleport(33, w.worldHeight / 2);
  });
  await stepUntil((s) => s.zoneId === 'town', 'the west exit to return to town');
  check('zone travel round-trips town -> beach -> town -> bandit camp -> town', true);

  // --- The figure's legs: walking plays the baked leg-phase animation and
  // standing still puts it back on the neutral frame. The walk belongs to the
  // sprite rather than the simulation, so it is the view that is asked. ---
  await park();
  await page.evaluate(() => {
    const w = window.world;
    w.player.moveTo(w.player.x + 300, w.player.y);
  });
  await step(4);
  const walking = await page.evaluate(() => window.view.playerFigure());
  await page.evaluate(() => window.world.player.stopMoving());
  await step(4);
  const standing = await page.evaluate(() => window.view.playerFigure());
  check('the figure animates its legs while walking', walking.walking === true, walking.pose);
  check(
    'the figure returns to its standing frame when it stops',
    standing.walking === false && standing.pose.endsWith(':0'),
    standing.pose,
  );

  // --- Real input: genuine mouse clicks must select world objects. The
  // pointerdown event's own currentlyOver list proved timing-flaky with two
  // active scenes (see ZoneScene.hitTestWorld), and every world test calls
  // setTarget directly — so this is the only coverage of the real click path.
  // Three attempts, because the original bug was intermittent. ---
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await park();
    const ratScreen = await page.evaluate(() => {
      const mob = window.world.mobs.find((m) => m.isAlive());
      return window.view.worldToScreen(mob.x, mob.y);
    });
    await clickAt(ratScreen);
    const targeted = await page.evaluate(() => window.world.target?.name ?? null);
    check(`real mouse click selects a rat (attempt ${attempt})`, targeted === 'Rat');
  }

  // The shopkeeper is out of interact range from the spawn point, so this also
  // covers the click walking the player over before the shop opens.
  await park();
  const npcScreen = await page.evaluate(() => {
    const npc = window.world.npcs[0];
    return window.view.worldToScreen(npc.x, npc.y);
  });
  await clickAt(npcScreen);
  await stepUntil((s) => s.shopOpen, 'the tapped shopkeeper to open the shop');
  check('real mouse click walks to the shopkeeper and opens the shop', true);

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
  await page.screenshot({ path: `${OUT}/4-shop.png` });

  // Closing from the panel's own X, which asks the world rather than telling it.
  await page.click('.hud-modal [data-action="close-shop"]');
  await stepUntil((s) => !s.shopOpen, 'the shop panel to close the shop');
  check(
    'the shop panel closes the shop it was opened by',
    (await page.evaluate(() => document.querySelector('.hud-modal__box--shop') === null)) === true,
  );

  // --- A real fight, for the HUD's benefit: the combat log is fed by events
  // crossing from the simulation into the overlay, which nothing headless can
  // show. ---
  await page.evaluate(() => {
    const w = window.world;
    const rat = w.mobs.find((m) => m.level === 3) ?? w.mobs[0];
    w.teleport(rat.x, rat.y - 40);
    w.setTarget(rat);
  });
  const fought = await stepUntil(
    (s) => s.player.hp < s.player.maxHp && s.mobs.some((m) => m.engaged && m.hp < m.maxHp),
    'a fight to land hits in both directions',
  );
  check(
    'both halves of a fight reach the screen',
    true,
    `player ${fought.player.hp}/${fought.player.maxHp}`,
  );
  await page.screenshot({ path: `${OUT}/3-combat.png` });

  const logged = await page.evaluate(() => ({
    lines: [...document.querySelectorAll('.hud-log__line')].map((n) => n.textContent),
    openTab: document.querySelector('.hud-tabs__tab.is-selected')?.dataset.tab ?? null,
  }));
  check(
    'the combat log records the fight',
    logged.lines.some((l) => l.includes('You hit')) &&
      logged.lines.some((l) => l.includes('hits you for')),
    `last: ${logged.lines.filter((l) => l.trim()).at(-1)}`,
  );
  // The tab bar opens one sheet at a time, so the log starts closed even on a
  // desktop: the character sheet is what a roomy screen opens by default.
  check(
    'the character sheet is the default sheet on a desktop viewport',
    logged.openTab === 'character',
  );

  // --- Real key events, not method calls: InputState is fed by its own DOM
  // listeners, so nothing but a browser proves that wiring is live. ---
  await page.evaluate(() => {
    const w = window.world;
    const rat = w.mobs.find((m) => m.level === 1 && m.isAlive());
    w.clearTarget();
    w.teleport(rat.x - 60, rat.y);
    w.player.restoreToFull();
    window.game.events.emit('afk-toggle-requested');
  });
  const camped = await stepUntil((s) => s.afk && s.target !== null, 'the camp to pick a fight');
  check('the AFK camp fights unprompted', true, `engaged ${camped.target}`);

  await page.keyboard.down('w');
  await step(2);
  const released = await worldState();
  await page.keyboard.up('w');
  check('a real movement key takes the controls back from the camp', released.afk === false);

  // Escape reaches the world as a drained action rather than a key listener.
  // Select the furthest live mob: one in range would be auto-attacked to death,
  // and a kill clears the target by itself.
  const selected = await page.evaluate(() => {
    const w = window.world;
    const furthest = w.mobs
      .filter((m) => m.isAlive())
      .sort(
        (a, b) =>
          Math.hypot(b.x - w.player.x, b.y - w.player.y) -
          Math.hypot(a.x - w.player.x, a.y - w.player.y),
      )[0];
    w.setTarget(furthest);
    return w.target?.name ?? null;
  });
  check('a target can be selected to press Escape against', selected !== null, `${selected}`);
  await page.keyboard.press('Escape');
  await step(2);
  const cleared = await worldState();
  check('a real Escape press clears the selected target', cleared.target === null);

  // --- The HUD: tabs, sheets and the log's cap. The tab bar is a DOM overlay
  // now, so these are real clicks on real buttons rather than method calls —
  // which is also what proves a tap landing on the bar never reaches the world
  // underneath it. ---
  const tapTab = async (tab) => {
    await page.click(`.hud-tabs__tab[data-tab="${tab}"]`);
    await page.waitForTimeout(80);
  };
  const sheetVisibility = () =>
    page.evaluate(() => {
      // Computed display, not the class: a hidden sheet that still lays out is
      // an invisible wall over the tab bar, and asking the class would have
      // called that closed.
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
        selectedTab: document.querySelector('.hud-tabs__tab.is-selected')?.dataset.tab ?? null,
      };
    });

  await tapTab('log');
  const tabbedOpen = await sheetVisibility();
  await tapTab('log');
  const tabbedClosed = await sheetVisibility();
  check(
    'a tab opens its sheet and closes the one already open',
    tabbedOpen.log === true && tabbedOpen.character === false,
  );
  check(
    'the open sheet lights its tab in the bar',
    tabbedOpen.selectedTab === 'log' && tabbedClosed.selectedTab === null,
  );
  check('tapping the open tab again closes it', tabbedClosed.log === false);

  const exclusive = [];
  for (const tab of ['character', 'inventory', 'quests', 'log']) {
    await tapTab(tab);
    const seen = await sheetVisibility();
    exclusive.push([seen.character, seen.inventory, seen.quests, seen.log].filter(Boolean).length);
  }
  await tapTab('log');
  await tapTab('character');
  check(
    'only one sheet is ever open at a time',
    exclusive.every((count) => count === 1),
    `open counts ${exclusive.join(',')}`,
  );

  // A tap that lands on the bar is a HUD hit and must never also be a move
  // order. In 2D this needed an explicit hit test between two Phaser scenes; an
  // opaque DOM bar over the canvas swallows it by construction, and this is
  // what says so.
  await park();
  const beforeBarTap = await worldState();
  // The bar's own padding rather than a button in it, so the tap proves the
  // background swallows the click without also toggling a sheet.
  const barBox = await page.evaluate(() => {
    const rect = document.querySelector('.hud-tabs').getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.bottom - 3 };
  });
  await clickAt(barBox);
  await step(6);
  const afterBarTap = await worldState();
  check(
    'a tap on the tab bar never falls through to the world as a move order',
    afterBarTap.player.x === beforeBarTap.player.x &&
      afterBarTap.player.y === beforeBarTap.player.y,
    `${beforeBarTap.player.x},${beforeBarTap.player.y} -> ${afterBarTap.player.x},${afterBarTap.player.y}`,
  );

  // How long the log is kept is CombatLogSystem's business and unit-tested
  // there; what only a browser shows is that the sheet stays pinned to the
  // newest line rather than scrolling away from it.
  const cappedLog = await page.evaluate(() => {
    for (let i = 0; i < 200; i += 1) {
      window.game.events.emit('combat-log', { text: `filler ${i}`, color: '#fff' });
    }
    const lines = [...document.querySelectorAll('.hud-log__line')].map((n) => n.textContent);
    return { shown: lines.length, last: lines.at(-1) };
  });
  check(
    'the log keeps the newest line on screen after two hundred more',
    cappedLog.shown === 8 && cappedLog.last === 'filler 199',
    `${cappedLog.shown} lines, last: ${cappedLog.last}`,
  );

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
    const sheet = document.querySelector('.hud-sheet[data-sheet="feats"]');
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
  await page.screenshot({ path: `${OUT}/12-achievements.png` });

  // The title has to survive the round trip the picker actually uses: the HUD
  // asks, the world re-checks the kills back it, and the player column redraws.
  // It gets its own line there, so the column has to grow to hold it.
  const columnHeight = () =>
    page.evaluate(() =>
      Math.round(document.querySelector('.hud-player').getBoundingClientRect().height),
    );
  const beforeTitle = await columnHeight();
  await page.click('.hud-titles .hud-button[data-title="rat-slayer"]');
  await page.waitForTimeout(250);
  const wornTitle = await page.evaluate(() => {
    const line = document.querySelector('.hud-player__title');
    return {
      model: window.world.character.state.activeTitleId,
      shown: line.textContent === 'Rat Slayer' && getComputedStyle(line).display !== 'none',
    };
  });
  wornTitle.before = beforeTitle;
  wornTitle.after = await columnHeight();
  check(
    'wearing a title redraws the player column with room for it',
    wornTitle.model === 'rat-slayer' && wornTitle.shown && wornTitle.after > wornTitle.before,
    `column ${wornTitle.before} -> ${wornTitle.after}`,
  );
  await page.screenshot({ path: `${OUT}/12c-title-worn.png` });

  // --- The bag: a full one must stay on screen, scroll inside itself, and clip
  // what hangs over. The clip used to be the one thing here with no visible
  // failure mode — Phaser 4 made geometry masks Canvas-only, so under WebGL
  // setMask still ran, passed every check, and simply stopped clipping. In DOM
  // it is `overflow: hidden`, so what is worth asserting is the consequence: a
  // row scrolled out of view is not on screen and cannot be hit. ---
  const bag = () =>
    page.evaluate(() => {
      const sheet = document.querySelector('.hud-sheet[data-sheet="inventory"]');
      const body = sheet.querySelector('.hud-sheet__body');
      const selected = sheet.querySelector('.hud-item.is-selected');
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
  await page.evaluate(() => {
    const w = window.world;
    w.character.state.inventory = {
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
    window.game.events.emit('inventory-changed', w.character.state.inventory);
  });
  await page.waitForTimeout(200);
  if (!(await bag()).visible) {
    await page.keyboard.press('i');
    await page.waitForTimeout(300);
  }
  const bagFull = await bag();
  const tabBarTop = await page.evaluate(() =>
    Math.round(document.querySelector('.hud-tabs').getBoundingClientRect().top),
  );
  check(
    'a full bag stays clear of the tab bar rather than running off the screen',
    bagFull.bottom <= tabBarTop,
    `bag bottom ${bagFull.bottom}, tab bar at ${tabBarTop}`,
  );
  check(
    'an overflowing bag becomes scrollable',
    bagFull.maxScroll > 0 && bagFull.rows === 14,
    `${bagFull.rows} rows, ${bagFull.maxScroll}px of overflow`,
  );

  const bagCenter = await page.evaluate(() => {
    const box = document
      .querySelector('.hud-sheet[data-sheet="inventory"] .hud-sheet__body')
      .getBoundingClientRect();
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

  // The clip, asserted by its consequence rather than by its implementation: the
  // first row is scrolled out of the body now, so it must be outside the sheet
  // and whatever is at that point must not be it.
  const clipped = await page.evaluate(() => {
    const sheet = document.querySelector('.hud-sheet[data-sheet="inventory"]');
    const first = sheet.querySelector('.hud-item');
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

  // A tap selects and unfolds the row's actions. Whether a scroll drag also
  // counts as a tap is the browser's business now — a touch drag scrolls the
  // list and the click that would follow is suppressed — which is the whole of
  // what the Phaser panel needed a hand-rolled drag threshold for.
  await page.click('.hud-sheet[data-sheet="inventory"] .hud-item[data-item="brown-legs"]');
  await page.waitForTimeout(200);
  const bagTapped = await bag();
  check(
    'tapping a row selects the item and unfolds its actions',
    bagTapped.selected === 'brown-legs' && bagTapped.actions.includes('Equip'),
    `${bagTapped.selected}: ${bagTapped.actions.join(', ')}`,
  );
  await page.screenshot({ path: `${OUT}/10-inventory-scroll.png` });

  // A resize is a reflow now rather than a rebuild, so the open row survives by
  // construction — on a phone a tap hides the URL bar, which resizes, and the
  // Phaser HUD had to carry the selection across by hand not to lose it.
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
    window.game.events.emit('inventory-changed', w.character.state.inventory);
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(300);
  check(
    'a selection whose item is gone clears rather than lingering',
    (await bag()).selected === null,
  );

  // --- The character sheet: the paperdoll is SVG built from the same rig the
  // world sprite's texture is baked from, and an empty slot opens a picker
  // rather than needing the bag. Equipping from it is the round trip that
  // proves the sheet is self-sufficient. ---
  await tapTab('character');
  await page.click('.hud-sheet[data-sheet="character"] .hud-slot[data-slot="helmet"]');
  await page.waitForTimeout(200);
  const picker = await page.evaluate(() => {
    const node = document.querySelector('.hud-picker');
    if (!node) return null;
    const box = node.getBoundingClientRect();
    return {
      title: node.querySelector('.hud-picker__title').textContent,
      items: [...node.querySelectorAll('.hud-picker__row')].map((n) => n.dataset.item),
      onScreen: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth,
    };
  });
  check(
    'an empty gear slot opens a picker of what fits it, kept on screen',
    picker !== null && picker.items.includes('brown-helmet') && picker.onScreen,
    picker ? `${picker.title}: ${picker.items.join(', ')}` : 'no picker',
  );
  await page.click('.hud-picker__row[data-item="brown-helmet"]');
  await page.waitForTimeout(200);
  const equipped = await page.evaluate(() => ({
    world: window.world.character.state.gear.helmet,
    shown: document.querySelector('.hud-slot[data-slot="helmet"] .hud-slot__item').textContent,
    pickerGone: document.querySelector('.hud-picker') === null,
    // The paperdoll is redrawn from the new gear, so the helmet's colour is on
    // the head circle — the one thing a static picture could not show.
    headFill: document.querySelector('.hud-paperdoll circle').getAttribute('fill'),
  }));
  check(
    'picking an item equips it and redraws the sheet',
    equipped.world === 'brown-helmet' && equipped.shown === 'Brown Helmet' && equipped.pickerGone,
    `${equipped.shown}, head drawn ${equipped.headFill}`,
  );
  await page.screenshot({ path: `${OUT}/14-character-sheet.png` });

  await page.evaluate(() => {
    const w = window.world;
    w.character.state.inventory = { logs: 1 };
    window.game.events.emit('inventory-changed', w.character.state.inventory);
  });
  await tapTab('character');

  // --- Portrait phone: the canvas tracks the viewport 1:1 and the camera zooms
  // in rather than shrinking the world. ---
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const portrait = await page.evaluate(() => ({
    w: window.game.scale.width,
    h: window.game.scale.height,
    // The 2D renderer's own arrangement, which goes with it in phase 3: the
    // camera's viewport is what keeps the world out from under the tab bar.
    zoom: window.game.scene.getScene('Zone').cameras.main.zoom,
    cameraH: window.game.scene.getScene('Zone').cameras.main.height,
    tabBarY: Math.round(document.querySelector('.hud-tabs').getBoundingClientRect().top),
    hudMounted: document.querySelector('.hud') !== null,
    // The visible viewport, against which the canvas must not overhang.
    innerH: window.innerHeight,
    appH: document.getElementById('app').clientHeight,
    canvasH: window.game.canvas.getBoundingClientRect().height,
  }));
  check(
    'portrait viewport resizes the canvas 1:1',
    portrait.w === 390 && portrait.h === 844,
    `${portrait.w}x${portrait.h}`,
  );
  check(
    'portrait camera zooms in and stays inside the world',
    portrait.zoom < 1 && portrait.cameraH / portrait.zoom <= 1216,
    `zoom=${portrait.zoom.toFixed(2)}, camera ${portrait.cameraH}px of ${portrait.h}`,
  );
  check(
    'the world camera stops above the tab bar',
    portrait.cameraH === portrait.tabBarY,
    `camera ${portrait.cameraH}, tab bar at ${portrait.tabBarY}`,
  );
  check('the HUD overlay survives the resize', portrait.hudMounted === true);
  // The tab bar sits flush against the bottom of the canvas, so a canvas taller
  // than the visible viewport hides it outright — which is what 100vh did on
  // iOS Safari, where vh is the viewport as if the toolbars were retracted.
  // Headless Chromium can't reproduce that discrepancy, so this is a guard
  // against a fixed or overhanging height rather than a reproduction.
  check(
    'the canvas never overhangs the visible viewport',
    portrait.appH <= portrait.innerH && Math.round(portrait.canvasH) <= portrait.innerH,
    `app ${portrait.appH}, canvas ${Math.round(portrait.canvasH)}, viewport ${portrait.innerH}`,
  );
  await page.screenshot({ path: `${OUT}/7-portrait.png` });

  // --- Mobile zone travel: tapping the exit signpost must work. Edge-walk
  // transitions need pixel-precision taps a phone can't make (the landing strip
  // is ~4 screen px in portrait), which is why signposts exist. The signpost
  // being *reachable* is the durable requirement behind the camera viewport
  // above: it has to render clear of the opaque bar that would eat the tap. ---
  await park();
  const signScreen = await page.evaluate(() => {
    const post = window.world.signposts.find((s) => s.exit.edge === 'south');
    const at = window.view.worldToScreen(post.x, post.y);
    return {
      ...at,
      tabBarY: Math.round(document.querySelector('.hud-tabs').getBoundingClientRect().top),
    };
  });
  check(
    'the south signpost renders clear of the tab bar on a portrait phone',
    signScreen.y < signScreen.tabBarY,
    `signpost at y=${signScreen.y}, tab bar at ${signScreen.tabBarY}`,
  );
  await clickAt(signScreen);
  const viaSignpost = await stepUntil(
    (s) => s.zoneId === 'beach',
    'the tapped signpost to walk the player over and load the beach',
  );
  check('tapping the south signpost travels to the beach', viaSignpost.zoneId === 'beach');
  await page.screenshot({ path: `${OUT}/8-beach.png` });

  // The tab bar is the HUD's only permanent furniture, and a seventh tab is
  // what makes its per-button width tight. 375px is the narrowest phone worth
  // supporting; below ~372 the buttons drop under the 44px touch minimum.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(600);
  const tabWidth = await page.evaluate(() => {
    // The rendered boxes, not the formula: getBoundingClientRect is exactly the
    // area a thumb has to land on.
    const boxes = [...document.querySelectorAll('.hud-tabs__tab')].map((tab) =>
      tab.getBoundingClientRect(),
    );
    return {
      canvasWidth: window.game.scale.width,
      count: boxes.length,
      narrowest: Math.min(...boxes.map((box) => box.width)),
      shortest: Math.min(...boxes.map((box) => box.height)),
    };
  });
  check(
    'seven tabs still clear the 44px touch minimum on a 375px phone',
    tabWidth.canvasWidth === 375 &&
      tabWidth.count === 7 &&
      tabWidth.narrowest >= 44 &&
      tabWidth.shortest >= 44,
    `${tabWidth.count} tabs, narrowest ${tabWidth.narrowest.toFixed(1)}x${tabWidth.shortest.toFixed(1)}px at ${tabWidth.canvasWidth}px`,
  );
  await page.screenshot({ path: `${OUT}/12b-tabbar-375.png` });

  // --- Resetting: the mobile route to a fresh character, which used to be
  // bound to F9 and so unreachable on a phone. Two taps, on purpose, and it
  // crosses back to a scene that has not run since boot. ---
  await page.setViewportSize({ width: 1280, height: 900 });
  // The RESIZE this fires rebuilds the HUD and closes any open panel, so let it
  // land before opening one.
  await page.waitForTimeout(500);
  await tapTab('options');
  const opened = await page.evaluate(() => document.querySelector('.hud-modal') !== null);
  // First press only arms the confirm; the save must still be there after it.
  await page.click('.hud-modal [data-action="reset-character"]');
  const options = await page.evaluate(() => ({
    opened: true,
    armed:
      document.querySelector('.hud-modal [data-action="reset-character"]').textContent ===
      'Tap again to confirm',
    saveIntact: localStorage.length > 0,
  }));
  options.opened = opened;
  await page.screenshot({ path: `${OUT}/12-options.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  check(
    'escape closes the options modal',
    await page.evaluate(() => document.querySelector('.hud-modal') === null),
  );
  check('the options menu opens from the HUD', options.opened === true);
  check(
    'the first reset press only arms a confirm, leaving the save alone',
    options.armed === true && options.saveIntact === true,
  );

  await page.evaluate(() => {
    // The real path a phone takes: the panel asks, the scene does the work.
    window.game.events.emit('reset-character-requested');
  });
  await page.waitForSelector('.create', { timeout: 20000 });
  check(
    'a reset ends the session and returns to character creation',
    (await page.evaluate(() => document.querySelector('.hud') === null)) === true,
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
  }));
  check(
    'rerolling as a caster brings up an action bar and a full mana pool',
    caster.hasBar && caster.mana > 0 && caster.mana === caster.maxMana,
    `${caster.mana}/${caster.maxMana} mana`,
  );
  await page.screenshot({ path: `${OUT}/11-wizard.png` });

  // --- Resuming: a save comes back where it was left, not at the middle of the
  // map. Only a real reload goes through the load path at all. Parked on a
  // mob's spawn point: known walkable, known well off centre, and the player
  // does not collide with mobs. ---
  const parked = await page.evaluate(() => {
    const w = window.world;
    const spot = { x: Math.round(w.mobs[0].spawnX), y: Math.round(w.mobs[0].spawnY) };
    w.teleport(spot.x, spot.y);
    return {
      spot,
      zoneId: w.zone.id,
      fromCentre: Math.round(Math.hypot(spot.x - w.spawnPoint.x, spot.y - w.spawnPoint.y)),
    };
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.world != null, null, { timeout: 60000 });
  const resumedAt = await page.evaluate(() => ({
    x: Math.round(window.world.player.x),
    y: Math.round(window.world.player.y),
    zoneId: window.world.zone.id,
  }));
  check(
    'a save resumes where it was left, not at the middle of the map',
    resumedAt.zoneId === parked.zoneId &&
      parked.fromCentre > 32 &&
      Math.hypot(resumedAt.x - parked.spot.x, resumedAt.y - parked.spot.y) <= 4,
    `left at ${parked.spot.x},${parked.spot.y} (${parked.fromCentre}px off centre), back at ${resumedAt.x},${resumedAt.y}`,
  );

  // --- Offline camping: a session parked in the save pays out on the next
  // load, and the report waits in the notification queue until the HUD mounts.
  // Travelling an hour back in the save is the only way to reach that path —
  // hence the unit tests around resolveOfflineAfk, with `now` injected, doing
  // the harder cases. Written through the live game rather than into
  // localStorage directly: the page's own unload handler persists on reload and
  // would overwrite a hand-written save. Only the clock is faked. ---
  await page.evaluate(() => {
    const w = window.world;
    w.character.state.level = 1;
    w.character.state.xp = 0;
    window.game.events.emit('afk-toggle-requested');
    w.character.state.afk.startedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.world != null, null, { timeout: 60000 });
  const resumed = await page.evaluate(() => {
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
    resumed.xp > 0 || resumed.level > 1,
    `level ${resumed.level}, xp ${resumed.xp}`,
  );
  check('the away report reaches a HUD that was not listening yet', resumed.panel === true);
  // Cleared on the load that paid it, so a second load can't pay it twice.
  check('the parked session is cleared once resolved', resumed.afk === null);
  await page.screenshot({ path: `${OUT}/13-away-report.png` });

  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  // --- The Three.js bootstrap, behind `?renderer=3d`. Its own page, in its own
  // context: the two renderers are chosen before either is loaded, so the point
  // of the flag is that a 3D session never touches Phaser at all. The default
  // is still 2D, and everything above this line proves it stayed that way.
  //
  // What can only be seen here is the teardown. A geometry the view forgot to
  // dispose is invisible to every state assertion and to the screen — it is
  // memory the card never gets back, which is the 3D form of the display list
  // that once went from 44 objects to 764 across ten zone round trips. ---
  // A touch-capable context, because the drag/tap disambiguation and
  // `touch-action: none` are phone rules and a mouse cannot break either of
  // them: a mouse never pans the page, and a mouse pointer is never a thumb
  // resting on the screen.
  const page3d = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errors3d = [];
  page3d.on('console', (m) => m.type() === 'error' && errors3d.push(m.text()));
  page3d.on('pageerror', (e) => errors3d.push(String(e)));
  // Touch sequences and CPU throttling are both CDP-only; Playwright's
  // touchscreen can tap but cannot drag.
  const cdp3d = await page3d.context().newCDPSession(page3d);

  const step3d = (frames = 1, deltaMs = FRAME_MS) =>
    page3d.evaluate(([f, d]) => window.view.step(d, f), [frames, deltaMs]);
  const zone3d = () => page3d.evaluate(() => window.world?.zone.id ?? null);
  /** Cranks the 3D page until the world satisfies `fn`, in game milliseconds. */
  const stepUntil3d = async (fn, label, budgetMs = 60000) => {
    for (let elapsed = 0; elapsed < budgetMs; elapsed += FRAMES_PER_POLL * FRAME_MS) {
      if (await fn()) return;
      await step3d(FRAMES_PER_POLL);
    }
    throw new Error(`timed out waiting for: ${label}`);
  };
  const stepUntilZone = (zoneId, label, budgetMs) =>
    stepUntil3d(async () => (await zone3d()) === zoneId, label, budgetMs);

  await page3d.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}renderer=3d&loop=manual`, {
    waitUntil: 'domcontentloaded',
  });
  // A fresh context, so this is also the first-run path: created through the
  // real form, into a zone with no Phaser anywhere behind it.
  await page3d.waitForSelector('.create', { timeout: 60000 });
  await page3d.fill('.create__name', 'Adventurer');
  await page3d.click('.create__card[data-class="warrior"]');
  await page3d.click('.create__begin');
  await page3d.waitForFunction(() => window.world != null && window.view != null, null, {
    timeout: 60000,
  });
  check('the 3D renderer boots a session through the creation screen', true);
  check(
    'choosing the 3D renderer never loads Phaser',
    (await page3d.evaluate(() => window.game === undefined)) === true,
  );

  const drawn3d = () => page3d.evaluate(() => window.view.drawnCounts());
  const gpu3d = () => page3d.evaluate(() => window.view.gpuMemory());
  // The meshes are built and synced on the render loop, and a geometry is only
  // counted against `info.memory` once it has actually been uploaded — so
  // everything below waits for a drawn frame rather than for wall-clock time.
  const draw3d = () =>
    page3d.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );

  const spawned3d = () =>
    page3d.evaluate(() => ({
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
   */
  const checkZoneDrawn = async (zoneId) => {
    await draw3d();
    const drawn = await drawn3d();
    const spawned = await spawned3d();
    check(
      `every mob, node, npc and signpost in the ${zoneId} is drawn in 3D`,
      drawn.ground === 1 &&
        drawn.mobs === spawned.mobs &&
        drawn.nodes === spawned.nodes &&
        drawn.npcs === spawned.npcs &&
        drawn.signposts === spawned.signposts,
      `drew ${JSON.stringify(drawn)} for ${JSON.stringify(spawned)}`,
    );
    check(
      `and gives each of them in the ${zoneId} its floating name`,
      drawn.labels === spawned.mobs + spawned.npcs + spawned.signposts + 1,
      `${drawn.labels} labels`,
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
  const sweep3d = async () => {
    const spans = [0.17, 0.5, 0.83];
    for (const fx of spans) {
      for (const fy of spans) {
        await page3d.evaluate(
          ([x, y]) => {
            const w = window.world;
            w.teleport(w.worldWidth * x, w.worldHeight * y);
          },
          [fx, fy],
        );
        await draw3d();
      }
    }
    await page3d.evaluate(() => {
      const w = window.world;
      w.teleport(w.spawnPoint.x, w.spawnPoint.y);
    });
    await draw3d();
  };

  await sweep3d();
  const before3d = { drawn: await drawn3d(), gpu: await gpu3d() };
  check(
    'the zone builds its terrain as a single mesh',
    before3d.drawn.ground === 1,
    `${before3d.drawn.total} objects, ${before3d.gpu.geometries} geometries`,
  );
  await checkZoneDrawn('town');
  await page3d.screenshot({ path: `${OUT}/14-3d-town.png` });

  for (let trip = 0; trip < 3; trip += 1) {
    await page3d.evaluate(() => {
      const w = window.world;
      w.teleport(w.worldWidth / 2, w.worldHeight - 33);
    });
    await stepUntilZone('beach', 'the south exit to load the beach in 3D');
    if (trip === 0) {
      await checkZoneDrawn('beach');
      await page3d.screenshot({ path: `${OUT}/15-3d-beach.png` });
    }
    await page3d.evaluate(() => {
      const w = window.world;
      w.teleport(w.worldWidth / 2, 33);
    });
    await stepUntilZone('town', 'the north exit to return to town in 3D');
  }
  await sweep3d();
  const after3d = { drawn: await drawn3d(), gpu: await gpu3d() };
  check(
    'three zone round trips hand every geometry back to the GPU',
    JSON.stringify(before3d.gpu) === JSON.stringify(after3d.gpu),
    `${JSON.stringify(before3d.gpu)} -> ${JSON.stringify(after3d.gpu)}`,
  );
  check(
    'three zone round trips leave the 3D scene exactly as they found it',
    JSON.stringify(before3d.drawn) === JSON.stringify(after3d.drawn),
    `${JSON.stringify(before3d.drawn)} -> ${JSON.stringify(after3d.drawn)}`,
  );

  // The third zone, so every creature the game has is drawn at least once: the
  // bandit is a figure where the rat and the crab are beasts, and it is the
  // only zone that has none of the other two.
  await page3d.evaluate(() => {
    const w = window.world;
    w.teleport(w.worldWidth - 33, w.worldHeight / 2);
  });
  await stepUntilZone('bandit-camp', 'the east exit to load the bandit camp in 3D');
  await checkZoneDrawn('bandit camp');
  await page3d.screenshot({ path: `${OUT}/16-3d-bandit-camp.png` });
  await page3d.evaluate(() => {
    const w = window.world;
    w.teleport(33, w.worldHeight / 2);
  });
  await stepUntilZone('town', 'the west exit to return to town in 3D');

  // --- The figure's legs, asked of the 3D view in the same vocabulary the 2D
  // check above uses: the walk belongs to whatever is drawing, and both answer
  // `stand:0` for a figure standing still. ---
  await page3d.evaluate(() => {
    const w = window.world;
    w.teleport(w.spawnPoint.x, w.spawnPoint.y);
    w.player.moveTo(w.player.x + 300, w.player.y);
  });
  await step3d(4);
  await draw3d();
  const walking3d = await page3d.evaluate(() => window.view.playerFigure());
  await page3d.evaluate(() => {
    window.world.player.stopMoving();
    window.world.player.setVelocity(0, 0);
  });
  await step3d(1);
  await draw3d();
  const standing3d = await page3d.evaluate(() => window.view.playerFigure());
  check('the 3D figure swings its legs while walking', walking3d.walking === true, walking3d.pose);
  check(
    'and returns to its standing pose when it stops',
    standing3d.walking === false && standing3d.pose.endsWith(':0'),
    standing3d.pose,
  );

  // The 2D camera kept the world out from under the opaque tab bar by shrinking
  // its viewport. A perspective camera draws full-bleed and cannot, so the same
  // requirement — the south signpost has to be reachable — is held by how the
  // camera is framed. This is the measurement of it, at the same phone size the
  // 2D check above uses.
  await page3d.evaluate(() => {
    const w = window.world;
    w.teleport(w.spawnPoint.x, w.spawnPoint.y);
  });
  // The camera follows on the render loop, not on our steps, so it needs a
  // frame to catch up with the teleport before anything reads a screen point.
  await page3d.waitForTimeout(80);
  const sign3d = await page3d.evaluate(() => {
    const post = window.world.signposts.find((s) => s.exit.edge === 'south');
    const at = window.view.worldToScreen(post.x, post.y);
    return {
      ...at,
      tabBarY: Math.round(document.querySelector('.hud-tabs').getBoundingClientRect().top),
    };
  });
  check(
    'the 3D camera keeps the south signpost clear of the tab bar',
    sign3d.y < sign3d.tabBarY,
    `signpost at y=${Math.round(sign3d.y)}, tab bar at ${sign3d.tabBarY}`,
  );

  // --- A resize. The 2D renderer had Phaser's scale manager tracking the
  // viewport; here it is a ResizeObserver on the app root calling
  // `view.resize()`, which has to move two things that can be forgotten
  // separately — the drawing buffer and the camera's aspect ratio. A buffer
  // that never resized would still draw, stretched, and every assertion in this
  // file that reads a screen coordinate would still pass.
  //
  // Landscape on purpose: `layout.ts` keys its breakpoint on height as well as
  // width because a landscape phone is wide by any measure and has less
  // vertical room than a portrait one, and `tests/render3d/camera.test.ts`
  // measures the tab-bar rule only at portrait sizes. This is the other
  // orientation of the same rule, and it is not the same statement — a
  // landscape camera frames twelve tiles of *depth* rather than of width, so
  // the south signpost is eight tiles behind the player at the spawn point and
  // simply out of frame there. What has to hold is that walking toward it
  // brings it into reach, which is measured below. ---
  await page3d.setViewportSize({ width: 844, height: 390 });
  await page3d.waitForTimeout(300);
  await draw3d();
  const landscape3d = await page3d.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const box = canvas.getBoundingClientRect();
    const post = window.world.signposts.find((s) => s.exit.edge === 'south');
    return {
      cssW: Math.round(box.width),
      cssH: Math.round(box.height),
      // What the card is actually asked to fill, which is the half of a resize
      // that has no visible failure mode.
      bufferW: canvas.width,
      bufferH: canvas.height,
      dpr: window.devicePixelRatio,
      innerH: window.innerHeight,
      appH: document.getElementById('app').clientHeight,
      tabBarY: Math.round(document.querySelector('.hud-tabs').getBoundingClientRect().top),
      hudMounted: document.querySelector('.hud') !== null,
      post: { x: post.x, y: post.y },
    };
  });
  check(
    'a landscape resize retargets the 3D canvas and its drawing buffer',
    landscape3d.cssW === 844 &&
      landscape3d.bufferW === Math.round(844 * landscape3d.dpr) &&
      landscape3d.bufferH === Math.round(landscape3d.cssH * landscape3d.dpr),
    `${landscape3d.cssW}x${landscape3d.cssH} css, ${landscape3d.bufferW}x${landscape3d.bufferH} buffer at dpr ${landscape3d.dpr}`,
  );
  check(
    'the 3D canvas never overhangs the visible viewport',
    landscape3d.appH <= landscape3d.innerH && landscape3d.cssH <= landscape3d.innerH,
    `app ${landscape3d.appH}, canvas ${landscape3d.cssH}, viewport ${landscape3d.innerH}`,
  );
  check('the HUD overlay survives a 3D resize', landscape3d.hudMounted === true);

  // Walking up to the signpost has to bring it into reach, which is the
  // landscape form of "the way out of a zone is tappable". Three tiles is the
  // range a player has closed to by the time they aim at it, and it clears the
  // bar by a comfortable margin there — the camera follows all the way to the
  // map edge rather than clamping to the world bounds, so approaching keeps
  // lifting it up the screen.
  await page3d.evaluate(() => {
    const w = window.world;
    const post = w.signposts.find((s) => s.exit.edge === 'south');
    w.clearTarget();
    w.teleport(post.x, post.y - 3 * 64);
  });
  await step3d(2);
  await draw3d();
  const approached3d = await page3d.evaluate(
    (post) => ({
      signY: Math.round(window.view.worldToScreen(post.x, post.y).y),
      tabBarY: Math.round(document.querySelector('.hud-tabs').getBoundingClientRect().top),
    }),
    landscape3d.post,
  );
  check(
    'and walking up to the south signpost brings it clear of the tab bar in landscape',
    approached3d.signY < approached3d.tabBarY,
    `three tiles out it draws at y=${approached3d.signY}, tab bar at ${approached3d.tabBarY}`,
  );
  await page3d.screenshot({ path: `${OUT}/21-3d-landscape.png` });

  // Back to the portrait phone every screen coordinate below is written for.
  await page3d.setViewportSize({ width: 390, height: 844 });
  await page3d.waitForTimeout(300);
  await draw3d();

  // --- Picking: a real press and release on the canvas, at the screen point
  // the view says a thing is drawn at.
  //
  // The priority order and the boxes themselves are unit-tested in
  // tests/render3d/picking.test.ts, which can cast a ray with no GPU in the
  // room. What only a browser shows is the wiring either side of it: a real
  // PointerEvent landing on the canvas, in page coordinates, against a camera
  // the render loop has already moved this frame. ---

  /** A real press-and-release on the 3D canvas, given a frame to be processed. */
  const clickAt3d = async (point) => {
    await page3d.mouse.move(point.x, point.y);
    await page3d.mouse.down();
    await page3d.mouse.up();
    await draw3d();
  };

  // Which thing in the world a tap is aimed at, as an expression the page
  // evaluates: a function cannot be handed across to the browser, and naming
  // the thing twice — once to stand near, once to click — is what these avoid.
  const RAT = 'window.world.mobs.find((m) => m.isAlive())';
  const SHOPKEEPER = 'window.world.npcs[0]';
  const SOUTH_SIGNPOST = "window.world.signposts.find((s) => s.exit.edge === 'south')";

  /** Stands the player a little south of one of those, with nothing selected. */
  const standSouthOf = async (what) => {
    await page3d.evaluate(`(() => {
      const at = ${what};
      window.world.clearTarget();
      window.world.teleport(at.x, at.y + 150);
    })()`);
    await step3d(2);
    await draw3d();
  };
  /** Where it is drawn — the feet, which is what a player aims at. */
  const screen3d = (what) =>
    page3d.evaluate(`(() => {
      const at = ${what};
      return window.view.worldToScreen(at.x, at.y);
    })()`);

  await standSouthOf(RAT);
  await clickAt3d(await screen3d(RAT));
  check(
    'a real click on a rat in 3D selects it',
    (await page3d.evaluate(() => window.world.target?.name ?? null)) === 'Rat',
  );
  await page3d.screenshot({ path: `${OUT}/17-3d-picking.png` });

  // --- The feedback layer, which the tap above has just started a fight for.
  //
  // What only a browser can show here is the text itself: a damage number is
  // baked onto a 2D canvas and jsdom has none, so the unit suite draws every
  // float against a stub. The rise, the fade, the tone-to-colour table and the
  // corpse's topple are all covered there; this is the check that a real canvas,
  // a real texture upload and the whole WorldEvent path exist between the swing
  // and something on screen. ---
  await stepUntil3d(
    () => page3d.evaluate(() => window.view.drawnCounts().fx > 0),
    'the fight to float a damage number in 3D',
  );
  check('a hit in 3D floats a number over what it landed on', true);
  await page3d.screenshot({ path: `${OUT}/18-3d-combat.png` });

  // The other channel out of the same fight. The HUD's bus is Phaser's global
  // emitter in 2D and `world/eventBus.ts` here — forty lines of our own with
  // two semantics that would bite if they were wrong (a listener identified by
  // its function *and* its context, and a handler unsubscribing mid-delivery).
  // Nothing else in this script makes it carry a stream of events to the
  // overlay, and a bus that quietly dropped every second one would still open a
  // shop.
  await stepUntil3d(
    () =>
      page3d.evaluate(() => {
        const p = window.world.player;
        return p.hp < p.maxHp && window.world.mobs.some((m) => m.isEngaged() && m.hp < m.maxHp);
      }),
    'the 3D fight to land hits in both directions',
  );
  const logged3d = await page3d.evaluate(() =>
    [...document.querySelectorAll('.hud-log__line')].map((n) => n.textContent),
  );
  check(
    'both directions of the 3D fight reach the HUD over its own event bus',
    logged3d.some((l) => l.includes('You hit')) && logged3d.some((l) => l.includes('hits you for')),
    `last: ${logged3d.filter((l) => l.trim()).at(-1)}`,
  );

  // The shopkeeper is the case the pick boxes exist for: a ray at a figure's
  // real geometry goes straight down the gap between its legs and out the other
  // side, so aiming at the feet would open nothing.
  await standSouthOf(SHOPKEEPER);
  await clickAt3d(await screen3d(SHOPKEEPER));
  await stepUntil3d(
    () => page3d.evaluate(() => window.world.shopNpc !== null),
    'the tapped shopkeeper to open the shop in 3D',
  );
  check('a real click on the shopkeeper in 3D walks over and opens the shop', true);
  await page3d.click('.hud-modal [data-action="close-shop"]');

  // Ground: the tap has to come back out in the coordinates the simulation
  // walks in, so this asks for a spot well north of the player and checks they
  // arrive at it rather than setting off in some mirrored direction.
  const destination = await page3d.evaluate(() => {
    const w = window.world;
    w.clearTarget();
    w.teleport(w.spawnPoint.x, w.spawnPoint.y);
    return { x: w.spawnPoint.x, y: w.spawnPoint.y - 200 };
  });
  await step3d(2);
  await draw3d();
  await clickAt3d(
    await page3d.evaluate((to) => window.view.worldToScreen(to.x, to.y), destination),
  );
  await step3d(60);
  const walked = await page3d.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));
  check(
    'a real click on the ground in 3D walks the player to that spot in the simulation',
    Math.hypot(walked.x - destination.x, walked.y - destination.y) < 24,
    `player at ${Math.round(walked.x)},${Math.round(walked.y)} for ${destination.x},${destination.y}`,
  );

  // --- The drag, which is the same stream of PointerEvents as the tap and has
  // to be told apart from it. The gesture arithmetic and the camera framing are
  // both unit-tested; what only a browser has is a real press-move-release, a
  // pointer capture, and the fact that both readings of it are the same three
  // events arriving in the same order. ---

  /** A press, a drag of `dx` pixels in eight moves, and a release. */
  const drag3d = async (from, dx) => {
    await page3d.mouse.move(from.x, from.y);
    await page3d.mouse.down();
    for (let step = 1; step <= 8; step += 1) {
      await page3d.mouse.move(from.x + (dx * step) / 8, from.y);
    }
    await page3d.mouse.up();
    await draw3d();
  };

  await page3d.evaluate(() => {
    const w = window.world;
    w.clearTarget();
    w.teleport(w.spawnPoint.x, w.spawnPoint.y);
  });
  await step3d(2);
  await draw3d();

  // Where a fixed spot in the world is drawn, which is how the camera's angle
  // is read without a handle for it: turn the camera and the world swings.
  const northOfPlayer = () =>
    page3d.evaluate(() =>
      window.view.worldToScreen(window.world.player.x, window.world.player.y - 200),
    );
  const before = await northOfPlayer();
  const stood = await page3d.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));

  await drag3d({ x: 195, y: 400 }, 140);
  const after = await northOfPlayer();
  const stayed = await page3d.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
    walking: window.world.player.hasMoveTarget(),
  }));
  check(
    'a drag on the 3D canvas turns the camera',
    after.x - before.x > 40,
    `the ground north of the player moved from x=${Math.round(before.x)} to ${Math.round(after.x)}`,
  );
  check(
    'a drag on the 3D canvas asks the world for nothing',
    !stayed.walking && Math.hypot(stayed.x - stood.x, stayed.y - stood.y) < 1,
    `player at ${Math.round(stayed.x)},${Math.round(stayed.y)}, walking: ${stayed.walking}`,
  );
  await page3d.screenshot({ path: `${OUT}/19-3d-orbit.png` });

  // And the gesture has to hand back: a tap straight after a drag is still a
  // tap, and it has to come back out of the *turned* camera in the coordinates
  // the simulation walks in. The same spot the tap check above used, which is
  // known to be walkable ground.
  const turnedDestination = { x: stood.x, y: stood.y - 200 };
  await clickAt3d(
    await page3d.evaluate((to) => window.view.worldToScreen(to.x, to.y), turnedDestination),
  );
  await step3d(60);
  const afterDrag = await page3d.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));
  check(
    'a tap after a drag still walks the player, through the turned camera',
    Math.hypot(afterDrag.x - turnedDestination.x, afterDrag.y - turnedDestination.y) < 24,
    `player at ${Math.round(afterDrag.x)},${Math.round(afterDrag.y)} for ${Math.round(turnedDestination.x)},${Math.round(turnedDestination.y)}`,
  );

  // --- W means up the screen, not north.
  //
  // The camera is still turned from the drag above, which is the only state in
  // which this can be wrong: the two meant the same thing until a camera could
  // be dragged round, and `InputState.setViewYaw` is what keeps them apart. The
  // 2D host never calls it, so nothing else in this file can see it — and the
  // failure is a character walking off at an angle to the key that was pressed,
  // which no state assertion would call a bug. Asserted as what a player sees
  // (the ground they left slides down the screen) plus the proof it is not
  // simply north. ---
  await page3d.evaluate(() => {
    const w = window.world;
    w.clearTarget();
    w.player.stopMoving();
    w.teleport(w.spawnPoint.x, w.spawnPoint.y);
  });
  await step3d(2);
  await draw3d();
  const fromW = await page3d.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));
  await page3d.keyboard.down('w');
  // Six frames is ~76 simulation pixels: far enough to read a direction off,
  // short enough that the spawn point's clear ground is all it crosses.
  await step3d(6);
  await page3d.keyboard.up('w');
  await draw3d();
  const heldW = await page3d.evaluate((from) => {
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

  // Straightened out again, so the signpost check below is the framing the
  // camera test measures rather than whatever the drag left behind.
  await drag3d({ x: 195, y: 400 }, -140);

  // --- The rest of the keyboard, which the 3D host binds itself. `bindKeyboard`
  // is shared and unit-tested; what is not shared is the call site, and a host
  // that forgot it would leave a game that plays perfectly with a mouse and
  // ignores every key. ---
  await page3d.evaluate(() => {
    const w = window.world;
    const rat = w.mobs.find((m) => m.level === 1 && m.isAlive());
    w.clearTarget();
    w.teleport(rat.x - 60, rat.y);
    w.player.restoreToFull();
  });
  // The real button rather than the event behind it: there is no `window.game`
  // here to emit through, which is the point.
  await page3d.click('.hud-tabs__tab[data-tab="camp"]');
  await stepUntil3d(
    () => page3d.evaluate(() => window.world.afkActive && window.world.target !== null),
    'the 3D camp to pick a fight',
  );
  check('the AFK camp fights unprompted in 3D', true);

  await page3d.keyboard.down('w');
  await step3d(2);
  const released3d = await page3d.evaluate(() => window.world.afkActive);
  await page3d.keyboard.up('w');
  check('a real movement key takes the controls back from the 3D camp', released3d === false);

  // Escape reaches the world as a drained action rather than a listener. The
  // furthest live mob, so it is not auto-attacked to death before the key
  // arrives — a kill clears the target by itself.
  const selected3d = await page3d.evaluate(() => {
    const w = window.world;
    const furthest = w.mobs
      .filter((m) => m.isAlive())
      .sort(
        (a, b) =>
          Math.hypot(b.x - w.player.x, b.y - w.player.y) -
          Math.hypot(a.x - w.player.x, a.y - w.player.y),
      )[0];
    w.setTarget(furthest);
    return w.target?.name ?? null;
  });
  await page3d.keyboard.press('Escape');
  await step3d(2);
  check(
    'a real Escape press clears the selected target in 3D',
    selected3d !== null && (await page3d.evaluate(() => window.world.target)) === null,
    `had ${selected3d} selected`,
  );

  // A tap that lands on the opaque bar must never also be a move order. In 2D
  // this is the DOM overlay doing what `ZoneScene` once hit-tested by hand; here
  // the canvas has its own `pointerdown` listener and `touch-action: none`, so
  // it is worth asking whether the overlay still gets there first.
  await page3d.evaluate(() => {
    const w = window.world;
    w.clearTarget();
    w.player.stopMoving();
    w.teleport(w.spawnPoint.x, w.spawnPoint.y);
  });
  await step3d(2);
  const beforeBar3d = await page3d.evaluate(() => ({
    x: Math.round(window.world.player.x),
    y: Math.round(window.world.player.y),
  }));
  const barBox3d = await page3d.evaluate(() => {
    const rect = document.querySelector('.hud-tabs').getBoundingClientRect();
    return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.bottom - 3) };
  });
  await page3d.touchscreen.tap(barBox3d.x, barBox3d.y);
  await step3d(6);
  const afterBar3d = await page3d.evaluate(() => ({
    x: Math.round(window.world.player.x),
    y: Math.round(window.world.player.y),
  }));
  check(
    'a tap on the tab bar never falls through to the 3D world as a move order',
    afterBar3d.x === beforeBar3d.x && afterBar3d.y === beforeBar3d.y,
    `${beforeBar3d.x},${beforeBar3d.y} -> ${afterBar3d.x},${afterBar3d.y}`,
  );

  // --- The same gestures under a thumb. Every drag above was a mouse, and a
  // mouse cannot break either phone-only rule: it never pans the page, so
  // `touch-action: none` is untested by it, and it is never a thumb resting on
  // the screen. Chromium synthesises the pointer events these listeners are
  // written against, so this is the real path a phone takes. ---
  const touch3d = (type, points) =>
    cdp3d.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  /** A press, a drag of `dx` pixels in eight moves, and a release — by finger. */
  const touchDrag3d = async (from, dx) => {
    await touch3d('touchStart', [{ x: from.x, y: from.y }]);
    for (let move = 1; move <= 8; move += 1) {
      await touch3d('touchMove', [{ x: Math.round(from.x + (dx * move) / 8), y: from.y }]);
    }
    await touch3d('touchEnd', []);
    await draw3d();
  };

  const beforeTouch = await northOfPlayer();
  const stoodTouch = await page3d.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));
  await touchDrag3d({ x: 195, y: 400 }, 140);
  const afterTouch = await northOfPlayer();
  const stayedTouch = await page3d.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
    walking: window.world.player.hasMoveTarget(),
  }));
  check(
    'a finger dragged across the 3D canvas turns the camera',
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
  const ratTouch = await screen3d(RAT);
  await page3d.touchscreen.tap(Math.round(ratTouch.x), Math.round(ratTouch.y));
  await draw3d();
  check(
    'and a finger tap still selects what it landed on',
    (await page3d.evaluate(() => window.world.target?.name ?? null)) === 'Rat',
  );
  await touchDrag3d({ x: 195, y: 400 }, -140);

  // And the one that matters most on a phone: the signpost is how a zone is
  // left, since the edge-walk band is untappably thin under a thumb.
  await page3d.evaluate(() => {
    const w = window.world;
    w.teleport(w.spawnPoint.x, w.spawnPoint.y);
  });
  await step3d(2);
  await draw3d();
  await clickAt3d(await screen3d(SOUTH_SIGNPOST));
  await stepUntilZone('beach', 'the tapped signpost to walk the player to the beach in 3D');
  check('a real click on a signpost in 3D walks over and changes zone', true);

  // The reset is the only path that disposes a renderer and builds another one,
  // and it is where the 2D port's worst failure lived — a teardown that threw
  // left the scene manager wedged, presenting as a timeout with no failing
  // assertion. Two taps on the real panel, the way a phone does it.
  await page3d.click('.hud-tabs__tab[data-tab="options"]');
  await page3d.waitForTimeout(80);
  await page3d.click('.hud-modal [data-action="reset-character"]');
  await page3d.click('.hud-modal [data-action="reset-character"]');
  await page3d.waitForSelector('.create', { timeout: 20000 });
  check(
    'a 3D reset tears the renderer down and returns to character creation',
    (await page3d.evaluate(
      () => document.querySelector('.hud') === null && document.querySelector('canvas') === null,
    )) === true,
  );
  await page3d.click('.create__card[data-class="wizard"]');
  await page3d.click('.create__begin');
  await page3d.waitForFunction(() => window.world != null, null, { timeout: 20000 });
  check(
    'and builds a fresh one for the next character',
    (await page3d.evaluate(() => window.view.drawnCounts().ground)) === 1,
  );

  // A caster is the only class with a projectile to draw, which is why this
  // waits for the wizard the reset just rolled: the bolt is the one WorldEvent
  // that exists purely so a ranged nuke does not read as nothing happening.
  // What is asserted is that the cast drew *something*, because a spell may
  // fizzle — and a fizzle is a float over the caster rather than a bolt, which
  // is a moment the player has to see just as much.
  await page3d.evaluate(() => {
    const w = window.world;
    const rat = w.mobs.find((m) => m.isAlive());
    w.teleport(rat.x, rat.y + 120);
    w.setTarget(rat);
  });
  // Long enough for the world to publish an ability state the bar can enable
  // its button from: out of range or with nothing targeted it is disabled, and
  // a disabled button is not clickable.
  await step3d(3);
  await page3d.click('.hud-ability__key[data-ability="fireball"]');
  await step3d(1);
  const cast3d = await page3d.evaluate(() => window.view.drawnCounts().fx);
  check(
    'a real cast in 3D draws itself — a bolt in flight, or a fizzle over the caster',
    cast3d > 0,
    `${cast3d} effect(s) in flight`,
  );
  await page3d.screenshot({ path: `${OUT}/20-3d-cast.png` });

  // --- The save round trip, through a real reload of the 3D page.
  //
  // Two things only this can show. `bindUnloadPersist` is the host's own call
  // site rather than shared code, so a 3D session that never persisted would
  // look perfect until the tab was closed. And every zone reached above came
  // through the creation screen — this is the *resume* branch of `bootFlow`,
  // which is the one every session after the first takes, and the one that has
  // to pick the renderer again from the URL before it knows what to build. ---
  const parked3d = await page3d.evaluate(() => {
    const w = window.world;
    const spot = { x: Math.round(w.mobs[0].spawnX), y: Math.round(w.mobs[0].spawnY) };
    w.clearTarget();
    w.teleport(spot.x, spot.y);
    return {
      spot,
      zoneId: w.zone.id,
      fromCentre: Math.round(Math.hypot(spot.x - w.spawnPoint.x, spot.y - w.spawnPoint.y)),
    };
  });
  await page3d.reload({ waitUntil: 'domcontentloaded' });
  await page3d.waitForFunction(() => window.world != null && window.view != null, null, {
    timeout: 60000,
  });
  const resumed3d = await page3d.evaluate(() => ({
    x: Math.round(window.world.player.x),
    y: Math.round(window.world.player.y),
    zoneId: window.world.zone.id,
    ground: window.view.drawnCounts().ground,
    phaser: window.game !== undefined,
  }));
  check(
    'a 3D session resumes its save where it was left, with a rebuilt view',
    resumed3d.zoneId === parked3d.zoneId &&
      parked3d.fromCentre > 32 &&
      Math.hypot(resumed3d.x - parked3d.spot.x, resumed3d.y - parked3d.spot.y) <= 4 &&
      resumed3d.ground === 1,
    `left at ${parked3d.spot.x},${parked3d.spot.y} (${parked3d.fromCentre}px off centre), back at ${resumed3d.x},${resumed3d.y}`,
  );
  check('and resuming a save never loads Phaser either', resumed3d.phaser === false);

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
  await cdp3d.send('Emulation.setCPUThrottlingRate', { rate: 8 });
  const errorsBeforeSlow = errors3d.length;

  /** Cranks the throttled page at 7fps until `fn`, in game milliseconds. */
  const stepUntilSlow = async (fn, label, budgetMs = 30000) => {
    for (let elapsed = 0; elapsed < budgetMs; elapsed += 4 * SLOW_FRAME_MS) {
      if (await fn()) return;
      await step3d(4, SLOW_FRAME_MS);
    }
    throw new Error(`timed out at 7fps waiting for: ${label}`);
  };

  await page3d.evaluate(() => {
    const w = window.world;
    w.clearTarget();
    w.player.stopMoving();
    w.teleport(w.spawnPoint.x, w.spawnPoint.y);
  });
  await step3d(2, SLOW_FRAME_MS);
  await draw3d();

  // Arrival at 45px a frame. The tap is real and so is the walk: a fixed
  // arrival band would step over the destination and turn back every frame,
  // which presents as a character vibrating on the spot and never stopping.
  const slowDestination = await page3d.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y - 200,
  }));
  await clickAt3d(
    await page3d.evaluate((to) => window.view.worldToScreen(to.x, to.y), slowDestination),
  );
  await stepUntilSlow(
    () => page3d.evaluate(() => !window.world.player.hasMoveTarget()),
    'the player to stop walking at 7fps',
  );
  const slowWalked = await page3d.evaluate(() => ({
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
  await clickAt3d(await screen3d(RAT));
  check(
    'a real tap still selects what it landed on at 7fps',
    (await page3d.evaluate(() => window.world.target?.name ?? null)) === 'Rat',
    'press and release are a slow device apart',
  );

  // And the other reading of it, which must not have become the easy one.
  await page3d.evaluate(() => {
    const w = window.world;
    w.clearTarget();
    w.player.stopMoving();
    w.teleport(w.spawnPoint.x, w.spawnPoint.y);
  });
  await step3d(2, SLOW_FRAME_MS);
  await draw3d();
  const beforeSlowDrag = await northOfPlayer();
  const stoodSlow = await page3d.evaluate(() => ({
    x: window.world.player.x,
    y: window.world.player.y,
  }));
  await touchDrag3d({ x: 195, y: 400 }, 140);
  const afterSlowDrag = await northOfPlayer();
  const stayedSlow = await page3d.evaluate(() => ({
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
  await page3d.evaluate(() => {
    const w = window.world;
    w.clearTarget();
    w.teleport(w.worldWidth / 2, w.worldHeight - 240);
    w.player.moveTo(w.worldWidth / 2, w.worldHeight + 200);
  });
  await stepUntilSlow(
    async () => (await zone3d()) === 'beach',
    'the player to walk off the south edge at 7fps',
  );
  check('walking into the map edge at 7fps still changes zone', true);
  await page3d.screenshot({ path: `${OUT}/22-3d-throttled.png` });

  // The render loop itself, which the simulation's hand crank does not drive: a
  // frame still has to arrive and still has to draw the zone it was handed.
  await draw3d();
  const slowDrawn = await page3d.evaluate(() => window.view.drawnCounts());
  check(
    'the render loop keeps drawing the zone under an eight-times slower CPU',
    slowDrawn.ground === 1 && slowDrawn.mobs > 0,
    `${slowDrawn.total} objects, ${slowDrawn.mobs} mobs`,
  );
  check(
    'and nothing on the page threw while it was struggling',
    errors3d.length === errorsBeforeSlow,
    errors3d.slice(errorsBeforeSlow, errorsBeforeSlow + 3).join(' | '),
  );
  await cdp3d.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  check(
    'no console errors in the 3D view',
    errors3d.length === 0,
    errors3d.slice(0, 3).join(' | '),
  );
} catch (err) {
  check('smoke run completed', false, String(err.message ?? err));
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
