# Untitled Boomer MMO

A small, old-school-flavored MMORPG (EverQuest/RuneScape/WoW-inspired), built as a
learning side project. This is v1: single-player, three zones — a town with leveled rats
and a shop, a beach with crabs and ocean fishing, and a bandit camp — plus character
creation, leveling, gear, two-way combat, gathering and cooking, currency and a
weight-limited pack, collection quests, slayer achievements, an AFK camping mode that
pays out offline, and local save/load. See
[`docs/initial_design.txt`](docs/initial_design.txt) for the full long-term vision, most
of which is deliberately not built yet.

## Stack

TypeScript + [Three.js](https://threejs.org/), bundled with [Vite](https://vite.dev/). The
game was originally 2D on [Phaser](https://phaser.io/); `docs/archive/3d_port_plan.md` is the
record of moving it. No backend — character data is saved to the browser's `localStorage`
behind a `SaveService` interface, so a networked backend can be swapped in later without
touching game logic.

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

- **Tap or click the ground** to walk there. **WASD** also moves — W is up the screen, not
  north, so it follows the camera.
- **Drag** to swing the camera around your character.
- **Tap a creature** to target it and start auto-attacking — stay in range and it fights on
  its own, EverQuest/WoW-style, no need to keep tapping. **Esc**, or a tap on empty ground,
  clears your target.
- **Tap a resource node** to gather from it, a **signpost** to travel to the next zone, and
  the **shopkeeper** to buy, sell and pick up quests.
- **The tab bar** along the bottom opens Char, Bag, Quests, Feats and Log, sets up Camp, and
  the **⚙** button opens the options menu. Each has a keyboard shortcut (`c`, `i`, `q`, `v`,
  `l`, `z`), and `1`/`2` fire the action bar.
- **To start over**, open **⚙ → Reset Character** and confirm. (`F9` does the same thing on a
  keyboard; the menu exists because a phone has no way to press it.)

Progress (level, XP, class, gear, quests, kills, where you were standing) autosaves to your
browser and persists across reloads.

## Project layout

```
src/
  world/        The simulation — ZoneWorld, Player, Mob, the session
  render3d/     The Three.js renderer — the only code that knows there is an engine
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

Everything but `render3d/` is engine-free, which is what makes it unit-testable, is the
same seam that will let a real backend swap in later, and is what let a whole renderer
be replaced without rewriting the game.
