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
`?renderer=3d` until B7; decision 106), **B4** (a person put together from what they chose and
what they wear, a slot dyed apiece; every weapon and offhand drawn as the item it is, the wands
renamed staves; a look chosen at creation, save version 27; the townsfolk drawn; decision 107),
**B5** (every creature drawn, the humanoids on the figure carrying what they drop, the bosses
grown to 48×64 and the goblins shrunk by refitting it; hits, crits, a level, fireballs, knives
and arrows, the telegraphs and the loot sack; decision 108), **and B6** (every place drawn: three
woods and their stumps, veins in the ore they yield, rings on the water, the forge, the tannery, the
fletcher's bench and the fire, chips off each stroke, and rooms furnished from one layout with a
counter in front of whoever works there; decision 109), **and B7** (3D deleted whole with Three.js,
the camera fixed facing north, a game that imports no package, the memory check counting canvases
and the draw budget brought down to 16ms, `rendering.md` the 2D view's; decision 110), **and B8**
(the HUD drawn in the world's art: iron and brass frames, the world's font on its headings compiled
into a font file, every item, ability, buff and tab a pixel icon, the world's figure on the
character sheet, and every colour a step on the art's ramps; decision 111), **and B9** (the Part B
review: nothing drawn over the room the player stands in, a crowd's names stacked, a big screen
seeing more of the world, the map's names one size, the player column backed, and Part C next as
planned; decision 112), **and C1** (every zone written as text, the start, creatures, nodes,
stations and buildings included and the townsfolk placed from where they work; a route that stands
off the middle of a cell to reach a room two tiles deep; version 2's saves counting from 100, a
version 1 character named once as they retire; the wizard's ids staffs; decision 113), **and C2** (the
lore bible in `docs/lore/`: the Veymarch, a drowned kingdom's frontier whose lanterns are going out,
its peoples, factions and places, the spirit who lit the light that drowned it, the tone and the
names; decision 114), **and C3** (the minimap: the zone map windowed round the player in the
top-right corner, the creatures near them in their names' colours, exits as arrows on its rim, a tap
opening the zone map, and a switch in Options kept on the character; decision 115), **and C4**
(smarter creatures: a chase routed round what is in the way and kept rather than re-made, the
player's pursuit on the same chase, noticing only who a creature can see and reach, giving up on a
chase going nowhere, the leash still a ring round home, and each creature's way home held by a sweep;
decision 116), **and C5** (Lampton and Candle Strand rebuilt at 45×32 under their own names, with
side paths and places to do things; secrets, found by walking up to one and paying a line of Wick's
and a cache, counted under the zone map, three of them; no tide, and no travel until C10 decides;
decision 117), **and C6** (the New Cut and Redrag Camp rebuilt at 45×32 under their own names, the
Cut in two benches under its face and the camp in a ruined waystation of dressed stone, a ground of
its own; a secret in each; a rebuild adds more of what a zone has and leaves its people to Part D;
decision 118), **and C7** (the Cutthroat's Cellar and the Sunken Barrow rebuilt at 45×32, rock with
every room lined in masonry, each entered at a mouth five tiles across rather than down a whole side,
an exit now open only along its mouth; the strongbox and the frieze; decision 119), **and C8** (Old Mill
Road and Greyford rebuilt at 45×32, one stream from Greyford's ford into the millpond and the edge
between them a mouth either side, the first outdoors; a secret may lie in a room, found from inside
it; the shrine, the ledger, the keystone and the fettler's back room; decision 120), **and C9**
(Blackwater Fen and the Deep Cut rebuilt at 45×32, the fen's south edge a mouth at the barrow's
door and the New Cut's shaft a mouth on either side, its shelf given back to the rock; the drowned
village, the lantern still burning, the sealed door and the maker's mark, the lantern the first
standing secret that loops; no scenery yet; decision 121), **and C10** (less grind: a level takes
its number plus four minutes of play, measured by a bot playing every class through the zones; the
curve 100n² − 200; food the answer to the wait, healing more, faster, dropping more and costing less
on the shelf; the wizard and the ranger grow six health a level; no travel until G1; decision 122),
**and C11** (the Part C review: the barrow's wights one at a time and its king alone, a new
character's bag with sixteen cooked rats in it, two names on one line a word's space apart, and a
zone measured at about half an hour rebuilt and an hour and a half to two hours new; decision 124),
**and E2** (potions: foraging with a sickle on herb patches from the strand to the fen, brewing at a
still in Greyford, four potions one kind each for gathering speed, a fight, idle XP and luck, their
clocks kept on the character and honoured by a night away; decision 129).
From C11 the phases are built several at a time, by the rules and briefs in
`docs/v2_parallel_plan.md` (decision 123). **Next: G1**, with the rest of wave 1 (D1, D4, E1 and
F1) already in flight. Update this line as each phase lands:
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
- **From C11 on, several phases are in flight at once** (decision 123). `docs/v2_parallel_plan.md`
  says which may run beside which, the files they all touch, and the rules on top of these: a
  phase's decision number and save version are taken at the merge rather than at the branch, its
  Record commit is written after that rebase, a contested file is owned by one phase at a time, and
  a review amends its own part and proposes the rest. It holds a brief per phase, which is where a
  session building one starts.
- **Every part ends in a review phase.** It re-reads what landed against the pillars and the
  user's original list, asks the user what feels wrong, and **amends the rest of this plan** before
  the next part starts: phases added, cut, reordered. This plan is expected to change.
- **Each phase**: update the status line, append to `docs/decisions.md` for any fork, correct the
  `docs/architecture/` file for what moved. Part of the phase, not paperwork after it.
- **Open questions are asked when their phase starts**, not before. Each phase lists its own.
- **Production shows work in progress** (decision 83). Every merge deploys, so every phase must
  leave the game playable, even where it is half-converted. Nothing but a merge deploys.
- **CI runs and deploys are spent with care** (decision 95): the repo has since gone public, so
  Actions minutes no longer run out, but a run still takes ten minutes, and Vercel allows 100
  deployments a day. A phase is pushed once its gates pass locally, not commit by commit, and its
  PR opened when it is done; a draft runs the gates alone, and marking it ready runs smoke.
- **Saves**: normal migrations until **C1**, which starts the version 2 save era and retires every
  older save (decision 82). From C1 on, migrations are normal again, so a test character survives
  the rest of the release.

### Starting cold

1. `CLAUDE.md` loads by itself. Read this plan's status line, the phase to be built, its part's
   introduction, decisions 80-88, and the phase's brief in `docs/v2_parallel_plan.md`, which says
   what else to read and what to ask.
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
- **B4 — People. (Landed.)** **A person is put together from what they chose and what they wear**
  (`art/outfit.ts`): the class's garment, their look, a piece on each slot and the weapon in hand,
  composed at the level of the grids and compiled as one sprite, so the compiler outlines one
  silhouette rather than a stack of outlined layers. **Each slot is dyed into a ramp of its own**, so
  a steel helm sits over studded legs and a tier is still a recolour. What each item is drawn as is a
  row (`art/wardrobe.ts`), every item held to one by a test; the lookbook became the pieces (plate
  over a gambeson, the steel under the crimson cloak, the fen's trimmed robe, the hunter's cowl, a
  cutthroat's bandana over the face, a crown). **Every weapon and offhand is drawn as the item it
  is**, a swung one drawn once upright and its carries turned and leant from it; shields over the
  forearm, an orb and a lantern cast from, a quiver on the back. **The wizard's wands are staves**,
  renamed to match, their ids kept. **A character is made in a look**: four skins, five hair colours,
  five hairstyles, picked on a creation screen that draws each class in the world's art
  (`CharacterState.look`, save version 27, older characters fair, brown and cropped). The 2D view
  compiles the player's figure again when what they wear changes, its old canvas let go (smoke holds
  the count flat). **The six townsfolk are drawn**; the humanoid creatures are B5's. It went to
  about fifty-five files with its tests and docs and stayed whole: the look is the figure's first
  layer, and the screen that chooses it draws the figure the gear builds, so the two are one thing
  to judge. Decision 107 has the forks.
- **B5 — Creatures and effects. (Landed.)** **Every creature is drawn**, a test holding each to a
  sprite of its own. The humanoids are getups on B4's figure (`art/cast.ts`), **carrying mostly
  what they drop**: the bandit's red rag and a knife, the raider's fenweave hood and a boat's gaff,
  the goblins green and bald with their ears swept out and their eyes lit, the wight in bone
  under a shroud with its buried sword and shield. **A boss is the figure refit bigger**
  (`refitted`: rows and columns doubled where the drawing is flat, never scaled), the budget's
  48×64, the chief in the cutthroat's bandana with his cutlass and the king crowned in plate under
  a dark cloak; **a goblin is the same refit smaller**. The crab and the bog lurker are drawn as
  parts like the rat, and **the cave crawler is the crab in chalk** (`crab@cave`). **The moments
  are effect sprites played once and held fading** (`render2d/effects.ts`): a star where a blow
  lands, blood-red on the player, a crit's twice the size, a level's column of light, a fireball
  and a knife in flight; an arrow is a line of pixels at its angle, and **a telegraph is a baked
  rim and a disc filling out to it**, on the ground under everything standing. Numbers rise off
  the top of what they came off and stack over one born with them; the loot sack is drawn. About
  twenty files with its tests and docs. Decision 108 has the forks.
- **B6 — Places. (Landed.)** **What each place is drawn as is one table** (`art/places.ts`), a node
  falling back on its shape's drawing as a creature falls back in `cast.ts`. **Three woods**, each a
  canopy of leaf clumps lit from the top-left at the prop budget's 64 square, in the setting's
  `foliage` and `bark`: the round-crowned tree, broader darker hardwood on a trunk twice as thick,
  and the willow's strands hanging nearly to the ground; each **felled to a stump** showing its cut
  face, and **a crown the player is behind fades** as a roof does. **A vein is a boulder of the
  setting's rock with the ore in its seams**, drawn once in a neutral `ore` ramp and recoloured into
  the ore it yields (step 2 the ore's colour in the bag, held by a test); coal is a black seam across
  the stone, and a worked-out vein shows its pits. **A fishing spot is a mark**, a new kind: rings on
  the water, unoutlined, looping on the water's clock. **The forge** glows and sparks, **the
  tannery** is a vat with a hide on a frame, **the fletcher's bench** has its shafts laid out and a
  bow behind it, and **the fire** crackles in its ring of stones. **A stroke knocks something
  loose** on each gather beat: chips, flakes of stone, a splash. **What stands in a room moved to
  `art/rooms.ts`**, which both views read, drawn by the wall it stands against (from the front,
  along a side wall, and low against the south wall the cutaway takes away), and **whoever works in
  a room stands behind a counter**, blocking nothing. A node is picked by its body as in 3D, and a
  fishing spot as the water round it. About twenty-six files with its tests and docs. Found and left
  for B9: town's training hall stands close enough south of the smithy that its faded roof is drawn
  over the smithy's room. Decision 109 has the forks.
- **B7 — Retire 3D. (Landed.)** **`render3d/` and Three.js are deleted**, its tests with it, the
  `?renderer=3d` flag and smoke's `renderer-3d` section, and the shared tables only the 3D view read
  (the townsfolk's and outlaws' colours, the masks, the stride, the appearance key). What its tests
  held of the game rather than the engine was **ported to the 2D picking test** first: the priority
  asked of every kind, loot piles, the second tap from a doorstep, a rat on a shopfront's step.
  **The camera never turns**: the orbit, the yaw and W's rotation went with it, and a drag, still
  told from a tap by `host/gesture.ts`, asks for nothing. **The game imports no package**:
  `tests/architecture/seam.test.ts` holds that nothing in `src/` imports one, that there is no
  runtime dependency, and that nothing but `main.ts` imports `render2d/`. **The view reports a
  canvas count** (`canvases()`) in place of GPU memory, and every leak check in smoke reads it. **The
  draw budget is 16ms**, from the 3D view's 40: the 2D view reads 2-3ms on CI, and a planted
  regression the old ceiling would have passed fails the new one. **`rendering.md` is the 2D view's**,
  taking `art.md`'s account of it. The paperdoll keeps its stick-figure rig for B8. About a hundred
  files, forty-odd of them deleted and most of the rest a comment or a paragraph that named the 3D
  view; it stayed whole because a deletion that leaves the docs and comments pointing at files that
  are gone is not finished. Decision 110 has the forks.
- **B8 — The HUD's look. (Landed.)** **The HUD is drawn in the world's art**, each of it made at
  boot out of data and none of it a file loaded. **Panels are dark iron and brass** (the user's
  choice over parchment and leather, and dark oak): a face of dark stone inside a bevelled iron band
  with a brass plate riveted over each corner, buttons slabs of stone that press in, rows lower
  slabs and a bag's cells pits, each **a frame** (a sprite kind of its own, `art/sprites/frames.ts`)
  that the page cuts in nine, a counter's colour living on in its accent. **The world's font sets
  the headings, tabs and buttons** (the user's choice over a book serif and the system sans),
  written as a TrueType file in memory from its glyphs (`art/fontFile.ts`) at whole multiples only,
  the dense lines staying sans; decision 100 had kept a system font because a pixel font "would have
  to be a font file". **Every item, ability, buff and tab has a pixel icon** beside its word, 32
  pixels and a tab's 16 (`art/icons.ts`): gear read off the wardrobe, so the helm in the bag is the
  helm on the figure in the same steel, and cooking, burning and smelting as recolours into two new
  ramps; seventy-three pictures painted by a generator and pasted in, as B6's trees were. **The
  character sheet draws the world's figure** in what is worn, and the stick-figure rig went with the
  vector icons and every colour an item or a class carried for them. **Every colour the HUD names is
  a step on the art's ramps**, held over the whole stylesheet by a test, the XP bar went violet
  to free blue for mana, and the zone map is drawn in each ground's own colour in the zone's light. The HUD's pixel is one CSS pixel, the world's own on a phone. Smoke gained a
  `hud-art` section holding that a real browser takes the font, the frames and the sheet of icons. It
  went to about seventy files with its tests and docs and stayed whole, the user's choice: the look
  is one thing to judge, and frames round vector icons would have been neither the old HUD nor the
  new one. Decision 111 has the forks.
- **B9 — Part B review. (Landed.)** Walked B1-B8 against the pillars and the user's first list at a
  portrait phone and a 1280×800 desktop, every zone from its spawn and a grid of points across it
  and every panel through smoke's screenshots. Part B's promise held: every zone, creature, place
  and panel drawn, nothing left a placeholder, the throttled draw at 6.5ms against 16. It **mended
  five things in place**, all the user's choice: **nothing is drawn over the room the player stands
  in** (B6's smithy under the training hall's roof, a building cut out of the room and its sign not
  written there); **a crowd's names stack** (`render2d/plates.ts`: every plate laid out before any
  is written, one that would be written over another lifted straight up clear of it, the player and
  then the target never moving); **a big screen sees more of the world** (an art pixel never wider
  than two CSS pixels, so a 1280×800 desktop frames 12.5 tiles tall where it framed 8, and no phone
  changed); **the zone map's building names are one size**, on two lines when long and never
  stretched, and a bottom exit's name sits over its marker; and **the player column stands on a
  backing** of the darkest ink, so a name in the world under it is not read through it. It
  **amended the plan**: Part C next as planned, and each rebuild draws what it adds. Nineteen
  files with its tests and docs. Decision 112 has the forks.

**Open questions for Part B**: none left. B1 answered all three: tiles are 32 pixels, the HUD keeps
a system font while the world gets a pixel font drawn as data, and every creature faces four ways
(decision 100). B8 asked the type again, since writing the font file from the data answered
decision 100's objection, and the HUD's headings took the world's font (decision 111).

---

## Part C — A bigger world

Zones grow to **about 3× the area** (decision 86). This is where old saves retire, since every
saved position stops meaning anything.

- **C1 — Big maps, and the version 2 save era. (Landed.)** Every zone is **written as text**
  (`data/zoneText.ts`): a character a tile, the grounds shared, and a legend of the zone's own for
  the start, creatures, nodes, stations and buildings, a building a block of its letter exactly its
  footprint and whoever works in it placed from its row. The offsets from the map's middle went
  with `spawns.ts` and the fixed 25×19, so a zone's size is its text's; the camera already framed
  any size. About sixty placements moved up to half a tile onto a cell's middle, and the sweeps
  moved five more a cell. The pathfinder **stands a body off the middle of a crowded cell**, since
  a room two tiles deep on tile lines had no cell to route through. **Version 2's saves count from
  100** with no step from before: a version 1 save is dropped on its first load and the creation
  screen names who was in it, once; a version 1 file is refused in the same words. The wizard's
  ids became `apprentice-staff`, `stolen-staff` and `barrow-staff`. All three forks were the
  user's (decision 113).
- **C2 — The lore bible. (Landed.)** `docs/lore/`, an index and seven files, written before any
  zone is rebuilt, and **handed to Claude** by the user once they had read it, so the story is
  new to them in play: later phases extend it without asking, and say which parts moved rather than
  what they now say. **The realm is the Veymarch**, the frontier
  the Veymarch Company is settling for the Crown of Aldmark over **Veymar**, a kingdom of low country
  that held back the sea and kept its dead kings asleep with **kindled lights**, lanterns with a
  soul in them, and drowned six hundred years ago when its last king, Merrath, had every light drawn
  into one to keep himself for ever. The **fenfolk**, its last people, have kept the barrows'
  lanterns lit with their own dead since; the Company's pans, drains and quarry are putting them
  out, and every soul that goes out is drawn to Merrath's light under the sea. **The spirit is
  Wick**, who was Lorn, the lampwright who lit it, sealed by the survivors in the hill the quarry
  cracked, and remembering a piece at each zone and boss. The elves of the Stillwood and the dwarves
  of Karn Tholl are met once each before level 9 and come back in Part G; the fen raiders have a
  cause and Hollis's Red Rags do not. `places.md` gives every zone its name (Town is **Lampton**, the
  beach **Candle Strand**, the quarry **the New Cut**), people, secrets, rumours and Wick's beat, a
  name reaching the game when its zone is rebuilt; `tone.md` has the voice with lines right and
  wrong, and `naming.md` the old tongue's roots and every name taken. All four forks were the user's
  (decision 114).
- **C3 — Minimap. (Landed.)** **The zone map windowed round the player** (`hud/Minimap.ts`): 27
  tiles a side at four pixels a tile, in an iron panel in **the top-right corner** with the zone's
  name under it, drawn from `zoneMap()` through helpers the sheet now shares (`hud/mapArt.ts`), the
  window moved on each tile crossing. Nodes lie flat, people are a size up, **a creature is a dot in
  its name's colour ringed in ink** and a boss a bigger one, **an exit is an arrow** pointing off its
  edge and drawn on the rim while out of view, and the player is a cross. **The creatures reach the
  HUD as the player's tile does** (`creatures-changed`): those within reach, published on a tile
  crossing, never once a frame. **The target frame stands beside the minimap** where the top row has
  room and under it on a phone held upright. **A tap opens the zone map**, and a second shuts it.
  **A switch in Options** takes it down, kept on the character (save version 101, version 2's first
  migration step). Smoke gained a `minimap` section. All three forks were the user's (decision 115).
- **C4 — Smarter creatures. (Landed.)** **A chase is a route kept, not re-made** (`world/Chase.ts`):
  straight at the quarry while the body has a clear line, otherwise round what is in the way on a
  route kept until the quarry drifts a tile off its end and never re-planned twice in half a second,
  which answers decision 37's swinging; a creature on the player, a creature walking home and **the
  player's pursuit** are the same object, and both kinds stop **in reach and in sight**. **An
  aggressive creature notices only a player it can see** and has a way to. **A chase that goes
  nowhere for two seconds gives up** and goes home healed, so standing somewhere a creature can never
  reach is an escape rather than a turret; nowhere is measured off what the body did, not what the
  search said. **The leash stays a ring round home**, and a walk home that goes nowhere as long ends
  with the creature put there. The pathfinder routes **any body shape**, remembers its footings for
  the life of a zone and searches with a heap, a third of the cost on a rebuilt zone's size. **The
  spawn-safety sweep holds each creature's way home**, walked at 60fps and at 5; it found four homes
  no walk could end at from C1's half-tile snap, and a tree, the barrow king, a lurker and a pool
  tile moved. A rat cannot follow the player into a room two tiles wide, and gives up there. All four
  forks were the user's (decision 116).
- **C5 — Lampton and Candle Strand. (Landed.)** Both at 45×32 and under their own names. **Lampton**
  keeps its four counters fronting the high street, starts a new player at the inn's door, stands
  the Lamp Stone in the crossroads, and gains lanes, cottages, a larger grove and pond, and rats by
  the inn and in the grove. **Candle Strand** keeps the spit and the strand the fen road needs, and
  stands the Candles in the sea with a causeway of stone out to the nearest. **Secrets**
  (`data/secrets.ts`): a small thing drawn where it lies, on no map and never named over, found by
  walking up to it once per character (save version 102), paying a line of Wick's on the tips'
  card and a cache of coin and now and then an item, the zone map counting the zone's own under
  it; two in Lampton and one on the strand. The townsfolk keep their trades as names until D1. All
  four forks were the user's (decision 117).
- **C6 — The New Cut and Redrag Camp. (Landed.)** Both at 45×32 and under their own names. **The
  New Cut** keeps the quarry's shape: the shelf along the north edge for the Deep Cut's arrivals,
  the face with the shaft through it, the west ledge to Greyford, and turf where Lampton's road comes
  up; a ridge across the pit makes two benches, tin and small rats on the lower, iron and big ones on
  the upper. **Redrag Camp** is a Veymari waystation's ruin on the east road, entered at its gate:
  walls broken in three places round a paved yard, the wardens' hall at the back, a stable, a
  well-house up a track and a pond, every bandit where neither arrival strip nor the start is in
  reach. **Ruins are a ground of their own**, masonry, dressed stone standing its face up as rock
  does, and the road meets the paving along a new edge. **The broken cell** behind the Cut's face
  and **the lamp niche** in the hall's back wall are the secrets. A rebuild adds more of what its
  zone has rather than a new kind of thing to do, and the people the lore names come in Part D.
  All three forks were the user's (decision 118).
- **C7 — The Cutthroat's Cellar and the Sunken Barrow. (Landed.)** Both at 45×32, **rock with every
  room lined in masonry**, which needed two edges, masonry under rock and under water. **An exit is
  open only along its mouth** (`ZoneExit.mouth`), the first and last tile of its edge a row names, and
  an arrival lands across the mouth of the exit back at the fraction of the other it was crossed at,
  both measured over where a body's centre can cross; a row with no mouth is open end to end. Each
  vault is entered at a mouth five tiles across, and **Redrag Camp's side narrowed to a walled lane**
  out of the gap in its east wall; the fen's waits for C9. **The Cutthroat's Cellar** takes its name
  and its key the Cellar Key: a stair down into the guardroom, the spine east to the warden's tomb with
  Hollis before the bier, the bunk room and the storeroom off it. **The Sunken Barrow** is read north
  to south: stair, antechamber, the gallery, the crypts at its ends and the king's chamber off its
  middle. **The strongbox** at the end of a low passage under the Cellar's guardroom carries Wick's
  beat for the Cellar, and **the frieze of the sea-lights** is along the gallery. The sweeps ask the
  mouth: ground across it and on the edge, three tiles wide, a way back on the opposite edge, and an
  arrival strip measured as a segment. About thirty-five files with its tests and docs, and whole,
  since the mouth was made for the vaults and is tested by them. The fork was the user's (decision
  119).
- **C8 — Old Mill Road and Greyford. (Landed.)** Both at 45×32. **One stream** comes down past
  Greyford's yard, under the fallen bridge, and runs off its south edge into the mill road's
  millpond, so the edge between them opens at **a mouth on either side**, the same stretch east of
  the water: the first mouths outdoors. **Greyford** is the post at the ford: the counters fronting
  the road from the New Cut, the tannery and the bench by the water, cottages, and the ford made of
  the bridge's abutments, two piers still in the stream and its stones, the old road going on west a
  little way and grown over. **The fettler's store** stands against the back of the longhouse with
  its door round the back. **Old Mill Road** runs from Lampton to the mill yard and stops, the road
  north the way on; the mill on the pond's bank, five knots of three goblins where there were three,
  and the hardwood gathered into the timber stand. **A secret may lie in a room**, written into its
  building's block and found from inside it alone, and all four of the lore's secrets went in: the
  shrine under the millpond (a mark, the water's surface with a stone showing through), the first
  charter's ledger in the mill, the bridge's keystone in the ford, and the fettler's back room, which
  carries Wick's beat for Greyford. A new sweep holds every secret walked up to, and found the
  strand's causeway one body wide; it is two. Smoke gained a `back-room` section. About thirty files
  with its tests and docs. Both forks were the user's (decision 120).
- **C9 — Blackwater Fen and the Deep Cut. (Landed.)** Both at 45×32, and each narrowed the edge it
  shares with the zone below it. **The fen's south edge opens at the barrow's door**, the same five
  tiles as the barrow's own, its kerb of masonry and its threshold the stone floor, which needed the
  two edges the marsh had never met; the strand keeps the beach road's arrival end to end, the salt
  pans are cut into its east end with a drain down out of the marsh to feed them, and the mere, four
  guarded deep pools and the lantern's holm are below. **The Deep Cut is entered down the shaft**:
  the New Cut's north edge opens only at the shaft's head and the Deep Cut's south edge only at its
  foot, the same seven tiles, so the New Cut's shelf went back to the rock. Inside, the goblins'
  gallery and two workings, and the dwarves' road lined in masonry up to the hall where the goblins
  stopped digging. **Two of the lore's three secrets a zone**: the drowned village (a mark) and the
  lantern still burning, the first standing secret that loops, in the fen; the sealed door, carrying
  Wick's beat, and the maker's mark in the Deep Cut, both struck with Karn Tholl's peak. The holm's
  way and the flooded passage wait for Part G, and **the fen's lanterns on posts wait for scenery**,
  a new kind of marker no zone needs yet. The way-home sweep found a diagonal squeeze, a raider a
  tile wide wedged between two cells of water a tile apart corner to corner. Smoke walks down the
  shaft and into the fen. About twenty-five files with its tests and docs. All four forks were the
  user's (decision 121).
- **C5-C9 — Rebuild the ten zones at 3×**, two a phase: side paths, a secret or two, several
  activity spots each, **the activities being more of what the zone already has** (decision 118).
  Spawns, nodes and stations re-placed; the progression test re-held. **Every creature, node,
  station and building a rebuild adds is drawn in the phase that adds it** (a row in `art/cast.ts`,
  `art/places.ts`, the building kit, and an icon for anything it hands out), since Part B left
  nothing a placeholder and the tests hold every row to a drawing (decision 112). **The order**
  after C6 (decision 118): **C7** the two vaults, the Cutthroat's Cellar and the Sunken Barrow, the
  same shape on purpose (landed); **C8** Old Mill Road and Greyford (landed); **C9** Blackwater Fen and
  the Deep Cut, whose shared edges with the Cut and the barrow narrowed to a mouth as the mill road's
  and Greyford's did round their stream (decision 121, landed).
- **C10 — Less grind. (Landed.)** Pillar 3's promise, which no phase kept until the Part A review
  added this one (decision 99). **Measured first, by playing it**: a bot (`tests/world/pace.ts`)
  fights each zone at the level and in the kit meant for it, on the real map and pathing, and found
  the warrior at about seventy minutes from 1 to 9, the wizard about two hours, half to three-quarters
  of it standing still for regen, the mill road a level in four minutes and the Deep Cut in up to
  twenty-nine. The longest walk was thirty-one seconds. **A level takes its number plus four
  minutes** (five from 1 to 2, twelve from 8 to 9, sixty-eight in all), every class held to it by
  `tests/world/pace.test.ts`, which plays each twice and holds the arcs `progression.test.ts` used to
  count in kills. **The curve is 100n² − 200**, and the mill road's goblins pay a quarter less.
  **Food is the answer to the wait**, regen left as it was: heals of 20, 30, 40 and 70 over six
  seconds, rations on every humanoid and eels on the fen's lurkers, the shelf's at half price.
  **The wizard and the ranger grow six health a level**, as the warrior does, and Mana Shield II soaks
  70; measured, both had died in two or three blows in the upper band. **No travel**; G1 decides again.
  The barrow killing every class often in the bot's hands, the Deep Cut slow for the ranged classes
  and a first level spent mostly resting were left to the review, which mended the first and the
  last and kept the second (C11). About twenty files with its tests and docs. Two of the three forks were the user's on Claude's recommendation and the third the
  user's against it (decision 122).
- **C11 — Part C review. (Landed.)** Walked C1-C10 against the pillars and the user's first list
  at a 390×844 phone and a 1280×800 desktop, every zone from its start and four points across it,
  and through smoke's screenshots. Part C's promise held: ten zones three times the size, written as
  text, a minimap, creatures that walk round things, fifteen secrets, the lore under all of it, and
  a level its number plus four minutes. The user answered the three leftovers C10 named, and the
  walk found one more:
  - **The barrow's wights come one at a time.** Logged per death, most of the barrow's deaths were
    the king drawn into a fight with one of the two wights in front of him, and the rest were the
    crypts' pairs coming together. Now two stand to a crypt in its opposite corners, four down the
    gallery and two in the antechamber, each out of the next one's notice, and the king's chamber is
    his alone. The bot's deaths in a level at 8: warrior 18.5 to 6, ranger 24.5 to 10.5, wizard 34
    to 27.5, the wizard's now to single wights, which is its own survival rather than the layout.
    The barrow feeds nobody, so a level there is held on thirty crabs carried in, not twenty.
  - **A new character starts with sixteen cooked rats**, put in by the creation screen, and a level
    1 rat pays 2 XP where it paid 5, which holds the first level to its five minutes now that it is
    fighting rather than standing still: resting fell from 66-83% of it to 0-32%. The rat cull pays
    25 XP, under what its fifteen rats do.
  - **The Deep Cut stays the warrior's zone**: at 5 it takes the ranged classes 9-11 minutes where
    the mill road takes 7-9, inside the pace every class is held to.
  - **Two names on one line keep a word's space between them**, since Lampton wrote "Cottage Rat
    (Lv 1)" over a cottage with a rat beside it on a desktop.

  **What a zone costs to build**, the number Part G is sized from, read off the commit record as
  the gap between one phase's Record commit and the next (the user's answers and the merge
  included):

  | Phase | Zones                        | Session time | What else it carried                      |
  | ----- | ---------------------------- | ------------ | ----------------------------------------- |
  | C5    | Lampton, Candle Strand       | ~75 min      | the secrets system and three secrets      |
  | C6    | the New Cut, Redrag Camp     | ~42 min      | masonry, a ground of its own              |
  | C7    | the Cellar, the Barrow       | ~80 min      | the mouth, two edges                      |
  | C8    | Old Mill Road, Greyford      | ~95 min      | outdoor mouths, a secret in a room, smoke |
  | C9    | Blackwater Fen, the Deep Cut | ~41 min      | two edges                                 |
  | C10   | the grind                    | ~64 min      | the pacer                                 |

  Ten zones in about five and a half agent hours: **about half an hour a zone rebuilt**. **A Part G
  zone is new content and costs two to three times that**, about an hour and a half to two hours a
  zone, since a rebuild reused every creature, node and recipe where a new zone draws its creatures,
  writes their loot, quests and secrets and extends the lore; and each gear and making tier is a
  phase of its own on top. The cadence above was one phase at a time with the user merging in
  minutes, which working in parallel does not speed up: the user's answers and play are the
  bottleneck, not the agents. Part D, E and F are kept as planned, and anything the review would
  change there is proposed in its PR rather than made (decision 123's rule 6). Decision 124 has the
  forks.

**Open questions for Part C**: none left; the part has landed. C11 answered C10's three leftovers
(the barrow's wights spread, food in the starting bag, the Deep Cut left the warrior's zone,
decision 124). C10 answered how long a level takes (its number plus four
minutes, every class) and whether travel comes back (not yet: the longest walk is half a minute, and
G1 asks again, decision 122). C5 answered how secrets are found: by walking up to them. C6 answered what a rebuild
may add (more of what the zone has) and when the lore's people arrive (Part D). C7 answered how a
vault is entered: at a mouth narrower than its edge, a door inside a zone left for the undercroft and
Karn Tholl (decision 119). C8 answered whether a mouth is only a vault's (no: an outdoor edge narrows
round water that crosses it) and whether a secret may lie indoors (yes, found from inside the room,
decision 120). C9 answered whether the last two zones' edges narrow (both, at the barrow's door and
at the shaft, the New Cut's side too) and whether the lore's scenery comes in with them (not yet,
decision 121).

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

**Open questions for Part D**: can two factions be opposed, so that raising one lowers another?
C2 answered which factions there are and what the spirit wants (`docs/lore/factions.md` and
`spirit.md`, decision 114), and left D3 the mechanics.

---

## Part E — Idle, rested and brewed

Idle and active each get a reason (decision 85).

- **E1 — Rested.** Time spent idle or away banks a rested bonus that speeds up active XP, capped,
  and shown on the XP bar.
- **E2 — Potions.** _Landed (decision 129): foraging, brewing at a still in Greyford, four potions._
  A way to make them (a new making skill, and where its herbs come from, are this
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

Sized from how long a zone actually took (C11): about half an hour a zone rebuilt, and two to three
times that for a zone of new content, so an hour and a half to two hours a zone, plus a phase for
each gear and making tier.

- **G1 — The shape of 9-20.** How many bands, zones, gear tiers, making tiers and bosses, written
  into this plan as phases, each level paced by `tests/world/pace.test.ts` as 1-9 is (decision 122),
  and whether travel comes back once the world is past these ten zones.
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
- **No second renderer kept alive.** 3D went in B7 (decision 110).
