import Phaser from 'phaser';
import { Mob, type MobConfig } from './Mob';

const RAT_CONFIG: Omit<MobConfig, 'textureKey'> = {
  maxHp: 20,
  xpReward: 5,
  respawnDelayMs: 6000,
  wander: {
    radius: 48,
    minPauseMs: 1500,
    maxPauseMs: 3500,
    speed: 40,
  },
};

export class Rat extends Mob {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, { textureKey: 'rat', ...RAT_CONFIG });
  }
}
