import { World } from '../../ecs/world';
import { GameStateManager } from '../GameState';
import { WaveSpawnerSystem } from './WaveSpawnerSystem';
import { TowerAttackSystem } from './TowerAttackSystem';
import { PATH } from './MoveSystem';

/**
 * Правила игры. Вызывать ДО HealthSystem:
 * - убийство (hp <= 0): золото за награду
 * - утечка (дошёл до последнего waypoint): урон кристаллу, удалить без награды
 * - все волны пройдены и врагов нет: победа
 * - победа/поражение: остановить спавн и атаки
 */
export class RulesSystem {
  public static update(world: World, _dt: number): void {
    const enemies = world.query('Health', 'Enemy', 'PathIndex');

    for (const id of enemies) {
      const health = world.getComponent<{ hp: number }>(id, 'Health');
      const enemy = world.getComponent<{ reward: number; damage: number }>(id, 'Enemy');
      const path = world.getComponent<{ index: number }>(id, 'PathIndex');
      if (!health || !enemy || !path) continue;

      if (health.hp <= 0) {
        GameStateManager.addGold(enemy.reward);
      } else if (path.index >= PATH.length - 1) {
        GameStateManager.takeCrystalDamage(enemy.damage);
        world.removeEntity(id);
      }
    }

    if (
      WaveSpawnerSystem.getStatus() === 'completed' &&
      world.query('Health', 'Enemy').length === 0
    ) {
      GameStateManager.setStatus('won');
    }

    const status = GameStateManager.getStatus();
    if (status === 'won' || status === 'lost') {
      WaveSpawnerSystem.pause();
      TowerAttackSystem.pause();
    }
  }
}
