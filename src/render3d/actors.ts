import { Box3, Group, Vector3, type Camera } from 'three';
import { TILE_SIZE } from '../config/constants';
import { npcName } from '../data/npcs';
import type { StationId } from '../data/recipes';
import { NPC_APPEARANCES, appearanceKey, computeAppearance } from '../systems/AppearanceSystem';
import { conColor, enemyDisplayName } from '../systems/EnemySystem';
import { titleName } from '../systems/AchievementSystem';
import { npcMarker, strongerMarker } from '../systems/QuestSystem';
import { bountyMarker } from '../systems/BountySystem';
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
import { buildCampfire, buildForge, buildNode, buildSignpost, buildTannery } from './props';
import { buildBuilding } from './buildings';
import { LAMP_HEIGHT_FRACTION, type RoomLamp } from './lights';
import { BUILDING_LOOKS, PALETTE } from './palette';
import { Reactions } from './reactions';
import { Telegraph } from './telegraph';
import { ENEMY_ABILITIES } from '../data/enemyAbilities';
import { buildText } from './text';
import { buildingRect, doorPoint, isInside } from '../data/buildings';
import type { Point } from '../systems/MovementSystem';
import type { CharacterState } from '../persistence/CharacterState';
import type { TitleId } from '../types/ids';
import type { Campfire } from '../world/Campfire';
import type { Player } from '../world/Player';
import type { ResourceNode } from '../world/ResourceNode';
import type {
  WorldBuilding,
  WorldNpc,
  WorldSignpost,
  WorldStation,
  WorldTap,
} from '../world/ZoneWorld';

/** How far over a figure's head its nameplate floats. */
const PLATE_CLEARANCE = 12;

/**
 * The player's own, which is higher and tighter than everyone else's.
 *
 * Their plate is the one that stacks a pool under the bar and a title over the
 * name, so it is both the tallest block in the world and the one drawn on top
 * of the figure the camera keeps centred — where the head is what a low camera
 * angle pushes it into. Lifting it clears the figure outright, and squishing it
 * keeps the whole stack from taking back the room that bought.
 */
const PLAYER_PLATE_CLEARANCE = 22;
export const PLAYER_PLATE = { width: 58, height: 8, labelHeight: 17 };

/** Just clear of the signpost's board, which stands a tile tall. */
const SIGNPOST_LABEL_HEIGHT = 76;

/**
 * The name over a building's door, and how far above its ridge it floats.
 *
 * Bigger than a nameplate's, because it is read from across town rather than
 * from the tile you are standing on — which is the whole job of a shop sign.
 */
