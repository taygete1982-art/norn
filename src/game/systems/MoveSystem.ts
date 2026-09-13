import { World } from '../../ecs/world';

/** Путь по умолчанию. Уровень заменяет его через setPath (рефакторинг хардкода). */
const DEFAULT_PATH: Array<{ gx: number; gy: number }> = [
  { gx: 0, gy: 0 },
  { gx: 2, gy: 3 },
  { gx: 4, gy: 6 },
  { gx: 6, gy: 9 },
  { gx: 7, gy: 11 },
];

export let PATH: Array<{ gx: number; gy: number }> = [...DEFAULT_PATH];

/** Подменить активный путь точками уровня (формат {gx,gy}). */
export function setPath(points: Array<{ gx: number; gy: number }>): void {
  if (points.length > 0) PATH = points.map((p) => ({ gx: p.gx, gy: p.gy }));
}

export function resetPath(): void {
  PATH = [...DEFAULT_PATH];
}

function segLen(a: { gx: number; gy: number }, b: { gx: number; gy: number }): number {
  return Math.hypot(b.gx - a.gx, b.gy - a.gy);
}

/**
 * Двигает врагов вдоль PATH. PathIndex = { index, t }:
 * index — текущий сегмент, t — пройденная дистанция внутри сегмента.
 */
export class MoveSystem {
  public static update(world: World, dt: number): void {
    const enemies = world.query('MoveSpeed', 'PathIndex', 'GridPos');
    for (const id of enemies) {
      const speed = world.getComponent<{ speed: number }>(id, 'MoveSpeed');
      const path = world.getComponent<{ index: number; t: number }>(id, 'PathIndex');
      const pos = world.getComponent<{ gx: number; gy: number }>(id, 'GridPos');
      if (!speed || !path || !pos) continue;

      let mult = 1;
      const slow = world.getComponent<{ amount?: number; factor?: number; until: number }>(
        id,
        'Slow',
      );
      if (slow && world.getCurrentTime() < slow.until) {
        mult = 1 - (slow.amount ?? slow.factor ?? 0);
      }

      // flying: по прямой от спавна к кристаллу, путь игнорируется.
      const enemyFly = world.getComponent<{ abilities?: string[] }>(id, 'Enemy');
      if (enemyFly?.abilities?.includes('flying')) {
        const target = PATH[PATH.length - 1];
        const dx = target.gx - pos.gx;
        const dy = target.gy - pos.gy;
        const d = Math.hypot(dx, dy);
        const step = speed.speed * mult * dt;
        if (d <= step || d === 0) {
          pos.gx = target.gx;
          pos.gy = target.gy;
        } else {
          pos.gx += (dx / d) * step;
          pos.gy += (dy / d) * step;
        }
        continue;
      }

      let remaining = speed.speed * mult * dt;
      while (remaining > 0 && path.index < PATH.length - 1) {
        const a = PATH[path.index];
        const b = PATH[path.index + 1];
        const len = segLen(a, b);
        const left = len - path.t;
        if (remaining < left) {
          path.t += remaining;
          remaining = 0;
        } else {
          remaining -= left;
          path.index += 1;
          path.t = 0;
        }
      }

      const i = Math.min(path.index, PATH.length - 1);
      if (i >= PATH.length - 1) {
        pos.gx = PATH[PATH.length - 1].gx;
        pos.gy = PATH[PATH.length - 1].gy;
      } else {
        const a = PATH[i];
        const b = PATH[i + 1];
        const len = segLen(a, b);
        const k = len > 0 ? path.t / len : 0;
        pos.gx = a.gx + (b.gx - a.gx) * k;
        pos.gy = a.gy + (b.gy - a.gy) * k;
      }
    }
  }
}
