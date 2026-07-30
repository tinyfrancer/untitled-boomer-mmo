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
  await page.waitForFunction(() => window.game?.scene?.getScene('Boot'), null, { timeout: 120000 });

  // --- Booting: a fresh character through the real creation screen. ---
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.game?.scene?.getScene('CharacterCreate')?.scene.isActive(),
    null,
    { timeout: 20000 },
  );
  check('character creation scene boots', true);
  await page.screenshot({ path: `${OUT}/1-character-create.png` });

  await page.evaluate(() => {
    const s = window.game.scene.getScene('CharacterCreate');
    s.selectClass('warrior');
    s.tryBeginAdventure();
  });
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

  // The HUD hears the world through game.events and renders off its own model;
  // the quest rules themselves are covered in tests/world/quests.test.ts.
  const questHeard = await page.evaluate(() => {
    window.game.events.emit('accept-quest-requested', 'rat-bones');
    return {
      world: { ...window.world.character.state.quests },
      hud: { ...window.game.scene.getScene('UI').model.quests },
    };
  });
  check(
    'a quest taken in the world reaches the HUD',
    questHeard.world['rat-bones'] === 'active' && questHeard.hud['rat-bones'] === 'active',
  );
  await page.evaluate(() => window.world.closeShop());

  // --- A real fight, for the HUD's benefit: the combat log is fed by events
  // crossing between two live scenes, which nothing headless can show. ---
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

  const logged = await page.evaluate(() => {
    const ui = window.game.scene.getScene('UI');
    return { lines: ui.model.combatLog.map((e) => e.text), openSheet: ui.model.openSheet };
  });
  check(
    'the combat log records the fight',
    logged.lines.some((l) => l.includes('You hit')) &&
      logged.lines.some((l) => l.includes('hits you for')),
    `${logged.lines.length} lines, last: ${logged.lines[logged.lines.length - 1]}`,
  );
  // The tab bar opens one sheet at a time, so the log starts closed even on a
  // desktop: the character sheet is what a roomy screen opens by default.
  check(
    'the character sheet is the default sheet on a desktop viewport',
    logged.openSheet === 'character',
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

  // --- The HUD: tabs, sheets and the log's cap. Rewritten as DOM in phase 2 of
  // the port; until then this is the only cover it has. ---
  const tabbed = await page.evaluate(() => {
    const ui = window.game.scene.getScene('UI');
    ui.selectTab('log');
    const opened = { log: ui.combatLogPanel.isVisible(), character: ui.characterPanel.isVisible() };
    ui.selectTab('log');
    return { opened, closedAgain: ui.combatLogPanel.isVisible() };
  });
  check(
    'a tab opens its sheet and closes the one already open',
    tabbed.opened.log === true && tabbed.opened.character === false,
  );
  check('tapping the open tab again closes it', tabbed.closedAgain === false);

  const exclusive = await page.evaluate(() => {
    const ui = window.game.scene.getScene('UI');
    const seen = [];
    for (const tab of ['character', 'inventory', 'quests', 'log']) {
      ui.selectTab(tab);
      seen.push(
        [
          ui.characterPanel.isVisible(),
          ui.inventoryPanel.isVisible(),
          ui.questPanel.isVisible(),
          ui.combatLogPanel.isVisible(),
        ].filter(Boolean).length,
      );
    }
    ui.selectTab(ui.model.openSheet);
    return seen;
  });
  check(
    'only one sheet is ever open at a time',
    exclusive.every((count) => count === 1),
    `open counts ${exclusive.join(',')}`,
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

  // --- Achievements in the HUD. Crediting the chain and earning the title are
  // tested headlessly; what needs a browser is the sheet and the player column
  // redrawing around a worn title. ---
  const slayer = await page.evaluate(() => {
    const w = window.world;
    w.character.state.kills = {};
    w.character.state.activeTitleId = null;
    const unlocks = w.creditKill('rat', 100);
    const ui = window.game.scene.getScene('UI');
    ui.selectTab('feats');
    return {
      unlocked: unlocks.length,
      open: ui.model.openSheet === 'feats',
      visible: ui.achievementPanel.isVisible(),
      kills: ui.model.kills.rat ?? 0,
    };
  });
  check(
    'the Feats tab opens the achievements sheet, populated from the world',
    slayer.open && slayer.visible && slayer.kills === 100,
    `${slayer.unlocked} tier(s) unlocked, HUD sees ${slayer.kills} kills`,
  );
  await page.screenshot({ path: `${OUT}/12-achievements.png` });

  // The title has to survive the round trip the picker actually uses: the HUD
  // asks, the world re-checks the kills back it, and the player column redraws.
  // It gets its own line there, so the column has to grow to hold it.
  const wornTitle = await page.evaluate(async () => {
    const ui = window.game.scene.getScene('UI');
    const before = ui.layout.playerColumn.height;
    window.game.events.emit('set-title-requested', 'rat-slayer');
    await new Promise((r) => setTimeout(r, 250));
    const after = window.game.scene.getScene('UI');
    return {
      before,
      after: after.layout.playerColumn.height,
      model: after.model.activeTitleId,
      shown: after.children.list.some((o) => o.text === 'Rat Slayer'),
    };
  });
  check(
    'wearing a title redraws the player column with room for it',
    wornTitle.model === 'rat-slayer' && wornTitle.shown && wornTitle.after > wornTitle.before,
    `column ${wornTitle.before} -> ${wornTitle.after}`,
  );
  await page.screenshot({ path: `${OUT}/12c-title-worn.png` });

  // --- Inventory scrolling: a full bag must stay on screen and scroll, and a
  // scroll drag must never be mistaken for a row tap. ---
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

  // The clip is the one thing here with no visible failure mode: Phaser 4 made
  // geometry masks Canvas-only, so under WebGL setMask still ran, still passed
  // every check above, and simply stopped clipping — overflowing rows drew over
  // the world. Assert the clip is actually installed for the live renderer.
  const clip = await page.evaluate(() => {
    const vp = window.game.scene.getScene('UI').inventoryPanel.rowsViewport;
    return {
      gl: !!window.game.renderer.gl,
      filters: vp.filters?.internal?.list?.length ?? 0,
      geometryMask: !!vp.mask,
    };
  });
  check(
    'the bag viewport is really clipped on this renderer',
    clip.gl ? clip.filters > 0 : clip.geometryMask,
    clip.gl ? `WebGL, ${clip.filters} mask filter(s)` : 'Canvas, geometry mask',
  );

  // A tap selects; a drag of the same press must not.
  await clickAt(invCenter);
  await page.waitForTimeout(250);
  const invTapped = await invPanel();
  check('tapping a row selects the item', invTapped.selected !== null, `${invTapped.selected}`);

  await page.mouse.move(invCenter.x, invCenter.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) {
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

  // A resize rebuilds the whole HUD, and the selection lives on the panel
  // instance — so without carrying it across, a resize deselects. On a phone a
  // tap hides the URL bar, which resizes, so the item you just tapped would
  // lose its action row a frame later. brown-legs is in the injected bag and a
  // warrior can wear it, so its row is guaranteed an Equip action.
  const equipShown = () =>
    page.evaluate(() =>
      window.game.scene
        .getScene('UI')
        .inventoryPanel.rowObjects.some((o) => o.type === 'Text' && o.text === 'Equip'),
    );
  await page.evaluate(() => {
    const p = window.game.scene.getScene('UI').inventoryPanel;
    p.selectedItemId = 'brown-legs';
    p.render();
  });
  const beforeResize = { selected: (await invPanel()).selected, equip: await equipShown() };
  await page.setViewportSize({ width: 1280, height: 864 });
  await page.waitForTimeout(300);
  const afterResize = { selected: (await invPanel()).selected, equip: await equipShown() };
  check(
    'the selected item and its Equip button survive a resize',
    beforeResize.selected === 'brown-legs' &&
      beforeResize.equip &&
      afterResize.selected === 'brown-legs' &&
      afterResize.equip,
    `equip before/after resize: ${beforeResize.equip}/${afterResize.equip}`,
  );
  // And a selection whose item is gone must still clear across a resize.
  await page.evaluate(() => {
    const w = window.world;
    w.character.removeItem('brown-legs', w.character.itemCount('brown-legs'));
    window.game.events.emit('inventory-changed', w.character.state.inventory);
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(300);
  check(
    'a selection whose item is gone clears rather than lingering',
    (await invPanel()).selected === null,
  );

  await page.evaluate(() => {
    const w = window.world;
    w.character.state.inventory = { logs: 1 };
    window.game.events.emit('inventory-changed', w.character.state.inventory);
    window.game.scene.getScene('UI').inventoryPanel.setVisible(false);
  });

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
    tabBarY: window.game.scene.getScene('UI').layout.tabBar.y,
    uiActive: window.game.scene.getScene('UI').scene.isActive(),
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
  check('UI scene survives the resize', portrait.uiActive === true);
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
    return { ...at, tabBarY: window.game.scene.getScene('UI').layout.tabBar.y };
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
    const ui = window.game.scene.getScene('UI');
    // The rendered hit areas, not the formula: objects[0] is the interactive
    // background, which is the thing a thumb actually has to land on.
    const widths = [...ui.tabBar.buttons.values()].map((button) => button.objects[0].width);
    return {
      canvasWidth: window.game.scale.width,
      count: widths.length,
      narrowest: Math.min(...widths),
    };
  });
  check(
    'seven tabs still clear the 44px touch minimum on a 375px phone',
    tabWidth.canvasWidth === 375 && tabWidth.count === 7 && tabWidth.narrowest >= 44,
    `${tabWidth.count} tabs, narrowest ${tabWidth.narrowest.toFixed(1)}px at ${tabWidth.canvasWidth}px`,
  );
  await page.screenshot({ path: `${OUT}/12b-tabbar-375.png` });

  // --- Resetting: the mobile route to a fresh character, which used to be
  // bound to F9 and so unreachable on a phone. Two taps, on purpose, and it
  // crosses back to a scene that has not run since boot. ---
  await page.setViewportSize({ width: 1280, height: 900 });
  // The RESIZE this fires rebuilds the HUD and closes any open panel, so let it
  // land before opening one.
  await page.waitForTimeout(500);
  const options = await page.evaluate(() => {
    const ui = window.game.scene.getScene('UI');
    ui.openOptions();
    const opened = ui.optionsPanel !== null;
    // First press only arms the confirm; the save must still be there after it.
    ui.optionsPanel.handleResetPressed(() => {});
    return {
      opened,
      armed: ui.optionsPanel.confirmingReset,
      saveIntact: localStorage.length > 0,
    };
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
  check('a reset ends the session and returns to character creation', true);
  await page.evaluate(() => {
    const s = window.game.scene.getScene('CharacterCreate');
    s.selectClass('wizard');
    s.tryBeginAdventure();
  });
  // `window.world` is cleared when a view is torn down, so this cannot pass on
  // the world the reset just ended.
  await page.waitForFunction(() => window.world != null, null, { timeout: 20000 });
  const caster = await page.evaluate(() => ({
    hasBar: window.game.scene.getScene('UI').actionBar !== undefined,
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
      panel: window.game.scene.getScene('UI')?.awayReportPanel != null,
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
} catch (err) {
  check('smoke run completed', false, String(err.message ?? err));
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
