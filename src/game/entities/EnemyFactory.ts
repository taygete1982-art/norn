import { World } from '../../ecs/world';
import { ConfigLoader } from '../config/ConfigLoader';
import { IsoMath } from '../../iso/IsoMath';

export type EnemyType =
  | 'goblin'
  | 'troll'
  | 'imp'
  | 'spore'
  | 'puffling'
  | 'truffle'
  | 'jelly'
  | 'jellymini'
  | 'caramel'
  | 'chocgolem'
  | 'candyfairy'
  | 'balloon'
  | 'cloudsheep'
  | 'stormling'
  | 'fluffdragon'
  | 'clownfish'
  | 'jellyfish'
  | 'seahorse'
  | 'pearlwhale'
  | 'clown'
  | 'juggler'
  | 'magician'
  | 'elephant'
  | 'queenbee'
  | 'mushroomking'
  | 'cakemonster'
  | 'cloudgiant'
  | 'seaking'
  | 'carnivaldirector';

export interface EnemyData {
  type: string;
  reward: number;
  damage: number;
  abilities: string[];
  splitInto?: { type: string; count: number };
}

const iso = new IsoMath({ x: 32, y: 16 });

export class EnemyFactory {
  /** Множители сложности забега (из LevelConfig.difficulty). Дефолт 1/1. */
  private static difficulty = { hpMul: 1, rewardMul: 1 };

  public static setDifficulty(d: { hpMul: number; rewardMul: number }): void {
    this.difficulty = { hpMul: d.hpMul, rewardMul: d.rewardMul };
  }

  public static resetDifficulty(): void {
    this.difficulty = { hpMul: 1, rewardMul: 1 };
  }

  public static create(world: World, type: EnemyType, gx: number, gy: number): number {
    const stats = ConfigLoader.getEnemies().find((e) => e.id === type);
    if (!stats) throw new Error(`Unknown enemy type: ${type}`);

    const p = iso.gridToScreen(gx, gy);
    const enemy: EnemyData = {
      type,
      reward: Math.round(stats.reward * this.difficulty.rewardMul),
      damage: stats.damage,
      abilities: stats.abilities ?? [],
    };
    if (stats.splitInto !== undefined) enemy.splitInto = { ...stats.splitInto };

    const comps: Record<string, unknown> = {
      GridPos: { gx, gy },
      ScreenPos: { x: p.x, y: p.y },
      Health: {
        hp: Math.round(stats.hp * this.difficulty.hpMul),
        maxHp: Math.round(stats.hp * this.difficulty.hpMul),
      },
      MoveSpeed: { speed: stats.speed },
      PathIndex: { index: 0, t: 0 },
      Enemy: enemy,
    };
    // Босс: состояние способности; hp правит спавнер через hpOverride (flat).
    if (stats.bossAbility !== undefined) {
      const ba = stats.bossAbility;
      comps['Boss'] = {
        abilityType: ba.type,
        period: ba.period,
        enemy: ba.enemy,
        count: ba.count,
        radius: ba.radius,
        duration: ba.duration,
        nextAt: world.getCurrentTime() + ba.period,
        telegraphed: false,
        cycleIdx: 0,
      };
    }
    return world.spawnEntity(comps);
  }

  /** Элита босс-волны: hp ×6, награда ×8, маркер масштаба 1.5. */
  public static makeElite(world: World, id: number): void {
    const health = world.getComponent<{ hp: number; maxHp: number }>(id, 'Health');
    const enemy = world.getComponent<{ reward: number }>(id, 'Enemy');
    if (health) {
      health.hp = health.hp * 6;
      health.maxHp = health.maxHp * 6;
    }
    if (enemy) enemy.reward = enemy.reward * 8;
    world.addComponent(id, 'Elite', { scale: 1.5 });
  }
}
