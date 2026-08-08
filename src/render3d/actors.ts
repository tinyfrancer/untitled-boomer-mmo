import { Box3, Group, Vector3, type Camera } from 'three';
import { TILE_SIZE } from '../config/constants';
import { NPC_APPEARANCES, appearanceKey, computeAppearance } from '../systems/AppearanceSystem';
import { conColor, enemyDisplayName } from '../systems/EnemySystem';
import { titleName } from '../systems/AchievementSystem';
import { npcMarker } from '../systems/QuestSystem';
import { QUEST_MARKER_STYLE, THEME } from '../ui/theme';
import { DEATH_FADE_MS, type Mob } from '../world/Mob';
import { buildCreature } from './creatures';
import { facingYaw, simToWorld } from './coords';
import { buildFigure, type Figure } from './figure';
import { disposeTree, setOpacity } from './dispose';
import { Nameplate } from './nameplate';
import { OCCLUDED_OPACITY, type Occluder } from './occlusion';
import { pickBox, type Pickable } from './picking';
import { WATER_DEPTH } from './ground';
import { buildCampfire, buildNode, buildSignpost } from './props';
import type { CharacterState } from '../persistence/CharacterState';
import type { TitleId } from '../types/ids';
import type { Campfire } from '../world/Campfire';
import type { Player } from '../world/Player';
import type { ResourceNode } from '../world/ResourceNode';
import type { WorldNpc, WorldSignpost } from '../world/ZoneWorld';

/** How far over a figure's head its nameplate floats. */
const PLATE_CLEARANCE = 12;

/** Just clear of the signpost's board, which stands a tile tall. */
const SIGNPOST_LABEL_HEIGHT = 76;

/**
 * How much ground a person covers, for a tap.
 *
 * The bandit has this as its collision body; the shopkeeper has no body at all,
 * since nothing ever walks into one, so the figure's own tap target is the same
 * number written down once.
 */
const FIGURE_FOOTPRINT = TILE_SIZE;

/**
 * How a corpse falls: flat, and in the first stretch of the fade rather than
 * across all of it. Pivoted at the feet, which is where an actor's origin is.
 */
const TOPPLE_RADIANS = Math.PI / 2;
const TOPPLE_FRACTION = 0.6;

/**
 * What draws one simulated thing: an actor per `world/` object.
 *
 * Every actor is the same three layers: an outer group that holds the world
 * position, a facing group that holds the yaw, and whatever hangs above it. The
 * split matters: a nameplate is billboarded by having its own rotation written
 * every frame, so it cannot be under something that is also being turned to
 * face where the creature is walking.
 *
 * Nothing here decides anything. The simulation owns position, health, gear and
 * death; an actor catches up to it in `sync()` and hands its geometry back in
 * `dispose()` — an actor that forgets that leaks memory the card never gets
 * back.
 */
export interface Actor {
  readonly object: Group;
  dispose(): void;
}

export class PlayerActor implements Actor {
  readonly object = new Group();
  private readonly facing = new Group();
  private readonly plate: Nameplate;
  private readonly player: Player;
  private figure: Figure;
  private appearanceKey: string;

  constructor(player: Player) {
    this.player = player;
    this.object.userData.kind = 'player';
    this.object.add(this.facing);

    const appearance = computeAppearance(player.currentGear());
    this.appearanceKey = appearanceKey(appearance);
    this.figure = buildFigure(appearance);
    this.facing.add(this.figure.object);

    // The one plate in the world with a pool under its health, since the player
    // is the one thing whose mana anybody spends.
    this.plate = new Nameplate(this.figure.height + PLATE_CLEARANCE, {
      width: 64,
      height: 10,
      manaBar: true,
    });
    this.plate.setLabel(player.name, THEME.color.text);
    this.object.add(this.plate.object);
  }

  /**
   * The title comes down from the view rather than off the player, because
   * `world/Player` knows its name and deliberately nothing else about who is
   * wearing it — it is the character that has a title, not the body walking
   * around. Polled like the gear below for the same reason: the simulation has
   * no idea anything is drawing it.
   */
  sync(elapsedMs: number, titleId: TitleId | null): void {
    this.plate.setTitle(titleId && titleName(titleId), THEME.color.levelUp);

    // The look is rebuilt when the gear changes rather than when something calls
    // a setter: the simulation has no idea anything is drawing it, and a pure
    // function of the gear is cheaper to compare than it is to notify.
    const appearance = computeAppearance(this.player.currentGear());
    if (appearanceKey(appearance) !== this.appearanceKey) {
      this.appearanceKey = appearanceKey(appearance);
      disposeTree(this.figure.object);
      this.figure = buildFigure(appearance);
      this.facing.add(this.figure.object);
    }

    this.object.position.copy(simToWorld(this.player.x, this.player.y));
    this.facing.rotation.y = facingYaw(this.player.vx, this.player.vy, this.facing.rotation.y);
    this.figure.stride(this.player.isMoving(), elapsedMs);
    this.plate.setLabel(this.player.name, THEME.color.text);
    this.plate.setHealth(this.player.hp, this.player.maxHp);
    this.plate.setMana(this.player.mana, this.player.maxMana);
  }

