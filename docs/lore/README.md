# The lore bible

What the world of version 2 is: its name and history, its peoples and factions, its places, the
spirit's story, the tone, and how things are named. Written in phase C2 of `docs/v2_plan.md`
(decision 114), before any zone is rebuilt, so the rebuilds (C5-C9) take their names, secrets and
rumours from one place, and Part D's dialog, journal, factions and spirit are written against it.
The user read it there and handed it to Claude, so the story is new to them in play:
a phase extends it without asking them, and its PR says which parts moved rather than what they now
say.

## The realm in a page

The game is set in **the Veymarch**, the western frontier of the kingdom of **Aldmark**, settled for
the second time by **the Veymarch Company** under a charter from the Crown. The land was once
**Veymar**, a kingdom of low country by the sea that kept itself with **kindled lights**: lanterns
burning with a soul given to them, which held back the sea along its coast and kept its dead kings
asleep in their barrows. Six hundred years ago its last king, **Merrath**, afraid of what the
lanterns made of kings, ordered every light in the kingdom drawn into one flame to keep himself
awake and whole for ever. His lampwright lit it. The sea-lights went dark at once, and in one night
the sea came over the low country: **the Drowning**. What is left is the fen, the strand with the
stumps of the sea-lights off it, and the barrows sunk under the marsh, kept asleep ever since by
**the fenfolk**, the drowned kingdom's last people, who relit the barrows' lanterns and have given
their own dead to them since.

The Company came thirty years ago. It built **Lampton** round an old stone it took for a lamp-post,
cut salt pans at the fen's edge, opened a quarry in the hills and cleared the roads, and in doing so
it has been putting out lanterns it did not know were there. This spring the quarry's blasting
cracked a small lantern sealed in the hill, and what was bound in it drifted down to Lampton and
fastened on the nearest warm thing: the player, newly arrived and asleep at the Wet Boot. It calls
itself **Wick**. It remembers nothing. It was the lampwright.

The climb from 1 to 20 is the Veymarch waking up. Orlath the Barrow King is the first of the old
dead to wake since the Drowning, and he will not be the last. The elves of **the Stillwood** and the
dwarves of **Karn Tholl**, who turned from Veymar before it drowned and shut their doors after,
begin to come back, because they know what is coming. At the top of the climb is drowned **Marhal**,
where Merrath's light is still burning under the sea, and the question Wick has been asking since
it woke: what did I do?

## The files

| File          | What it holds                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `history.md`  | The realm's name, its ages and dates, the kindling, the Drowning, the two charters, what is happening now, the climb to 20 |
| `peoples.md`  | Settlers, fenfolk, elves, dwarves, goblins, the dead and stranger things; where each class comes from                      |
| `factions.md` | Who wants what, who stands against whom, and what D3 has left to decide                                                    |
| `places.md`   | Every zone as it is, what it was, who is there, what it hides and what is whispered about it; the lands past 8             |
| `spirit.md`   | Wick: who it was, why it is with the player, what it wants, how it remembers and how it speaks                             |
| `tone.md`     | The voice, its rules, and lines that are right and lines that are not                                                      |
| `naming.md`   | How each people names things, the old tongue's roots, and every name already taken                                         |

## How it is used

- **The rebuilds (C5-C9)** take each zone's name, secrets and rumours from `places.md`, and the
  people they add from its cast. A name reaches the game in the phase that rebuilds where it is:
  Town is called Lampton when town is rebuilt, and not before, so a name never arrives ahead of the
  thing it names.
- **D1, dialog**, writes every person in `tone.md`'s voice from their entry in `places.md`.
- **D2, Whispers of the Realm**: a rumour starts from a line in `places.md`, and a lore fragment is
  a piece of `history.md` the player can find, never more than it says.
- **D3, factions**, starts from `factions.md`, which leaves it the mechanics.
- **D4, the spirit**, places the beats in `spirit.md` at their zones and bosses.
- **Part G, levels 9-20**, sized at C11, takes its regions from the end of `places.md` and its
  ending from `history.md`.
- **Hooks for the rest**, none of them decided: the rested bonus (E1) as Wick keeping watch while
  the player is away, potions (E2) as the fenfolk's brewing from what grows in the fen, the house
  (F1) on a plot in Lampton the Company grants, and the collection log (F3) counting the lore
  fragments D2 hands out.

## Rules

- **The bible is canon for anything not yet built.** A phase that needs a fact it does not have
  adds it here in the same change, the way `docs/architecture/` is corrected. Where the game and the
  bible disagree, that change corrects one of them; neither is left standing wrong.
- **What the game says is what somebody believes.** The history is never told whole: it arrives in
  fragments, rumours and one person's view at a time, and people are wrong (the fettler thinks
  fenweave was stolen). The bible says what is true so the game can let the player find it out.
- **Wick's truth is the last thing learned.** Nothing before Part G's last band says that Lorn lit
  the Great Kindling; `spirit.md` has the order the rest comes back in.
- **A new name is checked** against `naming.md`'s rules and its list of names taken, and added to
  the list in the same change.
