import { CanvasSource, Texture } from 'pixi.js';

/**
 * Код-генерируемые пиксельные текстуры.
 * Рисование в offscreen canvas в низком разрешении, imageSmoothing off,
 * nearest-фильтр на всех текстурах.
 *
 * Игровой код берёт текстуры только через getTile(id) — позже код-генерацию
 * можно заменить на PNG-атлас, не трогая игровой код.
 */

export const PALETTE = {
  grass: '#6abe30',
  grassDark: '#4a8f24',
  road: '#d8c078',
  roadLight: '#eed690',
  stone: '#8f8f9f',
  stoneDark: '#5f5f6f',
  earth: '#8a5a34',
  earthDark: '#5e3c22',
  void: '#1a1a2e',
  cloud: '#cfe8ff',
  crystal: '#66e0ff',
  uiPanel: '#26263a',
  uiText: '#f4f4f4',
  gold: '#ffd75e',
} as const;

/** Те же цвета числом — для параметров Pixi (fill/stroke/tint). */
export const PAL = {
  grass: 0x6abe30,
  grassDark: 0x4a8f24,
  road: 0xd8c078,
  roadLight: 0xeed690,
  stone: 0x8f8f9f,
  stoneDark: 0x5f5f6f,
  earth: 0x8a5a34,
  earthDark: 0x5e3c22,
  void: 0x1a1a2e,
  cloud: 0xcfe8ff,
  crystal: 0x66e0ff,
  uiPanel: 0x26263a,
  uiText: 0xf4f4f4,
  gold: 0xffd75e,
} as const;

export type TileId =
  | 'grass-a'
  | 'grass-b'
  | 'road-a'
  | 'road-b'
  | 'pedestal'
  | 'skirt-tall'
  | 'skirt-short'
  | 'cloud-1'
  | 'cloud-2'
  | 'crystal'
  | 'tower_arrow'
  | 'tower_cannon'
  | 'tower_ice'
  | 'enemy_goblin_f0'
  | 'enemy_goblin_f1'
  | 'enemy_troll_f0'
  | 'enemy_troll_f1'
  | 'enemy_imp_f0'
  | 'enemy_imp_f1'
  | 'proj_arrow'
  | 'proj_cannon'
  | 'proj_ice'
  | 'void-bg';

export const TILE_W = 64;
export const TILE_H = 32;

const cache = new Map<string, Texture>();

/** Детерминированный RNG, чтобы тайлы выглядели одинаково каждый запуск. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function css(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

/** Осветлить/затемнить hex-цвет: f > 1 светлее, f < 1 темнее. */
function shade(hex: string, f: number): string {
  const [r, g, b] = hexToRgb(hex);
  const cl = (v: number): number => Math.max(0, Math.min(255, Math.round(v * f)));
  return css([cl(r), cl(g), cl(b)]);
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [cv, ctx];
}

function toTexture(cv: HTMLCanvasElement): Texture {
  const source = new CanvasSource({ resource: cv });
  source.scaleMode = 'nearest';
  return new Texture({ source });
}

