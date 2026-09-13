import { World } from '../../ecs/world';
import { ConfigLoader } from '../config/ConfigLoader';
import { IsoMath } from '../../iso/IsoMath';

export type TowerType = 'arrow' | 'cannon' | 'ice';

export interface TowerData {
  kind: TowerType;
  damage: number;
  fireRate: number;
  range: number;
  lastFireTime: number;
  aoeRadius?: number;
  slowAmount?: number;
  slowDuration?: number;
}

const iso = new IsoMath({ x: 32, y: 16 });

export class TowerFactory {
  public static create(world: World, type: TowerType, gx: number, gy: number): number {
    const stats = ConfigLoader.getTowers().find((t) => t.id === type);
    if (!stats) throw new Error(`Unknown tower type: ${type}`);

    const p = iso.gridToScreen(gx, gy);
    const tower: TowerData = {
      kind: type,
      damage: stats.damage,
      fireRate: stats.fireRate,
      range: stats.range,
      lastFireTime: 0,
    };
    if (stats.aoeRadius !== undefined) tower.aoeRadius = stats.aoeRadius;
    if (stats.slowAmount !== undefined) tower.slowAmount = stats.slowAmount;
    if (stats.slowDuration !== undefined) tower.slowDuration = stats.slowDuration;

    return world.spawnEntity({
      GridPos: { gx, gy },
      ScreenPos: { x: p.x, y: p.y },
      Tower: tower,
    });
  }

  public static costOf(type: TowerType): number {
    const stats = ConfigLoader.getTowers().find((t) => t.id === type);
    if (!stats) throw new Error(`Unknown tower type: ${type}`);
    return stats.cost;
  }
}
