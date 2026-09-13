import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world';
import { GameStateManager } from '../game/GameState';
import { TowerAttackSystem } from '../game/systems/TowerAttackSystem';
import { TowerFactory } from '../game/entities/TowerFactory';
import { EnemyFactory } from '../game/entities/EnemyFactory';
import {
  tierConfigOf,
  effectiveStats,
  upgradeCostOf,
  sellValue,
  applyUpgrade,
  sellTower,
} from '../game/Upgrades';

describe('Tower upgrades', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    GameStateManager.reset();
    TowerAttackSystem.reset();
  });

  it('tier2: урон ×1.6 за выстрел', () => {
    TowerFactory.create(world, 'arrow', 5, 5);
    const t = world.getComponent<any>(world.query('Tower')[0], 'Tower');
    t.tier = 2;
    const e = EnemyFactory.create(world, 'goblin', 4, 4);
    world.updateTime(1.0);
    TowerAttackSystem.update(world, 1.0);
    expect(world.getComponent<{ hp: number }>(e, 'Health')!.hp).toBe(50 - 24);
  });

  it('tier2: кулдаун короче (второй выстрел раньше)', () => {
    TowerFactory.create(world, 'arrow', 5, 5);
    const t = world.getComponent<any>(world.query('Tower')[0], 'Tower');
    t.tier = 2; // кулдаун 1/1.15 ≈ 0.87
    const e = EnemyFactory.create(world, 'goblin', 4, 4);
    world.updateTime(1.0);
    TowerAttackSystem.update(world, 1.0); // выстрел 1: 50-24=26
    world.updateTime(0.5);
    TowerAttackSystem.update(world, 0.5); // +0.5 < 0.87: тихо
    expect(world.getComponent<{ hp: number }>(e, 'Health')!.hp).toBe(26);
    world.updateTime(0.5);
    TowerAttackSystem.update(world, 0.5); // +1.0 ≥ 0.87: выстрел 2
    expect(world.getComponent<{ hp: number }>(e, 'Health')!.hp).toBe(2);
  });

  it('tier2: радиус ×1.1 (цель на 3.16 в радиусе, на t1 нет)', () => {
    TowerFactory.create(world, 'arrow', 1, 1);
    const tid = world.query('Tower')[0];
    const e = EnemyFactory.create(world, 'goblin', 4, 2); // dist √10 ≈ 3.16
    world.updateTime(1.0);
    TowerAttackSystem.update(world, 1.0);
    expect(world.getComponent<{ hp: number }>(e, 'Health')!.hp).toBe(50);
    world.getComponent<any>(tid, 'Tower').tier = 2; // радиус 3.3
    world.updateTime(1.0);
    TowerAttackSystem.update(world, 1.0);
    expect(world.getComponent<{ hp: number }>(e, 'Health')!.hp).toBe(26);
  });

  it('cannon aoeMul растёт по tier’ам', () => {
    expect(tierConfigOf('cannon', 1).aoeMul).toBeUndefined();
    expect(tierConfigOf('cannon', 2).aoeMul).toBe(1.15);
    expect(tierConfigOf('cannon', 3).aoeMul).toBe(1.3);
    const eff = effectiveStats({ damage: 40, fireRate: 2.5, range: 2.5, aoeRadius: 1.5 }, tierConfigOf('cannon', 3));
    expect(eff.aoeRadius).toBeCloseTo(1.95, 5);
  });

  it('upgradeCostOf: цены и null на максимуме', () => {
    expect(upgradeCostOf('arrow', 1)).toBe(50);
    expect(upgradeCostOf('arrow', 2)).toBe(75);
    expect(upgradeCostOf('arrow', 3)).toBeNull();
    expect(upgradeCostOf('cannon', 1)).toBe(150);
    expect(upgradeCostOf('ice', 2)).toBe(150);
  });

  it('applyUpgrade: золото, tier, кап на 3', () => {
    const id = TowerFactory.create(world, 'arrow', 1, 1); // gold 100
    expect(applyUpgrade(world, id)).toBe(true); // -50
    expect(GameStateManager.getGold()).toBe(50);
    const t = world.getComponent<any>(id, 'Tower');
    expect(t.tier).toBe(2);
    expect(t.spent).toBe(75);
    expect(applyUpgrade(world, id)).toBe(false); // 50 < 75
    expect(t.tier).toBe(2);
    GameStateManager.addGold(100);
    expect(applyUpgrade(world, id)).toBe(true); // -75
    expect(t.tier).toBe(3);
    expect(t.spent).toBe(150);
    expect(applyUpgrade(world, id)).toBe(false); // кап
    expect(t.tier).toBe(3);
  });

  it('sellTower: 70% вложенного вниз, сущность удалена', () => {
    const id = TowerFactory.create(world, 'arrow', 1, 1);
    applyUpgrade(world, id); // потрачено 25+50=75, gold 50
    const paid = sellTower(world, id);
    expect(paid).toBe(52); // floor(75*0.7)
    expect(GameStateManager.getGold()).toBe(50 + 52);
    expect(world.query('Tower').length).toBe(0);
    expect(sellTower(world, id)).toBe(0); // повторная продажа
  });

  it('sellValue: округление вниз', () => {
    expect(sellValue(25)).toBe(17);
    expect(sellValue(150)).toBe(105);
    expect(sellValue(0)).toBe(0);
  });
});
