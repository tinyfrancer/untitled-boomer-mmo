import type { ItemId, SecretId, ZoneId } from '../types/ids';
import { TILE_SIZE } from '../config/constants';

/**
 * What a zone hides (decision 117): a small thing drawn in the world, unnamed
 * and on neither map, often down a way that is not obvious. Walking up to it
 * finds it, once per character: Wick says what it is, and whatever was left
 * there is the player's. The zone's map counts how many of its own are found.
 *
 * Where each one lies is its zone's text (`data/zoneText.ts`), and what each is
 * drawn as is `art/places.ts`. What they are, and what they were, is
 * `docs/lore/places.md`: a new one starts there.
 */
export interface SecretDefinition {
  id: SecretId;
  zoneId: ZoneId;
  /** What it is, heading the card that says so. */
  name: string;
  /** What Wick says on finding it, the once: short, and in its voice (`docs/lore/tone.md`). */
  line: string;
  /** What was left there: coin always, and now and then something worth having. */
  cache: { copper: number; items: readonly { itemId: ItemId; quantity: number }[] };
  /**
   * The body it stands in, for one that stands up out of the ground rather than
   * lying on it: centred on its point, as a node's trunk is.
   */
  blocks: { width: number; height: number } | null;
}

export const SECRETS: Record<SecretId, SecretDefinition> = {
  // Where the town gets its name, and the first stir (`docs/lore/spirit.md`):
  // in the crossroads for anybody to walk up to, which makes it the secret most
  // players find first, and the one that tells them there are others.
  'lamp-stone': {
    id: 'lamp-stone',
    zoneId: 'town',
    name: "The Lamp Stone's Words",
    line: "There's writing round the foot of this stone, under the dirt. I know this shape. I don't know why I know this shape.",
    cache: { copper: 12, items: [] },
    blocks: { width: TILE_SIZE / 2, height: TILE_SIZE / 4 },
  },
  // Round the back of the Wet Boot, where the rats come up. The pick is whoever
  // tried to dig His Majesty out, and gave up.
  'cellar-hatch': {
    id: 'cellar-hatch',
    zoneId: 'town',
    name: 'The Cellar Hatch',
    line: 'The rats come up through here. It goes down a lot further than a cellar ought to.',
    cache: { copper: 20, items: [{ itemId: 'pickaxe', quantity: 1 }] },
    blocks: null,
  },
  // In the nearest Candle, out along the rocks at the spit's end. There is no
  // tide (decision 117), so the way out is always there and easy to miss.
  'warden-niche': {
    id: 'warden-niche',
    zoneId: 'beach',
    name: "The Warden's Niche",
    line: "It's cold where the light was. Can we go back now? It's pulling.",
    cache: { copper: 30, items: [] },
    blocks: null,
  },
  // Behind the New Cut's face, where the third blast broke in this spring and
  // the crew carried out a cracked lantern with nothing in it. Wick was the
  // nothing in it (`docs/lore/spirit.md`), and this is where it remembers so.
  'broken-cell': {
    id: 'broken-cell',
    zoneId: 'quarry',
    name: 'The Broken Cell',
    line: "I was in there. I don't want to be in there.",
    cache: { copper: 25, items: [] },
    blocks: null,
  },
  // In the back wall of the waystation's hall, past every Red Rag in the yard.
  // A lamp-warden's light was kept here for travellers; a bandit's purse is now.
  'lamp-niche': {
    id: 'lamp-niche',
    zoneId: 'bandit-camp',
    name: 'The Lamp Niche',
    line: "There was a light in here once, for people on the road. It's somebody's purse now.",
    cache: { copper: 50, items: [] },
    blocks: null,
  },
  // At the end of the low passage under the Cellar's guardroom: the strongbox off
  // the pay-cart Hollis guarded and drove off the road, its Company seal broken,
  // and his grave gold in it now. Merrath's face is on the gold, and Wick knows
  // the face before it knows why (`docs/lore/spirit.md`).
  strongbox: {
    id: 'strongbox',
    zoneId: 'bandit-hideout',
    name: 'The Company Strongbox',
    line: "That's the Company's box, and that isn't the Company's face on the gold. Put it away. Please.",
    cache: { copper: 80, items: [] },
    blocks: null,
  },
  // Along the barrow's gallery: Veymar's coast with its sea-lights burning, the
  // first picture of the kingdom as it was. The coin at its foot is what the
  // fenfolk left for the dead before the water came in.
  'sea-light-frieze': {
    id: 'sea-light-frieze',
    zoneId: 'sunken-barrow',
    name: 'The Sea-Light Frieze',
    line: 'Lights all along the sea, and the water kept back behind them. It looked smaller, with the lights on.',
    cache: { copper: 150, items: [] },
    blocks: null,
  },
  // Under the millpond, where the stream pooled below the hills and the elves
  // said goodbye to Veymar, until the first charter dammed it. The coin in the
  // shallows is the village's, thrown in the year the winter would not end.
  'pond-shrine': {
    id: 'pond-shrine',
    zoneId: 'old-mill-road',
    name: 'The Shrine Under the Pond',
    line: "There's carving down there, under the water. All leaves. Somebody made that to be sad at.",
    cache: { copper: 45, items: [] },
    blocks: null,
  },
  // In the Old Mill, against the west wall: the first charter's accounts, the
  // last eleven years of them the Grey Winter, and the mill's last takings in
  // the box it was kept in.
  'charter-ledger': {
    id: 'charter-ledger',
    zoneId: 'old-mill-road',
    name: "The First Charter's Ledger",
    line: 'Eleven years of entries, and every one of them says it was cold. Then they stop.',
    cache: { copper: 60, items: [] },
    blocks: null,
  },
  // In the ford at Greyford, by the pier it fell from: the middle stone of the
  // Veymari bridge, a lamp cut into it. Carters throw a coin in for luck.
  'bridge-keystone': {
    id: 'bridge-keystone',
    zoneId: 'greyford',
    name: 'The Bridge Keystone',
    line: "That held a bridge up, once. There's a lamp cut into it. Whoever built this liked lamps as much as I do.",
    cache: { copper: 35, items: [] },
    blocks: null,
  },
  // The fettler's store behind the longhouse, where grave goods wait to be
  // reworked and nobody asks: a lamp-warden's ring among them, and Wick's beat
  // for Greyford (`docs/lore/spirit.md`), that it wore one.
  'back-room': {
    id: 'back-room',
    zoneId: 'greyford',
    name: "The Fettler's Back Room",
    line: "That ring's mine. No, one like it. I had one like it.",
    cache: { copper: 40, items: [{ itemId: 'reforging-stone', quantity: 1 }] },
    blocks: null,
  },
};

/**
 * How near the player's body has to come to find one: a tile and a quarter,
 * measured from the middle of the body, so standing on the next tile over
 * finds it but walking past on the far side of a road does not.
 */
export const SECRET_REACH = TILE_SIZE * 1.25;
