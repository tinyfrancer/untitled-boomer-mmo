import { Sheet } from './Sheet';
import { el } from './dom';
import { footprintFill, markerColor, svgEl, terrainRect } from './mapArt';
import { describeItemName } from '../data/items';
import { GRASS_TILE, PATH_TILE, WALL_TILE } from '../data/tiles';
import { ZONES } from '../data/zones';
import { tileColour } from '../art/sprites/terrain';
import {
  secretsFound,
  worldMap,
  zoneMap,
  type MapBuilding,
  type MapMarker,
  type WorldMapZone,
  type ZoneMap,
} from '../systems/MapSystem';
import { zoneAccess, type ZoneAccess, type ZoneAccessContext } from '../systems/ZoneAccessSystem';
import { THEME, cssColor } from '../ui/theme';
import type { TilePoint } from '../ui/uiEvents';
import type { SecretId, ZoneId, ZoneSetting } from '../types/ids';

// Marker sizes in tiles, since the drawing is done in tile units. A node is
// smaller than the tile it stands on so the terrain still reads under it.
const NODE_RADIUS = 0.45;
const NPC_RADIUS = 0.6;
const PLAYER_RADIUS = 0.7;
const EXIT_SIZE = 1.2;
const LABEL_HEIGHT = 1.4;

// A building's name, and how deep a footprint has to be to carry one. Two tiles
// is the shallowest thing in BUILDINGS, and two lines of a name still clear the
// walls either side of it.
const BUILDING_NAME_SIZE = 0.8;
const BUILDING_NAME_MIN_TILES = 2;
/** How far apart two lines of a name are, as a share of its size. */
const NAME_LINE = 1.05;
/** How much of a footprint's width a line of its name may take. */
const NAME_ACROSS = 0.9;
/**
 * About how wide a letter of the map's type is, as a share of its size: a
 * guess at how many fit, which only decides where a name breaks and whether a
 * line is squeezed. SVG does the squeezing, knowing the glyphs as this does not.
 */
const LETTER_WIDTH = 0.56;

/**
 * One zone's square on the zoomed-out view, in its own units. The whole view is
 * drawn in these rather than in tiles: a zone is a cell there, not 475 of them.
 */
const CELL = 100;

/**
 * How many characters fit across a zone's cell before the name has to be
 * squeezed to stay inside it. "Bandit Camp" is the one that does not, and a
 * name clipped by the panel edge is worse than one set a little tight.
 */
const CELL_NAME_FIT = 8;

// Centred on the cell rather than starting at its middle and running right,
// which is what a text node does left to itself — "Town" looks centred that way
// by luck and "Bandit Camp" runs off the edge of the sheet.
function text(content: string, x: number, y: number, size: number, fill: string): SVGElement {
  const node = svgEl('text', {
    x,
    y,
    'font-size': size,
    'text-anchor': 'middle',
    fill,
    class: 'hud-map__label',
  });
  node.textContent = content;
  return node;
}

function cellName(content: string, x: number, y: number): SVGElement {
  const node = text(content, x, y, CELL * 0.11, THEME.color.text);
  if (content.length > CELL_NAME_FIT) {
    // Let SVG do the fitting rather than guessing a font size per name: it
    // knows the glyph widths and this does not.
    node.setAttribute('textLength', String(CELL * 0.72));
    node.setAttribute('lengthAdjust', 'spacingAndGlyphs');
  }
  return node;
}

/**
 * The line a shut zone carries under its level band, and what colour it is in.
 *
 * Two words rather than a sentence: the cell is 80 units across and the full
 * reason ("You need a Cellar Key") belongs in the toast the world answers a tap
 * with, which is the version a phone with no pointer to hover actually gets.
 * Holding the key is worth saying differently from not holding it — that is the
 * difference between a wall and an invitation.
 */
const ACCESS_NOTE: Record<Exclude<ZoneAccess['kind'], 'open'>, { text: string; color: string }> = {
  locked: { text: 'Locked', color: THEME.color.muted },
  unlockable: { text: 'Key in pack', color: THEME.color.equippable },
};

