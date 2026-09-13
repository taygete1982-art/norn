import { World } from '../../ecs/world';
import { ConfigLoader } from '../config/ConfigLoader';
import { IsoMath } from '../../iso/IsoMath';

export type EnemyType = 'goblin' | 'troll' | 'imp' | 'spore' | 'puffling' | 'truffle';

export interface EnemyData {
  type: string;
  reward: number;
  damage: number;
  abilities: string[];
  splitInto?: { type: string; count: number };
}

const iso = new IsoMath({ x: 32, y: 16 });

export class EnemyFactory {
  public static create(world: World, type: EnemyType, gx: number, gy: number): number {
    const stats = ConfigLoader.getEnemies().find((e) => e.id === type);
    if (!stats) throw new Error(`Unknown enemy type: ${type}`);

    const p = iso.gridToScreen(gx, gy);
    const enemy: EnemyData = {
      type,
      reward: stats.reward,
      damage: stats.damage,
      abilities: stats.abilities ?? [],
    };
    if (stats.splitInto !== undefined) enemy.splitInto = { ...stats.splitInto };

    return world.spawnEntity({
      GridPos: { gx, gy },
      ScreenPos: { x: p.x, y: p.y },
      Health: { hp: stats.hp, maxHp: stats.hp },
      MoveSpeed: { speed: stats.speed },
      PathIndex: { index: 0, t: 0 },
      Enemy: enemy,
    });
  }
}
