import { ITEMS } from '../data/items';
import { POTION_EFFECTS } from '../data/potions';
import type { AbilityId, EffectId, ItemIconShape, ItemId } from '../types/ids';
import { frameKey, variantId } from './compile';
import type { Recolour, SpriteDef } from './format';
import type { SharedRampId } from './palette';
import { offhandAs, wieldedAs, wornAs } from './wardrobe';
import {
  BANDANA,
  BREECHES,
  CAP,
  CLOAKED_PLATE,
  COWL,
  CROWN,
  GREAVES,
  HAT,
  HELM,
  HOOD,
  JERKIN,
  PLATE,
  ROBE_PIECE,
  STUDDED_JERKIN,
  TRIMMED_ROBE,
  VEST,
  type Piece,
} from './sprites/armour';
import type { Carried, Wielded } from './sprites/figure';
import {
  APPRENTICE_STAFF,
  BARROW_STAFF,
  BEARDED_AXE,
  CRYSTAL_STAFF,
  CUTLASS,
  FELLING_AXE,
  FISHING_POLE,
  HEATER_SHIELD,
  LANTERN,
  LEAF_BLADE,
  LONGBOW,
  MAUL,
  ORB,
  PICKAXE,
  ROUND_SHIELD,
  RUSTY_SWORD,
  SHORT_BOW,
  SICKLE,
} from './sprites/weapons';
import { HERB_VARIANTS } from './sprites/herbs';
import * as ITEM from './sprites/itemIcons';
import * as ABILITY from './sprites/abilityIcons';
import * as MARK from './sprites/markIcons';

/**
 * What every item, ability, buff and tab is drawn as in the HUD (B8, decision
 * 111), each an icon compiled the way the world's sprites are.
 *
 * **Gear is drawn as what it is on the figure.** Which piece a helmet puts on,
 * which weapon is in the hand and what ramps each is dyed is the wardrobe's to
 * say (`wardrobe.ts`), and an item's icon is read off the same answer: a
 * piece's icon is drawn in the neutral `tier` ramp and dyed as the piece is,
 * a weapon's in the ramps its parts default to (a blade in `metal`, a haft in
 * `wood`, fittings in `gold`, a stone in `arcane`) and dyed as the weapon is.
 * So the helm in the bag is the helm on the figure, in the same steel, without
 * a row written for it here; `icons.test.ts` holds every item to a drawing.
 *
 * **Everything else is a row**, a drawing and the ramps it is dyed, falling
 * back on the drawing of its data's shape, as `cast.ts` and `places.ts` fall
 * back for what they draw.
 */

/** A drawing and what it is dyed. */
export interface IconRow {
  art: SpriteDef;
  recolour?: Recolour;
}

// Gear, by what the wardrobe says it is.
const PIECE_ICONS = new Map<Piece, SpriteDef>([
  [CAP, ITEM.CAP],
  [HELM, ITEM.HELM],
  [HAT, ITEM.HAT],
  [HOOD, ITEM.HOOD],
  [COWL, ITEM.COWL],
  [BANDANA, ITEM.BANDANA],
  [CROWN, ITEM.CROWN],
  [JERKIN, ITEM.JERKIN],
  [STUDDED_JERKIN, ITEM.STUDDED_JERKIN],
  [PLATE, ITEM.PLATE],
  [CLOAKED_PLATE, ITEM.CLOAKED_PLATE],
  [ROBE_PIECE, ITEM.ROBE],
  [TRIMMED_ROBE, ITEM.TRIMMED_ROBE],
  [VEST, ITEM.VEST],
  [BREECHES, ITEM.BREECHES],
  [GREAVES, ITEM.GREAVES],
]);

const WIELDED_ICONS = new Map<Wielded, SpriteDef>([
  [RUSTY_SWORD, ITEM.RUSTY_SWORD],
  [CUTLASS, ITEM.CUTLASS],
  [LEAF_BLADE, ITEM.LEAF_BLADE],
  [APPRENTICE_STAFF, ITEM.APPRENTICE_STAFF],
  [CRYSTAL_STAFF, ITEM.CRYSTAL_STAFF],
  [BARROW_STAFF, ITEM.BARROW_STAFF],
  [FELLING_AXE, ITEM.FELLING_AXE],
  [BEARDED_AXE, ITEM.BEARDED_AXE],
  [PICKAXE, ITEM.PICKAXE],
  [MAUL, ITEM.MAUL],
  [FISHING_POLE, ITEM.FISHING_POLE],
  [SHORT_BOW, ITEM.SHORT_BOW],
  [LONGBOW, ITEM.LONGBOW],
  [SICKLE, ITEM.SICKLE],
]);

