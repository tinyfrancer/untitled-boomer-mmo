import { layoutZone } from './zoneText';

/**
 * The marsh south of the beach, where the sand gives out. The strand along
 * the north is where the beach road arrives and the only firm ground in the
 * zone; everything below it is marsh, and the further south the worse the
 * company. The barrow is at the bottom of it, so the south of the map is a
 * causeway rather than a road.
 *
 * The pools are small and scattered, never a wall. Water is a wall you can see
 * over, and creatures do not path: a pool wide enough to be worth walking round
 * is a pool a bog lurker gets pinned against. So none spans more than four
 * tiles, and none touches the north edge the road arrives on.
 *
 * The two deep pools, where the eels are, moved two rows north when the road
 * on to the barrow made the south edge an arrival strip: an arrival must land
 * clear of anything that opens a fight, and every deep pool has a raider over
 * it by design. Moving the water moved the men, and what it left is the
 * causeway the barrow's mouth is reached across.
 */
export const BLACKWATER_FEN_LAYOUT = layoutZone(
  'blackwater-fen',
  `
    :::::::::::::::::::::::::
    :::::::::::::::::::::::::
    :::::::::::::::::::::::::
    ,,,,,,,,,,,,,,,,,,,,,,,,,
    ,,,,,,,,,,,,,,,,,,,,,,,,,
    ,,,,,,,,,a,,,,,~~~~,,,,,,
    ,,,,~~~b,,,,,,,~~~~,,,,,,
    ,,,,~~~,,,,,,,,,,,b,,,,,,
    ,,,,,,,,,,,,,,,,,,,a,,,,,
    ,,,,,,,,,,,,@,,,,,,,,,,,,
    ,,,,c,,,~~~,,,,,,,,,,,,,,
    ,,,~~~~,~~~d~~~~~,,d,,,,,
    ,,,f~~~,,,,,f~~~f,~~~,,,,
    ,,,~~~~,,e,,~~~~~e~~~,,,,
    ,,,,,,,,,,,,,,,,,,,,,,,,,
    ,,,,,,,,,,,,,,,,,,,,,,,,,
    ,,,,,,,,,g,,,,g,,,,,,,,,,
    ,,,,,,,,,,,,,,,,,,,,,,,,,
    ,,,,,,,,,,,,,,,,,,,,,,,,,
  `,
  {
    '@': { start: true, on: 'marsh' },
    /**
     * The deep pools' fishing, each inside a raider's aggro radius: the fen
     * supplies the food that makes the upper band survivable, and the food is
     * behind the fight rather than beside it. Each spot is on its pool's edge,
     * since a spot in the middle of a pool is two tiles from any bank and
     * nobody could ever work it.
     */
    f: { node: 'deep-fishing-spot', on: 'water' },
    /**
     * The level climbs the further south you go: the road in is along the north
     * edge, so depth is the dial, and retreating north means something. Raiders
     * and lurkers are interleaved rather than zoned, because the raider is what
     * stops you walking through and the lurker is what stops you standing still.
     * No raider stands within its aggro radius of the south edge's arrival
     * strip, and none within its reach of the start: one once stood beside the
     * middle of the map, where a death respawns you, and `spawnSafety.test.ts`
     * holds that now.
     */
    a: { mob: 'fen-raider', level: 5, on: 'marsh' },
    b: { mob: 'bog-lurker', level: 5, on: 'marsh' },
    c: { mob: 'fen-raider', level: 6, on: 'marsh' },
    d: { mob: 'bog-lurker', level: 6, on: 'marsh' },
    e: { mob: 'fen-raider', level: 7, on: 'marsh' },
    g: { mob: 'bog-lurker', level: 7, on: 'marsh' },
  },
);
