import { describe, it, expect, vi } from 'vitest';
import { EffectsLayer } from '../ui/EffectsLayer';

// getTile рисует в offscreen-canvas: в node-окружении подменяем document
// минимальным фейком (все операции 2d-контекста — no-op).
function makeCtx(): unknown {
  return new Proxy(
    {},
    {
      get: (_t, p) => (p === 'canvas' ? {} : (..._a: unknown[]) => undefined),
      set: () => true,
    },
  );
}
vi.stubGlobal('document', {
  createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx() }),
});

describe('EffectsLayer (visual only, no combat logic)', () => {
  it('projectile flies and is destroyed on arrival', () => {
    const fx = new EffectsLayer();
    fx.spawnProjectile(0, 0, 100, 0, 'proj_arrow', 2); // 2 клетки / 8 = 0.25 сек
    expect(fx.activeCount).toBe(1);
    fx.update(0.1);
    expect(fx.activeCount).toBe(1);
    fx.update(0.2);
    expect(fx.activeCount).toBe(0);
    expect(fx.children.length).toBe(0);
  });

  it('flash + ring + ghost fade out and free memory', () => {
    const fx = new EffectsLayer();
    fx.spawnHitFlash(10, 10);
    fx.spawnAoERing(10, 10, 48);
    fx.spawnDeathGhost(10, 10, 'enemy_goblin_f0');
    expect(fx.activeCount).toBe(3);
    fx.update(0.1);
    expect(fx.activeCount).toBe(3); // все длительности ≥ 0.15
    fx.update(0.25); // суммарно 0.35 > всех длительностей
    expect(fx.activeCount).toBe(0);
    expect(fx.children.length).toBe(0);
  });

  it('clear() drops everything (restart / between waves)', () => {
    const fx = new EffectsLayer();
    fx.spawnProjectile(0, 0, 100, 0, 'proj_cannon', 5);
    fx.spawnHitFlash(10, 10);
    fx.spawnAoERing(10, 10, 48);
    fx.spawnDeathGhost(10, 10, 'enemy_troll_f1');
    fx.clear();
    expect(fx.activeCount).toBe(0);
    expect(fx.children.length).toBe(0);
  });
});
