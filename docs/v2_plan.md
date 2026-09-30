# Version 2: a solo zero-to-hero, drawn, with people in it

**Status:** live. Opened 2026-09-27 against `ca12279`, the merge of act three. **Landed: phase 0**
(this document, decisions 80-88, `CLAUDE.md` pointing here), **A1** (every number labelled, every
slayer rank a title, mastery explained, map names over the markers; decision 89), **A2** (every
item says what it is for, on a tap and on a card any item row opens; decision 90), **A3** (the
shop and the bank in two sides, contracts marked repeatable, Abandon apart and asking twice;
decision 91), **A4** (a tap on a person talks first: a greeting, their counter as a button, their
quests; decision 92), **A5** (the skills book: a page per skill, every node and recipe with its
mastery beside it, the mastery page gone; decision 93), **A6** (the training bar: the skill last
trained, in the player column, following what you do and fading half a minute after; decision 94)
**A7** (Idle: a panel that says what idle will do and starts and stops it, the food order and
Keep the player sets, the away report in the panel's words; decision 96), **A8** (the save out
as a file or a code and back, in Options and on the creation screen, with a preview and a second
tap before it replaces anybody; decision 97), **A9** (twelve tips in the spirit's voice, each heard
once per character, on a card that waits for a tap; decision 98), **A10** (the Part A review:
four leftovers mended in place, a grind pass added to Part C as C10, Part B kept next; decision 99)
**B1** (the style guide, sprites as data in `src/art/` held to a palette and a fixed animation
budget, and the renderer spike, which chose Canvas 2D; decisions 100 and 101), **B2** (the
checkpoint slice: town in pixel art behind `?renderer=2d`, with edges between grounds, the warrior,
the shopkeeper, the rat and a building kit drawn for real; decision 102; redrawn heroic and
weathered after the user's first look found it "farmvilley", decision 103; after their second, which
kept the style, a figure whose arms hold what it carries, the wizard and the ranger, an armour
lookbook, and a town that says what each place is, decision 104; and after their third, plain
starting outfits with the grand looks kept as armour for later, a hat and a hood both, and a figure
cleaned up into one silhouette, decision 105; the user then asked for B3, which closed the
checkpoint with the art source standing), **and B3** (every zone drawn: an edge wherever two grounds
meet, rock standing up with its face in its own cell, irregular flagstones, variants for sand,
stone, rock and marsh, scatter baked into the ground, and the lantern underground; **2D the game**, 3D behind
`?renderer=3d` until B7; decision 106). **Next: B4**, people. Update this line as each phase lands:
which phase, and which is next.

This plan came out of an interview on 2026-09-27. The user brought a list of what was unclear or
missing after playing act three, and five rounds of questions settled the forks under it. Every
answer that closed off a real alternative is a decision (80-88); the table below is the summary.

---

## What version 2 is

The game stops being an MMO in waiting and becomes a **solo zero-to-hero**: power up, beat bigger
things, collect. **More fun and less grindy, but still a time sink.** It is **drawn**, in 2D pixel
art, it is **bigger**, it has **people and a history in it**, you have **a house to fill**, and it
goes **to level 20**.

### What the interview settled

| Question                                     | Answer                                                                               | Decision |
| -------------------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| Multiplayer?                                 | **No.** A solo experience from here on.                                              | 80       |
| Where does detail come from?                 | **Pixel art drawn by Claude as data**, compiled to textures at boot. Still no files. | 81       |
| 2D or 3D, and which view?                    | **2D, top-down 3/4** (Link to the Past, Stardew, classic RuneScape).                 | 81       |
| Do old characters survive?                   | **No: a fresh start.** Old saves retire when the rebuilt world lands.                | 82       |
| What does production show meanwhile?         | **Work in progress**, each phase live as it merges.                                  | 83       |
| New progression?                             | **Cap to 20**, with a **specialisation at level 10**: two paths a class.             | 84       |
| What is "camp" called?                       | **Idle.**                                                                            | 85       |
| How do active and idle play feed each other? | **Both ways**: idle banks a rested bonus for active; active brews potions for idle.  | 85       |
| How big is a zone?                           | **About 3× the area** (roughly 45×32 tiles, from 25×19).                             | 86       |
| Extras?                                      | **Minimap, smarter creatures (they path), collection log + bestiary, save export.**  | 86, 88   |
| What does the skills book show?              | **Every recipe**, the locked ones greyed, with level, inputs, result and stats.      | 86       |
| Do dialog choices matter?                    | **Faction reputation**: choices and deeds move your standing.                        | 87       |
| "Whispers of the Realm"?                     | **One journal of rumours and lore**: rumours are leads, lore is what you learn.      | 87       |
| The helper?                                  | **A spirit that floats beside you and is a character** in the story.                 | 87       |
| Tone?                                        | **All of it, blended the RuneScape way** (below).                                    | 87       |
| Housing?                                     | **A house that grows**: walk in, display trophies, buy upgrades.                     | 88       |
| What is the release called?                  | **Version 2.**                                                                       | —        |

