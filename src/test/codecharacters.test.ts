import { describe, it, expect, vi } from 'vitest';
import { getTile, torchGlow, TileId } from '../art/PixelArt';

// Программный растровый фейк canvas: fillRect/drawImage честно пишут
// в RGBA-буфер, поэтому пиксельные проверки доктрины настоящие.
// Без DOM и без нативного canvas.
type RGBA = [number, number, number, number];

function parseColor(s: string): RGBA {
  if (s.startsWith('#')) {
    const h = s.slice(1);
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(',').map((v) => parseFloat(v));
    return [p[0], p[1], p[2], p.length > 3 ? Math.round(p[3] * 255) : 255];
  }
  return [0, 0, 0, 0];
}

class FakeCanvas {
  width = 0;
  height = 0;
  buf: Uint8ClampedArray = new Uint8ClampedArray(0);
  imageSmoothingEnabled = true;
  private style: RGBA = [0, 0, 0, 255];

  private ensure(): void {
    if (this.buf.length !== this.width * this.height * 4) {
      this.buf = new Uint8ClampedArray(this.width * this.height * 4);
    }
  }

  getContext(): unknown {
    return this;
  }

  set fillStyle(v: unknown) {
    this.style = typeof v === 'string' ? parseColor(v) : [0, 0, 0, 0];
  }

  get fillStyle(): unknown {
    return this.style;
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.ensure();
    const [sr, sg, sb, sa] = this.style;
    if (sa === 0) return;
    const a = sa / 255;
    for (let j = Math.max(0, Math.floor(y)); j < Math.min(this.height, Math.ceil(y + h)); j++) {
      for (let i = Math.max(0, Math.floor(x)); i < Math.min(this.width, Math.ceil(x + w)); i++) {
        const o = (j * this.width + i) * 4;
        this.buf[o] = Math.round(sr * a + this.buf[o] * (1 - a));
        this.buf[o + 1] = Math.round(sg * a + this.buf[o + 1] * (1 - a));
        this.buf[o + 2] = Math.round(sb * a + this.buf[o + 2] * (1 - a));
        this.buf[o + 3] = 255;
      }
    }
  }

  drawImage(src: FakeCanvas, dx: number, dy: number): void {
    this.ensure();
    src.ensure();
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const tx = Math.floor(dx) + x;
        const ty = Math.floor(dy) + y;
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) continue;
        const s = (y * src.width + x) * 4;
        // Блит непрозрачных пикселей (фон прозрачный).
        if (src.buf[s + 3] === 0) continue;
        const d = (ty * this.width + tx) * 4;
        this.buf[d] = src.buf[s];
        this.buf[d + 1] = src.buf[s + 1];
        this.buf[d + 2] = src.buf[s + 2];
        this.buf[d + 3] = 255;
      }
    }
  }

  createRadialGradient(): { addColorStop(): void } {
    return { addColorStop: () => undefined };
  }

  clearRect(): void {
    this.buf = new Uint8ClampedArray(this.width * this.height * 4);
  }
}

vi.stubGlobal('document', {
  createElement: () => new FakeCanvas(),
});

function canvasOf(id: TileId): FakeCanvas {
  const tex = getTile(id);
  const src = tex.source as unknown as { resource: unknown };
  return src.resource as FakeCanvas;
}

const ENEMIES = [
  'imp',
  'goblin',
  'troll',
  'spore',
  'puffling',
  'truffle',
  'jelly',
  'jellymini',
  'caramel',
  'chocgolem',
  'candyfairy',
  'balloon',
  'cloudsheep',
  'stormling',
  'fluffdragon',
  'clownfish',
  'jellyfish',
  'seahorse',
  'pearlwhale',
  'clown',
  'juggler',
  'magician',
  'elephant',
];

