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
  const page3d = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors3d = [];
  page3d.on('console', (m) => m.type() === 'error' && errors3d.push(m.text()));
  page3d.on('pageerror', (e) => errors3d.push(String(e)));

  const step3d = (frames = 1, deltaMs = FRAME_MS) =>
    page3d.evaluate(([f, d]) => window.view.step(d, f), [frames, deltaMs]);
  const zone3d = () => page3d.evaluate(() => window.world?.zone.id ?? null);
  const stepUntilZone = async (zoneId, label, budgetMs = 60000) => {
    for (let elapsed = 0; elapsed < budgetMs; elapsed += FRAMES_PER_POLL * FRAME_MS) {
      if ((await zone3d()) === zoneId) return;
      await step3d(FRAMES_PER_POLL);
    }
    throw new Error(`timed out waiting for: ${label}`);
  };

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
  const before3d = { drawn: await drawn3d(), gpu: await gpu3d() };
  check(
    'the zone builds its terrain as a single mesh',
    before3d.drawn.ground === 1,
    `${before3d.drawn.total} objects, ${before3d.gpu.geometries} geometries`,
  );
  await page3d.screenshot({ path: `${OUT}/14-3d-town.png` });

  for (let trip = 0; trip < 3; trip += 1) {
    await page3d.evaluate(() => {
      const w = window.world;
      w.teleport(w.worldWidth / 2, w.worldHeight - 33);
    });
    await stepUntilZone('beach', 'the south exit to load the beach in 3D');
    await page3d.evaluate(() => {
      const w = window.world;
      w.teleport(w.worldWidth / 2, 33);
    });
    await stepUntilZone('town', 'the north exit to return to town in 3D');
  }
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
