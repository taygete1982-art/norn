import { World } from 'bitecs';
import { DemoECS } from '../ecs/DemoECS';
import { IsoMath } from '../iso/IsoMath';
import { GridPos, ScreenPos, Health, MoveSpeed, PathIndex } from '../ecs/components';

export class DemoECS {
  private isoGrid: IsoGrid;
  private iso: IsoMath;
  private world: World;
  private pathFollow: PathFollowSystem;

  constructor(width: number, height: number) {
    this.isoGrid = new IsoGrid(width, height);
    this.iso = new IsoMath({ x: 32, y: 16 });
    this.world = World.create();
    this.pathFollow = new PathFollowSystem(this.iso, 10);

    this.createEnemies();
  }

  createEnemies(): void {
    // 3 врага-заглушки
    for (let i = 0; i < 3; i++) {
      // Спавн вверху (gx=3, gy=0)
      const entity = this.world.spawnEntity(GridPos.getComponent(3, 0), PathIndex.getComponent(i));
      
      // Health = 3 HP
      this.world.addEntity(entity, Health.getComponent(3));
      // Speed = 10
      this.world.addEntity(entity, MoveSpeed.getComponent(10));
      // ScreenPos (экранная позиция будет обновляться PathFollowSystem)
      this.world.addEntity(entity, ScreenPos.getComponent(0, 0));
    }
  }

  update(dt: number): void {
    this.pathFollow.update(this.world, dt);
  }

  tick(): void {
    // Спавн нового врага каждые 3 тика (для демо)
    if (this.world.getEntityCount() < 3) {
      this.createEnemies();
    }
  }

  getGrid(): IsoGrid {
    return this.isoGrid;
  }

  getWorld(): World {
    return this.world;
  }
}

export default DemoECS;
