import { layoutZone } from './zoneText';

/**
 * The cut stone floor, grass along the south where the road from town
 * arrives, and the rock face across the north, though no longer across the
 * whole of it: the road to the Deep Cut took that.
 *
 * An arrival lands anywhere along the edge it crosses, a tile and a half in,
 * so opening a road north meant the second row had to be walkable end to end,
 * and it was solid rock. The beach paid this bill in water and the quarry pays
 * it in stone: the face moved down to rows 2-4, a shelf runs along the top of
 * it, and the middle is open where the shaft was driven north. The two iron
 * veins already stood in that opening, hard against the face, which is what
 * the fiction now says the cut was following.
 *
 * The face stops two columns short of the west edge as well, where the road
 * to Greyford leaves: what is left there is a ledge running north under the
 * rock, which is the road.
 */
export const QUARRY_LAYOUT = layoutZone(
  'quarry',
  `
    _________________________
    _________________________
    __#####___________#######
    __#####____w_____w#######
    __#####_______c___#######
    __________v______________
    _______________v_________
    ______v____________v_____
    _____b___________________
    ____________@_______b____
    _________________________
    _______a__________a______
    _________________________
    ___________a_____________
    _________________________
    .........................
    .........................
    .........................
    .........................
  `,
  {
    '@': { start: true, on: 'stone' },
    /**
     * Tin across the open floor and iron hard against the face at the back: the
     * shape the pond and the ocean make, the gated one further from the way in,
     * so the level that opens it is earned on the walk to it.
     */
    v: { node: 'tin-vein', on: 'stone' },
    w: { node: 'iron-vein', on: 'stone' },
    /**
     * The rats that got in among the spoil heaps, climbing a level with depth:
     * the road in is the south edge, so the further north the less anyone should
     * want to stand there with a pickaxe out. Nothing new lives here, on purpose:
     * what makes the quarry worth the walk is the veins, not a creature.
     */
    a: { mob: 'rat', level: 1, on: 'stone' },
    b: { mob: 'rat', level: 2, on: 'stone' },
    c: { mob: 'rat', level: 3, on: 'stone' },
  },
);