const SIGN_HEIGHT = 26;
const SIGN_CLEARANCE = 14;

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
  private readonly reactions = new Reactions();
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
    this.reactions.track(this.figure.object);

    // The one plate in the world with a pool under its health, since the player
    // is the one thing whose mana anybody spends.
    this.plate = new Nameplate(this.figure.height + PLAYER_PLATE_CLEARANCE, {
      ...PLAYER_PLATE,
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
      this.reactions.track(this.figure.object);
    }

    this.object.position.copy(simToWorld(this.player.x, this.player.y));
    this.facing.rotation.y = facingYaw(this.player.vx, this.player.vy, this.facing.rotation.y);
    this.figure.stride(this.player.isMoving(), elapsedMs);
    this.reactions.apply(this.figure, elapsedMs);
    this.plate.setLabel(this.player.name, THEME.color.text);
    this.plate.setHealth(this.player.hp, this.player.maxHp);
    this.plate.setMana(this.player.mana, this.player.maxMana);
  }

  faceCamera(camera: Camera): void {
    this.plate.faceCamera(camera);
  }

  /**
   * A swing, from a `swing` moment: turned to what it was aimed at — a player
   * standing still to fight faces wherever they last walked — and the weapon
   * brought over on the view's clock.
   */
  swing(toward: Point, atMs: number): void {
    this.facing.rotation.y = facingYaw(
      toward.x - this.player.x,
      toward.y - this.player.y,
      this.facing.rotation.y,
    );
    this.reactions.swing(atMs);
  }

  /** A blow that got through, from a `hit` moment. */
  struck(atMs: number): void {
    this.reactions.hit(atMs, PALETTE.hurtFlash);
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
  private readonly reactions = new Reactions();
  // Built on the first wind-up rather than here; see `Telegraph`. Which wind-up
  // it is drawing and when the view first saw it, which is what it fills from.
  private telegraph: Telegraph | null = null;
  private telegraphed: { landsAt: number; seenAt: number } | null = null;
  // Beasts of the same kind spawned in the same frame would otherwise scuttle in
  // perfect lockstep; their spawn point is a stable seed for pulling them apart.
  private readonly phaseOffsetMs: number;

  constructor(mob: Mob, playerLevel: number) {
    this.mob = mob;
    this.object.userData.kind = 'mob';
    this.object.add(this.facing);

    this.creature = buildCreature(mob.definition);
    this.facing.add(this.creature.object);
    this.reactions.track(this.creature.object);
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
      this.reactions.apply(this.creature, elapsedMs);
      this.syncTelegraph(elapsedMs);
      this.plate.setVisible(true);
      this.plate.setHealth(this.mob.hp, this.mob.maxHp);
      return;
    }
    this.telegraph?.hide();

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

  private syncTelegraph(elapsedMs: number): void {
    const windUp = this.mob.windUp;
    if (!windUp) {
      this.telegraphed = null;
      this.telegraph?.hide();
      return;
    }
    if (!this.telegraph) {
      this.telegraph = new Telegraph();
      this.object.add(this.telegraph.object);
    }
    // A new wind-up is one landing at a different moment from the last one.
    if (this.telegraphed?.landsAt !== windUp.landsAt) {
      this.telegraphed = { landsAt: windUp.landsAt, seenAt: elapsedMs };
    }
    const ability = ENEMY_ABILITIES[windUp.abilityId];
    this.telegraph.show(ability.range, (elapsedMs - this.telegraphed.seenAt) / ability.windUpMs);
  }

  /** A swing or a bite, turned to face what it was aimed at. See `PlayerActor.swing`. */
  swing(toward: Point, atMs: number): void {
    this.facing.rotation.y = facingYaw(
      toward.x - this.mob.x,
      toward.y - this.mob.y,
      this.facing.rotation.y,
    );
    this.reactions.swing(atMs);
  }

  /** A blow the player landed. */
  struck(atMs: number): void {
    this.reactions.hit(atMs, PALETTE.strikeFlash);
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
   * its stump to aim at and a mined-out vein its rock, where a fished-out spot
   * leaves nothing on the water.
   *
   * A node's `body` is a top-down footprint, so which of its two spans is a
   * *height* is the prop's decision rather than the data's, and this reads it
   * the way `props.ts` draws it — anything standing up out of the ground is
   * `body.height` tall on a square of `body.width`, where ripples lie flat on
   * water the ground mesh sinks.
   */
  pickBox(): Box3 | null {
    if (!this.prop.object.visible) return null;
    const { width, height } = this.node.definition.body;
    return this.node.definition.shape === 'ripple'
      ? pickBox(this.node.x, this.node.y, {
          width,
          depth: height,
          height: 0,
          base: -WATER_DEPTH,
        })
      : pickBox(this.node.x, this.node.y, { width, depth: width, height });
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

    // Both off the same table the name is: which person this is decides what
    // they look like, the direction everything else here runs in.
    const figure = buildFigure(NPC_APPEARANCES[npc.npcId]);
    // Facing south, out over the counter and toward the camera's default spot.
    figure.object.rotation.y = facingYaw(0, 1);
    this.object.add(figure.object);
    this.height = figure.height;

    this.plate = new Nameplate(figure.height + PLATE_CLEARANCE, { healthBar: false });
    this.plate.setLabel(npcName(npc.npcId), THEME.color.levelUp);
    this.object.add(this.plate.object);
  }

  /**
   * Catches the marker up to the character.
   *
   * Read off the state each frame rather than driven by an event, the same
   * bargain the con colours make: what a quest or a contract has left to do is
   * *derived* (`QuestSystem`, `BountySystem`) from the bag, the kills or the
   * arrivals, so the thing that changes this glyph is a rat bone landing in the
   * pack — and nothing publishes that. `setMarker` only rebuilds when the answer
   * actually moves, so the frame cost is the walk down two short lists.
   *
   * Both lists rather than one, and the same three glyphs off each: a player
   * reading a head at forty feet is asking whether walking over is worth it, and
   * that question does not change because the person answering it deals in
   * standing work instead of stories.
   */
  sync(state: CharacterState): void {
    const marker = strongerMarker(
      npcMarker(this.npc.npcId, state.quests, state),
      bountyMarker(this.npc.npcId, state),
    );
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

/**
 * A station, which is a thing that is simply there.
 *
 * Almost the least an actor can be: no plate and no sync, since nothing about it
 * changes. It is `Pickable` because a station is **opened by tapping it**, the
 * way a counter is — proximity alone would put a panel in the face of anyone
 * who walked past on their way somewhere, which on a map this size is most of
 * the reasons to be near one.
 *
 * Which one it is picks the builder, the same bargain `creatures.ts` makes about
 * an enemy's `shape`: the world says what stands there and the renderer says
 * what that looks like. `fire` is not here — a campfire is placed by the player
 * and burns out, so it is `CampfireActor`'s and has a clock on it.
 */
const STATION_PROPS: Record<Exclude<StationId, 'fire'>, () => Group> = {
  forge: buildForge,
  tannery: buildTannery,
};

export class StationActor implements Actor, Pickable {
  readonly object = new Group();
  readonly station: WorldStation;

  constructor(station: WorldStation) {
    this.station = station;
    this.object.userData.kind = 'station';
    this.object.position.copy(simToWorld(station.x, station.y));
    if (station.station !== 'fire') {
      this.object.add(STATION_PROPS[station.station]());
    }
  }

  /** A tile square, which is about what the block and its anvil occupy. */
  pickBox(): Box3 | null {
    return pickBox(this.station.x, this.station.y, {
      width: TILE_SIZE,
      depth: TILE_SIZE,
      height: TILE_SIZE,
    });
  }

  dispose(): void {
    disposeTree(this.object);
  }
}

/**
 * How near the doorstep counts as standing on it.
 *
 * A tile, which is what a walk to the door actually leaves: `doorPoint` is half
 * a tile off the wall and the walk lands inside `arriveRadius` of it, which a
 * slow frame widens to about 38 units. Wider would be a shop that swallows you
 * from across the street; narrower would be a second tap that does nothing.
 */
const DOOR_REACH = TILE_SIZE;

/**
 * A building: the largest thing in the world, and the one actor that is both
 * `Occluder` and `Pickable`, for opposite reasons.
 *
 * It **must** fade, because it is the only thing tall and wide enough to hide
 * the player outright: a shopfront the camera has been dragged behind would
 * otherwise leave nothing on screen to tap. And it is picked *last of all*,
 * below even the forge, because the priority in `pickTap` is not a depth sort —
 * anything ranked above mobs wins from anywhere along the ray, and a building is
 * three tiles of it.
 *
 * It had no `sync` while it was a solid mass, since nothing about it changed.
 * A room changes two things, and both are about where the player is standing
 * rather than about the building: what is drawn of it, and what a tap on it
 * means.
 */
export class BuildingActor implements Actor, Pickable, Occluder {
  readonly object = new Group();
  readonly building: WorldBuilding;
  private readonly counter: WorldNpc | null;
  private readonly prop: ReturnType<typeof buildBuilding>;
  private readonly box: Box3;
  private readonly lamp: RoomLamp;
  private occluded = false;
  private inside = false;
  private atDoor = false;

  constructor(building: WorldBuilding, counter: WorldNpc | null = null) {
    this.building = building;
    this.counter = counter;
    this.object.userData.kind = 'building';
    this.object.position.copy(simToWorld(building.x, building.y));
    this.prop = buildBuilding(building.definition);
    this.object.add(this.prop.object);

    this.lamp = {
      at: this.object.position.clone().setY(this.prop.wallHeight * LAMP_HEIGHT_FRACTION),
      color: BUILDING_LOOKS[building.definition.shape].lamp,
    };

    const rect = buildingRect(building);
    this.box = new Box3(
      new Vector3(rect.left, 0, rect.top),
      new Vector3(rect.right, this.prop.height, rect.bottom),
    );

    // The name over the door, which is the whole of how a player tells the bank
    // from the store: there are no art assets, so four shopfronts are one box in
    // one colour until something says which is which. A sprite faces the camera
    // by construction, so unlike a nameplate it needs no billboarding of its own.
    //
    // Tagged `sign` rather than `label` on purpose. `drawnCounts` counts one
    // label per drawn creature and `scripts/smoke.mjs` asserts that total in
    // every zone; a building calling its name a label would break the invariant
    // everywhere it holds.
    const sign = buildText(building.definition.name, THEME.color.text, SIGN_HEIGHT);
    if (sign) {
      sign.userData.kind = 'sign';
      sign.position.y = this.prop.height + SIGN_CLEARANCE;
      this.object.add(sign);
    }
  }

  /**
   * The footprint standing as tall as it is drawn — the same box that stops the
   * player, which is what keeps what you cannot walk through and what you cannot
   * see past the same building.
   */
  occluderBox(): Box3 {
    return this.box;
  }

  /**
   * Being inside, which is the occlusion question with a different answer.
   *
   * A roof faded to a quarter still reads as a lid over your head, so what
   * standing in a room does is *take away* the roof and whichever walls the
   * camera is looking in over — and the fade is switched off while it does,
   * since the far walls left standing are the whole of what the room is read
   * against. Which walls those are moves with the camera, so this runs every
   * frame rather than latching on the way in.
   */
  sync(cameraPosition: Vector3, player: Point): void {
    const inside = isInside(this.building, player);
    const door = doorPoint(this.building);
    this.atDoor = Math.hypot(player.x - door.x, player.y - door.y) <= DOOR_REACH;
    this.prop.cutaway(
      inside
        ? {
            x: cameraPosition.x - this.object.position.x,
            y: cameraPosition.z - this.object.position.z,
          }
        : null,
    );
    if (inside === this.inside) return;
    this.inside = inside;
    this.applyOpacity();
  }

  setOccluded(occluded: boolean): void {
    if (occluded === this.occluded) return;
    this.occluded = occluded;
    this.applyOpacity();
  }

  /**
   * The room's own light, for as long as somebody is standing in it.
   *
   * Answered by the actor rather than read off the world, because being inside
   * is a question the actor is already asking every frame for the cutaway — and
   * the two have to agree: a room with its lid off and no light in it is the
   * outdoors with walls round it, which is the thing this is for.
   */
  roomLamp(): RoomLamp | null {
    return this.inside ? this.lamp : null;
  }

  private applyOpacity(): void {
    setOpacity(this.prop.object, this.occluded && !this.inside ? OCCLUDED_OPACITY : 1);
  }

  /**
   * Nothing at all, from inside.
   *
   * The box is the whole footprint standing as tall as it is drawn, which from
   * outside is right three times over — it is what stops you, what hides you and
   * what a thumb aims at. From *inside* it is a lid over the floor: the tap
   * would meet the building, resolve to its own doorstep, and walk a player who
   * wanted to cross the room straight back out of it. The roof is not there to
   * be tapped through once it has been cut away, so the honest answer is that
   * there is nothing to pick, and the ray carries on to the ground — which is
   * the floor.
   */
  pickBox(): Box3 | null {
    return this.inside ? null : this.box;
  }

  /**
   * What a tap on it means: whoever works here, or the way in where nobody
   * does.
   *
   * The counter comes first, and that is the whole of how a shop is used now
   * that the shopkeeper is behind a wall. There is no pixel a thumb can put on
   * them from outside — the roof is drawn over the room and the pick box is the
   * whole footprint standing as tall as it is drawn — so the shopfront is what
   * a player has to aim at, and the walk it asks for is the one the pathfinder
   * was built to answer: in through the door and up to the counter. The same
   * ray crossing the figure's own box says `npc` too, so the two agree rather
   * than offering a thumb two answers.
   *
   * Where nobody works it is two taps to go indoors: the doorstep, and then the
   * room once you are standing on it. From outside the floor cannot be tapped
   * at all, so without that second meaning the empty rooms would be reachable
   * by keyboard alone, on a game laid out for a phone.
   */
  tapAnswer(): WorldTap {
    if (this.counter && !this.atDoor) return { kind: 'npc', npc: this.counter };
    const point = this.atDoor
      ? { x: this.building.x, y: this.building.y }
      : doorPoint(this.building);
    return { kind: 'ground', point };
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