/**
 * Which way a label runs from the marker it hangs under.
 *
 * Centred in the middle of the map and turned inward at either end, so a
 * destination name always runs *into* the map: "Bandit Camp" centred on an exit
 * a tile from the east edge is half off the sheet, and the exits are the one
 * thing on here that sit against an edge by definition.
 */
function labelAnchor(x: number, columns: number): string {
  if (x < columns / 3) return 'start';
  if (x > (columns * 2) / 3) return 'end';
  return 'middle';
}

/**
 * Where a label's baseline sits by the marker it names: under it, and over it
 * for a marker against the bottom edge, whose name under it would hang off the
 * map and over the sheet's frame (decision 112).
 */
function labelBaseline(y: number, rows: number): number {
  return y > rows - LABEL_HEIGHT * 2 ? y - EXIT_SIZE * 0.75 : y + EXIT_SIZE;
}

/**
 * A name in one line, or in two broken at the space that leaves the longer
 * line shortest, when it is longer than `fits` letters and has a space to break
 * at. The same size either way, so "Bank" and "Quartermaster's Post" are the
 * same type on one map.
 */
export function nameLines(name: string, fits: number): string[] {
  const words = name.split(' ');
  if (name.length <= fits || words.length < 2) return [name];
  let best: string[] = [name];
  let longest = Infinity;
  for (let at = 1; at < words.length; at += 1) {
    const lines = [words.slice(0, at).join(' '), words.slice(at).join(' ')];
    const long = Math.max(...lines.map((line) => line.length));
    if (long < longest) {
      best = lines;
      longest = long;
    }
  }
  return best;
}

function buildMarker(marker: MapMarker, columns: number, rows: number): SVGElement[] {
  const color = markerColor(marker);
  if (marker.kind === 'exit') {
    // A square with the name of where it goes by it: on a map, which way out
    // leads where is the whole question.
    const label = svgEl('text', {
      x: marker.x,
      y: labelBaseline(marker.y, rows),
      class: 'hud-map__label',
      'font-size': LABEL_HEIGHT,
      'text-anchor': labelAnchor(marker.x, columns),
      fill: color,
    });
    label.textContent = marker.label;
    return [
      svgEl('rect', {
        x: marker.x - EXIT_SIZE / 2,
        y: marker.y - EXIT_SIZE / 2,
        width: EXIT_SIZE,
        height: EXIT_SIZE,
        fill: color,
        'data-marker': marker.kind,
      }),
      label,
    ];
  }

  const dot = svgEl('circle', {
    cx: marker.x,
    cy: marker.y,
    r: marker.kind === 'npc' ? NPC_RADIUS : NODE_RADIUS,
    fill: color,
    'data-marker': marker.kind,
  });
  // Named for the one player who has a pointer to hover with; a phone reads it
  // off where the dot is and what colour it is.
  const title = svgEl('title', {});
  title.textContent = marker.label;
  dot.append(title);
  return [dot];
}

/**
 * A building, as the ground it covers with its name across it.
 *
 * Every name is set at one size and broken onto two lines when it is long,
 * and a line is squeezed to the footprint only when it still would not fit:
 * never stretched. Set to the footprint's width instead, "Bank" came out three
 * times the size of "Quartermaster's Post" on the same map (decision 112). A
 * footprint too small for a name at all is left unnamed — the hover title still
 * answers, and an illegible smear is worse than a shape.
 */
