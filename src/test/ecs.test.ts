import { World } from '../ecs/world';
import { GridPos, ScreenPos, Health, MoveSpeed, PathIndex, PathFollowSystem, HealthSystem } from '../ecs/bitecs';
import { IsoMath } from '../iso/IsoMath';

describe('ECS Demo', () => {
  it('spawns enemies', () => {
    const world = new World();
    const entity = world.spawnEntity({
      GridPos: new GridPos(3, 0),
      PathIndex: new PathIndex(0),
      Health: new Health(3),
      MoveSpeed: new MoveSpeed(10),
      ScreenPos: new ScreenPos(0, 0)
    });
    expect(world.getEntityCount()).toBe(1);
  });

  it('enemies have all components', () => {
    const world = new World();
    const entity = world.spawnEntity({
      GridPos: new GridPos(3, 0),
      PathIndex: new PathIndex(0),
      Health: new Health(3),
      MoveSpeed: new MoveSpeed(10),
      ScreenPos: new ScreenPos(0, 0)
    });
    const gridPos = GridPos.getComponent(entity);
    expect(gridPos.gx).toBe(3);
    expect(gridPos.gy).toBe(0);
  });

  it('PathFollowSystem moves entities', () => {
    const world = new World();
    world.spawnEntity({
      GridPos: new GridPos(3, 0),
      PathIndex: new PathIndex(0),
      Health: new Health(3),
      MoveSpeed: new MoveSpeed(10),
      ScreenPos: new ScreenPos(0, 0)
    });

    const pathFollow = new PathFollowSystem(new IsoMath({ x: 32, y: 16 }), 10);
    pathFollow.update(world, 0.016);

    const entities = world.query<ScreenPos>();
    expect(entities[0].data.y).toBeGreaterThan(0);
  });

  it('HealthSystem removes dead entities', () => {
    const world = new World();
    world.spawnEntity({
      GridPos: new GridPos(3, 0),
      PathIndex: new PathIndex(0),
      Health: new Health(3),
      MoveSpeed: new MoveSpeed(10),
      ScreenPos: new ScreenPos(0, 0)
    });

    const healthSystem = new HealthSystem();
    healthSystem.update(world, 0.016);

    expect(world.getEntityCount()).toBe(0);
  });
});
