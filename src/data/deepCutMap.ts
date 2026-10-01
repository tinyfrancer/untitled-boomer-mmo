import { layoutZone } from './zoneText';

/**
 * The Deep Cut (decision 121, `docs/lore/places.md`): the New Cut's shaft
 * followed down until it stopped being a shaft, into what were the outer
 * workings of Karn Tholl. Solid rock, read south to north the way it is walked,
 * and depth is the dial the whole way down.
 *
 * The way in is a mouth seven tiles across the south edge, the shaft's own
 * width, and the New Cut's north edge opens at the shaft's head across the same
 * seven, so a body comes down the shaft and arrives at the foot of it. The shaft
 * opens into the goblins' gallery, rough and wide, rock left standing in it and
 * water in its east end where the crawlers come up. Off it the goblins followed
 * two workings north, coal at their near ends and rich iron at their backs.
 *
 * Between the workings is the dwarves' road, cut square and lined in dressed
 * stone, which the goblins broke into from the gallery; it goes north into the
 * hall where they stopped digging, at the door in its north wall. A passage off
 * the hall's east side ends a wall short of the east working, where the mark is
 * cut: the goblins dug to within a wall of it and never through.
 */
export const DEEP_CUT_LAYOUT = layoutZone(
  'deep-cut',
  `
    #############################################
    ##############%%%%%%%%%%%%%%%%%##############
    ##############%_______n_______%%%%%##########
    ##############%_________________k_%##########
    ##############%_____c_______e_____%##########
    ######w____###%___________________%____w#####
    ######_____###%__e_______c____%%%%%_____#####
    ####____c___##%_______________%##________####
    ####_______w##%_______________%##w__c____####
    ####________##%%%%%_______%%%%%##________####
    ####________######%_______%######________####
    ####___##___######%_______%######___##___####
    ####___##___######%___e___%######___##___####
    ####_b______######%_______%######______b_####
    ####________######%_______%######_b______####
    ####______b_######%_______%######________####
    ####v_______######%_______%######_______v####
    ####________######%_______%######________####
    ##########__________________v______##########
    #######v_________________________a____#######
    #######____________a___________________v#####
    #####________##_______________##____~~~_#####
    #####v_______##___________a___##____~~~_#####
    #####____a__________________________~~~_#####
    #######__________v_________________a__#######
    ###################_______###################
    ###################_______###################
    ###################_______###################
    ###################___@___###################
    ###################_______###################
    ###################_______###################
    ###################_______###################
  `,
  {
    '@': { start: true, on: 'stone' },
    // In the hall's north wall, where the goblins stopped.
    n: { secret: 'sealed-door', on: 'stone' },
    // In the north wall at the end of the passage off the hall.
    k: { secret: 'makers-mark', on: 'stone' },
    /**
     * The seams, and the whole of what the zone is gated by: coal round the
     * gallery and at the near end of each working, rich iron at the back of
     * both, so the deeper a seam the higher the level that opens it. Nothing
     * here needs a key; what stops a character at the mouth of a working is the
     * pick in their hands, and `tests/systems/deepCut.test.ts` holds that. Each
     * stands against rock, never a body's width off it.
     */
    v: { node: 'coal-vein', on: 'stone' },
    w: { node: 'rich-iron-vein', on: 'stone' },
    /**
     * Nothing aggressive stands between the way in and the workings: the shaft,
     * where a traveller arrives and a death puts them, and the gallery hold only
     * crawlers, passive and armoured and slow. The levels climb with depth, the
     * quarry's dial one zone down: the fives in the gallery and halfway up the
     * workings, the sixes at the workings' backs over the rich seams and in the
     * hall in front of the door.
     */
    a: { mob: 'cave-crawler', level: 5, on: 'stone' },
    b: { mob: 'goblin-miner', level: 5, on: 'stone' },
    c: { mob: 'goblin-miner', level: 6, on: 'stone' },
    e: { mob: 'cave-crawler', level: 6, on: 'stone' },
  },
);
