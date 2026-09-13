import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world';
import { GameStateManager } from '../game/GameState';
import { ConfigLoader } from '../game/config/ConfigLoader';
import { TowerAttackSystem } from '../game/systems/TowerAttackSystem';
import { MoveSystem, PATH } from '../game/systems/MoveSystem';
import { RulesSystem } from '../game/systems/RulesSystem';
import { HealthSystem } from '../game/systems/HealthSystem';
import { TowerFactory } from '../game/entities/TowerFactory';
import { EnemyFactory } from '../game/entities/EnemyFactory';
import { WaveSpawnerSystem } from '../game/systems/WaveSpawnerSystem';

describe('Enemy abilities (data-driven)', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    GameStateManager.reset();
    TowerAttackSystem.reset();
  });

  it('flying летит по прямой к кристаллу и снимает HP при утечке', () => {
    const id = EnemyFactory.create(world, 'spore', PATH[0].gx, PATH[0].gy);
    const last = PATH[PATH.length - 1];

    // Прямолинейность: доля пути по x и y совпадает.
    for (let i = 0; i < 4; i++) {
      MoveSystem.update(world, 0.5);
      const pos = world.getComponent<{ gx: number; gy: number }>(id, 'GridPos')!;
      expect(Math.abs(pos.gx / last.gx - pos.gy / last.gy)).toBeLessThan(0.02);
    }
    // Путь игнорируется: индекс сегмента не двигался.
    expect(world.getComponent<{ index: number }>(id, 'PathIndex')!.index).toBe(0);

    // Долетаем до кристалла (скорость 2.0, дистанция ~13).
    for (let i = 0; i < 30; i++) MoveSystem.update(world, 0.5);
    const pos = world.getComponent<{ gx: number; gy: number }>(id, 'GridPos')!;
    expect(pos.gx).toBeCloseTo(last.gx, 1);
    expect(pos.gy).toBeCloseTo(last.gy, 1);

    const crystalBefore = GameStateManager.getCrystalHP();
    RulesSystem.update(world, 0.5);
    expect(GameStateManager.getCrystalHP()).toBe(crystalBefore - 1);
    expect(world.getComponent(id, 'Health')).toBeUndefined();
  });

  it('splitOnDeath: смерть puffling спавнит 2 spore с обычной наградой', () => {
    const startGold = ConfigLoader.getEconomy().startingGold;
    const id = EnemyFactory.create(world, 'puffling', 4, 4);
    world.getComponent<{ hp: number }>(id, 'Health')!.hp = 0;

    RulesSystem.update(world, 1.0);
    expect(GameStateManager.getGold()).toBe(startGold + 12);

    const spores = world
      .query('Health', 'Enemy', 'GridPos')
      .filter((s) => world.getComponent<{ hp: number }>(s, 'Health')!.hp > 0);
    expect(spores.length).toBe(2);
    for (const s of spores) {
      const e = world.getComponent<any>(s, 'Enemy');
      const p = world.getComponent<any>(s, 'GridPos');
      expect(e.type).toBe('spore');
      expect(e.splitInto).toBeUndefined();
      expect(p.gx).toBe(4);
      expect(p.gy).toBe(4);
    }

    HealthSystem.update(world, 1.0);
    expect(world.query('Health', 'Enemy').length).toBe(2);

    // Осколок умирает с обычной наградой и не делится.
    world.getComponent<{ hp: number }>(spores[0], 'Health')!.hp = 0;
    RulesSystem.update(world, 1.0);
    expect(GameStateManager.getGold()).toBe(startGold + 12 + 8);
    HealthSystem.update(world, 1.0);
    expect(world.query('Health', 'Enemy').length).toBe(1);
  });

  it('armorPhysical: arrow 0, cannon и ice полный урон', () => {
    // arrow
    {
      const w = new World();
      TowerFactory.create(w, 'arrow', 5, 5);
      const e = EnemyFactory.create(w, 'truffle', 4, 4);
      for (let i = 0; i < 5; i++) {
        w.updateTime(1.0);
        TowerAttackSystem.update(w, 1.0);
      }
      expect(w.getComponent<{ hp: number }>(e, 'Health')!.hp).toBe(190);
    }
    // cannon
    {
      const w = new World();
      TowerAttackSystem.reset();
      TowerFactory.create(w, 'cannon', 5, 5);
      const e = EnemyFactory.create(w, 'truffle', 4, 4);
      w.updateTime(3.0);
      TowerAttackSystem.update(w, 3.0);
      expect(w.getComponent<{ hp: number }>(e, 'Health')!.hp).toBe(150);
    }
    // ice
    {
      const w = new World();
      TowerAttackSystem.reset();
      TowerFactory.create(w, 'ice', 5, 5);
      const e = EnemyFactory.create(w, 'truffle', 4, 4);
      w.updateTime(1.5);
      TowerAttackSystem.update(w, 1.5);
      expect(w.getComponent<{ hp: number }>(e, 'Health')!.hp).toBe(180);
    }
  });

  it('враги без способностей бьются как раньше (один выстрел arrow = 15)', () => {
    const w = new World();
    TowerAttackSystem.reset();
    TowerFactory.create(w, 'arrow', 5, 5);
    const e = EnemyFactory.create(w, 'goblin', 4, 4);
    w.updateTime(1.0);
    TowerAttackSystem.update(w, 1.0);
    expect(w.getComponent<{ hp: number }>(e, 'Health')!.hp).toBe(35);
  });

  it('elite: hp ×6, награда ×8, спавн из волны и убивается', () => {
    // makeElite напрямую
    const w = new World();
    const e = EnemyFactory.create(w, 'goblin', 0, 0);
    EnemyFactory.makeElite(w, e);
    expect(w.getComponent<{ hp: number; maxHp: number }>(e, 'Health')).toEqual({
      hp: 300,
      maxHp: 300,
    });
    expect(w.getComponent<{ reward: number }>(e, 'Enemy')!.reward).toBe(80);
    expect(w.hasComponent(e, 'Elite')).toBe(true);

    // спавн элиты из волны
    const w2 = new World();
    GameStateManager.reset();
    WaveSpawnerSystem.reset();
    WaveSpawnerSystem.setWaves([
      { number: 1, spawns: [{ enemy: 'goblin', count: 1, delay: 0, elite: true }] },
    ]);
    WaveSpawnerSystem.startWave(w2);
    WaveSpawnerSystem.update(w2, 0.5);
    const elites = w2.query('Health', 'Enemy', 'Elite');
    expect(elites.length).toBe(1);
    expect(w2.getComponent<{ hp: number }>(elites[0], 'Health')!.hp).toBe(300);

    // элита убивается обычным уроном, награда ×8
    TowerAttackSystem.reset();
    TowerFactory.create(w2, 'cannon', 1, 1);
    const startGold = GameStateManager.getGold();
    for (let i = 0; i < 30; i++) {
      w2.updateTime(1.0);
      TowerAttackSystem.update(w2, 1.0);
      RulesSystem.update(w2, 1.0);
      HealthSystem.update(w2, 1.0);
      if (w2.query('Health', 'Enemy').length === 0) break;
    }
    expect(w2.query('Health', 'Enemy').length).toBe(0);
    expect(GameStateManager.getGold()).toBe(startGold + 80);
  });
});
