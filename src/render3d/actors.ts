import { Group, type Camera } from 'three';
import {
  NPC_APPEARANCES,
  appearanceTextureKey,
  computeAppearance,
} from '../systems/AppearanceSystem';
import { conColor, enemyDisplayName } from '../systems/EnemySystem';
import { THEME } from '../ui/theme';
import { DEATH_FADE_MS, type Mob } from '../world/Mob';
import { buildCreature } from './creatures';
import { facingYaw, simToWorld } from './coords';
import { buildFigure, type Figure } from './figure';
import { disposeTree, setOpacity } from './dispose';
import { Nameplate } from './nameplate';
import { buildCampfire, buildNode, buildSignpost } from './props';
import type { Campfire } from '../world/Campfire';
import type { Player } from '../world/Player';
import type { ResourceNode } from '../world/ResourceNode';
import type { WorldNpc, WorldSignpost } from '../world/ZoneWorld';

/** How far over a figure's head its nameplate floats. */
const PLATE_CLEARANCE = 12;

/** Just clear of the signpost's board, which stands a tile tall. */
const SIGNPOST_LABEL_HEIGHT = 76;

/**
 * What draws one simulated thing — the 3D half of `entities/*Sprite`.
 *
 * Every actor is the same three layers: an outer group that holds the world
 * position, a facing group that holds the yaw, and whatever hangs above it. The
 * split matters: a nameplate is billboarded by having its own rotation written
 * every frame, so it cannot be under something that is also being turned to
 * face where the creature is walking.
 *
 * Nothing here decides anything. The simulation owns position, health, gear and
 * death; an actor catches up to it in `sync()` and hands its geometry back in
 * `dispose()` — which in 2D was a stray label and here is memory the card never
 * gets back.
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
    this.appearanceKey = appearanceTextureKey(appearance);
    this.figure = buildFigure(appearance);
    this.facing.add(this.figure.object);

    this.plate = new Nameplate(this.figure.height + PLATE_CLEARANCE, { width: 64, height: 10 });
    this.plate.setLabel(player.name, THEME.color.text);
    this.object.add(this.plate.object);
  }

  sync(elapsedMs: number): void {
    // The look is rebuilt when the gear changes rather than when something calls
    // a setter: the simulation has no idea anything is drawing it, and a pure
    // function of the gear is cheaper to compare than it is to notify.
    const appearance = computeAppearance(this.player.currentGear());
    if (appearanceTextureKey(appearance) !== this.appearanceKey) {
      this.appearanceKey = appearanceTextureKey(appearance);
      disposeTree(this.figure.object);
      this.figure = buildFigure(appearance);
      this.facing.add(this.figure.object);
    }

    this.object.position.copy(simToWorld(this.player.x, this.player.y));
    this.facing.rotation.y = facingYaw(this.player.vx, this.player.vy, this.facing.rotation.y);
    this.figure.stride(this.player.isMoving(), elapsedMs);
    this.plate.setLabel(this.player.name, THEME.color.text);
    this.plate.setHealth(this.player.hp, this.player.maxHp);
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

export class MobActor implements Actor {
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
      setOpacity(this.facing, 1);
      this.creature.stride(this.mob.vx !== 0 || this.mob.vy !== 0, elapsedMs + this.phaseOffsetMs);
      this.plate.setVisible(true);
      this.plate.setHealth(this.mob.hp, this.mob.maxHp);
      return;
    }

    // The fade is read off the simulation's own death clock rather than played
    // as a tween, which is what lets the world respawn on time with nothing
    // drawing it at all.
    const faded = Math.min(1, this.mob.deadForMs / DEATH_FADE_MS);
    setOpacity(this.facing, 1 - faded);
    this.object.visible = faded < 1;
    this.plate.setVisible(false);
  }

  faceCamera(camera: Camera): void {
    this.plate.faceCamera(camera);
  }

  dispose(): void {
    disposeTree(this.object);
  }
}

export class NodeActor implements Actor {
  readonly object = new Group();
  readonly node: ResourceNode;
  private readonly prop: ReturnType<typeof buildNode>;
  private drawnAvailable = true;

  constructor(node: ResourceNode) {
    this.node = node;
    this.object.userData.kind = 'node';
    this.object.position.copy(simToWorld(node.x, node.y));
    this.prop = buildNode(node);
    this.object.add(this.prop.object);
    this.prop.setAvailable(true);
  }

  sync(): void {
    const available = this.node.isAvailable();
    if (available === this.drawnAvailable) return;
    this.drawnAvailable = available;
    this.prop.setAvailable(available);
  }

  dispose(): void {
    disposeTree(this.object);
  }
}

export class NpcActor implements Actor {
  readonly object = new Group();
  readonly npc: WorldNpc;
  private readonly plate: Nameplate;

  constructor(npc: WorldNpc) {
    this.npc = npc;
    this.object.userData.kind = 'npc';
    this.object.position.copy(simToWorld(npc.x, npc.y));

    const figure = buildFigure(NPC_APPEARANCES.shopkeeper);
    // Facing south, out of the shop and toward the camera's default position.
    figure.object.rotation.y = facingYaw(0, 1);
    this.object.add(figure.object);

    this.plate = new Nameplate(figure.height + PLATE_CLEARANCE, { healthBar: false });
    this.plate.setLabel('Shopkeeper', THEME.color.levelUp);
    this.object.add(this.plate.object);
  }

  faceCamera(camera: Camera): void {
    this.plate.faceCamera(camera);
  }

  dispose(): void {
    disposeTree(this.object);
  }
}

export class SignpostActor implements Actor {
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
