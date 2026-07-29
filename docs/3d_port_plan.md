# Port plan: 2D Phaser → 3D Three.js

**Status:** planned, not started. Written 2026-07-28 against `03a1c45`.

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

**PR 7 — Extract `ZoneWorld`.**
A Phaser-free class owning entities, spawning and the update loop. `ZoneScene` becomes a thin view.
Expose `window.world`.

The part that makes this more than a rename: **`ZoneWorld` must emit a `WorldEvent[]` per tick** —
`hit`, `death`, `spawn`, `bolt-cast`, `gather-tick`, `zone-exit`. Today `castBolt` and
`showFloatingText` are inline `this.tweens.add` calls; without an event channel the 3D view has no
way to know a bolt was cast.

`ZoneWorld` should **not** own zone loading or persistence here — emit
`{kind: 'zone-exit', to, edge, fraction}` and let the host act, or this PR has to solve
`scene.restart` too.
_Verify:_ a headless vitest harness ticks a full combat → death → respawn cycle. Smoke unchanged.

**PR 8 — `world.loadZone()` replaces `scene.restart`; `GameContext` replaces the registry.**
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

**PR 9 — Migrate the smoke check while everything is still green.**
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

Then **move whole categories out of smoke into vitest**, now that the world is headless: leashing,
aggro engage, death reset, gather-refusal-on-full-pack, AFK anchor.
_Verify:_ smoke green at roughly 600 lines; unit suite visibly larger. This is the highest-leverage
risk reduction in the plan — it de-risks every remaining PR.

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

**PR 10 — DOM HUD shell.** Tab bar and sheet container over the Phaser canvas, reusing `layout.ts`,
`theme.ts` and `uiEvents.ts`. Note `THEME` stores colours as `0x` numbers for Phaser and `#` strings
for text — the DOM path needs one conversion helper.
_Verify:_ `getBoundingClientRect().width >= 44` for all 7 tabs at 375px — the existing constraint,
now measured in CSS.

**PR 11 — Port all panels to DOM; delete `UIScene`, the 18 Phaser `ui/` files, and `clipToMask.ts`.**
The documented WebGL geometry-mask trap dies here — CSS `overflow: hidden` replaces it outright.
_Verify:_ every sheet opens, scrolls and clips; smoke's UI assertions rewritten against the DOM.

**PR 12 — `CharacterCreate` + `Boot`/`Preload` flow to plain DOM/TS.** Removes `dom.createContainer`
from `main.ts`.
_Verify:_ the fresh-save first-run path in smoke.

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

**PR 13 — Renderer bootstrap.** `three` dep, a **production-readable** `?renderer=3d` flag (not
`import.meta.env.DEV`-guarded like `window.game` is — merging publishes to Vercel, and this needs to
be dogfoodable from a preview URL on a real phone). Ground mesh from the tile grid, lighting, fixed
3/4 camera, resize, and `dispose()` wired into `loadZone`. Default stays 2D.
_Verify:_ a zone-walk loop shows flat `renderer.info.memory`; the camera keeps the south signpost
above the HUD.

**PR 14 — Entity meshes.** Primitives driven by the surviving `computeAppearance()` (gear → colours):
capsule figures, box rat, ellipsoid crab, cylinder+cone tree, plane fishing spot, signpost, campfire.
Facing from velocity via the yaw helper. Billboard health bars. `generateTextures.ts` becomes unused
by the 3D path but is not yet deleted.
_Verify:_ every entity type present and correct in all three zones.

**PR 15 — Raycast picking.** Tap ground to move, tap entity to target / gather / shop / signpost.
Preserve the existing hit-test priority order exactly — node → signpost → NPC → mob → ground
(`ZoneScene.ts:560-606`). Fixed camera still.
_Verify:_ smoke taps via `view.worldToScreen` in 3D mode.

**PR 16 — Drag-orbit and gesture disambiguation.** Yaw rotation, plus a movement+time threshold
separating drag-to-rotate from tap-to-move, pointer capture, and `touch-action: none`. This is the
fiddliest PR in the plan and must not be bundled with picking. Also handle **occlusion** — a new
problem 2D never had, since `setDepth` solved it for free: with a rotatable camera, trees will hide
the player and you cannot tap what you cannot see. Decide fade-on-occlude vs. short props here.
_Verify:_ mobile-emulation smoke — a drag rotates without issuing a move; a tap still moves.

**PR 17 — Feedback layer.** Floating combat text, selection ring, ability bolt VFX, death animation,
campfire flicker.
_Verify:_ visual pass plus smoke's existing ability and kill checks in 3D.

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
- **CPU-throttled smoke** (`Emulation.setCPUThrottlingRate: 8`, per the reproduction recipe in
  `CLAUDE.md`) on PRs 5, 6 and 18 specifically. Copy `scripts/smoke.mjs` into `scripts/` under
  another name so `playwright` resolves, then delete the copy.
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
