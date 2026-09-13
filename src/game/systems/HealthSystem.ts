import { World } from '../../ecs/world';

/** Удаляет сущности с hp <= 0. Вызывать ПОСЛЕ RulesSystem. */
export class HealthSystem {
  public static update(world: World, _dt: number): void {
    const enemies = world.query('Health', 'Enemy');
    for (const id of enemies) {
      const health = world.getComponent<{ hp: number }>(id, 'Health');
      if (health && health.hp <= 0) {
        world.removeEntity(id);
      }
    }
  }
}
