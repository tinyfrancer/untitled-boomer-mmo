# Cleanup plan: consolidation before new features

**Status:** in progress. Written 2026-08-05 against `ebc3ed3`, the merge that finished the 3D
port. Worked one PR per session — see "How to work this plan" and the status table below, which
is the record of what has landed.

## Context

The repo has been through a long run of incremental change: ten feature briefs, a dependency
upgrade stack, and a 20-PR port from Phaser 2D to Three.js 3D that finished at `ebc3ed3`.
Before more functionality lands on top, this pays down what the accumulation cost.

The good news shapes the plan. **The architecture CLAUDE.md describes is genuinely held.**
Nothing under `src/systems`, `src/world`, `src/hud`, `src/ui` or `src/data` imports `three` or
`render3d/`. There is not one `any`, not one non-null assertion, no commented-out code and no
TODO/FIXME in the tree. `lint`, `typecheck`, `test` (60 files, 727 cases, 9.4s) and
`prettier --check` are all clean right now, and every CLAUDE.md constant spot-checked
(`PLAYER_HALF_EXTENT` vs `EXIT_MARGIN`, `TAP_SLOP_PX`, `MIN_PICK_SPAN`,
`CHARACTER_STATE_VERSION`, the substep cap, the seven tabs, the `WorldEvent` list) is accurate.

So this is consolidation, not rescue. The cost is concentrated in five places:

1. **`world/ZoneWorld.ts` is 1514 lines and 65 methods**, with 24 hand-drawn section banners that
   enumerate its own separable subsystems. `hud/Hud.ts` is 695 with a 132-line `subscribe()`.
2. **The HUD event channel is entirely untyped.** 38 constants, 73 emit sites, 28 listen sites,
   and `emit(event: string, ...args: unknown[])` verifies none of it. A mismatch between the two
   40-line import blocks fails silently at runtime.
3. **Items never got an id union.** Every other table is `Record<XId, Def>`; `ITEMS`,
   `LOOT_TABLES` and `COOKING_RECIPES` are `Record<string, …>`, so a typo in a recipe is a
   runtime `undefined`.
4. **`src/hud/` has no unit tests at all** — 22 files, 2,963 lines of engine-free, jsdom-testable
   code, covered only by the slowest merge-blocking gate.
5. **Phaser-era residue**: two dead data fields still populated in every row, four dead exports,
   a joystick in the README that no longer exists, and a dependency plan for a deleted engine.

---

## How to work this plan

**One PR per session.** Every PR below is independently mergeable and leaves `main` green. There
is no half-finished state to carry between sessions — if a session ends, it ends after a merge.

**Step 0, before any code: land this document as `docs/cleanup_plan.md`** on its own branch and
PR. That is where the status table lives, and it is how a future session (or a fresh context)
knows what is already done without re-deriving any of it. `docs/archive/3d_port_plan.md` and
`docs/upgrade_plan.md` already use exactly this convention — status line at the top, updated as
each PR merges.

**Each session:**

1. Read `docs/cleanup_plan.md`, find the first unchecked row, and do only that one.
2. Branch from `main` (`git checkout -b cleanup/NN-short-name`). Never commit to `main`.
3. Work the PR's checklist. Keep the commits it names separable — PRs here merge with a merge
   commit, so that structure survives in history.
4. Run the gates, then `npm run smoke` if the row says to.
5. **Last commit of every PR ticks its own row** in `docs/cleanup_plan.md` with the date and the
   merge SHA, the way the port plan records its PRs.
6. `gh pr create`, merge, stop.

**Order matters in three places only.** Everything else can be reordered or dropped:

- PR 4 (tests) must precede PR 7, 8 and 9 — it is their regression proof.
- PR 5 (typed bus) must precede PR 8 — the split leans on the typed channel.
- PR 6's id unions must land before its `noUncheckedIndexedAccess` commit, not after.

PRs 1, 2 and 3 are pure hygiene and can be done in any order, or skipped, without affecting
anything downstream. If a session has little budget, take PR 2 — it is docs only.

**Sizes** are the honest estimate of session budget, not of line count: `S` fits comfortably in a
short session, `M` is a full one, `L` should be the only thing that session does.

---

## Status

| #   | PR                                       | Size | Depends on | Status       |
| --- | ---------------------------------------- | ---- | ---------- | ------------ |
| 0   | Land this plan as `docs/cleanup_plan.md` | S    | —          | ☑ 2026-08-05 |
| 1   | Tooling and CI gates                     | M    | —          | ☑ 2026-08-06 |
| 2   | Docs truth pass                          | S    | —          | ☑ 2026-08-06 |
| 3   | Dead code and Phaser residue             | M    | —          | ☑ 2026-08-06 |
| 4   | The safety net: targeted tests           | M    | —          | ☑ 2026-08-06 |
| 5   | Type the event channel                   | M    | —          | ☑ 2026-08-06 |
| 6   | Id unions and index safety               | L    | —          | ☑ 2026-08-06 |
| 7   | Shared primitives and modal lifecycle    | M    | 4          | ☑ 2026-08-06 |
| 8   | Split `hud/Hud.ts`                       | M    | 4, 5, 7    | ☑ 2026-08-06 |
| 9   | Split `world/ZoneWorld.ts`               | L    | 4          | ☑ 2026-08-07 |
| 10  | The deferred behaviour changes           | M    | —          | ☐            |

---

## PR 1 — Tooling and CI gates · `cleanup/01-tooling` · M — done, merged

No `src/` changes. Lands early so everything after it is measured.

