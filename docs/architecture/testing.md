# Testing and verification

What goes in `tests/world/`, what goes in smoke, the three dev handles, the hand crank, and how to reproduce a frame-rate bug.

_Moved out of `CLAUDE.md` on 2026-09-25 (`docs/decisions.md` 57). The paragraphs are the ones that were there, in the order they were there; `CLAUDE.md` keeps the rules and points here for the reasoning. Where this and the code disagree, the code is right — and this file is what should be corrected._

**Gameplay rules belong in `tests/world/`, not in smoke.** The simulation is headless, so a whole
zone can be driven through combat, leashing, aggro, gathering, trading, cooking, camping and
casting in vitest — `tests/world/harness.ts` is what every test there is built on, and it hands
back the world, the character, the keyboard and a `tick`/`until` pair measured in game
milliseconds. That is the first place to add cover for anything the game _does_.

**A zone has two random sources, and a test can pin either** (act three phase 3). `rng` is where the
rats walk and where spawns fall, and the harness pins it at 0.5 by default so a failure is never a
rat that drifted. `rolls` is every other die in the zone — a swing, a crit, a dodge, a block, a
drop, a gather, a burn, a fizzle, a reforge — carried on `WorldContext.rolls` and handed to the
systems that already took an rng. The harness leaves it on `Math.random`, because most tests hold a
rule over whatever the dice say; a test about one outcome passes `rolls` and loads them rather than
looping until the outcome comes up or spying on `Math.random`, which reaches only the rolls somebody
remembered to leave on it.

`scripts/smoke.mjs` (Playwright + headless Chromium) covers the other half and deliberately
nothing else: the game booting and the flows that cross between zones, real mouse, touch and key
events reaching the game, the view building and _unbuilding_ itself, the HUD's geometry at real
viewport sizes, the save round trip through an actual page reload, and the save out as a real
download and back through a real file picker. Reach for it whenever a
change touches the renderer, an actor or the HUD. Screenshots land in gitignored `.smoke/`.

It runs on a **portrait phone in a touch-capable context**, which is what the game is laid out
for; two sections leave that viewport on purpose and say why (a landscape resize, and a desktop
block for the HUD rules that differ on a roomy screen). Five things in it exist nowhere else:

- **The GPU teardown.** Three zone round trips have to leave `renderer.info.memory` where they
  found it. That number counts what has actually been _uploaded_, which is why both snapshots are
  taken after sweeping the camera over the whole zone: compared from wherever the player happened
  to be standing, it would move with a rat wandering into frame.
- **A finger, not a mouse.** The drag/tap disambiguation and `touch-action: none` are phone rules
  and a mouse can break neither — it never pans the page and is never a thumb resting on the
  screen. Touch sequences go through CDP `Input.dispatchTouchEvent`; Playwright's touchscreen can
  tap but not drag.
- **A press held in wall clock.** `LONG_PRESS_MS` is measured on the same clock `TAP_MAX_MS` is,
  so nothing on the hand crank produces one and no fake pointer stream contains one — the
  `context-menu` section holds a real finger still for 700ms and then checks that letting go walks
  nowhere. It is also where the two events one right click arrives as (`pointerdown` with a
  non-primary button, then `contextmenu`) are held to being one gesture.
- **A landscape resize**, which is the one shape `tests/render3d/camera.test.ts` does not measure.
  A landscape camera frames ten tiles of _depth_ rather than of width, so the south signpost is
  out of frame from the spawn point; what holds is that walking toward it brings it into reach.
- **A CPU-throttled pass at `rate: 8`, cranked at 140ms a frame** — see "Reproducing a
  frame-rate-dependent bug" below for why that is two questions rather than one.

**The HUD's own clocks are not on the crank either.** The training bar fades half a minute after
the last XP into its skill, on a timer of the HUD's own (decision 94), so smoke never waits for it:
`tests/hud/Hud.test.ts` holds the fade against vitest's fake timers. It also means the bar can come
or go between any two readings of the player column, so a smoke check comparing the column across a
stretch of play measures it with the bar taken off (`columnHeightBesideTraining`), or it would pass
or fail on how long the run took to get there.

It reaches the game through three dev-only handles, one per channel:

- **`window.world`** — the live `ZoneWorld`, re-set on every zone change since each builds a new
  world: `world.mobs`, `world.player.hp`, `world.teleport(x, y)`.
- **`window.view`** — the handful of questions only whatever is drawing can answer:
  `worldToScreen(x, y)`, `drawnCounts()`, `playerFigure()`, `gpuMemory()`, `drawTime()` and
  `step()`. The interface is `src/types/debugView.ts`, and it is deliberately a small
  renderer-agnostic one — that is what let the renderer be replaced under smoke rather than
  alongside it. There are three questions about a frame and they are different questions:
  `drawnCounts()` is what is in it, `gpuMemory()` is what the card is holding, and `drawTime()` is
  what it costs in milliseconds — the last of which is a **budget** rather than an observation, and
  is the one thing on this handle smoke asserts a ceiling on.
- **`window.events`** — the HUD channel, which is neither of the other two. It is how a check
  reaches a panel whose state has no cheap route through the world: two hundred combat-log lines,
  or a bag filled to the brim to scroll.

Nothing else is exposed. The HUD needs no handle — smoke queries and clicks its real elements,
which is what a user does. All three sit behind an `import.meta.env.DEV` guard, so Vite strips
them from production builds. They are also how you inspect live state from the devtools console.

Nothing in `src/` declares those three on `window` — `start3d.ts` casts to install them —
so `scripts/globals.d.ts` does, which is what lets `tsconfig.scripts.json` typecheck the smoke
script against the real `ZoneWorld` and `DebugView` rather than against `any`. A check that reads a
field the world stopped having is a compile error now instead of an assertion that fails for the
wrong reason. It is a `.mjs`, so its types are JSDoc; keep new helpers annotated or `npm run
typecheck` fails on the implicit `any`.

**Smoke is a list of named sections and `--section=` runs some of them.** They share one page and
carry state forward, so filtering is for iterating on a section you are changing rather than a way
to shard the run — `boot` always runs, and a full run is still the verdict.

**`?loop=manual` puts the simulation on a hand crank.** Under that flag the rAF loop in
`render3d/start3d.ts` stops stepping the game and `window.view.step(deltaMs, frames)` does it
instead; the frame loop still draws and still reads the mouse. Smoke always runs this way, which is
why every wait in it is a number of _game_ milliseconds and a loaded CI runner makes it slower
rather than flakier.

Two environment notes that will otherwise waste your time:

- **`tests/setup.ts` installs an in-memory `Storage`.** Node defines its own `localStorage`
  global that vitest's jsdom environment leaves as an unusable stub, which broke every
  persistence test with `localStorage.clear is not a function`. Don't delete that setup file, and
  don't "fix" `LocalStorageSaveService` to work around it — the source was never the problem.
- **The first `npm run dev` request cold-compiles the whole engine** — ~520 kB of Three.js — and
  can take far longer than a normal page load, so browser waits need generous timeouts on a cold
  cache.

**Reproducing a frame-rate-dependent bug.** A cheap phone steps the game at single-digit fps and
bugs hide there (see "Frame rate is not an assumption you may make" below). Ask for the frame you
want rather than throttling a machine into producing it: `view.step(140, 50)` is fifty frames at
~7fps, deterministically, and in vitest the harness's `tick(steps, deltaMs)` does the same thing.

That covers bugs in our own maths, which is all of them so far — and it is only half of what a
cheap phone is. The other half is a machine that cannot draw a frame in time, and **smoke's last
section throttles itself for it**: `Emulation.setCPUThrottlingRate` at `rate: 8` while the crank is
turned at 140ms. Keep the two straight, because they fail differently. The delta is the
simulation's question and is arithmetic — `arriveRadius`, the substep cap, the exit margin — so it
is unit-testable and mostly unit-tested. The throttle is the renderer's, and is not testable
anywhere else: whether a real press and release still read as a tap when the only clock between
them is a slow device's (`TAP_MAX_MS` is wall clock, and wall clock is exactly what a slow device
inflates), and whether the camera a ray is cast through has been moved this frame.

Reach for the recipe directly only for something smoke does not cover:

```js
const client = await page.context().newCDPSession(page);
await client.send('Emulation.setCPUThrottlingRate', { rate: 8 });
```
