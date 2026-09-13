import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world';
import { GameStateManager } from '../game/GameState';
import { ConfigLoader } from '../game/config/ConfigLoader';
import { WaveSpawnerSystem } from '../game/systems/WaveSpawnerSystem';
import { TowerAttackSystem } from '../game/systems/TowerAttackSystem';
import { RulesSystem } from '../game/systems/RulesSystem';
import { HealthSystem } from '../game/systems/HealthSystem';
import { TowerFactory } from '../game/entities/TowerFactory';
import { EnemyFactory } from '../game/entities/EnemyFactory';

describe('Game smoke: spawn -> fight -> reward', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    GameStateManager.reset();
    WaveSpawnerSystem.reset();
    TowerAttackSystem.reset();
  });

  it('wave 1 spawns goblins over time', () => {
    WaveSpawnerSystem.startWave(world);
    for (let i = 0; i < 5; i++) {
      WaveSpawnerSystem.update(world, 1.0);
    }
    const enemies = world.query('Health', 'Enemy', 'MoveSpeed');
    expect(enemies.length).toBe(5);
  });

  it('arrow tower kills a goblin in range and the kill pays reward gold', () => {
    const startGold = ConfigLoader.getEconomy().startingGold;
    TowerFactory.create(world, 'arrow', 5, 5);
    EnemyFactory.create(world, 'goblin', 4, 4);
    // дистанция sqrt(2) ≈ 1.41 < 3.0 — в радиусе; 4 выстрела × 15 = 60 > 50 hp

    for (let i = 0; i < 6; i++) {
      world.updateTime(1.0);
      TowerAttackSystem.update(world, 1.0);
      RulesSystem.update(world, 1.0);
      HealthSystem.update(world, 1.0);
    }

    expect(world.query('Health', 'Enemy').length).toBe(0);
    expect(GameStateManager.getGold()).toBe(startGold + 10);
  });
});