### Pillars

Every phase is argued against these. When a choice is close, the pillar decides it.

1. **Clear, not hand-holding.** Every number says what it counts, every item says what it is for,
   every system explains itself once. Nothing is explained twice unless asked.
2. **Zero to hero.** The player should feel the climb: harder things beaten, better things worn,
   more of the world opened. Solo, so nothing waits on anyone else.
3. **A time sink that is fun.** Long goals (collections, the house, reputation, mastery) rather than
   longer grinds. Tune curves down before adding systems up.
4. **Magic feels magical.** Elves, dwarves and stranger things are present in the world and rare
   enough to be an event when met.
5. **Cheeky, not constant.** RuneScape's humour: an earnest world whose people are sometimes funny,
   with real stakes underneath. A joke in every line is no joke at all.
6. **Active and idle each have a reason.** Neither mode is the right answer on its own.

### What the code already answers

Found during the interview. Most of the user's list is **clarity**, not missing features, which is
why Part A exists and comes first.

- "0/96" on the character sheet is a **skill's XP toward its next level**, unlabelled
  (`CharacterSheet.ts`). "0/88" in the bag is **weight against carrying capacity**; the word
  "weight" appears nowhere (`InventorySheet.ts`). The coin in the bag's corner is **the player's
  money**, put in the header with no label.
- **Rat meat is not junk**: it cooks into Cooked Rat at a campfire. Nothing says so.
- **Idle can cook and craft** at a fire or bench, and **with two foods it eats the weakest first**
  (`chooseAfkFood`). Neither is said anywhere.
- **There are no potions.** The only consumables are cooked foods.
- **The mastery page explains nothing** (`MasterySheet.ts`).
- The quarry's grey rectangle is an ore vein or the raised rock face, which is the art problem.

---

## How this plan is worked

- **One PR per phase**, merged with a merge commit, commits separable inside it. Phases are sized
  to fit a session with room to spare: when one grows past about 30 files, split it and record the
  split here, or say in its entry why it stayed whole. A4 (40 files) and A7 (45) went past it
  without a word, and each fitted its session; the count takes in the tests and the docs every
  phase corrects, so it is a prompt to look rather than a wall (decision 99).
- **Every part ends in a review phase.** It re-reads what landed against the pillars and the
  user's original list, asks the user what feels wrong, and **amends the rest of this plan** before
  the next part starts: phases added, cut, reordered. This plan is expected to change.
- **Each phase**: update the status line, append to `docs/decisions.md` for any fork, correct the
  `docs/architecture/` file for what moved. Part of the phase, not paperwork after it.
- **Open questions are asked when their phase starts**, not before. Each phase lists its own.
- **Production shows work in progress** (decision 83). Every merge deploys, so every phase must
  leave the game playable, even where it is half-converted. Nothing but a merge deploys.
- **CI and deploys are metered** (decision 95): 2,000 Actions minutes a month, and 100 Vercel
  deployments a day. A phase is pushed once its gates pass locally, not commit by commit, and its
  PR opened when it is done; a draft runs the gates alone, and marking it ready runs smoke.
- **Saves**: normal migrations until **C1**, which starts the version 2 save era and retires every
  older save (decision 82). From C1 on, migrations are normal again, so a test character survives
  the rest of the release.

### Starting cold

1. `CLAUDE.md` loads by itself. Read this plan's status line, the phase to be built, its part's
   introduction, and decisions 80-88.
2. `git log --oneline -15`, the one record that cannot be out of date.
3. Read the `docs/architecture/` file for every subsystem the phase touches.
4. Ask the phase's open questions before writing code.
5. Gates before the PR: `lint`, `format:check`, `typecheck`, `test`, `build`, and `smoke` with
   `npm run dev` running. A throttled-budget failure in a dev container is checked against
   unchanged `main` in the same session before it is believed (decision 50).

