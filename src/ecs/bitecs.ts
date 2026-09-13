import { IsoMath } from '../iso/IsoMath';

// === Components ===

export class GridPos {
  readonly data: { gx: number; gy: number };
  constructor(gx: number, gy: number) {
    this.data = { gx, gy };
  }
}

export class ScreenPos {
  readonly data: { x: number; y: number };
  constructor(x: number, y: number) {
    this.data = { x, y };
  }
}

export class Health {
  readonly data: { hp: number; maxHp: number };
  constructor(hp: number, maxHp: number = hp) {
    this.data = { hp, maxHp };
  }
  takeDamage(dmg: number): boolean {
    this.data.hp -= dmg;
    return this.data.hp <= 0;
  }
  heal(amount: number): void {
    this.data.hp = Math.min(this.data.hp + amount, this.data.maxHp);
  }
  isAlive(): boolean {
    return this.data.hp > 0;
  }
}

export class MoveSpeed {
  readonly data: { speed: number };
  constructor(speed: number) {
    this.data = { speed };
  }
}

export class PathIndex {
  readonly data: { index: number };
  constructor(index: number) {
    this.data = { index };
  }
}

// === Systems ===

export class PathFollowSystem {
  private iso: IsoMath;
  private speed: number;

  constructor(iso: IsoMath, speed: number = 10) {
    this.iso = iso;
    this.speed = speed;
  }

  update(world: any, dt: number): void {
    const entities = world.query<ScreenPos, PathIndex>();
    for (const entity of entities) {
      const screenPos = ScreenPos.getComponent(entity);
      screenPos.y += this.speed * dt;
    }
  }
}

export class HealthSystem {
  update(world: any, dt: number): void {
    const entities = world.query<Health>();
    for (const entity of entities) {
      if (!Health.getComponent(entity).isAlive()) {
        world.removeEntity(entity);
      }
    }
  }
}

// === Demo ===

export class DemoECS {
  private world: World;
  private pathFollow: PathFollowSystem;

  constructor(width: number, height: number) {
    this.world = World.create();
    this.pathFollow = new PathFollowSystem(new IsoMath({ x: 32, y: 16 }), 10);
    this.createEnemies();
  }

  createEnemies(): void {
    for (let i = 0; i < 3; i++) {
      const entity = this.world.spawnEntity({
        GridPos: new GridPos(3, 0),
        PathIndex: new PathIndex(i),
        Health: new Health(3),
        MoveSpeed: new MoveSpeed(10),
        ScreenPos: new ScreenPos(0, 0)
      });
    }
  }

  update(dt: number): void {
    this.pathFollow.update(this.world, dt);
  }
}

// === World Factory ===

export function createWorld(width: number, height: number): DemoECS {
  return new DemoECS(width, height);
}

// === Default export ===
export default {
  GridPos, ScreenPos, Health, MoveSpeed, PathIndex,
  PathFollowSystem, HealthSystem, DemoECS, createWorld
};
