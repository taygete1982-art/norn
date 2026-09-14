import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { World } from '../ecs/world';
import { GameStateManager } from '../game/GameState';
import { TowerAttackSystem } from '../game/systems/TowerAttackSystem';
import { MoveSystem, setPath, resetPath } from '../game/systems/MoveSystem';
import { EnvironmentSystem } from '../game/systems/EnvironmentSystem';
import { TowerFactory } from '../game/entities/TowerFactory';
import { EnemyFactory } from '../game/entities/EnemyFactory';

const NEUTRAL = {
  biomeId: 1,
  choco: new Set<string>(),
  bubbles: new Set<string>(),
  wind: null,
  buildPoints: [] as Array<{ gx: number; gy: number }>,
};

describe('Environment mechanics', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    GameStateManager.reset();
    TowerAttackSystem.reset();
    resetPath();
    EnvironmentSystem.configure({ ...NEUTRAL });
  });

  it('choco ускоряет врага ×1.3', () => {
    setPath([
      { gx: 4, gy: 4 },
      { gx: 7, gy: 4 },
    ]);
    EnvironmentSystem.configure({ ...NEUTRAL, biomeId: 3, choco: new Set(['4,4']) });
    const id = EnemyFactory.create(world, 'goblin', 4, 4);
    MoveSystem.update(world, 1.0);
    const pos = world.getComponent<{ gx: number }>(id, 'GridPos')!;
    expect(pos.gx).toBeCloseTo(4 + 1.5 * 1.3, 5);

    // Без choco — обычная скорость.
    const w2 = new World();
    resetPath();
    setPath([
      { gx: 4, gy: 4 },
      { gx: 7, gy: 4 },
    ]);
    EnvironmentSystem.configure({ ...NEUTRAL });
    const id2 = EnemyFactory.create(w2, 'goblin', 4, 4);
    MoveSystem.update(w2, 1.0);
    expect(w2.getComponent<{ gx: number }>(id2, 'GridPos')!.gx).toBeCloseTo(5.5, 5);
  });

  it('choco: magic ×1.2, physical без бонуса', () => {
    EnvironmentSystem.configure({ ...NEUTRAL, biomeId: 3, choco: new Set(['4,4']) });
    TowerFactory.create(world, 'ice', 5, 5);
    const e = EnemyFactory.create(world, 'goblin', 4, 4);
    world.updateTime(1.5);
    TowerAttackSystem.update(world, 1.5);
    expect(world.getComponent<{ hp: number }>(e, 'Health')!.hp).toBe(50 - 12);

    const w2 = new World();
    TowerAttackSystem.reset();
    TowerFactory.create(w2, 'arrow', 5, 5);
    const e2 = EnemyFactory.create(w2, 'goblin', 4, 4);
    w2.updateTime(1.0);
    TowerAttackSystem.update(w2, 1.0);
    expect(w2.getComponent<{ hp: number }>(e2, 'Health')!.hp).toBe(35);
  });

  it('wind работает в обе стороны', () => {
    setPath([
      { gx: 0, gy: 0 },
      { gx: 8, gy: 0 },
    ]);
    EnvironmentSystem.configure({ ...NEUTRAL, biomeId: 4, wind: { dx: 1, dy: 0 } });
    const a = EnemyFactory.create(world, 'goblin', 0, 0);
    MoveSystem.update(world, 1.0);
    expect(world.getComponent<{ gx: number }>(a, 'GridPos')!.gx).toBeCloseTo(1.5 * 1.08, 5);

    const w2 = new World();
    EnvironmentSystem.configure({ ...NEUTRAL, biomeId: 4, wind: { dx: -1, dy: 0 } });
    const b = EnemyFactory.create(w2, 'goblin', 0, 0);
    MoveSystem.update(w2, 1.0);
    expect(w2.getComponent<{ gx: number }>(b, 'GridPos')!.gx).toBeCloseTo(1.5 * 0.92, 5);
  });

  it('bubble: кулдаун башни ×1.25 в зоне', () => {
    EnvironmentSystem.configure({ ...NEUTRAL, biomeId: 5, bubbles: new Set(['5,5']) });
    TowerFactory.create(world, 'arrow', 5, 5);
    const e = EnemyFactory.create(world, 'goblin', 4, 4);
    const hp = () => world.getComponent<{ hp: number }>(e, 'Health')!.hp;
    world.updateTime(1.5);
    TowerAttackSystem.update(world, 1.5);
    expect(hp()).toBe(35); // 1.5 ≥ 1.25: выстрел
    world.updateTime(0.5);
    TowerAttackSystem.update(world, 0.5);
    expect(hp()).toBe(35); // 0.5 < 1.25: тихо
    world.updateTime(1.0);
    TowerAttackSystem.update(world, 1.0);
    expect(hp()).toBe(20); // 1.5 ≥ 1.25: выстрел
  });

  it('carnival: танец блокирует, затем бафф скорострельности', () => {
    EnvironmentSystem.configure({
      ...NEUTRAL,
      biomeId: 6,
      buildPoints: [{ gx: 5, gy: 5 }],
    });
    TowerFactory.create(world, 'arrow', 5, 5);
    const e = EnemyFactory.create(world, 'goblin', 4, 4);
    const hp = () => world.getComponent<{ hp: number }>(e, 'Health')!.hp;

    world.updateTime(40);
    EnvironmentSystem.update(world); // танец до 43
    TowerAttackSystem.update(world, 1.0);
    expect(hp()).toBe(50);
    expect(EnvironmentSystem.takeToast()).toBe('Карнавал начинается...');

    world.updateTime(3.5);
    EnvironmentSystem.update(world); // бафф до 48
    TowerAttackSystem.update(world, 1.0); // кулдаун 1/1.5
    expect(hp()).toBe(35);
  });

  it('spore_clouds: глушат зону 5 c, затем стрельба', () => {
    EnvironmentSystem.configure({
      ...NEUTRAL,
      biomeId: 2,
      buildPoints: [{ gx: 5, gy: 5 }],
    });
    TowerFactory.create(world, 'arrow', 5, 5);
    const e = EnemyFactory.create(world, 'goblin', 4, 4);
    const hp = () => world.getComponent<{ hp: number }>(e, 'Health')!.hp;

    world.updateTime(30);
    EnvironmentSystem.update(world);
    expect(EnvironmentSystem.getCloud(world)).not.toBeNull();
    TowerAttackSystem.update(world, 1.0);
    expect(hp()).toBe(50);
    expect(EnvironmentSystem.takeToast()).toBe('Споры пробуждаются...');

    world.updateTime(6);
    EnvironmentSystem.update(world);
    expect(EnvironmentSystem.getCloud(world)).toBeNull();
    TowerAttackSystem.update(world, 1.0);
    expect(hp()).toBe(35);
  });

  it('terrain в файлах: choco на пути, wind по осям, bubble у пути', () => {
    const dir = resolve(process.cwd(), 'src/game/levels');
    const read = (n: number): any =>
      JSON.parse(readFileSync(resolve(dir, `level_${String(n).padStart(3, '0')}.json`), 'utf8'));

    const l73 = read(73);
    expect(l73.biomeId).toBe(3);
    expect(l73.terrain.length).toBeGreaterThanOrEqual(4);
    expect(l73.terrain.length).toBeLessThanOrEqual(8);
    const road73 = new Set(l73.path.map((p: any) => `${p.x},${p.y}`));
    for (const t of l73.terrain) {
      expect(t.kind).toBe('choco');
      expect(road73.has(`${t.x},${t.y}`), `choco ${t.x},${t.y}`).toBe(true);
    }

    const l109 = read(109);
    expect(l109.biomeId).toBe(4);
    expect(l109.terrain).toEqual([]);
    expect(Math.abs(l109.wind.dx) + Math.abs(l109.wind.dy)).toBe(1);

    const l145 = read(145);
    expect(l145.biomeId).toBe(5);
    expect(l145.wind).toBeNull();
    const road145 = new Set(l145.path.map((p: any) => `${p.x},${p.y}`));
    expect(l145.terrain.length).toBeGreaterThan(0);
    for (const t of l145.terrain) {
      expect(t.kind).toBe('bubble');
      let near = false;
      for (const key of road145) {
        const [px, py] = (key as string).split(',').map(Number);
        if (Math.hypot(t.x - px, t.y - py) <= 2.5) {
          near = true;
          break;
        }
      }
      expect(near, `bubble ${t.x},${t.y}`).toBe(true);
    }

    for (const n of [2, 36, 216]) {
      const L = read(n);
      if (L.biomeId <= 2 || L.biomeId === 6) {
        expect(L.terrain, `level ${n}`).toEqual([]);
        expect(L.wind, `level ${n}`).toBeNull();
      }
    }
  });
});
