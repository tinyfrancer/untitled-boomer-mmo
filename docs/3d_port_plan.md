# Port plan: 2D Phaser → 3D Three.js

**Status:** in progress. Written 2026-07-28 against `03a1c45`.

- **Phase 0 (PRs 1-3) merged** 2026-07-29.
- **Phase 1 PRs 4-6 merged** 2026-07-29, as one stack. Arcade physics is gone: `main.ts` has no
  `physics` config, and `systems/CollisionSystem.ts` is the only thing deciding what may move
  where.
- **PR 7 merged** — `ZoneWorld` exists, `src/world/` is in the Phaser-free seam, and `ZoneScene` is
  a view. See the retrospective under PR 7 below.
- **PR 8 merged** — `GameContext` owns the session, `scene.restart` is gone, and the registry with
  it. See the retrospective under PR 8 below.
- **PR 9 merged** — smoke is renderer-agnostic and half its old size, and the gameplay it used to
  be the only cover for is in `tests/world/`. Phase 1 is done.
- **PR 10 merged** — the HUD's permanent furniture is an HTML overlay (`src/hud/`, in the
  Phaser-free seam); `UIScene` is down to the sheets. See the retrospective under PR 10 below.
- **PR 11 merged** — every panel is DOM, `UIScene` and the 18 Phaser `ui/` files are gone, and so
  is `clipToMask.ts`. See the retrospective under PR 11 below.
- **PR 12 merged** — the creation screen is plain HTML, `Boot` and `CharacterCreate` are gone and
  `dom.createContainer` with them. **Phase 2 is done.** See the retrospective under PR 12 below.
- **PR 13 merged** — `?renderer=3d` boots a Three.js client over the same world and the same HUD,
  and draws the ground under it. See the retrospective under PR 13 below.
- **PR 14 merged** — every simulated thing has a mesh drawing it, with a billboarded nameplate over
  it. See the retrospective under PR 14 below.
- **PR 15 merged** — a tap on the 3D canvas moves, targets, gathers, shops and travels. See the
  retrospective under PR 15 below.
- **PR 16 merged** — the camera is dragged round the player, a tap is told apart from a drag, and
  what the camera ends up behind fades. See the retrospective under PR 16 below.
- **PR 17 merged** — damage numbers float, a ring marks the target, a bolt flies and a corpse falls
  over. **Phase 3 is done.** See the retrospective under PR 17 below.
- **Next: PR 18** — 3D smoke parity, including a CPU-throttled run.

## Context

The project is a single-player MMORPG built as a learning exercise, currently rendered with
Phaser 4 in 2D top-down. The goal is to re-render it in 3D without rewriting the game.

This is achievable because the architecture was already built for it. `docs/refactor_systems_seam.md`
states the intent outright: "deep, headlessly-testable game systems now, placeholder visuals, so a
richer visual layer (possibly a 3D renderer) could swap in later." That bet is now being called.

**The bet mostly paid off.** Verified by grep: `src/systems/`, `src/data/`, `src/persistence/`,
`src/types/` and `src/config/` contain **zero Phaser imports** — 2,466 lines that port untouched.
Exactly 32 files import Phaser: `main.ts`, all 6 scenes, all 7 entities, and 18 of 21 `ui/` files.

**But the gap is real, and it is not the renderer.** Position and velocity currently live _inside_
Phaser — `Player`, `Mob` and `ResourceNode` all extend `Phaser.Physics.Arcade.Sprite`. And ~900 of
`ZoneScene`'s 1,536 lines are genuine game logic that is neither unit-testable nor portable today.

So: **this port is ~80% extraction and ~20% Three.js.** Most of the work makes the game headless
and testable; the 3D renderer is the easier half, and it goes faster once there is something clean
to render. The intended outcome is a 3D client, a substantially larger unit suite, a smaller and
faster smoke check, and no Phaser dependency.

## Decisions already made

| Decision | Choice                                                        | Why                                                                                                                         |
| -------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Engine   | **Three.js + own game loop**                                  | Physics does almost nothing here (see below), so a physics engine is dead weight. Smallest bundle, keeps the existing seam. |
| Camera   | **Orbiting 3/4 view, drag to rotate yaw, tap ground to move** | Preserves the destination-based movement model and the mobile-first HUD.                                                    |
| HUD      | **Rewritten as an HTML/CSS DOM overlay**                      | `layout.ts`, `theme.ts`, `uiEvents.ts` carry over; text, scrolling and clipping stop being hand-rolled.                     |
| Rollout  | **Incremental, `?renderer=3d` flag, Phaser deleted last**     | Every PR leaves `main` playable and CI green.                                                                               |

### Coordinate system: stay 2D in the simulation

**The simulation keeps `(x = east, y = south)`. The view maps `(x, y) → (x, h, y)`.**

This is the single highest-leverage decision in the plan. It means `MovementSystem`, `ZoneSystem`,
`spawns.ts`, the save format and the `arriveRadius` constants are **not touched at all** — avoiding a
unit-rescale that would otherwise reintroduce the documented slow-frame arrival bug.

Corollaries:

- **Render scale is 1.** 1 sim pixel = 1 Three.js world unit. Set `near: 1, far: 5000`. Do not
  convert to metres — a second unit system is the hazard, not the axis mapping.
- One module owns `simToWorld(x, y): Vector3` and `worldToSim(v: Vector3): Point`. `.z` appears
  nowhere else in the codebase.
- **The sign trap is yaw, not position.** Sim heading `atan2(vy, vx)` becomes
  `mesh.rotation.y = -atan2(vy, vx) - Math.PI / 2`, depending on the mesh's forward axis. Put it in
  that same module with a unit test or it will cost a day.
- Terrain height and jumping never break this — height is a function `h(x, y)` the renderer samples
  and the sim ignores. **Multi-level geometry** (a bridge over a path, a two-storey building) is what
  genuinely breaks it, and would need a navmesh or layer id. Nothing in `docs/initial_design.txt`
  forces that soon. Accept the debt knowingly.

### Physics: there is almost none to port

Verified at `ZoneScene.ts:312-320` — exactly four collider registrations: player↔ground,
mobs↔ground, player↔solid nodes, mobs↔solid nodes. `WATER_TILE` is the **only** blocking tile.
Player↔mob, mob↔mob and player↔NPC **do not collide**; every combat and interaction check is
distance-based. A hand-written `CollisionSystem` replaces all of it in ~150 lines.

---

## Phase 0 — seam debt and save hygiene

Three small, independent PRs. `docs/refactor_systems_seam.md` items 1, 3 and 4 are still undone and
are direct prerequisites; item 2 (`resolveKill` dedup) already landed in `d80df26`.

**PR 1 — Phaser-free import guard test.**
Read every `.ts` under `systems/ data/ persistence/ types/ config/` and assert none imports `phaser`.
~10 lines with `fs` + `glob`, in the style of the existing `family`/loot-table rule.
_Verify:_ the test fails when a stray `import Phaser` is added.

