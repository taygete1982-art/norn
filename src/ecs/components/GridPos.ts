import { World } from './world';

/**
 * GridPos — позиция на изометрической сетке (gx, gy)
 */
export class GridPos {
  componentType = 'GridPos';
  gx: number;
  gy: number;

  constructor(gx: number, gy: number) {
    this.gx = gx;
    this.gy = gy;
  }
}

export default GridPos;
