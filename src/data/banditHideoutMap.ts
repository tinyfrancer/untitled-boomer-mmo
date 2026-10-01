import { layoutZone } from './zoneText';

/**
 * The Cutthroat's Cellar (decision 119, `docs/lore/places.md`): the vault under
 * Redrag Camp's waystation, a lamp-warden's tomb Hollis keeps his hoard in. It is
 * cut out of the rock under the yard and lined with dressed stone, so every room
 * is walled in masonry and the hill is packed up behind it.
 *
 * The way in is a mouth five rows tall in the west edge, the stair down from the
 * lane behind the yard: an exit is open only along its mouth (decision 119), so
 * an arrival lands somewhere across these five rows rather than anywhere down the
 * side, and the rest of the west edge is rock. The stair opens into the
 * guardroom, which is left clear so that arriving is not an ambush; from it the
 * spine runs east to the tomb at the back, with the bunk room off its north side
 * and the storeroom, where the carts' takings go, off its south. The tomb is
 * the warden's, the bier against its back wall, and Hollis stands in front of it.
 *
 * From the storeroom's far corner, behind a pillar, a low passage runs back under
 * the guardroom to an alcove, where the Company's strongbox is.
 *
 * Every passage a creature can be led down is two tiles across or more, and every
 * pillar stands three off a wall or another pillar, since a slot a body's width
 * is somewhere a chase can push one and no route will take it out of.
 */
export const BANDIT_HIDEOUT_LAYOUT = layoutZone(
  'bandit-hideout',
  `
    #############################################
    #############################################
    #############################################
    #################%%%%%%%%%%%%%%%%############
    #################%______________%############
    #################%__a___________%############
    #################%_______a______%############
    #################%___%%____%%___%##%%%%%%%%%#
    #####%%%%%%%%%%##%___%%____%%___%##%_______%#
    #####%________%##%______________%##%_______%#
    #####%________%##%______________%##%_b_____%#
    #####%________%##%___________a__%##%_______%#
    %%%%%%________%##%______________%##%_______%#
    ______________%%%%%%%%%___%%%%%%%%%%_______%#
    _________________________________________%%%#
    _________@_____________________________c_%%%#
    _________________________________________%%%#
    ______________%%%%%%%%%___%%%%%%%%%%_______%#
    %%%%%%________%##%______________%##%_______%#
    #####%________%##%__a_________b_%##%_______%#
    #####%________%##%______________%##%_b_____%#
    #####%________%##%______________%##%_______%#
    #####%%%%%%%%%%##%___%%____%%___%##%_______%#
    ######%%%%%######%___%%____%%___%##%%%%%%%%%#
    ######%_s_%######%______________%############
    ######%___%%%%%%%%_______a______%############
    ######%_________________________%############
    ######%_________________________%############
    ######%%%%%%%%%%%%%%%%%%%%%%%%%%%############
    #############################################
    #############################################
    #############################################
  `,
  {
    '@': { start: true, on: 'stone' },
    // In the alcove at the end of the low passage, against its back wall.
    s: { secret: 'strongbox', on: 'stone' },
    /**
     * The bunk room and the storeroom hold the twos, and a three stands among
     * the storeroom's twos; the tomb holds the other threes, between the spine
     * and Hollis, so the deeper in the harder, and he is fought last or with
     * company. Nothing stands within a wander and an aggro radius of the
     * start, which is where a death in here puts somebody.
     */
    a: { mob: 'bandit', level: 2, on: 'stone' },
    b: { mob: 'bandit', level: 3, on: 'stone' },
    /**
     * Hollis, level 4, the one thing in the starter zones above the band, in
     * front of the warden's bier at the back of the tomb.
     */
    c: { mob: 'bandit-chief', level: 4, on: 'stone' },
  },
);