---

## Phase 0 — this plan

This document, decisions 80-88, and `CLAUDE.md` pointing at it as the live plan, with the solo
direction replacing `initial_design.txt`'s multiplayer as the long-term vision. Docs only.

---

## Part A — Say what things are

All HUD and data. The HUD is HTML and engine-free, so nothing here is thrown away when the renderer
changes in Part B. Each phase ends with the thing it fixes explained **once, in place**.

- **A1 — Label every number. (Landed.)** Every number carries its unit in a word or two: skill rows
  read `Lv 3 · 40 / 96 XP`, the bag `Weight 12 / 88`, a station's input `Iron Ore ×2 (3 in bag)`,
  stats in full. The player's money is one labelled element, **Coins**, in every panel that shows
  it. **Every slayer rank is a title** (Culler, Hunter, Slayer), and an earned rank's row wears it.
  The mastery page says what mastery is and what its ranks pay, from the rank table. The **map
  sheet** draws building names over the markers. Decision 89 has the forks.
- **A2 — Items say what they are for. (Landed.)** Every item's uses are derived from the tables
  that name it (`systems/ItemUseSystem.ts`): "Cook at a campfire → Cooked Rat", "Used in: …, at the
  Forge (Town)", the quest and contract that want it, the outfitter's and the fettler's trades, the
  door a key opens, "Camping eats this when hurt, weakest food first", "Made from: …" and "Sells
  for …"; burnt food says nothing uses it. The bag's strip lists them **on a tap**, and a held
  finger or a right click on **any item row** (shop, bank, station, picker, counters, worn slots,
  drop lists) opens the full card. Decision 90 has the forks.
- **A3 — Counters that read clearly. (Landed.)** The shop draws **their stock** and **your bag**
  as two framed sides that scroll on their own (`hud/counterSides.ts`), headed "tap to buy" and
  "tap to sell", and the bank does the same with the vault; `counterLayout` in `ui/layout.ts`
  stands them **across** where two fit (a landscape phone, a desktop) and **one over the other**
  on a portrait phone, both in view. A bag stack is priced "each". The board is **Contracts**,
  says once at its top that a contract is posted again the moment it is paid, as often as you
  like, one at a time, and tags every contract **Repeatable** there and in the quest log. **Abandon
  is its own button under the contract in hand**, a gap below the row that hands it in, and **asks
  twice** the way Reset Character does. Every counter stops above the tab bar and scrolls instead.
  Decision 91 has the forks.
- **A4 — Talk first. (Landed.)** A tap on a person walks up and opens a **talk panel** where the
  counters hang: their name, a one-line greeting (naming no place or person, for D1 to rewrite), a
  button for the counter they work with a line saying what it is for, and **their quests**, which
  left the counters for it. The button puts the counter up in its place and every counter's head
  has a **Back**; a right click or a held finger offers Talk and the counter, and the counter there
  goes straight to it. Talking is a seventh counter (`CounterId` `'talk'`), so everything that shuts
  a counter shuts it. This is the shell Part D's dialog fills. Decision 92 has the forks.
- **A5 — The skills book. (Landed.)** **Skills** takes Mastery's seat in the menu and opens on an
  index of every skill; a tap, or a tap on the skill's row on the character sheet, turns to its
  page: level and XP bar, how it trains, what a level buys at yours and at the most, and **every
  node and recipe** in level order with its inputs, result, the result's stats, XP and where it
  is (a node's zones, a station's zone), locked ones greyed and naming their level. Each pool sits
  beside its row, the mastery page is gone, and the six combat skills get pages that say what they
  buy. Everything is derived (`systems/SkillBookSystem.ts`) from the tables and the functions the
  rolls call. Decision 93 has the forks.
- **A6 — Show what is training. (Landed.)** The skill last trained is **one more bar in the player
  column**, under the XP bar with its numbers inside it (`Woodcutting Lv 3 · 40 / 96 XP`), in the
  same place on a landscape phone as everywhere else. It follows **what the player does** (a
  gather, a make, the weapon or spell skill a swing or a cast trains) and never Block or Parry,
  which train on what is swung at you. It **fades half a minute** after the last XP into its skill,
  on a timer of the HUD's own (`hud/TrainingBar.ts`), and a **tap** opens that skill's page in the
  skills book. Where the tallest column would meet the quest tracker on a landscape phone, the
  tracker steps right of it. Decision 94 has the forks.