function buildFootprint(
  building: MapBuilding,
  setting: ZoneSetting,
): { ground: SVGElement; name: SVGElement[] } {
  const rect = svgEl('rect', {
    x: building.x,
    y: building.y,
    width: building.width,
    height: building.height,
    fill: footprintFill(setting),
    stroke: THEME.color.muted,
    'stroke-width': 0.12,
    'data-building': building.label,
  });
  const title = svgEl('title', {});
  title.textContent = building.label;
  rect.append(title);
  if (building.height < BUILDING_NAME_MIN_TILES) return { ground: rect, name: [] };

  const across = building.width * NAME_ACROSS;
  const fits = Math.floor(across / (BUILDING_NAME_SIZE * LETTER_WIDTH));
  const lines = nameLines(building.label, fits);
  const step = BUILDING_NAME_SIZE * NAME_LINE;
  const first =
    building.y + building.height / 2 + BUILDING_NAME_SIZE / 3 - (step * (lines.length - 1)) / 2;
  const name = lines.map((line, index) => {
    const label = text(
      line,
      building.x + building.width / 2,
      first + step * index,
      BUILDING_NAME_SIZE,
      THEME.color.text,
    );
    if (line.length > fits) {
      label.setAttribute('textLength', String(across));
      label.setAttribute('lengthAdjust', 'spacingAndGlyphs');
    }
    label.setAttribute('data-building-name', building.label);
    return label;
  });
  return { ground: rect, name };
}

export interface MapSheetOptions {
  /**
   * What the world view needs to tell a shut door from an open one, read fresh
   * each time it draws. A getter rather than a value because the answer moves
   * with the bag — the key can be looted with this very panel open.
   */
  access: () => ZoneAccessContext;
}

/**
 * The zone map, opened from the Menu.
 *
 * Everything on it except the dot is a pure function of the zone's id
 * (`systems/MapSystem.ts`), so the HUD draws it having been told nothing but
 * which zone is running — the terrain, the exits and what is worth walking to
 * all come out of the same tables the world was built from, and the map cannot
 * disagree with where things actually stand.
 *
 * There are no creatures on it, deliberately: it is the plan of the place,
 * opened to find the forge, and the creatures near the player are the
 * minimap's (`hud/Minimap.ts`), which is the map looked at mid-fight. Nor is
 * there tap-to-travel *within* a zone: this tells you where things are, and
 * walking there is still the game.
 *
 * The terrain is rebuilt only when the zone changes and the dot is moved on its
 * own — which is why the two arrive as separate events rather than as one
 * position that would redraw four hundred rectangles on every tile crossing.
 *
 * **It zooms out.** The world view is the same sheet drawn from `worldMap()`:
 * every zone, how they join up, and which one you are standing in. Travelling
 * *between* zones is a different question from walking within one — nobody
 * wants to remember that the beach is off the south edge — so that view is
 * where a tap asks to go somewhere.
 *
 * A shut zone is drawn shut but is still tapped like any other: whether a door
 * opens is the world's answer, not this one's, and it says so with the same
 * toast the walk into the map edge earns.
 */
export class MapSheet extends Sheet {
  private readonly figure: HTMLElement;
  private readonly secretsLine: HTMLElement;
  private readonly zoomButton: HTMLButtonElement;
  private readonly access: () => ZoneAccessContext;
  private svg: SVGSVGElement | null = null;
  private dot: SVGCircleElement | null = null;
  private drawn: ZoneId | null = null;
  private map: ZoneMap | null = null;
  private tile: TilePoint | null = null;
  private zoomedOut = false;
  private secretsFound: readonly SecretId[] = [];

  constructor(options: MapSheetOptions) {
    super('Map', THEME.panelWidth.map, 'hud-sheet--map');
    this.access = options.access;
    this.figure = el('div', 'hud-map');
    this.zoomButton = el('button', 'hud-button hud-map__zoom', 'World');
    this.zoomButton.type = 'button';
    this.zoomButton.dataset.action = 'toggle-map-zoom';
    this.zoomButton.addEventListener('click', () => this.setZoomedOut(!this.zoomedOut));
    this.head.append(this.zoomButton);
    // Under the map rather than on it: where a secret lies is on no map.
    this.secretsLine = el('p', 'hud-map__secrets');
    this.body.append(this.figure, this.secretsLine);
  }

