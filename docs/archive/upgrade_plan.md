# Upgrade plan: dependencies

**Status:** PR 1 and PR 2 implemented 2026-07-28. PR 3 remains blocked upstream. Written against
`74f4b86`.

> **What the plan got wrong, corrected below.** PR 2 predicted the masks were a place the new
> renderer "gets subtly wrong". That was understated: geometry masks are **Canvas-only** in Phaser
> 4, so under WebGL the clip did not degrade, it stopped entirely and the bag drew over the world.
> The section is corrected in place. Everything else measured out as written — 0 type errors, and
> the bump needed no code migration beyond that one fix.

Five packages are behind. They are not one job — they are three, with wildly different risk, and
they should land as three PRs in this order. Every claim in this doc was verified by running the
real thing against this codebase, not read off a changelog; the evidence is recorded inline so a
later session can tell what was measured from what was assumed.

| Package    | Current | Target | Verdict                          |
| ---------- | ------- | ------ | -------------------------------- |
| eslint     | 10.7.0  | 10.8.0 | Take now — PR 1                  |
| prettier   | 3.9.5   | 3.9.6  | Take now — PR 1                  |
| playwright | 1.61.1  | 1.62.0 | Take now — PR 1                  |
| phaser     | 3.90.0  | 4.2.1  | Take deliberately — PR 2         |
| typescript | 6.0.3   | 7.0.2  | **Blocked.** Do not attempt yet. |

---

## PR 1 — the three minor bumps

**Risk: low.** Patch/minor bumps within a major. No API surface here is ours.

```bash
npm i -D eslint@10.8.0 prettier@3.9.6 playwright@1.62.0
```

**Prettier causes zero reformatting.** This was the one bump with a plausible diff, so it was
measured: `prettier@3.9.6 --check .` and `prettier@3.9.5 --check .` flag the _same single file_,
`docs/refactor_systems_seam.md`. That file is already unformatted on `main` — it landed in PR #31
without a format pass — so it is a pre-existing miss, not churn the upgrade introduced. Run
`npm run format` in this PR and take the fix as a freebie, in its own commit so the one-line
dependency change stays readable.

**Playwright is the only one that touches CI.** `npm run smoke` is a required check and 1.62.0
may want a matching browser build. Run `npm run smoke` locally before opening the PR — the usual
rule, but here it is the entire point of the bump.

**Verification:** `npm run lint && npm run typecheck && npm run test && npm run smoke`.

---

## PR 2 — Phaser 3.90 → 4.2.1

**Risk: moderate, and entirely in the renderer.** Not the API.

### What was measured

A throwaway copy of `src/` and `tests/` was typechecked against a real `phaser@4.2.1` install:

> **0 type errors.**

That is the headline. It is a genuine result, not an absence of evidence — and the reason is that
this codebase never touches anything v4 removed. Grepped and confirmed absent:

- `Geom.Point` — removed in v4 (→ `Vector2`). **Not used here.**
- `Phaser.Struct.Set` / `Struct.Map` — replaced by native `Set`/`Map`. **Not used here.**
- `setTintFill` / `tintFill` — removed (→ `setTintMode`). **No tint usage at all.**
- `Math.TAU` (meaning flipped: now PI×2, was PI/2) and `Math.PI2` (removed). **Not used here.**
- `RenderTexture` / `DynamicTexture` — now require an explicit `render()` call. **Not used here.**
- Custom WebGL pipelines / shaders — the v3 Pipeline system is gone entirely, replaced by
  RenderNodes. **No pipelines, no shaders, no pre/postFX.**

And the one that would have been fatal, since every texture in this game is procedural:
`Graphics#generateTexture(key, width?, height?)` **survives v4 with an identical signature**
(`types/phaser.d.ts:29837`). Note the separate `Create.GenerateTexture` static utility _was_
removed — different thing, not what `scenes/generateTextures.ts` calls.

Everything else the codebase uses — `Scene`, `Math.Distance.Between`, `Math.Clamp`,
`Geom.Rectangle`, Arcade physics (`Sprite`/`Body`/`StaticBody`), the Scale manager and
`Scale.Events.RESIZE`, `Input.Pointer`, `Input.Events.POINTER_*`, `Input.Keyboard.KeyCodes`,
`Tweens`, `Time.TimerEvent`, `GameObjects.Container`/`Text`/`Rectangle`/`Graphics`/`Image`/`Sprite`
— is present in the v4 types.

### So where is the actual risk

A clean typecheck proves the _calls_ resolve. It proves nothing about what gets drawn. v4 replaced
the entire renderer, so the failure mode here is visual, and the suite cannot see it. Three
specific things to look at:

1. **`roundPixels` now defaults to `false`** (was `true`). `main.ts` does not set it, so this
   upgrade silently flips it. On a game built out of procedurally generated placeholder shapes,
   the plausible symptom is sub-pixel blurring on sprites and text. If anything looks soft, set
   `render: { roundPixels: true }` in the game config and note _why_ in a comment.
2. **The two geometry masks — this one fired.** `ui/InventoryPanel.ts:154` and
   `ui/AchievementPanel.ts:71` both called `createGeometryMask()` to clip a scrolling viewport.
   The migration guide's line on this is easy to under-read: "`GeometryMask` remains available in
   **Canvas only**." Under WebGL — which is what `Phaser.AUTO` picks — the call still typechecks,
   still runs, and silently clips nothing. The bag's overflowing rows drew straight down over the
   game world. Nothing caught it: typecheck passed, all 105 smoke checks passed, and the existing
   "rows scrolled out of the viewport stop taking input" check passed too, because input hit-areas
   are computed separately from the clip.

   The fix is `ui/clipToMask.ts`, which picks per renderer: `enableFilters()` then
   `filters.internal.addMask()` on WebGL, falling back to the geometry mask on Canvas, where it
   still works. Note `filters` is `null` until `enableFilters()` is called, so an optional-chained
   `filters?.internal.addMask(...)` no-ops silently — the same failure shape a second time.
   `autoUpdate` must be set or the clip freezes at the first frame's rect.

   Smoke grew a check that asserts the clip is installed for whichever renderer is live. It was
   confirmed to fail against the broken implementation before being kept.

