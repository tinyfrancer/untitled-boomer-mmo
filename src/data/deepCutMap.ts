import { layoutZone } from './zoneText';

/**
 * The quarry's shaft, followed north until it stopped being a quarry: solid
 * rock with the workings cut out of it, which is the hideout's trick rather
 * than the outdoor maps'. What makes it a different place from the hideout is
 * the shape: not two rooms and a corridor to be fought along, but a gallery
 * you arrive in and two faces worked at the far end, with the hall between
 * them wide enough that nothing here is a bottleneck. Creatures do not path,
 * so a chaser steers straight at the player and slides along whatever it
 * hits, and a map of narrow passages is a map where geometry decides the
 * fight.
 *
 * The gallery spans the full width of the south edge, for the reason the
 * hideout's west wall is not a doorway: an arrival keeps the fraction of the
 * edge it was crossed at, so a mouth only as wide as the road up would drop
 * most travellers inside the rock. The two workings each overlap the hall, so
 * the whole map is one connected space.
 */
export const DEEP_CUT_LAYOUT = layoutZone(
  'deep-cut',
  `
    #########################
    #########################
    ###############________##
    ##_______######____w_c_##
    ##_w_c___######_d______##
    ##_______######________##
    ##_____d_######________##
    ##_______######__c_____##
    ##_________________bv__##
    ##_v_b______@_a________##
    ##____________v_#########
    #########__a____#########
    #########_v_____#########
    #########_______#########
    #########_______#########
    _________________________
    _____a_____________a_____
    _________________________
    _________________________
  `,
  {
    '@': { start: true, on: 'stone' },
    /**
     * The seams, and the whole of what the zone is gated by: coal in the hall
     * and at the near end of each working, rich iron at the back of both, so the
     * deeper a seam the higher the level that opens it. Nothing here needs a
     * key; what stops a character at the mouth of a working is the pick in their
     * hands, and `tests/systems/deepCut.test.ts` holds that.
     */
    v: { node: 'coal-vein', on: 'stone' },
    w: { node: 'rich-iron-vein', on: 'stone' },
    /**
     * Nothing aggressive stands between the way in and the hall: the gallery,
     * where a traveller arrives anywhere along the south edge, holds only
     * crawlers, passive and armoured and slow. The levels climb with depth, the
     * quarry's dial one zone down, and the miners hold the far ends of both
     * workings, standing over the rich seams they are cutting.
     */
    a: { mob: 'cave-crawler', level: 5, on: 'stone' },
    b: { mob: 'goblin-miner', level: 5, on: 'stone' },
    c: { mob: 'goblin-miner', level: 6, on: 'stone' },
    d: { mob: 'cave-crawler', level: 6, on: 'stone' },
  },
);
