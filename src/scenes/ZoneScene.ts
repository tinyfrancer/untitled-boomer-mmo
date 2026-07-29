import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { ZONES, type ZoneDefinition, type ZoneEdge } from '../data/zones';
import { PlayerSprite } from '../entities/PlayerSprite';
import { MobSprite } from '../entities/MobSprite';
import { ResourceNodeSprite } from '../entities/ResourceNodeSprite';
import { CampfireSprite } from '../entities/CampfireSprite';
import { Shopkeeper } from '../entities/Shopkeeper';
import { ZoneSignpost } from '../entities/ZoneSignpost';
import { TILESET_KEY } from './generateTextures';
import {
  ACHIEVEMENT_UNLOCKED_EVENT,
  LEVEL_UP_EVENT,
  OFFLINE_AFK_RESOLVED_EVENT,
  RESET_CHARACTER_REQUESTED_EVENT,
} from '../ui/uiEvents';
import { THEME, worldZoom } from '../ui/theme';
import { worldViewportHeight } from '../ui/layout';
import { InputState, bindKeyboard } from '../systems/InputState';
import { createNewCharacter, saveService, type CharacterState } from '../persistence';
import { CharacterController } from '../systems/CharacterController';
import { ZoneWorld, type WorldNpc, type WorldSignpost, type WorldTap } from '../world/ZoneWorld';
import type { FloatTone, WorldEvent } from '../world/worldEvents';
import type { Player } from '../world/Player';
import type { Mob } from '../world/Mob';
import type { ResourceNode } from '../world/ResourceNode';
import type { Campfire } from '../world/Campfire';
import type { GatherState } from '../systems/GatherSystem';
import type { Point } from '../systems/MovementSystem';
import type { AchievementUnlock } from '../ui/uiEvents';
import type { AbilityId, EnemyId, ZoneId } from '../types/ids';

const GROUND_DEPTH = -10;
const SELECTION_RING_RADIUS = 36;
const SELECTION_RING_COLOR = 0xffee58;
const AUTOSAVE_INTERVAL_MS = 30000;

const FLOAT_COLORS: Record<FloatTone, string> = {
  damage: THEME.color.equippable,
  'player-damage': THEME.color.playerDamage,
  heal: THEME.color.heal,
  reward: THEME.color.levelUp,
  skill: THEME.color.skillUp,
  dim: THEME.color.dim,
};

// Passed through scene.restart on a zone change; absent on the first boot.
interface ZoneSceneData {
  zoneId?: ZoneId;
  entryEdge?: ZoneEdge;
  entryFraction?: number;
  // Carried across the restart so walking through an exit is never a heal;
  // omitted on death, where respawning at full is the point.
  hp?: number;
}

/**
 * The view onto one ZoneWorld: a tilemap, a camera, a sprite per simulated
 * thing, and the pointer. Everything the game *does* lives in the world; this
 * scene translates taps into world commands and the frame's WorldEvent[] into
 * things you can see.
 *
 * It also still owns the two jobs the world deliberately refuses: loading a
 * zone (a scene restart today) and the autosave clock. Both are PR 8's.
 */
export class ZoneScene extends Phaser.Scene {
  private world!: ZoneWorld;
  private zone!: ZoneDefinition;
  private initData: ZoneSceneData = {};
  private playerSprite!: PlayerSprite;
  private mobSprites: MobSprite[] = [];
  private nodeSprites: ResourceNodeSprite[] = [];
  private npcSprites: Shopkeeper[] = [];
  private signpostSprites: ZoneSignpost[] = [];
  private campfireSprite: CampfireSprite | null = null;
  private selectionRing!: Phaser.GameObjects.Graphics;
  private readonly inputState = new InputState();
  private unbindKeyboard: (() => void) | null = null;
  private handleWindowUnload = (): void => this.world.persistCharacter();

  constructor() {
    super('Zone');
  }

  init(data: ZoneSceneData): void {
    this.initData = data ?? {};
  }

  create(): void {
    const state =
      (this.registry.get('character') as CharacterState | undefined) ??
      createNewCharacter('Adventurer', 'warrior');
    this.zone = ZONES[this.initData.zoneId ?? state.zoneId ?? 'town'];

    this.buildTilemap();
    this.world = new ZoneWorld({
      zone: this.zone,
      character: new CharacterController(state),
      events: this.game.events,
      input: this.inputState,
      entry:
        this.initData.entryEdge !== undefined
          ? { edge: this.initData.entryEdge, fraction: this.initData.entryFraction ?? 0.5 }
          : undefined,
      hp: this.initData.hp,
    });
    this.buildSprites();

    this.cameras.main.setBounds(0, 0, this.world.worldWidth, this.world.worldHeight);
    this.cameras.main.startFollow(this.playerSprite, true);
    this.applyCameraZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyCameraZoom, this);