**PR 2 — `InteractionSystem` + proximity helpers.**
Extract the interaction-intent state machine exactly as specified in `refactor_systems_seam.md §1`,
and add `distance` / `withinRadius` to `MovementSystem` (§3). The ~20-call-site sweep of
`Phaser.Math.Distance.Between` mostly falls out of the extraction, so these are one PR, not two.
Keep the deliberate `node.definition.interactRadius * 0.9`.
_Verify:_ new `tests/systems/InteractionSystem.test.ts`; smoke's gather / shop / signpost taps still
complete.

**PR 3 — Save hygiene.**
`CharacterState.position: {x, y}` is **written and never read** — every zone entry respawns at world
centre. Either honour it or drop it, bump `CHARACTER_STATE_VERSION`, add a `migrations.ts` step.
Do this now, not mid-port. Note explicitly that **the port itself needs no migration**, so nobody
invents one later.
_Verify:_ migration test from a v10 save.

---

## Phase 1 — headless simulation, Phaser still rendering

The backbone. Nothing visual changes; the game becomes testable.

> **Sizing, learned by doing it.** PRs 4-6 fit comfortably in one session together. **PRs 7, 8 and
> 9 do not — take one per session.** Each is larger than the three before it put together: 7
> rehomed ~900 lines of `ZoneScene` and had a prerequisite the original plan understated (below),
> 8 replaces a lifecycle Phaser was providing for free, and 9 rewrites a 1,609-line script that
> blocks merges. A half-finished one of these leaves nothing mergeable, which is the failure mode
> to avoid on a stack that publishes on merge. All three confirmed the sizing: one session each, and
> each used most of it.

### PRs 4-6 — done, merged 2026-07-29

PRs #42, #43, #44. What landed that this document did not predict, and that PR 7 onwards inherits:

- **Arcade is gone entirely, one PR early.** PR 6's line item was mobs; taking them off left
  `ResourceNode`'s static body with nothing to collide against, so it came off too and the
  `physics` config left `main.ts`. `scene.physics` is no longer configured — don't reach for it.
- **Solid nodes block as rectangles, not the circles specified in PR 5.** Same bottom-anchored
  trunk the plan was protecting, taken from the same numbers the old arcade body used, but exact.
  AABB-vs-AABB is also what axis-separated resolution wants.
- **The four-corner tile test was replaced by a cell-range scan.** Corners are exact only for a
  body that fits in a tile, which held while only the player used it. A rat's box is 80px against a
  64px tile — wide enough to straddle a one-tile blocking column with every corner on dry land. For
  a body that does fit, the scan is the same four cells.
- **"A body already inside a blocker may always move" is a required rule, and was missing.**
  Revert-based movement is not arcade separation: it prevents entering but never pushes out, so
  without this anything teleported into a blocker freezes there permanently. Smoke stages gathering
  at `player.setPosition(tree.x, tree.y + 40)`, which is inside the trunk.
- **Mobs are bounds-clamped now and never were.** `setCollideWorldBounds` was only ever on the
  player, so a long chase could walk a mob off the map.
- **Fixed arrival bands are gone from the AI.** Wander stopped at `distance < 2` and returning at
  `< 4` — the same slow-frame bug `arriveRadius` exists to fix, one level down. All three AI states
  steer through `stepToward` now.

<details>
<summary>Original PR 4-6 specifications, kept for the record</summary>

**PR 4 — Phaser-free `InputState`.**
WASD currently lives inside `Player.update()` via `keyboard.addKey`; ESC and F9 are on the scene;
`isKeyboardMoving()` gates AFK. This is a hidden dependency of transform ownership — the same code
moves either way — so it goes first as its own small PR.
_Verify:_ smoke's keyboard-move and ESC-clear-target checks unchanged.

**PR 5 — Player owns its transform, integration and collision.**

> **Correction to the obvious split:** "sim is truth, sprite follows" and "replace arcade" cannot be
> separate PRs. Arcade writes body position every physics step, and `moves = false` disables
> separation too. Transform ownership _is_ integration ownership. Split by **entity** instead.

`Player` stops extending `Phaser.Physics.Arcade.Sprite`, owns `{x, y, vx, vy}`, integrates itself
against a new Phaser-free `systems/CollisionSystem.ts`. Delete the two player colliders
(`ZoneScene.ts:314, 318`). Mobs stay on arcade; the other two colliders still work.

`CollisionSystem` takes `(aabb, delta, world: { grid, bounds, circles })` and knows nothing about
entities. The recipe, which is also the anti-tunnelling answer:

1. Desired displacement `d = v * dt/1000`, clamped to `min(speed*dt/1000, distanceToTarget)`.
2. **Substep**: `n = min(8, ceil(|d| / (TILE_SIZE/2)))`. At 7fps `|d| ≈ 23px` so `n = 1` normally —
   it only engages on pathological frames. Three lines, and it is the whole tunnelling story.
3. **Axis-separated resolution** per substep: try x, test, revert x if blocked; then y. This
   preserves wall-sliding, which arcade gave for free and which players notice losing — walking
   diagonally into the pond currently slides you along it.
4. **Tile test is AABB corners vs grid**: `Math.floor(px / TILE_SIZE)` on the four corners of the
   proposed box against `BLOCKING_TILES`. Exact for bodies ≤ one tile; assert that invariant in a
   test rather than iterating a range.
5. **World-bounds clamp after tile resolution**, using a named half-extent constant — not one derived
   from a texture size about to be deleted. `ZoneSystem.ts:49-52` records that `findExit`'s margin
   "has to exceed half the player's body"; if the clamp's half-extent drifts, zone transitions
   silently stop firing on some edges. **Unit-test `EXIT_MARGIN > PLAYER_HALF_EXTENT`.**
6. **Solid nodes are bottom-anchored rectangles, not centred circles** (`ResourceNode.ts:26-31`:
   30% × 30% offset to the sprite's bottom — only the trunk blocks, walking behind the canopy is
   intended). A circle centred on the sprite origin moves tree collision ~30px up and puts the
   smoke's `player.setPosition(tree.x, tree.y + 40)` staging _inside_ the blocker. Use
   `radius = trunkWidth / 2` at the bottom-anchored centre.
7. Preserve the non-collisions exactly.

**Do not change `stepToward` or `arriveRadius` in this PR.** The "never return velocity above
`speed`" note in `MovementSystem.ts:38-45` exists only because Phaser integrates over the physics
world's timestep rather than the scene `delta`; once we own integration that constraint inverts and
clamping to remaining distance becomes correct. But changing the integrator and the movement math
together makes a smoke failure un-bisectable. Ship the integrator with zero movement-math change and
tighten later. **Amend `CLAUDE.md:231-233` in this PR** — that paragraph becomes actively false.

