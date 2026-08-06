# Upgrade plan: TypeScript 7

**Status:** blocked upstream. Measured 2026-07-28 against `74f4b86`. Both pins are unchanged as of
2026-08-06 — `typescript@6.0.3`, `typescript-eslint@8.65.0` — so the block below still applies as
written; the tracking issue itself has not been re-read since. This is what is left of a
five-package upgrade plan. The other four landed that same day, and the plan they landed under is
`docs/archive/upgrade_plan.md`, which describes a renderer that no longer exists.

| Package    | Current | Target | Verdict                          |
| ---------- | ------- | ------ | -------------------------------- |
| typescript | 6.0.3   | 7.0.2  | **Blocked.** Do not attempt yet. |

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
`typecheck`, `test`, `build`, `smoke`. `typecheck` now covers two projects — `tsconfig.json` and
`tsconfig.scripts.json`, the second of which is `allowJs`+`checkJs` over `scripts/` — so watch
that both pass. The 2026-07-28 measurement predates the second project and predates the build
dropping its own `tsc` call, so re-measure rather than trusting the numbers above wholesale.

## Re-verifying this doc

The measurements above came from throwaway installs. To redo any of them, install the target
version into a scratch directory, hardlink-copy the repo's `node_modules` (`cp -al`), swap the one
package directory, and run the relevant script. `cp -al` matters — it makes the copy cheap, but
only replace whole package _directories_ (`rm -rf` then copy) rather than editing files inside
one, or the edit lands in the real `node_modules` through the hardlink.
