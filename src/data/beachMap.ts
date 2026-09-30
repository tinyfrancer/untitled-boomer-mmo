import { layoutZone } from './zoneText';

/**
 * Grass along the north where the town road arrives, sand through the middle,
 * and the ocean across the south, though no longer across the whole of it:
 * the road to the fen took that.
 *
 * An exit keeps a strip of its own edge for arrivals along its whole length,
 * `ARRIVAL_INSET` in, which is the second row up. Opening a road south meant
 * that row had to be walkable end to end, and it was open water. So the ocean
 * stops two rows short and runs off the east edge instead, leaving a sand spit
 * down the west side and a strand along the south. The spit is the only way
 * down to the fen road, which is better than a road that starts anywhere: the
 * water still shapes the walk. No exit leads east, so the water on that edge is
 * never asked about.
 */
export const BEACH_LAYOUT = layoutZone(
  'beach',
  `
    .........................
    .........................
    .........................
    .........................
    .........................
    .........................
    :::::::::::::::::::::::::
    :::::::::::::::::::::::::
    :::::::::::::::::::::::::
    ::::::::::::@:::::a::::::
    ::::::a::::::::::::::::::
    :::::::::::::a:::::::::::
    :::::::::::::::::::::::::
    :::::::::b:::::::::::c:::
    ::::::::::::::::b::::::::
    ::~~~~~~f~~~~f~~~~f~~~~~~
    ::~~~~~~~~~~~~~~~~~~~~~~~
    :::::::::::::::::::::::::
    :::::::::::::::::::::::::
  `,
  {
    '@': { start: true, on: 'sand' },
    // On the ocean's north row, fished from the shore like the town pond.
    f: { node: 'ocean-fishing-spot', on: 'water' },
    /**
     * Crabs on the sand, away from the grass where the road from town arrives.
     * Every zone in the starter band is level 1-3, so which one to visit is a
     * question of what you need (parts, food, ore or gear) rather than of what
     * you can survive.
     */
    a: { mob: 'crab', level: 1, on: 'sand' },
    b: { mob: 'crab', level: 2, on: 'sand' },
    c: { mob: 'crab', level: 3, on: 'sand' },
  },
);