  faceCamera(camera: Camera): void {
    this.plate.faceCamera(camera);
  }

  /** What `window.view.playerFigure()` answers: the walk, not the simulation. */
  figureState(): { walking: boolean; pose: string } {
    return { walking: this.player.isMoving(), pose: this.figure.pose() };
  }

  dispose(): void {
    disposeTree(this.object);
  }
}

export class MobActor implements Actor, Pickable {
  readonly object = new Group();
  readonly mob: Mob;
  private readonly facing = new Group();
  private readonly creature: Figure;
  private readonly plate: Nameplate;
  // Beasts of the same kind spawned in the same frame would otherwise scuttle in
  // perfect lockstep; their spawn point is a stable seed for pulling them apart.
  private readonly phaseOffsetMs: number;

  constructor(mob: Mob, playerLevel: number) {
    this.mob = mob;
    this.object.userData.kind = 'mob';
    this.object.add(this.facing);

    this.creature = buildCreature(mob.definition);
    this.facing.add(this.creature.object);
    this.phaseOffsetMs = (mob.spawnX * 7 + mob.spawnY * 13) % 1000;

    this.plate = new Nameplate(this.creature.height + PLATE_CLEARANCE);
    this.object.add(this.plate.object);
    this.refreshLabel(playerLevel);
    this.sync(0);
  }

  /**
   * An enemy's name colour is relative to the player's level, so it is not
   * fixed: it has to be redrawn whenever they level.
   */
  refreshLabel(playerLevel: number): void {
    this.plate.setLabel(
      enemyDisplayName(this.mob.definition, this.mob.level),
      conColor(playerLevel, this.mob.level),
    );
  }

  sync(elapsedMs: number): void {
    this.object.position.copy(simToWorld(this.mob.x, this.mob.y));
    this.facing.rotation.y = facingYaw(this.mob.vx, this.mob.vy, this.facing.rotation.y);

    if (this.mob.isAlive()) {
      this.object.visible = true;
      // Back on its feet: this is the same actor the mob respawns into, not a
      // new one, so a corpse's fall has to be taken back off it.
      this.facing.rotation.x = 0;
      setOpacity(this.facing, 1);
      this.creature.stride(this.mob.vx !== 0 || this.mob.vy !== 0, elapsedMs + this.phaseOffsetMs);
      this.plate.setVisible(true);
      this.plate.setHealth(this.mob.hp, this.mob.maxHp);
      return;
    }

    // The death is read off the simulation's own clock rather than played as a
    // tween, which is what lets the world respawn on time with nothing drawing
    // it at all. It falls faster than it fades, so there is a moment of corpse
    // on the ground rather than a creature dissolving mid-air still standing.
    const dying = Math.min(1, this.mob.deadForMs / DEATH_FADE_MS);
    this.facing.rotation.x = TOPPLE_RADIANS * Math.min(1, dying / TOPPLE_FRACTION);
    setOpacity(this.facing, 1 - dying);
    this.object.visible = dying < 1;
    this.plate.setVisible(false);
  }

  faceCamera(camera: Camera): void {
    this.plate.faceCamera(camera);
  }

  /**
   * The footprint `CollisionSystem` stops the player at, standing as tall as
   * the creature does — and nothing at all once the creature is dead, since a
   * corpse still toppling and fading is not a target.
   */
  pickBox(): Box3 | null {
    if (!this.mob.isAlive()) return null;
    const { width, height } = this.mob.definition.body;
    return pickBox(this.mob.x, this.mob.y, {
      width,
      depth: height,
      height: this.creature.height,
    });
  }

  dispose(): void {
    disposeTree(this.object);
  }
}

export class NodeActor implements Actor, Pickable, Occluder {
  readonly object = new Group();
  readonly node: ResourceNode;
  private readonly prop: ReturnType<typeof buildNode>;
  private drawnAvailable = true;
  private sightBox: Box3 | null = null;
  private occluded = false;

  constructor(node: ResourceNode) {
    this.node = node;
    this.object.userData.kind = 'node';
    this.object.position.copy(simToWorld(node.x, node.y));
    this.prop = buildNode(node);
    this.object.add(this.prop.object);
    this.prop.setAvailable(true);
    this.measureSight();
  }

  sync(): void {
    const available = this.node.isAvailable();
    if (available === this.drawnAvailable) return;
    this.drawnAvailable = available;
    this.prop.setAvailable(available);
    this.measureSight();
  }