const CARRIED_ICONS = new Map<Carried | 'quiver', SpriteDef>([
  [ROUND_SHIELD, ITEM.ROUND_SHIELD],
  [HEATER_SHIELD, ITEM.HEATER_SHIELD],
  [ORB, ITEM.ORB],
  [LANTERN, ITEM.LANTERN],
  ['quiver', ITEM.QUIVER],
]);

/** Only the swaps that change something: a ramp swapped for itself is no variant at all. */
function swaps(pairs: readonly (readonly [SharedRampId, SharedRampId | undefined])[]): Recolour {
  return Object.fromEntries(pairs.filter(([from, to]) => to !== undefined && to !== from));
}

// Everything that is not gear, by what it is and what it is dyed.
const MATERIAL_ICONS: Readonly<Partial<Record<ItemId, IconRow>>> = {
  'rat-bones': { art: ITEM.BONES },
  'bone-char': { art: ITEM.BONES, recolour: { bone: 'char' } },
  'rat-meat': { art: ITEM.MEAT },
  'cooked-rat': { art: ITEM.MEAT, recolour: { red: 'roast' } },
  'burnt-rat': { art: ITEM.MEAT, recolour: { red: 'char', bone: 'char' } },
  'crab-meat': { art: ITEM.CLAW },
  'cooked-crab': { art: ITEM.CLAW, recolour: { shell: 'fire' } },
  'burnt-crab': { art: ITEM.CLAW, recolour: { shell: 'char' } },
  'raw-fish': { art: ITEM.FISH },
  'cooked-fish': { art: ITEM.FISH, recolour: { spray: 'roast' } },
  'burnt-fish': { art: ITEM.FISH, recolour: { spray: 'char' } },
  'raw-eel': { art: ITEM.EEL },
  'cooked-eel': { art: ITEM.EEL, recolour: { furBog: 'roast' } },
  'burnt-eel': { art: ITEM.EEL, recolour: { furBog: 'char' } },
  'lurker-hide': { art: ITEM.HIDE },
  'cured-leather': { art: ITEM.HIDE, recolour: { furBog: 'tierFenhide' } },
  'crawler-shell': { art: ITEM.SHELL },
  logs: { art: ITEM.LOG },
  hardwood: { art: ITEM.LOG, recolour: { wood: 'shingle' } },
  willow: { art: ITEM.LOG, recolour: { wood: 'thatch' } },
  charcoal: { art: ITEM.LOG, recolour: { wood: 'char' } },
  'tin-ore': { art: ITEM.ORE, recolour: { ore: 'oreTin' } },
  'iron-ore': { art: ITEM.ORE, recolour: { ore: 'oreIron' } },
  coal: { art: ITEM.COAL },
  'reforging-stone': { art: ITEM.RUNE_STONE },
  'tin-bar': { art: ITEM.BAR, recolour: { tier: 'oreTin' } },
  'iron-bar': { art: ITEM.BAR, recolour: { tier: 'tierIron' } },
  'steel-bar': { art: ITEM.BAR, recolour: { tier: 'tierSteel' } },
  'hideout-key': { art: ITEM.KEY },
  'barrow-key': { art: ITEM.KEY, recolour: { metal: 'bone' } },
  'crude-arrows': { art: ITEM.ARROW },
  'iron-arrows': { art: ITEM.ARROW, recolour: { wood: 'tierIron', bone: 'hairGrey' } },
  'steel-arrows': { art: ITEM.ARROW, recolour: { wood: 'tierSteel', bone: 'red' } },
  'arrow-shafts': { art: ITEM.SHAFTS },
  'willow-shafts': { art: ITEM.SHAFTS, recolour: { thatch: 'oilskin' } },
  'iron-arrowheads': { art: ITEM.ARROWHEADS, recolour: { tier: 'tierIron' } },
  'steel-arrowheads': { art: ITEM.ARROWHEADS, recolour: { tier: 'tierSteel' } },
  // Each herb in the colours its patch is drawn in (`HERB_VARIANTS`), so the
  // bundle in the bag is the clump on the ground.
  samphire: { art: ITEM.HERB, recolour: HERB_VARIANTS.samphire },
  meadowsweet: { art: ITEM.HERB },
  'bog-myrtle': { art: ITEM.HERB, recolour: HERB_VARIANTS['bog-myrtle'] },
  bogbean: { art: ITEM.HERB, recolour: HERB_VARIANTS.bogbean },
  // A potion is the colour of what it does: green for the hands, gold for the
  // pain, the keepers' teal for the watch, and violet for luck.
  'samphire-tonic': { art: ITEM.POTION },
  'meadowsweet-draught': { art: ITEM.POTION, recolour: { nature: 'yellow' } },
  'keepers-draught': { art: ITEM.POTION, recolour: { nature: 'teal' } },
  'bogbean-cordial': { art: ITEM.POTION, recolour: { nature: 'purple' } },
  'pells-cart-bell': { art: ITEM.BELL },
  'orlaths-seal-cast': { art: ITEM.SEAL },
  // Band 9-12's tier (decision 139): the ore in the seam's own ramp, the bar
  // and the arrow's halves in the tier's, the hide wet and dark and cured
  // into the tier's olive, bog oak black through, and the pike a drawing of
  // its own, since a long fish in the eel's ramps would be the eel.
  'coldiron-ore': { art: ITEM.ORE, recolour: { ore: 'oreColdiron' } },
  'coldiron-bar': { art: ITEM.BAR, recolour: { tier: 'tierColdiron' } },
  'coldiron-arrowheads': { art: ITEM.ARROWHEADS, recolour: { tier: 'tierColdiron' } },
  'coldiron-arrows': { art: ITEM.ARROW, recolour: { wood: 'tierColdiron', bone: 'teal' } },
  'mire-hide': { art: ITEM.HIDE, recolour: { furBog: 'oilskin' } },
  'mirehide-leather': { art: ITEM.HIDE, recolour: { furBog: 'tierMirehide' } },
  'bog-oak': { art: ITEM.LOG, recolour: { wood: 'slate' } },
  'bog-oak-shafts': { art: ITEM.SHAFTS, recolour: { thatch: 'slate' } },
  'raw-pike': { art: ITEM.PIKE },
  'cooked-pike': { art: ITEM.PIKE, recolour: { oilskin: 'roast' } },
  'burnt-pike': { art: ITEM.PIKE, recolour: { oilskin: 'char' } },
};