_Verify:_ new `tests/systems/CollisionSystem.test.ts` — a 46px step into water, a diagonal slide
along a wall, an inside corner, and the exit-margin case. This is the first time any of it has been
testable; that is the payoff. Plus a CPU-throttled smoke run at `rate: 8` per `CLAUDE.md`.

**PR 6 — Mobs get the same treatment.**
`Mob.update(playerX, playerY)` **takes no delta today** (`Mob.ts:61`) — it relies on
`scene.physics.moveTo` plus arcade integration in all three AI states. Plumb delta through and
replace the three `physics.moveTo` calls (`Mob.ts:144, 166, 177`) with the existing tested
`stepToward`. Then the last two colliders and the `physics` block in `main.ts` go.
_Verify:_ smoke's leash, aggro and chase checks — these are behavioural tuning, so watch them
closely. Throttled run.

</details>

### PR 7 — Extract `ZoneWorld` — done, merged

What landed that this document did not predict, and that PR 8 onwards inherits:

- **`src/world/` is a sixth Phaser-free directory**, guarded by the same seam test. `ZoneWorld`,
  `Player`, `Mob`, `ResourceNode` and `Campfire` live there; `entities/` is now `*Sprite` views that
  hold a reference to one and `sync()` to it once a frame.
- **There are two channels out, not one.** The `WorldEvent[]` this document specified is the _view_
  channel — moments a renderer cannot recover from state. The HUD's ~30 events stayed on
  `game.events`, injected as an `EventBus` interface that Phaser's emitter satisfies structurally.
  Collapsing them into one channel would have made every HUD event a thing the 3D view had to
  forward. The world subscribes to the HUD's _requests_ itself and drops them in `destroy()`.
- **Floating text names a `tone`, not a colour.** `THEME` is Phaser-free and could have been
  imported, but a view that is told "reward" can draw a reward however it likes; one told
  `#ffd54f` cannot.
- **Three Phaser timers had to become accumulators**, not just move: mob wander scheduling, the
  death fade and the respawn. The fade's 400ms is now `DEATH_FADE_MS` in the sim and the sprite
  fades against `mob.deadForMs` — the respawn has to take the same total time whether or not
  anything is drawing it.
- **The world's clock starts at zero and Phaser's never did.** `lastAttackAt = 0` meant "ready" for
  a scene-wide clock that was already seconds old at zone entry; against a fresh accumulator it
  means "wait a full cooldown". Both the player's and the mob's markers are `-Infinity` now. This is
  the kind of thing that would have shown up as a vague "combat feels laggy after a zone change".
- **Collision bodies moved into the data tables** (`EnemyDefinition.body`,
  `ResourceNodeDefinition.body`). `Mob.bounds()` and `ResourceNode.blockerRect()` were reading
  `sprite.width` — a texture measurement, which is exactly what `PLAYER_HALF_EXTENT` exists to avoid.
  A smoke check now asserts the data and the generated textures still agree.
- **Smoke needed one line changed, not none.** Every state read still resolves, through a
  clearly-marked block of delegating getters on `ZoneScene` that PR 9 deletes. The exception was the
  walk-animation check, which reads `anims` and `texture` — genuinely the sprite's now, so it asks
  the new `figure` getter. A throttled run at `rate: 8` also passes.

<details>
<summary>Original PR 7 specification, kept for the record</summary>

**One session. Do not bundle PR 8 with it.**

A Phaser-free class owning entities, spawning and the update loop. `ZoneScene` becomes a thin view.
Expose `window.world`.

> **Prerequisite this document understated.** `ZoneWorld` cannot be Phaser-free while it owns
> entities that are still `Phaser.GameObjects.Sprite` subclasses — importing them pulls the engine
> straight back in, and `tests/architecture/phaserFreeSeam.test.ts` will say so. So **splitting
> `Player` and `Mob` into a Phaser-free simulation object plus a sprite that follows it is part of
> PR 7, not a later tidy-up.** That is most of its weight, and it is what makes the headless vitest
> harness below possible at all. PRs 5 and 6 deliberately did not do this: transform ownership had
> to land first, and doing both at once would have put the arcade removal and the entity split in
> one un-bisectable change.

The part that makes this more than a rename: **`ZoneWorld` must emit a `WorldEvent[]` per tick** —
`hit`, `death`, `spawn`, `bolt-cast`, `gather-tick`, `zone-exit`. Today `castBolt` and
`showFloatingText` are inline `this.tweens.add` calls; without an event channel the 3D view has no
way to know a bolt was cast.

`ZoneWorld` should **not** own zone loading or persistence here — emit
`{kind: 'zone-exit', to, edge, fraction}` and let the host act, or this PR has to solve
`scene.restart` too.
_Verify:_ a headless vitest harness ticks a full combat → death → respawn cycle. Smoke unchanged.

</details>

### PR 8 — `GameContext` replaces `scene.restart` and the registry — done, merged

What landed that this document did not predict, and that PR 9 onwards inherits:

- **`loadZone` is on the session, not the world.** `ZoneWorld` still refuses to load zones; the new
  Phaser-free `world/GameContext.ts` owns the character, the `InputState`, the running world and the
  save clock, and `update(delta)` returns `{ events, zoneChanged }` having already built the next
  world when the frame asked for one. `zoneChanged` is the whole contract with a view: the events
  came from a world that no longer exists, so rebuild rather than draw them.
- **The view teardown was the work, not the loading.** Restarting the scene was destroying a
  display list nobody had ever had to think about — the floating labels over shopkeepers and
  signposts were literally commented as "scene-owned, so a zone change cleans it up". Every view
  class now destroys what it created, `ZoneScene` tracks its transient floats and bolts in a group,
  and 10 town↔beach round trips hold the display list at 44 objects. Without the teardown it reaches
  **764** with the entire unit suite still green, which is the shape of the Three.js leak this PR
  exists to make impossible. A smoke check counts ground layers, signposts and name labels now.
- **Phaser shuts its plugins down before any `SHUTDOWN` listener we can register.** `this.cameras.main`
  is already `undefined` inside the handler, so a teardown that touches the camera or the tween
  manager throws — and a throw there leaves the scene manager wedged: the character-create screen
  never starts, which is how it presented (a smoke timeout with no failing assertion). The teardown
  runs from `resetCharacter` while the scene is whole, with the shutdown handler as an idempotent
  backstop.
- **`OFFLINE_AFK_RESOLVED_EVENT` is gone, not moved.** It was never an event — it was a registry
  key read once on mount. It is a typed `PendingNotification` on the context now, drained by
  `UIScene.create`. The achievement unlocks that can accompany it ride the same queue.
