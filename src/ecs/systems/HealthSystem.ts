import { Entity, Component, Query, World } from 'bitecs';
import { Health } from '../components/Health';

/**
 * HealthSystem — при hp <= 0 сущность удаляется
 */
export class HealthSystem {
  update(world: World, dt: number): void {
    const query = Query.is<Health>();
    const entities = query(world);

    for (const entity of entities) {
      const health = Health.getComponent(entity);

      if (health.hp <= 0) {
        world.removeEntity(entity);
      }
    }
  }
}

export default HealthSystem;
