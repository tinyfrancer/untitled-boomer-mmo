import type { EffectId } from '../types/ids';

// Whether the icon is something the player wants or something being done to
// them. Nothing applies a debuff yet; the kind exists so the first one is a
// row in this table rather than a second row of icons somewhere else.
export type EffectKind = 'buff' | 'debuff';

export interface EffectDefinition {
  id: EffectId;
  name: string;
  /**
   * What fits under an icon in the 190px player column. The full name is
   * the icon's tooltip, which a phone will never show and a desktop will.
   */
  short: string;
  kind: EffectKind;
}

/**
 * Every timed mark a character can be carrying. Declaration order is the order
 * the icons sit in, so a buff never jumps sideways when another one expires.
 */
export const EFFECTS: Record<EffectId, EffectDefinition> = {
  'mana-shield': { id: 'mana-shield', name: 'Mana Shield', short: 'Shield', kind: 'buff' },
  haste: { id: 'haste', name: 'Battle Fury', short: 'Fury', kind: 'buff' },
  'well-fed': { id: 'well-fed', name: 'Well Fed', short: 'Fed', kind: 'buff' },
};

export const EFFECT_IDS = Object.keys(EFFECTS) as EffectId[];