// What an item nobody drew is drawn as, by the shape its data names.
const BY_SHAPE: Readonly<Record<ItemIconShape, SpriteDef>> = {
  sword: ITEM.RUSTY_SWORD,
  staff: ITEM.APPRENTICE_STAFF,
  axe: ITEM.FELLING_AXE,
  pole: ITEM.FISHING_POLE,
  pick: ITEM.PICKAXE,
  bow: ITEM.SHORT_BOW,
  shield: ITEM.ROUND_SHIELD,
  orb: ITEM.ORB,
  quiver: ITEM.QUIVER,
  helmet: ITEM.CAP,
  chest: ITEM.JERKIN,
  pants: ITEM.BREECHES,
  bone: ITEM.BONES,
  meat: ITEM.MEAT,
  fish: ITEM.FISH,
  log: ITEM.LOG,
  ore: ITEM.ORE,
  bar: ITEM.BAR,
  key: ITEM.KEY,
  arrow: ITEM.ARROW,
  shaft: ITEM.SHAFTS,
  arrowhead: ITEM.ARROWHEADS,
  sickle: ITEM.SICKLE,
  herb: ITEM.HERB,
  potion: ITEM.POTION,
  bell: ITEM.BELL,
  seal: ITEM.SEAL,
};

/** What an item is drawn as, and dyed: gear off the wardrobe, the rest off its row. */
export function itemIconRow(itemId: ItemId): IconRow | null {
  const worn = wornAs(itemId);
  if (worn) {
    const art = PIECE_ICONS.get(worn.piece);
    return art ? { art, recolour: swaps([['tier', worn.ramp]]) } : null;
  }
  const wield = wieldedAs(itemId);
  if (wield) {
    const art = WIELDED_ICONS.get(wield.art);
    return art
      ? {
          art,
          recolour: swaps([
            ['metal', wield.blade],
            ['wood', wield.haft],
            ['gold', wield.fitting],
            ['arcane', wield.gem],
          ]),
        }
      : null;
  }
  const carried = offhandAs(itemId);
  if (carried) {
    const art = CARRIED_ICONS.get(carried.art);
    return art
      ? {
          art,
          recolour: swaps([
            ['tier', carried.ramp],
            ['arcane', carried.glow],
          ]),
        }
      : null;
  }
  return MATERIAL_ICONS[itemId] ?? null;
}

function rowOf(itemId: ItemId): IconRow {
  const row = itemIconRow(itemId);
  if (row) return row;
  const item = ITEMS[itemId];
  const shape: ItemIconShape =
    item.kind === 'equipment'
      ? (item.weaponShape ?? item.offhandShape ?? (item.slot as ItemIconShape))
      : item.icon.shape;
  return { art: BY_SHAPE[shape] };
}

const hasSwaps = (row: IconRow): boolean => Object.keys(row.recolour ?? {}).length > 0;

