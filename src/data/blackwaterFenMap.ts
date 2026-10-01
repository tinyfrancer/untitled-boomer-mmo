import { layoutZone } from './zoneText';

/**
 * Blackwater Fen (decision 121, `docs/lore/places.md`): Veymar's low country
 * under a man's depth of black water, south of Candle Strand. The strand along
 * the north is where the beach road arrives, open end to end, and the Company's
 * salt pans are cut into its eastern end, two rows of four with a drain run
 * straight down out of the marsh to feed them and a crossing of stone over it.
 * Everything below the sand is marsh, and the further south the worse the
 * company: depth is the dial.
 *
 * The mere in the west has a village under it, a chimney or two still standing
 * out of the water, and the deep pools where the eels are lie through the
 * middle and the south, each with a raider over it. At the bottom the water
 * closes in either side of a causeway to the barrow's door: its kerb of dressed
 * stone across the south edge and the threshold between, which is the mouth
 * the barrow is entered at (decision 119), five tiles across and the same five
 * as the barrow's own. The rest of that edge is water and does not leave.
 *
 * In the reeds of the south-west a holm stands off on its own, water all round
 * it but a neck of reed two tiles wide, and on it a lantern still burning.
 */
export const BLACKWATER_FEN_LAYOUT = layoutZone(
  'blackwater-fen',
  `
    :::::::::::::::::::::::::::::::::::::::::::::
    :::::::::::::::::::::::::::::::::::::::::::::
    ::::::::::@::::::::::::::::::::::::::::::::::
    ::::::::,,,,,,:::::::::::::::::::::::::::::::
    ,,,,,,,,,,,,,,,,,,,,,,,,:::~~~:~~~:~~~:~~~:::
    ,,,m,,,,,,,,,,,,,,,,,,,,:::~~~:~~~:~~~:~~~:::
    ,,,,,,,,,,m,,,,,,,,,,,,,:::::::::::::::::::::
    ,,,,,,K,,,,,,,,,,,,,,,,,:::~~~:~~~:~~~:~~~:::
    ,,,,,,,,,,,,,,,,,,m,,,,,:::~~~:~~~:~~~:~~~:::
    ,,,,~~~~~,,,,,,,,,,,~~,,:::~~::::::::::::::::
    ,,,~~~~~~~,,,,b,,,,,~~,,:::~~::::::::::::::::
    ,,~~~~~~~~~,,,,,a,,,,,,,,,,~~,,,,,,,,,,b,,,,,
    ,,~~~~~~~%~~,,,,,,,,,,,,,,,~~,,,,,a,,,,,,,a,,
    ,~~~%~~~~~~~,m,,,,,,,,,b,,,~~,,,,,,,,,,,,,,,,
    ,~~~~~~~~~~~,,,,,,,,,,,,,,,~~,,,,,,,,~~,,,,,,
    ,,~~~~~~~~~~,,,,,,,,,,,,,,,__,,,,,,f~~~~,,,,,
    ,,~~~~~~~~~,,,,,~~,,,c,,,,,__,,,,,,~~~~~,,,,,
    ,,,,~~~v~~,,n,,~~~~f,,,,,,,~~,,,,c,~~~~~,,d,,
    ,,,,,,,,,,,,,,,~~~~~~,,,,d,~~,,,,,,,,,,~,,,,,
    ,,,,,,,,d,,,c,,~~~~~,,,,,,,~~,,,,,,,,,,,,,,,,
    ,,,,,,,,,n,,,,,,,,,,,,,,,,,~~,,,,,,,,,,,,,,,,
    ~~~~~~~~~,,~~,,,,,,g,,~~,,,~~,,,,,,,,,,,~~~,,
    ,,,,,,,,~,,~~~~f,,,,,,~~,,,~~,,f~~~~,,,,~~~,,
    ,,,,,,,,~,,~~~~~,e,,,,,,,,,~~e,~~~~~,,,,,,,g,
    ,,,,l,,,,,,f~~~~,,,,,,,,,n,,,,,~~~~f,,,,,,,,,
    ,,,,,,,,,,,,,,,,,,,,n,e,,,,,,,,,~~,,,e,,,,,,,
    ,,,,,,,,~,g,,e,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
    ,,,,,,,,~,,,,,,,,,,,,,,,,,,,,,,,,,,,g,,,,,,,,
    ~~~~~~~~~~~~~~~~~~~,,,,,,,~~~~~~~~~~~~~~~~~~~
    ~~~~~~~~~~~~~~~~%%%%_____%%%%~~~~~~~~~~~~~~~~
    ~~~~~~~~~~~~~~~~%%%%_____%%%%~~~~~~~~~~~~~~~~
    ~~~~~~~~~~~~~~~~%%%%_____%%%%~~~~~~~~~~~~~~~~
  `,
  {
    '@': { start: true, on: 'sand' },
    // Under the mere's south shore, seen from the bank.
    v: { secret: 'drowned-village', on: 'water' },
    // On the holm, over the barrow it keeps.
    l: { secret: 'kept-lantern', on: 'marsh' },
    // Maren, on the mere's north shore above the drowned village, where the
    // strand road brings the Company's people in and she can see them come
    // (D1b): out of every raider's reach, since she is the one who talks.
    K: { npc: 'keeper', on: 'marsh' },
    /**
     * The deep pools' fishing, each inside a raider's aggro radius: the fen
     * supplies the food that makes the upper band survivable, and the food is
     * behind the fight rather than beside it. Each spot is on its pool's edge,
     * since a spot in the middle of a pool is two tiles from any bank and
     * nobody could ever work it.
     */
    f: { node: 'deep-fishing-spot', on: 'water' },
    /**
     * The fenfolk's herbs (version 2 phase E2): bog myrtle on the higher marsh
     * of the north half, bogbean down among the pools where the water is
     * shallow, so the better herb is deeper in, the way the better eel is.
     */
    m: { node: 'bog-myrtle', on: 'marsh' },
    n: { node: 'bogbean', on: 'marsh' },
    /**
     * The level climbs the further south you go: the road in is along the north
     * edge, so depth is the dial, and retreating north means something. Raiders
     * and lurkers are interleaved rather than zoned, because the raider is what
     * stops you walking through and the lurker is what stops you standing still.
     * Every five is north of every six and every six of every seven, the start
     * is on the strand out of every raider's reach, and the deepest of them
     * stands on the causeway to the door, its aggro radius short of the mouth.
     */
    a: { mob: 'fen-raider', level: 5, on: 'marsh' },
    b: { mob: 'bog-lurker', level: 5, on: 'marsh' },
    c: { mob: 'fen-raider', level: 6, on: 'marsh' },
    d: { mob: 'bog-lurker', level: 6, on: 'marsh' },
    e: { mob: 'fen-raider', level: 7, on: 'marsh' },
    g: { mob: 'bog-lurker', level: 7, on: 'marsh' },
  },
);
