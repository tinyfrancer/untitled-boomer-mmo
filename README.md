# Untitled Boomer MMO

A small, old-school-flavored RPG in the spirit of EverQuest, RuneScape and WoW, played solo and
built as a learning side project. It is in the middle of **version 2**: a solo zero-to-hero drawn
in 2D pixel art, growing toward a bigger world with people and a history in it, a house to fill,
and a level cap of 20. [`docs/v2_plan.md`](docs/v2_plan.md) is the plan, and its status line says
what has landed and what is next. [`CLAUDE.md`](CLAUDE.md) says how the code is shaped and why.

## What is in it now

- **Ten zones**, from a starter town, beach, quarry and bandit camp at levels 1-3 up through the
  Old Mill Road, Blackwater Fen, the Deep Cut and Greyford Outpost to the Sunken Barrow at 7-8,
  with a level cap of 9. Version 2's Part C rebuilds them at about three times the size.
- **Three classes**: a warrior with a sword, a wizard with a staff and spells, and a ranger with a
  bow that spends an arrow a shot. A new character starts plain, with a name, a class and a look
  (skin, hair colour and hairstyle) chosen on the first screen.
- **Seven gathering and making skills**: woodcutting, fishing and mining, then cooking, smithing,
  leatherworking and fletching, with a skills book that shows every recipe and what each level
  buys.
- **Gear that shows on you**: weapons, offhands and armour by slot and tier, drawn on the
  character as it is worn, and a character sheet with every stat named in full.
- **Two-way combat**: creatures that telegraph their abilities, bosses, and combat skills that
  grow with the character.
- **People to talk to**: a shop, a bank, a trainer, a quest chain and a board of repeatable
  contracts in town, and at Greyford an outfitter who trades in ore and timber rather than coin
  and a fettler who reforges gear.
- **Something to chase**: slayer feats and the titles they give, and mastery of each target.
- **Idle**: the game plays on while you step away, and it pays out when you come back, even with
  the tab closed.
- **Tips**, each said once, and a save that goes out as a file or a code and comes back in.

Everything is drawn as data: every tile, creature, person, building, tree and spell is pixel art
written in code and compiled when the game starts. The game loads no image or sound files.

## Stack

TypeScript, bundled with [Vite](https://vite.dev/), with no runtime dependency at all. The world
is pixel art drawn as data (`src/art/`) and drawn with the browser's own Canvas 2D
(`src/render2d/`); sound is synthesised with Web Audio. The game was first 2D on
[Phaser](https://phaser.io/), then 3D on [Three.js](https://threejs.org/)
(`docs/archive/3d_port_plan.md`), and version 2 took it back to 2D. No backend: character data is
saved to the browser's `localStorage` behind a `SaveService` interface.

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

| Command                | What it does                                                       |
| ---------------------- | ------------------------------------------------------------------ |
| `npm run build`        | Produces a production build in `dist/`, without a type-check       |
| `npm run preview`      | Serves the production build locally                                |
| `npm run test`         | Runs the Vitest unit test suite                                    |
| `npm run coverage`     | The same suite with a coverage report                              |
| `npm run typecheck`    | Type-checks without emitting (`src/` and `tests/`, and `scripts/`) |
| `npm run lint`         | Runs ESLint                                                        |
| `npm run format`       | Formats the codebase with Prettier                                 |
| `npm run format:check` | Checks formatting without writing, which is what CI runs           |
| `npm run smoke`        | Browser smoke check (needs `npm run dev` in another shell)         |

## How to play

The game is laid out for a portrait phone, and everything works with a mouse too.

- **Tap or click the ground** to walk there; the walk routes round walls and buildings. **WASD**
  also moves, W up the screen, which is north.
- **Tap a creature** to target it and start attacking. Stay in range and the fight goes on by
  itself, EverQuest and WoW style. **Esc**, or a tap on empty ground, drops the target.
- **Tap a tree, a fishing spot or an ore vein** to gather from it, a **signpost** to walk to the
  next zone, and a **forge**, **tannery** or **fletcher's bench** to make things. A **campfire**
  is lit from a log in the Bag, and cooks.
- **Tap a person**, or the shopfront they work behind, to talk to them: they greet you, offer
  their counter and any quests they have.
- **Press and hold** (or right-click) anything to ask what it is and what it drops.
- **The tab bar** along the bottom opens Char, Bag, Quests and Idle, and **Menu** opens the Map,
  Feats, Skills, the Combat Log and Options. Keyboard shortcuts: `c`, `i`, `q`, `z`, `m`, `v`,
  `k` and `l`, and `1`-`4` fire the action bar.
- **Options** has the volume, the tips, your save (download it, copy it as a code, or load one),
  and **Reset Character**, which asks twice. `F9` resets on a keyboard.

Progress (level, experience, skills, gear, the bank, quests, kills, and where you were standing)
saves to your browser as you play and is there when you come back.

## Project layout

```
src/
  world/        The simulation: ZoneWorld, the player, the creatures, the session
  render2d/     The Canvas 2D view, the only code that draws the world
  art/          Sprites as data, the palette and the compiler, importing nothing
  host/         The frame loop, the pointer, the keyboard and the sound around a zone
  audio/        Every sound, synthesised from a recipe
  systems/      Combat, levelling, movement and the other rules, plain TypeScript
  data/         Classes, items, creatures, zones, quests, recipes and the maps
  persistence/  The saved character's shape, its migrations, and the save service
  hud/          The HTML overlay: tab bar, sheets, panels, modals
  ui/           Layout, theme and event vocabulary the HUD is built from
  types/        The id unions the data tables are keyed on, and the debug-view interface
  config/       Tunable constants
tests/          Vitest specs mirroring src/
scripts/        The Playwright smoke check
docs/           The live plan, the decisions, and the reasoning behind each subsystem
```

Nothing but `main.ts` imports `render2d/`, and nothing in `src/` imports a package, which is what
makes the rest unit-testable and what let the renderer be replaced twice without rewriting the
game.