/** The sprite an item's icon is: the drawing, or the variant of it dyed for this item. */
export function itemSprite(itemId: ItemId): string {
  const row = rowOf(itemId);
  return hasSwaps(row) ? variantId(row.art.id, itemId) : row.art.id;
}

/** An item's icon, as its frame on the HUD's sheet of them. */
export function itemIconKey(itemId: ItemId): string {
  return frameKey(itemSprite(itemId), 'still', null, 0);
}

/**
 * An ability's icon. A second rank is the first one's picture, since it is the
 * same blow harder, and its name under the button says which it is.
 */
export const ABILITY_ICONS: Readonly<Record<AbilityId, SpriteDef>> = {
  fireball: ABILITY.FIREBALL,
  'fireball-2': ABILITY.FIREBALL,
  'mana-shield': ABILITY.MANA_SHIELD,
  'mana-shield-2': ABILITY.MANA_SHIELD,
  mend: ABILITY.MEND,
  'mend-2': ABILITY.MEND,
  firestorm: ABILITY.FIRESTORM,
  'firestorm-2': ABILITY.FIRESTORM,
  'power-slash': ABILITY.POWER_SLASH,
  'power-slash-2': ABILITY.POWER_SLASH,
  'battle-fury': ABILITY.BATTLE_FURY,
  'battle-fury-2': ABILITY.BATTLE_FURY,
  'second-wind': ABILITY.SECOND_WIND,
  'second-wind-2': ABILITY.SECOND_WIND,
  'crushing-blow': ABILITY.CRUSHING_BLOW,
  'crushing-blow-2': ABILITY.CRUSHING_BLOW,
  'aimed-shot': ABILITY.AIMED_SHOT,
  'aimed-shot-2': ABILITY.AIMED_SHOT,
  'rapid-fire': ABILITY.RAPID_FIRE,
  'rapid-fire-2': ABILITY.RAPID_FIRE,
  'field-dressing': ABILITY.FIELD_DRESSING,
  'field-dressing-2': ABILITY.FIELD_DRESSING,
  'piercing-shot': ABILITY.PIERCING_SHOT,
  'piercing-shot-2': ABILITY.PIERCING_SHOT,
};

export function abilityIconKey(abilityId: AbilityId): string {
  return frameKey(ABILITY_ICONS[abilityId].id, 'still', null, 0);
}

/**
 * A buff's icon: what gave it. A shield is the spell that raised it, haste the
 * fury that brought it on, a full stomach a roast, and a potion's mark the
 * potion.
 */
export function effectIconKey(effectId: EffectId): string {
  switch (effectId) {
    case 'mana-shield':
      return abilityIconKey('mana-shield');
    case 'haste':
      return abilityIconKey('battle-fury');
    case 'well-fed':
      return itemIconKey('cooked-rat');
    case 'quick-hands':
    case 'dulled-pain':
    case 'keepers-watch':
    case 'fortune':
      return itemIconKey(POTION_EFFECTS[effectId].itemId);
  }
}

/** The small pictures a tab or a purse wears beside its word, named for what they show. */
export const MARKS = {
  bust: MARK.BUST,
  sack: MARK.SACK,
  scroll: MARK.SCROLL,
  hourglass: MARK.HOURGLASS,
  chest: MARK.CHEST,
  map: MARK.MAP,
  trophy: MARK.TROPHY,
  book: MARK.BOOK,
  candle: MARK.CANDLE,
  swords: MARK.SWORDS,
  cog: MARK.COG,
  coin: MARK.COIN,
  skull: MARK.SKULL,
} as const;

export type MarkId = keyof typeof MARKS;

export function markIconKey(mark: MarkId): string {
  return frameKey(MARKS[mark].id, 'still', null, 0);
}

/**
 * Every drawing with a variant for each item dyed out of it, named for the
 * item, so an item's icon is one frame on the sheet whatever it shares.
 */
function withVariants(): SpriteDef[] {
  const variants = new Map<SpriteDef, Record<string, Recolour>>();
  for (const itemId of Object.keys(ITEMS) as ItemId[]) {
    const row = rowOf(itemId);
    if (!hasSwaps(row)) continue;
    const own = variants.get(row.art) ?? {};
    own[itemId] = row.recolour ?? {};
    variants.set(row.art, own);
  }
  const drawings = new Set<SpriteDef>([
    ...Object.values(ITEM),
    ...Object.values(ABILITY),
    ...Object.values(MARK),
  ]);
  return [...drawings].map((def) => {
    const own = variants.get(def);
    return own ? { ...def, variants: own } : def;
  });
}

/** Every icon the HUD draws, each with a variant for every item dyed out of it. */
export const ICON_SPRITES: readonly SpriteDef[] = withVariants();
