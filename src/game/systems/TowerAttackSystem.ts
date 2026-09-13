import { World } from '../../ecs/world';

/**
 * Мгновенный урон ближайшему врагу в радиусе (дистанция в клетках сетки).
 * Награду НЕ начисляет — это делает RulesSystem.
 */
export class TowerAttackSystem {
  private static paused = false;

  public static reset(): void {
    this.paused = false;
  }

  public static pause(): void {
    this.paused = true;
  }

  public static resume(): void {
    this.paused = false;
  }

  public static update(world: World, _dt: number): void {
    if (this.paused) return;
    const now = world.getCurrentTime();
    const towers = world.query('Tower', 'GridPos');

    for (const towerId of towers) {
      const tower = world.getComponent<{
        damage: number;
        fireRate: number;
        range: number;
        lastFireTime: number;
      }>(towerId, 'Tower');
      const tpos = world.getComponent<{ gx: number; gy: number }>(towerId, 'GridPos');
      if (!tower || !tpos) continue;
      if (now - tower.lastFireTime < tower.fireRate) continue;

      let bestId: number | null = null;
      let bestDist = Infinity;
      const enemies = world.query('Health', 'Enemy', 'GridPos');
      for (const enemyId of enemies) {
        const health = world.getComponent<{ hp: number }>(enemyId, 'Health');
        const epos = world.getComponent<{ gx: number; gy: number }>(enemyId, 'GridPos');
        if (!health || !epos || health.hp <= 0) continue;
        const dist = Math.hypot(epos.gx - tpos.gx, epos.gy - tpos.gy);
        if (dist <= tower.range && dist < bestDist) {
          bestDist = dist;
          bestId = enemyId;
        }
      }

      if (bestId !== null) {
        const health = world.getComponent<{ hp: number }>(bestId, 'Health');
        if (health) {
          health.hp -= tower.damage;
          tower.lastFireTime = now;
        }
      }
    }
  }
}
