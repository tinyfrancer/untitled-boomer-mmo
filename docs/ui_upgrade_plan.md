# UI upgrade — running status

Five stacked PRs off the brief in `docs/feature_11_ui_upgrade.txt`. One feature each, in
dependency order: the navigation goes first because the map needs a home before it can be built.

Each PR stands alone — it ships green, with no dead buttons and no half-wired surface. That is why
`map` joins `MENU_TABS` in PR 5 alongside its sheet rather than in PR 1 with the rest of the menu.

| #   | PR                               | State                        |
| --- | -------------------------------- | ---------------------------- |
| 1   | Navigation: five tabs and a Menu | merged 2026-08-07, `2d612b1` |
| 2   | Quest marker over the shopkeeper | in review                    |
| 3   | The worn title over the player   | not started                  |
| 4   | The bag as an icon grid          | not started                  |
| 5   | The zone map                     | not started                  |

## 1 — Navigation

The bar was full by construction: seven tabs at 44.4px on a 375px phone against a `touchMin` of 44,
enforced by `tests/ui/tabs.test.ts`, `scripts/smoke.mjs` and a paragraph in `CLAUDE.md`. There was
no eighth seat to give the map.

`TABS` now holds the five the bar draws and `MENU_TABS` what the Menu overlay opens; `ALL_TABS` is
both, and `keys.ts` binds against that so a shortcut opens what it names rather than walking through
a menu built for thumbs. A sheet reached through the menu lights the **Menu** tab (`isMenuTab`) —
without it the bar goes dark over an open panel and nothing says where the panel came from.

Measured at 375px: 65.4px per bar tab, 127px per menu button, both against a 44px minimum.

## 2 — Quest marker

`QuestSystem` gains a pure `npcMarker(npcId, log, inventory)`. Drawn as a baked glyph tagged
`userData.kind = 'marker'` rather than `'label'`, so smoke's one-label-per-creature invariant
(`smoke.mjs`, `drawn.labels === mobs + npcs + signposts + 1`) still holds by construction and the
marker gets an assertion of its own. `NpcActor` learns the state from `ZoneView3D.sync()` polling
`world.character.state`, mirroring the level-recolour precedent — the marker changes when the _bag_
changes, and no event fires for that.

Landed as planned. Two things the screenshots decided rather than the design: the glyph is drawn at
**twice** the name's height, because a single "!" sized to match reads as punctuation on the end of
the name rather than as its own thing; and the in-progress grey is `THEME.color.muted` and not
`dim`, which is a colour for text on a panel's black backing and close to invisible on open grass.

`drawnCounts()` gains `markers`, which is what lets smoke prove the poll is a poll: it writes the
quest log straight onto the character — no event, no HUD request — and checks the glyph noticed.

## 3 — Title over the player

`Nameplate` gains a second sprite line tagged `userData.kind = 'title'`, same argument as above.
`world/Player` keeps knowing only its name; `ZoneView3D.sync()` polls `activeTitleId` beside the
level it already polls.

## 4 — Bag icon grid

`ui/itemIcons.ts` is the vocabulary (which shape, which colours, per item) and `hud/itemIcon.ts`
builds the SVG, following the `ui/` vs `hud/` split. Equipment already carries `slot`,
`weaponShape` and `color`; the nine materials and consumables need an `icon` field. Static
definition data, so no save migration. The same icon then goes into `SlotPicker` and `ShopModal`,
which is the consolidation payoff — three panels currently format an item row three ways.

## 5 — Zone map

Two commits: the plumbing, then the sheet.

The HUD knows nothing about the current zone and nothing publishes the player's position to it. Both
go on the UI bus, **published from `ZoneWorld.update()` through `publishOnChange` with no seed** —
not from the constructor. `startZone()` mounts the HUD _after_ the world exists
(`render3d/start3d.ts`), so a constructor-time emit on first boot fires into a bus with no
subscriber and the map stays blank until the first zone walk. Publishing from the tick delivers both
events on the first frame after mount, on boot and on every crossing since a new world brings fresh
unseeded publishers.

Position is keyed to tile coordinates, so it speaks on a tile crossing rather than once a frame.
The sheet caches the 475 terrain rects per zone and moves only the dot.