- [x] **`prettier --check` in CI.** Formatting is the stated source of truth and _nothing anywhere
      runs a check_ — it is clean by discipline alone. Added a `format:check` script and a CI step.
      The `.prettierignore` this asked for is nearly redundant: **prettier already honours
      `.gitignore`**, verified by dropping a badly-formatted file into `dist/` and watching
      `--check` pass it. So it holds one line, `package-lock.json`, which is tracked and generated.
- [x] **`no-only-tests`** in `eslint.config.js`. Zero `.only`s today; nothing stops one landing,
      and a stray `.only` turns green CI into a lie rather than a failure. Scoped to `tests/**`,
      and proven by adding a `describe.only` and watching it fail.
- [x] **Coverage.** An `npm run coverage` script, reported in CI with **no threshold gate**.
      **Istanbul, not the `@vitest/coverage-v8` this named** — v8 can only report a file some test
      imported and emits every other one as `0/0` statements, which the reporters round up to
      100%. All 22 `src/hud/` files scored a perfect 100 under it, and the project read 93.4%.
      Under istanbul they read 0% of a real statement count and the project reads **67.6%**, which
      is the hole this bullet exists to surface.
- [x] **Drop the duplicate `tsc`.** `npm run build` is `vite build` now. CI keeps the explicit
      `npm run typecheck` step before it, so the gate is named rather than a side effect of the
      build, and there is one pass per job instead of two.
- [x] **Typecheck `scripts/`.** `tsconfig.scripts.json` with `allowJs`+`checkJs`, fully `strict`
      like the main one, and `moduleResolution: bundler` so it can reach into `src/`. It found 186
      errors. The half worth having came from `scripts/globals.d.ts`, which gives `window.world`,
      `window.view` and `window.events` their real types — nothing in `src/` declares them, since
      `start3d.ts` installs them through a cast. Real finds: five `.find()` results used without a
      guard, `character.state.afk` dereferenced where it is nullable, and a check that bolted
      `before`/`after` onto an object the page had returned. The rest is JSDoc, which is the only
      place a `.mjs` has to put a type.
- [x] **`--section=<name>` for smoke.** The flat `try` is 19 `async function`s and a `SECTIONS`
      table now; `--section=a,b` filters it and an unknown name lists them all and exits 2. `boot`
      always runs, since it creates the character. The caveat is real and is documented in the
      file: sections share a page and carry state forward, so `--section=bag` alone fails its clip
      check — the sheet it measures is 50px taller without the title `achievements` wears.
- [x] Fix `ci.yml:78` — "the first request cold-compiles all of **Phaser**".

Commits: one per bullet group (CI gates / coverage / tsconfig / smoke sections).
**Verify:** gates, plus one `npm run smoke` to prove `--section` didn't break the whole run.
**Done when:** CI shows a format check, a coverage report, and one `tsc` per job.
**Landed:** 77/77 smoke, unchanged; coverage 67.6% statements.

## PR 2 — Docs truth pass · `cleanup/02-docs` · S — done, merged

No `src/` changes. The cheapest PR here and the one that stops future sessions being misled.

- [x] **`README.md`** — says "This is v0: a single-player starting town with rats to kill" (two
      feature-eras ago) and documents "**drag the on-screen joystick, bottom-right**". There is no
      joystick; zero hits anywhere in `src/`. Rewrite stack and controls (tap-to-move,
      drag-to-orbit, the options menu as the supported reset path); add `npm run smoke` to the
      scripts table.
- [x] **`CLAUDE.md:533`** points at `generateTextures.ts` as a comment-style example. Deleted in
      PR 20. Swap in a live one. Add a line noting the `docs/feature_N_*.txt` briefs are original
      prompts, a historical record rather than current spec — `feature_6_v1.txt` says "crabs lvl
      4-6" against `spawns.ts`'s actual 1-3, which is superseded rather than wrong.
- [x] **`docs/upgrade_plan.md`** is actively misleading: its central table still reads
      `phaser 3.90.0 → 4.2.1, Take deliberately — PR 2`, with a section on Phaser 4 geometry masks
      and a reference to the deleted `scenes/generateTextures.ts`. Only the TypeScript 7 row is
      live. Cut to that row, mark the rest superseded.
- [x] **`docs/refactor_systems_seam.md`** is marked done but frames the world in Phaser terms and
      points at an `ARCHITECTURE` file that does not exist and a deleted `ZoneScene`.
- [x] Move the completed plans into `docs/archive/` so the directory says at a glance which docs
      describe the present. `docs/3d_port_plan.md` moves but stays **verbatim** — CLAUDE.md leans
      on it as the "why is it like this" reference and it is honestly labelled.

**Verify:** gates only. No smoke needed.
**Done when:** grepping `docs/` and `README.md` for "Phaser" returns only archived history.
**Landed:** two hits survive that grep and both are wanted — `README.md` saying the game _was_
2D on Phaser, and this file, which is live and whose PR 3 is entirely about the residue still in
`src/`. `docs/archive/` has a README naming what each archived plan was and when it finished.
The upgrade plan kept its live TypeScript 7 row in `docs/upgrade_plan.md` and archived the rest,
so both a live and an archived copy exist under that name.

## PR 3 — Dead code and Phaser residue · `cleanup/03-dead-code` · M — done, merged

All compiler-verified, so it is safe ahead of the tests.

- [x] **`textureKey` / `depletedTextureKey`** — declared on `EnemyDefinition`
      (`data/enemies.ts:32`) and `ResourceNodeDefinition` (`data/resourceNodes.ts:8,13`) and
      populated in every row, **never read anywhere**. Phaser atlas keys; creatures and props are
      primitives now. Deleted the fields and all seven values.
