import { layoutZone } from './zoneText';

/**
 * The barrow: the hideout's map one band up, cut out of solid rock and read
 * north to south, the way it is walked. The mouth along the north edge where
 * the fen drains in, a stair down into the antechamber, the spine through the
 * middle, a transept across it with the dead laid in either arm, and the
 * king's chamber at the bottom. Depth is the difficulty dial the whole way
 * down.
 *
 * The whole north edge is the mouth, for the reason the hideout's west wall is
 * a wall rather than a doorway: an arrival keeps the fraction of the edge it
 * was crossed at, and `tests/systems/ZoneSystem.test.ts` sweeps that.
 *
 * The water that followed the fen in is small and scattered, and one rule
 * further than the fen's: creatures do not path, so standing water in the
 * stair or the spine would be a wight wedged in the only way through. The
 * flooding is in the arms of the transept and the corners of the chamber.
 */
export const SUNKEN_BARROW_LAYOUT = layoutZone(
  'sunken-barrow',
  `
    _________________________
    _________________________
    _________________________
    ###########___###########
    #####_______________#####
    #####_______________#####
    #####___a________a__#####
    #####_______________#####
    ###########___###########
    ####~~______@________####
    ####__a___________a~~####
    ###########___###########
    ######_____________######
    ######__b_______b~~######
    ######_____________######
    ######~~_b_____b___######
    ######______c______######
    ###########___###########
    #########################
  `,
  {
    '@': { start: true, on: 'stone' },
    /**
     * The sevens hold the antechamber and the transept, and the eights are down
     * in the king's chamber with him. The mouth is empty, the rule the hideout's
     * entrance hall set: a locked door with an ambush behind it is a trap rather
     * than a zone. The antechamber's pair stand off its middle, where the stair
     * comes in and where anyone who wants out goes.
     */
    a: { mob: 'barrow-wight', level: 7, on: 'stone' },
    b: { mob: 'barrow-wight', level: 8, on: 'stone' },
    /**
     * The king, last, with four of his between the way in and him: he is fought
     * last or he is fought with company. He is a tile and a half tall, and in
     * the chamber's last row he stood with his feet in the rock, so he never got
     * home once led off it; the alcove behind him is the room he stands in
     * (decision 116).
     */
    c: { mob: 'barrow-king', level: 8, on: 'stone' },
  },
);
