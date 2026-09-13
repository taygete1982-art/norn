import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigLoader } from '../game/config/ConfigLoader';

const dir = resolve(process.cwd(), 'src/game/levels');
const files = () =>
  readdirSync(dir)
    .filter((f) => /^level_\d+\.json$/.test(f))
    .sort();
const read = (f: string): any => JSON.parse(readFileSync(resolve(dir, f), 'utf8'));
const hashAll = (): string => {
  const h = createHash('sha256');
  for (const f of files()) h.update(readFileSync(resolve(dir, f)));
  return h.digest('hex');
};

const KNOWN_ENEMIES = new Set(ConfigLoader.getEnemies().map((e) => e.id));

describe('level generation (files on disk)', () => {
  it('71 сгенерированный файл level_002..level_072 + ручной 001', () => {
    const names = files();
    expect(names).toContain('level_001.json');
    for (let n = 2; n <= 72; n++) {
      expect(names).toContain(`level_${String(n).padStart(3, '0')}.json`);
    }
  });

  it('детерминизм: повторный запуск не меняет файлы', () => {
    const before = hashAll();
    execFileSync('node', ['tools/generateLevels.mjs'], { cwd: process.cwd() });
    expect(hashAll()).toBe(before);
  });

  it('path: в границах, связный, без дубликатов, старт y=0, финиш y=11', () => {
    for (const f of files()) {
      if (f === 'level_001.json') continue;
      const L = read(f);
      expect(L.gridSize).toEqual({ width: 8, height: 12 });
      const keys = L.path.map((p: any) => `${p.x},${p.y}`);
      expect(new Set(keys).size, f).toBe(keys.length);
      expect(L.path[0].y, f).toBe(0);
      const end = L.path[L.path.length - 1];
      expect(end.y, f).toBe(11);
      for (let i = 0; i < L.path.length; i++) {
        const p = L.path[i];
        expect(p.x >= 0 && p.x < 8 && p.y >= 0 && p.y < 12, `${f}[${i}]`).toBe(true);
        if (i > 0) {
          const a = L.path[i - 1];
          expect(Math.max(Math.abs(p.x - a.x), Math.abs(p.y - a.y)), `${f}[${i}]`).toBe(1);
        }
      }
      expect(L.path.length, f).toBeGreaterThanOrEqual(14);
      expect(L.path.length, f).toBeLessThanOrEqual(26);
    }
  });

  it('buildPoints: в границах, не на пути, 3..8 штук', () => {
    for (const f of files()) {
      if (f === 'level_001.json') continue;
      const L = read(f);
      const road = new Set(L.path.map((p: any) => `${p.x},${p.y}`));
      expect(L.buildPoints.length, f).toBeGreaterThanOrEqual(3);
      expect(L.buildPoints.length, f).toBeLessThanOrEqual(8);
      for (const b of L.buildPoints) {
        expect(road.has(`${b.x},${b.y}`), `${f} bp`).toBe(false);
        expect(b.x >= 0 && b.x < 8 && b.y >= 0 && b.y < 12, `${f} bp`).toBe(true);
      }
    }
  });

  it('waves: по 5 волн, только существующие id врагов', () => {
    for (const f of files()) {
      if (f === 'level_001.json') continue;
      const L = read(f);
      expect(L.waves.length, f).toBe(5);
      for (const w of L.waves) {
        for (const s of w.spawns) {
          expect(KNOWN_ENEMIES.has(s.enemy), `${f} ${s.enemy}`).toBe(true);
          expect(s.count, f).toBeGreaterThan(0);
        }
      }
    }
  });

  it('hpMul монотонно растёт внутри биома; формулы на границах', () => {
    const levels = files()
      .filter((f) => f !== 'level_001.json')
      .map((f) => read(f))
      .sort((a, b) => a.levelNumber - b.levelNumber);
    for (const biome of [1, 2]) {
      let prev = -Infinity;
      for (const L of levels.filter((l) => l.biomeId === biome)) {
        expect(L.difficulty.hpMul, `level ${L.levelNumber}`).toBeGreaterThanOrEqual(prev);
        prev = L.difficulty.hpMul;
      }
    }
    const byNum = new Map(levels.map((l) => [l.levelNumber, l]));
    expect(byNum.get(2).difficulty).toEqual({ hpMul: 1.1, rewardMul: 1.05, startingGold: 105 });
    expect(byNum.get(36).difficulty).toEqual({ hpMul: 4.5, rewardMul: 2.75, startingGold: 275 });
    expect(byNum.get(37).difficulty).toEqual({ hpMul: 2, rewardMul: 1.5, startingGold: 100 });
    expect(byNum.get(72).difficulty).toEqual({ hpMul: 9, rewardMul: 4.13, startingGold: 275 });
  });

  it('боссы 36 и 72: флаг + элитный спавн тяжёлого врага в последней волне', () => {
    const l36 = read('level_036.json');
    const l72 = read('level_072.json');
    expect(l36.boss).toEqual({ type: 'elite' });
    expect(l72.boss).toEqual({ type: 'elite' });
    const last36 = l36.waves[4].spawns;
    const last72 = l72.waves[4].spawns;
    expect(last36[last36.length - 1]).toMatchObject({ enemy: 'troll', count: 1, elite: true });
    expect(last72[last72.length - 1]).toMatchObject({ enemy: 'truffle', count: 1, elite: true });
  });
});
