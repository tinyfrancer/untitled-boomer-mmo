# Architecture

How each subsystem is shaped and why. `CLAUDE.md` holds the rules that apply everywhere and points
here; each file below holds the reasoning for one topic — what was decided, what it protects, and
the traps that were found the hard way. Read the file for a topic before changing the topic, and
correct it in the same PR when the change moves what it describes.

| File            | What it covers                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `simulation.md` | The tick, the collaborators, the session, the two channels, death and respawn, movement, collision, pathing, aggro, persistence, frame rate |
| `zones.md`      | The zone roster, how zones join, locks and keys, the Greyford loop, what an exit costs                                                      |
| `buildings.md`  | Walls, doorways, rooms, counters indoors, the cutaway, the room light, line of sight                                                        |
| `economy.md`    | The Greyford barter and the fettler, the shop's shelf, selling, the bank, NPC roles, the full pack                                          |
| `making.md`     | Tools, recipes, stations, the tiers, cooking, the dead-end rules                                                                            |
| `content.md`    | Loot rules, quests and objectives, bounties, the stored tallies, mastery                                                                    |
| `combat.md`     | Abilities and the trainer, cast times, levels, difficulty, the cap, crits, armour, enemy abilities, bosses, pacing                          |
| `afk.md`        | Idle (the code's camp), what it does, the idle panel and its food order, and offline progress                                               |
| `hud.md`        | The HTML overlay and its pieces, the map, layout, the tab bar and the menu                                                                  |
| `rendering.md`  | Camera, terrain, light and shadow, the draw budget, nameplates, effects, picking, gestures, occlusion                                       |
| `audio.md`      | Sound: what it hears from the two channels, the cues, the ambience, the gesture that unlocks it, mute and volume                            |
| `testing.md`    | What goes in `tests/world/` and what in smoke, the dev handles, the hand crank                                                              |

The forks — what was chosen against what — are in `docs/decisions.md`, and finished plans are in
`docs/archive/`.