- **A reset can end the session from inside a tick** — the F9 that asks for one is drained by the
  world being stepped — so `GameContext` carries a `destroyed` flag. Without it the autosave later
  in that same frame writes the character straight back over the save the reset just cleared.

<details>
<summary>Original PR 8 specification, kept for the record</summary>

**One session.** Depends on PR 7 having landed the entity split.

`scene.restart` is currently doing teardown-and-rebuild for free, and "UIScene survives it" is a
documented architectural fact. This needs to be explicit **before** the Three.js view exists, because
Three.js leaks GPU memory without `.dispose()` on geometries/materials/textures — and a zone-walk
loop is exactly how that gets found.

The registry is a blackboard at 7 sites. Two patterns to preserve: `registry.get('character')` is how
`CharacterState` survives the restart, and `registry.set(OFFLINE_AFK_RESOLVED_EVENT, report)`
(`ZoneScene.ts:806, 811`) is a **deferred notification** — the HUD is not listening yet at launch
ordering, so it reads-and-removes on mount (`UIScene.ts:708-727`). A `GameContext` holding
`character` plus a pending-notification queue replaces both. Miss the queue and the offline AFK
report silently never shows, **which smoke does not cover.**

Also fold in the autosave timer (`ZoneScene.ts:344`) and the `pagehide`/`beforeunload` pair — they
become an accumulator in the world tick. Small, but unnamed means a save-loss bug.
_Verify:_ 10 town→beach round trips with no leaked listeners; offline AFK report still displays.

</details>

### PR 9 — Migrate the smoke check — done, merged

What landed that this document did not predict, and that phase 2 onwards inherits:

- **Smoke needed a second handle, not just a retarget.** `window.view` is a Phaser-free interface
  (`src/types/debugView.ts`) with four members: `worldToScreen`, `step`, `drawnCounts` and
  `playerFigure`. The plan named the first two; the other two are what the leak check and the
  walk-cycle check needed, and both were reaching straight into `children.list` and `anims`. The
  Three.js view implements the same interface, so those checks port rather than get rewritten.
- **`?loop=manual` was much cheaper than expected, because it does not stop Phaser's loop.** Only
  `ZoneScene.update` stops stepping the game; drawing, input and tweens keep running off rAF. A
  genuinely stopped loop would have broken every real-mouse-click check outright, since Phaser
  processes pointer events inside its own step.
- **`loop.sleeping` has never existed.** Every poll in the old smoke ran
  `if (loop.sleeping) loop.wake()`, which read `undefined` on Phaser 3 and 4 alike — the flag is
  `running`. What actually kept the renderer awake was the three `--disable-background-*` launch
  flags. The crank nudges `wake()` off the real flag now, but nothing was ever relying on it.
- **The leak check got stronger by getting renderer-agnostic.** Counting exact objects (one ground
  layer, two signposts, one shopkeeper, one name label) became: snapshot `drawnCounts()`, take three
  town↔beach round trips, assert it is unchanged. That is the 44-objects-to-764 story asserted
  directly, and it does not need editing when a zone gains furniture.
- **`ZoneWorld.teleport(x, y)`** replaced about twenty `setPosition` + `setVelocity` + `stopMoving`
  triples. It also clears the pending approach, which the old smoke's `resetForClick` did by hand
  and every other site forgot.
- **The AFK anchor only drops a target that is not chasing.** Found writing the test for it:
  `decideAfkAction` answers anything engaged whatever its distance, on purpose, so the anchor rule
  is what stops the camp following a mob that has _leashed off_ — not one mid-fight. The test has to
  disengage the mob to isolate the rule at all.
- **Roughly 600 lines was the wrong target.** Smoke went 1,725 → 876, and the remainder is over half
  HUD assertions plus the file's own comments; phase 2 deletes the former along with `UIScene`. The
  unit suite went from 21 world cases to 77 across nine files, all on one
  `tests/world/harness.ts`.
- **Two things stayed that read as renderer-specific**, because the requirement behind them is not:
  the camera-viewport-equals-tab-bar assertion is the 2D arrangement and goes with it, so the
  durable form of it — the south signpost's `worldToScreen` y is above the tab bar — was added
  alongside rather than instead.

<details>
<summary>Original PR 9 specification, kept for the record</summary>

**One session, and the one least worth rushing** — it gates merges, so a bad day here blocks
everything behind it.

`scripts/smoke.mjs` is 1,609 lines and gates merges. Do **not** rewrite it wholesale at peak
uncertainty later; migrate it now, when every check passes:

1. **State reads** (~40 sites): `getScene('Zone').player/.mobs/.nodes/.target/.gatherState` →
   `window.world`. Mechanical, zero behavioural risk.
2. **Teleports** (~15 `setPosition` calls) → `window.world.teleport(x, y)`, a debug API. Instantly
   renderer-agnostic.
3. **Screen coords** (~4 sites) — the only genuinely renderer-specific coupling. Both views implement
   `window.view.worldToScreen(x, y)`; smoke calls it.
4. **`window.game.loop.wake()`** — Phaser sleeps `TimeStep` on blur; a raw rAF loop will not, but
   headless-Chromium throttling is a real CI-only risk. Add `?loop=manual` with
   `window.view.step(ms)` so smoke drives ticks deterministically. This makes smoke faster and less
   flaky than today.

Two couplings PRs 5-6 already had to break, so the counts above are slightly lower now:
`physics.world.bounds` became `worldWidth`/`worldHeight`, and the mob dump's `body.velocity` /
`body.enable` became `vx`/`vy`. Both were reads of things that stopped existing, not migrations.

Then **move whole categories out of smoke into vitest**, now that the world is headless: leashing,
aggro engage, death reset, gather-refusal-on-full-pack, AFK anchor.
_Verify:_ smoke green at roughly 600 lines; unit suite visibly larger. This is the highest-leverage
risk reduction in the plan — it de-risks every remaining PR.

</details>

---

## Phase 2 — DOM HUD, before Three.js

> **This ordering is deliberate and is the plan's main structural claim.** Two renderers over one
> `ZoneWorld` is cheap: game-logic changes cost nothing and only new _visual_ features double. Two
> HUDs is the expensive half — 18 Phaser `ui/` files and a new DOM tree both listening to the same
> ~30 `uiEvents` constants, with every event-shape change a double edit.
>
> The DOM HUD is renderer-independent _by construction_: it only consumes `game.events`. So ship it
> while Phaser still renders the world and delete `UIScene` in the same phase — then there is exactly
> one HUD forever. DOM-over-canvas is identical to DOM-over-Three; nothing is wasted.
>
> **Cost:** first 3D pixels arrive three PRs later. If that is demotivating, a throwaway Three.js
> spike against `ZoneWorld` (not merged) is cheap insurance after PR 9 — but keep it out of the
> stack.

### PR 10 — DOM HUD shell — done, merged

What landed that this document did not predict, and that PR 11 onwards inherits:

