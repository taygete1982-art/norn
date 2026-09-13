import { describe, it, expect } from 'vitest';
import { World } from '../ecs/world';
import { EnemyFactory } from '../game/entities/EnemyFactory';
import { MoveSystem, PATH } from '../game/systems/MoveSystem';
import { HealthSystem } from '../game/systems/HealthSystem';

describe('ECS core (vanilla world)', () => {
  it('spawns entities', () => {
    const world = new World();
    world.spawnEntity({
      GridPos: { gx: 3, gy: 0 },
      PathIndex: { index: 0, t: 0 },
      Health: { hp: 3, maxHp: 3 },
      MoveSpeed: { speed: 10 },
      ScreenPos: { x: 0, y: 0 },
    });
    expect(world.getEntityCount()).toBe(1);
  });

  it('components round-trip', () => {
    const world = new World();
    const entity = world.spawnEntity({
      GridPos: { gx: 3, gy: 0 },
      PathIndex: { index: 0, t: 0 },
      Health: { hp: 3, maxHp: 3 },
      MoveSpeed: { speed: 10 },
      ScreenPos: { x: 0, y: 0 },
    });
    const gridPos = world.getComponent<{ gx: number; gy: number }>(entity, 'GridPos');
    expect(gridPos?.gx).toBe(3);
    expect(gridPos?.gy).toBe(0);
  });

  it('MoveSystem moves entities along PATH', () => {
    const world = new World();
    const id = EnemyFactory.create(world, 'goblin', PATH[0].gx, PATH[0].gy);
    const before = { ...(world.getComponent<{ gx: number; gy: number }>(id, 'GridPos')!) };

    MoveSystem.update(world, 1.0);

    const after = world.getComponent<{ gx: number; gy: number }>(id, 'GridPos')!;
    expect(after.gx).toBeGreaterThan(before.gx);
    expect(after.gy).toBeGreaterThan(before.gy);
  });

  it('HealthSystem removes dead entities and keeps the living', () => {
    const world = new World();
    const dead = EnemyFactory.create(world, 'goblin', 0, 0);
    const alive = EnemyFactory.create(world, 'goblin', 1, 1);
    world.getComponent<{ hp: number }>(dead, 'Health')!.hp = 0;

    const healthSystem = HealthSystem;
    healthSystem.update(world, 0.016);

    expect(world.getComponent(dead, 'Health')).toBeUndefined();
    expect(world.getComponent<{ hp: number }>(alive, 'Health')?.hp).toBe(50);
    expect(world.getEntityCount()).toBe(1);
  });
});