  /** Every secret this character has found, for the zone's count under its map. */
  setSecretsFound(found: readonly SecretId[]): void {
    this.secretsFound = found;
    this.writeSecrets();
  }

  private writeSecrets(): void {
    const count =
      !this.zoomedOut && this.drawn ? secretsFound(this.drawn, this.secretsFound) : null;
    this.secretsLine.textContent = count ? `Secrets ${count.found} / ${count.total}` : '';
    this.secretsLine.classList.toggle('hud-hidden', count === null);
  }

  /** Rebuilds the whole thing; only a zone change may call this. */
  setZone(zoneId: ZoneId): void {
    if (zoneId === this.drawn) return;
    this.drawn = zoneId;
    this.map = zoneMap(zoneId);
    this.redraw();
    // A zone walk puts the player somewhere new, and the dot from the last one
    // is not where they are — but the tile event that says so is published by
    // the same frame, so this only has to not draw a stale one.
    this.moveDot();
  }

  /** Whether the world is showing rather than this zone. */
  isZoomedOut(): boolean {
    return this.zoomedOut;
  }

  /** Which view is showing: this zone, or the world the roads join up. */
  setZoomedOut(zoomedOut: boolean): void {
    if (zoomedOut === this.zoomedOut) return;
    this.zoomedOut = zoomedOut;
    this.redraw();
    this.moveDot();
  }

  /**
   * Redraws the world view against a lock that has moved — a key found, or a
   * door opened with one. Only the zoomed-out view says anything about locks,
   * and it is four cells, so this is cheaper than working out which one changed.
   */
  refreshAccess(): void {
    if (this.zoomedOut) this.buildWorld();
  }

  private redraw(): void {
    this.zoomButton.textContent = this.zoomedOut ? 'Zone' : 'World';
    this.writeSecrets();
    if (this.zoomedOut) {
      this.setTitle('World');
      this.buildWorld();
      return;
    }
    if (!this.map) return;
    this.setTitle(this.map.name);
    this.build(this.map);
  }

  /**
   * The zoomed-out view: a cell per zone, laid out by `worldMap()` from the
   * exits themselves, with a road drawn along each pair that connects.
   *
   * Nothing here is a way of going anywhere. Tapping a cell used to ask to
   * travel to it, and that is gone: a world you can step across for nothing is
   * a world with no distance in it, and every zone is reachable by walking the
   * roads this view draws. The one cell that still answers a press is the one
   * the player is standing in, which zooms back in to it — that is a request
   * about the panel rather than about the world.
   */
  private buildWorld(): void {
    const map = worldMap();
    const svg = svgEl('svg', {
      viewBox: `0 0 ${map.columns * CELL} ${map.rows * CELL}`,
      class: 'hud-map__svg hud-map__svg--world',
    });

    // Roads first, so a cell is never drawn under the line joining it.
    for (const link of map.links) {
      const from = map.zones.find((zone) => zone.zoneId === link.from);
      const to = map.zones.find((zone) => zone.zoneId === link.to);
      if (!from || !to) continue;
      svg.append(
        svgEl('line', {
          x1: from.column * CELL + CELL / 2,
          y1: from.row * CELL + CELL / 2,
          x2: to.column * CELL + CELL / 2,
          y2: to.row * CELL + CELL / 2,
          stroke: cssColor(tileColour(PATH_TILE, 'open')),
          'stroke-width': CELL * 0.12,
        }),
      );
    }

    for (const zone of map.zones) {
      svg.append(this.buildWorldZone(zone));
    }

    this.svg = svg;
    this.dot = null;
    this.figure.replaceChildren(svg);
  }

