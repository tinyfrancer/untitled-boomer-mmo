# Untitled Boomer MMO

A small, old-school-flavored MMORPG (EverQuest/RuneScape/WoW-inspired), built as a
learning side project. This is v0: a single-player starting town with rats to kill,
character creation, leveling, gear, and local save/load. See
[`docs/initial_design.txt`](docs/initial_design.txt) for the full long-term vision.

## Stack

TypeScript + [Three.js](https://threejs.org/), bundled with [Vite](https://vite.dev/). The
game was originally 2D on [Phaser 4](https://phaser.io/); `docs/3d_port_plan.md` is the record of
moving it. No backend yet — character data is saved to the browser's `localStorage` behind a
`SaveService` interface, so a networked backend can be swapped in later without touching game
logic.

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

| Command             | What it does                                           |
| ------------------- | ------------------------------------------------------ |
| `npm run build`     | Type-checks and produces a production build in `dist/` |
| `npm run preview`   | Serves the production build locally                    |
| `npm run test`      | Runs the Vitest unit test suite                        |
| `npm run typecheck` | Type-checks without emitting (`tsc --noEmit`)          |
| `npm run lint`      | Runs ESLint                                            |
| `npm run format`    | Formats the codebase with Prettier                     |

## How to play

- **WASD** to move (or drag the on-screen joystick, bottom-right, on touch devices).
- **Click a rat** to target it and start auto-attacking — stay in range and it fights
  on its own, EverQuest/WoW-style, no need to keep clicking.
- **Esc** or click empty ground to clear your target.
- **F9** resets your character (dev/testing convenience — clears the save).

Progress (level, XP, class, gear) autosaves to your browser and persists across reloads.

## Project layout

```
src/
  world/        The simulation — ZoneWorld, Player, Mob, the session
  render3d/     The Three.js renderer — the only code that knows there is an engine
  systems/      Combat/leveling/movement logic — plain TypeScript, unit-tested
  data/         Class stats, items, enemies, zones, xp table, tilemap layouts
  persistence/  CharacterState shape + SaveService (localStorage-backed for now)
  hud/          The HTML overlay: tab bar, sheets, panels
  ui/           Layout, theme and event vocabulary the HUD is built from
tests/          Vitest specs mirroring world/, systems/ and persistence/
```

Everything but `render3d/` is engine-free, which is what makes it unit-testable, is the
same seam that will let a real backend swap in later, and is what let a whole renderer
be replaced without rewriting the game.