- **The shell is everything that is not a sheet, not just the bar.** A tab bar over Phaser panels
  needs a channel to tell them what is open, and that channel is throwaway — so the cheapest split
  was to take across everything with no Phaser panel behind it at all: player column, target frame,
  quest tracker, ability bar, gather bar, toasts and the options modal (the gear tab opens it, so
  leaving it behind would have cost a second scaffolding event). One constant, `SHEET_CHANGED_EVENT`,
  is the whole of the temporary coupling.
- **`game.events` being a broadcast is what made the two HUDs cheap.** Both sides subscribe to the
  same ~30 events independently, so nothing had to be forwarded: the DOM half hears `level-up` and
  toasts, the scene hears it and refreshes the character sheet. The only thing that could not be
  broadcast was the initial `openSheet`, because the tab bar decides it before `UIScene.create`
  runs — so both compute `narrow ? null : 'character'` from the same rule for exactly one PR.
- **`src/hud/` joined the Phaser-free seam**, guarded by the same test. It was worth the two-line
  change: it is what says out loud that the HUD is renderer-independent rather than merely intended
  to be.
- **`ui/layout.ts` still positions the furniture, as inline styles.** Handing the stack to CSS was
  tempting and wrong: `worldViewportHeight()` is derived from the same arithmetic, and the layout
  tests are the only cover for viewport sizes nobody tries by hand. Only the tab bar's internal
  split is left to flex, which reproduces `(width - padding * (n + 1)) / n` exactly.
- **The rebuild-on-every-layout-input rule had to go, and that fixed a bug.** `UIScene` re-ran its
  "crossing to narrow closes the open sheet" check on every rebuild, and a quest being taken is a
  rebuild — so on a phone, picking up a quest item silently closed whatever sheet was open. The DOM
  HUD only applies it when `narrow` actually changes.
- **The tab bar's own tap-swallowing is now assertable.** Smoke clicks the bar's padding and checks
  the player did not move, which in 2D took an explicit hit test between two Phaser scenes
  (`ZoneScene.handlePointerDown`) and in DOM is free. That check is the durable half of the
  camera-viewport hack PR 13 deletes.
- **Toast fades need a forced reflow.** Setting opacity 1 and then 0 in one turn collapses into a
  single style recalculation and nothing ever appears; `void root.offsetWidth` between them is the
  whole fix, and it is not obvious from a green suite that anything is wrong.

_Original spec:_ tab bar and sheet container over the Phaser canvas, reusing `layout.ts`, `theme.ts`
and `uiEvents.ts`; `getBoundingClientRect().width >= 44` for all 7 tabs at 375px.

### PR 11 — Port the panels; delete `UIScene` — done, merged

What landed that this document did not predict, and that PR 12 onwards inherits:

- **The paperdoll was the one thing that could not just become a `<div>`.** It was a Phaser texture
  baked by `Graphics`, and the HUD may not reach into the renderer for a canvas. It is inline SVG
  now, built from the same rig — `stickFigure()` moved into `AppearanceSystem` and both the texture
  and the sheet read it, so the two agree about where a shoulder is. That is also what keeps the
  sheet working once the world is meshes.
- **`hud-hidden` needs `!important`, and this is a real bug the DOM makes easy to write.** A
  single-class utility loses to a single-class rule declared later in the stylesheet, so
  `.hud-sheet { display: flex }` beat it and every "closed" sheet stayed laid out — an invisible
  wall over the tab bar. Smoke asked the class rather than the computed style and called it closed;
  it asks `getComputedStyle` now, which is what caught it.
- **Three hand-rolled mechanisms deleted outright, not ported.** The per-renderer mask
  (`clipToMask.ts`), the two scroll implementations with their own drag thresholds, and the
  enable/disable bookkeeping for rows scrolled out of a viewport are all `overflow` plus the
  browser's own gesture handling. The smoke check for the clip became a check on its _consequence_
  — a scrolled-away row is off the sheet and `elementFromPoint` does not return it — which is
  renderer-agnostic in a way the mask assertion never was.
- **A modal must not be a scrim by default.** `inset: 0` with `pointer-events: auto` is the obvious
  way to centre a panel and it silently stops the player walking away from the shopkeeper. The shop
  and the away report pass taps through; only the options menu, which can wipe a save, blocks.
- **Smoke got shorter and more honest at the same time.** Every HUD assertion is a real click on a
  real element now — the quest is taken by clicking the shop row, the title by clicking the picker,
  the helmet by clicking the slot and then the item — where the Phaser version had to emit the
  event and inspect `ui.model`. `window.game` survives only for the generated textures and the
  creation screen.
- **`ZoneScene.handlePointerDown` lost its HUD hit test.** A click on an overlay element never
  reaches the canvas, so the explicit `ui.input.hitTestPointer` check — a thing the 3D view would
  have had to reimplement — is simply gone.

_Original spec:_ port all panels to DOM; delete `UIScene`, the 18 Phaser `ui/` files and
`clipToMask.ts`; every sheet opens, scrolls and clips; smoke's UI assertions rewritten against the
DOM.

### PR 12 — `CharacterCreate` and the boot flow to plain DOM — done, merged

What landed that this document did not predict, and that phase 3 inherits:

- **`Preload` has to stay a scene, and that is fine.** The placeholder textures are baked with
  Phaser's `Graphics`, so something has to be a live scene until the 3D view stops needing them.
  What moved out is the _flow_: `scenes/bootFlow.ts` is an if-statement — resume the save, or mount
  the creation screen and start the session with what it produces — and `Boot` was deleted outright,
  since all it ever did was start `Preload`.
- **A reset stops `Zone` rather than starting another scene.** There is no scene to hand to any
  more, so `resetCharacter` calls `scene.stop()` and `showCharacterCreate(game)`; the screen hands
  back to `Zone` by starting it again.
- **`src/ui/` is now Phaser-free in its entirety** and joined the seam guard. What is left of it is
  vocabulary — layout arithmetic, the palette, the tab table, the event names — with every element
  that draws any of it in `hud/`. Only `main.ts`, `scenes/` and `entities/` know the engine exists.
- **The class previews came free from PR 11's paperdoll.** They were `ensurePlayerTexture` +
  `add.image`; they are `weaponPreviewSvg(classDef.startingWeaponId)` now, which is the same rig and
  needs no scene to draw into.
- **The name box was always the awkward part, and now it is not.** It was a real `<input>` riding in
  on `add.dom`, which is the only reason `dom.createContainer` was in the config at all. Its
  font-size stays at 16px on purpose: anything smaller and iOS Safari zooms the page when it takes
  focus.

_Original spec:_ `CharacterCreate` + `Boot`/`Preload` flow to plain DOM/TS, removing
`dom.createContainer` from `main.ts`; the fresh-save first-run path in smoke.

Two constraints to settle in this phase rather than rediscover:

