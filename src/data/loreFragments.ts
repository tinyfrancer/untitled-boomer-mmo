import type { EnemyId, LoreFragmentId, NpcId, SecretId } from '../types/ids';

/**
 * Where a fragment is found (decision 132): at a secret, the first time it is
 * found; off a creature, the first time one is put down; or in somebody's
 * answer, the first time it is heard, as an effect on that answer
 * (`data/dialog.ts`), which a test holds to the person named here.
 */
export type LoreSource =
  | { kind: 'secret'; secretId: SecretId }
  | { kind: 'kill'; enemyId: EnemyId }
  | { kind: 'told'; npcId: NpcId };

/**
 * A piece of the realm's history the player can find (D2): a paragraph in
 * `docs/lore/history.md`'s voice that says what the thing found shows, and
 * never more than the history does, nor anything of Wick's that its table in
 * `docs/lore/spirit.md` holds back. Noted in the Whispers journal once found.
 */
export interface LoreFragmentDefinition {
  id: LoreFragmentId;
  /** The journal's heading for it. */
  title: string;
  text: string;
  found: LoreSource;
}

const atSecret = (secretId: SecretId): LoreSource => ({ kind: 'secret', secretId });
const offKill = (enemyId: EnemyId): LoreSource => ({ kind: 'kill', enemyId });
const toldBy = (npcId: NpcId): LoreSource => ({ kind: 'told', npcId });

