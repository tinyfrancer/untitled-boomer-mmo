import { layoutZone } from './zoneText';

/**
 * The hideout: rock with rooms cut out of it, two of them joined by a
 * corridor, the entrance hall on the west where the player arrives from the
 * camp and a larger chamber on the east. The corridor is two tiles tall, so it
 * is wider than the player and a slow frame cannot wedge them in it.
 *
 * The whole west edge is the way in, running the height of the map. Not a
 * doorway: an arrival keeps the fraction of the edge the player crossed at,
 * so a passage only as tall as the corridor would drop them inside the rock
 * for most of that range. It is also where the signpost back to the camp
 * stands.
 */
export const BANDIT_HIDEOUT_LAYOUT = layoutZone(
  'bandit-hideout',
  `
    ___######################
    ___######################
    ___######################
    ___###########_________##
    ___###########_________##
    ___###########_a_______##
    _________#####_________##
    _________#####_________##
    _________________a_____##
    ____________@______c___##
    _________#####_________##
    _________#####___b_____##
    _________#####_________##
    ___###########_b_______##
    ___###########_________##
    ___###########_________##
    ___######################
    ___######################
    ___######################
  `,
  {
    '@': { start: true, on: 'stone' },
    /**
     * The entrance hall is left clear so arriving is not an ambush, and
     * everything stands in the chamber beyond the corridor, in the starter
     * band: what makes this worth the key is what drops here.
     */
    a: { mob: 'bandit', level: 2, on: 'stone' },
    b: { mob: 'bandit', level: 3, on: 'stone' },
    /**
     * The chief, level 4, the one thing in the starter zones above the band, at
     * the back of the chamber so the men in front of him are fought first.
     */
    c: { mob: 'bandit-chief', level: 4, on: 'stone' },
  },
);