- **Floating combat text is in-renderer, not DOM.** Billboard it. Otherwise the DOM HUD needs
  per-frame world→screen projection forever.
- **"Nothing may be drawn under the tab bar"** becomes CSS layout, solved once. In 3D an opaque DOM
  bar swallows the tap automatically, so `applyCameraZoom`'s viewport hack is _removed_ rather than
  ported. The underlying requirement — the south signpost must stay tappable — carries forward as an
  orbit-camera pitch/distance constraint, and smoke already measures the signpost's distance from the
  viewport bottom.

---

## Phase 3 — Three.js

### PR 13 — Renderer bootstrap — done, merged

What landed that this document did not predict, and that PR 14 onwards inherits:

- **A renderer owes the boot flow a host, and that was the prerequisite.** `bootFlow.ts` had a
  `Phaser.Game` in its signature, so the 3D path could only reach it by importing the engine or
  copying the if-statement. It takes a `GameHost` now — an `EventBus` and `startZone()` — and moved
  out of `scenes/` to sit beside `main.ts`. Everything `ZoneScene` does other than draw (the frame
  loop, the keyboard, mounting the HUD, the reset) is duplicated in `render3d/start3d.ts`, and that
  is the honest shape: the two hosts are peers until PR 20 deletes one.
- **The HUD channel needed an implementation, not just an interface.** `EventBus` was satisfied
  structurally by Phaser's global emitter, and a page with no Phaser on it has nothing to satisfy it
  with. `world/eventBus.ts` is forty lines, and the two semantics that would have bitten are a
  listener being identified by its function _and_ its context (`on(EVENT, this.method, this)` is
  every subscription in the scenes) and a handler that unsubscribes mid-delivery not disturbing that
  delivery.
- **`main.ts` picks the renderer by dynamic import, so only one engine is downloaded.** A 3D page
  never fetches Phaser at all, which smoke asserts directly (`window.game === undefined`). The
  production build splits 1,394 kB of Phaser from 524 kB of Three.js, which is the difference
  between measuring the 3D view on a phone and measuring both engines at once.
- **The plan's yaw formula was one convention off, exactly as it warned.** For a mesh whose forward
  is +z — the convention every primitive in `render3d/` will be built to — it is `atan2(vx, vy)`,
  not `-atan2(vy, vx) - π/2`. It is in `coords.ts` with a test that rotates a forward vector and
  checks where it lands, which is the form that cannot be wrong about a sign.
- **The tab-bar rule does not disappear in 3D, it changes hands.** This document expected the DOM
  overlay to make `applyCameraZoom` unnecessary, and it does make the _hit test_ unnecessary — but
  a full-bleed canvas still draws world under an opaque bar, and a perspective camera cannot shrink
  its viewport without changing what it shows. So the requirement lands on the camera's framing, and
  it is not symmetric for free: ground nearer the camera spreads over more pixels than ground
  further away, so a centred player has visibly less room below them than above. Pitch, distance and
  a look point aimed 80px short of the player are what put the south signpost back in reach, and
  `tests/render3d/camera.test.ts` measures it at three phone sizes.
- **`projectToScreen` has to update the camera's world matrix itself.** Projection reads
  `matrixWorldInverse`, which the renderer rebuilds once a frame — so a `worldToScreen` asked
  _between_ frames, which is exactly what a smoke check does, otherwise answers from wherever the
  camera was standing last. It was off by four hundred pixels and looked like a framing bug.
- **A raw rAF loop has to clamp its own delta.** Phaser's `TimeStep` was doing it: a backgrounded
  tab comes back with an hour on the clock, and handing that to `update()` as one frame resolves an
  entire AFK session through code written for tens of milliseconds.
- **The 2D camera clamped to the world bounds and the 3D one does not**, so the void beyond the map
  edge is visible on a portrait phone even from the middle of town. Known and left: the fix is a
  terrain skirt or a camera bound, and it wants to be decided alongside the meshes and the orbit
  rather than guessed at now.

<details>
<summary>Original PR 13 specification, kept for the record</summary>

**PR 13 — Renderer bootstrap.** `three` dep, a **production-readable** `?renderer=3d` flag (not
`import.meta.env.DEV`-guarded like `window.game` is — merging publishes to Vercel, and this needs to
be dogfoodable from a preview URL on a real phone). Ground mesh from the tile grid, lighting, fixed
3/4 camera, resize, and `dispose()` wired into `loadZone`. Default stays 2D.
_Verify:_ a zone-walk loop shows flat `renderer.info.memory`; the camera keeps the south signpost
above the HUD.

</details>

### PR 14 — Entity meshes — done, merged

What landed that this document did not predict, and that PR 15 onwards inherits:

- **`render3d/actors.ts` is the 3D `entities/`, and an actor is three layers rather than one.** An
  outer group holds the world position, a facing group holds the yaw, and the nameplate hangs off
  the outer one — because a billboard is made by overwriting its rotation from the camera every
  frame, which cannot survive being parented to something already being turned toward where the
  creature is walking. Getting that wrong is invisible until the camera rotates, which is PR 16.
- **The rig paid off a second time.** `stickFigure()` already had a shoulder, a hip and a hand in it
  for the sprite and the paperdoll, so the 3D figure is the same landmarks read as heights above the
  feet — one `footY - y` conversion and nothing new to keep in step. Its walk borrows the same
  `legOffsets`: the stance is the anatomical gap between the legs and the stride amplitude is how
  far phase 1 moves a foot out of it, so both renderers walk the same walk and `playerFigure()`
  answers `stand:0` / `walk:1` / `walk:2` on either. That is what let the smoke check for the walk be
  written twice from one idea rather than invented again.
- **`NPC_APPEARANCES` had to become shared, and the creature colours deliberately did not.** The
  shopkeeper and the bandit are the rig with no `CharacterState` behind them, so their colours moved
  into `AppearanceSystem` and `generateTextures.ts` reads them too. A rat's brown stayed duplicated
  in `render3d/palette.ts` on purpose: nobody sees both renderers at once, and inventing a data
  schema for art that PR 20 deletes costs more than it saves.
- **`renderer.info.memory` counts what has been _uploaded_, not what exists.** With one ground mesh
  that distinction never showed; with a hundred and twenty geometries it makes the leak check a
  question about where the camera has looked. Three runs passed by luck before this was noticed. The
  smoke sweeps the camera over the whole zone before both snapshots now, which makes the comparison
  the zone's entire GPU footprint and is a stronger check than the one it replaces.
- **A nameplate is the only texture in the 3D client**, baked from a canvas, and it is what made
  `disposeTree` name `material.map` explicitly — a `SpriteMaterial.dispose()` leaves its texture on
  the card. It is also why the unit suite stubs a 2D context: jsdom has none, and skipping the label
  would skip the con colour, which is a gameplay signal rather than decoration.
