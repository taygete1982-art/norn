import { describe, it, expect } from 'vitest';
import { LevelLoader } from '../game/levels/LevelLoader';

describe('LevelLoader + level_001', () => {
  it('loadLevel(1) возвращает валидный объект', async () => {
    const level = await LevelLoader.loadLevel(1);
    expect(level.levelNumber).toBe(1);
    expect(level.biomeId).toBe(1);
    expect(level.gridSize).toEqual({ width: 8, height: 12 });
    expect(level.path.length).toBeGreaterThan(1);
    expect(level.buildPoints.length).toBe(3);
    expect(level.waves.length).toBe(1);
    expect(level.environmentEffects).toEqual([]);
    expect(level.boss).toBeNull();
  });

  it('path без дубликатов, соседние точки соединены (8-связность)', async () => {
    const level = await LevelLoader.loadLevel(1);
    const keys = level.path.map((p) => `${p.x},${p.y}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (let i = 0; i < level.path.length - 1; i++) {
      const a = level.path[i];
      const b = level.path[i + 1];
      const d = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      expect(d).toBe(1);
    }
  });

  it('buildPoints не пересекаются с path и внутри сетки', async () => {
    const level = await LevelLoader.loadLevel(1);
    const road = new Set(level.path.map((p) => `${p.x},${p.y}`));
    for (const b of level.buildPoints) {
      expect(road.has(`${b.x},${b.y}`)).toBe(false);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThan(level.gridSize.width);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeLessThan(level.gridSize.height);
    }
  });

  it('biome names известны', () => {
    expect(LevelLoader.getBiomeName(1)).toBe('Цветочные Поляны');
    expect(LevelLoader.getBiomeName(6)).toBe('Карнавал Чудес');
  });

  it('metadata содержит уровень 1', async () => {
    const all = await LevelLoader.loadAllMetadata();
    const one = all.find((m) => m.levelNumber === 1);
    expect(one).toBeDefined();
    expect(one?.biomeId).toBe(1);
    expect(one?.biomeName).toBe('Цветочные Поляны');
  });

  it('loadLevel(999) выбрасывает ошибку', async () => {
    await expect(LevelLoader.loadLevel(999)).rejects.toThrow('Level not found: 999');
  });
});
