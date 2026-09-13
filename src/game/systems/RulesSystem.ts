import { World } from '../../ecs/world';
import { GameStateManager } from '../GameState';
import { WaveSpawnerSystem } from './WaveSpawnerSystem';
import { TowerAttackSystem } from './TowerAttackSystem';
import { EnemyFactory, EnemyType } from '../entities/EnemyFactory';
import { PATH } from './MoveSystem';

/**
 * Правила игры. Вызывать ДО HealthSystem:
 * - убийство (hp <= 0): золото за награду
 * - утечка (дошёл до последнего waypoint): урон кристаллу, удалить без награды
 * - все волны пройдены и врагов нет: победа
 * - победа/поражение: остановить спавн и атаки
 */
export class RulesSystem {
  /** Летун у кристалла: дистанция до последней точки пути < 0.2. */
  private static hasArrivedFlying(
    enemy: { abilities?: string[] },
    pos: { gx: number; gy: number } | undefined,
  ): boolean {
    if (!enemy.abilities?.includes('flying') || !pos) return false;
    const last = PATH[PATH.length - 1];
    return Math.hypot(pos.gx - last.gx, pos.gy - last.gy) < 0.2;
  }

  public static update(world: World, _dt: number): void {
    const enemies = world.query('Health', 'Enemy', 'PathIndex');

    for (const id of enemies) {
      const health = world.getComponent<{ hp: number }>(id, 'Health');
      const enemy = world.getComponent<{
        reward: number;
        damage: number;
        abilities?: string[];
        splitInto?: { type: string; count: number };
        splitDone?: boolean;
      }>(id, 'Enemy');
      const path = world.getComponent<{ index: number }>(id, 'PathIndex');
      const pos = world.getComponent<{ gx: number; gy: number }>(id, 'GridPos');
      if (!health || !enemy || !path) continue;

      if (health.hp <= 0) {
        GameStateManager.addGold(enemy.reward);
        // splitOnDeath: осколки в той же точке (один раз, флаг от повторов).
        if (enemy.abilities?.includes('splitOnDeath') && enemy.splitInto && !enemy.splitDone) {
          enemy.splitDone = true;
          for (let i = 0; i < enemy.splitInto.count; i++) {
            EnemyFactory.create(
              world,
              enemy.splitInto.type as EnemyType,
              pos?.gx ?? 0,
              pos?.gy ?? 0,
            );
          }
        }
      } else if (path.index >= PATH.length - 1 || this.hasArrivedFlying(enemy, pos)) {
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
