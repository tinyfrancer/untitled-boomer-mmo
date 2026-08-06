# Archived plans

Plans that have been worked to completion. They are kept verbatim as the record of _why_ things
are the way they are, and they are **not** a description of the present: they were written against
the codebase of their day, and several of them talk about the 2D Phaser renderer that PR 20 of
`3d_port_plan.md` deleted. Where one of these disagrees with the code, the code is right.

Anything in `docs/` outside this directory describes work that is live or still to do.

| Plan                       | What it was                             | Finished   |
| -------------------------- | --------------------------------------- | ---------- |
| `3d_port_plan.md`          | 2D Phaser → 3D Three.js, over 20 PRs    | 2026-08-05 |
| `upgrade_plan.md`          | The dependency upgrade stack            | 2026-07-28 |
| `refactor_systems_seam.md` | Tightening the engine-free systems seam | 2026-07-24 |

`3d_port_plan.md` is the one of these that is still referenced from `CLAUDE.md`, as the answer to
"why is the renderer shaped like this". Its contents stay verbatim.

`upgrade_plan.md`'s TypeScript 7 row is the one part of it that had not finished; it lives on as
`docs/upgrade_plan.md`, which is where to look before attempting that bump.
