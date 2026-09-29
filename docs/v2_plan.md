# Version 2: a solo zero-to-hero, drawn, with people in it

**Status:** live. Opened 2026-09-27 against `ca12279`, the merge of act three. **Landed: phase 0**
(this document, decisions 80-88, `CLAUDE.md` pointing here), **A1** (every number labelled, every
slayer rank a title, mastery explained, map names over the markers; decision 89), **A2** (every
item says what it is for, on a tap and on a card any item row opens; decision 90), **A3** (the
shop and the bank in two sides, contracts marked repeatable, Abandon apart and asking twice;
decision 91), **A4** (a tap on a person talks first: a greeting, their counter as a button, their
quests; decision 92), **A5** (the skills book: a page per skill, every node and recipe with its
mastery beside it, the mastery page gone; decision 93) **and A6** (the training bar: the skill last
trained, in the player column, following what you do and fading half a minute after; decision 94).
**Next: A7**, idle. Update this line as each phase lands: which phase, and which is next.

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
  split here.
- **Every part ends in a review phase.** It re-reads what landed against the pillars and the
  user's original list, asks the user what feels wrong, and **amends the rest of this plan** before
  the next part starts: phases added, cut, reordered. This plan is expected to change.
- **Each phase**: update the status line, append to `docs/decisions.md` for any fork, correct the
  `docs/architecture/` file for what moved. Part of the phase, not paperwork after it.
- **Open questions are asked when their phase starts**, not before. Each phase lists its own.
- **Production shows work in progress** (decision 83). Every merge deploys, so every phase must
  leave the game playable, even where it is half-converted.
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
- **A7 — Idle.** "Camp" becomes **Idle** in every player-facing string (decision 85), the item
  card's "Camping eats this" among them (`ItemUseSystem.ts`, left as Camp by A2). The idle panel
  says what idle will do before it starts: the job, the food it will eat and in what order, the
  arrows it will spend, half XP, the offline cap. The away report uses the same words.
- **A8 — Save export and import.** Download the save as a file; load one back through the same
  migration chain, with a confirmation before overwriting.
- **A9 — Tips.** A tip engine in plain TypeScript: tips fire off derived state (first raw food held,
  first full pack, first contract, first idle), each shown once, silenceable for good. Until the
  spirit is drawn in D5 they arrive as HUD toasts **in the spirit's voice**.
- **A10 — Part A review.**

**Open questions for Part A** (A1 answered the first: mastery folds into the skills book, and
its own page goes, decision 89; A6 answered where the training bar sits on a landscape phone: in
the player column, as on every screen, decision 94): Should the player choose idle's food order, or
is "weakest first, said plainly" enough?

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

- **B1 — The style guide and the sprite format.** One palette per setting (open, marsh,
  underground); one tile size; one light direction; the outline rule; **a fixed animation budget**
  per kind of actor, so animation cannot creep (the user's worry). A text format for sprites (pixel
  grids with palette keys), a compile step to texture atlases, recolouring for tiers, and tests that
  hold every sprite to the palette, its size and its frame count. **A spike decides the renderer**:
  Three.js with an orthographic camera (keeps the picking, disposal and GPU-memory checks),
  PixiJS, or plain Canvas 2D.
- **B2 — The checkpoint slice.** Town in 2D behind `?renderer=2d`: terrain with edge transitions,
  one building, one NPC, the warrior walking, a rat. Picking and the camera work. **The user judges
  it.**
- **B3 — Every zone drawable, and the switch.** All terrain and all three settings (the lantern
  underground), water and ground scatter. Anything not yet drawn shows a placeholder sprite. **2D
  becomes the default**; 3D stays reachable for one phase as a fallback.
- **B4 — People.** A layered figure for all three classes: body, armour by slot, weapon and offhand,
  tier colours by recolouring. Four directions, walk, attack, cast, shoot, hurt, death, within B1's
  budget.
- **B5 — Creatures and effects.** Every creature by shape and the bosses; telegraph rings, arrows,
  bolts, hits, crits, the level-up, the loot sack, floating text.
- **B6 — Places.** Nodes (and their depleted states), stations, signposts, buildings with interiors
  (the roof lifts when you are inside), counters.
- **B7 — Retire 3D.** Three.js and `render3d/` deleted; smoke's draw budget and memory checks
  rewritten for 2D; `rendering.md` rewritten.
- **B8 — The HUD's look.** A full UI pass to match the art: theme, panels, icons as pixel data, a
  type choice. Part A said what things are; this makes them look like one game.
- **B9 — Part B review.**

**Open questions for Part B**: tile size (16px shown at 3×, or 32px?); a pixel font or a readable
system font for the HUD; how many directions a creature needs (four, or two mirrored).

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
- **C10 — Part C review**, which **measures how long a zone took to build**, the number Part G is
  sized from.

**Open questions for Part C**: how are secrets found (hidden paths, a tool, a rumour)? Do larger
zones need fast travel back, having taken it out once (decision in PR #111)?

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
- **E3 — What idle uses.** Idle drinks the potions it is given and eats in an order the player can
  see and, if A7's answer says so, set.
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

Sized at C10 from how long a zone actually took, not guessed now.

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
