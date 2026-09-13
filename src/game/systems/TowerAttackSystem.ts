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
        aoeRadius?: number;
        slowAmount?: number;
        slowDuration?: number;
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
        const targetPos = world.getComponent<{ gx: number; gy: number }>(bestId, 'GridPos');
        let affected: number[] = [bestId];
        if (tower.aoeRadius !== undefined && targetPos) {
          affected = [];
          for (const enemyId of enemies) {
            const h = world.getComponent<{ hp: number }>(enemyId, 'Health');
            const ep = world.getComponent<{ gx: number; gy: number }>(enemyId, 'GridPos');
            if (!h || !ep || h.hp <= 0) continue;
            if (Math.hypot(ep.gx - targetPos.gx, ep.gy - targetPos.gy) <= tower.aoeRadius) {
              affected.push(enemyId);
            }
          }
        }
        for (const id of affected) {
          const health = world.getComponent<{ hp: number }>(id, 'Health');
          if (!health) continue;
          health.hp -= tower.damage;
          if (tower.slowAmount !== undefined && tower.slowDuration !== undefined) {
            const until = now + tower.slowDuration;
            const cur = world.getComponent<{ amount?: number; factor?: number; until: number }>(
              id,
              'Slow',
            );
            if (cur) {
              cur.amount = tower.slowAmount;
              cur.factor = tower.slowAmount;
              cur.until = Math.max(cur.until, until);
            } else {
              world.addComponent(id, 'Slow', {
                amount: tower.slowAmount,
                factor: tower.slowAmount,
                until,
              });
            }
          }
        }
        tower.lastFireTime = now;
      }
    }
  }
}