    this.selectionRing = this.add.graphics();
    this.selectionRing.setVisible(false);

    this.input.on('pointerdown', this.handlePointerDown, this);
    this.unbindKeyboard = bindKeyboard(this.inputState, window);
    this.game.events.on(RESET_CHARACTER_REQUESTED_EVENT, this.resetCharacter, this);
    // Con colors are relative to the player, so every enemy name has to be
    // redrawn when they level.
    this.game.events.on(LEVEL_UP_EVENT, this.refreshMobLabels, this);

    this.time.addEvent({
      delay: AUTOSAVE_INTERVAL_MS,
      loop: true,
      callback: () => this.world.persistCharacter(),
    });
    window.addEventListener('pagehide', this.handleWindowUnload);
    window.addEventListener('beforeunload', this.handleWindowUnload);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // Rebound in create(), and deliberately not cleared: a zone change is a
      // scene restart, and a key still held through it should not need
      // releasing and pressing again on the far side.
      this.unbindKeyboard?.();
      this.unbindKeyboard = null;
      window.removeEventListener('pagehide', this.handleWindowUnload);
      window.removeEventListener('beforeunload', this.handleWindowUnload);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.applyCameraZoom, this);
      this.game.events.off(RESET_CHARACTER_REQUESTED_EVENT, this.resetCharacter, this);
      this.game.events.off(LEVEL_UP_EVENT, this.refreshMobLabels, this);
      this.world.destroy();
    });

    // Last, so the sprites and the log are all there to pay it into.
    this.deliverParkedAfk();

    // Dev-only handle on the live simulation, for the devtools console and the
    // smoke check. Re-set on every zone change, since each builds a new world.
    if (import.meta.env.DEV) {
      (window as unknown as { world: ZoneWorld }).world = this.world;
    }

    // The HUD survives zone changes: launched once on first boot, and left
    // running when this scene restarts into another zone.
    if (!this.scene.isActive('UI')) {
      this.scene.launch('UI');
    }
  }

  private buildTilemap(): void {
    const tilemap = this.make.tilemap({
      data: this.zone.map,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = tilemap.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) {
      throw new Error(`Failed to register tileset image "${TILESET_KEY}"`);
    }
    const groundLayer = tilemap.createLayer(0, tileset, 0, 0);
    if (!groundLayer) {
      throw new Error('Failed to create ground layer');
    }
    // Below everything, so flat decals drawn onto the terrain (fishing spots)
    // can sit at a negative depth and still be visible above it.
    groundLayer.setDepth(GROUND_DEPTH);
  }

  private buildSprites(): void {
    const level = this.world.character.state.level;
    this.playerSprite = new PlayerSprite(this, this.world.player);
    this.mobSprites = this.world.mobs.map((mob) => {
      const sprite = new MobSprite(this, mob, level);
      sprite.setInteractive();
      return sprite;
    });
    this.nodeSprites = this.world.nodes.map((node) => {
      const sprite = new ResourceNodeSprite(this, node);
      sprite.setInteractive();
      return sprite;
    });
    this.npcSprites = this.world.npcs.map((npc) => new Shopkeeper(this, npc));
    this.signpostSprites = this.world.signposts.map((signpost) => new ZoneSignpost(this, signpost));
  }

  update(_time: number, delta: number): void {
    const events = this.world.update(delta);
    this.syncSprites();
    this.updateSelectionRing();
    events.forEach((event) => this.render(event));
  }

  private syncSprites(): void {
    this.playerSprite.sync();
    this.mobSprites.forEach((sprite) => sprite.sync());
    this.nodeSprites.forEach((sprite) => sprite.sync());

    const campfire = this.world.campfire;
    if (campfire && !this.campfireSprite) {
      this.campfireSprite = new CampfireSprite(this, campfire);
    } else if (!campfire && this.campfireSprite) {
      this.campfireSprite.extinguish();
      this.campfireSprite = null;
    }
  }

  private refreshMobLabels(level: number): void {
    this.mobSprites.forEach((sprite) => sprite.refreshLabel(level));
  }

  // ---------------------------------------------------------------------------
  // Drawing what happened
  // ---------------------------------------------------------------------------

  private render(event: WorldEvent): void {
    switch (event.kind) {
      case 'hit': {
        const tone: FloatTone = event.on === 'player' ? 'player-damage' : 'damage';
        if (event.absorbed > 0) {
          this.float(event.at.x, event.at.y - 16, `(${event.absorbed} absorbed)`, 'skill');
        }
        if (event.damage > event.absorbed) {
          const shown = event.on === 'player' ? event.damage - event.absorbed : event.damage;
          this.float(
            event.at.x,
            event.at.y,
            `-${shown}`,
            event.via === 'ability' ? 'reward' : tone,
          );
        }
        return;
      }
      case 'defend':
        this.float(event.at.x, event.at.y, event.skillName, 'heal');
        return;
      case 'heal':
        this.float(event.at.x, event.at.y, `+${event.amount}`, 'heal');
        return;
      case 'float':
        this.float(event.at.x, event.at.y, event.text, event.tone);
        return;
      case 'bolt-cast':
        this.castBolt(event.from, event.to);
        return;
      case 'death':
        if (event.on === 'player' && event.respawnZone) {
          this.scene.restart({ zoneId: event.respawnZone } satisfies ZoneSceneData);
        }
        return;
      case 'zone-exit':
        this.scene.restart({
          zoneId: event.to,
          entryEdge: event.edge,
          entryFraction: event.fraction,
          hp: this.world.player.hp,
        } satisfies ZoneSceneData);
        return;
      default:
        // spawn and gather-tick have nothing to draw in 2D: the sprites read the
        // simulation directly. The 3D view is what they exist for.
        return;
    }
  }

  // A bolt thrown from the caster to the target. Purely cosmetic, but a ranged
  // nuke that produced only a number over the mob read as nothing happening.
  private castBolt(from: { x: number; y: number }, to: { x: number; y: number }): void {
    const bolt = this.add.circle(from.x, from.y, 8, 0xff7043, 1);
    bolt.setStrokeStyle(2, 0xffd54f, 1);
    this.tweens.add({
      targets: bolt,
      x: to.x,
      y: to.y,
      duration: 180,
      onComplete: () => bolt.destroy(),
    });
  }

  private float(x: number, y: number, message: string, tone: FloatTone): void {
    const text = this.add
      // world-space, so this scales with the camera rather than the ui scale
      .text(x, y - 20, message, {
        fontSize: '20px',
        color: FLOAT_COLORS[tone],
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      duration: 600,
      onComplete: () => text.destroy(),
    });
  }

  private updateSelectionRing(): void {
    const target = this.world.target;
    if (!target) {
      this.selectionRing.setVisible(false);
      return;
    }
    this.selectionRing.clear();
    this.selectionRing.lineStyle(2, SELECTION_RING_COLOR, 1);
    this.selectionRing.strokeCircle(target.x, target.y, SELECTION_RING_RADIUS);
    this.selectionRing.setVisible(true);
  }

  /**
   * Fits the world camera into the screen *above* the tab bar.
   *
   * The bar is opaque HUD furniture that eats every tap landing on it, so any
   * world drawn underneath it is unreachable — which is exactly what happened
   * to the south signpost in town, rendering four pixels inside the bar on a
   * portrait phone with no way to tap it. Shrinking the viewport instead of
   * nudging pixels makes "every world object can be tapped" true by
   * construction rather than by luck.
   */
  private applyCameraZoom(): void {
    const height = worldViewportHeight(this.scale.width, this.scale.height);
    this.cameras.main.setViewport(0, 0, this.scale.width, height);
    this.cameras.main.setZoom(
      worldZoom(this.scale.width, height, this.world.worldWidth, this.world.worldHeight),
    );
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  // What world objects are under this pointer, tested explicitly. The
  // currentlyOver list the pointerdown event carries is NOT used: with two
  // active scenes (UI above this one), Phaser 3.90 computes every scene's
  // list into one shared internal array, and on pointerdown this scene's
  // copy is intermittently stale/empty depending on event/frame timing —
  // clicks on mobs and NPCs silently fell through to the ground path. An
  // explicit hit test against our own clickables, with a private output
  // array, is deterministic.
  private hitTestWorld(pointer: Phaser.Input.Pointer): Phaser.GameObjects.GameObject[] {
    const candidates: Phaser.GameObjects.GameObject[] = [
      ...this.nodeSprites,
      ...this.npcSprites,
      ...this.signpostSprites,
      ...this.mobSprites,
    ];
    return this.input.manager.hitTest(pointer, candidates, this.cameras.main, []);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    // Clicks that land on the HUD belong to it, not the world.
    const ui = this.scene.get('UI');
    if (ui?.input && ui.input.hitTestPointer(pointer).length > 0) {
      return;
    }
    this.world.tap(this.resolveTap(pointer));
  }

  // The one piece of hit testing that has to stay here: what a screen pixel is
  // over is a question about the camera and the sprites, not about the game.
  private resolveTap(pointer: Phaser.Input.Pointer): WorldTap {
    const over = this.hitTestWorld(pointer);

    const node = over.find((obj): obj is ResourceNodeSprite => obj instanceof ResourceNodeSprite);
    if (node) return { kind: 'node', node: node.node };

    const signpost = over.find((obj): obj is ZoneSignpost => obj instanceof ZoneSignpost);
    if (signpost) return { kind: 'signpost', signpost: signpost.signpost };

    const npc = over.find((obj): obj is Shopkeeper => obj instanceof Shopkeeper);
    if (npc) return { kind: 'npc', npc: npc.npc };

    const mob = over.find((obj): obj is MobSprite => obj instanceof MobSprite);
    if (mob) return { kind: 'mob', mob: mob.mob };

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { kind: 'ground', point: { x: worldPoint.x, y: worldPoint.y } };
  }

  // ---------------------------------------------------------------------------
  // Host duties the world refuses
  // ---------------------------------------------------------------------------

  /**
   * Stashes an offline camp's payout where the HUD can find it. It goes through
   * the registry rather than an event because the only load that can find a
   * parked session is the first boot into this scene — a zone change clears the
   * camp on its way out — and the HUD is not listening yet at that point.
   */
  private deliverParkedAfk(): void {
    const resolved = this.world.resolveParkedAfk();
    if (!resolved) return;
    this.registry.set(OFFLINE_AFK_RESOLVED_EVENT, resolved.report);
    if (resolved.unlocks.length > 0) {
      this.registry.set(ACHIEVEMENT_UNLOCKED_EVENT, resolved.unlocks);
    }
  }

  private resetCharacter(): void {
    saveService.clear();
    this.registry.remove('character');
    this.scene.stop('UI');
    this.scene.start('CharacterCreate');
  }

  // ---------------------------------------------------------------------------
  // Smoke-check surface. `scripts/smoke.mjs` still reaches into the scene for
  // live state; PR 9 of the port retargets it at `window.world` and these go.
  // ---------------------------------------------------------------------------

  get player(): Player {
    return this.world.player;
  }
  /** The figure, as opposed to the simulation: the walk cycle lives out here. */
  get figure(): PlayerSprite {
    return this.playerSprite;
  }
  get mobs(): Mob[] {
    return this.world.mobs;
  }
  get nodes(): ResourceNode[] {
    return this.world.nodes;
  }
  get npcs(): WorldNpc[] {
    return this.world.npcs;
  }
  get signposts(): WorldSignpost[] {
    return this.world.signposts;
  }
  get campfire(): Campfire | null {
    return this.world.campfire;
  }
  get character(): CharacterController {
    return this.world.character;
  }
  get spawnPoint(): Point {
    return this.world.spawnPoint;
  }
  get worldWidth(): number {
    return this.world.worldWidth;
  }
  get worldHeight(): number {
    return this.world.worldHeight;
  }
  get gatherState(): GatherState | null {
    return this.world.gatherState;
  }
  get afkActive(): boolean {
    return this.world.afkActive;
  }
  get lastAbilityAt(): Map<AbilityId, number> {
    return this.world.lastAbilityAt;
  }
  get target(): Mob | null {
    return this.world.target;
  }
  set target(mob: Mob | null) {
    this.world.target = mob;
  }
  get shopNpc(): WorldNpc | null {
    return this.world.shopNpc;
  }
  set shopNpc(npc: WorldNpc | null) {
    this.world.shopNpc = npc;
  }

  setTarget(mob: Mob): void {
    this.world.setTarget(mob);
  }
  clearTarget(): void {
    this.world.clearTarget();
  }
  closeShop(): void {
    this.world.closeShop();
  }
  startGathering(node: ResourceNode): void {
    this.world.startGathering(node);
  }
  stopGathering(): void {
    this.world.stopGathering();
  }
  updateShopRange(): void {
    this.world.updateShopRange();
  }
  approachShop(npc: WorldNpc): void {
    this.world.approachShop(npc);
  }
  resolveKill(mob: Mob): void {
    this.world.resolveKill(mob);
  }
  creditKill(enemyId: EnemyId, count = 1): AchievementUnlock[] {
    return this.world.creditKill(enemyId, count);
  }
  handleBuyRequested(itemId: string): void {
    this.world.handleBuyRequested(itemId);
  }
  handleSellRequested(itemId: string): void {
    this.world.handleSellRequested(itemId);
  }
  handleEquipRequested(itemId: string): void {
    this.world.handleEquipRequested(itemId);
  }
  handleEatRequested(itemId: string): void {
    this.world.handleEatRequested(itemId);
  }
  handleCookRequested(itemId?: string): void {
    this.world.handleCookRequested(itemId);
  }
  handleLightFireRequested(): void {
    this.world.handleLightFireRequested();
  }
  handleAbilityRequested(abilityId: AbilityId): void {
    this.world.handleAbilityRequested(abilityId);
  }
}
