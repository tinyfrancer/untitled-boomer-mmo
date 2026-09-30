import { WALL_TILE } from '../data/tiles';
import { tileColour } from '../art/sprites/terrain';
import type { MapMarker, TerrainBand } from '../systems/MapSystem';
import { THEME, cssColor } from '../ui/theme';
import type { SkillId, ZoneSetting } from '../types/ids';

// What the zone map and the minimap draw alike (decision 115): one zone drawn
// twice, the whole of it on the sheet and the part round the player in the
// corner, so a tree is the same green on both and a building the same stone.

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, String(value));
  }
  return node;
}

/**
 * What each marker is drawn in.
 *
 * A node is coloured by the skill that works it rather than by being a node:
 * at this size the colour is the only thing telling a tree from a fishing spot,
 * and each is a lighter shade of the ground its own kind sits on — a pale green
 * on the grass, a pale blue on the water. A vein breaks that rule because its
 * ground cannot keep it: the quarry floor is grey, so the marker is the metal in
 * the rock instead of a lighter version of the rock. The gold pair are the two
 * things that are about a person rather than a resource, and they are told apart
 * by shape.
 */
const NODE_COLOR: Partial<Record<SkillId, string>> = {
  woodcutting: THEME.color.heal,
  fishing: THEME.color.skillUp,
  mining: THEME.color.ore,
};
const MARKER_COLOR: Record<MapMarker['kind'], string> = {
  node: THEME.color.skillUp,
  npc: THEME.color.levelUp,
  exit: THEME.color.levelUp,
};

export function markerColor(marker: MapMarker): string {
  return (marker.skill && NODE_COLOR[marker.skill]) || MARKER_COLOR[marker.kind];
}

/** A run of ground, in its own colour in the zone's light: the map of a cave is as dark as the cave. */
export function terrainRect(band: TerrainBand, setting: ZoneSetting): SVGRectElement {
  return svgEl('rect', {
    x: band.x,
    y: band.y,
    width: band.width,
    height: 1,
    fill: cssColor(tileColour(band.tile, setting)),
  });
}

/** What a building's footprint is filled with: the zone's stone, as its walls are. */
export function footprintFill(setting: ZoneSetting): string {
  return cssColor(tileColour(WALL_TILE, setting));
}
