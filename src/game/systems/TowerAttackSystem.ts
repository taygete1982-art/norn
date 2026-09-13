import { World } from '../../ecs/world';
import { tierConfigOf, effectiveStats } from '../Upgrades';
import { EnvironmentSystem } from './EnvironmentSystem';

/**
 * Мгновенный урон ближайшему врагу в радиусе (дистанция в клетках сетки).
 * Статы эффективные: база × множители tier'а. Награду НЕ начисляет.
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
        kind: string;
        tier: number;
        damage: number;
        damageType: string;
        fireRate: number;
        range: number;
        lastFireTime: number;
        aoeRadius?: number;
        slowAmount?: number;
        slowDuration?: number;
      }>(towerId, 'Tower');
      const tpos = world.getComponent<{ gx: number; gy: number }>(towerId, 'GridPos');
      if (!tower || !tpos) continue;
      // Споры глушат, карнавальный танец не даёт стрелять.
      if (EnvironmentSystem.isSilenced(world, tpos.gx, tpos.gy)) continue;
      if (EnvironmentSystem.isDancing(world, towerId)) continue;
      const eff = effectiveStats(tower, tierConfigOf(tower.kind, tower.tier));
      const cd =
        (eff.cooldown *
          EnvironmentSystem.cooldownMult(tpos.gx, tpos.gy)) /
        EnvironmentSystem.hasteMult(world, towerId);
      if (now - tower.lastFireTime < cd) continue;

      let bestId: number | null = null;
      let bestDist = Infinity;
      const enemies = world.query('Health', 'Enemy', 'GridPos');
      for (const enemyId of enemies) {
        const health = world.getComponent<{ hp: number }>(enemyId, 'Health');
        const epos = world.getComponent<{ gx: number; gy: number }>(enemyId, 'GridPos');
        if (!health || !epos || health.hp <= 0) continue;
        const dist = Math.hypot(epos.gx - tpos.gx, epos.gy - tpos.gy);
        if (dist <= eff.range && dist < bestDist) {
          bestDist = dist;
          bestId = enemyId;
        }
      }

      if (bestId !== null) {
        const targetPos = world.getComponent<{ gx: number; gy: number }>(bestId, 'GridPos');
        let affected: number[] = [bestId];
        if (eff.aoeRadius !== undefined && targetPos) {
          affected = [];
          for (const enemyId of enemies) {
            const h = world.getComponent<{ hp: number }>(enemyId, 'Health');
            const ep = world.getComponent<{ gx: number; gy: number }>(enemyId, 'GridPos');
            if (!h || !ep || h.hp <= 0) continue;
            if (Math.hypot(ep.gx - targetPos.gx, ep.gy - targetPos.gy) <= eff.aoeRadius) {
              affected.push(enemyId);
            }
          }
        }
        for (const id of affected) {
          const health = world.getComponent<{ hp: number }>(id, 'Health');
          if (!health) continue;
          // armorPhysical: физический урон — 0, остальные типы — полностью.
          const victim = world.getComponent<{ abilities?: string[] }>(id, 'Enemy');
          const blocked =
            tower.damageType === 'physical' && victim?.abilities?.includes('armorPhysical');
          if (blocked) continue;
          // choco: получаемый magic-урон ×1.2.
          let dmg = eff.damage;
          if (tower.damageType === 'magic') {
            const vpos = world.getComponent<{ gx: number; gy: number }>(id, 'GridPos');
            if (vpos) dmg *= EnvironmentSystem.magicTakenMult(vpos.gx, vpos.gy);
          }
          health.hp -= dmg;
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