- **A7 — Idle. (Landed.)** "Camp" is **Idle** in every player-facing string, the item card's food
  line among them ("Idle eats this when hurt, in the order set on the Idle tab"). The Idle tab
  opens **the idle panel** (`hud/IdleSheet.ts`), which says what idle will do before its own
  button starts it and what it is doing while it runs, with Stop: the job, what it pays against
  doing it by hand, the food in the order it is eaten, the arrows a bow spends, and what a closed
  game pays and at most. It is derived (`systems/IdlePlanSystem.ts`) from `afkCampJob` and from
  `offlineJob`, which the payout now branches on too. **The player sets the food order and marks
  food Keep** (`CharacterState.idleFood`, save version 25). The away report names the creature,
  the hours that count and the ceiling when a night reached it. Decision 96 has the forks.
- **A8 — Save export and import. (Landed.)** Options has **Download Save** (indented JSON, named
  for the character, their level and the day), **Copy Save Code** (the same JSON in base64, shown
  as well as copied) and **Load a Save**, which the creation screen offers too, so a new device
  loads without making a character first. Loading reads a file or a pasted code through the same
  migration chain a stored save takes and **checks every field** (`persistence/saveFile.ts`),
  saying which one is wrong; a hand-edited but well-formed save loads. A **preview** puts the
  character in the save beside the one playing now, and **Replace asks twice**. A parked night is
  never carried in. Decision 97 has the forks.
- **A9 — Tips. (Landed.)** Twelve tips (`systems/TipSystem.ts`), each a rule over the character
  that answers its line or nothing, the line read off the tables it names: food when hurt, the
  first death and what it cost, a full pack, raw food, going idle, the first contract, a first tool
  and a first material, holding a finger on anything, the first level and its lesson, the first
  title, the first mastery rank. The world offers one at a time (`world/TipDesk.ts`), quiet for the
  first seconds of a zone and for forty after each, so a character from before A9 hears each as it
  comes. The HUD shows it as a **card that waits for a tap** (`hud/TipCard.ts`) with **Got it**
  and **No more tips**, at the top between the corners or under them on a portrait phone, hidden
  while an overlay (or a sheet on a phone) covers the playfield; Options has the switch back. What
  was heard and whether tips are off is **kept on the character** (`CharacterState.tips`, save
  version 26). Until the spirit is drawn in D4 the card is its voice. Decision 98 has the forks.
