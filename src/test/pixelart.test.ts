import { describe, it, expect } from 'vitest';
import { getRoadKeys, darkMode, setDarkMode, DARK_PALETTE } from '../art/PixelArt';
import { PATH } from '../game/systems/MoveSystem';

describe('darkMode flag (pure, no DOM)', () => {
  it('defaults to true with basalt ground palette', () => {
    expect(darkMode).toBe(true);
    expect(DARK_PALETTE.ground).toBe('#17181d');
    expect(DARK_PALETTE.road_seam).toBe('#35e0ff');
  });

  it('toggles and restores without DOM', () => {
    setDarkMode(false);
    expect(darkMode).toBe(false);
    setDarkMode(true);
    expect(darkMode).toBe(true);
  });
});

describe('getRoadKeys (pure, no DOM)', () => {
  it('covers straight segment cells', () => {
    const keys = getRoadKeys([
      { gx: 0, gy: 0 },
      { gx: 2, gy: 0 },
    ]);
    expect(keys.has('0,0')).toBe(true);
    expect(keys.has('1,0')).toBe(true);
    expect(keys.has('2,0')).toBe(true);
  });

  it('covers game PATH endpoints and stays on grid', () => {
    const keys = getRoadKeys(PATH);
    expect(keys.has('0,0')).toBe(true);
    expect(keys.has('7,11')).toBe(true);
    for (const k of keys) {
      const [gx, gy] = k.split(',').map(Number);
      expect(gx).toBeGreaterThanOrEqual(0);
      expect(gx).toBeLessThanOrEqual(7);
      expect(gy).toBeGreaterThanOrEqual(0);
      expect(gy).toBeLessThanOrEqual(11);
    }
  });
});
