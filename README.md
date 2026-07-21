# Untitled Boomer MMO

A small, old-school-flavored MMORPG (EverQuest/RuneScape/WoW-inspired), built as a
learning side project. This is v0: a single-player starting town with rats to kill,
character creation, leveling, gear, and local save/load. See [`docs/design.txt`](docs/design.txt)
for the full long-term vision.

## Stack

TypeScript + [Phaser 3](https://phaser.io/) (2D game framework), bundled with
[Vite](https://vite.dev/). No backend yet — character data is saved to the browser's
`localStorage` behind a `SaveService` interface, so a networked backend can be swapped
in later without touching game logic.

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
  scenes/       Phaser scenes (Boot, Preload, CharacterCreate, Town, UI)
  entities/     Player, Mob/Rat — Phaser game objects
  systems/      Combat/leveling logic — plain TypeScript, no Phaser imports, unit-tested
  data/         Class stats, items, xp table, town tilemap layout
  persistence/  CharacterState shape + SaveService (localStorage-backed for now)
  ui/           HUD components (target frame, virtual joystick)
tests/          Vitest specs mirroring systems/ and persistence/
```

`systems/`, `data/`, and `persistence/` are deliberately Phaser-free, which is what
makes them unit-testable and is the same seam that will let a real backend swap in
later.
