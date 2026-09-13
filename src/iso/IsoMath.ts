import { Graphics, Sprite } from 'pixi.js';

// Изометрическая математика для PixiJS v8
// Формула: sx = (gx - gy) * 32; sy = (gx + gy) * 16

export interface IsoPoint {
  x: number;
  y: number;
}

export class IsoMath {
  private readonly cellSize: { x: number; y: number };

  constructor(cellSize: { x: number; y: number } = { x: 32, y: 16 }) {
    this.cellSize = cellSize;
  }

  /**
   * Преобразование координат сетки в экранные
   * grid: (gx, gy) -> screen: (sx, sy)
   */
  gridToScreen(gx: number, gy: number): IsoPoint {
    const sx = (gx - gy) * this.cellSize.x;
    const sy = (gx + gy) * this.cellSize.y;
    return { x: sx, y: sy };
  }

  /**
   * Обратное преобразование: экран -> сетка
   * screen: (sx, sy) -> grid: (gx, gy)
   */
  screenToGrid(sx: number, sy: number): { gx: number; gy: number } {
    // Решаем систему уравнений:
    // gx = (sx/x + sy/y) / 2
    // gy = (sy/y - sx/x) / 2
    
    const gx0 = Math.round((sx / this.cellSize.x + sy / this.cellSize.y) / 2);
    const gy0 = Math.round((sy / this.cellSize.y - sx / this.cellSize.x) / 2);
    let gx = gx0;
    let gy = gy0;
    
    // roundPixels: корректируем на ближайший пиксель
    if (Math.abs(sx % this.cellSize.x) > this.cellSize.x / 2) {
      gx += Math.sign(sx % this.cellSize.x);
    }
    if (Math.abs(sy % this.cellSize.y) > this.cellSize.y / 2) {
      gy += Math.sign(sy % this.cellSize.y);
    }
    
    return { gx, gy };
  }

  /**
   * Вычисление глубины (depth) для сортирования
   * Чем больше depth, тем выше объект
   */
  depthOf(gx: number, gy: number): number {
    return gx + gy;
  }

  /**
   * Получение глубины точки
   */
  depthAt(x: number, y: number): number {
    const { gx, gy } = this.screenToGrid(x, y);
    return this.depthOf(gx, gy);
  }

  isInside(gx: number, gy: number, x: number, y: number): boolean {
    // Cell boundaries:
    // x_min = gx * 32
    // y_min = gy * 16
    // x_max = gx * 32 + 32
    // y_max = gy * 16 + 16
    
    const xMin = gx * 32;
    const yMin = gy * 16;
    const xMax = xMin + 32;
    const yMax = yMin + 16;
    
    return x >= xMin && x <= xMax && y >= yMin && y <= yMax;
  }
}

// Экспорт
export default IsoMath;