3. **GL orientation is now Y-up (Y=0 at the bottom).** This bites compressed textures and custom
   shaders, neither of which exist here — listed only so a later reader does not re-derive it.

### Cost

The minified ESM bundle grows **1,197,130 → 1,377,611 bytes (~15%)**. Worth knowing because
`CLAUDE.md` already warns that the first `npm run dev` cold-compiles all of Phaser and needs
generous browser timeouts. That gets modestly worse; if the smoke check starts flaking on a cold
cache, this is why, and the fix is the timeout, not the test.

### Shape of the work

Almost just the dependency bump. Two things came with it:

```bash
npm i phaser@4.2.1
```

- **The mask fix above** (`ui/clipToMask.ts`), which is the only source change the renderer forced.
- **`scripts/smoke.mjs` reached for a `Phaser` global.** Phaser 3 left one on `window` that the
  `page.evaluate` bodies used for `Phaser.Math.Distance.Between`; Phaser 4 does not, so those threw
  `ReferenceError` in the browser and the run died on its second check. They are now `Math.hypot`,
  which is what they were computing and cares about no version at all. Worth knowing that this is
  the first thing that breaks, before any of the interesting failures are reachable.

`roundPixels` was checked and needed nothing — before/after screenshots show text and sprite edges
equally crisp, so no config line was added.

**Verification, in this order:**

- `npm run typecheck` — expected clean, per the measurement above. If it is not, something in this
  doc is stale; re-read before pushing on.
- `npm run test` — 444 tests, none of which import Phaser. Green here proves the upgrade did not
  disturb game logic, and nothing more.
- `npm run smoke` — **this is the real gate.** It drives the live renderer.
- **Then look at it by eye**, which no script covers: `npm run dev`, and check text legibility,
  sprite edges, both scrolling sheets, and the tab bar hit areas at 375px. The `.smoke/`
  screenshots from before and after the bump are the cheapest before/after comparison available.

Keep it a single-purpose PR. If the renderer does need a `roundPixels` line, that is a second
commit in the same PR, not a follow-up.

---

## PR 3 — TypeScript 6.0.3 → 7.0.2 — **blocked, do not start**

TypeScript 7.0 (the Go-native compiler, stable since 2026-07-08) is genuinely attractive here, and
this codebase is already ready for it. Both halves of that were measured:

- **The code typechecks clean under 7.0.2 — 0 errors**, using the existing `tsconfig.json`
  unmodified. The config dodges every option 7.0 dropped: it is already `moduleResolution:
"bundler"`, already `target: es2023`, already sets `types` explicitly, and sets no `baseUrl`.
- **`tsc` goes from 1.97s to 0.22s on this repo — ~9x**, consistent with the 8–12x Microsoft
  claims.

**And it is still blocked, by lint.** `typescript-eslint@8.65.0` declares
`typescript: ">=4.8.4 <6.1.0"` and ships an explicit runtime guard. Installed against 7.0.2,
`npm run lint` does not degrade — it dies:

```
Error: typescript-eslint does not support TS 7.0.
```

`npm run lint` is a required CI check, so this trades a fast typecheck for a red build. Note that
`npm install typescript@7` _succeeds_ — npm resolves it fine. The failure is at lint time, so this
would look like a working upgrade right up until CI rejects it.

**The trigger to revisit:** typescript-eslint tracks TS >= 7.1 support in
[typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940).
Microsoft's own guidance is that 7.1 is when API consumers settle. Re-check that issue; when it
closes, this becomes a one-line bump plus the verification below, because the hard part is already
proven done.

**The side-by-side workaround exists, and is not worth it here.** Microsoft publishes
`@typescript/typescript6`, which provides a `tsc6` binary and re-exports the TS 6 API so
typescript-eslint can keep working while `tsc` is 7.x. That means carrying two compilers, an
aliased dependency, and a lint toolchain pinned to a different TypeScript than the build uses —
real ongoing complexity, bought with 1.7 seconds per typecheck on an 85-file project. Revisit only
if `tsc` becomes a genuine irritant, which at 1.97s it is not.

**When it unblocks, verify:** `npm run lint` first (it is the thing that was broken), then
`typecheck`, `test`, `build`, `smoke`. Watch `build` specifically — it is `tsc && vite build`, so
it runs the new compiler in emit-adjacent mode rather than the `--noEmit` path that was measured
here.

---

## Suggested order

1. **PR 1 (minors)** — independent, and gets Playwright current before PR 2 leans on the smoke
   check to validate a renderer swap.
2. **PR 2 (Phaser 4)** — the one that needs eyes on it. Do it on its own, with a clear head.
3. **PR 3 (TypeScript 7)** — not now. Re-check the tracking issue periodically.

Branch off `main` for each and open a PR — no direct commits, per the workflow note in
`CLAUDE.md`. Do not bundle these; a renderer swap and a lint-tool bump have no business sharing a
bisect.

## Re-verifying this doc

The measurements above came from throwaway installs. To redo any of them, install the target
version into a scratch directory, hardlink-copy the repo's `node_modules` (`cp -al`), swap the one
package directory, and run the relevant script. `cp -al` matters — it makes the copy cheap, but
only replace whole package _directories_ (`rm -rf` then copy) rather than editing files inside
one, or the edit lands in the real `node_modules` through the hardlink.