const ENEMY_SIZES: Record<string, [number, number]> = {
  imp: [32, 40],
  goblin: [40, 48],
  troll: [56, 52],
  spore: [32, 40],
  puffling: [44, 44],
  truffle: [52, 52],
  jelly: [40, 44],
  jellymini: [24, 28],
  caramel: [36, 44],
  chocgolem: [56, 56],
  candyfairy: [32, 44],
  balloon: [36, 48],
  cloudsheep: [48, 40],
  stormling: [40, 44],
  fluffdragon: [56, 48],
  clownfish: [40, 36],
  jellyfish: [40, 48],
  seahorse: [32, 48],
  pearlwhale: [60, 44],
  clown: [36, 48],
  juggler: [40, 52],
  magician: [36, 52],
  elephant: [60, 52],
};

const TOWERS: Array<{ id: TileId; size: [number, number] }> = [
  { id: 'tower_arrow', size: [64, 88] },
  { id: 'tower_cannon', size: [64, 88] },
  { id: 'tower_ice', size: [64, 88] },
  { id: 'tower_arrow_t2', size: [64, 112] },
  { id: 'tower_cannon_t2', size: [64, 112] },
  { id: 'tower_ice_t2', size: [64, 112] },
  { id: 'tower_arrow_t3', size: [64, 136] },
  { id: 'tower_cannon_t3', size: [64, 136] },
  { id: 'tower_ice_t3', size: [64, 136] },
];

/** Циан #35e0ff с допуском 32 на канал. */
function hasCyan(cv: FakeCanvas): boolean {
  const [cr, cg, cb] = [0x35, 0xe0, 0xff];
  for (let i = 0; i < cv.buf.length; i += 4) {
    if (cv.buf[i + 3] === 0) continue;
    if (
      Math.abs(cv.buf[i] - cr) <= 32 &&
      Math.abs(cv.buf[i + 1] - cg) <= 32 &&
      Math.abs(cv.buf[i + 2] - cb) <= 32
    ) {
      return true;
    }
  }
  return false;
}

describe('code-characters: силуэт + свет (растровый фейк)', () => {
  it('каждый TileId врага и башни возвращает непустую текстуру', () => {
    for (const e of ENEMIES) {
      for (const f of ['f0', 'f1']) {
        const id = `enemy_${e}_${f}` as TileId;
        const tex = getTile(id);
        const [w, h] = ENEMY_SIZES[e];
        expect(tex.width, id).toBe(w);
        expect(tex.height, id).toBe(h);
      }
    }
    for (const t of TOWERS) {
      const tex = getTile(t.id);
      expect(tex.width, t.id).toBe(t.size[0]);
      expect(tex.height, t.id).toBe(t.size[1]);
    }
    // Снаряды и кристалл тоже непустые.
    for (const id of ['proj_arrow', 'proj_cannon', 'proj_ice'] as TileId[]) {
      const tex = getTile(id);
      expect(tex.width, id).toBe(16);
      expect(tex.height, id).toBe(16);
    }
    for (const id of ['crystal', 'crystal_f0', 'crystal_f1'] as TileId[]) {
      const tex = getTile(id);
      expect(tex.width, id).toBe(48);
      expect(tex.height, id).toBe(64);
    }
  });

  it('в каждом спрайте врага и башни есть пиксели в допуске циана', () => {
    for (const e of ENEMIES) {
      for (const f of ['f0', 'f1']) {
        const id = `enemy_${e}_${f}` as TileId;
        expect(hasCyan(canvasOf(id)), id).toBe(true);
      }
    }
    for (const t of TOWERS) {
      expect(hasCyan(canvasOf(t.id)), t.id).toBe(true);
    }
    expect(hasCyan(canvasOf('proj_arrow')), 'proj_arrow').toBe(true);
    expect(hasCyan(canvasOf('proj_ice')), 'proj_ice').toBe(true);
    expect(hasCyan(canvasOf('crystal_f0')), 'crystal_f0').toBe(true);
    expect(hasCyan(canvasOf('crystal_f1')), 'crystal_f1').toBe(true);
  });

  it('torchGlow() возвращает спрайт с blendMode add', () => {
    const s = torchGlow();
    expect(s.blendMode).toBe('add');
    expect(s.width).toBe(64);
    expect(s.height).toBe(64);
  });
});
