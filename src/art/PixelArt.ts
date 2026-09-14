import { CanvasSource, Sprite, Texture } from 'pixi.js';

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

/**
 * Тёмная палитра земли (канон #05, dark-engine-lite).
 * Базальт + циановые швы + рунические постаменты.
 * Палитра сущностей (PALETTE) не тронута — спрайты перепишут следующим каноном.
 */
export const DARK_PALETTE = {
  ground: '#17181d',
  ground_light: '#23252c',
  road: '#3a3c44',
  road_seam: '#35e0ff',
  pedestal: '#2e3038',
  skirt_top: '#1e2028',
  skirt_mid: '#141620',
  skirt_bottom: '#0c0e14',
  moss: '#4a5b3a',
  moss_light: '#6a7a4a',
  cloud: '#1a1c24',
  bgTop: '#0c0e14',
  bgBottom: '#000000',
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
  | 'crystal_f0'
  | 'crystal_f1'
  | 'tower_arrow'
  | 'tower_cannon'
  | 'tower_ice'
  | 'enemy_goblin_f0'
  | 'enemy_goblin_f1'
  | 'enemy_troll_f0'
  | 'enemy_troll_f1'
  | 'enemy_imp_f0'
  | 'enemy_imp_f1'
  | 'enemy_spore_f0'
  | 'enemy_spore_f1'
  | 'enemy_puffling_f0'
  | 'enemy_puffling_f1'
  | 'enemy_truffle_f0'
  | 'enemy_truffle_f1'
  | 'enemy_jelly_f0'
  | 'enemy_jelly_f1'
  | 'enemy_jellymini_f0'
  | 'enemy_jellymini_f1'
  | 'enemy_caramel_f0'
  | 'enemy_caramel_f1'
  | 'enemy_chocgolem_f0'
  | 'enemy_chocgolem_f1'
  | 'enemy_candyfairy_f0'
  | 'enemy_candyfairy_f1'
  | 'enemy_balloon_f0'
  | 'enemy_balloon_f1'
  | 'enemy_cloudsheep_f0'
  | 'enemy_cloudsheep_f1'
  | 'enemy_stormling_f0'
  | 'enemy_stormling_f1'
  | 'enemy_fluffdragon_f0'
  | 'enemy_fluffdragon_f1'
  | 'enemy_clownfish_f0'
  | 'enemy_clownfish_f1'
  | 'enemy_jellyfish_f0'
  | 'enemy_jellyfish_f1'
  | 'enemy_seahorse_f0'
  | 'enemy_seahorse_f1'
  | 'enemy_pearlwhale_f0'
  | 'enemy_pearlwhale_f1'
  | 'enemy_clown_f0'
  | 'enemy_clown_f1'
  | 'enemy_juggler_f0'
  | 'enemy_juggler_f1'
  | 'enemy_magician_f0'
  | 'enemy_magician_f1'
  | 'enemy_elephant_f0'
  | 'enemy_elephant_f1'
  | 'tower_arrow_t2'
  | 'tower_arrow_t3'
  | 'tower_cannon_t2'
  | 'tower_cannon_t3'
  | 'tower_ice_t2'
  | 'tower_ice_t3'
  | 'fx_spore_cloud'
  | 'fx_wind_arrow'
  | 'fx_bubble'
  | 'proj_arrow'
  | 'proj_cannon'
  | 'proj_ice'
  | 'void-bg';

export const TILE_W = 64;
export const TILE_H = 32;

const cache = new Map<string, Texture>();

/**
 * Тёмный режим земли (канон #05). По умолчанию true: getTile для тайлов
 * земли/дороги/постаментов/юбки/фона/облаков рисует из DARK_PALETTE.
 * Спрайты сущностей не затронуты. Переключение сбрасывает кэш текстур.
 */
export let darkMode = true;

export function setDarkMode(v: boolean): void {
  if (darkMode === v) return;
  darkMode = v;
  cache.clear();
}

/** Линейная интерполяция двух hex-цветов: k=0 → a, k=1 → b. */
function lerpHex(a: string, b: string, k: number): string {
  const [r0, g0, b0] = hexToRgb(a);
  const [r1, g1, b1] = hexToRgb(b);
  const t = Math.max(0, Math.min(1, k));
  return css([
    Math.round(r0 + (r1 - r0) * t),
    Math.round(g0 + (g1 - g0) * t),
    Math.round(b0 + (b1 - b0) * t),
  ]);
}

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

function drawGrass(ctx: CanvasRenderingContext2D, seed: number, dark = false): void {
  if (dark) {
    // Базальтовая земля: тёмная база + светлый крап.
    fillDiamond(ctx, DARK_PALETTE.ground, seed, DARK_PALETTE.ground_light, 8);
    return;
  }
  fillDiamond(ctx, PALETTE.grass, seed, PALETTE.grassDark, 8);
}

function drawRoad(ctx: CanvasRenderingContext2D, seed: number, dark = false): void {
  if (dark) {
    // Тёмная брусчатка с тонкими циановыми швами между камнями.
    fillDiamond(ctx, DARK_PALETTE.road, seed, DARK_PALETTE.ground, 5);
    const rnd = mulberry32(seed + 999);
    // Швы: 3 ломаные горизонтальные линии поперёк ромба.
    ctx.fillStyle = DARK_PALETTE.road_seam;
    for (let row = 0; row < 3; row++) {
      const y = 9 + row * 7 + Math.floor(rnd() * 3);
      const half = 32 - Math.abs(y - 15.5) * 2;
      for (let x = Math.ceil(32 - half) + 3; x < 32 + half - 3; x += 4) {
        ctx.fillRect(x, y, 2, 1);
      }
    }
    // Вертикальные короткие швы-стыки.
    for (let i = 0; i < 6; i++) {
      const x = 16 + Math.floor(rnd() * 32);
      const y = 8 + Math.floor(rnd() * 16);
      const half = 32 - Math.abs(y - 15.5) * 2;
      if (Math.abs(x - 32) < half - 4) ctx.fillRect(x, y, 1, 3);
    }
    // Светлые камешки брусчатки.
    ctx.fillStyle = DARK_PALETTE.ground_light;
    for (let i = 0; i < 6; i++) {
      const x = 16 + Math.floor(rnd() * 32);
      const y = 10 + Math.floor(rnd() * 12);
      const half = 32 - Math.abs(y - 15.5) * 2;
      if (Math.abs(x - 32) < half - 3) ctx.fillRect(x, y, 2, 1);
    }
    return;
  }
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
function drawPedestal(ctx: CanvasRenderingContext2D, dark = false): void {
  const face = dark ? shade(DARK_PALETTE.pedestal, 0.7) : PALETTE.stoneDark;
  const top = dark ? DARK_PALETTE.pedestal : PALETTE.stone;
  // Лобовая грань (толщина плиты).
  ctx.fillStyle = face;
  for (let y = 24; y < 38; y++) {
    const half = 28 - (y - 24) * 1.6;
    for (let x = Math.ceil(32 - half); x < 32 + half; x++) ctx.fillRect(x, y, 1, 1);
  }
  ctx.fillStyle = shade(face, 0.7);
  ctx.fillRect(8, 37, 48, 2);
  // Верхняя плита.
  for (let y = 0; y < 28; y++) {
    const half = 30 - Math.abs(y - 14) * 2.1;
    for (let x = Math.ceil(32 - half); x < 32 + half; x++) {
      ctx.fillStyle = top;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Тёмный контур плиты.
  ctx.fillStyle = dark ? shade(DARK_PALETTE.pedestal, 0.6) : PALETTE.stoneDark;
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
  ctx.fillStyle = dark ? shade(DARK_PALETTE.pedestal, 1.3) : shade(PALETTE.stone, 0.82);
  for (let y = 7; y < 21; y++) {
    const half = 13 - Math.abs(y - 14) * 0.95;
    for (let x = Math.ceil(32 - half); x < 32 + half; x++) ctx.fillRect(x, y, 1, 1);
  }
  if (dark) {
    // Циановый рунический круг: серия точек по окружности (каждая 6-я — руна пошире).
    ctx.fillStyle = DARK_PALETTE.road_seam;
    const cx = 32;
    const cy = 14;
    const r = 10;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * r * 1.9);
      const y = Math.round(cy + Math.sin(a) * r * 0.55);
      ctx.fillRect(x, y, i % 6 === 0 ? 2 : 1, 1);
    }
  }
}

/** Юбка острова: сверху ромб травы, ниже столб земли с камнями и рваный низ. */
function drawSkirt(ctx: CanvasRenderingContext2D, h: number, seed: number, dark = false): void {
  if (dark) {
    // Тёмная юбка: базальтовый верх, градиент к почти-чёрному низу.
    // Мох — только на верхней кромке, нижние ряды без мха.
    const tmp = document.createElement('canvas');
    tmp.width = TILE_W;
    tmp.height = TILE_H;
    const tctx = tmp.getContext('2d')!;
    tctx.imageSmoothingEnabled = false;
    fillDiamond(tctx, DARK_PALETTE.ground, seed, DARK_PALETTE.ground_light, 6);
    ctx.drawImage(tmp, 0, 0);
    const rnd = mulberry32(seed + 7);
    // Мох на верхней кромке столба.
    ctx.fillStyle = DARK_PALETTE.moss;
    for (let i = 0; i < 10; i++) {
      const x = 12 + Math.floor(rnd() * 40);
      const y = 24 + Math.floor(rnd() * 5);
      ctx.fillRect(x, y, 2, 1);
    }
    ctx.fillStyle = DARK_PALETTE.moss_light;
    for (let i = 0; i < 5; i++) {
      const x = 14 + Math.floor(rnd() * 36);
      const y = 24 + Math.floor(rnd() * 3);
      ctx.fillRect(x, y, 1, 1);
    }
    // Столб: градиент skirt_top -> skirt_bottom.
    for (let y = 24; y < h - 6; y++) {
      const taper = Math.max(10, 26 - (y - 24) * 0.12);
      const k = (y - 24) / Math.max(1, h - 30);
      ctx.fillStyle = lerpHex(DARK_PALETTE.skirt_top, DARK_PALETTE.skirt_bottom, k);
      for (let x = Math.ceil(32 - taper); x < 32 + taper; x++) ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = shade(DARK_PALETTE.skirt_top, 0.6);
      ctx.fillRect(Math.ceil(32 - taper), y, 2, 1);
      ctx.fillRect(Math.floor(32 + taper) - 2, y, 2, 1);
    }
    // Рваный нижний край.
    ctx.fillStyle = DARK_PALETTE.skirt_bottom;
    for (let x = 6; x < 58; x += 2) {
      const teeth = 3 + Math.floor(rnd() * 5);
      for (let y = h - 6; y < h - 6 + teeth && y < h; y++) ctx.fillRect(x, y, 1, 1);
    }
    return;
  }
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
function drawCloud(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: number,
  base: string = PALETTE.cloud,
): void {
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
      ctx.fillStyle = top ? shade(base, 1.12) : base;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/**
 * Кристалл 48×64: ромб с внутренней гранью и слабым glow.
 * frame: 1 — яркое ядро пульсации (#7ff4ff), 0 — спокойное (#35e0ff).
 */
function drawCrystal(ctx: CanvasRenderingContext2D, frame: number): void {
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  const core = frame === 1 ? '#7ff4ff' : C;
  const shard = (x0: number, w0: number, h0: number, lean: number): void => {
    const yBase = 58;
    for (let y = 0; y < h0; y++) {
      const k = y / h0;
      const half = (w0 / 2) * k;
      const cx = x0 + lean * (1 - k);
      for (let x = Math.ceil(cx - half); x < cx + half; x++) {
        ctx.fillStyle = core;
        ctx.fillRect(x, yBase - y, 1, 1);
      }
      ctx.fillStyle = shade(core, 0.55);
      ctx.fillRect(Math.ceil(cx - half), yBase - y, 1, 1);
      if (k > 0.4) {
        ctx.fillStyle = W;
        ctx.fillRect(Math.ceil(cx - half) + 1, yBase - y, 1, 1);
      }
    }
  };
  shard(24, 16, 50, 0);
  shard(12, 10, 30, -3);
  shard(36, 10, 36, 3);
  // Тёмный постамент и слабый glow вокруг основания.
  R(ctx, 8, 58, 32, 4, K);
  R(ctx, 8, 58, 32, 1, W);
  R(ctx, 4, 56, 4, 1, C);
  R(ctx, 40, 56, 4, 1, C);
}

/** Тёмный фон: градиент от #0c0e14 (верх) до #000000 (низ). */
function drawVoidDark(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const [r0, g0, b0] = hexToRgb(DARK_PALETTE.bgTop);
  const [r1, g1, b1] = hexToRgb(DARK_PALETTE.bgBottom);
  for (let y = 0; y < h; y++) {
    const k = y / Math.max(1, h - 1);
    ctx.fillStyle = css([
      Math.round(r0 + (r1 - r0) * k),
      Math.round(g0 + (g1 - g0) * k),
      Math.round(b0 + (b1 - b0) * k),
    ]);
    ctx.fillRect(0, y, w, 1);
  }
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

/** Общее основание башни 64×88: тёмная каменная платформа, низ — y 64..88. */
function drawTowerBase(ctx: CanvasRenderingContext2D): void {
  const F = DARK_PALETTE.pedestal;
  const C = DARK_PALETTE.road_seam;
  for (let y = 64; y < 82; y++) {
    const half = 27 - (y - 64) * 0.7;
    for (let x = Math.ceil(32 - half); x < 32 + half; x++) {
      ctx.fillStyle = F;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = shade(F, 0.6);
    ctx.fillRect(Math.ceil(32 - half), y, 1, 1);
    ctx.fillRect(Math.floor(32 + half) - 1, y, 1, 1);
  }
  ctx.fillStyle = shade(F, 0.5);
  ctx.fillRect(8, 82, 48, 3);
  // Рунический шов фундамента.
  ctx.fillStyle = C;
  ctx.fillRect(14, 65, 36, 1);
}

/**
 * Arrow: каменный пилон с руническим поясом t1.
 * Рост по тайрам — в drawTowerTierExtra.
 */
function drawTowerArrow(ctx: CanvasRenderingContext2D): void {
  drawTowerBase(ctx);
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Каменный пилон.
  for (let y = 30; y < 64; y++) {
    const half = 9 - (y - 30) * 0.1;
    for (let x = Math.ceil(32 - half); x < 32 + half; x++) {
      ctx.fillStyle = S;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = K;
    ctx.fillRect(Math.ceil(32 - half), y, 1, 1);
  }
  // Рим-лайт слева.
  R(ctx, 26, 32, 1, 28, W);
  // Крап камня.
  R(ctx, 28, 36, 2, 2, L);
  R(ctx, 33, 52, 2, 1, K);
  // Рунический пояс t1: тонкая линия + две руны.
  R(ctx, 25, 44, 13, 1, C);
  R(ctx, 28, 42, 2, 2, C);
  R(ctx, 34, 46, 2, 2, C);
  // Площадка.
  R(ctx, 20, 28, 24, 4, S);
  R(ctx, 20, 28, 24, 1, W);
  // Мачта-пика с руной-наконечником.
  R(ctx, 31, 10, 2, 18, K);
  R(ctx, 30, 8, 4, 3, C);
}

/**
 * Cannon: каменная тумба со стволом и циановым прицелом t1.
 * Рост по тайрам — в drawTowerTierExtra.
 */
function drawTowerCannon(ctx: CanvasRenderingContext2D): void {
  drawTowerBase(ctx);
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Тумба-трапеция.
  for (let y = 34; y < 64; y++) {
    const half = 13 - (y - 34) * 0.15;
    for (let x = Math.ceil(32 - half); x < 32 + half; x++) {
      ctx.fillStyle = S;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = K;
    ctx.fillRect(Math.ceil(32 - half), y, 1, 1);
  }
  // Рим-лайт слева.
  R(ctx, 21, 36, 1, 8, W);
  // Крап камня.
  R(ctx, 25, 44, 2, 2, L);
  R(ctx, 34, 54, 2, 1, K);
  // Верхний ободок.
  R(ctx, 20, 31, 24, 3, S);
  R(ctx, 20, 31, 24, 1, W);
  // Циановый прицел t1.
  R(ctx, 28, 40, 4, 4, C);
  R(ctx, 29, 41, 2, 2, W);
  // Ствол вверх-вправо.
  for (let i = 0; i < 16; i++) {
    const x = 32 + Math.floor(i * 0.8);
    const y = 36 - Math.floor(i * 0.9);
    R(ctx, x - 2, y - 2, 5, 5, K);
  }
  // Дуло с циановым кольцом.
  R(ctx, 42, 18, 6, 6, K);
  R(ctx, 41, 17, 8, 1, C);
  R(ctx, 41, 24, 8, 1, C);
  R(ctx, 41, 17, 1, 8, C);
  R(ctx, 48, 17, 1, 8, C);
}

/**
 * Ice: кристаллический обелиск t1 — циановое тело в каменном ложе.
 * Рост по тайрам — в drawTowerTierExtra.
 */
function drawTowerIce(ctx: CanvasRenderingContext2D): void {
  drawTowerBase(ctx);
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Каменное ложе.
  R(ctx, 22, 56, 20, 8, K);
  R(ctx, 22, 56, 20, 1, W);
  // Крап камня на ложе.
  R(ctx, 25, 59, 2, 2, L);
  R(ctx, 36, 60, 2, 1, K);
  // Центральный обелиск.
  for (let y = 0; y < 42; y++) {
    const k = y / 42;
    const half = 6 * (1 - k) + 1;
    const yy = 56 - y;
    for (let x = Math.ceil(32 - half); x < 32 + half; x++) {
      ctx.fillStyle = C;
      ctx.fillRect(x, yy, 1, 1);
    }
    ctx.fillStyle = shade(C, 0.55);
    ctx.fillRect(Math.ceil(32 - half), yy, 1, 1);
    if (k > 0.35 && k < 0.8) {
      ctx.fillStyle = W;
      ctx.fillRect(Math.ceil(32 - half) + 1, yy, 1, 2);
    }
  }
  // Боковые осколки.
  R(ctx, 22, 48, 4, 10, C);
  R(ctx, 38, 46, 4, 12, C);
  R(ctx, 22, 48, 1, 10, K);
  R(ctx, 38, 46, 1, 12, K);
  // Слабое свечение по бокам.
  R(ctx, 19, 22, 1, 26, C);
  R(ctx, 44, 26, 1, 22, C);
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
 * Goblin-истукан 40×48: широкий сутулый силуэт с копьём.
 * frame: 1 — наклон корпуса и смена рук.
 */
function drawGoblin(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const lean = frame === 1 ? 1 : 0;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Копьё справа.
  R(ctx, 33, 6 + oy, 2, 38, L);
  R(ctx, 32, 2 + oy, 4, 5, W);
  // Ноги.
  R(ctx, 12 + lean, 40 + oy, 5, 6, K);
  R(ctx, 22 - lean, 40 + oy, 5, 6, K);
  // Широкий сутулый торс.
  R(ctx, 9 + lean, 22 + oy, 22, 19, S);
  // Рим-лайт слева.
  R(ctx, 9 + lean, 24 + oy, 1, 15, W);
  // Крап камня.
  R(ctx, 15 + lean, 28 + oy, 2, 2, L);
  R(ctx, 23 + lean, 33 + oy, 2, 1, L);
  R(ctx, 19 + lean, 36 + oy, 2, 1, K);
  // Сутулая голова.
  R(ctx, 12 + lean, 12 + oy, 15, 11, S);
  R(ctx, 12 + lean, 12 + oy, 15, 1, W);
  // Циановые прорехи-трещины вместо глаз.
  R(ctx, 15 + lean, 16 + oy, 3, 2, C);
  R(ctx, 21 + lean, 16 + oy, 3, 2, C);
  R(ctx, 18 + lean, 19 + oy + (frame === 1 ? 1 : 0), 2, 3, C);
  // Руки.
  R(ctx, 6 + lean, 26 + oy, 3, 10, S);
  R(ctx, 31 + lean, 26 + oy - (frame === 1 ? 2 : 0), 3, 10, S);
}

/**
 * Troll-горгулья 56×52: сутулая туша с крыльями-обрубками.
 * frame: 1 — наклон и взмах лап.
 */
function drawTroll(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const lean = frame === 1 ? 2 : 0;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Крылья-обрубки.
  R(ctx, 2 + lean, 14 + oy, 8, 12, S);
  R(ctx, 44 + lean, 14 + oy, 8, 12, S);
  R(ctx, 2 + lean, 14 + oy, 1, 12, W);
  R(ctx, 4 + lean, 17 + oy, 2, 3, C);
  R(ctx, 48 + lean, 19 + oy, 2, 3, C);
  // Ноги-тумбы.
  R(ctx, 16 + lean, 42 + oy, 9, 8, K);
  R(ctx, 31 - lean, 42 + oy, 9, 8, K);
  // Широкая сутулая туша.
  R(ctx, 10 + lean, 16 + oy, 36, 27, S);
  // Рим-лайт слева.
  R(ctx, 10 + lean, 18 + oy, 1, 23, W);
  // Крап камня.
  R(ctx, 18 + lean, 24 + oy, 3, 2, L);
  R(ctx, 32 + lean, 32 + oy, 3, 2, L);
  R(ctx, 24 + lean, 38 + oy, 4, 1, K);
  // Вдавленная голова.
  R(ctx, 22 + lean, 8 + oy, 12, 9, S);
  // Трещины вместо глаз, светлый клык.
  R(ctx, 24 + lean, 11 + oy, 3, 2, C);
  R(ctx, 29 + lean, 11 + oy, 3, 2, C);
  R(ctx, 26 + lean, 14 + oy + (frame === 1 ? 1 : 0), 4, 1, W);
  // Лапы.
  R(ctx, 6 + lean, 26 + oy + (frame === 1 ? 2 : 0), 5, 15, S);
  R(ctx, 45 + lean, 26 + oy - (frame === 1 ? 2 : 0), 5, 15, S);
}
/**
 * Imp-ползун 32×40: низкий длинный овал с гримасой.
 * frame: 1 — приподнят, гримаса шире.
 */
function drawImp(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Низкий длинный овал.
  for (let y = 0; y < 14; y++) {
    const half = 12 * Math.sin((Math.PI * (y + 1)) / 15);
    for (let x = Math.ceil(16 - half); x < 16 + half; x++) {
      ctx.fillStyle = S;
      ctx.fillRect(x, y + 18 + oy, 1, 1);
    }
  }
  // Рим-лайт сверху.
  R(ctx, 10, 20 + oy, 12, 1, W);
  // Крап камня.
  R(ctx, 12, 25 + oy, 2, 1, L);
  R(ctx, 19, 28 + oy, 2, 1, L);
  R(ctx, 15, 30 + oy, 2, 1, K);
  // Ножки-ползуны.
  R(ctx, 10, 30 + oy, 5, 3, K);
  R(ctx, 17, 30 + oy, 5, 3, K);
  // Гримаса: циановые прорехи.
  R(ctx, 9, 22 + oy, 3, 2, C);
  R(ctx, 20, 22 + oy, 3, 2, C);
  R(ctx, 12, 27 + oy, 8 + (frame === 1 ? 2 : 0), 1, C);
  // Шипы на спине.
  R(ctx, 12, 16 + oy, 2, 3, S);
  R(ctx, 17, 15 + oy, 2, 4, S);
  R(ctx, 22, 16 + oy, 2, 3, S);
}

/** Снаряды 16×16, тёмная доктрина. */
function drawProjArrow(ctx: CanvasRenderingContext2D): void {
  // Циановая стрела: древко из двух линий + голова.
  R(ctx, 1, 7, 10, 2, DARK_PALETTE.road_seam);
  R(ctx, 11, 5, 3, 6, DARK_PALETTE.road_seam);
  R(ctx, 13, 7, 1, 2, '#b9bdc4');
}

function drawProjCannon(ctx: CanvasRenderingContext2D): void {
  // Тёплое ядро с хвостом.
  R(ctx, 0, 7, 4, 2, '#7a3c14');
  R(ctx, 3, 6, 4, 4, '#c25e1e');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 9.5, y - 7.5);
      if (d > 5) continue;
      ctx.fillStyle = d > 2.5 ? '#ff9a3c' : '#ffd75e';
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawProjIce(ctx: CanvasRenderingContext2D): void {
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Циановый осколок.
  for (let y = 0; y < 16; y++) {
    const half = 5 * (1 - Math.abs(y - 7.5) / 8);
    for (let x = Math.ceil(8 - half); x < 8 + half; x++) {
      ctx.fillStyle = C;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Шипы по бокам и светлая сердцевина.
  R(ctx, 0, 5, 3, 1, C);
  R(ctx, 13, 5, 3, 1, C);
  R(ctx, 0, 10, 3, 1, C);
  R(ctx, 13, 10, 3, 1, C);
  R(ctx, 7, 3, 2, 10, W);
}

/**
 * Spore-призрак 32×40: круглое облако с лицом.
 * frame: 1 — облако выше, хвост длиннее.
 */
function drawSpore(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Круглое облако.
  for (let y = 0; y < 24; y++) {
    const half = 11 * Math.sin((Math.PI * (y + 1)) / 25);
    for (let x = Math.ceil(16 - half); x < 16 + half; x++) {
      ctx.fillStyle = S;
      ctx.fillRect(x, y + 8 + oy, 1, 1);
    }
  }
  // Рим-лайт сверху.
  R(ctx, 16, 12 + oy, 5, 1, W);
  // Крап камня.
  R(ctx, 12, 18 + oy, 2, 1, L);
  R(ctx, 19, 25 + oy, 2, 1, L);
  R(ctx, 15, 28 + oy, 2, 1, K);
  // Лицо: циановые прорехи и рот-трещина.
  R(ctx, 11, 16 + oy, 3, 4, C);
  R(ctx, 18, 16 + oy, 3, 4, C);
  R(ctx, 14, 23 + oy, 4, 1, C);
  // Хвост-призрак снизу.
  R(ctx, 10, 32 + oy, 4, 5, S);
  R(ctx, 18, 32 + oy, 4, 5 + (frame === 1 ? 2 : 0), S);
}
/**
 * Puffling-масса 44×44: бесформенный комок с отростками.
 * frame: 1 — комок шире и ниже.
 */
function drawPuffling(ctx: CanvasRenderingContext2D, frame: number): void {
  const cx = 22;
  const cy = frame === 1 ? 26 : 24;
  const rx = frame === 1 ? 19 : 17;
  const ry = frame === 1 ? 14 : 16;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Отростки.
  R(ctx, cx - 23, cy - 6, 6, 3, S);
  R(ctx, cx + 17, cy - 8, 6, 3, S);
  R(ctx, cx - 5, cy - ry - 4, 3, 5, S);
  R(ctx, cx - 12, cy + ry - 2, 4, 4, S);
  // Бесформенный комок.
  for (let y = 0; y < 44; y++) {
    for (let x = 0; x < 44; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      if (d > 0.82 && ((x * 7 + y * 13) % 5 === 0)) continue;
      ctx.fillStyle = d > 0.86 ? K : S;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Рим-лайт сверху.
  R(ctx, cx - 8, cy - ry + 2, 10, 1, W);
  // Крап камня.
  R(ctx, cx - 11, cy - 2, 2, 2, L);
  R(ctx, cx + 6, cy + 4, 2, 1, L);
  R(ctx, cx - 2, cy + 7, 3, 1, K);
  // Циановые трещины.
  R(ctx, cx - 9, cy - 3, 4, 2, C);
  R(ctx, cx + 3, cy + 1 + (frame === 1 ? 1 : -1), 5, 1, C);
  R(ctx, cx, cy - 7, 2, 3, C);
}

/**
 * Truffle-панцирный 52×52: шар с бронёй-чешуёй.
 * frame: 1 — наклон панциря.
 */
function drawTruffle(ctx: CanvasRenderingContext2D, frame: number): void {
  const lean = frame === 1 ? 2 : 0;
  const cx = 26 + lean;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Ножки.
  R(ctx, cx - 10, 38, 6, 8, K);
  R(ctx, cx + 4, 38, 6, 8, K);
  // Шар-панцирь.
  for (let y = 0; y < 30; y++) {
    const half = 20 * Math.sin((Math.PI * (y + 1)) / 31);
    for (let x = Math.ceil(cx - half); x < cx + half; x++) {
      ctx.fillStyle = S;
      ctx.fillRect(x, y + 8, 1, 1);
    }
  }
  // Чешуя: тёмные ряды.
  for (let r = 0; r < 4; r++) {
    R(ctx, cx - 14 + (r % 2) * 4, 14 + r * 5, 9, 1, K);
    R(ctx, cx + 1 - (r % 2) * 4, 14 + r * 5, 9, 1, K);
  }
  // Рим-лайт слева.
  R(ctx, cx - 15, 16, 1, 12, W);
  // Крап камня.
  R(ctx, cx - 8, 22, 2, 2, L);
  R(ctx, cx + 7, 30, 2, 1, L);
  // Циановые трещины панциря.
  R(ctx, cx - 4, 18, 2, 8, C);
  R(ctx, cx + 2, 26 + (frame === 1 ? 2 : 0), 6, 2, C);
}

/**
 * Jelly-осколок 40×44: ромбовидный силуэт с трещиной.
 * frame: 1 — шире и ниже (wobble).
 */
function drawJelly(ctx: CanvasRenderingContext2D, frame: number): void {
  const w = frame === 1 ? 32 : 28;
  const h = frame === 1 ? 30 : 34;
  const x0 = 20 - w / 2;
  const y0 = 40 - h;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Ромб.
  for (let y = 0; y < h; y++) {
    const half = (w / 2) * (1 - Math.abs((2 * y) / h - 1));
    const rowW = Math.max(1, Math.floor(half * 2));
    const rowX = Math.round(x0 + w / 2 - half);
    for (let x = 0; x < rowW; x++) {
      ctx.fillStyle = S;
      ctx.fillRect(rowX + x, y0 + y, 1, 1);
    }
  }
  // Рим-лайт на левой грани.
  R(ctx, x0 + 7, y0 + 10, 1, 10, W);
  // Крап камня.
  R(ctx, x0 + 9, y0 + 8, 2, 2, L);
  R(ctx, x0 + 16, y0 + 20, 2, 1, K);
  // Циановая трещина зигзагом.
  for (let i = 0; i < 7; i++) {
    R(ctx, x0 + w / 2 + (i % 2 === 0 ? -1 : 1), y0 + 6 + i * 3, 2, 3, C);
  }
}

/**
 * Jellymini-осколок 24×28: малая копия jelly.
 * frame: 1 — шире и ниже (wobble).
 */
function drawJellymini(ctx: CanvasRenderingContext2D, frame: number): void {
  const w = frame === 1 ? 19 : 17;
  const h = frame === 1 ? 18 : 20;
  const x0 = 12 - w / 2;
  const y0 = 26 - h;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Ромб.
  for (let y = 0; y < h; y++) {
    const half = (w / 2) * (1 - Math.abs((2 * y) / h - 1));
    const rowW = Math.max(1, Math.floor(half * 2));
    const rowX = Math.round(x0 + w / 2 - half);
    for (let x = 0; x < rowW; x++) {
      ctx.fillStyle = S;
      ctx.fillRect(rowX + x, y0 + y, 1, 1);
    }
  }
  // Рим-лайт и трещина.
  R(ctx, x0 + 4, y0 + 7, 1, 6, W);
  R(ctx, x0 + 6, y0 + 6, 2, 2, L);
  for (let i = 0; i < 4; i++) {
    R(ctx, x0 + w / 2 + (i % 2 === 0 ? -1 : 0), y0 + 4 + i * 3, 2, 3, C);
  }
}

/**
 * Caramel-смоляной 36×44: куб с каплями.
 * frame: 1 — капли длиннее.
 */
function drawCaramel(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Куб.
  R(ctx, 9, 12 + oy, 18, 22, S);
  // Рим-лайт сверху и слева.
  R(ctx, 9, 12 + oy, 18, 1, W);
  R(ctx, 9, 12 + oy, 1, 22, W);
  // Тёмная грань справа.
  R(ctx, 25, 12 + oy, 2, 22, K);
  // Крап камня.
  R(ctx, 14, 18 + oy, 2, 2, L);
  R(ctx, 20, 26 + oy, 2, 1, L);
  // Капли смолы снизу.
  R(ctx, 12, 34 + oy, 3, 4, S);
  R(ctx, 21, 34 + oy, 3, 6 + (frame === 1 ? 2 : 0), S);
  R(ctx, 17, 34 + oy, 2, 3, S);
  // Циановые трещины.
  R(ctx, 13, 18 + oy, 2, 6, C);
  R(ctx, 19, 24 + oy + (frame === 1 ? 1 : 0), 5, 2, C);
}

/**
 * Chocgolem-жилковый 56×56: крупный силуэт, кровавая жила через тело.
 * frame: 1 — наклон и смена кулаков.
 */
function drawChocgolem(ctx: CanvasRenderingContext2D, frame: number): void {
  const lean = frame === 1 ? 2 : 0;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  const BLOOD = '#8a2f34';
  // Ноги.
  R(ctx, 16 + lean, 44, 8, 10, K);
  R(ctx, 32 - lean, 44, 8, 10, K);
  // Глыба-торс.
  R(ctx, 12 + lean, 16, 32, 30, S);
  // Рим-лайт слева и сверху.
  R(ctx, 12 + lean, 16, 1, 30, W);
  R(ctx, 12 + lean, 16, 32, 1, W);
  // Крап камня.
  R(ctx, 17 + lean, 22, 3, 2, L);
  R(ctx, 35 + lean, 34, 3, 2, L);
  R(ctx, 24 + lean, 40, 4, 1, K);
  // Кровавая жила через тело.
  R(ctx, 26 + lean, 16, 3, 28, BLOOD);
  R(ctx, 20 + lean, 30, 16, 3, BLOOD);
  // Циановые трещины рядом с жилой.
  R(ctx, 31 + lean, 20, 2, 8, C);
  R(ctx, 22 + lean, 34 + (frame === 1 ? 2 : 0), 5, 2, C);
  // Кулаки.
  R(ctx, 4 + lean, 30 + (frame === 1 ? 3 : 0), 9, 10, S);
  R(ctx, 43 + lean, 30 - (frame === 1 ? 3 : 0), 9, 10, S);
  R(ctx, 4 + lean, 30 + (frame === 1 ? 3 : 0), 9, 1, W);
  R(ctx, 43 + lean, 30 - (frame === 1 ? 3 : 0), 9, 1, W);
  // Надбровье и глаза-щёлки.
  R(ctx, 20 + lean, 22, 16, 3, K);
  R(ctx, 22 + lean, 25, 3, 2, C);
  R(ctx, 31 + lean, 25, 3, 2, C);
}

/**
 * Candyfairy-мраморная оса 32×44: крылья как светящиеся прорехи в камне.
 * frame: 1 — крылья выше, тельце приподнято.
 */
function drawCandyfairy(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const wy = (frame === 1 ? 10 : 16) + oy;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Крылья-прорехи в камне.
  R(ctx, 1, wy, 10, 2, C);
  R(ctx, 21, wy, 10, 2, C);
  R(ctx, 3, wy - 3, 6, 2, C);
  R(ctx, 23, wy - 3, 6, 2, C);
  // Каменное тельце.
  R(ctx, 12, 20 + oy, 8, 16, S);
  // Рим-лайт слева.
  R(ctx, 12, 20 + oy, 1, 16, W);
  // Крап камня.
  R(ctx, 15, 26 + oy, 2, 2, L);
  R(ctx, 16, 32 + oy, 2, 1, K);
  // Голова с трещиной.
  R(ctx, 12, 12 + oy, 8, 8, S);
  R(ctx, 14, 15 + oy, 4, 2, C);
  // Жало.
  R(ctx, 15, 36 + oy, 2, 5, K);
}

/**
 * Balloon-пепельный пузырь 36×48: сфера с шипами и каменной гондолой.
 * frame: 1 — пузырь выше.
 */
function drawBalloon(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Сфера.
  for (let y = 0; y < 24; y++) {
    const half = 13 * Math.sin((Math.PI * (y + 1)) / 25);
    for (let x = Math.ceil(18 - half); x < 18 + half; x++) {
      ctx.fillStyle = S;
      ctx.fillRect(x, y + 2 + oy, 1, 1);
    }
  }
  // Шипы.
  R(ctx, 2, 11 + oy, 4, 2, S);
  R(ctx, 30, 11 + oy, 4, 2, S);
  R(ctx, 16, 0 + oy, 4, 3, S);
  R(ctx, 6, 4 + oy, 3, 3, S);
  R(ctx, 27, 4 + oy, 3, 3, S);
  // Рим-лайт слева.
  R(ctx, 8, 10 + oy, 1, 8, W);
  // Крап камня.
  R(ctx, 13, 8 + oy, 2, 2, L);
  R(ctx, 21, 18 + oy, 2, 1, L);
  // Циановые трещины.
  R(ctx, 14, 10 + oy, 2, 5, C);
  R(ctx, 20, 14 + oy + (frame === 1 ? 1 : 0), 5, 2, C);
  // Стропы и гондола.
  R(ctx, 14, 26 + oy, 2, 6, K);
  R(ctx, 20, 26 + oy, 2, 6, K);
  R(ctx, 13, 32 + oy, 10, 6, S);
  R(ctx, 13, 32 + oy, 10, 1, W);
}

/**
 * Cloudsheep-туманная овца 48×40: комья шерсти, четыре ноги, рогатая голова.
 * frame: 1 — шаг ног.
 */
function drawCloudsheep(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -1 : 0;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  const blob = (x: number, y: number, r: number): void => {
    for (let yy = -r; yy <= r; yy++) {
      for (let xx = -r; xx <= r; xx++) {
        if (xx * xx + yy * yy <= r * r) {
          ctx.fillStyle = S;
          ctx.fillRect(x + xx, y + yy + oy, 1, 1);
        }
      }
    }
  };
  blob(16, 18, 8);
  blob(26, 14, 9);
  blob(32, 20, 7);
  // Рим-лайт на спине.
  R(ctx, 20, 7 + oy, 8, 1, W);
  // Крап камня.
  R(ctx, 20, 14 + oy, 2, 2, L);
  R(ctx, 27, 19 + oy, 2, 1, L);
  // Четыре ноги (шаг чередуется).
  if (frame === 0) {
    R(ctx, 12, 28, 3, 9, K);
    R(ctx, 20, 28, 3, 9, K);
    R(ctx, 28, 28, 3, 9, K);
    R(ctx, 35, 28, 3, 9, K);
  } else {
    R(ctx, 11, 28, 3, 9, K);
    R(ctx, 21, 26, 3, 11, K);
    R(ctx, 27, 28, 3, 9, K);
    R(ctx, 36, 26, 3, 11, K);
  }
  // Рогатая голова справа.
  R(ctx, 36, 13 + oy, 9, 10, S);
  R(ctx, 33, 10 + oy, 4, 3, W);
  R(ctx, 42, 10 + oy, 4, 3, W);
  // Трещины на морде.
  R(ctx, 38, 17 + oy, 2, 3, C);
  R(ctx, 42, 17 + oy, 2, 3, C);
}

/**
 * Stormling-грозовой сгусток 40×44: молнии как трещины.
 * frame: 1 — молния длиннее.
 */
function drawStormling(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  const blob = (x: number, y: number, r: number): void => {
    for (let yy = -r; yy <= r; yy++) {
      for (let xx = -r; xx <= r; xx++) {
        if (xx * xx + yy * yy <= r * r) {
          ctx.fillStyle = S;
          ctx.fillRect(x + xx, y + yy + oy, 1, 1);
        }
      }
    }
  };
  blob(14, 14, 7);
  blob(24, 11, 8);
  blob(20, 19, 7);
  // Рим-лайт сверху.
  R(ctx, 20, 4 + oy, 7, 1, W);
  // Крап камня.
  R(ctx, 14, 12 + oy, 2, 2, L);
  R(ctx, 24, 16 + oy, 2, 1, L);
  // Трещины вместо глаз.
  R(ctx, 15, 13 + oy, 3, 2, C);
  R(ctx, 23, 13 + oy, 3, 2, C);
  // Молния-трещина из сгустка (длина по кадру).
  const len = frame === 1 ? 16 : 11;
  for (let i = 0; i < len; i++) {
    R(ctx, 20 + (i % 2 === 0 ? 0 : -2), 24 + oy + i, 3, 1, C);
  }
}

/**
 * Fluffdragon-сланцевый змей 56×48: длинный извив, крылья-обрубки.
 * frame: 1 — извив смещён, крылья выше.
 */
function drawFluffdragon(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const wy = (frame === 1 ? 6 : 12) + oy;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Крылья-обрубки.
  R(ctx, 22, wy, 10, 8, S);
  R(ctx, 24, wy - 4, 6, 5, S);
  R(ctx, 24, wy, 6, 2, C);
  // Длинный извив: три звена.
  R(ctx, 6, 26 + oy, 30, 10, S);
  R(ctx, 20, 20 + oy, 26, 10, S);
  R(ctx, 10, 32 + oy - (frame === 1 ? 2 : 0), 30, 8, S);
  // Рим-лайт сверху среднего звена.
  R(ctx, 24, 20 + oy, 14, 1, W);
  // Чешуя-крап.
  R(ctx, 12, 29 + oy, 3, 2, L);
  R(ctx, 28, 24 + oy, 3, 2, L);
  R(ctx, 18, 34 + oy, 3, 1, K);
  // Хвост с шипом.
  R(ctx, 2, 27 + oy, 5, 4, S);
  R(ctx, 0, 25 + oy, 3, 3, W);
  // Голова.
  R(ctx, 42, 18 + oy, 12, 12, S);
  R(ctx, 42, 18 + oy, 12, 1, W);
  // Рожки.
  R(ctx, 44, 13 + oy, 3, 5, K);
  R(ctx, 49, 13 + oy, 3, 5, K);
  // Трещины вдоль тела и глаз-щелка.
  R(ctx, 14, 29 + oy, 6, 1, C);
  R(ctx, 28, 33 + oy + (frame === 1 ? 1 : 0), 5, 1, C);
  R(ctx, 46, 22 + oy, 3, 2, C);
}

/**
 * Clownfish-фонарь 40×36: рыба со светящимся выростом.
 * frame: 1 — хвост вверх, вырост ярче.
 */
function drawClownfish(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -1 : 0;
  const tailY = frame === 1 ? -3 : 3;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Хвост-треугольник.
  for (let i = 0; i < 8; i++) {
    R(ctx, 2 + i, 16 + oy + tailY + Math.floor(i / 2), 2, 8 - i, S);
  }
  // Тело.
  for (let y = 0; y < 18; y++) {
    const half = 9 * Math.sin((Math.PI * (y + 1)) / 19);
    for (let x = Math.ceil(24 - half); x < 24 + half; x++) {
      ctx.fillStyle = S;
      ctx.fillRect(x, y + 9 + oy, 1, 1);
    }
  }
  // Рим-лайт сверху.
  R(ctx, 18, 10 + oy, 7, 1, W);
  // Крап камня.
  R(ctx, 20, 16 + oy, 2, 2, L);
  R(ctx, 26, 21 + oy, 2, 1, K);
  // Полосы-трещины.
  R(ctx, 16, 14 + oy, 10, 1, C);
  R(ctx, 16, 20 + oy, 10, 1, C);
  // Плавник.
  R(ctx, 22, 5 + oy, 5, 5, S);
  // Светящийся вырост-фонарь.
  R(ctx, 27, 6 + oy, 2, 5, K);
  R(ctx, 25, 2 + oy, 6, 5, C);
  R(ctx, 26, 3 + oy, 4, 3 + (frame === 1 ? 1 : 0), C);
}
/**
 * Jellyfish-светляк 40×48: купол с щупальцами-лучами.
 * frame: 1 — щупальца разной длины.
 */
function drawJellyfish(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Купол.
  for (let y = 0; y < 16; y++) {
    const half = 16 * Math.sin((Math.PI * (y + 4)) / 22);
    for (let x = Math.ceil(20 - half); x < 20 + half; x++) {
      ctx.fillStyle = S;
      ctx.fillRect(x, y + 4 + oy, 1, 1);
    }
  }
  // Рим-лайт слева на куполе.
  R(ctx, 8, 8 + oy, 1, 7, W);
  // Крап камня.
  R(ctx, 13, 8 + oy, 2, 2, L);
  R(ctx, 24, 13 + oy, 2, 1, K);
  // Трещины на куполе.
  R(ctx, 14, 8 + oy, 2, 5, C);
  R(ctx, 24, 10 + oy + (frame === 1 ? 1 : 0), 2, 4, C);
  // Ободок.
  R(ctx, 5, 19 + oy, 30, 3, K);
  // Щупальца-лучи.
  const lens = frame === 1 ? [20, 14, 22, 14, 20] : [16, 20, 15, 20, 16];
  for (let t = 0; t < 5; t++) {
    const x = 9 + t * 6;
    for (let i = 0; i < lens[t]; i++) {
      const sway = i > 6 ? (t % 2 === 0 ? 1 : -1) : 0;
      ctx.fillStyle = i > lens[t] - 4 ? C : S;
      ctx.fillRect(x + sway, 22 + oy + i, 2, 1);
    }
  }
}

/**
 * Seahorse-рифовый страж 32×48: вертикальная спираль с гребнем.
 * frame: 1 — спираль качнулась.
 */
function drawSeahorse(ctx: CanvasRenderingContext2D, frame: number): void {
  const sway = frame === 1 ? 1 : 0;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Тело-спираль: ступени со сдвигом.
  const spine: Array<[number, number, number]> = [
    [14, 8, 8],
    [16, 16, 9],
    [15, 24, 8],
    [13, 32, 7],
    [14, 39, 6],
  ];
  for (const [sx, sy, w] of spine) {
    R(ctx, sx + sway, sy, w, 8, S);
  }
  // Рим-лайт слева вверху.
  R(ctx, 15 + sway, 10, 1, 8, W);
  // Крап камня.
  R(ctx, 18 + sway, 18, 2, 2, L);
  R(ctx, 16 + sway, 34, 2, 1, K);
  // Спиральный гребень справа.
  for (const [sx, sy, w] of spine) {
    R(ctx, sx + sway + w - 2, sy + 2, 2, 4, K);
  }
  // Хоботок и трещина вместо глаза.
  R(ctx, 20 + sway, 8, 7, 4, S);
  R(ctx, 13 + sway, 10, 3, 4, C);
  // Гребень-корона.
  R(ctx, 11 + sway, 4, 2, 5, K);
  R(ctx, 14 + sway, 2, 2, 5, S);
  R(ctx, 17 + sway, 4, 2, 5, K);
  // Циановая трещина по телу.
  R(ctx, 15 + sway, 16, 2, 5, C);
  R(ctx, 14 + sway, 30 + (frame === 1 ? 1 : 0), 4, 2, C);
  // Закрученный хвост.
  R(ctx, 12 + sway, 44, 8, 3, S);
  R(ctx, 12 + sway, 44, 8, 1, K);
}

/**
 * Pearlwhale-левиафан 60×44: огромная форма, бирюзовая прожилка.
 * frame: 1 — фонтан выше.
 */
function drawPearlwhale(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  const TURQ = '#4de3c2';
  // Огромная туша.
  for (let y = 0; y < 24; y++) {
    const half = 24 * Math.sin((Math.PI * (y + 2)) / 27);
    for (let x = Math.ceil(28 - half); x < 28 + half; x++) {
      ctx.fillStyle = S;
      ctx.fillRect(x, y + 10 + oy, 1, 1);
    }
  }
  // Рим-лайт сверху.
  R(ctx, 24, 10 + oy, 8, 1, W);
  // Крап камня.
  R(ctx, 18, 16 + oy, 3, 2, L);
  R(ctx, 34, 26 + oy, 3, 1, L);
  R(ctx, 24, 30 + oy, 4, 1, K);
  // Бирюзовая прожилка вдоль тела.
  R(ctx, 10, 18 + oy, 30, 2, TURQ);
  R(ctx, 22, 20 + oy, 2, 6, TURQ);
  // Циановые трещины.
  R(ctx, 40, 14 + oy, 2, 6, C);
  R(ctx, 34, 24 + oy + (frame === 1 ? 1 : 0), 5, 2, C);
  // Хвостовой плавник слева.
  for (let i = 0; i < 8; i++) {
    R(ctx, 6 - Math.floor(i / 2), 12 + oy + i, 4, 2, S);
  }
  // Спинной плавник.
  R(ctx, 26, 4 + oy, 5, 7, S);
  // Фонтан-пар (выше в кадре 1).
  const spout = frame === 1 ? 3 : 0;
  R(ctx, 27, 0 + oy - spout, 2, 5, C);
  // Брюхо тёмное.
  R(ctx, 14, 30 + oy, 28, 3, K);
}

/**
 * Clown-масочник 36×48: пустая светлая маска вместо лица.
 * frame: 1 — рука поднята выше.
 */
function drawClown(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -1 : 0;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Колпак.
  for (let y = 0; y < 12; y++) {
    const half = 2 + y * 0.5;
    for (let x = Math.ceil(18 - half); x < 18 + half; x++) {
      ctx.fillStyle = S;
      ctx.fillRect(x, y + 2 + oy, 1, 1);
    }
  }
  R(ctx, 16, 0 + oy, 4, 3, C);
  R(ctx, 11, 12 + oy, 14, 3, K);
  // Пустая маска вместо лица.
  for (let y = 0; y < 14; y++) {
    const half = 10 * Math.sin((Math.PI * (y + 2)) / 17);
    for (let x = Math.ceil(18 - half); x < 18 + half; x++) {
      ctx.fillStyle = W;
      ctx.fillRect(x, y + 15 + oy, 1, 1);
    }
  }
  // Пустые глазницы и трещина-улыбка.
  R(ctx, 12, 19 + oy, 3, 3, K);
  R(ctx, 21, 19 + oy, 3, 3, K);
  R(ctx, 13, 26 + oy, 10, 1, C);
  R(ctx, 13, 25 + oy, 1, 2, C);
  R(ctx, 22, 25 + oy, 1, 2, C);
  // Жабо и каменное тело.
  R(ctx, 10, 29 + oy, 16, 4, K);
  R(ctx, 12, 33 + oy, 12, 11, S);
  R(ctx, 12, 33 + oy, 1, 11, W);
  R(ctx, 17, 35 + oy, 2, 3, C);
  R(ctx, 17, 40 + oy, 2, 3, C);
  // Руки (одна поднята по кадру).
  R(ctx, 8, 34 + oy + (frame === 1 ? -3 : 0), 3, 8, S);
  R(ctx, 25, 34 + oy + (frame === 1 ? 3 : 0), 3, 8, S);
}

/**
 * Juggler-жонглёр костями 40×52: кости в руках и в воздухе.
 * frame: 1 — кости на другой высоте.
 */
function drawJuggler(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -1 : 0;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Кости в воздухе: стержень с набалдашниками (высоты по кадру).
  const boneYs = frame === 0 ? [7 + oy, 3 + oy, 7 + oy] : [3 + oy, 9 + oy, 3 + oy];
  const boneXs = [8, 20, 32];
  for (let b = 0; b < 3; b++) {
    const bx = boneXs[b];
    const by = boneYs[b];
    R(ctx, bx - 3, by, 7, 2, W);
    R(ctx, bx - 4, by - 1, 3, 4, W);
    R(ctx, bx + 2, by - 1, 3, 4, W);
  }
  // Шляпа-цилиндр.
  R(ctx, 15, 14 + oy, 10, 9, S);
  R(ctx, 12, 22 + oy, 16, 3, K);
  R(ctx, 15, 18 + oy, 10, 2, C);
  // Лицо с трещинами.
  R(ctx, 16, 25 + oy, 8, 7, S);
  R(ctx, 17, 27 + oy, 2, 2, C);
  R(ctx, 21, 27 + oy, 2, 2, C);
  R(ctx, 18, 30 + oy, 4, 1, C);
  // Камзол и руки вверх.
  R(ctx, 14, 32 + oy, 12, 14, S);
  R(ctx, 14, 32 + oy, 1, 14, W);
  R(ctx, 10, 24 + oy, 3, 10, S);
  R(ctx, 27, 24 + oy, 3, 10, S);
  // Крап камня.
  R(ctx, 17, 36 + oy, 2, 2, L);
  R(ctx, 21, 41 + oy, 2, 1, K);
  // Ноги.
  R(ctx, 15, 46 + oy, 4, 5, K);
  R(ctx, 21, 46 + oy, 4, 5, K);
}

/**
 * Magician-фокусник без лица 36×52: шляпа, плащ, лица нет.
 * frame: 1 — палочка выше.
 */
function drawMagician(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -1 : 0;
  const wandUp = frame === 1 ? -3 : 0;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  // Цилиндр со светящейся лентой.
  R(ctx, 12, 4 + oy, 12, 13, S);
  R(ctx, 12, 13 + oy, 12, 2, C);
  R(ctx, 9, 16 + oy, 18, 3, K);
  // Плащ.
  for (let y = 0; y < 26; y++) {
    const half = 6 + y * 0.35;
    for (let x = Math.ceil(18 - half); x < 18 + half; x++) {
      ctx.fillStyle = S;
      ctx.fillRect(x, y + 22 + oy, 1, 1);
    }
  }
  // Рим-лайт слева на плаще.
  R(ctx, 12, 26 + oy, 1, 14, W);
  // Крап камня.
  R(ctx, 16, 32 + oy, 2, 2, L);
  R(ctx, 20, 40 + oy, 2, 1, K);
  // Под шляпой лица нет — одна трещина.
  R(ctx, 15, 20 + oy, 6, 1, C);
  // Палочка со звездой-трещиной.
  R(ctx, 27, 26 + oy + wandUp, 2, 12, K);
  R(ctx, 25, 22 + oy + wandUp, 6, 2, C);
  R(ctx, 27, 20 + oy + wandUp, 2, 6, C);
}

/**
 * Elephant-обсидиановый слон 60×52: золотая жила через тушу.
 * frame: 1 — хобот закручен.
 */
function drawElephant(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -1 : 0;
  const S = DARK_PALETTE.ground;
  const L = DARK_PALETTE.ground_light;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  const GOLD = '#d8a437';
  // Ноги-тумбы.
  R(ctx, 14, 40 + oy, 9, 10, K);
  R(ctx, 38, 40 + oy, 9, 10, K);
  // Туша.
  R(ctx, 10, 18 + oy, 42, 24, S);
  // Рим-лайт на спине.
  R(ctx, 14, 18 + oy, 30, 1, W);
  // Золотая жила через тушу.
  R(ctx, 14, 22 + oy, 30, 2, GOLD);
  R(ctx, 30, 22 + oy, 2, 10, GOLD);
  // Крап камня.
  R(ctx, 18, 30 + oy, 2, 2, L);
  R(ctx, 40, 34 + oy, 2, 1, K);
  // Ухо.
  R(ctx, 36, 14 + oy, 12, 14, S);
  R(ctx, 38, 16 + oy, 8, 10, K);
  // Голова.
  R(ctx, 44, 20 + oy, 12, 16, S);
  // Трещина вместо глаза.
  R(ctx, 46, 24 + oy, 2, 4, C);
  // Бивни-рим.
  R(ctx, 54, 30 + oy, 4, 2, W);
  R(ctx, 54, 34 + oy, 3, 2, W);
  // Хобот: висит или закручен.
  if (frame === 0) {
    R(ctx, 52, 28 + oy, 5, 14, S);
    R(ctx, 52, 28 + oy, 1, 14, K);
  } else {
    R(ctx, 52, 28 + oy, 5, 8, S);
    R(ctx, 52, 34 + oy, 8, 4, S);
    R(ctx, 52, 28 + oy, 1, 8, K);
  }
  // Хвост.
  R(ctx, 8, 24 + oy, 3, 10, K);
}

/** Блит базового корпуса 64×88 со сдвигом вниз на off (рост вверх). */
function blitBase(
  ctx: CanvasRenderingContext2D,
  base: (c: CanvasRenderingContext2D) => void,
  off: number,
): void {
  const tmp = document.createElement('canvas');
  tmp.width = 64;
  tmp.height = 88;
  const tctx = tmp.getContext('2d')!;
  tctx.imageSmoothingEnabled = false;
  base(tctx);
  ctx.drawImage(tmp, 0, off);
}

/**
 * Дорисовка этажей выше базы (регион [0, off)).
 * Руническое свечение усиливается с тайром; t3 = off > 24.
 */
function drawTowerTierExtra(
  ctx: CanvasRenderingContext2D,
  kind: 'arrow' | 'cannon' | 'ice',
  off: number,
): void {
  const t3 = off > 24;
  const S = DARK_PALETTE.ground;
  const K = DARK_PALETTE.skirt_bottom;
  const C = DARK_PALETTE.road_seam;
  const W = '#b9bdc4';
  if (kind === 'arrow') {
    // Площадки-ярусы с руническими поясами.
    for (let y = off - 4; y >= 16; y -= 16) {
      R(ctx, 18, y, 28, 6, S);
      R(ctx, 18, y, 28, 1, W);
      R(ctx, 20, y + 3, 24, 1, C);
      if (t3) R(ctx, 22, y + 4, 20, 1, C);
      R(ctx, 18, y - 8, 2, 8, S);
      R(ctx, 44, y - 8, 2, 8, S);
      R(ctx, 18, y - 8, 28, 1, K);
    }
    // Мачта сквозь ярусы.
    R(ctx, 31, 12, 2, off - 4, K);
    if (t3) {
      // Флаг-руна на вершине.
      R(ctx, 33, 8, 11, 5, C);
      R(ctx, 33, 8, 11, 1, W);
      R(ctx, 36, 10, 2, 2, W);
    } else {
      R(ctx, 30, 10, 4, 2, C);
    }
  } else if (kind === 'cannon') {
    // Верхняя сужающаяся тумба + бронепояс.
    for (let y = 16; y < off; y++) {
      const k = (y - 16) / Math.max(off - 16, 1);
      const half = 11 - k * 3;
      for (let x = Math.ceil(32 - half); x < 32 + half; x++) {
        ctx.fillStyle = S;
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.fillStyle = K;
      ctx.fillRect(Math.ceil(32 - half), y, 1, 1);
    }
    R(ctx, 20, 14, 24, 3, S);
    R(ctx, 20, 14, 24, 1, W);
    // Бронепояс с рунами.
    R(ctx, 22, 20, 20, 1, C);
    R(ctx, 25, 19, 2, 3, C);
    R(ctx, 35, 19, 2, 3, C);
    // Второй ствол влево-вверх (t2+).
    for (let i = 0; i < 12; i++) {
      const x = 30 - Math.floor(i * 0.7);
      const y = 28 - Math.floor(i * 0.8);
      R(ctx, x - 2, y - 2, 4, 4, K);
    }
    R(ctx, 16, 14, 5, 5, K);
    R(ctx, 15, 13, 7, 1, C);
    R(ctx, 15, 19, 7, 1, C);
    if (t3) {
      // Третий ствол вправо + корона.
      for (let i = 0; i < 12; i++) {
        const x = 34 + Math.floor(i * 0.7);
        const y = 28 - Math.floor(i * 0.8);
        R(ctx, x - 2, y - 2, 4, 4, K);
      }
      R(ctx, 43, 14, 5, 5, K);
      R(ctx, 42, 13, 7, 1, C);
      R(ctx, 42, 19, 7, 1, C);
      // Корона с циановыми камнями.
      for (const bx of [22, 28, 34, 40]) {
        R(ctx, bx, 6, 4, 8, S);
        R(ctx, bx, 6, 4, 1, W);
        R(ctx, bx + 1, 9, 2, 2, C);
      }
    }
  } else {
    // Высокий обелиск поверх базового (сходятся по ширине на шве).
    const bot = off + 16;
    for (let y = 8; y < bot; y++) {
      const k = 1 - (y - 8) / (bot - 8);
      const half = 1 + 6 * k;
      for (let x = Math.ceil(32 - half); x < 32 + half; x++) {
        ctx.fillStyle = C;
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.fillStyle = shade(C, 0.55);
      ctx.fillRect(Math.ceil(32 - half), y, 1, 1);
    }
    R(ctx, 27, 14, 2, 18, W);
    R(ctx, 22, off - 2, 4, 12, C);
    R(ctx, 38, off - 6, 4, 14, C);
    if (t3) {
      // Левитирующие осколки вокруг вершины.
      R(ctx, 14, 18, 3, 5, C);
      R(ctx, 47, 24, 3, 5, C);
      R(ctx, 30, 4, 4, 4, C);
      R(ctx, 14, 18, 3, 1, W);
      R(ctx, 47, 24, 3, 1, W);
    }
  }
}

/** Полный спрайт tier'а: база внизу + этажи сверху. */
function tieredTower(kind: 'arrow' | 'cannon' | 'ice', tier: 2 | 3): HTMLCanvasElement {
  const H = tier === 2 ? 112 : 136;
  const off = H - 88;
  const [c, ctx] = makeCanvas(64, H);
  const base = kind === 'arrow' ? drawTowerArrow : kind === 'cannon' ? drawTowerCannon : drawTowerIce;
  blitBase(ctx, base, off);
  drawTowerTierExtra(ctx, kind, off);
  return c;
}

/** Puff-облако спор 48×32 для spore_clouds. */
function drawSporeCloud(ctx: CanvasRenderingContext2D): void {
  const blobs: Array<[number, number, number]> = [
    [14, 18, 9],
    [24, 14, 10],
    [34, 18, 8],
    [24, 22, 9],
  ];
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 48; x++) {
      for (const [bx, by, br] of blobs) {
        const d = Math.hypot(x - bx, y - by);
        if (d < br) {
          ctx.fillStyle = d > br - 2 ? PALETTE.cloud : shade(PALETTE.cloud, 0.92);
          ctx.fillRect(x, y, 1, 1);
          break;
        }
      }
    }
  }
  // Споры-крап.
  ctx.fillStyle = PALETTE.earth;
  ctx.fillRect(14, 16, 2, 2);
  ctx.fillRect(26, 20, 2, 2);
  ctx.fillRect(32, 14, 2, 2);
  ctx.fillRect(20, 24, 2, 1);
  ctx.fillRect(36, 22, 2, 1);
}

/** Стрелка ветра 48×24, смотрит вправо (спрайт крутится по ветру). */
function drawWindArrow(ctx: CanvasRenderingContext2D): void {
  R(ctx, 4, 10, 28, 4, PALETTE.cloud);
  R(ctx, 4, 10, 28, 1, shade(PALETTE.cloud, 1.1));
  for (let i = 0; i < 10; i++) {
    R(ctx, 32 + i, 8 + Math.floor(i / 2), 2, 8 - (i % 2 === 0 ? 0 : 2), PALETTE.cloud);
  }
  R(ctx, 4, 14, 28, 1, PALETTE.stoneDark);
}

/** Пузырь 64×64: полупрозрачный контур с бликом. */
function drawBubble(ctx: CanvasRenderingContext2D): void {
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const d = Math.hypot(x - 32, y - 32);
      if (d > 28 || d < 24) continue;
      ctx.fillStyle = 'rgba(207,232,255,0.85)';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = 'rgba(207,232,255,0.25)';
  for (let y = 6; y < 58; y++) {
    for (let x = 6; x < 58; x++) {
      if (Math.hypot(x - 32, y - 32) < 24) ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(18, 14, 8, 3);
  ctx.fillRect(14, 18, 3, 8);
}

function buildTile(id: TileId): Texture {
  let cv: HTMLCanvasElement;
  switch (id) {
    case 'grass-a': {
      const [c, ctx] = makeCanvas(TILE_W, TILE_H);
      drawGrass(ctx, 11, darkMode);
      cv = c;
      break;
    }
    case 'grass-b': {
      const [c, ctx] = makeCanvas(TILE_W, TILE_H);
      drawGrass(ctx, 77, darkMode);
      cv = c;
      break;
    }
    case 'road-a': {
      const [c, ctx] = makeCanvas(TILE_W, TILE_H);
      drawRoad(ctx, 31, darkMode);
      cv = c;
      break;
    }
    case 'road-b': {
      const [c, ctx] = makeCanvas(TILE_W, TILE_H);
      drawRoad(ctx, 57, darkMode);
      cv = c;
      break;
    }
    case 'pedestal': {
      const [c, ctx] = makeCanvas(64, 44);
      drawPedestal(ctx, darkMode);
      cv = c;
      break;
    }
    case 'skirt-tall': {
      const [c, ctx] = makeCanvas(64, 96);
      drawSkirt(ctx, 96, 5, darkMode);
      cv = c;
      break;
    }
    case 'skirt-short': {
      const [c, ctx] = makeCanvas(64, 72);
      drawSkirt(ctx, 72, 21, darkMode);
      cv = c;
      break;
    }
    case 'cloud-1': {
      const [c, ctx] = makeCanvas(96, 32);
      drawCloud(ctx, 96, 32, 3, darkMode ? DARK_PALETTE.cloud : PALETTE.cloud);
      cv = c;
      break;
    }
    case 'cloud-2': {
      const [c, ctx] = makeCanvas(128, 40);
      drawCloud(ctx, 128, 40, 9, darkMode ? DARK_PALETTE.cloud : PALETTE.cloud);
      cv = c;
      break;
    }
    case 'crystal': {
      const [c, ctx] = makeCanvas(48, 64);
      drawCrystal(ctx, 0);
      cv = c;
      break;
    }
    case 'crystal_f0': {
      const [c, ctx] = makeCanvas(48, 64);
      drawCrystal(ctx, 0);
      cv = c;
      break;
    }
    case 'crystal_f1': {
      const [c, ctx] = makeCanvas(48, 64);
      drawCrystal(ctx, 1);
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
    case 'enemy_spore_f0': {
      const [c, ctx] = makeCanvas(32, 40);
      drawSpore(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_spore_f1': {
      const [c, ctx] = makeCanvas(32, 40);
      drawSpore(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_puffling_f0': {
      const [c, ctx] = makeCanvas(44, 44);
      drawPuffling(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_puffling_f1': {
      const [c, ctx] = makeCanvas(44, 44);
      drawPuffling(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_truffle_f0': {
      const [c, ctx] = makeCanvas(52, 52);
      drawTruffle(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_truffle_f1': {
      const [c, ctx] = makeCanvas(52, 52);
      drawTruffle(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_jelly_f0': {
      const [c, ctx] = makeCanvas(40, 44);
      drawJelly(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_jelly_f1': {
      const [c, ctx] = makeCanvas(40, 44);
      drawJelly(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_jellymini_f0': {
      const [c, ctx] = makeCanvas(24, 28);
      drawJellymini(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_jellymini_f1': {
      const [c, ctx] = makeCanvas(24, 28);
      drawJellymini(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_caramel_f0': {
      const [c, ctx] = makeCanvas(36, 44);
      drawCaramel(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_caramel_f1': {
      const [c, ctx] = makeCanvas(36, 44);
      drawCaramel(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_chocgolem_f0': {
      const [c, ctx] = makeCanvas(56, 56);
      drawChocgolem(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_chocgolem_f1': {
      const [c, ctx] = makeCanvas(56, 56);
      drawChocgolem(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_candyfairy_f0': {
      const [c, ctx] = makeCanvas(32, 44);
      drawCandyfairy(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_candyfairy_f1': {
      const [c, ctx] = makeCanvas(32, 44);
      drawCandyfairy(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_balloon_f0': {
      const [c, ctx] = makeCanvas(36, 48);
      drawBalloon(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_balloon_f1': {
      const [c, ctx] = makeCanvas(36, 48);
      drawBalloon(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_cloudsheep_f0': {
      const [c, ctx] = makeCanvas(48, 40);
      drawCloudsheep(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_cloudsheep_f1': {
      const [c, ctx] = makeCanvas(48, 40);
      drawCloudsheep(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_stormling_f0': {
      const [c, ctx] = makeCanvas(40, 44);
      drawStormling(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_stormling_f1': {
      const [c, ctx] = makeCanvas(40, 44);
      drawStormling(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_fluffdragon_f0': {
      const [c, ctx] = makeCanvas(56, 48);
      drawFluffdragon(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_fluffdragon_f1': {
      const [c, ctx] = makeCanvas(56, 48);
      drawFluffdragon(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_clownfish_f0': {
      const [c, ctx] = makeCanvas(40, 36);
      drawClownfish(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_clownfish_f1': {
      const [c, ctx] = makeCanvas(40, 36);
      drawClownfish(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_jellyfish_f0': {
      const [c, ctx] = makeCanvas(40, 48);
      drawJellyfish(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_jellyfish_f1': {
      const [c, ctx] = makeCanvas(40, 48);
      drawJellyfish(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_seahorse_f0': {
      const [c, ctx] = makeCanvas(32, 48);
      drawSeahorse(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_seahorse_f1': {
      const [c, ctx] = makeCanvas(32, 48);
      drawSeahorse(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_pearlwhale_f0': {
      const [c, ctx] = makeCanvas(60, 44);
      drawPearlwhale(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_pearlwhale_f1': {
      const [c, ctx] = makeCanvas(60, 44);
      drawPearlwhale(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_clown_f0': {
      const [c, ctx] = makeCanvas(36, 48);
      drawClown(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_clown_f1': {
      const [c, ctx] = makeCanvas(36, 48);
      drawClown(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_juggler_f0': {
      const [c, ctx] = makeCanvas(40, 52);
      drawJuggler(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_juggler_f1': {
      const [c, ctx] = makeCanvas(40, 52);
      drawJuggler(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_magician_f0': {
      const [c, ctx] = makeCanvas(36, 52);
      drawMagician(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_magician_f1': {
      const [c, ctx] = makeCanvas(36, 52);
      drawMagician(ctx, 1);
      cv = c;
      break;
    }
    case 'enemy_elephant_f0': {
      const [c, ctx] = makeCanvas(60, 52);
      drawElephant(ctx, 0);
      cv = c;
      break;
    }
    case 'enemy_elephant_f1': {
      const [c, ctx] = makeCanvas(60, 52);
      drawElephant(ctx, 1);
      cv = c;
      break;
    }
    case 'tower_arrow_t2': {
      cv = tieredTower('arrow', 2);
      break;
    }
    case 'tower_arrow_t3': {
      cv = tieredTower('arrow', 3);
      break;
    }
    case 'tower_cannon_t2': {
      cv = tieredTower('cannon', 2);
      break;
    }
    case 'tower_cannon_t3': {
      cv = tieredTower('cannon', 3);
      break;
    }
    case 'tower_ice_t2': {
      cv = tieredTower('ice', 2);
      break;
    }
    case 'tower_ice_t3': {
      cv = tieredTower('ice', 3);
      break;
    }
    case 'fx_spore_cloud': {
      const [c, ctx] = makeCanvas(48, 32);
      drawSporeCloud(ctx);
      cv = c;
      break;
    }
    case 'fx_wind_arrow': {
      const [c, ctx] = makeCanvas(48, 24);
      drawWindArrow(ctx);
      cv = c;
      break;
    }
    case 'fx_bubble': {
      const [c, ctx] = makeCanvas(64, 64);
      drawBubble(ctx);
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
      if (darkMode) drawVoidDark(ctx, 144, 256);
      else drawVoid(ctx, 144, 256);
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

/**
 * Факел башни: аддитивный glow-спрайт 64×64 (не через getTile).
 * Мерцание 0.8–1.2 с периодом 0.7 c крутит сцена (App.tickLight),
 * здесь только тёплое радиальное пятно с blendMode 'add'.
 */
export function torchGlow(): Sprite {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 30, 2, 32, 30, 30);
  g.addColorStop(0, 'rgba(255,154,60,0.85)');
  g.addColorStop(0.5, 'rgba(255,154,60,0.30)');
  g.addColorStop(1, 'rgba(255,154,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const source = new CanvasSource({ resource: cv });
  const s = new Sprite(new Texture({ source }));
  s.blendMode = 'add';
  s.anchor.set(0.5);
  return s;
}