- **`DrawnCounts` grew `mobs` and `nodes`, in both renderers.** Neither handle could see a view that
  quietly drew fewer rats than the zone spawned: the leak check compares the view only against
  itself, and `window.world` cannot tell whether anything drew anything. Comparing the two is the
  check the plan asked for by "every entity type present and correct in all three zones".
- **The camera's pitch and a standing figure are in tension, and PR 16 inherits it.** At 58° from
  the horizon a 64-unit figure foreshortens to about half its height while a rat's 80-unit footprint
  does not, so the player reads smaller than the thing attacking them. A shallower pitch fixes it and
  pushes the south signpost back down toward the tab bar, which is the constraint
  `tests/render3d/camera.test.ts` holds. Weigh it there rather than here.
- **Occlusion is real and already visible.** Standing a player north of a tree hides them completely
  behind its canopy — the fixed camera does not make this rare, it only makes it predictable. The
  plan already schedules the decision for PR 16; this is the confirmation that it cannot be skipped.

<details>
<summary>Original PR 14 specification, kept for the record</summary>

**PR 14 — Entity meshes.** Primitives driven by the surviving `computeAppearance()` (gear → colours):
capsule figures, box rat, ellipsoid crab, cylinder+cone tree, plane fishing spot, signpost, campfire.
Facing from velocity via the yaw helper. Billboard health bars. `generateTextures.ts` becomes unused
by the 3D path but is not yet deleted.
_Verify:_ every entity type present and correct in all three zones.

</details>

### PR 15 — Raycast picking — done, merged

What landed that this document did not predict, and that PR 16 onwards inherits:

- **Picking the meshes would have been wrong, and the failure is silent.** A ray aimed at a
  figure's feet — which is exactly what `view.worldToScreen(x, y)` answers, and roughly what a
  player aims at — passes up through the gap between its legs and out the other side without
  touching anything: the shopkeeper would have been untappable at the one point every other part of
  the codebase calls their position. So each actor answers `pickBox()` with a box instead — its
  collision footprint, standing as tall as it is drawn. `buildSignpost`'s comment in PR 14 promising
  "PR 15's raycast will pick it by the same geometry a thumb aims at" was right only for things
  solid at their base.
- **A box is also the touch-target answer.** The camera frames twelve tiles across the short side,
  so on a 390px phone a simulation pixel is worth half a screen pixel and a crab's 35-unit body is
  18px of thumb. `MIN_PICK_SPAN` rounds every volume up to three quarters of a tile, which costs
  nothing when the things being picked are tiles apart. It is the 3D form of the same argument
  `THEME.touchMin` makes about the tab bar.
- **The order is a priority and not a depth sort**, which is why each kind is asked separately
  rather than intersecting one list: a rat wandering in front of the shopkeeper does not stop you
  shopping. Within a kind the nearest does win — you tapped a pixel, and what is drawn there is
  whichever the ray meets first.
- **The ground is the mathematical `y = 0` plane, not the terrain mesh.** The mesh stops at the map
  edge and the simulation does not — walking into the edge is how a zone is left — so a tap past
  the shore has to answer with a point out there, the way the 2D camera's `getWorldPoint` did.
  There is no sky to tap either: the camera is pitched further down than half its field of view, so
  the horizon is off the top of the screen. The `null` a ray-that-never-lands returns is a guard
  against PR 16's movable camera, not a case a player can reach today, and there is a test saying
  so both ways.
- **A corpse is not a target now, where in 2D it was.** Phaser's hit test only skipped an object
  that had stopped rendering, so a mob mid-death-fade could still be clicked and selected; a
  `pickBox()` that answers `null` the moment `isAlive()` does is both simpler and the behaviour that
  was always intended.
- **This is the first PR where the two renderers' input paths are genuinely peers.** `ThreeHost`
  binds `pointerdown` on the canvas and asks `ZoneView3D.resolveTap(x, y)`, which is
  `ZoneScene.handlePointerDown` / `resolveTap` with the hit test swapped — and a tap on the HUD
  still never arrives, because it is an HTML overlay above the canvas.
- **Nearly all of it is unit-testable, which was not obvious.** Intersecting `Box3`s against a
  `Ray` needs no WebGL context, so `tests/render3d/picking.test.ts` projects a point to the screen
  with the real camera and casts back through it — the round trip where a sign error in either
  direction would otherwise cancel out and hide. Smoke covers only what a browser adds: a real
  `PointerEvent` in page coordinates against a camera the render loop has already moved.

<details>
<summary>Original PR 15 specification, kept for the record</summary>

**PR 15 — Raycast picking.** Tap ground to move, tap entity to target / gather / shop / signpost.
Preserve the existing hit-test priority order exactly — node → signpost → NPC → mob → ground
(`ZoneScene.ts:560-606`). Fixed camera still.
_Verify:_ smoke taps via `view.worldToScreen` in 3D mode.

</details>

### PR 16 — Drag-orbit and gesture disambiguation — done, merged

What landed that this document did not predict, and that PR 17 onwards inherits:

- **The threshold has to latch, and "movement + time" is two rules for two different mistakes.** A
  net-displacement comparison gets the common case right and the ugly one wrong: a drag that goes
  out and comes back finishes within a pixel of where it started, so releasing there reads as a tap
  and walks the player off. `OrbitGesture` accumulates travel and, once past `TAP_SLOP_PX`, is a
  drag for the rest of the gesture whatever happens next. The time limit is the separate, phone-only
  case of a thumb resting on the screen.
- **W stopped meaning north, and that is a bug the plan did not schedule.** Yaw rotation makes the
  keyboard point somewhere other than up the screen the moment the camera moves, which is
  disorienting in a way no test would have caught. `InputState.setViewYaw()` rotates the move vector
  into simulation space; the 2D host never calls it, so nothing about the Phaser path changes. It is
  a Phaser-free system learning about a view, which is the smallest place to put it — the
  alternative was `ZoneWorld` taking a camera angle.
- **Occlusion is real but much rarer than expected, because the camera is steep.** At 58° the sight
  line rises 1.6 units for every unit toward the camera, so a 100-unit canopy only gets in front of
  a player standing within about a tile and a half of it — which is precisely the range they stand
  in to gather from it, so it still had to be solved. Fade-on-occlude rather than short props: the
  alternative pays for the camera in the art forever, and the same argument would come straight
  back for a building.
- **A tree needs three different boxes and they are all different sizes.** The trunk stops you
  walking (`node.blockerRect()`), a thumb-sized volume is what a tap is picked against
  (`MIN_PICK_SPAN`), and the drawn canopy is what hides the player. Testing occlusion against
  either of the first two lets the camera look straight through a crown. `NodeProp.sightBlock()`
  answers the third, from `props.ts`, where the canopy's height is actually decided.
