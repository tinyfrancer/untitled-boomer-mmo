# Archived plans

Plans that have been worked to completion. They are kept verbatim as the record of _why_ things
are the way they are, and they are **not** a description of the present: they were written against
the codebase of their day, and several of them talk about the 2D Phaser renderer that PR 20 of
`3d_port_plan.md` deleted. Where one of these disagrees with the code, the code is right.

Anything in `docs/` outside this directory describes work that is live or still to do.

| Plan                          | What it was                             | Finished   |
| ----------------------------- | --------------------------------------- | ---------- |
| `interiors_and_light_plan.md` | Interiors, pathfinding and light, 8 PRs | 2026-09-03 |
| `ui_upgrade_plan.md`          | The HUD upgrade, over 5 PRs             | 2026-08-09 |
| `cleanup_plan.md`             | Post-port consolidation, over 11 PRs    | 2026-08-07 |
| `3d_port_plan.md`             | 2D Phaser → 3D Three.js, over 20 PRs    | 2026-08-05 |
| `upgrade_plan.md`             | The dependency upgrade stack            | 2026-07-28 |
| `refactor_systems_seam.md`    | Tightening the engine-free systems seam | 2026-07-24 |

`3d_port_plan.md` is the one of these that is still referenced from `CLAUDE.md`, as the answer to
"why is the renderer shaped like this". Its contents stay verbatim.

`cleanup_plan.md`'s **"Landed" notes are the part worth reading** — each PR's says what it actually
did as against what the checklist above it asked for, and several of them record a decision the
code cannot: why `ZoneWorld.ts` came in at 720 lines rather than the 500 the row estimated, why the
approach fraction is one number and not two, why creature colour is keyed by shape. Its
instructions are written in the present tense to a session picking up the next row, and there is no
next row; read them as the record of how the stack was worked.

`ui_upgrade_plan.md` is the newest of these and the one written against a codebase most like
today's, so it reads closest to a description of the present — but it is history like the rest. Its
per-PR sections are where the arithmetic behind the HUD is written down: why the bar holds five tabs
and not seven, why `map` joined `MENU_TABS` in PR 5 alongside its sheet rather than in PR 1 with the
rest of the menu, and why the map's two publishers speak from the tick rather than from
`ZoneWorld`'s constructor.

`upgrade_plan.md`'s TypeScript 7 row is the one part of it that had not finished; it lives on as
`docs/upgrade_plan.md`, which is where to look before attempting that bump.

`interiors_and_light_plan.md` is the newest, and the thing to read in it is the **"what it actually
turned out to be about"** note under each phase — every one of them names something the plan did not
see, and four of the eight reverse an instruction written above them. Two of those are worth knowing
before touching the renderer at all: the shadow camera is framed on the zone rather than on the
viewport (phase 1), and the pathfinder asks the collision world about the body rather than keeping a
rasterised grid of its own (phase 2). It is also the plan that produced `docs/decisions.md` 25-53,
which is where its arguments live in full.
