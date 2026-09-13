import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { ConfigLoader } from '../game/config/ConfigLoader';

const dir = resolve(process.cwd(), 'src/game/levels');
const files = () =>
  readdirSync(dir)
    .filter((f) => /^level_\d+\.json$/.test(f))
    .sort();
const read = (f: string): any => JSON.parse(readFileSync(resolve(dir, f), 'utf8'));

const KNOWN_ENEMIES = new Set(ConfigLoader.getEnemies().map((e) => e.id));

describe('level generation (files on disk)', () => {
  it('215 сгенерированных файлов level_002..level_216 + ручной 001', () => {
    const names = files();
    expect(names).toContain('level_001.json');
    for (let n = 2; n <= 216; n++) {
      expect(names).toContain(`level_${String(n).padStart(3, '0')}.json`);
    }
    expect(names.filter((f) => f !== 'level_001.json').length).toBe(215);
  });

  it('детерминизм: два запуска идентичны и совпадают с файлами в репо', () => {
    // Генерация идёт во временные папки: репозиторий не трогаем,
    // параллельные тесты продолжают читать стабильные файлы.
    const hashDir = (d: string): string => {
      const h = createHash('sha256');
      for (const f of readdirSync(d).sort()) h.update(readFileSync(resolve(d, f)));
      return h.digest('hex');
    };
    const run = (d: string): void => {
      execFileSync('node', ['tools/generateLevels.mjs'], {
        cwd: process.cwd(),
        env: { ...process.env, GEN_OUT: d },
      });
    };
    const a = mkdtempSync(join(tmpdir(), 'norn-gen-a-'));
    const b = mkdtempSync(join(tmpdir(), 'norn-gen-b-'));
    try {
      run(a);
      run(b);
      expect(hashDir(a)).toBe(hashDir(b));
      const repo = createHash('sha256');
      for (const f of files()) {
        if (f === 'level_001.json') continue; // ручной, генератором не покрывается
        repo.update(readFileSync(resolve(dir, f)));
      }
      expect(hashDir(a)).toBe(repo.digest('hex'));
    } finally {
      rmSync(a, { recursive: true, force: true });
      rmSync(b, { recursive: true, force: true });
    }
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

  it('buildPoints: в границах, не на пути, 3..8 (3..10 с flying-коридором)', () => {
    for (const f of files()) {
      if (f === 'level_001.json') continue;
      const L = read(f);
      const road = new Set(L.path.map((p: any) => `${p.x},${p.y}`));
      // Биомы 2,3,4,6 получают +2 точки коридора сверх базовых 3..8.
      const maxBp = [2, 3, 4, 6].includes(L.biomeId) ? 10 : 8;
      expect(L.buildPoints.length, f).toBeGreaterThanOrEqual(3);
      expect(L.buildPoints.length, f).toBeLessThanOrEqual(maxBp);
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
    expect(byNum.get(2).difficulty).toEqual({ hpMul: 1.06, rewardMul: 1.06, startingGold: 108 });
    expect(byNum.get(36).difficulty).toEqual({ hpMul: 3.1, rewardMul: 3.1, startingGold: 380 });
    expect(byNum.get(37).difficulty).toEqual({ hpMul: 1.6, rewardMul: 1.4, startingGold: 130 });
    expect(byNum.get(72).difficulty).toEqual({ hpMul: 4.96, rewardMul: 4.34, startingGold: 410 });
  });

  it('flying: в волнах 1-2 нет, в 3-5 не более 4 за волну; коридор в точках', () => {
    const FLY = new Set(['spore', 'candyfairy', 'balloon', 'fluffdragon', 'magician']);
    for (const f of files()) {
      if (f === 'level_001.json') continue;
      const L = read(f);
      L.waves.forEach((w: any, i: number) => {
        const flyCount = w.spawns
          .filter((s: any) => FLY.has(s.enemy))
          .reduce((s: number, x: any) => s + x.count, 0);
        if (i < 2) expect(flyCount, `${f} wave ${i + 1}`).toBe(0);
        else expect(flyCount, `${f} wave ${i + 1}`).toBeLessThanOrEqual(4);
      });
      // Коридор: средняя колонка y=4,8 — в точках, если не на пути.
      if ([2, 3, 4, 6].includes(L.biomeId)) {
        const road = new Set(L.path.map((p: any) => `${p.x},${p.y}`));
        const bp = new Set(L.buildPoints.map((p: any) => `${p.x},${p.y}`));
        const mx = Math.max(
          0,
          Math.min(7, Math.round((L.path[0].x + L.path[L.path.length - 1].x) / 2)),
        );
        for (const cy of [4, 8]) {
          if (!road.has(`${mx},${cy}`)) expect(bp.has(`${mx},${cy}`), `${f}`).toBe(true);
        }
      }
    }
  });

  it('боссы ровно на 36/72/108/144/180/216: флаг + элитный спавн тяжёлого', () => {
    const expected: Array<[number, string]> = [
      [36, 'troll'],
      [72, 'truffle'],
      [108, 'chocgolem'],
      [144, 'fluffdragon'],
      [180, 'pearlwhale'],
      [216, 'elephant'],
    ];
    for (const [n, heavy] of expected) {
      const L = read(`level_${String(n).padStart(3, '0')}.json`);
      expect(L.boss, `level ${n}`).toEqual({ type: 'elite' });
      const last = L.waves[4].spawns;
      expect(last[last.length - 1], `level ${n}`).toMatchObject({
        enemy: heavy,
        count: 1,
        elite: true,
      });
    }
    // больше нигде боссов нет
    for (const f of files()) {
      const L = read(f);
      const isBoss = [36, 72, 108, 144, 180, 216].includes(L.levelNumber);
      expect(!!L.boss, f).toBe(isBoss);
    }
  });
});
