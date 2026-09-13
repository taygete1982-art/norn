import { World } from './world';

/**
 * Health — здоровье сущности
 */
export class Health {
  componentType = 'Health';
  hp: number;
  maxHp: number;

  constructor(hp: number, maxHp: number = hp) {
    this.hp = hp;
    this.maxHp = maxHp;
  }

  takeDamage(dmg: number): boolean {
    this.hp -= dmg;
    return this.hp <= 0;
  }

  heal(amount: number): void {
    this.hp = Math.min(this.hp + amount, this.maxHp);
  }

  isAlive(): boolean {
    return this.hp > 0;
  }
}

export default Health;
