# Act three handoff: phases 10-12

**Written 2026-09-25**, at the merge of PR #123, which carried phases 0-9 of
[`act_three_plan.md`](act_three_plan.md). This is for a fresh session picking up the rest. The plan
is still the spec; this file is what the plan does not say: where things stand, how to start, where
each remaining phase touches the code, and the questions a session will hit that nobody has
answered yet. Delete it, or move it to `docs/archive/` with the plan, when phase 12 lands.

## Where things stand

- **`main` has phases 0-9**: the cleanup (a 17 KB `CLAUDE.md` with the reasoning moved into
  `docs/architecture/`, one counter shell for six roles, one set of dice per zone), the graphics
  (the world carried past its edge, each zone's air, rock standing up, readable names, a fight with
  motion in it, wind-ups drawn on the ground, moving water and ground scatter), and sound. Plus one
  bug fix found on the way: Escape closing a panel no longer drops the target.
- **Suite**: 1995 unit tests, 164 smoke checks, all green on CI.
- **Draw budget**: the throttled pass read **26.49ms** on CI with phase 9 in, against a 40ms
  ceiling. That reading is the one to compare against; a dev container reads about 10ms high and
  cannot measure a phase's cost at all (decision 50). Phases 10-12 add little to draw — a sack
  prop, a bow — so the budget is not what constrains them.
- **Nothing is open**: no PRs, no issues. `cleanup/09-zoneworld-split` is a stale branch from
  before a history rewrite, left alone on purpose because it may be the only copy of that history.
- **Not in the plan and still unfixed**: below about 10fps a body stalls up to 32px short of a
  tree or vein and never gathers (`docs/architecture/simulation.md`). TypeScript 7 is
  still blocked on typescript-eslint (`docs/upgrade_plan.md`).

## Starting cold

1. `CLAUDE.md` loads by itself. Then read the plan's phases 10-12 and its "What this plan does not
   do", then the `docs/architecture/` file for every subsystem the phase touches (the table in
   `CLAUDE.md` says which), then `docs/decisions.md` 54-61.
2. `git log --oneline -15` — the only record that cannot be out of date.
3. Branch before the first commit. **One PR per phase from here**: PR #123 carried ten phases and
   grew past 100 files, which is more than anyone can review.
4. Gates before opening a PR: `npm run lint`, `format:check`, `typecheck`, `test`, `build`, and
   `npm run smoke` with `npm run dev` running. Smoke blocks merges. If the throttled budget fails on
   your container, run smoke on the unchanged tree in the same session before believing it.
5. Each phase: update the plan's status line, append to `docs/decisions.md` for anything that
   closed off an alternative, and correct the architecture file for what moved. Part of the phase,
   not paperwork after it.

## Phase 10 — loot that is not lost

**Where it starts.** `CombatDirector.grantLoot` (`src/world/CombatDirector.ts`) is the one place a
drop is refused: `tryAddItem` fails, a line is logged, and the item is gone. That branch is where a
pile gets filled. Coin is never refused and never goes in one.

**Shape it after the campfire.** `world/Campfire.ts` is the existing thing that belongs to a zone
rather than to the character, times out on the world's clock, and is dropped by a zone change —
exactly what a pile is. No engine timers: the lifetime is an accumulator against the frame delta.

**The pieces**, each a place the codebase already has a pattern for:

- `WorldTap` (in `ZoneWorld.ts`) gains a `pile` kind, and `pickTap` (`render3d/picking.ts`) tries it
  **above the ground and below everything else** — the list is a priority, and anything above mobs
  would eat taps aimed at creatures behind it (`docs/architecture/rendering.md`, picking).
- Taking from it is `tryAddItem` item by item, **taking what fits and leaving the rest** — the same
  call `CharacterController.withdraw` makes with `carryableCount`, because the rest is still the
  player's.
- A line in the context menu (`ContextMenuSession`, `InspectSystem`) saying what is in it.
- An actor drawing a small sack, disposed through `disposeTree`; smoke's GPU-memory round trip has
  to stay flat, and `drawnCounts` may need a kind for it.
- If it should make a sound when it drops, the world pushes a `WorldEvent` for it (decision 61).

**Questions nobody has answered — settle them, and record the answer:**

- **The awake camp.** The plan keeps the _offline_ camp counting refusals into `missed`. It does not
  say what the camp does while the tab is open. Piles under a camp nobody is watching would
  accumulate; `missed` is the camp's existing answer. Probably: an attended player gets a pile, a
  camp does not, the same line `GatherSession` draws with `isCamping()`.
