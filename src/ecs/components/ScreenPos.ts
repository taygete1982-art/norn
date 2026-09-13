import { World } from './world';

/**
 * ScreenPos — экранные координаты (x, y)
 */
export class ScreenPos {
  componentType = 'ScreenPos';
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

export default ScreenPos;
