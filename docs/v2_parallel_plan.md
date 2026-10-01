# Working the rest of version 2 in parallel

**Status:** live. Proposed on 2026-10-01 against `6497833`, the merge of C10, and taken by the user
the same day (decision 123). `docs/v2_plan.md` is still the live plan and still says what each phase
is; this document says how its remaining phases are built by several agents at once rather than one
session at a time, and holds a brief per phase. **Landed:** C11 (wave 0), 2026-10-01, with the
measurement below written into the plan's C11 entry (decision 124); G1 (wave 2's first), 2026-10-01,
Part G written into the plan as G2-G16 with a brief per tier, zone and the carters below (decision
125). **In flight:** wave 1 (D1, D4, E1, E2, F1), started 2026-10-01 before C11 merged at the user's
word, its questions answered under each brief. **Next:** G3 (tier one), the moment G1 merges, and
band 9-12's zones once G3, D1-D4 and F1 have. Update this line as phases start and land, the way the
plan's status line is.

Each phase is still built the plan's way: one PR, the gates and smoke green locally before the push,
the open questions asked first, the status line, a decision for each fork, and the architecture doc
corrected in the same change. What changes is that four or five of those are open at once, which
costs some rules about the files they all touch, below.

**The agents** are Claude Opus 5.5 at high effort, one cloud session per phase on a branch named
below, started cold from `CLAUDE.md` and the brief for its phase at the end of this document. The
user keeps the role they have: the mechanics forks are theirs to settle, and a phase asks its
questions before it writes code. The lore stays Claude's (decision 114): no agent asks the user a
story question, and a PR names the parts of the lore it touched, not what they now say.

---

## What is left

Everything below is scoped in `docs/v2_plan.md`; nothing is added here. Size is a guess in files from
the phases that have landed (an A-phase was 20-45, a rebuild 25-35, B8 70), and hours are agent
hours from the cadence so far (next section), not the user's.

| Phase                     | What it is                                                                                    | Needs first                | Size, hours         |
| ------------------------- | --------------------------------------------------------------------------------------------- | -------------------------- | ------------------- |
| **C11** Part C review     | Walk C1-C10 against the pillars; C10's three leftovers; **measure a zone's cost** for G1      | nothing                    | 10-20 files, 1-2h   |
| **D1** Dialog             | Conversations as data in the talk panel, a person who remembers, every NPC rewritten          | nothing                    | 35-50 files, 2-3h   |
| **D1b** The lore's people | Five people the lore places and the game lacks, each drawn, a role whose only counter is talk | D1, F1 for the inn's row   | 20-30 files, 1.5-2h |
| **D2** Whispers           | One journal of rumours (leads) and lore fragments (found), with counts                        | D1 for its source          | 25-35 files, 1.5-2h |
| **D3** Factions           | Standing with each faction, moved by quests, kills, contracts and dialog; ranks open things   | D1 for dialog choices      | 30-45 files, 2-3h   |
| **D4** The spirit         | Wick drawn in the world, following, tapped, told to go quiet; the beats; takes the tips       | nothing                    | 35-50 files, 2-3h   |
| **D5** Part D review      |                                                                                               | D1-D4                      | 10-20 files, 1h     |
| **E1** Rested             | Idle or away banks a bonus that speeds active XP, capped, on the XP bar                       | nothing                    | 15-25 files, 1-1.5h |
| **E2** Potions            | A new making skill and where its herbs come from; potions that boost idle, some a fight       | nothing                    | 40-60 files, 3-4h   |
| **E3** What idle uses     | Idle drinks what it is given; potions join the idle panel's order and Keep                    | E2                         | 15-20 files, 1h     |
| **E4** Part E review      |                                                                                               | E1-E3                      | 10-20 files, 1h     |
| **F1** The house          | A building in Lampton that is yours: stands, a wall, a chest                                  | nothing                    | 40-55 files, 2.5-3h |
| **F2** A house that grows | Upgrades for coin: rooms, stands, a garden, a workbench; priced by simulation                 | F1                         | 25-35 files, 2h     |
| **F3** Collection log     | Bestiary and log: slain, drops seen, lore found, trophies; an item says where it comes from   | D2 for the lore count      | 25-35 files, 1.5-2h |
| **F4** Part F review      |                                                                                               | F1-F3                      | 10-20 files, 1h     |
| **G1** The shape of 9-20  | Bands, zones, tiers, bosses, travel, written into the plan as phases; sized from C11          | C11                        | docs, 1-2h          |
| **G2** Specialisations    | Two paths a class at 10, their abilities and ranks; the bar stays four                        | G1, a level-10 spawn       | 35-50 files, 2.5-3h |
| **G3, G8, G14** The tiers | A made tier a band: metal, leather, wood, food, tools and arrows; skills to 20                | G1; the band before        | 40-60 files, 2.5-3h |
| **G4-G16** The bands      | Ten zones, a zone a phase (three pairs to one agent), and the carters (G13); G1 wrote them    | the band's tier, D1-D4, F1 | per zone 25-40, 2h  |
| Part G review             |                                                                                               | G16                        | 1h                  |
| **H1** The last pass      | The original list and every pillar once more                                                  | everything                 | 1-2h                |
| **H2** Archive            | The plan to `docs/archive/`, `CLAUDE.md` to the game as it stands                             | H1                         | docs, 1h            |

Two things outside the plan are left as well, neither a phase: `docs/upgrade_plan.md` (TypeScript 7,
blocked on typescript-eslint; re-check its issue now and then), and a stale remote branch,
`cleanup/09-zoneworld-split`, last touched on 2026-08-07 and never merged, which can be deleted.

---

## What the last five days say about cost

C11 is asked to measure how long a zone took to build, the number Part G is sized from. The commit
record already says, taking the gap between one phase's "Record" commit and the next as the time a
phase took its session, the user's answers and merge included (the merges came within about ten
minutes of each Record commit):

| Phase | Zones                        | Session time | What else it carried                      |
| ----- | ---------------------------- | ------------ | ----------------------------------------- |
| C5    | Lampton, Candle Strand       | ~75 min      | the secrets system and three secrets      |
| C6    | the New Cut, Redrag Camp     | ~42 min      | masonry, a ground of its own              |
| C7    | the Cellar, the Barrow       | ~80 min      | the mouth, two edges                      |
| C8    | Old Mill Road, Greyford      | ~95 min      | outdoor mouths, a secret in a room, smoke |
| C9    | Blackwater Fen, the Deep Cut | ~41 min      | two edges                                 |
| C10   | the grind                    | ~64 min      | the pacer                                 |