- [x] **Four dead exports**, each referenced only by its own test: `hud/dom.ts:40` `toggleClass`
      (zero call sites anywhere), `ui/theme.ts:83` `fontPx` (Phaser `Text` needed a `'11px'`
      string; the DOM HUD writes `font-size: ${n}px`), `systems/AppearanceSystem.ts:153`
      `walkAnimationKey` (a sprite-sheet animation key) and `:14` `LEG_PHASES`. The `LegPhase`
      **type** stays — `legOffsets` is keyed by it and `figure.ts` reads it.
- [x] **`place()`'s dead branch** (`hud/dom.ts:30`) — all four callers passed `'position'`
      explicitly, so the `'both'` default and the width/height branch were unreachable. The
      parameter now **names what to size** (`undefined | 'width' | 'box'`) rather than being
      dropped: three callers were re-applying width or height by hand right after the call, and
      that is what folded into the signature.
- [x] **`appearanceTextureKey` → `appearanceKey`.** `phase` went with the name: `src/`'s one
      production call site (`render3d/actors.ts`) never passed a non-default, and the walk is
      animated by rotating hinges now rather than by keying a baked frame.
- [x] **Un-export 13 module-private symbols**: `COMBAT_SKILL_LEVELS_PER_LEVEL`,
      `COPPER_PER_SILVER`, `COPPER_PER_GOLD`, `FIELD_OF_VIEW`, `SLOT_ORDER` (kept `SLOT_LABELS` —
      `SlotPicker` imports it), `TITLE_LINE_HEIGHT`, `beginSession`, `hitsBlockingTile`,
      `hitsBlocker`, `nearestUnder`, `titleIdFor`, `unlockedAchievements`, `xpToReachSkillLevel`.
      Left the ~60 exported types alone; they name exported signatures.
- [x] **Rename `CollisionSystem.ts:13`'s `Rect`** (`{left,top,right,bottom}`) to `Bounds`. It
      shared a name with `ui/layout.ts:3`'s `Rect` (`{x,y,width,height}`) and the fields are
      incompatible — the new declaration says so, since nothing else stops the mistake.
