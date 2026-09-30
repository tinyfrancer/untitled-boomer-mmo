import { layoutZone } from './zoneText';

/**
 * The New Cut (decision 118, `docs/lore/places.md`): the Company's quarry in the
 * south face of the Greyhills, opened this spring. Turf along the south where
 * Lampton's quarry road comes up to the lip, the cut floor through the middle,
 * and the face across the north, the hill wrapping down the east side.
 *
 * Every edge but the east is somebody's arrival strip, and an arrival lands
 * anywhere along the edge it crosses, a tile and a half in. So the face stops
 * two rows short of the north edge, leaving a shelf along the top that the
 * Deep Cut's travellers come up onto, and two columns short of the west edge,
 * leaving the ledge the road to Greyford runs along. The shaft is cut through
 * the middle of the face to the shelf, the iron it was following standing
 * either side of its mouth.
 *
 * A ridge of rock runs across the pit with a ramp through its middle, so the
 * floor is two benches: the lower one near the way in, tin and the smallest
 * rats, and the upper one under the face, iron and the biggest. The spoil
 * heaps are the side paths, and one of them stands in front of the breach the
 * third blast made into the broken cell, a little room behind the face that is
 * easy to walk past.
 */
export const QUARRY_LAYOUT = layoutZone(
  'quarry',
  `
    _____________________________________________
    _____________________________________________
    __#################_______###################
    __#################w_____w########_n__#######
    __#################_______########____#######
    __#################_______#########__########
    __#####__w___####__________########__########
    _______________________________w________#####
    ________c______________c________________#####
    ___________##__v_________________###____#####
    ___________##_____________v______###____#####
    ______b____________b__________c_________#####
    ____________________________________b___#####
    _________#########_____###########______w####
    _________#########_____###########_______####
    _____________________________________v___####
    ____v________b_______v_______b___________####
    ________a________________________________####
    _____________v_______________##________######
    ______##_____________________##________######
    ______##_________##_____________a______######
    _________________##______v_____________######
    ___a______________________________v______####
    __________v____a___________a__________a__####
    ____________________a____________________####
    ....________................_________________
    ......................@......................
    .....................===.....................
    .....................===.....................
    .....................===.....................
    .....................===.....................
    .....................===.....................
  `,
  {
    '@': { start: true, on: 'grass' },
    /**
     * Tin across both benches in twos and threes and iron hard against the face
     * and the hill: the shape the pond and the ocean make, the gated ore further
     * from the way in, so the level that opens it is earned on the walk to it.
     * A vein stands against rock or two tiles clear of it, never a body's width
     * off, since a slot one body wide is somewhere nobody is routed through.
     */
    v: { node: 'tin-vein', on: 'stone' },
    w: { node: 'iron-vein', on: 'stone' },
    // In the broken cell, at the back of the room the third blast opened.
    n: { secret: 'broken-cell', on: 'stone' },
    /**
     * The rats that got in among the spoil, climbing a level with depth: the way
     * in is the south edge, so the further north the less anyone should want to
     * stand there with a pickaxe out. Nothing new lives here, on purpose: what
     * makes the Cut worth the walk is the veins, not a creature.
     */
    a: { mob: 'rat', level: 1, on: 'stone' },
    b: { mob: 'rat', level: 2, on: 'stone' },
    c: { mob: 'rat', level: 3, on: 'stone' },
  },
);
