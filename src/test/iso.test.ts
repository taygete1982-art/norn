import { IsoMath } from '../iso/IsoMath';
import { describe, it, expect } from 'vitest';

describe('IsoMath', () => {
  const iso = new IsoMath({ x: 32, y: 16 });

  it('gridToScreen: converts grid coordinates to screen', () => {
    const { x: sx, y: sy } = iso.gridToScreen(2, 3);
    const expectedX = (2 - 3) * 32; // -32
    const expectedY = (2 + 3) * 16; // 80
    expect(sx).toBe(expectedX);
    expect(sy).toBe(expectedY);
  });

  it('screenToGrid: converts screen coordinates back to grid', () => {
    const result = iso.screenToGrid(-32, 80);
    expect(result.gx).toBe(2);
    expect(result.gy).toBe(3);
  });

  it('screenToGrid: roundPixels with negative values', () => {
    const result = iso.screenToGrid(-32.5, 80.5);
    expect(result.gx).toBe(2);
    expect(result.gy).toBe(3);
  });

  it('depthOf: calculates depth correctly', () => {
    expect(iso.depthOf(2, 3)).toBe(5);
    expect(iso.depthOf(0, 0)).toBe(0);
    expect(iso.depthOf(5, 5)).toBe(10);
  });

  it('depthAt: calculates depth at screen coordinates', () => {
    const { x: gx, y: gy } = iso.gridToScreen(2, 3);
    expect(iso.depthAt(gx, gy)).toBe(5);
  });

  it('isInside: checks if point is inside cell', () => {
    // isInside(gx: number, gy: number, x: number, y: number)
    // Клетка (2, 2): x_min=64, y_min=32, x_max=96, y_max=48
    // Точка (64, 32) — левый верхний угол клетки (внутри)
    expect(iso.isInside(2, 2, 64, 32)).toBe(true);
    // Точка (96, 32) — правый нижний угол клетки (внутри)
    expect(iso.isInside(2, 2, 96, 32)).toBe(true);
    // Точка (48, 32) — за пределами клетки слева
    expect(iso.isInside(2, 2, 48, 32)).toBe(false);
  });
});
