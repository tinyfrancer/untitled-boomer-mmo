# Untitled Boomer MMO

A small, old-school-flavored MMORPG (EverQuest/RuneScape/WoW-inspired), built as a
learning side project. This is v1: single-player, ten zones from a starter town to a
level 8 barrow, two classes, three gathering skills (woodcutting, fishing, mining) and
three making ones (cooking, smithing, leatherworking), gear and reforging, two-way combat
with telegraphed enemy abilities, a bank, a trainer, a quest chain and a board of
repeatable contracts, slayer achievements and titles, per-target mastery, an AFK camping
mode that pays out offline, and local save/load. See
[`docs/initial_design.txt`](docs/initial_design.txt) for the full long-term vision, most
of which is deliberately not built yet, and [`CLAUDE.md`](CLAUDE.md) for how the code is
shaped and why.

## Stack

TypeScript, bundled with [Vite](https://vite.dev/), with no runtime dependency at all. The world
is pixel art drawn as data (`src/art/`) and drawn with the browser's own Canvas 2D
(`src/render2d/`); sound is synthesised with Web Audio. The game was first 2D on
[Phaser](https://phaser.io/), then 3D on [Three.js](https://threejs.org/)
(`docs/archive/3d_port_plan.md`), and version 2 took it back to 2D (`docs/v2_plan.md`). No
backend — character data is saved to the browser's `localStorage` behind a `SaveService`
interface.

## Setup

```bash
npm install
```

## Running

```bash
npm run dev
```

Opens a dev server (default `http://localhost:5173`) with hot reload. Use `npm run dev -- --host`
to expose it on your local network for testing on a phone.

## Other scripts

| Command                | What it does                                                   |
| ---------------------- | -------------------------------------------------------------- |
| `npm run build`        | Produces a production build in `dist/` — no type-check         |
| `npm run preview`      | Serves the production build locally                            |
| `npm run test`         | Runs the Vitest unit test suite                                |
| `npm run coverage`     | The same suite with a coverage report                          |
| `npm run typecheck`    | Type-checks without emitting (`src/`+`tests/`, and `scripts/`) |
| `npm run lint`         | Runs ESLint                                                    |
| `npm run format`       | Formats the codebase with Prettier                             |
| `npm run format:check` | Checks formatting without writing — what CI runs               |
| `npm run smoke`        | Browser smoke check (needs `npm run dev` in another shell)     |

## How to play

The game is laid out for a portrait phone, and everything works with a mouse too.

- **Tap or click the ground** to walk there — the walk routes round walls and buildings.
  **WASD** also moves; W is up the screen, which is north.
- **Tap a creature** to target it and start auto-attacking — stay in range and it fights on
  its own, EverQuest/WoW-style. **Esc**, or a tap on empty ground, clears your target.
- **Tap a tree, fishing spot or ore vein** to gather from it, a **signpost** to walk to the
  next zone, a **forge** or **tannery** to make things, and a **person** (or the shopfront
  they work behind) to open their counter: the shop, the bank, the trainer, the
  quartermaster's board, and at Greyford the outfitter and the fettler.
- **Press and hold** (or right-click) anything to ask what it is and what it drops.
- **The tab bar** along the bottom opens Char, Bag and Quests, toggles Camp, and **Menu**
  opens the Map, Feats, Mastery, the Combat Log and Options. Keyboard shortcuts: `c`, `i`,
  `q`, `z`, `m`, `v`, `y`, `l`, and `1`–`4` fire the action bar.
- **To start over**, open **Menu → Options → Reset Character** and confirm. (`F9` does the
  same thing on a keyboard.)

Progress (level, XP, skills, gear, the bank, quests, kills, where you were standing)
autosaves to your browser and persists across reloads.

## Project layout

```
src/
  world/        The simulation — ZoneWorld, Player, Mob, the session
  render2d/     The Canvas 2D view — the only code that draws the world
  art/          Sprites as data, the palette and the compiler, importing nothing
  host/         The frame loop, the pointer, the keyboard and the sound around a zone
  audio/        Every sound, synthesised from a recipe
  systems/      Combat/leveling/movement logic — plain TypeScript, unit-tested
  data/         Class stats, items, enemies, zones, xp table, tilemap layouts
  persistence/  CharacterState shape + SaveService (localStorage-backed for now)
  hud/          The HTML overlay: tab bar, sheets, panels, modals
  ui/           Layout, theme and event vocabulary the HUD is built from
  types/        The id unions the data tables are keyed on, and the debug-view interface
  config/       Tunable constants
tests/          Vitest specs mirroring world/, systems/, persistence/ and the rest
scripts/        The Playwright smoke check
```

Nothing but `main.ts` imports `render2d/`, and nothing in `src/` imports a package, which is
what makes the rest unit-testable and what let the renderer be replaced twice without rewriting
the game.
