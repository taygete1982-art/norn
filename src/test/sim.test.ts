import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

const sim = (args: string[]): any =>
  JSON.parse(
    execFileSync('node', ['tools/simulateBalance.mjs', ...args], {
      cwd: process.cwd(),
      encoding: 'utf8',
    }),
  );

describe('balance simulator sanity', () => {
  it('эталон побеждает level_001', () => {
    const r = sim(['--level', '1', '--policy', 'reference']);
    expect(r.win).toBe(true);
    expect(r.stars).toBeGreaterThan(0);
  });

  it('без башен level_001: все 5 утекают (кристалл 15), по правилам игры это победа', () => {
    // 5 imp × 1 урона = 5 < 20 HP кристалла: поражения нет, фиксируем утечки.
    const r = sim(['--level', '1', '--policy', 'none']);
    expect(r.crystalLeft).toBe(15);
    expect(r.win).toBe(true);
  });

  it('симуляция детерминирована', () => {
    const a = sim(['--level', '36', '--policy', 'reference']);
    const b = sim(['--level', '36', '--policy', 'reference']);
    expect(a).toEqual(b);
  });
});
