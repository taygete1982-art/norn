import { describe, it, expect, beforeEach } from 'vitest';
import { WaveSpawnerSystem } from '../game/systems/WaveSpawnerSystem';
import { TowerAttackSystem } from '../game/systems/TowerAttackSystem';
import { TowerFactory } from '../game/entities/TowerFactory';
import { EnemyFactory } from '../game/entities/EnemyFactory';
import { World } from '../ecs/world';

describe('WaveSpawnerSystem', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    WaveSpawnerSystem.reset();
  });

  it('spawns correct number of goblins in wave 1', () => {
    WaveSpawnerSystem.startWave(world);

    for (let i = 0; i < 5; i++) {
      WaveSpawnerSystem.update(world, 1.0);
    }

    const enemies = world.query('Health', 'Enemy', 'MoveSpeed');
    expect(enemies.length).toBe(5);

    const health = world.getComponent<any>(enemies[0], 'Health');
    expect(health.hp).toBe(50);
    expect(health.maxHp).toBe(50);
  });
});

describe('TowerAttackSystem', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    TowerAttackSystem.reset();
  });

  it('tower in range kills standing enemy in expected ticks', () => {
    const towerId = TowerFactory.create(world, 'arrow', 5, 5);
    const enemyId = EnemyFactory.create(world, 'goblin', 4, 4);
    // дистанция sqrt(2) ≈ 1.41 < 3.0 — в радиусе

    for (let i = 0; i < 5; i++) {
      world.updateTime(1.0);
      TowerAttackSystem.update(world, 1.0);
    }

    const health = world.getComponent<any>(enemyId, 'Health');
    // 4 выстрела × 15 урона = 60 > 50 hp
    expect(health.hp).toBeLessThanOrEqual(0);
    expect(towerId).toBeDefined();
  });

  it('tower out of range does not fire', () => {
    TowerFactory.create(world, 'arrow', 5, 5);
    const enemyId = EnemyFactory.create(world, 'goblin', 0, 0);
    // дистанция sqrt(50) ≈ 7.07 > 3.0 — вне радиуса

    for (let i = 0; i < 5; i++) {
      world.updateTime(1.0);
      TowerAttackSystem.update(world, 1.0);
    }

    const health = world.getComponent<any>(enemyId, 'Health');
    expect(health.hp).toBe(50);
  });
});