- [x] **Prune the ~30 Phaser comparisons across 21 files** aggressively. The six named as
      outright false are gone (`hud/Sheet.ts` citing the deleted `ui/clipToMask.ts`;
      `data/tiles.ts` and `render3d/ground.ts` describing a tileset baking textures in the present
      tense; `hud/paperdoll.ts`'s "exactly as the texture does it"; `ui/layout.ts` citing
      `UIScene`; `systems/CharacterController.ts`'s "Scenes call these"), and so is every
      remaining "the 2D renderer did X" that only asserted continuity of a magic number.
      **What survives is the rule applied:** a comparison earns its place only where it explains
      why the present code is shaped against an obvious alternative, and it is rewritten to stand
      without the engine's name — `render3d/camera.ts`'s framing argument (a viewport that shrank
      to the reserved band would hold the rule outright; a full-bleed perspective camera cannot),
      `render3d/occlusion.ts`, `world/GameContext.ts`'s autosave accumulator.
- [x] **`worldViewportHeight` is not called by production code** (`ui/layout.ts:131` — only
      `tests/render3d/camera.test.ts`), and `hud/Hud.ts:293` and `hud/dom.ts:27` both claimed it
      was a live rule. **Kept the function** and re-documented it as the specification of the
      reserved band and the oracle the camera tests measure framing against; fixed both claims.

Commits: dead data fields / dead exports / renames / comment prune.
**Verify:** gates + `npm run smoke` (touches actors and HUD).
**Done when:** `grep -rnw 'textureKey' src` is empty and the four dead exports are gone.
**Landed:** 77/77 smoke, unchanged. One `Phaser` survives in `src/` and is wanted:
`world/Player.ts:319`, the note explaining why the integrator clamp is deferred to PR 10 — it
names the comment in `MovementSystem` it contradicts, and PR 10 deletes both. The four surviving
`2D` hits are all about the **simulation** being two-dimensional or about an HTML 2D canvas
context, not about the old renderer.

## PR 4 — The safety net: targeted tests · `cleanup/04-hud-tests` · M — done, merged

Lands before anything that moves code. jsdom is already the vitest environment and
`tests/world/harness.ts` already has `recordingBus`, so this needs no new infrastructure.

New `tests/hud/`:

- [x] **`paperdoll.test.ts`** — the highest-value gap. CLAUDE.md claims the SVG paperdoll and
      `render3d/figure.ts` are built from the same `AppearanceSystem.stickFigure` rig so "a
      shoulder is in the same place in either". The rig is tested and the 3D consumer is tested;
      **the agreement itself is asserted nowhere.** Both sets of landmarks are now read back off
      what was _drawn_ — the SVG's strokes, the meshes' geometries — rather than off the rig, so a
      consumer that stopped using it fails instead of agreeing with itself. Proven by hardcoding
      the paperdoll's shoulder line and watching two cases go red.
- [x] **`Hud.test.ts`** — the one-sheet-open invariant (`Hud` holds a single `openSheet`, asserted
      today only in smoke), the derived encumbrance/shop refreshes, and that `destroy()` closes
      every overlay. **It does not**: `Hud.destroy()` (`hud/Hud.ts:270-282`) closes options,
      slotPicker and awayReport and silently omits `shopModal` — because `ShopModal` is the one
      modal with no `close()`, so `Hud` reaches in with `this.shopModal?.root.remove()` instead.
      Write the assertion, **watch it go red, and leave it red-documented** — PR 7 fixes it. (If
      leaving a failing test is unacceptable, `it.fails()` it with a pointer to PR 7.)
      **The DOM assertion came out green**, and PR 7 should know why: all four overlays are
      appended to the HUD's own root, so `this.root.remove()` takes the shop with it whether or not
      `destroy()` names it. The omission is real but invisible from the DOM, so what is asserted
      instead is the missing lifecycle itself — `'close' in shop`, `it.fails`, which flips to a
      failure the moment PR 7 adds one.
- [x] **`bootFlow.test.ts`** — 54 lines, zero tests, and the module CLAUDE.md singles out as the
      seam proof. A pure function over a two-method interface that decides resume-vs-create. Drives
      the real creation screen (type a name, pick a class, press Begin) against a `GameHost` that
      is a bus and a `vi.fn()`, which is the whole of what a renderer owes the boot.

Three fixes to existing tests:

- [x] `tests/systems/LootSystem.test.ts:57` — `'uses Math.random by default'` is nondeterministic
      _and_ vacuous: `expect(Array.isArray(result.drops)).toBe(true)` passes for any
      implementation that ignores the rng entirely. Now spies on `Math.random`, pins it to 0 and
      asserts the drops and the call count.
- [x] `tests/systems/LootSystem.test.ts:10` — `const rolls = [0.1, 0.9, 0.01, …]` is positionally
      coupled to the exact order and length of the bandit loot table. Adding a row fails it
      opaquely. Replaced by an `rngHitting(tableId, itemIds)` built _from_ the table.
- [x] `tests/world/ZoneWorld.test.ts:176` casts through `unknown` to reach a private field. The
      harness already exposes `bus`, and `tests/world/shop.test.ts` uses it that way.

**Verify:** gates. Coverage (if PR 1 landed) should show `src/hud/` non-zero for the first time.
**Done when:** `tests/hud/` exists and `bootFlow.ts` has a test.
**Landed:** 45 new cases in `tests/hud/`, one of them an `it.fails` held for PR 7. `src/hud/` went
from **0% to 80.1%** statements and the project from 67.6% to **87.3%**; `bootFlow.ts`,
`paperdoll.ts`, `dom.ts` and `styles.ts` are at 100% on every metric, which is why the text
reporter stops listing them. Two things jsdom forces and a future session should not be surprised
by: it lays nothing out, so `Hud.test.ts` installs `clientWidth`/`clientHeight` on
`Element.prototype` to state which side of the breakpoint it is testing, and the creation screen
is a module singleton like the HUD and the session, so a test that boots one has to unmount it.

## PR 5 — Type the event channel · `cleanup/05-typed-events` · M — done, merged

The keystone: highest safety gained per line touched, and it shrinks both 40-line import blocks.

- [x] Add a **`UiEventMap`** to `src/ui/uiEvents.ts` mapping each event name to its payload tuple,
      and make `EventBus` generic over it: `emit<K extends keyof M>(event: K, ...args: M[K])`, same
      for `on`/`off`. `createEventBus` and the test stub both satisfy it unchanged.
      **Not generic over a map parameter** — the methods are generic over the event name and the
      map is named directly, since nothing in the tree supplies a second map and a `M` that is
      always `UiEventMap` costs every implementation a round of casts. The map is keyed by the
      constants themselves (`[TARGET_SELECTED_EVENT]: [target: TargetInfo]`), so the table cannot
      drift from the names. It also found a duplicate: `SkillProgressInfo` was a structural copy
      of `CharacterController`'s `SkillXpGain`, which is what is actually emitted, and is gone.
- [x] **Drop the `context` parameter** from `on`/`off` (`world/worldEvents.ts:57-58`). Its own
      comment says it exists because the bus "was written against the semantics of the game
      engine's global emitter" — and **zero call sites pass one**. Deleting it also simplifies
      `off`'s identity check in `world/eventBus.ts:43-46`. `emit` calls its handlers now rather
      than `apply`ing them against an undefined `this`. The two tests that covered context are
      replaced by the rule that outlives it: the same function subscribed twice is two
      subscriptions and takes two `off`s to drop.
- [x] **Fold positional payloads into objects** where CLAUDE.md's own rule already applies:
      `XP_GAINED_EVENT` is a 3-arg emit (`ZoneWorld.ts:1279` / `Hud.ts:547`) and there is already a
      `CombatXpGain` interface for it; `PLAYER_MANA_CHANGED_EVENT` is two positional args, now a
      `ManaPool`.
- [x] **Rename `GATHER_REFUSED_EVENT` → `NOTICE_EVENT`.** It is the de-facto generic notice
      channel: 14 emit sites in `ZoneWorld`, only 3 about gathering — the rest are "You can't
      afford that", a quest turn-in failure, "You have no logs to burn", "You burn it", "You are
      already at full health", an ability check and an equip failure. `Hud.ts:645` renders them
      all identically as a muted toast. The wire value moved with the constant
      (`'gather-refused'` → `'notice'`) and it now sits beside `COMBAT_LOG_EVENT`.
- [x] **Extract the subscription bookkeeping.** `ZoneWorld.ts:234` and `Hud.ts:97` hand-roll the
      same `Array<[string, handler]>` + loop-and-`off` pattern, which exists purely because the bus
      is untyped. One small typed helper, used by both. `createSubscriptions` keeps the `off` call
      itself rather than the `[event, handler]` pair, which is what makes the two halves
      inseparable; `listen` and `clear` are plain functions so `const { listen } = ...` is safe.

Commits: the map and the generic bus / drop `context` / payload objects / the rename / the helper.
**Verify:** gates + `npm run smoke` (every HUD panel is downstream of this).
**Done when:** `emit` with a wrong payload is a compile error. Prove it locally by breaking one on
purpose before reverting.
**Landed:** 77/77 smoke, unchanged. Proven by breaking two emits on purpose — a string where
`player-hp-changed`'s number goes, and `kills-changed` with no payload — and watching `tsc` name
both. The typing found nothing already broken, which was the expected result: it is a guard
against the next change, not a bug hunt. One thing a future session should know before PR 6 or
PR 8 — a stub bus in a test now has to declare `on`/`off` generically
(`on<K extends UiEventName>(event: K, fn: (...args: UiEventMap[K]) => void)`); the non-generic
`(event: string, fn: (...args: never[]) => void)` those stubs used is not assignable to it, and
the error it produces names an intersection of all 38 payload tuples reduced to `never`.

## PR 6 — Id unions and index safety · `cleanup/06-item-ids` · L — done, merged

Internally ordered so the unions land **before** the compiler flag — with `Record<ItemId, …>` most
lookups become total and the flag's fallout shrinks to the genuinely dynamic ones. Split across
two sessions if needed: the unions are commit 1-3, the flag is commit 4.

- [x] Add **`ItemId`**, **`LootTableId`**, **`RecipeId`** to `types/ids.ts` and key their tables on
      them. `itemId: string` currently runs through ~26 files: `EquipSystem`, `ItemActionsSystem`,
      `data/recipes`, `data/quests`, `data/resourceNodes`, every `CharacterController` method and
      the four HUD panels. `Mob.lootTableId?: string` likewise. **`RecipeId` is spelled as a subset
      of `ItemId`** (`Extract<ItemId, …>`), since a recipe is keyed by what goes in the pan — which
      is what lets `recipeForInput` narrow an arbitrary item to a recipe through a type guard
      rather than a cast.
- [x] **Use the aliases that already exist.** `Record<GearSlotId, string | null>` is spelled out 14
      times despite `export type Gear` at `systems/InventorySystem.ts:5`; `Record<string, number>`
      7 times despite `Inventory`. `Inventory` became `Partial<Record<ItemId, number>>` rather than
      a total record: a bag is sparse, and `Partial` is what makes every existing `?? 0` honest and
      `{}` a legal empty bag.
- [x] Move **`ZoneEdge`** from `data/zones.ts` into `types/ids.ts` with the other unions, and
      replace `ZoneSystem`'s `ArrivalPoint` with the existing `Point` from `MovementSystem`.
- [x] **Make the id switches exhaustive.** `systems/ZoneSystem.ts` has four `switch (edge)`
      statements (`:24`, `:37`, `:62`, `:129`) and three use `default:` in place of `case 'east'`,
      which defeats exhaustiveness checking — a fifth edge would silently be treated as east.
      Collapse all four onto one `EDGE_TABLE` keyed by `ZoneEdge`. All four now read two facts off
      it — which axis crosses the edge, and which end of that axis it sits at — and `findExit`
      gained a case covering all four edges, since its shape changed most.
- [x] **Turn on `noUncheckedIndexedAccess`** and fix the fallout. Own commit. **In both projects**,
      including `tsconfig.scripts.json`, which cost six fixes in the merge-blocking smoke script.
- [x] **`hud/CharacterSheet.ts:58-59`** asserts `{} as Record<GearSlotId, SlotRow>` complete before
      populating it. Build it from the ordered lists so a missing `SkillId` is a compile error
      rather than an `undefined` crash in `update()` far from the cause. The **lists** are what
      needed checking — `const ORDER: SkillId[] = […]` checks each element and says nothing about
      what is absent — so `types/exhaustive.ts` holds an `exhaustive<T>()` that rejects a list one
      member short, and `mapKeys` builds a complete record from one.

**Verify:** gates + `npm run smoke`. `tests/systems/progression.test.ts` must pass untouched — it
walks the whole two-quest arc and asserts it ends on level 3, so if an id change moved a number,
that is where it shows.
**Done when:** no `Record<string, …>` remains in `src/data/` and the flag is on.
**Landed:** 77/77 smoke, unchanged; `progression.test.ts` untouched and passing. Proven both ways
on purpose — misspelling `cooked-crab` in a recipe made `tsc` name it and suggest the right id, and
deleting `'fishing'` from `SKILL_ORDER` made it reject the list itself.

Four things a later session should know:

- **`Record<string, …>` survives in four places and all four are wanted.** `InputState`'s two key
  tables are keyed by `KeyboardEvent.code`, `paperdoll.ts`'s `svgEl` takes arbitrary SVG
  attributes, and `persistence/migrations.ts` is deliberately shapeless — it is what runs _before_
  a state has a known shape. `TILE_COLORS` stays `Record<number, …>` because maps are `number[][]`;
  `tileColor()` is the guarded read.
- **Unknown ids are still real, for items only.** A bag saved before an item was retired hands the
  runtime an id no `ITEMS` row answers to, and nothing rewrites inventory ids during a migration,
  so those defensive reads stay and `tests/staleIds.ts` is the single place that spells one.
  `rollLootTable`'s equivalent guard is _gone_: a `LootTableId` is read off an `ENEMIES` row and
  never persisted, so nothing could reach it.
- **`Object.entries`/`Object.values` are lossy** over a `Record` keyed by a union — they must be,
  since a value can carry keys its type never named. `inventoryEntries` and `gearItems` say that
  once each rather than at ~10 call sites.
- **The flag hit the tests hardest** — 143 errors, nearly all downstream of a
  `const mob = world.mobs[0]` that half a test hangs off. `tests/nth.ts` answers all of them and
  asserts, so an empty array fails on the line that asked for it.

## PR 7 — Shared primitives and modal lifecycle · `cleanup/07-primitives` · M — done, merged

Depends on PR 4. Keep these as separable commits.

- [x] **One `clamp` / `barFill(value, max)`.** The bar-fill ratio is written six times with
      **three different answers for the degenerate case**: `PlayerColumn.ts:65,76`,
      `CharacterSheet.ts:142`, `GatherBar.ts:32`, `render3d/nameplate.ts:53` (returns 0 where the
      others return 1), and `ActionBar.ts:56` which sets `height: ${cooldownRemaining * 100}%`
      **with no clamp at all**. There is already a private `clamp` at `world/Player.ts:19` that
      none of them use.
- [x] **One `NO_GEAR`** — four copies (`world/Player.ts:12`, `persistence/CharacterState.ts:61`,
      `hud/CharacterSheet.ts:60`, `hud/paperdoll.ts:168`).
- [x] **Move stray geometry into `ui/layout.ts`**, which CLAUDE.md explicitly asks for:
      `Toast.ts:19` (`viewportHeight / 2 - 80`), `GatherBar.ts:22` (`+ 60`), `SlotPicker.ts:96-104`
      (a flip-and-clamp with hardcoded 8px gutters), `Sheet.ts:29-38` (inline left/top/width).
- [x] **Retire the duplicated hex literals.** `hud/styles.ts` hardcodes `cssColor(0xffee58)` (=
      `THEME.color.equippable`) at :74/:689/:718, `0xffd54f` (= `THEME.color.levelUp`) at :558 and
      `0x555577` (= `THEME.panelStroke`) at :682 — while correctly using
      `cssColor(THEME.panelStroke)` at eight other lines in the same file. `hud/paperdoll.ts:99`
      repeats `0xffd54f` again.
- [x] **One modal lifecycle.** `OptionsModal`, `SlotPicker` and `AwayReportModal` each carry an
      identical, independently written `closed` flag + idempotent `close()` + `onClose` callback —
      three copies of the same eight lines — and `ShopModal` has none, which is why `Hud` reaches
      into `shopModal.root` and why `destroy()` leaks it. Extract the shape, give it to all four,
      add `shopModal` to `destroy()`. **PR 4's red test goes green here.**
- [x] **One row builder** for the four hand-rolled label/value rows (`FeatsSheet.ts:79`,
      `ShopModal.ts:131`, `CharacterSheet.ts:80`, `InventorySheet.ts:75`), and one class name each
      for empty states (currently `hud-list-empty` / `hud-dim` / `hud-item-actions__none` /
      `hud-quest__line is-done`) and section headers.
- [x] **Reconcile the two `WeaponShapeId` switches.** `render3d/figure.ts:140` and
      `hud/paperdoll.ts:72` are independent implementations with hand-matched proportions kept in
      step by eye — the same argument that put the stick-figure rig in `AppearanceSystem`.

**Verify:** gates + `npm run smoke` (HUD geometry at real viewport sizes).
**Done when:** PR 4's shop-modal assertion passes and `barFill` has one definition.
**Landed:** 77/77 smoke, unchanged. PR 4's `it.fails` came off and is now four overlays
asserted together. Four things a later session should know:

- **`barFill` answers _empty_ for a `max` of zero, and the two XP bars say "full at a cap"
  themselves.** One function cannot mean both, and which one it is is a fact about levels
  rather than about bars. `ActionBar` gained the clamp it never had — a `cooldownRemaining`
  above 1 stretched the sweep past its own button.
- **The weapon rig moved numbers, not drawings.** `weaponRig` in `AppearanceSystem` holds
  butt/tip/lean/thickness/guard/head as fractions of the figure; each drawer keeps its own
  primitives, since a blade is flat and a haft is round and an SVG line cannot say so. Two
  visible changes fell out: the pole leans sideways rather than back over the shoulder (a
  flat drawing has no depth to lean into, and one number cannot mean both), and the sword,
  pole and axe are now one length in both rather than two matched by eye. A new case in
  `tests/hud/paperdoll.test.ts` reads both back off what was _drawn_ and compares them,
  proven by shortening the paperdoll's rise 10% and watching all four shapes go red.
- **`PALETTE.coin` is gone** — the wand's gem was its last reader, and the gem is
  `WEAPON_GEM_COLOR` beside the rig now, since both drawers need it.
- **The row builder returns its parts** (`{root, label, value}`) rather than an element:
  four of the six callers colour or flag one of them right after building it, which is what
  a builder returning only the root would have sent straight back to hand-rolling.

## PR 8 — Split `hud/Hud.ts` · `cleanup/08-hud-split` · M — done, merged

Depends on PR 4, 5 and 7.

- [x] Extract the **overlay factory** (`openOptions`, `openSlotPicker`, `openShop`,
      `showAwayReport`, `hud/Hud.ts:371-441`) now that all four modals share one lifecycle.
      `hud/OverlayHost.ts` owns all four, and what it owns is _which one is up_ — the only
      question about them that crosses more than one. It reads the shop's state through a getter
      rather than holding a copy: the bag, the purse and the quest log are the HUD's model, and
      the shop is a view of them that happens to be open sometimes.
- [x] Turn **`dispatchItemAction`** (`:443-461`) — a five-case switch mapping `ItemActionId` to an
      event constant — into the two-column table it is. `ItemActionsSystem.ts:6` already defines
      the union, and the bus is typed as of PR 5.
- [x] The model plus its subscription table **stays** in `Hud.ts`. It is a flat, readable table and
      splitting it buys nothing; it shrinks on its own from the typed bus and the smaller import
      block.
- [x] `hud/styles.ts` (751 lines, ~90 selectors) — **leave it.** One injected stylesheet is the
      right shape.
- [x] **Not in the checklist, and worth its own commit:** `hud/keys.ts`. Most of what the keydown
      handler does is decide which keys are _not_ the HUD's — a letter typed into the name box, a
      browser shortcut, the repeats of a held key, an Escape no overlay wanted — and none of that
      was assertable except through whatever a key happened to open.

**Verify:** gates + `npm run smoke`, including the desktop HUD section and the 375px tab-bar
measurement.
**Done when:** `Hud.ts` is under ~500 lines with no behaviour change.
**Landed:** 77/77 smoke, unchanged. `src/hud/` coverage 80.1% → 83.4%, the project 87.3% → 88.0%,
and `keys.ts` at 100% on every metric. Three things a later session should know:

- **`Hud.ts` is 582 lines, not the ~500 this asked for, and the gap was in the estimate rather
  than in the work.** The overlay block this named is 71 lines and its fields and `destroy()`
  calls another 12; the keyboard was 39 more, taken on top of the checklist. That is the whole of
  what is separable. The two things that would close the remaining 80 are the subscription table
  and the model — the two this row says to keep, and for a good reason: the table is one flat line
  per event and the alternative is a second class holding the same twelve references. The rest of
  the file is 85 lines of import, a 130-line constructor that is the wiring itself, and the layout
  arithmetic, which reaches every piece of furniture and so seams nowhere.
- **Escape answers rather than acts.** `closeDismissable()` returns whether an overlay took the
  key, which is what lets the binding fall through to the tabs when nothing was open. The shop is
  deliberately not one of the three it closes: the world owns whether the shop is open.
- **The five item-action buttons had no test at all** — they were covered only by the cooking and
  vendoring flows in smoke, which press them for other reasons. Five cases now walk a bag through
  the panel's own buttons and assert the pairing, proven by pointing Eat at the cook request.

## PR 9 — Split `world/ZoneWorld.ts` · `cleanup/09-zoneworld-split` · L — done, merged

Depends on PR 4. **This should be the only thing its session does.** The section banners already
name the seams; each candidate owns private state (`shopNpc`, `afkAnchor`/`afkRecovering`,
`gatherNode`/`gatherState`, `lastAbilityAt`/`lastAbilitySignature`) and reaches the rest of the
world only through `character`, `events` and `pending` — which is what makes them collaborators
rather than free functions.

```
world/ZoneWorld.ts        ~400  entities, tick, publishers, composition root
world/CombatDirector.ts   ~220  both directions, death, resolveKill, rewards
world/GatherSession.ts    ~180  gather, campfire, cook, eat
world/AbilityCaster.ts    ~150  cast, fizzle, effects, cooldown state
world/AfkCamp.ts          ~140  anchor, decide, recover, eat
world/ShopSession.ts      ~110  open/close/buy/sell/range
world/QuestDesk.ts         ~70  accept, turn in, titles
```

**One collaborator per commit**, smallest first (`QuestDesk` → `ShopSession` → `AfkCamp` →
`AbilityCaster` → `GatherSession` → `CombatDirector`), so the session can stop after any commit
with `main`'s behaviour intact. If budget runs out, the PR still merges with fewer extractions and
the rest carries to the next session — update the table row to say which landed.

Two things to fix while splitting rather than to carry across:

- [x] **The five hand-rolled change-detecting publishers.** `publishPlayerHp`, `publishPlayerMana`,
      `publishAbilityState`, `publishActions`, `publishTarget` (`:957`, `:1037`, `:1193`, `:1452`,
      `:1474`) are five copies of "diff against the last value, emit on change" — four using `!==`
      and one using a string signature (`:1466-1470`). One mechanism, held by `ZoneWorld`.
      **Four, not five**: `publishTarget` does not diff and must not start, since it is what a
      swing, a cast and a level-up call to re-send a mob's vitals. `publishOnChange` takes the
      signature as the argument it always was, plus a seed for what the world opens already
      having said.
- [x] **`pursuingTarget` belongs to the target.** `this.clearTarget(); this.pursuingTarget = false;`
      appears six times (`:504`, `:517`, `:522`, `:532`, `:812`, `:828`). Fold it into
      `clearTarget()`. `ZoneWorld.tap()` (`:499-536`) then collapses, since three of its four
      branches are that identical triple followed by an `approachX()`. Done first, on its own,
      so the collapse is readable against a file nothing else had moved yet.

Each collaborator gets a test file in `tests/world/`. The existing per-feature suites (`combat`,
`abilities`, `afk`, `shop`, `cooking`, `gathering`, `quests`) already drive these paths through the
harness and **must keep passing untouched** — that is the regression proof.

**Verify:** gates + `npm run smoke`, especially the GPU-teardown section: three zone round trips
must return `renderer.info.memory` to where it started.
**Done when:** `ZoneWorld.ts` is under ~500 lines and no existing `tests/world/` file changed.
**Landed:** 77/77 smoke, unchanged; every existing `tests/world/` suite passes untouched, and so
does `progression.test.ts`. `ZoneWorld.ts` is **720 lines, not the ~500 this asked for**, and 58
new cases across seven collaborator suites say why the split is real anyway. Five things a later
session should know:

- **The collaborators share a `WorldContext`, and that is the whole of what they can reach.** It
  holds the clock, the character, the player, both channels out of the simulation, and the
  publishers more than one of them needs (`notice`, `float`, `publishInventory`,
  `publishCurrency`, `awardSkillXp`, `persistCharacter`). Everything else each one needs is a
  named hook on a `Deps` interface declared in its own file — which is what the new tests hand
  it, and why they can assert things like "with the shop shut, nothing happens at all" without a
  zone existing.
- **Two collaborators are not in the sketch above and both earned their place.**
  `ApproachDriver` is the click-to-move state the plan never listed (`pendingApproach`,
  `pursuingTarget`, and 42 lines of `updateApproach`), and the two walks in it turn out to be
  different rules: a node, a shopkeeper and a signpost stand still, so the destination is captured
  once and something happens on arrival; a mob does not, so a pursuit re-aims every frame and
  carries no action. `zoneEntities.ts` is the pure read of a zone definition into the things that
  live in it, which took ~50 lines out of the constructor and owns `WorldNpc`/`WorldSignpost` now
  (both still re-exported from `ZoneWorld`).
- **The 220 lines over the estimate are the composition root and the delegating surface, and both
  are load-bearing.** ~95 lines are one-line `handle*` methods and getters (`shopNpc`,
  `campfire`, `gatherState`, `afkActive`, `lastAbilityAt`) that keep `world.*` exactly what the
  view, `scripts/smoke.mjs` and seven existing suites already call — deleting them is a change to
  the regression proof, which is the one thing this PR could not touch. The rest is the
  constructor that wires seven collaborators, the tick's order, targeting, and the three routines
  that stop everything at once (`leaveZone`, `handlePlayerDeath`, `destroy`) — none of which
  belongs to any single collaborator by construction.
- **`Targeting` (`world/targeting.ts`) is what three of them see of the selection.** Selection
  itself stays with `ZoneWorld`, because the walk that closes on a target is the same
  click-to-move machinery a tap on the ground uses. `ZoneWorld implements Targeting`, so the
  interface is checked rather than described.
- **`tests/world/context.ts` is the new fixture** — one collaborator with no zone around it, as
  against `harness.ts`'s whole simulation driven in game time. Reach for the harness for anything
  that needs mobs to wander or a channel to advance; reach for this for a rule that turns over at
  an exact value.

## PR 10 — The deferred behaviour changes · `cleanup/10-deferred` · M

Last, and **each one alone in its own commit** — these are the only changes in the stack where a
smoke failure means the game changed rather than the code moved.

- [ ] **The integrator clamp.** `world/Player.ts:317-321` says it outright: velocity is integrated
      over the frame delta with no clamp to the distance remaining, and "owning the integrator
      makes that clamp correct — the note it contradicts in `MovementSystem` was about Phaser's
      timestep — but changing the integrator and the movement math in one step makes a smoke
      failure un-bisectable." Do it, and update `stepToward`'s now-false comment about velocities
      above normal speed. Cover the arithmetic in `tests/systems/MovementSystem.test.ts` first.
- [ ] **The two approach multipliers.** "Stop a little inside attack range" is one rule with two
      numbers: `ZoneWorld.ts:625` uses `attackRange * 0.8` for the player closing on a mob and
      `Mob.ts:215` uses `* 0.7` for a mob closing on the player, with comments that say the same
      thing. One named constant, or a data field if the asymmetry is deliberate — decide, then
      encode the decision.
- [ ] **Data-drive `buildCreature`.** `render3d/creatures.ts:24` is a `switch (definition.id)` over
      `EnemyId`. It is exhaustive, so the compiler does catch a new enemy — but a new `ENEMIES` row
      cannot ship without new view code, against CLAUDE.md's "a new enemy type should be an
      `ENEMIES` row plus a loot table". A `shape: 'quadruped' | 'crustacean' | 'humanoid'` field
      lets a new enemy reuse a body while leaving colour in `render3d/palette.ts`.

**Verify:** gates + a **separate `npm run smoke` per commit**, including the CPU-throttled section
at `rate: 8` cranked at 140ms. For the integrator clamp, ask for the frame rather than throttling
a machine into producing it: `view.step(140, 50)` is fifty frames at ~7fps, deterministically.
**Done when:** all three land green, or the ones that don't are reverted and written up.

---

## Standing verification

Every PR: `npm run lint && npm run typecheck && npm run test && npm run build`, plus
`npm run format:check` once PR 1 lands. Never commit on a red suite, including failures that
pre-date the change.

`npm run smoke` blocks merges, so run it locally rather than finding out from CI. It needs
`npm run dev` in another shell, and the first request cold-compiles ~520 kB of Three.js, so give
the first wait a generous timeout. Required for PRs 1, 3, 5, 6, 7, 8, 9, 10; PRs 2 and 4 don't
need it.

## Out of scope

Named so they don't get picked up by accident: `hud/styles.ts`'s size (one stylesheet is the right
shape), the `scale` threading through `ui/layout.ts` (~12 sites kept as a deliberate hook for a
future text-size setting — `fontPx` goes in PR 3 because it is dead, the hook stays), the
TypeScript 7 upgrade (still blocked upstream), and `docs/archive/3d_port_plan.md`'s contents, which stay
verbatim as the record of why the renderer looks like this.

Housekeeping, not a PR: `.smoke/` holds 62 gitignored PNGs where the script writes 20, including
Phaser-era shots (`probe-landscape-2d.png`) and two competing numbering schemes. Delete the
directory whenever; the next run rebuilds it.
