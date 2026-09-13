import { Container, Graphics, Sprite } from 'pixi.js';
import { getTile, TileId } from '../art/PixelArt';

/**
 * Чисто визуальные эффекты боя. Боевая логика не затрагивается:
 * урон применяется мгновенно в TowerAttackSystem, здесь только анимации.
 * Живёт в effectsLayer: выше игрового поля, ниже HUD и меню.
 */

const PROJECTILE_SPEED_CELLS = 8;
const FLASH_DUR = 0.15;
const RING_DUR = 0.3;
const GHOST_DUR = 0.25;

interface Projectile {
  s: Sprite;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
}

interface Flash {
  g: Graphics;
  t: number;
}

interface Ring {
  c: Container;
  g: Graphics;
  t: number;
  maxR: number;
}

interface Ghost {
  c: Container;
  t: number;
}

export class EffectsLayer extends Container {
  private projectiles: Projectile[] = [];
  private flashes: Flash[] = [];
  private rings: Ring[] = [];
  private ghosts: Ghost[] = [];

  /** Сколько незавершённых эффектов сейчас живёт в слое. */
  public get activeCount(): number {
    return this.projectiles.length + this.flashes.length + this.rings.length + this.ghosts.length;
  }

  /** Снаряд: пиксельный спрайт proj_* от башни к точке цели, ~8 клеток/сек. */
  public spawnProjectile(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    tile: TileId,
    gridDist: number,
  ): void {
    const s = new Sprite(getTile(tile));
    s.anchor.set(0.5);
    s.position.set(fromX, fromY);
    this.addChild(s);
    this.projectiles.push({
      s,
      fx: fromX,
      fy: fromY,
      tx: toX,
      ty: toY,
      t: 0,
      dur: Math.max(gridDist / PROJECTILE_SPEED_CELLS, 0.05),
    });
  }

  /** Вспышка попадания: яркий круг поверх врага, ~150 мс. */
  public spawnHitFlash(x: number, y: number, color = 0xffffff): void {
    const g = new Graphics();
    g.circle(0, 0, 18);
    g.fill({ color, alpha: 0.9 });
    g.position.set(x, y);
    this.addChild(g);
    this.flashes.push({ g, t: 0 });
  }

  /** Кольцо AoE cannon: расширяющийся эллипс радиусом из конфига, ~300 мс. */
  public spawnAoERing(x: number, y: number, radiusPx: number): void {
    const c = new Container();
    c.position.set(x, y);
    c.scale.set(1, 0.5); // изометрия: клетка 32×16
    const g = new Graphics();
    g.circle(0, 0, Math.max(radiusPx, 4));
    g.stroke({ width: 4, color: 0xff6b4a, alpha: 1 });
    c.addChild(g);
    c.scale.set(0.25, 0.125);
    this.addChild(c);
    this.rings.push({ c, g, t: 0, maxR: Math.max(radiusPx, 4) });
  }

  /** Призрак смерти: пиксельный спрайт врага, fade-out + уменьшение, ~250 мс. */
  public spawnDeathGhost(x: number, y: number, tile: TileId): void {
    const c = new Container();
    c.position.set(x, y);
    const s = new Sprite(getTile(tile));
    s.anchor.set(0.5);
    c.addChild(s);
    this.addChild(c);
    this.ghosts.push({ c, t: 0 });
  }

  public update(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt;
      const k = Math.min(p.t / p.dur, 1);
      p.s.position.set(p.fx + (p.tx - p.fx) * k, p.fy + (p.ty - p.fy) * k);
      if (k >= 1) this.finish(this.projectiles, i, p.s);
    }

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      const k = Math.min(f.t / FLASH_DUR, 1);
      const s = 1 + k * 0.4;
      f.g.scale.set(s, s);
      f.g.alpha = 1 - k;
      if (k >= 1) this.finish(this.flashes, i, f.g);
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = Math.min(r.t / RING_DUR, 1);
      const s = 0.25 + k * 0.75;
      r.c.scale.set(s, s * 0.5);
      r.g.alpha = 1 - k;
      if (k >= 1) {
        this.removeChild(r.c);
        r.c.destroy({ children: true });
        this.rings.splice(i, 1);
      }
    }

    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const gh = this.ghosts[i];
      gh.t += dt;
      const k = Math.min(gh.t / GHOST_DUR, 1);
      gh.c.alpha = 1 - k;
      const s = Math.max(1 - k * 0.7, 0.05);
      gh.c.scale.set(s, s);
      if (k >= 1) {
        this.removeChild(gh.c);
        gh.c.destroy({ children: true });
        this.ghosts.splice(i, 1);
      }
    }
  }

  /** Полная очистка (рестарт игры, конец волны без хвостов). */
  public clear(): void {
    for (const p of this.projectiles) {
      this.removeChild(p.s);
      p.s.destroy();
    }
    for (const f of this.flashes) {
      this.removeChild(f.g);
      f.g.destroy();
    }
    for (const r of this.rings) {
      this.removeChild(r.c);
      r.c.destroy({ children: true });
    }
    for (const g of this.ghosts) {
      this.removeChild(g.c);
      g.c.destroy({ children: true });
    }
    this.projectiles = [];
    this.flashes = [];
    this.rings = [];
    this.ghosts = [];
  }

  private finish<T>(arr: T[], index: number, item: Sprite | Graphics): void {
    this.removeChild(item);
    item.destroy();
    arr.splice(index, 1);
  }
}