  /**
   * Whatever is still drawn is what can still be tapped: a felled tree leaves
   * its stump to aim at, where a fished-out spot leaves nothing on the water.
   *
   * A node's `body` is a top-down footprint, so which of its two spans is a
   * *height* is the prop's decision rather than the data's, and this reads it
   * the way `props.ts` draws it — a tree stands `body.height` tall on a square
   * of `body.width`, a fishing spot lies flat on water the ground mesh sinks.
   */
  pickBox(): Box3 | null {
    if (!this.prop.object.visible) return null;
    const { width, height } = this.node.definition.body;
    return this.node.definition.solid
      ? pickBox(this.node.x, this.node.y, { width, depth: width, height })
      : pickBox(this.node.x, this.node.y, {
          width,
          depth: height,
          height: 0,
          base: -WATER_DEPTH,
        });
  }

  occluderBox(): Box3 | null {
    return this.sightBox;
  }

  setOccluded(occluded: boolean): void {
    if (occluded === this.occluded) return;
    this.occluded = occluded;
    setOpacity(this.prop.object, occluded ? OCCLUDED_OPACITY : 1);
  }

  // Recomputed only when the prop changes shape — a felled tree is a stump —
  // since a node never moves and the fade asks this of every node every frame.
  private measureSight(): void {
    const block = this.prop.sightBlock();
    if (!block) {
      this.sightBox = null;
      return;
    }
    const half = block.width / 2;
    this.sightBox = new Box3(
      new Vector3(this.node.x - half, 0, this.node.y - half),
      new Vector3(this.node.x + half, block.height, this.node.y + half),
    );
  }

  dispose(): void {
    disposeTree(this.object);
  }
}

export class NpcActor implements Actor, Pickable {
  readonly object = new Group();
  readonly npc: WorldNpc;
  private readonly plate: Nameplate;
  private readonly height: number;

  constructor(npc: WorldNpc) {
    this.npc = npc;
    this.object.userData.kind = 'npc';
    this.object.position.copy(simToWorld(npc.x, npc.y));

    const figure = buildFigure(NPC_APPEARANCES.shopkeeper);
    // Facing south, out of the shop and toward the camera's default position.
    figure.object.rotation.y = facingYaw(0, 1);
    this.object.add(figure.object);
    this.height = figure.height;

    this.plate = new Nameplate(figure.height + PLATE_CLEARANCE, { healthBar: false });
    this.plate.setLabel('Shopkeeper', THEME.color.levelUp);
    this.object.add(this.plate.object);
  }

  /**
   * Catches the quest marker up to the character.
   *
   * Read off the state each frame rather than driven by an event, the same
   * bargain the con colours make: a quest's progress is *derived* from the bag
   * (`QuestSystem`), so the thing that changes this glyph is a rat bone landing
   * in the pack — and nothing publishes that. `setMarker` only rebuilds when the
   * answer actually moves, so the frame cost is the two-quest walk and nothing.
   */
  sync(state: CharacterState): void {
    const marker = npcMarker(this.npc.npcId, state.quests, state.inventory);
    const style = marker ? QUEST_MARKER_STYLE[marker] : null;
    this.plate.setMarker(style?.glyph ?? null, style?.color ?? '');
  }

  faceCamera(camera: Camera): void {
    this.plate.faceCamera(camera);
  }

  pickBox(): Box3 | null {
    return pickBox(this.npc.x, this.npc.y, {
      width: FIGURE_FOOTPRINT,
      depth: FIGURE_FOOTPRINT,
      height: this.height,
    });
  }

  dispose(): void {
    disposeTree(this.object);
  }
}

export class SignpostActor implements Actor, Pickable {
  readonly object = new Group();
  readonly signpost: WorldSignpost;
  private readonly plate: Nameplate;

  constructor(signpost: WorldSignpost) {
    this.signpost = signpost;
    this.object.userData.kind = 'signpost';
    this.object.position.copy(simToWorld(signpost.x, signpost.y));
    this.object.add(buildSignpost());

    this.plate = new Nameplate(SIGNPOST_LABEL_HEIGHT, { healthBar: false });
    this.plate.setLabel(signpost.label, THEME.color.levelUp);
    this.object.add(this.plate.object);
  }

  faceCamera(camera: Camera): void {
    this.plate.faceCamera(camera);
  }

  /**
   * A tile in every direction, which is more than the post occupies. On a phone
   * this is how a zone is left — the edge-walk band is untappably thin — so it
   * is the one thing here deliberately easier to hit than it looks.
   */
  pickBox(): Box3 | null {
    return pickBox(this.signpost.x, this.signpost.y, {
      width: TILE_SIZE,
      depth: TILE_SIZE,
      height: TILE_SIZE,
    });
  }

  dispose(): void {
    disposeTree(this.object);
  }
}

export class CampfireActor implements Actor {
  readonly object = new Group();
  readonly campfire: Campfire;
  private readonly fire: ReturnType<typeof buildCampfire>;

  constructor(campfire: Campfire) {
    this.campfire = campfire;
    this.object.userData.kind = 'campfire';
    this.object.position.copy(simToWorld(campfire.x, campfire.y));
    this.fire = buildCampfire();
    this.object.add(this.fire.object);
  }

  sync(elapsedMs: number): void {
    this.fire.flicker(elapsedMs);
  }

  dispose(): void {
    disposeTree(this.object);
  }
}