/** Every fragment, in the order the climb tends to find them. */
export const LORE_FRAGMENTS: Record<LoreFragmentId, LoreFragmentDefinition> = {
  'second-charter': {
    id: 'second-charter',
    title: 'The Second Charter',
    text: 'Thirty-one years ago the Crown of Aldmark gave the west to the Veymarch Company, the second time it had tried. Two years later the Company built Lampton at the crossroads, round a carved stone with an empty iron cage on top.',
    found: toldBy('shopkeeper'),
  },
  waymarker: {
    id: 'waymarker',
    title: 'A Waymarker',
    text: 'The Lamp Stone is older than the town by a long way. It marked a road nobody has used since, and the cage on top held a light for whoever was walking it. The words round its foot are a blessing on travellers, in a tongue nobody in Lampton reads.',
    found: atSecret('lamp-stone'),
  },
  undercroft: {
    id: 'undercroft',
    title: 'The Undercroft',
    text: "Under the Wet Boot the cellar goes down further than any cellar has a reason to, and the walls stop being the inn's and start being dressed stone. Lampton was built on top of something, and the rats know what.",
    found: atSecret('cellar-hatch'),
  },
  'the-candles': {
    id: 'the-candles',
    title: 'The Candles',
    text: 'The stumps off Candle Strand stand in a line along a wall that runs under the sea. Each was a tower once, with a niche at its foot for the one who kept it, and a light at its top.',
    found: atSecret('warden-niche'),
  },
  'cell-in-the-hill': {
    id: 'cell-in-the-hill',
    title: 'The Cell in the Hill',
    text: 'Somebody cut a room into the Greyhills no bigger than a cupboard, with a niche in it for a lantern and a line carved over the niche that nobody can read. It was sealed from the outside, and meant to stay so.',
    found: atSecret('broken-cell'),
  },
  waystation: {
    id: 'waystation',
    title: 'The Waystation',
    text: 'Redrag Camp is pitched in the ruin of a waystation on the old road east, where those who kept the lights rested on their way. A niche in its hall held a light for anybody on the road.',
    found: atSecret('lamp-niche'),
  },
  'kings-coin': {
    id: 'kings-coin',
    title: "A King's Coin",
    text: "The gold Hollis paid his men in is not Aldmark's. It is heavier, and the king struck on it wears a crown nobody in the Veymarch has seen on a living head. It came out of the ground, out of graves.",
    found: atSecret('strongbox'),
  },
  'hollis-crane': {
    id: 'hollis-crane',
    title: 'Hollis Crane',
    text: 'Eight years ago a Company pay-cart went off the east road with its guard. The guard was Hollis Crane, and the strongbox on the cart was the first thing he stole. The graves came after.',
    found: offKill('bandit-chief'),
  },
  'grey-winter': {
    id: 'grey-winter',
    title: 'The Grey Winter',
    text: "Seventy years ago the Crown's first charter put a village at the mill on the west road. Its accounts run eleven years. In the last of them the pond froze in summer and the wheel turned backwards on still nights, and then the entries stop. Aldmark blames goblins, and a hard frost.",
    found: atSecret('charter-ledger'),
  },
  'the-elves-goodbye': {
    id: 'the-elves-goodbye',
    title: "The Elves' Goodbye",
    text: 'Under the millpond is a shrine carved all over with leaves, older than the mill and older than the road. The village that dammed the stream drowned it. The one elf who had stayed asked them not to.',
    found: atSecret('pond-shrine'),
  },
  'the-bridge': {
    id: 'the-bridge',
    title: 'The Bridge at Greyford',
    text: "Greyford's ford is a fallen bridge, and its grey stones are the bridge's piers. The keystone has a lamp cut into it, the mark of a kingdom that put lights on its roads, its bridges and its coast.",
    found: atSecret('bridge-keystone'),
  },
  'wardens-ring': {
    id: 'wardens-ring',
    title: "A Warden's Ring",
    text: "Among the fettler's grave goods is a ring of the kind the lamp-wardens wore: families who kept the old lights all their lives, taught their children to keep them, and were buried with their rings.",
    found: atSecret('back-room'),
  },
  'salt-pans': {
    id: 'salt-pans',
    title: 'The Salt Pans',
    text: "Twelve years ago the Company cut its salt pans at the top of the fen, across the fenfolk's old channels south. The raids began within the year, and the Company has called the fenfolk raiders since.",
    found: toldBy('quartermaster'),
  },
  'low-country': {
    id: 'low-country',
    title: 'The Low Country',
    text: "Under the fen are farms and villages, a man's depth down, their roofs still showing in places. They were dry land once, lower than the sea, and something kept the sea off them until the night it did not.",
    found: atSecret('drowned-village'),
  },
  'the-keepers': {
    id: 'the-keepers',
    title: 'The Keepers',
    text: 'The lanterns in the fen are not left to burn. Each stands over a mound, and somebody tends each one, at night, with an offering at its foot. The fenfolk do not take kindly to anybody who goes near one.',
    found: atSecret('kept-lantern'),
  },
  'karn-tholl': {
    id: 'karn-tholl',
    title: 'Karn Tholl',
    text: "The door at the bottom of the Deep Cut is dwarven, barred from the far side and sealed with a mountain's peak in gold. It was shut six hundred years ago, the year the low country went under the sea, and has not been opened since.",
    found: atSecret('sealed-door'),
  },
  'a-reckoning': {
    id: 'a-reckoning',
    title: 'A Reckoning',
    text: 'A dwarf signs what they make and keeps account of what they are owed. The mark in the Deep Cut is both: a name, and under it a debt in strokes of five that goes on for most of a wall.',
    found: atSecret('makers-mark'),
  },
  'light-on-the-sea': {
    id: 'light-on-the-sea',
    title: 'Light on the Sea',
    text: "The barrow's gallery shows a coast with a tower every mile or so and a flame at the top of each, and fields behind them lower than the sea. The kingdom that carved it was called Veymar, and the name meant light on the sea.",
    found: atSecret('sea-light-frieze'),
  },
  orlath: {
    id: 'orlath',
    title: 'Orlath',
    text: 'Orlath, the gold-holder, was the richest of the barrow kings, laid in Orlhal three hundred years before the sea came in. A king of his kind slept in his body for as long as his lantern burned. His went out this summer.',
    found: offKill('barrow-king'),
  },
};
