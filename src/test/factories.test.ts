import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigLoader } from '../game/config/ConfigLoader';
import { TowerFactory } from '../game/entities/TowerFactory';
import { EnemyFactory } from '../game/entities/EnemyFactory';
import { World } from '../ecs/world';

describe('Entity Factories', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('TowerFactory', () => {
    it('creates arrow tower with stats from config', () => {
      const id = TowerFactory.create(world, 'arrow', 1, 1);
      const tower = world.getComponent<any>(id, 'Tower');

      expect(tower.damage).toBe(15);
      expect(tower.fireRate).toBe(1.0);
      expect(tower.range).toBe(3.0);
      expect(tower.lastFireTime).toBe(0);
    });

    it('creates cannon tower with aoeRadius', () => {
      const id = TowerFactory.create(world, 'cannon', 2, 2);
      const tower = world.getComponent<any>(id, 'Tower');

      expect(tower.damage).toBe(40);
      expect(tower.fireRate).toBe(2.5);
      expect(tower.range).toBe(2.5);
      expect(tower.aoeRadius).toBe(1.5);
    });

    it('creates ice tower with slow', () => {
      const id = TowerFactory.create(world, 'ice', 3, 3);
      const tower = world.getComponent<any>(id, 'Tower');

      expect(tower.damage).toBe(10);
      expect(tower.fireRate).toBe(1.2);
      expect(tower.range).toBe(2.8);
      expect(tower.slowAmount).toBe(0.5);
      expect(tower.slowDuration).toBe(2.0);
    });

    it('creates tower with correct grid position', () => {
      const id = TowerFactory.create(world, 'arrow', 5, 5);
      const gridPos = world.getComponent<any>(id, 'GridPos');

      expect(gridPos.gx).toBe(5);
      expect(gridPos.gy).toBe(5);
    });
  });

  describe('EnemyFactory', () => {
    it('creates goblin with stats from config', () => {
      const id = EnemyFactory.create(world, 'goblin', 1, 1);
      const enemy = world.getComponent<any>(id, 'Enemy');
      const health = world.getComponent<any>(id, 'Health');
      const speed = world.getComponent<any>(id, 'MoveSpeed');

      expect(enemy.type).toBe('goblin');
      expect(health.hp).toBe(50);
      expect(health.maxHp).toBe(50);
      expect(speed.speed).toBe(1.5);
      expect(enemy.reward).toBe(10);
      expect(enemy.damage).toBe(1);
    });

    it('creates troll with stats from config', () => {
      const id = EnemyFactory.create(world, 'troll', 0, 0);
      const health = world.getComponent<any>(id, 'Health');

      expect(health.hp).toBe(150);
    });

    it('creates imp with stats from config', () => {
      const id = EnemyFactory.create(world, 'imp', 0, 0);
      const health = world.getComponent<any>(id, 'Health');

      expect(health.hp).toBe(25);
    });

    it('matches all enemies against config file', () => {
      for (const cfg of ConfigLoader.getEnemies()) {
        const id = EnemyFactory.create(world, cfg.id as any, 0, 0);
        const health = world.getComponent<any>(id, 'Health');
        expect(health.hp).toBe(cfg.hp);
      }
    });
  });
});