Ten zones in about five and a half agent hours, roughly **half an hour a zone rebuilt**, and the
whole of version 2 so far, thirty phases, in four days, fourteen PRs merged on 2026-09-30 alone. Two
cautions for G1: a rebuild reused every creature, node and recipe, where a Part G zone is new content
(creatures drawn on the figure or as a new shape, a loot table, quests, secrets, lore extended), so
budget **two to three times a rebuild, about an hour and a half to two hours a zone**, plus a
phase for each gear and making tier; and the cadence above was one phase at a time with the user
merging in minutes, which parallel work does not speed up. **The user is the bottleneck in this
plan, not the agents**: every phase wants its questions answered at the start and its PR played at
the end.

---

## Where parallel phases collide

Every phase touches a handful of the same files. Most collisions are a line appended at the same
place and resolve mechanically on a rebase; three are not, and they are what the rules in the next
section are for.

| File                                                                             | Who touches it             | Kind                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/persistence/CharacterState.ts`, `migrations.ts`, `saveFile.ts`              | D1 D2 D3 D4 E1 E2 F1 F3 G2 | **Sequential**: the save version counts by one and the chain may have no gap                                                                                                                                                                                                                   |
| `docs/decisions.md`                                                              | every phase                | **Sequential**: decision numbers                                                                                                                                                                                                                                                               |
| `docs/v2_plan.md` status line, `CLAUDE.md`                                       | every phase                | **Same lines**: prose, resolved by hand on every rebase                                                                                                                                                                                                                                        |
| `src/types/ids.ts`                                                               | every phase                | Append to a union                                                                                                                                                                                                                                                                              |
| `src/ui/uiEvents.ts`, `src/hud/Hud.ts`, `hud/styles.ts`, `tests/hud/Hud.test.ts` | every HUD phase            | Append                                                                                                                                                                                                                                                                                         |
| `src/ui/tabs.ts`, `art/icons.ts` marks                                           | D2, F3, maybe D3           | A seat behind Menu each: **decided below**, so two phases do not argue it                                                                                                                                                                                                                      |
| `src/world/ZoneWorld.ts`                                                         | D1 D3 D4 E1 F1             | A collaborator built and ticked; a hook in `resolveKill` or the XP path                                                                                                                                                                                                                        |
| `scripts/smoke.mjs` (one file, 5,700 lines)                                      | every phase                | A section appended and a row in `SECTIONS`                                                                                                                                                                                                                                                     |
| `src/data/townMap.ts` (Lampton's text)                                           | F1, D1b, E2                | **One owner**: F1 edits it; D1b names Bess on the inn's row once F1 has merged; E2 places nothing there                                                                                                                                                                                        |
| `src/systems/ItemUseSystem.ts`                                                   | E2 E3 F1 F3                | A new kind of use each; append                                                                                                                                                                                                                                                                 |
| `src/data/items.ts`, `recipes.ts`, `lootTables.ts`                               | E2, F1, G tiers            | Rows                                                                                                                                                                                                                                                                                           |
| `src/world/TalkSession.ts`, `hud/TalkModal.ts`, `data/dialog.ts`                 | D1, then D2 and D3         | D1 shapes it; D2 and D3 add rows, not shape                                                                                                                                                                                                                                                    |
| `tests/world/pace.ts`, `pace.test.ts`                                            | E1, E2, G2, G3-G16         | The bot must play unrested and unpotioned, or the bands move                                                                                                                                                                                                                                   |
| The old zones' texts a Part G mouth opens                                        | G4 G5 G7 G9 G15, D1b, E2   | **Append and re-cut the mouth only**: the fen (G4's west edge; D1b's Maren, E2's herbs), Greyford (G5's west and G9's north; D1b's Pocket), the Deep Cut (G7's door), the strand (G15's east; D1b's fisher). A zone phase re-cuts its mouth after the others have merged, or rebases onto them |
| `src/data/zones.ts`, `ZoneId`                                                    | every Part G zone          | A row each and an exit on the neighbour's row; the mouths are fixed in the plan, so the rows never argue                                                                                                                                                                                       |

---

## How a phase is worked in parallel

The plan's "How this plan is worked" holds, with these on top, which it summarises (decision 123).

1. **A branch per phase, named here**, cut from `origin/main` the day the phase starts:
   `claude/v2-c11-review`, `claude/v2-d1-dialog`, and so on down the briefs. One PR per phase, as
   before; a draft while it moves, ready when it is done.
2. **Questions first, in one round.** A phase asks every open question in its brief before it writes
   code, and the user answers a wave's questions in one sitting. A mechanics fork the brief did not
   foresee is asked when met; a lore fact is added to `docs/lore/` and not asked.
3. **Numbers are taken at the merge, not at the branch.** A phase in flight writes its decision
   with no number and its migration step against a version it does not yet know. When it is ready,
   it rebases on current `main`, takes the next decision number and the next `CHARACTER_STATE_VERSION`
   (and keys its step to it), runs the gates and smoke again, and pushes. The user merges it next, or
   it rebases once more. A phase that changes nothing about the save takes no version. The typecheck
   holds `saveFile.ts`'s `FIELDS` to every field, so a step cannot land without its check.
4. **The Record commit is written last, after that rebase**, so the status line, `CLAUDE.md`, the
   decision and the architecture doc are written against what `main` says by then rather than
   against what it said the morning the branch was cut. That is the order the phases already use;
   here it is a rule.
5. **The merge queue is one at a time**, in the order phases finish. A rebase onto a phase that
   merged ahead costs minutes, since nearly every collision is an appended line.
6. **A phase edits only its own entry in `docs/v2_plan.md`** and the status line. A review phase
   amends its own part; anything it would change in another part that has an agent on it is
   proposed in the PR and the user settles it, so a review cannot cut a phase from under a session.
7. **A phase stays out of files another in-flight phase owns**, which is what the collision table
   is for: Lampton's text is F1's, the dialog schema is D1's until it merges, and so on. Where two
   phases need the same new thing (D2 and D3 both want a dialog line to have conditions and
   effects), the earlier phase builds the shape and the later adds rows.
8. **The pace is not moved sideways.** A phase that adds a buff, a bonus or a consumable keeps it
   out of `tests/world/pace.ts` or holds the bot to playing without it; a phase that means to move
   the curve says so in its decision and retunes.
9. **Every merge still deploys**, so every phase still leaves the game playable half-built, and the
   CI budget is unchanged: five PRs a day is nowhere near a hundred deploys.

---

## The waves

What can start together, what waits, and what the user is asked for in each. The waves are not
rigid: a phase starts when what it needs has merged and the user has answered its questions.

### Wave 0, now: C11, alone for half a day

The plan's own rule is that a review amends the rest of the plan before the next part starts, and
C11 is the one phase that can re-shape Parts D-F before anyone is on them. It is short (one or two
hours, the measurement above already in hand), so the cheap reading of the rule is to run it first.
**The wave-1 question round can be put to the user the same day**, since the questions are the
plan's own and C11 will not change them; code on wave 1 starts when C11 has merged and the answers
are in.

**The user is asked:** C11's four questions (brief below), then wave 1's twenty or so in one
sitting.

### Wave 1: five agents, nothing waiting on anything

Started 2026-10-01, before C11 had merged, at the user's word: the risk decision 123 names (a review amending a part with a session on it) is carried by rule 6, under which C11 proposes rather than applies.

- **D1 — Dialog** (`claude/v2-d1-dialog`). The longest pole of Part D, since D2 and D3 both hang
  off its schema.
- **D4 — The spirit** (`claude/v2-d4-spirit`). Rendering, world and HUD, and independent of D1-D3.
- **E1 — Rested** (`claude/v2-e1-rested`). Small and self-contained.
- **E2 — Potions** (`claude/v2-e2-potions`). The longest pole of Part E; its herbs and brewing are
  placed outside Lampton so it never meets F1 in a map.
- **F1 — The house** (`claude/v2-f1-house`). Owns Lampton's text for the wave.

Four if the user would rather judge four PRs than five; E2 is the one to hold back, since E3 is
the only thing waiting on it.

**The user is asked:** each phase's questions at the start, then to play five PRs as they come, and
to merge them one at a time as each is rebased.

### Wave 2: as wave 1 merges, five agents again

- **G1 — The shape of 9-20** (`claude/v2-g1-shape`), as soon as C11 has merged. An interview and a
  doc, on the critical path to everything in Part G, so it goes first in this wave rather than last.
- **D1b — The lore's people** (`claude/v2-d1b-people`), once D1 has merged, and F1 for the one line
  it writes in Lampton's text. Split from D1 by the user's answer below.
- **D2 — Whispers** (`claude/v2-d2-whispers`), once D1 has merged.
- **D3 — Factions** (`claude/v2-d3-factions`), once D1 has merged. Quests, kills and contracts
  moving standing need nothing of D1's; dialog choices do, and D1's schema will have the slot.
- **E3 — What idle uses** (`claude/v2-e3-idle-potions`), once E2 has merged.
- **F2 — A house that grows** (`claude/v2-f2-house-grows`), once F1 has merged.
- **F3 — Collection log** (`claude/v2-f3-collection`), once F1 has merged; its lore count fills when
  D2 lands, and the HUD already draws an empty count without complaint.

**The user is asked:** G1's interview, which is the largest single ask in the whole of what is left
(it writes the phases Part G is built as), and the five phases' questions.

### Wave 3: the three reviews, and Part G's first content

- **D5, E4, F4** (`claude/v2-d5-review`, `claude/v2-e4-review`, `claude/v2-f4-review`), each once
  its part has merged, one agent each. If the three parts finish within a day of each other, one
  agent walks all three as a single review and the user plays once; the plan then records three
  review entries from one PR, which the phase-size rule allows for with a reason.
- **G3, tier one** (`claude/v2-g3-tier-one`), once G1 has merged: the band 9-12's metal, leather,
  wood and food as rows, wardrobe drawings, icons and recipes, with nothing yet dropping or yielding
  them, and the skills to 20. Built ahead of the band's zones so every zone agent finds its tier's
  ids and drawings in `main`.
- **Band 9-12's zones**, once G3 and D1-D4 and F1 have merged: G4 (Lorhal), G5 then G6 (the
  Stillwood and the Quiet Court, one agent) and G7 (Karn Tholl), three agents, each on the brief
  below. G2 starts once G4 has merged.

**The user is asked:** to play three reviews and say what feels wrong, and to judge the first new
zones.

### Wave 4: the bands, in parallel

- **G2 — Specialisations** (`claude/v2-g2-paths`), once G4 has merged, since the cap is derived
  from the richest spawn and a path chosen at 10 needs a 10 to reach.
- **Band 13-16**, once band 9-12 has merged and the user has judged it: G8 (tier two) first, then
  G9 then G10 (the High Greyhills and the Ashen Hollow, one agent), G11 (the Drowned Halls, after
  G7) and G12 (the Barrow Field, after G4), and G13 (the carters) beside them.
- **Band 17-20**, the same way: G14 (tier three), then G15 then G16 (the Sea-Wall and Marhal, one
  agent), which ends the game.
- **Each zone owns** its own map file, its `ZONES` row and the exit row on each neighbour's with the
  mouth G1 fixed, its creatures' `cast.ts` rows, its loot, its secrets and its quests, and holds its
  own levels in the pace test. **Bosses, faction content, rumours and contracts** go in the zone they
  live in, not in phases of their own.

**The user is asked:** to judge zones as they come, a band at a time.

### Wave 5: the end

- **Part G review**, one agent, once the last band has merged.
- **H1 — The last pass** (`claude/v2-h1-last-pass`), after it.
- **H2 — Archive** (`claude/v2-h2-archive`), after H1, docs only.

### The critical path

C11 → G1 → G3 → band 9-12 (G4-G7) → G2 and G8 → band 13-16 (G9-G13) → G14 → band 17-20 (G15, G16) →
Part G review → H1 → H2. Parts D,
E and F run beside it and finish long before it. In agent hours that path is about twelve to
fifteen of dependent work; the user's turnaround between each link is what sets the calendar.

---

## The briefs

One per phase, written for a session that opens it cold with `CLAUDE.md` loaded. Each says what to
read, what to ask, what it touches, what has to stay true, and what it adds to the tests and the
docs. The plan's entry for the phase is the spec; a brief is what the entry does not say.

Every brief assumes the plan's "Starting cold": the status line, the phase's entry and its part's
introduction, decisions 80-88, `git log --oneline -15`, and the architecture file for each
subsystem touched. Each lists what else.

### C11 — Part C review (`claude/v2-c11-review`)

**Read:** decisions 113-122, especially 122's "Found and left"; `docs/architecture/combat.md`'s
pacing paragraph; `tests/world/pace.ts` and the per-zone timings it reports.

**Ask the user first:**

1. The barrow kills every class often in the bot's hands, its wights coming in groups through
   rooms. Spread the spawns so they come singly, let a kite open a room up, or leave the barrow a
   wall for a level 8 to feel?
2. A level 1 with nothing to eat or light rests for most of the first five minutes. A ration or
   logs in the starting bag, the first quest paying food, or left as the start it is?
3. The Deep Cut takes the ranged classes longer than the mill road at the same level. Tune, or
   leave it the zone a warrior does best in?
4. After playing C5-C10 on a phone: what feels wrong?

**Do:** walk the pillars and the user's original list over every zone at a portrait phone and a
desktop through smoke's screenshots, as A10 and B9 did; mend in place what is small and clear;
record the measurement in the table above into the plan's C11 entry, with the caution about new
content costing more than a rebuild; amend Part C's entries. **Do not** reorder or cut a Part D-F
phase that has a session on it; propose it in the PR instead (rule 6).

**Touches:** `docs/`, and whatever the mends touch. **Tests:** the pace test if the barrow or the
first level move; it is the gate on any retune.

### D1 — Dialog (`claude/v2-d1-dialog`)

**Read:** decisions 87, 92 and 114; `docs/lore/README.md`, `tone.md`, `places.md` (every person's
entry), `naming.md`; `docs/architecture/economy.md` (the NPC roles and the talk shell) and
`simulation.md` (the collaborators); `src/data/npcs.ts`, `src/world/TalkSession.ts`,
`src/hud/TalkModal.ts`, `src/hud/talkQuests.ts`, `tests/world/counters.test.ts`.

**Ask the user first (mechanics only; the words are Claude's):**

1. The six townsfolk have names in the lore. On the nameplate, the map and the card, is a person
   "Tilda Pell" with her trade under it, or "Tilda Pell, Shopkeeper" in one line? Pillar 1 wants
   the trade kept somewhere.
2. Does a person remember what you have asked for ever (a topic asked goes grey and stays grey) or
   per visit?
3. The lore places five people the game lacks and who work no counter: Bess Mallow at the Wet Boot,
   an old fisher on the strand, Pocket the crow on Greyford's longhouse, and Tirrow and Maren in the
   fen. In D1, or split off as a D1b that runs beside D2 and D3? A person with no counter is a new
   kind of row (a role whose only counter is talk), and the crow is a new shape to draw.
4. Does an answer in D1 already do anything beyond leading on: set a flag another line reads, hand
   over an item? Decision 87 says choices move standing (D3) and lead to rumours (D2), so the
   schema wants `requires` and `effects` on a line from the start even if D1 fills none.

**Answered (2026-10-01):** the name alone over the head, the trade beside it on the card, the map and
the talk panel; a person remembers for ever, an asked topic grey until it gains a new answer; the
five people are split off as D1b (below); an answer does nothing yet, and the schema has `requires`
and `effects` from the start.

**Do:** a `data/dialog.ts` of topics per person, each a line with answers that lead to more, with
`requires` (level, quest state, standing, a rumour heard) and `effects` (standing, a rumour, a flag)
as slots D2 and D3 fill; `TalkSession` holds the conversation's state and what this person has been
asked goes on the character (a new field, a save version taken at the merge, rule 3); `TalkModal`
draws topics as buttons, the counter button and the quests as before. Rewrite every greeting and
write every topic in `tone.md`'s voice from `places.md`, names and places now allowed (one unmet
name a line, rule 8 of the tone). The six take their lore names here, and any name not yet in
`naming.md`'s list goes on it; the five people the game lacks are D1b's.

**Keep true:** talking is still a counter (`CounterId` `'talk'`), so everything that shuts a counter
shuts it; no position on the HUD channel; the lore is extended, not asked. **Tests:** topics and
memory in `tests/world/counters.test.ts` or a `dialog.test.ts`; a test that every person has a
greeting and at least one topic, and that every `requires` names something that exists (the
dead-end rule's shape). **Docs:** `economy.md`'s NPC section, `hud.md`'s talk panel, `content.md` if
quests are offered through a topic. **Smoke:** a `dialog` section that opens a person, asks, and
sees the topic grey on return.

### D1b — The lore's people (`claude/v2-d1b-people`)

Split from D1 by the user's answer above, and run beside D2 and D3 once D1 has merged (and F1,
for the one line it writes in Lampton's text).

**Read:** D1's brief and what it landed; `docs/lore/places.md` for each person's entry and
`peoples.md` for Pocket; decisions 107, 108 and 112; `src/art/cast.ts`, `art/budget.ts`,
`data/zoneText.ts` (how a worker is named on a building's row), `tests/art/sprites.test.ts`,
`tests/systems/spawnSafety.test.ts`.

**Ask the user first:** whether a person with no counter is a role whose only counter is talk (a
`'none'` role, the talk button alone and no service line) or a nullable role; whether Tirrow, who
leads the raiders, talks at all before Part G or is met only in Maren's lines; and where Pocket
perches, since a person stands on the ground and a crow on a roof is drawn over a building it does
not block.

**Do:** five rows in `NPCS` with their topics in D1's schema: Bess Mallow named on the Wet Boot's
row in Lampton's text; the old fisher on the strand; Pocket on Greyford's longhouse, a new shape
drawn within the budget; Maren, and Tirrow if chosen, in the fen, where no building stands, so each
is placed in the text and drawn on the figure in the fenfolk's getup. Every placement held by the
spawn and pathing sweeps; every new name in `naming.md`.

**Keep true:** a person not in `cast.ts` is its shape's placeholder and a test holds every one to a
drawing; a getup is on the figure (decision 108); the budget is exact. **Tests:** `dialog.test.ts`
grows; the sweeps and the sprite test by construction. **Docs:** `economy.md`'s NPC roles, `art.md`'s
cast, `places.md` marking who is in. **Smoke:** a person talked to in a zone with no counter.

### D4 — The spirit (`claude/v2-d4-spirit`)

**Read:** decisions 87, 98, 108 and 117; `docs/lore/spirit.md` (the beats table is the content) and
`tone.md`; `docs/architecture/art.md` (the budget, effects, marks), `rendering.md` (painter's order,
picking, plates), `hud.md` (the tip card), `audio.md`; `src/world/TipDesk.ts`, `SecretFinder.ts`,
`src/hud/TipCard.ts`, `src/systems/TipSystem.ts`, `src/render2d/effects.ts`, `src/art/budget.ts`.

**Ask the user first:**

1. Where Wick speaks: the card as it is, now wearing Wick's name and light, or a bubble drawn in the
   world beside the spirit by the renderer, laid out with the name plates? The card is the HUD's and
   already waits for a tap; a bubble is the view's and moves with the spirit.
2. Does "go quiet" silence the tips alone or the story beats too?
3. Underground the one light is the player's lantern (decision 59). Is Wick that light, so the
   lantern's glow is the spirit's, or does the spirit float beside a lantern?
4. Is the spirit tappable while a counter is open?

**Answered (2026-10-01):** the card as it is, in Wick's name and light, the spirit glowing and
chiming in the world when it has something to say; quiet silences the tips alone; Wick is the light
underground, the lantern's glow its own; a tap on it waits while a counter is open.

**Do:** a sprite for Wick in `src/art/sprites/` on the budget's clock, a fist-sized blue-white light
(the tip card's edge, `spirit.md`) with a loop and a "has something to say" state; the spirit as a
`ZoneWorld` collaborator with a `Deps` of its own, following the player on a lag that never routes
and never blocks, drawn in painter's order by its feet and picked in the priority list (a new kind
in it, swept by `render2d/picking.test.ts`); a tap speaks, a line from the beats table on a new zone
or a boss, otherwise a tip if one waits, otherwise a line of its own; `data/spiritBeats.ts` with the
nine beats before Part G, heard once and kept on the character (a save version at the merge); the
secrets' lines (`SECRETS[].line`) and the tips spoken through it; a `WorldEvent` for the chime when
it has something to say, since a sound cannot poll; "go quiet" in Options and on the card, kept on
the character beside `tips.off` or as it.

**Keep true:** no position on the HUD channel once a frame, so a bubble in the HUD is a card and a
bubble in the world is the renderer's; the budget is exact, so a new sprite kind or frame count is a
decision; nothing before Part G says what Lorn did. **Tests:** the sprite in `tests/art/sprites.test.ts`
by construction; a `tests/world/spirit.test.ts` for following, the beats once each, the tips through
it, and quiet; picking. **Docs:** `rendering.md`, `art.md`, `hud.md`'s tip card paragraph,
`simulation.md`'s collaborator list, `spirit.md` marking which beats are in the game. **Smoke:** a
`spirit` section: drawn beside the player, a tap, a line, and the canvas count flat across a zone
round trip with it along.

### E1 — Rested (`claude/v2-e1-rested`)

**Read:** decisions 15, 85 and 96; `docs/architecture/afk.md` whole, `combat.md`'s pacing paragraph,
`hud.md`'s player column; `src/systems/AfkSystem.ts`, `OfflineAfkSystem.ts`, `LevelingSystem.ts`,
`IdlePlanSystem.ts`, `src/hud/PlayerColumn.ts`, `tests/world/pace.ts`.

**Ask the user first:**

1. Banked from idle running with the game open only, or from a parked night too (the plan's own
   question)? The lore's hook is Wick keeping watch while the player is away.
2. The cap: a share of a level, as the offline ceiling is half of one?
3. Does rested speed character XP alone, or skill XP too?
4. On the XP bar: a paler segment ahead of the fill showing how far rested reaches, or a tint on the
   bar while it is spending?

**Answered (2026-10-01):** banked by idle with the game open and by a parked night; capped at a
share of a level, half a level's worth as the offline ceiling is; character XP alone; shown as a
paler segment ahead of the fill.

**Do:** a `rested` field on the character (a save version at the merge) banked by the camp and, if
chosen, the parked payout, spent as a multiplier on attended XP only, so a camp's halved XP is never
rested as well; a `RestedSystem` with the rate and the cap behind exported functions the idle panel
and the skills book can read (the plan's rule that what a level or a panel promises is derived); the
idle panel says what idle banks, in `IdlePlanSystem`; the XP bar shows it; the away report names what
a night banked.

**Keep true:** the pace test plays unrested, so a run starts with none banked and the bot never
idles; `awardXp` is the camp's path and `publishXpGain` the player's, and rested rides the player's.
**Tests:** `tests/systems/RestedSystem.test.ts`; the idle plan's words; `pace.test.ts` unmoved.
**Docs:** `afk.md`, `hud.md`. **Smoke:** the bar's segment in the `player-column` section.

### E2 — Potions (`claude/v2-e2-potions`)

**Read:** decisions 14, 64, 76-79 and 85; `docs/architecture/making.md` whole (tools, stations, tiers,
dead ends), `content.md`'s loot rules, `afk.md`, `art.md`'s places, icons and wardrobe;
`docs/lore/README.md`'s hook (the fenfolk's brewing from what grows in the fen) and `peoples.md`;
`src/data/recipes.ts`, `resourceNodes.ts`, `items.ts`, `src/systems/ItemUseSystem.ts`,
`SkillBookSystem.ts`, `EffectSystem.ts`, `tests/systems/deadEnds.test.ts`.

**Ask the user first:**

1. Herbs from a new gathering skill with nodes and a tool of its own, or from existing nodes and
   drops (the plan's question)? A tool is a weapon-slot item and so a wardrobe drawing.
2. Where a potion is brewed: at a campfire, as cooking is, which needs no new station and lets idle
   brew at a fire; or a new station (a still) at Greyford or in the fen, drawn in this phase?
3. What the potions do: idle XP, gathering speed, and which help in a fight, if any?
4. Where the herbs grow: the fen and the mill road's bank, the strand, or everywhere?

**Answered (2026-10-01):** a fourth gathering skill with nodes and a tool of its own, sold at the
shop like the others; brewed at a new station, a still, drawn in this phase and placed at Greyford
or in the fen; the potions boost idle XP, speed gathering, help in a fight (held by the duels, and
kept out of the pace bot) and better a drop or mastery roll, one kind each; herbs grow in the fen
and on the mill road's bank, a low one on the strand, none in Lampton.

**Do:** the skill (a `GatherSkillId` if making; a second if gathering), its nodes (`RESOURCE_NODES`
rows, `art/places.ts` drawings, placements in the zone texts the user chose, held by the spawn and
pathing sweeps), the herbs and potions (`ItemId`s, `art/icons.ts` icons, held by the icon test), the
recipes, the effects (`EffectId`s with icons), the uses (`ItemUseSystem` learns "Drink: …" and the
skills book derives the pages by construction), and the skill's page. Name it all from the lore
and add to `naming.md`.

**Keep true:** every herb is consumed by a recipe and every potion by a use (`deadEnds.test.ts`
will say); the pace bot drinks nothing; a fight potion is held by the duels; nothing is placed in
Lampton's text (F1 owns it). **Tests:** `tests/systems/brewing.test.ts` or the skill's name; the
dead-end, icon, places and sprite tests by construction; `tests/world/` for a brew at the station.
**Docs:** `making.md`, `content.md`, `art.md`'s places table. **Smoke:** a section for the station if
it is new, as `fletchers-bench` is.

### F1 — The house (`claude/v2-f1-house`)

**Read:** decisions 25, 40-48, 88, 109 and 120; `docs/architecture/buildings.md` whole, `economy.md`'s
bank, `rendering.md`'s picking, `zones.md`; `docs/lore/places.md`'s Lampton and `factions.md`'s
Company (the plot it grants); `src/data/townMap.ts`, `buildings.ts`, `src/art/building.ts`,
`rooms.ts`, `src/world/BankSession.ts`, `tests/systems/BuildingSystem.test.ts`.

**Ask the user first:**

1. How the house becomes yours: standing empty from the start with your name on it, bought for
   coin, or a quest from the quartermaster, the Company granting the plot?
2. Can a trophy on a stand be taken back and used (the plan's question), or is displaying it
   spending it?
3. The chest: a second bank whose slots are bought, or a fixed small store?
4. Working stations in the house (the plan's question), now or left to F2's workbench?

**Answered (2026-10-01):** granted by a quest from the quartermaster after the starter arc, the
Company's plot; a stand hands a trophy back on a tap, displaying is not spending; the chest is a
fixed small store, the bank still the vault, and F2 may grow it; no station in F1, F2's workbench
is the first.

**Do:** a `house` building in Lampton's text and `BUILDINGS`, drawn by the kit; its room furnished
from `art/rooms.ts` with stands and a wall that block nothing (decision 48), the stands tappable (a
new kind in the picking priority, swept), with a context menu and a card; what is displayed and what
is in the chest kept on the character (a save version at the merge); trophies as boss drops, quest
keepsakes (if quests are to hand any out, a row on the quest and an item kind the shelf never sells)
and achievement plaques derived from kills; `ItemUseSystem` learns "Display at home". A
`HouseSession` or a collaborator of its own for standing in it.

**Keep true:** Lampton's spawns, buildings and wander discs still pass the sweeps, so expect to move
something; nothing in a room blocks; the derived-state split (only the choice of what stands where
is stored). **Tests:** `tests/world/house.test.ts`; `BuildingSystem.test.ts` and
`tests/art/rooms.test.ts` by construction. **Docs:** `buildings.md`, `economy.md`, `zones.md`'s
Lampton, `places.md`. **Smoke:** a `house` section: walk in, display, the cutaway, the canvas count.

### G1 — The shape of 9-20 (`claude/v2-g1-shape`)

**Read:** decisions 9, 10, 84, 122 and C11's; `docs/lore/history.md` ("The climb to 20"),
`places.md` ("Past level 8"), `factions.md`, `spirit.md`'s Part G rows, `peoples.md`'s class
origins; `docs/architecture/combat.md` (the cap, difficulty), `zones.md`, `making.md`'s tiers;
C11's measurement in the plan.

**Ask the user first (the interview):** how many bands and at what levels; which of the lore's seven
regions become zones and how many zones each; gear and making tiers per band and what makes them;
the bosses and what their drops are for (the house's stands); whether travel comes back now that the
world is past ten zones (decision 122 asks again here); what the specialisations are, two a class,
from the hooks in `peoples.md`; whether the player can argue with Wick at the end (`spirit.md` leaves
it here); the order the zones are built in.

**Do:** write Part G into `docs/v2_plan.md` as phases, each sized from C11's number with the
new-content caution, each with its zone's level, exits and mouths (so two zone agents never argue an
edge), its creatures, its tier, its boss, its secrets and rumours, and the id names it will take, so
the zone agents can run beside each other; a brief for a zone agent in the shape of the ones here;
the decision. Extend the lore where the interview needed a fact it lacked, and say which parts
moved.

**Touches:** docs only. The tiers agent and the zone agents build from it.

### D2 — Whispers of the Realm (`claude/v2-d2-whispers`)

**Read:** decisions 14, 87, 117 and D1's; `docs/lore/places.md` (every zone's Rumours), `history.md`
(what a fragment may say, never more); `docs/architecture/content.md`, `hud.md`'s tabs and menu;
`src/data/secrets.ts`, `dialog.ts` (D1's), `src/world/SecretFinder.ts`, `src/ui/tabs.ts`.

**Ask the user first:**

1. Rumours only for what exists (the fifteen secrets, the caches, the two bosses), the rest held in
   the lore until Part G builds what they lead to? The dead-end rule says yes; the user may want a
   rumour that cannot yet be followed as a promise.
2. Where a lore fragment is found: a secret, a boss, a line of dialog, or all three?
3. Does the journal count toward anything beyond its own counts (F3's log reads it)?

**Do:** `data/rumours.ts` (a rumour: who tells it, the line, what it leads to) and
`data/loreFragments.ts` (a fragment: a paragraph of `history.md`'s voice, where it is found);
heard and found kept on the character (a save version at the merge); rumours delivered as
`effects` on D1's dialog lines, fragments on a secret found, a boss killed or a line; the journal
behind Menu as **Whispers** (`tabs.ts`, a mark in `art/icons.ts`), rumours with their lead and
whether it was followed, fragments with counts, in the HUD's art.

**Keep true:** what is found is stored, what it means is derived; a rumour's lead names something
that exists (a test, as `deadEnds` is). **Tests:** `tests/systems/WhispersSystem.test.ts`, the
sheet in `Hud.test.ts`. **Docs:** `content.md`, `hud.md`, `places.md` marking which rumours are in.
**Smoke:** a `whispers` section opening the journal.

### D3 — Factions and reputation (`claude/v2-d3-factions`)

**Read:** decisions 87, 89, 114 and D1's; `docs/lore/factions.md` whole (its last section is the
question list), `naming.md` (ranks in each faction's own words); `docs/architecture/content.md`
(the tallies, quests, bounties), `economy.md`'s shelf (`requires`); `src/systems/AchievementSystem.ts`,
`QuestSystem.ts`, `BountySystem.ts`, `ShopSystem.ts`, `src/world/ZoneWorld.ts`'s `resolveKill`.

**Ask the user first:** `factions.md`'s four: whether the Company and the Keepers are zero-sum; what
the upper chain's ten raiders cost with the Keepers and whether Orlath earns it back; the three
factions with standing before 9 (the Company, the Keepers, Greyford) with the Court and Karn Tholl
met once each; and where standing shows, a block on the character sheet with ranks on Feats, or a
seat of its own.

**Do:** `data/factions.ts` and a `FactionId`; standing as a fourth stored tally on the character (a
save version at the merge; `CLAUDE.md`'s "only three tallies are stored" gains one, with the reason:
a deed leaves nothing behind); moved in `turnInQuest`, `resolveKill` (a raider down moves two
factions), the bounty payout and D1's `effects`; ranks derived on read, in each faction's words,
paying titles (`TitleId` grows); `requires` on a shelf row, a quest and a dialog line may name a
standing; the HUD surface the user chose.

**Keep true:** ranks, titles and what is open are derived; a locked row says what it Needs. **Tests:**
`tests/systems/FactionSystem.test.ts`; `tests/world/` for a kill and a turn-in moving standing; the
progression test if the chain's cost changes what a level 8 can buy. **Docs:** `content.md`,
`economy.md`, `CLAUDE.md`'s tally rule, `factions.md`'s last section answered.

### E3 — What idle uses (`claude/v2-e3-idle-potions`)

**Read:** decisions 96 and E2's; `docs/architecture/afk.md`; `src/systems/IdleFoodSystem.ts`,
`IdlePlanSystem.ts`, `AfkSystem.ts`, `OfflineAfkSystem.ts`, `src/hud/IdleSheet.ts`.

**Ask the user first:** does a closed game drink (a potion's minutes against eight hours), or only
idle with the game open? Does idle drink on a timer, when the last wears off, or once at the start?

**Do:** `IdleFoodSystem` becomes idle's consumables, food and potions in one order with Keep; the
camp drinks as the user chose; the parked payout applies what a night could drink if it drinks; the
panel orders them and says what the night will do with them, derived.

**Keep true:** the panel never promises what the payout does not pay (`IdlePlanSystem.test.ts`
sweeps for it). **Tests:** the idle food tests grow; `OfflineAfkSystem.test.ts`. **Docs:** `afk.md`.

### F2 — A house that grows (`claude/v2-f2-house-grows`)

**Read:** decisions 88 and F1's; `docs/architecture/buildings.md`, `economy.md` (coin sinks, the
bank's slots as the shape of a bought thing), `making.md`'s stations and `STATION_PERSISTS`;
`tests/world/pace.ts` reports coin a level, which prices this.

**Ask the user first:** how a house grows in a zone written as text, where a building is a block
exactly its footprint: drawn at its final footprint with rooms shut until bought, or a second,
larger block the row switches to? Which upgrades: rooms, stands, a garden (E2's herbs, a node of
the player's), a workbench (a station of the player's that persists)? Priced how far: a long goal
should take most of the climb's coin, which the bot reports.

**Do:** upgrades as rows with prices and what each opens, bought at home, kept on the character (a
save version at the merge); the room's furniture and the kit read the stage; a garden node and a
workbench station if chosen, each the thing it is everywhere else (a node spawns and regrows, a
station persists for the parked payout).

**Keep true:** the sweeps on Lampton at every stage; coin prices held by a test against what the
pacer reports. **Tests:** `house.test.ts` grows; a pricing test. **Docs:** `buildings.md`, `economy.md`.

### F3 — Collection log and bestiary (`claude/v2-f3-collection`)

**Read:** decisions 88, 89, 90 and D2's; `docs/architecture/content.md` (the stored tallies);
`src/systems/AchievementSystem.ts`, `ItemUseSystem.ts` (its note on sources being this phase's),
`src/hud/FeatsSheet.ts`, `src/data/lootTables.ts`, `resourceNodes.ts`.

**Ask the user first:** a seat of its own behind Menu, **Collection**, or the Feats sheet growing
pages (Feats, Bestiary, Collection)? Drops seen is a new stored tally (a drop seen leaves nothing to
count), so `CLAUDE.md`'s rule gains another: say so.

**Do:** the bestiary per creature (slain off kills, drops seen off the new tally, lore off D2,
trophies off achievements) with completion counts; the log of items collected; the item card learns
"Comes from: …" derived from `LOOT_TABLES` and `RESOURCE_NODES`; the surface the user chose.

**Keep true:** everything but the two tallies is derived. **Tests:** `CollectionSystem.test.ts`;
`ItemUseSystem.test.ts` for sources. **Docs:** `content.md`, `hud.md`.

### G2 — Specialisations at 10 (`claude/v2-g2-paths`)

**Read:** decisions 67, 84 and 125; `docs/architecture/combat.md` whole; `docs/lore/peoples.md`'s
class origins; `src/data/abilities.ts`, `src/systems/AbilitySystem.ts`, `TrainerSystem.ts`,
`tests/systems/EnemySystem.test.ts` (the duels), `tests/world/pace.ts`.

**Needs first:** G4 (Lorhal's 10s in `main`). G1 named the paths, two a class (`v2_plan.md`'s
"The shape"). **Ask the user first:** what is left is how one is chosen (the trainer at 10, a
question asked once, or a quest), whether it can be changed, and what a path's abilities replace on
a bar that stays four (a rank in the slot of the one below, decision 67, is the shape).

**Do:** the paths' abilities (rows, `AbilityId`s, icons, effect sprites where a new moment needs
one), the choice kept on the character (a save version at the merge), the trainer offering a path's
lessons, the duels holding each path, the pace bot playing each path through its levels.

**Keep true:** the cap is derived from content and the pace holds every level, so this lands after a
level-10 spawn exists. **Tests:** the duels and pace grow by six paths. **Docs:** `combat.md`.

### G3, G8, G14 — The tiers (`claude/v2-g3-tier-one`, `claude/v2-g8-tier-two`, `claude/v2-g14-tier-three`)

One a band, each before its band's zones (decision 125). The plan's "The shape" table names every
material, its ids and its recipe levels; the band's zone entries say where each is gathered.

**Read:** G1's entries and decision 125; `docs/architecture/making.md` whole (the tiers' webs, the
fenhide rule, the arrow line, dead ends), `art.md`'s wardrobe and icons, `combat.md`'s armour;
`src/art/wardrobe.ts`, `src/data/items.ts`, `recipes.ts`, `outfitter.ts`, `src/config/constants.ts`,
`tests/systems/deadEnds.test.ts`, `deepCut.test.ts` and `greyfordTannery.test.ts` (how a tier is
traced across zones), `tests/systems/EnemySystem.test.ts`.

**Ask the user first:** what a piece of the tier gives over the one below (a fixed step, or the
step the band's creatures need, which the duels measure); whether the outfitter's barter takes the
tier's materials; and for G8, whether the deep forge stands in Karn Tholl's gate hall alone or a
second in Greyford's yard.

**Do:** every row in the band's line of the table: the raw materials as items with nothing yet
yielding them, the intermediates, the plate, the leather, the tools, the arrows' halves and the
arrows, the food and its burnt; the recipes at the levels named, at the stations that exist (G8 adds
the deep forge as a station drawn in the phase, a `StationId`, a `art/places.ts` row and a
`STATION_PERSISTS` answer); wardrobe drawings and icons for every piece; G3 raises
`MAX_GATHER_SKILL_LEVEL` to 20. The zone phases add the nodes and the drops.

**Keep true:** `deadEnds.test.ts` objects to a material nothing consumes, so a tier lands whole;
every item has a wardrobe row or an icon; the leather stops short of the plate a smith of the same
standing makes; nothing drops a tier piece yet, so the pace and the cap are unmoved. **Tests:** a
`tests/systems/<tier>.test.ts` tracing each piece back to the band's zones by name, as
`deepCut.test.ts` does; the duels with a geared character at the band's levels. **Docs:**
`making.md`'s tiers, `art.md`.

### A zone of Part G (G4-G7, G9-G12, G15, G16)

One agent a zone, on a branch named for it: `claude/v2-g4-lorhal`, `claude/v2-g5-stillwood`,
`claude/v2-g6-quiet-court`, `claude/v2-g7-karn-tholl`, `claude/v2-g9-high-greyhills`,
`claude/v2-g10-ashen-hollow`, `claude/v2-g11-drowned-halls`, `claude/v2-g12-barrow-field`,
`claude/v2-g15-sea-wall`, `claude/v2-g16-marhal`. **The same agent takes G5 then G6, G9 then G10,
and G15 then G16**, since each pair shares an edge; the rest of a band runs beside them.

**Needs first:** the band's tier in `main` (G3, G8 or G14); D1 (dialog), D2 (rumours), D3
(standing), D4 (Wick's beats) and F1 (trophies), since a zone writes rows into each; and for a
zone entered through another Part G zone, that zone (G6 after G5, G10 after G9, G11 after G7, G12
after G4, G16 after G15).

**Read:** the zone's entry in the plan's Part G and "The shape" above it; decisions 9, 11, 86,
108, 113, 116, 117, 119-122 and 125; `docs/lore/places.md`'s entry for the zone, `spirit.md`'s
beat for it, `factions.md` for its faction, `tone.md` and `naming.md`; `docs/architecture/zones.md`,
`combat.md` (bosses, difficulty, pacing), `content.md` (loot rules, quests), `art.md` (cast, places,
budget); the nearest rebuilt zone's map and its tests as the pattern (the fen for Lorhal and the
Barrow Field, the mill road for the Stillwood and the Greyhills, the Deep Cut for Karn Tholl and the
Drowned Halls, the barrow for the Ashen Hollow and Marhal, the strand for the Sea-Wall); and
`tests/world/pace.ts`.

**Ask the user first:** only what the zone's entry leaves open and is mechanics: a hub's counter
(what it trades and what standing opens there); a boss's fight (what its ability is, and whether it
is gated on gear as the chief is or on standing in a telegraph as Orlath is); and anything the
sweeps force that changes the zone's shape. The words, names, rumours and secrets are the lore's,
and not asked.

**Do:** the shape of a C5-C9 phase with new content. The zone's text in its own `*Map.ts` at 45×32;
its `ZONES` row with the setting, the exits and the mouths the plan fixed, and the exit row on the
neighbour's, re-cutting the neighbour's mouth in a commit of its own (or laying the ground of a
mouth the later neighbour will write, as G4 and G7 do); a key's lock (`requiresKey`) and the key
where the plan says it comes from. Its creatures as `ENEMIES` rows priced against the curve (the fen
raider's and the wight's "a zone above the last one" rule in `combat.md`), loot tables under the
humanoid rule carrying the band's food, `cast.ts` getups or a new shape drawn in the phase; its
nodes for the band's materials; its boss with `boss: true`, its unique piece (a wardrobe row and an
icon) and its trophy in F1's kind; two secrets (`places.md` first, then `secrets.ts`,
`art/places.ts`, the text); its quests and its contract, if the zone has a counter or a quest-giver;
its rumours through D2, its standing through D3, its people's topics through D1 and Wick's beat
through D4, all as rows. Name every new name in `naming.md`, and extend `places.md` where building
the zone needed a fact it lacked.

**Keep true:** the spawn, building, picking, way-home and secret sweeps are the gate, as they were
for every rebuild; every level the zone covers is held by `pace.test.ts` in the band's tier, n + 4
minutes; the cap moves by itself (`progression.test.ts` says the new number, and the zone writes it
into `MAX_CHARACTER_LEVEL`); `uniqueLoot.test.ts` holds the boss's piece; `deadEnds.test.ts` holds
every drop; the camp never picks the boss; nothing in a hub blocks a counter. **Tests:** a
`tests/systems/<zone>.test.ts` for what the zone is for (knots, the depth dial, a king waking after
the one before), a `tests/world/` case for its lock or its hub if it has one, and the sweeps by
construction. **Docs:** `zones.md`'s paragraph for the zone and the world in brief, `combat.md` if
a boss does something new, `making.md` for the nodes, `places.md` marking what is in. **Smoke:** the
zone in the `zones` round trip with the canvas count flat; a section of its own only for something
only a browser can show.

### G13 — The carters (`claude/v2-g13-carters`)

**Read:** decisions 25, 122 and 125; `docs/architecture/zones.md` ("Walking is the only way into a
zone"), `economy.md` (counters, coin sinks), `content.md` (the zone visits tally);
`src/world/ZoneWorld.ts`'s zone change, `GameContext`, `src/systems/ZoneAccessSystem.ts`,
`tests/world/pace.ts`'s coin a level.

**Ask the user first:** the price (flat a hop, by distance on the grid, or by the level of the hub
travelled to); whether the house in Lampton is always a stop; whether a locked zone's hub counts
before its key is spent.

**Do:** a `'travel'` counter at each hub's row (the carter in Lampton and Greyford, a punt at
Lorhal, the hold's lift at Karn Tholl, a guide at the Quiet Court, and the Sea-Wall's tower when
G15 lands), a panel listing the hubs reached and their prices, reached derived from the zone visits
tally, the journey a zone change that arrives at the hub's start.

**Keep true:** walking is still the only way into a zone the first time; travel never opens a lock;
the price is held by a test against what the pacer reports. **Tests:** `tests/world/travel.test.ts`.
**Docs:** `zones.md`, `economy.md`, `hud.md`. **Smoke:** a `travel` section, the canvas count flat.

### D5, E4, F4 — the reviews

As A10 and B9: walk the part against the pillars and the user's original list at a portrait phone
and a desktop through smoke's screenshots; ask the user what feels wrong after playing it; mend in
place what is small; amend the part's entries, and propose rather than apply anything touching a
part another agent is on (rule 6). If all three run as one, one PR records three entries and says why.

### H1 and H2

H1 walks the original list and every pillar once more, with the whole game to walk, and fixes what
is still unclear. H2 moves `docs/v2_plan.md` and this document to `docs/archive/` with a row each in
its README, and brings `CLAUDE.md` to the game as it stands: the roster to level 20, the parts of
the shape that moved, and nothing that says "wait for" anything.

---

## What this does not change

- The plan's phases, their content and their order within a part. This only says which may run
  beside which.
- The user's role. Every mechanics fork is still theirs, every PR is still judged by them, and the
  cadence is still set by how fast they can answer and play.
- The lore's ownership (decision 114), the pace (decision 122), and every rule in `CLAUDE.md`: a
  phase worked in parallel is held to all of them, and the sweeps and simulations are what make five
  branches safe to merge one after another.
