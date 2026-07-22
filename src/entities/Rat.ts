import Phaser from 'phaser';
import { Mob } from './Mob';
import { ENEMIES } from '../data/enemies';

export class Rat extends Mob {
  constructor(scene: Phaser.Scene, x: number, y: number, level: number, playerLevel: number) {
    super(scene, x, y, ENEMIES.rat, level, playerLevel);
  }
}
