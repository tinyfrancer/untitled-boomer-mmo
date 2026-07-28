# Refactor plan: tighten the systems seam

**Status:** planned, not started. Written 2026-07-24 for a later session.

## Why

The long-term direction for this project is systems-first: deep, headlessly-testable game
systems now, placeholder visuals, so a richer visual layer (possibly a 3D renderer) could swap
in later without rewriting the game. The Phaser-free/Phaser-coupled split in `ARCHITECTURE`
already carries most of that weight — roughly 3,750 of ~9,900 `src/` lines are engine-agnostic
and would survive a renderer swap intact.

This plan closes the gaps where genuine game rules still live in `ZoneScene`, where they are
neither unit-testable nor portable.

## Not in scope — these are already correct

Do **not** churn these while working the list below. They already delegate rules to
Phaser-free systems and are the pattern to copy, not fix:

- Ability use (`handleAbilityRequested` / `applyAbilityEffect`) — delegates to `canUseAbility`,
  `rollSpellFailure`, `resolveAbilityDamage`, `startManaShield`, `startHaste`.
- Combat resolution — `isInRange`, `isCooldownReady`, `resolveAttack`, `rollDefense`.
- AFK behavior — `decideAfkAction`, `shouldAfkEat`, `chooseAfkFood`.
- Loot — `rollLootTable`. Zone exits — `findExit`. Gathering gates — `canGather`.

The scene doing orchestration, rendering, floating text, logging and event emission around
those calls is the intended shape.

---

## 1. Extract the interaction-intent state machine (highest value)

**Problem.** `ZoneScene` carries four ad-hoc fields — `pendingGatherNode`, `pendingShopNpc`,
`pendingSignpost` (`ZoneScene.ts:159-161`) and `pursuingTarget` (`:162`) — driving ~80 lines of
near-duplicate logic in `updateApproach` (`ZoneScene.ts:650`). Every branch encodes the same
rule:

> the player tapped a thing → walk toward it → act once inside its radius → abandon the intent
> if the walk ended without arriving.

That is portable game design sitting in a renderer file. It has no tests, and a new renderer
would rewrite all of it from zero. The "walk ended short — blocked, or a stale destination"
case is exactly the kind of edge that wants a test rather than a phone.

**Shape.** New `src/systems/InteractionSystem.ts`, Phaser-free:

```ts
export type InteractionKind = 'gather' | 'shop' | 'signpost';

export interface PendingInteraction {
  kind: InteractionKind;
  point: Point; // reuse Point from MovementSystem
  radius: number;
}

export type ApproachResult =
  | { kind: 'act' } // inside radius — caller performs the interaction
  | { kind: 'walking' } // still en route
  | { kind: 'abandon' }; // walk ended without arriving

export function resolveApproach(
  pending: PendingInteraction,
  playerPos: Point,
  stillWalking: boolean,
): ApproachResult;
```

**Scene side.** Replace the three fields with one `pending: PendingInteraction | null` plus the
target object reference needed to act on arrival (a small `{ interaction, node }`-style holder is
fine — the _rule_ moves, the Phaser object reference stays in the scene). `updateApproach`
collapses to one call and a three-way switch.

Keep the existing radii as the values passed in: `SIGNPOST_INTERACT_RADIUS`,
`SHOP_INTERACT_RADIUS`, and `node.definition.interactRadius * 0.9` — the 0.9 is deliberate, so
carry it over rather than rounding it away.

**Tests** (`tests/systems/InteractionSystem.test.ts`): inside radius → `act`; outside and still
walking → `walking`; outside and walk ended → `abandon`; boundary exactly on the radius.

**Frame-rate note.** Check whether these arrival radii need the same treatment as
`arriveRadius` in `MovementSystem` — a fixed interact radius has the same slow-frame overshoot
failure mode that the movement code already documents. If they do, take the frame travel as a
parameter. Worth deciding explicitly rather than by omission.

---

## 2. De-duplicate kill resolution

**Problem.** The kill path is written twice, once in `updateCombat` (`ZoneScene.ts:1075`) and
once in `applyAbilityEffect` (`ZoneScene.ts:1325`). Both must capture `xpReward` and
`lootTableId` _before_ `takeDamage`, then log the kill, award XP and grant loot. Two copies of a
"read these fields before mutating" rule is a bug farm — the next reward type (quest credit, a
kill counter, a faction hit) gets added to one path and silently missed on the other.

**Fix.** One private `resolveKill(mob)` on the scene, called from both. This is a dedup, not a
systems extraction — the orchestration legitimately belongs to the scene. Keep it small.

If a rule emerges about _what_ a kill awards beyond the current three things, that part goes to
`systems/` instead.

---

## 3. Replace ad-hoc distance checks with a tested proximity helper

**Problem.** 15 `Phaser.Math.Distance.Between` calls in `ZoneScene` and 5 in `Mob`. None is real
Phaser coupling — each is `Math.hypot` in disguise — but each marks a place where a distance
_rule_ sits in a renderer file. Several are literally the same "is X within radius R" predicate:

- `updateShopRange` (`:386`) — close the shop past `SHOP_CLOSE_RADIUS`
- `isNearFire` (`:933`) — `FIRE_COOK_RADIUS`
- `updateAfk` (`:791`) — drop a target that wandered past `AFK_ANCHOR_RADIUS`
- `handleAbilityRequested` (`:1283`) — target distance for `canUseAbility`
- the three branches in `updateApproach` (subsumed by item 1)

**Fix.** Add `withinRadius(a: Point, b: Point, radius: number): boolean` and a plain
`distance(a, b)` to `MovementSystem.ts` (it already owns `Point`), and use them at these sites.
Treat the remaining raw calls as opportunistic cleanup — this item is not worth a mechanical
sweep of all 20.

`Mob`'s 5 calls can stay for now; chase/leash distances are read every frame inside a Phaser
sprite subclass, and moving them buys less than the scene-level ones.

---

## 4. Institutionalize the seam with a guard test

**Problem.** The Phaser-free rule for `systems/`, `data/`, `persistence/`, `types/` is documented
in `CLAUDE.md` and currently holds only by discipline. There is no test enforcing it — a stray
`import Phaser` would pass CI.

**Fix.** A test in the style of the existing `family`/loot-table rule (enforced over data by a
test rather than by construction): read every `.ts` file under those four directories and assert
none imports `phaser`. Roughly ten lines with `fs` + `glob`.

This is the cheapest item on the list and the one that keeps the other three from decaying.

---

## Suggested order

1. **Guard test** (item 4) — small, independent, protects everything after it.
2. **Kill dedup** (item 2) — small, self-contained, no new files.
3. **InteractionSystem** (item 1) — the real work.
4. **Proximity helper** (item 3) — partly falls out of item 1; do the leftovers last.

Items 1 and 2 both touch `ZoneScene` but in unrelated methods, so ordering between them is
flexible. Each is a separate commit — this repo merges with merge commits rather than squashing,
so keep the structure.

## Verification

- `npm run test` after each item; `tests/systems/progression.test.ts` is the one that will catch
  an accidental change to reward or pacing behavior in item 2.
- `npm run smoke` before the PR — it is a required check and item 1 changes live scene behavior
  (tap-to-gather, tap-to-shop, tap-a-signpost). Verify all three interactions still complete,
  and that a tap interrupted by a wall abandons cleanly.
- `npm run typecheck` / `npm run lint` — `noUnusedLocals` will flag the removed scene fields if
  any cleanup is missed.

## Workflow note

Branch off `main` (after the current `feat/quests-and-starter-arc` work has landed) and open a
PR — no direct commits to `main`, including for this doc.
