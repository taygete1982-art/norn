import { Component } from 'bitecs';

/**
 * MoveSpeed — скорость движения
 */
export class MoveSpeed extends Component {
  speed: number;

  constructor(speed: number) {
    super();
    this.speed = speed;
  }
}

export default MoveSpeed;
