import { Graphics, Container } from 'pixi.js';

/**
 * Ровно-угольный ромб (квадрат в изометрии)
 */

export class IsoGrid {
  private grid: Graphics;
  private iso: IsoMath;
  private width: number;
  private height: number;
  private cellSize: { x: number; y: number };

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cellSize = { x: 32, y: 16 };
    this.iso = new IsoMath(this.cellSize);

    this.grid = new Graphics();
    // Демо-сетка 8×12 (вытянутая вертикально)
    this.initGrid(8, 12);
  }

  initGrid(gxSize: number, gySize: number) {
    // Рисуем ромбовидную сетку 8×12
    for (let gy = 0; gy <= gySize; gy++) {
      for (let gx = 0; gx <= gxSize; gx++) {
        const point = this.iso.gridToScreen(gx, gy);
        const depth = this.iso.depthOf(gx, gy);

        if (gx === 0 || gx === gxSize || gy === 0 || gy === gySize) {
          // Рамка
          this.grid.lineStyle(1, 0x808080, 0.5);
          this.grid.moveTo(point.x, point.y);
        } else {
          // Внутренние линии — более тёмные
          this.grid.lineStyle(0.5, 0x505050, 0.5);
          this.grid.moveTo(point.x, point.y);
        }

        // Соединяем с соседями
        const neighbors = [
          { gx: gx + 1, gy: gy },
          { gx: gx - 1, gy: gy },
          { gx: gx, gy: gy + 1 },
          { gx: gx, gy: gy - 1 }
        ].filter(n => n.gx >= 0 && n.gx <= gxSize && n.gy >= 0 && n.gy <= gySize);

        for (const neighbor of neighbors) {
          const neighborPoint = this.iso.gridToScreen(neighbor.gx, neighbor.gy);
          const neighborDepth = this.iso.depthOf(neighbor.gx, neighbor.gy);

          // Линии идут от более глубоких к более высоким
          if (neighborDepth > depth) {
            this.grid.lineTo(neighborPoint.x, neighborPoint.y);
          }
        }
      }
    }

    this.grid.lineStyle(1, 0x000000, 1);
    this.grid.stroke();
  }

  /**
   * Подсветка ромба по клику
   */
  hitTest(x: number, y: number): { gx: number; gy: number } | null {
    // Для ромба проверяем углы (глубина 0..9)
    const depth = this.iso.depthAt(x, y);

    for (let d = 0; d <= 9; d++) {
      const gx = (depth + d) / 2;
      const gy = (depth - d) / 2;

      if (gx >= 0 && gx <= 10 && gy >= 0 && gy <= 10) {
        // Проверка углов
        const cornerOffsets = [
          { dx: 1, dy: -1 },
          { dx: -1, dy: -1 },
          { dx: -1, dy: 1 },
          { dx: 1, dy: 1 }
        ];

        for (const { dx, dy } of cornerOffsets) {
          const corner = this.iso.gridToScreen(gx + dx, gy + dy);
          const dist = Math.hypot(corner.x - x, corner.y - y);

          if (dist < 8) { // Радиус клика
            return { gx, gy };
          }
        }
      }
    }

    return null;
  }

  /**
   * Подсветка по клику
   */
  highlight(gx: number, gy: number) {
    const point = this.iso.gridToScreen(gx, gy);
    const depth = this.iso.depthOf(gx, gy);

    // Рисуем подсветку
    this.grid.clear();
    this.grid.beginFill(0xFFFFFF, 0.8);
    this.grid.lineStyle(2, 0xFFFFFF);

    // Верхний треугольник (ближний)
    const topPoint = this.iso.gridToScreen(gx, gy - 1);
    this.grid.moveTo(point.x, point.y);
    this.grid.lineTo(topPoint.x, topPoint.y);
    this.grid.lineTo(this.iso.gridToScreen(gx + 1, gy).x, this.iso.gridToScreen(gx + 1, gy).y);
    this.grid.lineTo(point.x, point.y);
    this.grid.endFill();

    // Нижние треугольники (дальние)
    const corners = [
      { dx: 1, dy: -1 },
      { dx: -1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: 1 }
    ];

    for (const { dx, dy } of corners) {
      const corner = this.iso.gridToScreen(gx + dx, gy + dy);
      this.grid.moveTo(point.x, point.y);
      this.grid.lineTo(corner.x, corner.y);
      this.grid.lineTo(this.iso.gridToScreen(gx + dx - 1, gy + dy).x, this.iso.gridToScreen(gx + dx - 1, gy + dy).y);
      this.grid.lineTo(point.x, point.y);
      this.grid.endFill();
    }

    return point;
  }

  /**
   * Получение контейнера для сцены
   */
  getContainer(): Container {
    return this.grid;
  }
}

// Экспорт
export default IsoGrid;
