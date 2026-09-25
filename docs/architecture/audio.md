# Sound

`src/audio/` is the game's sound, and it is built the way the HUD is: engine-free, owned by the
host, and told about the world rather than reaching into it. There are no sound files. Every cue is
a recipe in `cues.ts` — a few voices, each an oscillator or a burst of filtered noise swept from one
pitch to another under a short envelope — and `SoundBoard` builds it out of Web Audio nodes when it
plays, which is the same bargain the renderer makes with primitives (`docs/decisions.md` 54).

## What it hears

**The two channels, and nothing else.** `SoundBoard.hear(events)` is handed the frame's
`WorldEvent[]` by the host, beside the call that hands them to the view, and `listenTo(events)`
subscribes to the two moments on the HUD channel that have no `WorldEvent` of their own: coin and an
achievement. The translation is `listen.ts` — `MomentEar` for the world's moments, `PurseEar` for
the purse — and it is pure, so what a fight sounds like is unit-tested with no audio device at all
(`tests/audio/listen.test.ts`). A level-up is heard off its `WorldEvent` and not off the HUD's
`LEVEL_UP_EVENT`, so it is heard once.

**A moment the view draws from state still needs an event if it makes a sound.** A wind-up is state
on the mob (`mob.windUp`), and the view draws the telegraph by reading it each frame. A sound cannot
poll: it has to be told the moment something began. So `CombatDirector` pushes `{ kind: 'wind-up' }`
when one starts, which the view ignores and the ear hears as the warning. The rejected alternative
was the board reading the world's mobs, which would have made sound the one thing outside the view
that holds a reference to the zone (`docs/decisions.md` 61).

**The gather's strokes are shared with the view** (`ui/gatherBeat.ts`). The world reports how far
through its channel a gather is and nothing about strokes, which are presentation; `GatherBeat`
finds the two beats in that stream, and the view and the ear each hold one, so the axe is heard
exactly where it is seen to land. A slow frame that steps over both beats at once is still one
stroke rather than none.

**Coin is a purse that grew.** The currency event carries a total, and it is also published when
the death fee is taken — so a coin on any change would be the game cheering the player's own
death. Money arriving is the moment worth a sound; money leaving is either a button the player
just pressed or that fee. The first total `PurseEar` hears is a baseline, not a gain.

**A trickle of healing is silent.** Regen and a meal tick over in small pulses for as long as the
player stands still; below `AUDIBLE_HEAL` a heal makes no sound, and a spell is well over it.

## How it plays

**Nothing is made until a gesture.** Browsers refuse to start audio before the page has been
touched, so the `AudioContext` is built on the first `pointerdown` or `keydown` anywhere — the host
listens on the window, in the capture phase, for the life of the page, so the click that begins a
character on the creation screen counts. Every call before that is quietly nothing, and where there
is no Web Audio at all (jsdom, an old browser) that is true for good.

**Repeats are spaced.** Each cue names `spacingMs`, the least time between two of it: six rats
taking a swing in one frame is one swing's worth of sound rather than six stacked into a roar.

**Each kind of place has a bed** (`ZoneSetting`, the same field that decides its light): wind and
birdsong in the open, a close hum and frogs in the marsh, a drone and dripping water underground.
Quiet on purpose, since it is the room a fight is heard in. Entering the same kind of place again
does not restart it; entering a different one fades the last out.

**A reset closes the context**, and the next gesture builds a new one. Everything kept on the old
context's clock goes with it — the spacing memory especially, since a new clock starts at zero and
an old timestamp would hold every cue silent until the new clock caught up.

## The setting

**Mute and volume live in Options** and are kept per device in `localStorage`, beside the save and
under their own key (`audio/settings.ts`), not in `CharacterState` (`docs/decisions.md` 60). The
HUD is handed the current setting when it mounts and sends a whole new one back on
`SOUND_SETTINGS_CHANGED_EVENT` as the controls move; the host applies it and stores it, so there is
one writer. The volume slider is greyed out while muted rather than hidden, so it keeps its place
and says what unmuting comes back at.

**Loading never throws.** Storage can be refused outright in a private window, and a game that
would not boot for want of a volume setting is a worse bug than one that forgot it.
