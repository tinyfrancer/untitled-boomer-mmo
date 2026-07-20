import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { Player } from '../entities/Player';

export class TownScene extends Phaser.Scene {
  private player!: Player;

  constructor() {
    super('Town');
  }

  create(): void {
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 'player-warrior');
  }

  update(): void {
    this.player.update();
  }
}
