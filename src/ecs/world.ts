/**
 * Простой ECS-мир: числовые id сущностей, компоненты — plain-объекты
 * под строковыми ключами. Единый дизайн для всей игры.
 */

export type EntityId = number;

export class World {
  private entities = new Map<EntityId, Map<string, any>>();
  private nextId: EntityId = 1;
  private time = 0;

  spawnEntity(initial: Record<string, any> = {}): EntityId {
    const id = this.nextId++;
    const comps = new Map<string, any>();
    for (const [key, value] of Object.entries(initial)) {
      comps.set(key, value);
    }
    this.entities.set(id, comps);
    return id;
  }

  addComponent(id: EntityId, type: string, value: any): void {
    const comps = this.entities.get(id);
    if (!comps) return;
    comps.set(type, value);
  }

  getComponent<T = any>(id: EntityId, type: string): T | undefined {
    return this.entities.get(id)?.get(type);
  }

  hasComponent(id: EntityId, ...types: string[]): boolean {
    const comps = this.entities.get(id);
    if (!comps) return false;
    return types.every((t) => comps.has(t));
  }

  removeEntity(id: EntityId): void {
    this.entities.delete(id);
  }

  query(...types: string[]): EntityId[] {
    const out: EntityId[] = [];
    for (const [id, comps] of this.entities) {
      if (types.every((t) => comps.has(t))) out.push(id);
    }
    return out;
  }

  getCurrentTime(): number {
    return this.time;
  }

  updateTime(dt: number): void {
    this.time += dt;
  }

  getEntityCount(): number {
    return this.entities.size;
  }

  reset(): void {
    this.entities.clear();
    this.nextId = 1;
    this.time = 0;
  }
}