- **Fishing spots must be excluded from the fade rather than merely unaffected by it.** They are the
  one prop drawn `transparent: true` on purpose, so a fade that restores opacity to 1 and clears
  `transparent` puts them back wrong — a bug that only appears after a camera swings past one.
- **The camera had to start being framed before the actors sync, not after.** Nameplates are
  billboarded against it and the fade is measured along it, so the old order left both a frame
  behind. Invisible while the camera only ever looked north; a wobble the moment it turns.
- **`?loop=manual` still made the smoke check deterministic, and the drag needed no new handle.**
  The camera's angle is read as its consequence — where a fixed world point is drawn — which is how
  the check stays a statement about what a player sees rather than about a number only this
  renderer has. Occlusion got no smoke check at all: intersecting a box with a ray needs no GPU, so
  the unit suite covers it against the real camera and the real `NodeActor`.

<details>
<summary>Original PR 16 specification, kept for the record</summary>

**PR 16 — Drag-orbit and gesture disambiguation.** Yaw rotation, plus a movement+time threshold
separating drag-to-rotate from tap-to-move, pointer capture, and `touch-action: none`. This is the
fiddliest PR in the plan and must not be bundled with picking. Also handle **occlusion** — a new
problem 2D never had, since `setDepth` solved it for free: with a rotatable camera, trees will hide
the player and you cannot tap what you cannot see. Decide fade-on-occlude vs. short props here.
_Verify:_ mobile-emulation smoke — a drag rotates without issuing a move; a tap still moves.

</details>

### PR 17 — Feedback layer — done, merged

What landed that this document did not predict, and that phase 4 inherits:

- **Two of the five line items were already done, and one of them by accident.** The campfire's
  flicker shipped with the props in PR 14, and so did the corpse fade — `MobActor` was already
  reading `mob.deadForMs`, because the death clock had to be the world's for the respawn to happen
  headlessly. What was left of "death animation" was the fall, six lines against the same clock.
  What was genuinely missing was the whole `WorldEvent` half: `ThreeHost.tick` was discarding the
  frame's events entirely, with a comment saying so.
- **The mapping from event to effect belongs to the fx layer, not to the view.** It started in
  `ZoneView3D` as a mirror of `ZoneScene.render`, where it needed a WebGL context to reach — which
  means a soak drawn above its wound, a spell coloured apart from a swing and a fizzle over the
  caster would all have been smoke's to check or nobody's. Moved into `FxLayer.draw(event)` it is
  thirteen unit tests against a stubbed canvas, and `ZoneView3D.draw` is a forEach.
- **The two clocks are the interesting part.** Effects age on the view's clock and the corpse on the
  world's, which is not an inconsistency: one is a reading-comfort decision and the other has to
  happen whether or not anything is drawing. The consequence is that under `?loop=manual` a bolt
  ages while the simulation stands still — which is why the smoke check reads `drawnCounts().fx`
  immediately after the step that caused it rather than screenshotting a 180ms flight.
- **`FLOAT_TONE_COLORS` had to be shared, and it points at a small layering question.** The tone to
  colour map was six lines in `ZoneScene`; a second copy in `render3d/` is exactly the "two
  renderers drawing different games" hazard `TILE_COLORS` exists to avoid. It is in `ui/theme.ts`
  now, which costs `ui/` a type-only import of `FloatTone` from `world/` — the first edge in that
  direction, and erased at build.
- **`drawnCounts` grew `fx`, and 2D's `labels` count had to get narrower to make room.** A float in
  2D is a `Phaser.GameObjects.Text` like every name label, so the two were being counted as one
  thing; the 3D half would have had the same collision had the float sprites kept the nameplate's
  `userData.kind`. Both now count furniture and moments separately, and the leak check is unchanged
  because it runs before anything fights.
- **A jsdom canvas stub was already duplicated in two test files** and this would have made three,
  so it is `tests/render3d/canvasStub.ts` now. It is not a tidy-up: what the text _says_ is
  gameplay — a con colour is how difficulty is read, a tone is how a soak is told from a wound — so
  the stub records rather than swallows.
- **A bolt is invisible for its first frames, because it starts inside the caster.** Found in the
  visual pass, where the obvious screenshot (cast, step once, shoot) showed nothing at all. It is
  not worth solving — 180ms later it is clear of the figure and the whole flight is 180ms — but it
  is the reason the smoke check asserts that a cast drew _something_ rather than hunting for a
  sphere.

<details>
<summary>Original PR 17 specification, kept for the record</summary>

**PR 17 — Feedback layer.** Floating combat text, selection ring, ability bolt VFX, death animation,
campfire flicker.
_Verify:_ visual pass plus smoke's existing ability and kill checks in 3D.

</details>

---

## Phase 4 — cutover

**PR 18 — 3D smoke parity**, including a CPU-throttled `rate: 8` run. A WebGL scene costs more per
frame than a tilemap, so this is where PR 5's slow-frame collision work actually gets validated.
_Verify:_ full smoke green in `?renderer=3d` at ~7fps.

**PR 19 — Flip the default.** 2D reachable via `?renderer=2d`.
_Verify:_ CI green on the flipped default; Vercel preview checked on a real phone.

**PR 20 — Delete Phaser.** The `ZoneScene` view, entity base classes, `generateTextures.ts`, the
`main.ts` config, and the dependency itself.
_Verify:_ bundle size drops; extend PR 1's guard test to forbid `phaser` repo-wide.

---

## Verification strategy

- `npm run test` after every PR; `tests/systems/progression.test.ts` catches accidental pacing or
  reward changes.
- `npm run smoke` **locally before every PR** — it blocks merges, and finding out from CI wastes a
  cycle.
- **Slow frames are asked for rather than throttled into existence**, since PR 9: `view.step(140, 50)`
  and the vitest harness's `tick(steps, deltaMs)` both take the delta. A CPU-throttled run
  (`Emulation.setCPUThrottlingRate: 8`, per the recipe in `CLAUDE.md`) is still the right tool for
  **PR 18** specifically, where the question is what a real WebGL frame costs rather than how our
  maths behaves at a given delta.
- The combat curve is tuning, not code: a fresh level 1 beats a level 1 rat comfortably, sweats
  against a level 2, loses to a level 3. Re-check after PR 6.

## `CLAUDE.md` is a per-PR deliverable

Roughly eight statements in it become false during this port — arcade physics, runtime-generated
textures, the "never exceed speed" note, `clipToMask`, the Phaser tab bar, the scene flow, the
`window.game` handle, the Phaser-free seam list. **Amend it in the PR that falsifies it**, not at the
end; otherwise every intermediate PR is reviewed against a lying document.

## Workflow

Branch off `main` and open a PR for every item above — never commit to `main`. Keep genuinely
independent parts as separate commits within a PR; this repo merges with merge commits rather than
squashing, so that structure survives in history.