  private buildWorldZone(zone: WorldMapZone): SVGElement {
    const here = zone.zoneId === this.drawn;
    const access = zoneAccess(zone.zoneId, this.access());
    const x = zone.column * CELL;
    const y = zone.row * CELL;
    const group = svgEl('g', { class: 'hud-map__zone' });
    group.dataset.zone = zone.zoneId;
    if (here) group.dataset.here = 'true';
    if (access.kind !== 'open') group.dataset.access = access.kind;

    group.append(
      svgEl('rect', {
        x: x + CELL * 0.1,
        y: y + CELL * 0.1,
        width: CELL * 0.8,
        height: CELL * 0.8,
        rx: CELL * 0.06,
        // Rock rather than grass for a zone that is shut: the fill is what the
        // eye reaches before any of the three lines on the cell.
        fill: cssColor(
          tileColour(access.kind === 'open' ? GRASS_TILE : WALL_TILE, ZONES[zone.zoneId].setting),
        ),
        stroke: here ? THEME.color.text : THEME.color.levelUp,
        'stroke-width': here ? CELL * 0.035 : CELL * 0.015,
      }),
    );
    group.append(
      cellName(zone.name, x + CELL / 2, y + CELL * 0.42),
      text(
        zone.levels ? `Lv ${zone.levels.min}-${zone.levels.max}` : 'No enemies',
        x + CELL / 2,
        y + CELL * 0.6,
        CELL * 0.09,
        THEME.color.muted,
      ),
    );
    if (access.kind !== 'open') {
      const note = ACCESS_NOTE[access.kind];
      group.append(text(note.text, x + CELL / 2, y + CELL * 0.77, CELL * 0.09, note.color));
    }

    const title = svgEl('title', {});
    title.textContent =
      access.kind === 'open'
        ? zone.description
        : `${zone.description} Opened with a ${describeItemName(access.keyItemId)}.`;
    group.append(title);

    // Only the cell being stood in is tappable, and the whole cell is the
    // target rather than the label inside it: this is pressed with a thumb.
    if (here) {
      group.addEventListener('click', () => this.setZoomedOut(false));
    }
    return group;
  }

  setPlayerTile(tile: TilePoint): void {
    this.tile = tile;
    this.moveDot();
  }

  private build(map: ZoneMap): void {
    const svg = svgEl('svg', {
      viewBox: `0 0 ${map.columns} ${map.rows}`,
      class: 'hud-map__svg',
      // Drawn in tile units, so a tile is one unit and everything on it is
      // sized in fractions of one.
      preserveAspectRatio: 'xMidYMid meet',
    });

    // In the ground's own colour in this zone's light, so the map of a cave is
    // as dark as the cave.
    const setting = this.drawn ? ZONES[this.drawn].setting : 'open';
    for (const band of map.terrain) {
      svg.append(terrainRect(band, setting));
    }

    // A building's ground goes between the terrain and the markers, and its name
    // over the markers. The people who keep counters stand inside the buildings
    // they work from, so a name drawn under the dots is a name with a dot
    // through it; over them, its outline keeps it readable across whatever it
    // crosses, and the dot still shows round its edges.
    const names: SVGElement[] = [];
    for (const building of map.buildings) {
      const { ground, name } = buildFootprint(building, setting);
      svg.append(ground);
      names.push(...name);
    }

    for (const marker of map.markers) {
      svg.append(...buildMarker(marker, map.columns, map.rows));
    }
    svg.append(...names);

    // Last, so nothing is ever drawn over the one thing that moves. Hidden
    // until a tile actually arrives: a dot parked in the map's corner would
    // read as a position rather than as an absence.
    this.dot = svgEl('circle', {
      cx: 0,
      cy: 0,
      r: PLAYER_RADIUS,
      class: 'hud-map__player',
      fill: THEME.color.text,
      stroke: cssColor(THEME.inkLine),
      'stroke-width': 0.25,
      visibility: 'hidden',
    });
    svg.append(this.dot);

    this.svg = svg;
    this.figure.replaceChildren(svg);
  }

  private moveDot(): void {
    // The world view has no dot: which zone you are in is drawn on the cell.
    if (!this.dot || !this.tile || !this.svg) return;
    this.dot.setAttribute('cx', String(this.tile.x));
    this.dot.setAttribute('cy', String(this.tile.y));
    this.dot.setAttribute('visibility', 'visible');
  }
}
