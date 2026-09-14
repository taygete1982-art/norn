import { Graphics, Text } from 'pixi.js';

/**
 * Каменная тема UI (канон #08 stone-ui-v1).
 * Только стиль: тёмный камень + циановые руны + светлые глифы.
 * Логики экранов не касается.
 */
export const STONE = {
  bg: 0x2e3038,
  bgDark: 0x1e2028,
  bgDeep: 0x0c0e14,
  black: 0x000000,
  border: 0x35e0ff,
  borderDim: 0x2a3f46,
  glyph: 0xe0e0e0,
  runeLit: 0x35e0ff,
  runeDim: 0x1e2028,
  lock: 0x8d9199,
} as const;

export const STONE_FONT = 'Courier New, monospace';

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const;

/** Детерминированный крап камня внутри плашки. */
function speckle(g: Graphics, w: number, h: number, seed: number): void {
  let a = seed >>> 0;
  const rnd = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const n = Math.floor((w * h) / 110);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(rnd() * w);
    const y = Math.floor(rnd() * h);
    g.rect(x, y, 2, 1);
    g.fill({ color: rnd() < 0.5 ? STONE.bgDark : 0x3a3e46, alpha: 1 });
  }
}

/**
 * Каменная плашка w×h с крапом, рамкой и рунами-уголками.
 * Координаты от (0,0) — позиционирует вызывающий код.
 */
export function stonePanel(
  w: number,
  h: number,
  opts: { border?: number; seed?: number } = {},
): Graphics {
  const g = new Graphics();
  g.rect(0, 0, w, h);
  g.fill({ color: STONE.bg, alpha: 1 });
  speckle(g, w, h, opts.seed ?? 7);
  const border = opts.border ?? STONE.border;
  g.rect(0, 0, w, h);
  g.stroke({ width: 3, color: border, alpha: 1 });
  // Руны-уголки.
  const r = 10;
  const corners: Array<[number, number, number, number]> = [
    [6, 6, 1, 1],
    [w - 6, 6, -1, 1],
    [6, h - 6, 1, -1],
    [w - 6, h - 6, -1, -1],
  ];
  for (const [cx, cy, hx, hy] of corners) {
    g.rect(hx === 1 ? cx : cx - r, cy, r, 2);
    g.fill({ color: border, alpha: 1 });
    g.rect(cx, hy === 1 ? cy : cy - r, 2, r);
    g.fill({ color: border, alpha: 1 });
  }
  return g;
}

/** Резной глиф: светлый моноширинный текст. */
export function glyph(
  text: string,
  size: number,
  fill: number = STONE.glyph,
  align: 'left' | 'center' | 'right' = 'left',
): Text {
  return new Text({
    text,
    style: { fontFamily: STONE_FONT, fontSize: size, fill, align },
  });
}

/** Вертикальный градиент полосами — фоны без document/canvas. */
export function stoneGradient(
  w: number,
  h: number,
  top: number,
  bottom: number,
  bands = 64,
): Graphics {
  const g = new Graphics();
  const bh = h / bands;
  for (let i = 0; i < bands; i++) {
    const k = bands === 1 ? 0 : i / (bands - 1);
    const r = Math.round(((top >> 16) & 255) + ((((bottom >> 16) & 255) - ((top >> 16) & 255)) * k));
    const gg = Math.round(((top >> 8) & 255) + ((((bottom >> 8) & 255) - ((top >> 8) & 255)) * k));
    const b = Math.round((top & 255) + (((bottom & 255) - (top & 255)) * k));
    g.rect(0, i * bh, w, bh + 1);
    g.fill({ color: (r << 16) | (gg << 8) | b, alpha: 1 });
  }
  return g;
}
