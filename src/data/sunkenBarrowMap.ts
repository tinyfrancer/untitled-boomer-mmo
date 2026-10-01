import { layoutZone } from './zoneText';

/**
 * The Sunken Barrow (decision 119, `docs/lore/places.md`): Orlhal, Orlath's
 * barrow, the Cutthroat's Cellar one band up on purpose, cut out of the rock under
 * the fen's southern edge and lined with dressed stone. It is read north to
 * south, the way it is walked, and depth is the difficulty dial the whole way
 * down.
 *
 * The way in is a mouth five tiles across the north edge, where the fen drains
 * in at the head of the stair: an exit is open only along its mouth (decision
 * 119), so an arrival lands across those five tiles and the rest of the edge is
 * rock. The stair comes down into the antechamber, and from its foot a passage
 * goes on down to the gallery, which runs the width of the barrow with the
 * frieze of the sea-lights along its north wall. The crypts open off either end
 * of the gallery, the dead laid in them, and the king's chamber off its middle,
 * straight on from the stair: he is the deepest thing here, with two of his own
 * in front of him and the room behind him to stand in.
 *
 * The water that followed the fen in lies in the corners of the rooms, never
 * across a way through, so nothing is pinned against it and no route goes round
 * it. Every passage is three tiles across or more.
 */
export const SUNKEN_BARROW_LAYOUT = layoutZone(
  'sunken-barrow',
  `
    ###################%_____%###################
    ###################%_____%###################
    ###################%_____%###################
    ###################%__@__%###################
    ###################%_____%###################
    ############%%%%%%%%_____%%%%%%%%############
    ############%_________________~~%############
    ############%_________________~~%############
    ############%__a________________%############
    ############%___________________%############
    ############%________________a__%############
    ############%~~_________________%############
    ############%~~_________________%############
    ############%%%%%%%%%___%%%%%%%%%############
    ####################%___%####################
    ####################%___%####################
    ###%%%%%%%%%%%%%%%%%%___%%%%%%%%%%%%%%%%%%###
    ###%__________f__________________________%###
    ###%____a___________________________a____%###
    ###%_____________________________________%###
    #%%%%____%%%%%%%%%%%_____%%%%%%%%%%%____%%%%#
    #%_________~~%##%___________%##%~~_________%#
    #%_________~~%##%___________%##%~~_________%#
    #%__b________%##%_b_______b_%##%________b__%#
    #%___________%##%___________%##%___________%#
    #%___________%##%___________%##%___________%#
    #%_______b___%##%___________%##%___b_______%#
    #%___________%##%___________%##%___________%#
    #%~~_________%##%_____c_____%##%_________~~%#
    #%~~_________%##%~~_______~~%##%_________~~%#
    #%%%%%%%%%%%%%##%~~_______~~%##%%%%%%%%%%%%%#
    ################%%%%%%%%%%%%%################
  `,
  {
    '@': { start: true, on: 'stone' },
    // Along the gallery's north wall, west of where the passage comes down.
    f: { secret: 'sea-light-frieze', on: 'stone' },
    /**
     * The sevens hold the antechamber and the gallery, standing off the middle
     * where the stair and the passage come through, and the eights are in the
     * crypts and the king's chamber, all of them deeper than every seven. The
     * stair is empty, the rule the Cellar's guardroom keeps: a locked door with
     * an ambush behind it is a trap rather than a zone.
     */
    a: { mob: 'barrow-wight', level: 7, on: 'stone' },
    b: { mob: 'barrow-wight', level: 8, on: 'stone' },
    /**
     * The king, last and deepest, two of his in front of him: he is fought last
     * or he is fought with company. He is a tile and a half tall, and stands
     * two rows off the chamber's back wall, the room behind him where he turns
     * round on the way home (decision 116).
     */
    c: { mob: 'barrow-king', level: 8, on: 'stone' },
  },
);
