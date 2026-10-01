import { layoutZone } from './zoneText';

/**
 * Candle Strand (decision 117, `docs/lore/places.md`): grass along the north
 * where Lampton's strand road comes down, sand through the middle, and the sea
 * across the south, though not across the whole of it: the road to the fen took
 * that. The road ends on the grass rather than running into the sand, which is
 * where a carter would stop.
 *
 * An exit keeps a strip of its own edge for arrivals along its whole length, a
 * tile and a half in, so opening the road south meant that strip had to be
 * walkable end to end. The sea stops short of it and runs off the east edge,
 * leaving a spit down the west side and a strand along the south: the spit is
 * the only way down to the fen road, which is better than a road that starts
 * anywhere, since the water still shapes the walk. No exit leads east, so the
 * water on that edge is never asked about.
 *
 * Out in the sea stand the Candles, the stumps of Veymar's sea-lights, in a line
 * along the drowned sea-wall: rock in the water, standing its face up like the
 * barrow's. There is no tide (decision 117), so the nearest is reached along
 * the wall's top where it still shows, a line of dressed stone out from the spit
 * that is always there and easy to miss, and the warden's niche is at its foot.
 * The wall's top is two tiles wide, the narrowest a walk is routed along: one,
 * exactly a body, was walked only in a straight line from the spit's end.
 */
export const BEACH_LAYOUT = layoutZone(
  'beach',
  `
    .....................===.....................
    .....................===.....................
    .....................===.....................
    .....................===.....................
    .....................===.....................
    .....................===.....................
    .....................===.....................
    .............................................
    :::::::::::::::::::::::::::::::::::::::::::::
    ::::::::::::::::::::::@::::::::::::::::::::::
    ::::::::::::::::::::::::::::::::::::::::b::::
    ::::::b::::::::a:::::::::::::a:::::::::::::::
    :::::::::::::::::::::::::::::::::::::::::::::
    ::::::::::::::::::::::::::::::::::::::::::c::
    :::::::::a:::::::::::::::::::::::::::::::::::
    ::::::::::::::::::::a:::::::::::::a::::::::::
    :::::::::::::::::::::::::::::::::::::::::::::
    :::::::::::::::::::::::::::a:::::::::::b:::::
    ::::::::::::a::::::::::::::::::::::::::::::::
    :::::::s::::::::::::::s::::::::::::::::::::::
    ::::~~~~~f~~~~~~f~~~~~~~f~~~~~~f~~~~~~f~~~~~~
    ::::~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    ::::~~~~~~~#~~~~~#~~~~~#~~~~~#~~~~~#~~~~~#~~~
    ::::_______n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    ::::________~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    ::::~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    :::::::::s:::::::::::::::::::::::::::::::::::
    :::::::::::::::::::::::::::s:::::::::::::::::
    :::::::::::::::::b:::::::::::::::b:::::::c:::
    :::::::::::::::::::::::::::::::::::::::::::::
    :::::::::::::::::::::::::::::::::::::::::::::
    :::::::::::::::::::::::::::::::::::::::::::::
  `,
  {
    '@': { start: true, on: 'sand' },
    // On the sea's north row, fished from the shore like the Lampton pond.
    f: { node: 'ocean-fishing-spot', on: 'water' },
    // At the nearest Candle's foot, at the end of the sea-wall's top.
    n: { secret: 'warden-niche', on: 'stone' },
    // Samphire, on the sand at the water's edge where the salt reaches it: the
    // starter band's herb (version 2 phase E2).
    s: { node: 'samphire', on: 'sand' },
    /**
     * Crabs on the sand, away from the grass where the road from Lampton comes
     * down, and a few across the water on the southern strand. Every zone in
     * the starter band is level 1-3, so which one to visit is a question of what
     * you need (parts, food, ore or gear) rather than of what you can survive.
     */
    a: { mob: 'crab', level: 1, on: 'sand' },
    b: { mob: 'crab', level: 2, on: 'sand' },
    c: { mob: 'crab', level: 3, on: 'sand' },
  },
);