- **A10 — Part A review. (Landed.)** Walked A1-A9 against the pillars and the user's first list,
  through smoke's screenshots at a portrait phone and a desktop. Every item on the list had landed,
  and the two that had not were never Part A's: the quarry's grey rectangle is art (B6), and potions
  are E2. What it found was Part A's promise kept in most places and not all, and it **mended four
  leftovers in place**: a creature's level reads `Rat (Lv 1)` on its nameplate and menu, and a
  locked row says what it **Needs** on every counter and station; a stat is named in full wherever
  an item is described (`+3 Armour, +1 Health`), off one table (`BONUS_NAMES`), and the character
  sheet shows **Armour** with the share of a hit it stops; a panel is called what its tab calls it
  (Bag, Feats), and Reset arms as "Tap again to reset"; a rank on the Feats sheet is one line. It
  **amended the plan**: pillar 3 had no phase keeping it, so a grind pass goes after the rebuilt
  zones (C10, Part C's review moving to C11); **Part B stays next**, since its checkpoint is the
  plan's largest risk; and the phase-size rule above says what to do when a phase outgrows it.
  Decision 99 has the forks.

**Open questions for Part A**: none left. A1 answered the first (mastery folds into the skills book,
and its own page goes, decision 89), A6 where the training bar sits on a landscape phone (in the
player column, as on every screen, decision 94), and A7 whether the player chooses idle's food
order (yes: an order and a Keep mark, set on the idle panel, decision 96).

---

## Part B — The look: 2D pixel art, drawn as data

The renderer changes from Three.js 3D to **2D top-down 3/4 pixel art**, which **Claude authors as
pixel data** in code and compiles to textures at boot (decision 81). The game still loads no image
files. The seam that let 2D Phaser become 3D Three.js is what lets this happen: `world/`, `systems/`,
`hud/` and `audio/` do not change for it.

**The known risk** is characters and animation, which hand-placed pixels do less well than tiles
and items. So **B2 is a checkpoint**: one zone and one character, judged by the user before
anything else is converted. If it does not hold up, the art source is re-decided there rather than
discovered at the end.

- **B1 — The style guide and the sprite format. (Landed.)** `docs/architecture/art.md` is the
  guide. **A tile is 32 art pixels**, drawn at art resolution and scaled up by the page in whole
  device pixels, about ten tiles across a phone. **Every colour is a step on a ramp** of five,
  hue-shifted and darkest first (`src/art/palette.ts`); the ground's ramps are coloured per setting
  (open warm and bright, marsh heavier, underground dark), everything that moves uses shared ones.
  The light is from the top-left, with a contact shadow and no cast ones, and **the compiler draws a
  selective outline** round people, beasts, props and icons. **The animation budget is fixed
  exactly** per kind (`src/art/budget.ts`), four facings for people and creatures, either side
  mirrored. A sprite is text (pixel grids naming palette steps, `src/art/format.ts`), compiled to an
  atlas per setting (`src/art/compile.ts`) with tier and creature variants by recolouring, and
  `tests/art/` holds every sprite to the palette, its size and its frame count. The seven terrain
  tiles and a placeholder for each kind are the first sprites. **The spike chose Canvas 2D**, the
  cheapest of three by every measure under smoke's throttle and no dependency, over Three.js with an
  orthographic camera and PixiJS. Decisions 100 (the user's four answers and the guide) and 101
  (the renderer) have the forks.
- **B2 — The checkpoint slice. (Landed; the user judges it.)** `?renderer=2d` draws the world with
  Canvas 2D (`src/render2d/`), in production as well, while the 3D view stays the default. **The
  host left `render3d/`** for `src/host/`, behind a `ZoneView` both views answer. **Edges between
  grounds are a rule over the two tiles** (`art/ground.ts`): the upper ground reaches into the lower
  one's cell by a depth that wanders with where it is in the map, and a table inks the rows either
  side (a bank's earth face on a north shore, foam on a south one, a grass lip over a road), never
  laying blocking ground over walkable. **The warrior** walks, swings, flinches and falls four ways,
  holding the sword on the far side facing left; **the shopkeeper** is the same figure in amber
  under an apron; **the rat** faces four ways too. **Every building is drawn from one kit** over its
  footprint (`art/building.ts`), the door where the collision has it and the roof lifting from
  inside; **the world's font** writes names, signs and damage numbers. The camera frames the
  player in the middle of the band above the tab bar at a whole-number scale and follows them to
  the map's edge; a tap is picked against flat boxes in the 3D view's priority, swept over every
  zone; the leak check counts canvases. Everything else is its kind's placeholder. It went past the
  thirty-file prompt, at about fifty with its tests and docs, and stayed whole because its parts
  are one thing to judge: art with no view is nothing to look at, and a view with no art is the
  placeholders B1 already had. Decision 102 has the forks. **The user's first look** found the
  direction right and the look too cute, "farmvilley" where the game wants epic adventure, and
  asked for World of Warcraft and the Lord of the Rings; the same phase redrew it (decision 103):
  a deep, earthy palette, people to heroic proportions with the warrior cloaked, a sewer rat,
  timber-framed buildings on stone, textured ground in variants, and a darker edge to the world.
  **The second look** kept the style and found the weapons held wrong, and asked to see armours, a
  wizard and a ranger, and a town easier to read; the same phase took one more pass (decision 104):
  **a figure kit** whose arms are parts in poses that each say where the hand is, so what is held is
  laid in the fist; **the wizard and the ranger** drawn on it and played, casting and shooting;
  **armour drawn once in the `tier` ramp** and recoloured per tier, as a lookbook B4 builds on;
  doorways drawn as rooms seen into, a trade sign by every door somebody works behind, roofs whose
  light falls away down the slope, and the signpost drawn.
  **The third look** liked the armour, and asked for a plainer start and a cleaner figure (decision
  105): each class now starts bare-headed in a tunic or robe of its colour, what they wore is armour
  for later in the lookbook (the wizard's under a hood or a hat, both kept), and the figure is one
  silhouette, a tunic tapering to a belted waist with the arms hanging against it.
- **B3 — Every zone drawable, and the switch. (Landed.)** **Every pair of grounds that meets in a
  zone has an edge**, nine rows beside B2's two and a test sweeping the maps for a pair without one:
  grass over sand, foam where the sea meets a beach, turf round the quarry, the mill pond's bank, the
  fen's sand and its pools' mud, a stone kerb over water. **Rock stands up inside its own cell**:
  since an edge never lays blocking ground over walkable, the floor reaches into the rock and the
  rock shows **a face** there, sixteen rows drawn from a tile of fractured rock, its crest lit and
  its foot in shadow. Stone is **irregular flagstones** rather than a bond that read as a brick wall,
  and sand, stone, rock and marsh have **variants** that keep their plain tile's border. **Scatter**
  is a sprite kind of its own (tufts, flowers, reeds, pebbles, shells), placed by a hash, baked into
  the ground, outlined so it shows on ground textured in its own ramp, and never where an edge is
  drawn or a building stands. **The lantern** is darkness stamped over the scene in dithered steps
  with a warm glow in the clear, never black. Anything not yet drawn is still its placeholder.
  **2D is the default**, and 3D is loaded only for `?renderer=3d`, kept until B7 deletes it rather
  than for one phase, since the code stays until then either way. Every smoke section runs in 2D;
  the drag checks ask a drag to turn nothing, and a `renderer-3d` section holds the fallback and
  the camera only it turns. Twenty-seven files with its tests and docs. Decision 106 has the
  forks.
- **B4 — People.** A layered figure for all three classes: body, armour by slot, weapon and offhand,
  tier colours by recolouring. Four directions, walk, attack, cast, shoot, hurt, death, within B1's
  budget. B2 already has the figure kit, all three classes and an armour lookbook (decision 104):
  what is left is putting a figure together from what the player has on, slot by slot, compiled when
  it changes, and each weapon drawn by the item it is.
- **B5 — Creatures and effects.** Every creature by shape and the bosses; telegraph rings, arrows,
  bolts, hits, crits, the level-up, the loot sack, floating text.
- **B6 — Places.** Nodes (and their depleted states), stations, signposts, buildings with interiors
  (the roof lifts when you are inside), counters.
- **B7 — Retire 3D.** Three.js and `render3d/` deleted; smoke's draw budget and memory checks
  rewritten for 2D; `rendering.md` rewritten.
- **B8 — The HUD's look.** A full UI pass to match the art: theme, panels, icons as pixel data, a
  type choice. Part A said what things are; this makes them look like one game.
- **B9 — Part B review.**

**Open questions for Part B**: none left. B1 answered all three: tiles are 32 pixels, the HUD keeps
a system font while the world gets a pixel font drawn as data, and every creature faces four ways
(decision 100).

---

## Part C — A bigger world

Zones grow to **about 3× the area** (decision 86). This is where old saves retire, since every
saved position stops meaning anything.

- **C1 — Big maps, and the version 2 save era.** A text format for authoring maps at this size (a
  legend of tiles and markers), per-zone dimensions, camera bounds. `CHARACTER_STATE_VERSION` jumps
  with no chain from before: **older saves retire** (decision 82).
- **C2 — The lore bible.** Before any zone is rebuilt: the realm's name and history, its peoples
  (humans, elves, dwarves and stranger things), its factions, its places, the tone with examples,
  the spirit's story, how things are named (`docs/lore/`). The user reviews it; rebuilt zones get
  their names, secrets and rumours from it.
- **C3 — Minimap.** You, nearby creatures, exits and points of interest, in a corner that keeps
  clear of everything `layout.ts` already reserves.
- **C4 — Smarter creatures.** Mobs path around walls and obstacles (reversing decision 26), with
  leashing reworked for the distances. The spawn-safety sweeps run over the new maps.
- **C5-C9 — Rebuild the ten zones at 3×**, two a phase: side paths, a secret or two, several
  activity spots each. Spawns, nodes and stations re-placed; the progression test re-held.
- **C10 — Less grind.** Pillar 3's promise, "tune curves down before adding systems up", which no
  phase kept until the Part A review added this one (decision 99). The curves are tuned against the
  rebuilt zones, since their longer walks between kills are what moves the pace, and before Parts
  D-G add anything up. Which levers move (the XP curves, what a kill or a gather pays, respawns) is
  this phase's to choose; what it holds is the progression tests measuring each arc **in minutes of
  play** rather than in kills.
- **C11 — Part C review**, which **measures how long a zone took to build**, the number Part G is
  sized from.

**Open questions for Part C**: how are secrets found (hidden paths, a tool, a rumour)? Do larger
zones need fast travel back, having taken it out once (decision in PR #111)? How many minutes should
a level take, early and near the cap (C10)?

---

## Part D — People and the realm

- **D1 — Dialog.** NPC conversations as data, in the talk panel A4 built: topics, answers that
  lead to more, and an NPC who remembers what you have asked (state for `TalkSession`). A writing
  pass over every existing NPC in the lore's voice, their greetings first.
- **D2 — Whispers of the Realm.** One journal of **rumours** (leads to a secret, a cache, a rare
  creature, a side quest) and **lore fragments** (from NPCs, books, ruins and bosses), with counts
  of what is found.
- **D3 — Factions and reputation.** Standing with each faction, moved by quests, kills, contracts and
  dialog choices; ranks that open stock, quests, dialog and titles (decision 87).
- **D4 — The spirit.** The helper drawn in the world: it follows you, glows or chimes when it has a
  tip, speaks in a bubble when tapped, can be told to go quiet, and has **a name and a story** that
  surfaces at new zones and bosses. It takes over A9's tips.
- **D5 — Part D review.**

**Open questions for Part D**: which factions, and can two be opposed (raising one lowers another)?
What does the spirit want?

---

## Part E — Idle, rested and brewed

Idle and active each get a reason (decision 85).

- **E1 — Rested.** Time spent idle or away banks a rested bonus that speeds up active XP, capped,
  and shown on the XP bar.
- **E2 — Potions.** A way to make them (a new making skill, and where its herbs come from, are this
  phase's questions), and potions brewed in active play that **boost idle gains** for a while: more
  XP, faster gathering. Some may help in a fight.
- **E3 — What idle uses.** Idle drinks the potions it is given. Potions join the rows A7's idle
  panel orders and keeps, so the player sets when idle drinks them the way they set its food.
- **E4 — Part E review.**

**Open questions for Part E**: alchemy fed by a new gathering skill, or by herbs from existing
nodes and drops? Does rested XP come only from idle, or from being away too?

---

## Part F — Home and collections

- **F1 — The house.** A building in town that is yours: walk in, set trophies on stands and a wall
  (boss drops, quest keepsakes, achievement plaques), keep things in a chest.
- **F2 — A house that grows.** Upgrades bought with coin: more rooms, more stands, a garden, a
  workbench. A long goal and a coin sink, priced by simulation like everything else.
- **F3 — Collection log and bestiary.** Creatures slain and the drops seen from each, lore found,
  trophies earned, each with completion counts; what is collected here is what the house displays.
  An item's card learns where the item comes from (what drops it, what node yields it), which A2
  left to this phase: A2's card says what a thing is for and what it is made from, not where it
  grows.
- **F4 — Part F review.**

**Open questions for Part F**: does the house hold only trophies, or also working stations? Can a
trophy be displayed and still used?

---

## Part G — To level 20

Sized at C11 from how long a zone actually took, not guessed now.

- **G1 — The shape of 9-20.** How many bands, zones, gear tiers, making tiers and bosses, written
  into this plan as phases.
- **G2 — Specialisations at 10.** Two paths for each class (decision 84), each with its own
  abilities and ranks; the bar stays four buttons. The duels hold each path to the curve.
- **G3 onward — The bands**, one zone or one system a phase: magical creatures, new gear and making
  tiers, bosses whose drops go on the house's stands, quests, rumours, faction content, contracts.
  The progression simulation is carried to 20 and the cap test moves with it.
- **Part G review.**

---

## Part H — Finish

- **H1 — The last pass.** Walk the user's original list and every pillar one more time; whatever
  is still unclear is fixed here.
- **H2 — Archive.** This plan to `docs/archive/`, `CLAUDE.md` updated to the game as it stands.

---

## What version 2 does not do

- **No multiplayer, and no groundwork for it** (decision 80). A server, accounts or trading between
  players would be a new decision.
- **No art or sound files.** Sprites are code compiled at boot (decision 81); sound stays
  synthesised (decision 54 still holds for it).
- **No keeping old saves** (decision 82).
- **No second renderer kept alive.** 3D goes in B7.