- **How long a pile lasts** ("a few minutes of game time"), and whether a second kill's refusals add
  to a pile already on the ground nearby or make another.
- **Does a pile survive a death?** It is the zone's, so probably yes until it times out — which
  makes a death beside your own loot a reason to walk back.

**Tests**: `tests/world/` with the harness — fill the pack, kill something, a pile holds exactly
what was refused, a tap takes what fits and leaves the rest, it times out, a zone change drops it.
`tests/render3d/picking.test.ts` for its priority. A smoke check that one is drawn and taken down.

## Phase 11 — the upper band gets directed content

**A prerequisite the plan assumed was done.** The plan says the quest section moves out of the shop
panel and into the counter shell "in phase 1's wake". It did not move: quests are still drawn only
in `ShopModal`, wired from `OverlayHost`'s merchant panel. `QuestDesk` already checks that a quest is
taken from its own giver (`giverNpcId`), so the world side is ready; the HUD side is the first
piece of work — any counter whose person gives quests shows them.

**Abilities by rank.** `AbilityDefinition` and its `training` terms are in `data/abilities.ts`,
`knownAbilities` in `systems/AbilitySystem.ts`. The bar stays four buttons, so a rank replaces the
rank below it on the bar and in the trainer's list. If a rank is a new `AbilityId` naming the one it
replaces (`rankOf`), `learnedAbilities` stores it like any other purchase and **no save migration is
needed**. Check that before assuming otherwise.

**Quests above level 3**, given at Greyford by the outfitter and the fettler: a short chain
through the mill road, the fen, the Deep Cut and the barrow, each ending on the named thing in the
zone it sends you to. `data/quests.ts`; objectives are a tagged union of `collect`, `kill` and
`visit` (`docs/architecture/content.md`).

**Contracts for the upper band** in `data/bounties.ts`, held to the three rules in
`tests/systems/BountySystem.test.ts`: under what the kills already pay, over what vendoring the haul
pays, under what the shop charges for the same thing.

**Pacing**: extend `tests/systems/progression.test.ts` past the starter arc, so the upper band is
simulated rather than eyeballed. The duels in `EnemySystem.test.ts` model auto-attacks only, so a
new rank moves what a player who paid can do, not the tuning baseline.

## Phase 12 — willow, fletching and the bow

**Willow** is a `RESOURCE_NODES` row on the mill road's millpond, above hardwood. `deadEnds.test.ts`
fails a node whose yield no recipe consumes, so it cannot land before fletching gives it a use —
land them together.

**Fletching** is the fourth making skill, and the tannery is the template for it (it arrived third
and widened nothing): a `SkillId`, a `StationId` with its `STATION_LABELS`, `STATION_SKILLS` and
`recipesAt` entries, a bench in Greyford's yard (`stationSpawns`), and `RECIPES` rows. Keep rows
one-of-one where they can be, because that shape is what `findCraftableFrom` looks for, and it is
what makes the bench a place a camp can work (`docs/architecture/making.md`).

**The bow** is a two-handed ranged weapon for the warrior, trained by a new `archery` combat skill.
Two things here are new to the codebase:

- **Nothing is two-handed yet.** Equipping one has to empty or refuse the offhand, and an offhand
  equipped over a bow has to be refused or unequip it — a rule in `CharacterController`, which
  refuses as a whole rather than half-applying.
- **Two new skills mean a save migration.** Saves are at `CHARACTER_STATE_VERSION` 22; every past
  skill addition bumped it and spread `createInitialSkills()` _under_ the saved skills, so existing
  progress survives and only the new ones start fresh (`persistence/migrations.ts` shows three).

`weaponAttackRange` already gives ranged reach from the weapon rather than the class. Mobs do not
path (decision 26), so kiting melee creatures is trivially safe at range; the plan asks the duels to
be extended so the bow is **a different fight rather than a better one**, which is where that gets
priced. The plan does not mention ammunition; adding arrows would be a fork worth putting to the
user rather than deciding alone.

## Things learned this session that are already written down

In case a fresh session meets them before it reads the file that explains them:

- A dev container cannot measure the draw budget; CI can (decision 50).
- Escape is shared by the HUD and the world, and the HUD cancels a key it takes
  (`docs/architecture/hud.md`).
- A sound cannot poll state; a moment worth hearing is a `WorldEvent` (decision 61).
- `localStorage` holds the sound setting beside the save, so "is anything stored" no longer means
  "is there a save" — smoke checks the save's own key.
- A new zone or exit costs a spawn or a building moved somewhere else, and the sweeps say where.
