import { describe, it, expect, vi } from 'vitest';
import { ConfigLoader } from '../game/config/ConfigLoader';
import { EnemyFactory } from '../game/entities/EnemyFactory';
import { getTile } from '../art/PixelArt';
import { World } from '../ecs/world';

// getTile рисует в offscreen-canvas: в node-окружении фейк document.
function makeCtx(): unknown {
  return new Proxy(
    {},
    {
      get: (_t, p) => (p === 'canvas' ? {} : (..._a: unknown[]) => undefined),
      set: () => true,
    },
  );
}
vi.stubGlobal('document', {
  createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx() }),
});

const NEW_ROSTER: Array<{ id: string; abilities: string[]; splitInto?: string }> = [
  { id: 'jelly', abilities: ['splitOnDeath'], splitInto: 'jellymini' },
  { id: 'jellymini', abilities: [] },
  { id: 'caramel', abilities: [] },
  { id: 'chocgolem', abilities: ['armorPhysical'] },
  { id: 'candyfairy', abilities: ['flying'] },
  { id: 'balloon', abilities: ['flying'] },
  { id: 'cloudsheep', abilities: [] },
  { id: 'stormling', abilities: ['splitOnDeath'], splitInto: 'balloon' },
  { id: 'fluffdragon', abilities: ['flying'] },
  { id: 'clownfish', abilities: [] },
  { id: 'jellyfish', abilities: ['splitOnDeath'], splitInto: 'clownfish' },
  { id: 'seahorse', abilities: ['armorPhysical'] },
  { id: 'pearlwhale', abilities: [] },
  { id: 'clown', abilities: [] },
  { id: 'juggler', abilities: ['splitOnDeath'], splitInto: 'clown' },
  { id: 'magician', abilities: ['flying'] },
  { id: 'elephant', abilities: ['armorPhysical'] },
];

describe('biome 3-6 rosters (data + sprites)', () => {
  it('все 17 id грузятся с полными статами и способностями', () => {
    const all = ConfigLoader.getEnemies();
    expect(all.length).toBe(6 + 17 + 6); // база 6 + ростеры 17 + боссы 6
    for (const e of NEW_ROSTER) {
      const cfg = all.find((c) => c.id === e.id);
      expect(cfg, e.id).toBeDefined();
      expect(typeof cfg!.hp, e.id).toBe('number');
      expect(typeof cfg!.speed, e.id).toBe('number');
      expect(typeof cfg!.reward, e.id).toBe('number');
      expect(typeof cfg!.damage, e.id).toBe('number');
      expect(cfg!.abilities, e.id).toEqual(e.abilities);
    }
  });

  it('фабрика спавнит каждого с его способностями', () => {
    const world = new World();
    for (const e of NEW_ROSTER) {
      const id = EnemyFactory.create(world, e.id as any, 1, 1);
      const comp = world.getComponent<any>(id, 'Enemy');
      expect(comp.type).toBe(e.id);
      expect(comp.abilities).toEqual(e.abilities);
    }
  });

  it('splitInto ссылается на существующий id', () => {
    const ids = new Set(ConfigLoader.getEnemies().map((c) => c.id));
    for (const c of ConfigLoader.getEnemies()) {
      if (c.splitInto) {
        expect(ids.has(c.splitInto.type), `${c.id} -> ${c.splitInto.type}`).toBe(true);
        expect(c.splitInto.count).toBeGreaterThan(0);
      }
    }
    const splitters = ConfigLoader.getEnemies().filter((c) => c.splitInto);
    expect(splitters.length).toBe(5); // puffling, jelly, stormling, jellyfish, juggler
  });

  it('getTile возвращает текстуру для всех 34 новых TileId (кэш стабилен)', () => {
    const bases = NEW_ROSTER.map((e) => e.id);
    expect(bases.length).toBe(17);
    let count = 0;
    for (const b of bases) {
      for (const f of ['f0', 'f1']) {
        const id = `enemy_${b}_${f}` as any;
        const t1 = getTile(id);
        const t2 = getTile(id);
        expect(t1, id).toBeDefined();
        expect(t2, `${id} cached`).toBe(t1);
        count++;
      }
    }
    expect(count).toBe(34);
  });
});
