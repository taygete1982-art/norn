import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildLightMap,
  buildFogVignette,
  updateTorches,
  FOG_EDGE_ALPHA,
} from '../art/Lighting';

// Детерминированный фейк canvas: create/put/getImageData на реальных массивах,
// без DOM и без нативного canvas. Градиентная математика Lighting честно
// исполняется попиксельно, сэмплы в тестах — настоящие.
class FakeCanvas {
  width = 0;
  height = 0;
  private buf: Uint8ClampedArray = new Uint8ClampedArray(0);
  private ctx: unknown = null;

  getContext(): unknown {
    if (!this.ctx) {
      const self = this;
      this.ctx = {
        imageSmoothingEnabled: true,
        createImageData(w: number, h: number) {
          return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
        },
        putImageData(img: { width: number; height: number; data: Uint8ClampedArray }) {
          self.buf = new Uint8ClampedArray(img.data);
        },
        getImageData(x: number, y: number, w: number, h: number) {
          const out = new Uint8ClampedArray(w * h * 4);
          for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
              const sx = x + i;
              const sy = y + j;
              if (sx < 0 || sy < 0 || sx >= self.width || sy >= self.height) continue;
              const s = (sy * self.width + sx) * 4;
              const d = (j * w + i) * 4;
              out[d] = self.buf[s];
              out[d + 1] = self.buf[s + 1];
              out[d + 2] = self.buf[s + 2];
              out[d + 3] = self.buf[s + 3];
            }
          }
          return { data: out };
        },
        clearRect() {
          self.buf = new Uint8ClampedArray(self.width * self.height * 4);
        },
      };
    }
    return this.ctx;
  }
}

vi.stubGlobal('document', {
  createElement: () => new FakeCanvas(),
});

function alphaAt(cv: HTMLCanvasElement, x: number, y: number): number {
  const ctx = cv.getContext('2d') as unknown as {
    getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray };
  };
  return ctx.getImageData(x, y, 1, 1).data[3];
}

describe('Lighting (predender, deterministic fake canvas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buildLightMap возвращает canvas размером с остров', () => {
    const cv = buildLightMap(8, 12, { gx: 7, gy: 11 }, []);
    // W = (8+12)*32, H = (8+12)*16 + 96
    expect(cv.width).toBe(640);
    expect(cv.height).toBe(416);
    // Центр кристалла светится, дальний угол темен.
    // Клетка (7,11): x = (7-11)*32 + 320 = 192, y = (7+11)*16 = 288.
    expect(alphaAt(cv, 192, 288)).toBeGreaterThan(200);
    expect(alphaAt(cv, 639, 0)).toBe(0);
  });

  it('buildFogVignette: центр прозрачнее краёв', () => {
    const cv = buildFogVignette(720, 1280);
    expect(cv.width).toBe(720);
    expect(cv.height).toBe(1280);
    const center = alphaAt(cv, 360, 640);
    const corner = alphaAt(cv, 0, 0);
    expect(center).toBeLessThanOrEqual(5);
    expect(corner).toBeGreaterThanOrEqual(Math.round(FOG_EDGE_ALPHA * 255) - 5);
    expect(center).toBeLessThan(corner);
  });

  it('updateTorches с пустым массивом не падает; факел даёт тёплое пятно', () => {
    const crystal = { gx: 7, gy: 11 };
    const torch = { gx: 1, gy: 0 };
    // Клетка факела (1,0): x = 32 + 320 = 352, y = 16.
    const withTorch = buildLightMap(8, 12, crystal, [torch]);
    const lit = alphaAt(withTorch, 352, 16);
    expect(lit).toBeGreaterThan(150);

    let rebuilt: HTMLCanvasElement | null = null;
    expect(() => {
      rebuilt = updateTorches([]);
    }).not.toThrow();
    expect(rebuilt!.width).toBe(640);
    expect(rebuilt!.height).toBe(416);
    // Без факелов пятно гаснет (остаётся только дальний свет кристалла).
    expect(alphaAt(rebuilt!, 352, 16)).toBeLessThan(lit);
  });
});