/** Залить изометрический ромб 64×32 базовым цветом попиксельно. */
function fillDiamond(
  ctx: CanvasRenderingContext2D,
  base: string,
  seed: number,
  speckle: string,
  speckleCount: number,
): void {
  for (let y = 0; y < TILE_H; y++) {
    const half = 32 - Math.abs(y - 15.5) * 2;
    for (let x = Math.ceil(32 - half); x < 32 + half; x++) {
      ctx.fillStyle = base;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Верхние кромки светлее, нижние темнее — объём тайла.
  ctx.fillStyle = shade(base, 1.25);
  for (let y = 0; y < 15; y++) {
    const half = 32 - Math.abs(y - 15.5) * 2;
    ctx.fillRect(Math.ceil(32 - half), y, 1, 1);
    ctx.fillRect(Math.floor(32 + half) - 1, y, 1, 1);
  }
  ctx.fillStyle = shade(base, 0.7);
  for (let y = 16; y < TILE_H; y++) {
    const half = 32 - Math.abs(y - 15.5) * 2;
    ctx.fillRect(Math.ceil(32 - half), y, 1, 1);
    ctx.fillRect(Math.floor(32 + half) - 1, y, 1, 1);
  }
  // Крап-пятна внутри ромба.
  const rnd = mulberry32(seed);
  ctx.fillStyle = speckle;
  for (let i = 0; i < speckleCount; i++) {
    const x = 8 + Math.floor(rnd() * 48);
    const y = 6 + Math.floor(rnd() * 20);
    const half = 32 - Math.abs(y - 15.5) * 2;
    if (Math.abs(x - 32) < half - 2) ctx.fillRect(x, y, 2, 1);
  }
}

function drawGrass(ctx: CanvasRenderingContext2D, seed: number): void {
  fillDiamond(ctx, PALETTE.grass, seed, PALETTE.grassDark, 8);
}

function drawRoad(ctx: CanvasRenderingContext2D, seed: number): void {
  fillDiamond(ctx, PALETTE.road, seed, PALETTE.earth, 5);
  // Светлая середина + точки-камешки.
  const rnd = mulberry32(seed + 999);
  ctx.fillStyle = PALETTE.roadLight;
  for (let i = 0; i < 10; i++) {
    const x = 16 + Math.floor(rnd() * 32);
    const y = 10 + Math.floor(rnd() * 12);
    const half = 32 - Math.abs(y - 15.5) * 2;
    if (Math.abs(x - 32) < half - 3) ctx.fillRect(x, y, 2, 1);
  }
  ctx.fillStyle = PALETTE.stone;
  for (let i = 0; i < 3; i++) {
    const x = 14 + Math.floor(rnd() * 36);
    const y = 9 + Math.floor(rnd() * 14);
    const half = 32 - Math.abs(y - 15.5) * 2;
    if (Math.abs(x - 32) < half - 4) {
      ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.fillRect(x, y + 1, 2, 1);
      ctx.fillStyle = PALETTE.stone;
    }
  }
}

/** Каменный постамент точки строительства 64×44. */
function drawPedestal(ctx: CanvasRenderingContext2D): void {
  // Лобовая грань (толщина плиты).
  ctx.fillStyle = PALETTE.stoneDark;
  for (let y = 24; y < 38; y++) {
    const half = 28 - (y - 24) * 1.6;
    for (let x = Math.ceil(32 - half); x < 32 + half; x++) ctx.fillRect(x, y, 1, 1);
  }
  ctx.fillStyle = shade(PALETTE.stoneDark, 0.7);
  ctx.fillRect(8, 37, 48, 2);
  // Верхняя плита.
  for (let y = 0; y < 28; y++) {
    const half = 30 - Math.abs(y - 14) * 2.1;
    for (let x = Math.ceil(32 - half); x < 32 + half; x++) {
      ctx.fillStyle = PALETTE.stone;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Тёмный контур плиты.
  ctx.fillStyle = PALETTE.stoneDark;
  for (let y = 0; y < 13; y++) {
    const half = 30 - Math.abs(y - 14) * 2.1;
    ctx.fillRect(Math.ceil(32 - half), y, 1, 1);
    ctx.fillRect(Math.floor(32 + half) - 1, y, 1, 1);
  }
  for (let y = 14; y < 28; y++) {
    const half = 30 - Math.abs(y - 14) * 2.1;
    ctx.fillRect(Math.ceil(32 - half), y, 1, 1);
    ctx.fillRect(Math.floor(32 + half) - 1, y, 1, 1);
  }
  // Внутренний ромб-подложка под башню.
  ctx.fillStyle = shade(PALETTE.stone, 0.82);
  for (let y = 7; y < 21; y++) {
    const half = 13 - Math.abs(y - 14) * 0.95;
    for (let x = Math.ceil(32 - half); x < 32 + half; x++) ctx.fillRect(x, y, 1, 1);
  }
}

/** Юбка острова: сверху ромб травы, ниже столб земли с камнями и рваный низ. */
function drawSkirt(ctx: CanvasRenderingContext2D, h: number, seed: number): void {
  // Верхний ромб травы (центр ромба на y=16).
  ctx.save();
  ctx.translate(0, 0);
  const tmp = document.createElement('canvas');
  tmp.width = TILE_W;
  tmp.height = TILE_H;
  const tctx = tmp.getContext('2d')!;
  tctx.imageSmoothingEnabled = false;
  fillDiamond(tctx, PALETTE.grass, seed, PALETTE.grassDark, 6);
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
  // Столб земли.
  const rnd = mulberry32(seed + 7);
  for (let y = 24; y < h - 6; y++) {
    const taper = Math.max(10, 26 - (y - 24) * 0.12);
    for (let x = Math.ceil(32 - taper); x < 32 + taper; x++) {
      ctx.fillStyle = y % 2 === 0 ? PALETTE.earth : shade(PALETTE.earth, 0.92);
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = PALETTE.earthDark;
    ctx.fillRect(Math.ceil(32 - taper), y, 2, 1);
    ctx.fillRect(Math.floor(32 + taper) - 2, y, 2, 1);
  }
  // Камни в земле.
  ctx.fillStyle = PALETTE.stoneDark;
  for (let i = 0; i < 8; i++) {
    const x = 14 + Math.floor(rnd() * 36);
    const y = 28 + Math.floor(rnd() * (h - 40));
    ctx.fillRect(x, y, 3, 2);
  }
  ctx.fillStyle = PALETTE.stone;
  for (let i = 0; i < 5; i++) {
    const x = 16 + Math.floor(rnd() * 32);
    const y = 30 + Math.floor(rnd() * (h - 44));
    ctx.fillRect(x, y, 2, 1);
  }
  // Рваный нижний край.
  ctx.fillStyle = PALETTE.earthDark;
  for (let x = 6; x < 58; x += 2) {
    const teeth = 3 + Math.floor(rnd() * 5);
    for (let y = h - 6; y < h - 6 + teeth && y < h; y++) ctx.fillRect(x, y, 1, 1);
  }
}

/** Пиксельное облако: бело-голубой сгусток с плоским низом. */
function drawCloud(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
  const rnd = mulberry32(seed);
  const blobs: Array<[number, number, number]> = [];
  const n = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    blobs.push([
      Math.floor(w * 0.15 + rnd() * w * 0.7),
      Math.floor(h * 0.25 + rnd() * h * 0.35),
      Math.floor(Math.min(w, h) * (0.18 + rnd() * 0.16)),
    ]);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let inside = false;
      let top = false;
      for (const [bx, by, br] of blobs) {
        const d = Math.hypot(x - bx, y - by);
        if (d < br) {
          inside = true;
          if (y < by - br * 0.2) top = true;
          break;
        }
      }
      if (!inside) continue;
      if (y > h * 0.78) continue; // плоский низ
      ctx.fillStyle = top ? shade(PALETTE.cloud, 1.12) : PALETTE.cloud;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** Кристалл: три осколка, контур + блик. */
function drawCrystal(ctx: CanvasRenderingContext2D): void {
  const shard = (x0: number, w0: number, h0: number, lean: number): void => {
    const yBase = 60;
    for (let y = 0; y < h0; y++) {
      const k = y / h0;
      const half = (w0 / 2) * k;
      const cx = x0 + lean * (1 - k);
      for (let x = Math.ceil(cx - half); x < cx + half; x++) {
        ctx.fillStyle = PALETTE.crystal;
        ctx.fillRect(x, yBase - y, 1, 1);
      }
      ctx.fillStyle = shade(PALETTE.crystal, 0.55);
      ctx.fillRect(Math.ceil(cx - half), yBase - y, 1, 1);
      if (k > 0.4) {
        ctx.fillStyle = PALETTE.cloud;
        ctx.fillRect(Math.ceil(cx - half) + 1, yBase - y, 1, 1);
      }
    }
  };
  shard(24, 16, 52, 0);
  shard(12, 10, 32, -3);
  shard(36, 10, 38, 3);
  // Основание-земля под осколками.
  ctx.fillStyle = PALETTE.earthDark;
  ctx.fillRect(8, 60, 32, 3);
}

/** Фон пустоты: вертикальный градиент из палитры (бендинг = пиксельная эстетика). */
function drawVoid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const [r0, g0, b0] = hexToRgb(PALETTE.void);
  for (let y = 0; y < h; y++) {
    const k = y / h;
    const f = 1.35 - k * 0.75; // сверху светлее, книзу темнее
    ctx.fillStyle = css([
      Math.min(255, Math.round(r0 * f)),
      Math.min(255, Math.round(g0 * f)),
      Math.min(255, Math.round(b0 * f)),
    ]);
    ctx.fillRect(0, y, w, 1);
  }
}

/** Общее основание башни 64×88: каменная платформа, низ — y 64..88. */
function drawTowerBase(ctx: CanvasRenderingContext2D): void {
  for (let y = 64; y < 82; y++) {
    const half = 27 - (y - 64) * 0.7;
    for (let x = Math.ceil(32 - half); x < 32 + half; x++) {
      ctx.fillStyle = PALETTE.stone;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = PALETTE.stoneDark;
    ctx.fillRect(Math.ceil(32 - half), y, 1, 1);
    ctx.fillRect(Math.floor(32 + half) - 1, y, 1, 1);
  }
  ctx.fillStyle = shade(PALETTE.stoneDark, 0.75);
  ctx.fillRect(8, 82, 48, 3);
  ctx.fillStyle = shade(PALETTE.stone, 1.18);
  ctx.fillRect(12, 64, 40, 2);
}

/** Arrow: деревянная вышка с флажком. Верхние 16px пустые — место под этажи. */
function drawTowerArrow(ctx: CanvasRenderingContext2D): void {
  drawTowerBase(ctx);
  // Ноги вышки.
  ctx.fillStyle = PALETTE.earth;
  ctx.fillRect(24, 38, 4, 26);
  ctx.fillRect(36, 38, 4, 26);
  ctx.fillStyle = PALETTE.earthDark;
  ctx.fillRect(24, 38, 1, 26);
  ctx.fillRect(36, 38, 1, 26);
  // Раскосы.
  ctx.fillRect(27, 46, 9, 2);
  ctx.fillRect(27, 54, 9, 2);
  // Площадка.
  ctx.fillStyle = PALETTE.earthDark;
  ctx.fillRect(18, 32, 28, 6);
  ctx.fillStyle = shade(PALETTE.earth, 1.2);
  ctx.fillRect(18, 32, 28, 1);
  // Перила.
  ctx.fillStyle = PALETTE.earth;
  ctx.fillRect(18, 24, 2, 8);
  ctx.fillRect(44, 24, 2, 8);
  ctx.fillRect(18, 24, 28, 2);
  // Флагшток + золотой флажок.
  ctx.fillStyle = PALETTE.earthDark;
  ctx.fillRect(31, 8, 2, 18);
  ctx.fillStyle = PALETTE.gold;
  for (let x = 0; x < 9; x++) {
    ctx.fillRect(33 + x, 9, 1, 5 - Math.floor(x / 2));
  }
}

/** Cannon: каменная тумба с тёмным (void) стволом. */
function drawTowerCannon(ctx: CanvasRenderingContext2D): void {
  drawTowerBase(ctx);
  // Тумба-трапеция.
  for (let y = 34; y < 64; y++) {
    const half = 13 - (y - 34) * 0.15;
    for (let x = Math.ceil(32 - half); x < 32 + half; x++) {
      ctx.fillStyle = PALETTE.stone;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = PALETTE.stoneDark;
    ctx.fillRect(Math.ceil(32 - half), y, 1, 1);
    ctx.fillRect(Math.floor(32 + half) - 1, y, 1, 1);
  }
  // Верхний ободок.
  ctx.fillStyle = shade(PALETTE.stone, 1.2);
  ctx.fillRect(19, 32, 26, 3);
  ctx.fillStyle = PALETTE.stoneDark;
  ctx.fillRect(19, 35, 26, 1);
  // Каменная крошка.
  ctx.fillStyle = PALETTE.stoneDark;
  ctx.fillRect(26, 44, 2, 2);
  ctx.fillRect(35, 52, 2, 1);
  ctx.fillRect(29, 56, 3, 1);
  // Ствол вверх-вправо.
  ctx.fillStyle = PALETTE.void;
  for (let i = 0; i < 16; i++) {
    const x = 32 + Math.floor(i * 0.8);
    const y = 38 - Math.floor(i * 0.9);
    ctx.fillRect(x - 2, y - 2, 5, 5);
  }
  // Дуло и запал.
  ctx.fillStyle = PALETTE.stoneDark;
  ctx.fillRect(42, 20, 6, 6);
  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(43, 21, 4, 4);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(30, 30, 2, 2);
}

/** Ice: кристальный обелиск с голубым свечением. */
function drawTowerIce(ctx: CanvasRenderingContext2D): void {
  drawTowerBase(ctx);
  // Малое каменное ложе.
  ctx.fillStyle = PALETTE.stoneDark;
  ctx.fillRect(22, 56, 20, 8);
  ctx.fillStyle = PALETTE.stone;
  ctx.fillRect(22, 56, 20, 2);
  // Центральный обелиск.
  for (let y = 0; y < 42; y++) {
    const k = y / 42;
    const half = 6 * (1 - k) + 1;
    const yy = 56 - y;
    for (let x = Math.ceil(32 - half); x < 32 + half; x++) {
      ctx.fillStyle = PALETTE.crystal;
      ctx.fillRect(x, yy, 1, 1);
    }
    ctx.fillStyle = shade(PALETTE.crystal, 0.55);
    ctx.fillRect(Math.ceil(32 - half), yy, 1, 1);
    if (k > 0.35 && k < 0.8) {
      ctx.fillStyle = PALETTE.cloud;
      ctx.fillRect(Math.ceil(32 - half) + 1, yy, 1, 2);
    }
  }
  // Боковые осколки.
  ctx.fillStyle = PALETTE.crystal;
  ctx.fillRect(22, 48, 4, 10);
  ctx.fillRect(38, 46, 4, 12);
  ctx.fillStyle = shade(PALETTE.crystal, 0.55);
  ctx.fillRect(22, 48, 1, 10);
  ctx.fillRect(38, 46, 1, 12);
  // Свечение вокруг обелиска.
  ctx.fillStyle = 'rgba(102,224,255,0.30)';
  ctx.fillRect(22, 18, 2, 30);
  ctx.fillRect(40, 22, 2, 26);
  ctx.fillRect(27, 12, 10, 2);
}

/** Прямоугольник-заливка, короткий хелпер для силуэтов. */
function R(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/**
 * Goblin 40×48: средний, зелёный, с копьём справа.
 * frame: 0 стоит, 1 шаг (сдвиг корпуса + смена ног).
 */
function drawGoblin(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const S = PALETTE.grass;
  const D = PALETTE.grassDark;
  // Ноги (шаг чередуется).
  if (frame === 0) {
    R(ctx, 15, 40 + oy, 4, 6, D);
    R(ctx, 22, 40 + oy, 4, 6, D);
  } else {
    R(ctx, 14, 40 + oy, 4, 6, D);
    R(ctx, 23, 38 + oy, 4, 8, D);
  }
  // Торс.
  R(ctx, 13, 24 + oy, 14, 16, S);
  R(ctx, 13, 24 + oy, 2, 16, D);
  R(ctx, 13, 37 + oy, 14, 3, D); // пояс
  // Руки.
  R(ctx, 10, 26 + oy, 3, 10, S);
  R(ctx, 27, 26 + oy + (frame === 1 ? -2 : 0), 3, 10, S);
  // Голова + уши.
  R(ctx, 14, 12 + oy, 12, 12, S);
  R(ctx, 8, 14 + oy, 6, 3, S);
  R(ctx, 26, 14 + oy, 6, 3, S);
  R(ctx, 8, 14 + oy, 6, 1, D);
  R(ctx, 26, 14 + oy, 6, 1, D);
  // Глаза.
  R(ctx, 17, 16 + oy, 2, 3, PALETTE.gold);
  R(ctx, 22, 16 + oy, 2, 3, PALETTE.gold);
  // Копьё справа.
  R(ctx, 32, 8 + oy, 2, 36, PALETTE.earth);
  R(ctx, 31, 4 + oy, 4, 5, PALETTE.stone);
  R(ctx, 31, 8 + oy, 4, 1, PALETTE.stoneDark);
}

/** Troll 56×52: широкий сутулый, земляная шкура, каменные наплечники. */
function drawTroll(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const lean = frame === 1 ? 2 : 0;
  const S = PALETTE.earth;
  const D = PALETTE.earthDark;
  // Ноги-тумбы.
  R(ctx, 16 + lean, 42 + oy, 8, 8, D);
  R(ctx, 32 - lean, 42 + oy, 8, 8, D);
  // Широкий торс.
  R(ctx, 10 + lean, 18 + oy, 36, 26, S);
  R(ctx, 10 + lean, 18 + oy, 3, 26, D);
  // Живот светлее.
  R(ctx, 20 + lean, 28 + oy, 16, 12, PALETTE.road);
  // Наплечники.
  R(ctx, 6 + lean, 16 + oy, 10, 8, PALETTE.stoneDark);
  R(ctx, 40 + lean, 16 + oy, 10, 8, PALETTE.stoneDark);
  R(ctx, 6 + lean, 16 + oy, 10, 2, PALETTE.stone);
  R(ctx, 40 + lean, 16 + oy, 10, 2, PALETTE.stone);
  // Лапы.
  R(ctx, 6 + lean, 24 + oy + (frame === 1 ? 2 : 0), 5, 16, S);
  R(ctx, 45 + lean, 24 + oy - (frame === 1 ? 2 : 0), 5, 16, S);
  // Маленькая голова сверху.
  R(ctx, 22 + lean, 8 + oy, 12, 10, S);
  R(ctx, 22 + lean, 8 + oy, 12, 2, D);
  // Надбровье + глаза.
  R(ctx, 23 + lean, 12 + oy, 10, 2, D);
  R(ctx, 24 + lean, 14 + oy, 2, 2, PALETTE.gold);
  R(ctx, 30 + lean, 14 + oy, 2, 2, PALETTE.gold);
  // Клыки.
  R(ctx, 25 + lean, 17 + oy, 2, 2, PALETTE.roadLight);
  R(ctx, 29 + lean, 17 + oy, 2, 2, PALETTE.roadLight);
}

/** Imp 32×40: мелкий колючий, тёмный, с хвостом. */
function drawImp(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const hop = frame === 1 ? -1 : 0;
  const S = PALETTE.stoneDark;
  const D = PALETTE.void;
  // Ножки.
  R(ctx, 11, 32 + oy, 3, 6, D);
  R(ctx, 18, 32 + oy, 3, 6, D);
  // Тельце.
  R(ctx, 10, 18 + oy, 12, 15, S);
  R(ctx, 10, 18 + oy, 2, 15, D);
  // Шипы на спине.
  R(ctx, 6, 20 + oy, 4, 2, D);
  R(ctx, 6, 25 + oy, 4, 2, D);
  R(ctx, 22, 20 + oy, 4, 2, D);
  R(ctx, 22, 25 + oy, 4, 2, D);
  // Шипы на голове.
  R(ctx, 12, 10 + oy + hop, 2, 6, D);
  R(ctx, 15, 8 + oy + hop, 2, 8, D);
  R(ctx, 18, 10 + oy + hop, 2, 6, D);
  // Голова.
  R(ctx, 11, 14 + oy + hop, 10, 8, S);
  // Глаза.
  R(ctx, 13, 16 + oy + hop, 2, 3, PALETTE.gold);
  R(ctx, 18, 16 + oy + hop, 2, 3, PALETTE.gold);
  // Хвост.
  R(ctx, 22, 30 + oy, 6, 2, D);
  R(ctx, 26, 28 + oy, 2, 4, D);
}

/** Снаряды 16×16. */
function drawProjArrow(ctx: CanvasRenderingContext2D): void {
  R(ctx, 2, 7, 9, 2, PALETTE.gold);
  R(ctx, 11, 6, 3, 4, PALETTE.gold);
  R(ctx, 14, 7, 2, 2, PALETTE.roadLight);
  R(ctx, 2, 9, 9, 1, shade(PALETTE.gold, 0.7));
}

function drawProjCannon(ctx: CanvasRenderingContext2D): void {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 6) continue;
      ctx.fillStyle = d > 4.5 ? PALETTE.stoneDark : PALETTE.void;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  R(ctx, 5, 4, 2, 2, PALETTE.cloud);
}

function drawProjIce(ctx: CanvasRenderingContext2D): void {
  for (let y = 0; y < 16; y++) {
    const half = 6 * (1 - Math.abs(y - 7.5) / 8);
    for (let x = Math.ceil(8 - half); x < 8 + half; x++) {
      ctx.fillStyle = PALETTE.crystal;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  R(ctx, 7, 4, 2, 8, PALETTE.cloud);
}

function buildTile(id: TileId): Texture {
  let cv: HTMLCanvasElement;
  switch (id) {
    case 'grass-a': {
      const [c, ctx] = makeCanvas(TILE_W, TILE_H);
      drawGrass(ctx, 11);
      cv = c;
      break;
    }
    case 'grass-b': {
      const [c, ctx] = makeCanvas(TILE_W, TILE_H);
      drawGrass(ctx, 77);
      cv = c;
      break;
    }
    case 'road-a': {
      const [c, ctx] = makeCanvas(TILE_W, TILE_H);
      drawRoad(ctx, 31);
      cv = c;
      break;
    }
    case 'road-b': {
      const [c, ctx] = makeCanvas(TILE_W, TILE_H);
      drawRoad(ctx, 57);
      cv = c;
      break;
    }
    case 'pedestal': {
      const [c, ctx] = makeCanvas(64, 44);
      drawPedestal(ctx);
      cv = c;
      break;
    }
    case 'skirt-tall': {
      const [c, ctx] = makeCanvas(64, 96);
      drawSkirt(ctx, 96, 5);
      cv = c;
      break;
    }
    case 'skirt-short': {
      const [c, ctx] = makeCanvas(64, 72);
      drawSkirt(ctx, 72, 21);
      cv = c;
      break;
    }
    case 'cloud-1': {
      const [c, ctx] = makeCanvas(96, 32);
      drawCloud(ctx, 96, 32, 3);
      cv = c;
      break;
    }
    case 'cloud-2': {
      const [c, ctx] = makeCanvas(128, 40);
      drawCloud(ctx, 128, 40, 9);
      cv = c;
      break;
    }
    case 'crystal': {
      const [c, ctx] = makeCanvas(48, 64);
      drawCrystal(ctx);
      cv = c;
      break;
    }
    case 'tower_arrow': {
      const [c, ctx] = makeCanvas(64, 88);
      drawTowerArrow(ctx);
      cv = c;
      break;
    }
    case 'tower_cannon': {
      const [c, ctx] = makeCanvas(64, 88);
      drawTowerCannon(ctx);
      cv = c;
      break;
    }
    case 'tower_ice': {
      const [c, ctx] = makeCanvas(64, 88);
      drawTowerIce(ctx);
      cv = c;
      break;
    }
    case 'enemy_goblin_f0': {
      const [c, ctx] = makeCanvas(40, 48);
      drawGoblin(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_goblin_f1': {
      const [c, ctx] = makeCanvas(40, 48);
      drawGoblin(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_troll_f0': {
      const [c, ctx] = makeCanvas(56, 52);
      drawTroll(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_troll_f1': {
      const [c, ctx] = makeCanvas(56, 52);
      drawTroll(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_imp_f0': {
      const [c, ctx] = makeCanvas(32, 40);
      drawImp(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_imp_f1': {
      const [c, ctx] = makeCanvas(32, 40);
      drawImp(ctx, 1);
      cv = c;
      break;
    }
    case 'proj_arrow': {
      const [c, ctx] = makeCanvas(16, 16);
      drawProjArrow(ctx);
      cv = c;
      break;
    }
    case 'proj_cannon': {
      const [c, ctx] = makeCanvas(16, 16);
      drawProjCannon(ctx);
      cv = c;
      break;
    }
    case 'proj_ice': {
      const [c, ctx] = makeCanvas(16, 16);
      drawProjIce(ctx);
      cv = c;
      break;
    }
    case 'void-bg': {
      const [c, ctx] = makeCanvas(144, 256);
      drawVoid(ctx, 144, 256);
      cv = c;
      break;
    }
  }
  return toTexture(cv);
}

/**
 * Единая точка доступа к тайлам. Кэширует текстуры по id.
 * Замена на PNG-атлас: вернуть регион атласа по тому же id.
 */
export function getTile(id: TileId): Texture {
  const hit = cache.get(id);
  if (hit) return hit;
  const tex = buildTile(id);
  cache.set(id, tex);
  return tex;
}

/**
 * Клетки дороги вдоль пути: идём по сегментам мелким шагом,
 * округляем в клетки. Чистая функция — покрыта тестом.
 */
export function getRoadKeys(points: Array<{ gx: number; gy: number }>): Set<string> {
  const keys = new Set<string>();
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dist = Math.hypot(b.gx - a.gx, b.gy - a.gy);
    const steps = Math.max(1, Math.ceil(dist * 4));
    for (let s = 0; s <= steps; s++) {
      const gx = Math.round(a.gx + ((b.gx - a.gx) * s) / steps);
      const gy = Math.round(a.gy + ((b.gy - a.gy) * s) / steps);
      keys.add(`${gx},${gy}`);
    }
  }
  return keys;
}
