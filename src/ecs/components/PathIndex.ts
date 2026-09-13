import { Component } from 'bitecs';

/**
 * PathIndex — индекс пути (waypoint index)
 */
export class PathIndex extends Component {
  index: number;

  constructor(index: number) {
    super();
    this.index = index;
  }
}

export default PathIndex;
