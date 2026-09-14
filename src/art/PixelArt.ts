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

/** Spore 32×40: парящая спора с крылышками, бледное тельце, тёмная сердцевина. */
function drawSpore(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const wingY = (frame === 1 ? 12 : 16) + oy;
  // Крылышки по бокам.
  R(ctx, 2, wingY, 8, 2, PALETTE.cloud);
  R(ctx, 22, wingY, 8, 2, PALETTE.cloud);
  R(ctx, 4, wingY - 2, 4, 2, PALETTE.cloud);
  R(ctx, 24, wingY - 2, 4, 2, PALETTE.cloud);
  // Тельце-пушок.
  for (let y = 0; y < 20; y++) {
    const half = 9 * Math.sin((Math.PI * (y + 1)) / 21) + 1;
    for (let x = Math.ceil(16 - half); x < 16 + half; x++) {
      ctx.fillStyle = PALETTE.roadLight;
      ctx.fillRect(x, y + 14 + oy, 1, 1);
    }
  }
  // Крап-споры на тельце.
  R(ctx, 12, 20 + oy, 2, 2, PALETTE.earth);
  R(ctx, 19, 24 + oy, 2, 2, PALETTE.earth);
  R(ctx, 14, 27 + oy, 2, 1, PALETTE.earth);
  // Сердцевина-глаз.
  R(ctx, 14, 21 + oy, 4, 4, PALETTE.void);
  R(ctx, 15, 22 + oy, 2, 2, PALETTE.gold);
  // Ножки-тычинки снизу.
  R(ctx, 13, 33 + oy, 2, 4, PALETTE.earthDark);
  R(ctx, 17, 33 + oy, 2, 4, PALETTE.earthDark);
}

/** Puffling 44×44: пушистый шар с рваным контуром. Кадр 1 — сплющен. */
function drawPuffling(ctx: CanvasRenderingContext2D, frame: number): void {
  const cx = 22;
  const cy = frame === 1 ? 26 : 24;
  const rx = frame === 1 ? 19 : 17;
  const ry = frame === 1 ? 14 : 16;
  for (let y = 0; y < 44; y++) {
    for (let x = 0; x < 44; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      // Рваный пушистый край.
      if (d > 0.82 && ((x * 7 + y * 13) % 5 === 0)) continue;
      ctx.fillStyle = d > 0.86 ? PALETTE.stoneDark : PALETTE.roadLight;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Мордочка.
  const my = cy - 2;
  R(ctx, cx - 7, my, 3, 4, PALETTE.void);
  R(ctx, cx + 4, my, 3, 4, PALETTE.void);
  R(ctx, cx - 6, my + 1, 1, 2, PALETTE.gold);
  R(ctx, cx + 5, my + 1, 1, 2, PALETTE.gold);
  R(ctx, cx - 2, my + 6, 4, 2, PALETTE.earthDark);
  // Хохолок.
  R(ctx, cx - 1, cy - ry - 3, 2, 4, PALETTE.stoneDark);
}

/** Truffle 52×52: гриб с широкой шляпой в пятнах, толстая ножка. */
function drawTruffle(ctx: CanvasRenderingContext2D, frame: number): void {
  const lean = frame === 1 ? 2 : 0;
  const cx = 26 + lean;
  // Ножка.
  R(ctx, cx - 7, 28, 14, 20, PALETTE.road);
  R(ctx, cx - 7, 28, 3, 20, shade(PALETTE.road, 0.8));
  R(ctx, cx - 9, 46, 18, 4, shade(PALETTE.road, 0.85));
  // Пластинки под шляпой.
  R(ctx, cx - 20, 24, 40, 5, PALETTE.stoneDark);
  // Шляпа-купол.
  for (let y = 0; y < 24; y++) {
    const k = y / 24;
    const half = 24 * Math.sin((Math.PI * (1 - k)) / 2);
    for (let x = Math.ceil(cx - half); x < cx + half; x++) {
      ctx.fillStyle = k > 0.75 ? shade(PALETTE.earth, 1.15) : PALETTE.earth;
      ctx.fillRect(x, y + 2, 1, 1);
    }
  }
  // Контур шляпы.
  ctx.fillStyle = PALETTE.earthDark;
  for (let y = 0; y < 24; y++) {
    const k = y / 24;
    const half = 24 * Math.sin((Math.PI * (1 - k)) / 2);
    ctx.fillRect(Math.ceil(cx - half), y + 2, 1, 1);
    ctx.fillRect(Math.floor(cx + half) - 1, y + 2, 1, 1);
  }
  // Пятна на шляпе.
  R(ctx, cx - 14, 8, 5, 4, PALETTE.roadLight);
  R(ctx, cx + 6, 6, 4, 4, PALETTE.roadLight);
  R(ctx, cx - 2, 13, 6, 3, PALETTE.roadLight);
  R(ctx, cx - 13, 15, 3, 3, PALETTE.roadLight);
  // Глаза-щёлки на ножке.
  R(ctx, cx - 5, 34, 3, 2, PALETTE.void);
  R(ctx, cx + 2, 34, 3, 2, PALETTE.void);
}

/** Jelly 40×44: желейный куб, кадр 1 шире и ниже (wobble). */
function drawJelly(ctx: CanvasRenderingContext2D, frame: number): void {
  const w = frame === 1 ? 32 : 28;
  const h = frame === 1 ? 30 : 34;
  const x0 = 20 - w / 2;
  const y0 = 40 - h;
  for (let y = 0; y < h; y++) {
    const inset = y < 4 ? 4 - y : 0;
    for (let x = inset; x < w - inset; x++) {
      ctx.fillStyle = PALETTE.roadLight;
      ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }
  }
  ctx.fillStyle = PALETTE.crystal;
  ctx.fillRect(x0 + 5, y0 + 5, 3, h - 12);
  ctx.fillRect(x0 + 5, y0 + 5, 8, 3);
  R(ctx, x0 + 10, y0 + 14, 3, 4, PALETTE.void);
  R(ctx, x0 + 18, y0 + 14, 3, 4, PALETTE.void);
  R(ctx, x0 + 11, y0 + 15, 1, 2, PALETTE.gold);
  R(ctx, x0 + 19, y0 + 15, 1, 2, PALETTE.gold);
}

/** Jellymini 24×28: малая копия jelly. */
function drawJellymini(ctx: CanvasRenderingContext2D, frame: number): void {
  const w = frame === 1 ? 19 : 17;
  const h = frame === 1 ? 18 : 20;
  const x0 = 12 - w / 2;
  const y0 = 26 - h;
  for (let y = 0; y < h; y++) {
    const inset = y < 3 ? 3 - y : 0;
    for (let x = inset; x < w - inset; x++) {
      ctx.fillStyle = PALETTE.roadLight;
      ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }
  }
  ctx.fillStyle = PALETTE.crystal;
  ctx.fillRect(x0 + 3, y0 + 3, 2, h - 7);
  R(ctx, x0 + 6, y0 + 8, 2, 3, PALETTE.void);
  R(ctx, x0 + 11, y0 + 8, 2, 3, PALETTE.void);
}

/** Caramel 36×44: конфета-овал в фантике с twist-концами. */
function drawCaramel(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  // Twist-концы фантика.
  for (let i = 0; i < 5; i++) {
    R(ctx, 2 + i, 20 + oy + i, 2, 2, PALETTE.earthDark);
    R(ctx, 32 - i, 20 + oy + i, 2, 2, PALETTE.earthDark);
  }
  // Овал-корпус.
  for (let y = 0; y < 24; y++) {
    const half = 11 * Math.sin((Math.PI * (y + 1)) / 25);
    for (let x = Math.ceil(18 - half); x < 18 + half; x++) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(x, y + 10 + oy, 1, 1);
    }
  }
  // Полоски карамели.
  R(ctx, 12, 12 + oy, 3, 20, PALETTE.earth);
  R(ctx, 21, 12 + oy, 3, 20, PALETTE.earth);
  R(ctx, 12, 12 + oy, 12, 2, shade(PALETTE.gold, 1.2));
  // Глаза.
  R(ctx, 15, 19 + oy, 2, 3, PALETTE.void);
  R(ctx, 20, 19 + oy, 2, 3, PALETTE.void);
}

/** Chocgolem 56×56: шоколадная глыба с трещинами, каменные кулаки. */
function drawChocgolem(ctx: CanvasRenderingContext2D, frame: number): void {
  const lean = frame === 1 ? 2 : 0;
  R(ctx, 16 + lean, 44, 8, 10, PALETTE.earthDark);
  R(ctx, 32 - lean, 44, 8, 10, PALETTE.earthDark);
  R(ctx, 12 + lean, 16, 32, 30, PALETTE.earth);
  R(ctx, 12 + lean, 16, 32, 3, shade(PALETTE.earth, 1.2));
  R(ctx, 12 + lean, 16, 3, 30, PALETTE.earthDark);
  // Трещины светлее.
  R(ctx, 22 + lean, 22, 2, 14, PALETTE.roadLight);
  R(ctx, 30 + lean, 28, 6, 2, PALETTE.roadLight);
  R(ctx, 33 + lean, 20, 2, 8, PALETTE.roadLight);
  // Кулаки.
  R(ctx, 4 + lean, 30 + (frame === 1 ? 3 : 0), 9, 10, PALETTE.stoneDark);
  R(ctx, 43 + lean, 30 - (frame === 1 ? 3 : 0), 9, 10, PALETTE.stoneDark);
  R(ctx, 4 + lean, 30 + (frame === 1 ? 3 : 0), 9, 2, PALETTE.stone);
  R(ctx, 43 + lean, 30 - (frame === 1 ? 3 : 0), 9, 2, PALETTE.stone);
  // Брови и глаза.
  R(ctx, 20 + lean, 22, 16, 3, PALETTE.earthDark);
  R(ctx, 22 + lean, 25, 3, 3, PALETTE.gold);
  R(ctx, 31 + lean, 25, 3, 3, PALETTE.gold);
}

/** Candyfairy 32×44: кроха в золотом платье, крылья машут по кадрам. */
function drawCandyfairy(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const wy = frame === 1 ? 10 : 16;
  // Крылья.
  R(ctx, 1, wy + oy, 9, 6, PALETTE.cloud);
  R(ctx, 22, wy + oy, 9, 6, PALETTE.cloud);
  R(ctx, 3, wy + oy - 3, 5, 3, PALETTE.cloud);
  R(ctx, 24, wy + oy - 3, 5, 3, PALETTE.cloud);
  // Платье-треугольник.
  for (let y = 0; y < 14; y++) {
    const half = 2 + y * 0.55;
    for (let x = Math.ceil(16 - half); x < 16 + half; x++) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(x, y + 22 + oy, 1, 1);
    }
  }
  R(ctx, 13, 30 + oy, 6, 2, PALETTE.earth);
  // Голова и пучок.
  R(ctx, 12, 12 + oy, 8, 8, PALETTE.roadLight);
  R(ctx, 14, 8 + oy, 4, 4, PALETTE.earthDark);
  R(ctx, 13, 15 + oy, 2, 2, PALETTE.void);
  R(ctx, 17, 15 + oy, 2, 2, PALETTE.void);
  // Палочка.
  R(ctx, 23, 22 + oy, 2, 10, PALETTE.earthDark);
  R(ctx, 22, 19 + oy, 4, 4, PALETTE.crystal);
}

/** Balloon 36×48: шар-конверт с корзиной на стропах. */
function drawBalloon(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  // Конверт.
  for (let y = 0; y < 22; y++) {
    const half = 14 * Math.sin((Math.PI * (y + 2)) / 25);
    for (let x = Math.ceil(18 - half); x < 18 + half; x++) {
      ctx.fillStyle = PALETTE.crystal;
      ctx.fillRect(x, y + 2 + oy, 1, 1);
    }
  }
  // Полосы.
  R(ctx, 12, 3 + oy, 3, 20, PALETTE.cloud);
  R(ctx, 21, 3 + oy, 3, 20, PALETTE.cloud);
  R(ctx, 16, 4 + oy, 4, 6, PALETTE.cloud);
  // Стропы.
  R(ctx, 12, 24 + oy, 2, 10, PALETTE.earthDark);
  R(ctx, 22, 24 + oy, 2, 10, PALETTE.earthDark);
  // Корзина.
  R(ctx, 11, 34 + oy, 14, 8, PALETTE.earth);
  R(ctx, 11, 34 + oy, 14, 2, shade(PALETTE.earth, 1.2));
  R(ctx, 13, 36 + oy, 2, 6, PALETTE.earthDark);
  R(ctx, 17, 36 + oy, 2, 6, PALETTE.earthDark);
  R(ctx, 21, 36 + oy, 2, 6, PALETTE.earthDark);
  // Пассажир-глаза.
  R(ctx, 15, 30 + oy, 2, 2, PALETTE.void);
  R(ctx, 19, 30 + oy, 2, 2, PALETTE.void);
}

/** Cloudsheep 48×40: овца из облачных клубов, тёмная морда. */
function drawCloudsheep(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -1 : 0;
  const puff = (x: number, y: number, r: number): void => {
    for (let yy = -r; yy <= r; yy++) {
      for (let xx = -r; xx <= r; xx++) {
        if (xx * xx + yy * yy <= r * r) {
          ctx.fillStyle = PALETTE.cloud;
          ctx.fillRect(x + xx, y + yy + oy, 1, 1);
        }
      }
    }
  };
  puff(16, 18, 8);
  puff(26, 14, 9);
  puff(34, 19, 7);
  puff(24, 22, 8);
  // Морда.
  R(ctx, 32, 20 + oy, 10, 9, PALETTE.stoneDark);
  R(ctx, 34, 22 + oy, 2, 3, PALETTE.gold);
  R(ctx, 38, 22 + oy, 2, 3, PALETTE.gold);
  R(ctx, 30, 18 + oy, 4, 3, PALETTE.stoneDark);
  // Ножки (шаг чередуется).
  if (frame === 0) {
    R(ctx, 14, 30, 3, 8, PALETTE.stoneDark);
    R(ctx, 28, 30, 3, 8, PALETTE.stoneDark);
  } else {
    R(ctx, 13, 30, 3, 8, PALETTE.stoneDark);
    R(ctx, 29, 28, 3, 10, PALETTE.stoneDark);
  }
}

/** Stormling 40×44: грозовая туча с молнией. */
function drawStormling(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const puff = (x: number, y: number, r: number, c: string): void => {
    for (let yy = -r; yy <= r; yy++) {
      for (let xx = -r; xx <= r; xx++) {
        if (xx * xx + yy * yy <= r * r) {
          ctx.fillStyle = c;
          ctx.fillRect(x + xx, y + yy + oy, 1, 1);
        }
      }
    }
  };
  puff(14, 14, 7, PALETTE.stoneDark);
  puff(24, 11, 8, PALETTE.stoneDark);
  puff(20, 18, 7, PALETTE.void);
  puff(24, 11, 5, PALETTE.stoneDark);
  // Глаза-молнии.
  R(ctx, 16, 13 + oy, 3, 3, PALETTE.gold);
  R(ctx, 23, 13 + oy, 3, 3, PALETTE.gold);
  // Молния из тучи (длина по кадру).
  const len = frame === 1 ? 16 : 11;
  for (let i = 0; i < len; i++) {
    R(ctx, 20 + (i % 2 === 0 ? 0 : -2), 22 + oy + i, 3, 1, PALETTE.gold);
  }
}

/** Fluffdragon 56×48: пушистый змей с крыльями, рогами и хвостом. */
function drawFluffdragon(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  const wy = frame === 1 ? 6 : 12;
  // Крылья вверх/вниз.
  R(ctx, 18, wy + oy, 12, 3, PALETTE.cloud);
  R(ctx, 20, wy + oy - 4, 8, 4, PALETTE.cloud);
  // Тело-колбаса.
  R(ctx, 8, 24 + oy, 34, 12, PALETTE.roadLight);
  R(ctx, 8, 24 + oy, 34, 3, shade(PALETTE.roadLight, 1.1));
  R(ctx, 8, 33 + oy, 34, 3, PALETTE.earth);
  // Пушковые вихры.
  R(ctx, 12, 21 + oy, 3, 3, PALETTE.cloud);
  R(ctx, 24, 21 + oy, 3, 3, PALETTE.cloud);
  R(ctx, 34, 21 + oy, 3, 3, PALETTE.cloud);
  // Хвост с кисточкой.
  R(ctx, 4, 27 + oy, 5, 4, PALETTE.roadLight);
  R(ctx, 1, 25 + oy, 4, 4, PALETTE.gold);
  // Голова.
  R(ctx, 40, 22 + oy, 12, 13, PALETTE.roadLight);
  R(ctx, 40, 22 + oy, 12, 3, shade(PALETTE.roadLight, 1.1));
  // Рожки.
  R(ctx, 42, 17 + oy, 3, 5, PALETTE.earthDark);
  R(ctx, 47, 17 + oy, 3, 5, PALETTE.earthDark);
  // Глаз и ноздря.
  R(ctx, 44, 26 + oy, 3, 4, PALETTE.void);
  R(ctx, 45, 27 + oy, 1, 2, PALETTE.gold);
  R(ctx, 50, 31 + oy, 2, 2, PALETTE.earthDark);
}

/** Clownfish 40×36: рыбка боком, хвост виляет по кадрам. */
function drawClownfish(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -1 : 0;
  const tailY = frame === 1 ? -3 : 3;
  // Хвост-треугольник.
  for (let i = 0; i < 8; i++) {
    R(ctx, 2 + i, 16 + oy + tailY + Math.floor(i / 2), 2, 8 - i, PALETTE.earth);
  }
  // Тело.
  for (let y = 0; y < 18; y++) {
    const half = 9 * Math.sin((Math.PI * (y + 1)) / 19);
    for (let x = Math.ceil(24 - half); x < 24 + half; x++) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(x, y + 9 + oy, 1, 1);
    }
  }
  // Белые полосы с тёмной окантовкой.
  for (const sy of [13, 20]) {
    R(ctx, 17, sy + oy, 13, 1, PALETTE.void);
    R(ctx, 17, sy + oy + 1, 13, 3, PALETTE.cloud);
    R(ctx, 17, sy + oy + 4, 13, 1, PALETTE.void);
  }
  // Плавник и глаз.
  R(ctx, 22, 5 + oy, 5, 5, PALETTE.earth);
  R(ctx, 29, 14 + oy, 3, 4, PALETTE.void);
  R(ctx, 30, 15 + oy, 1, 2, PALETTE.cloud);
}

/** Jellyfish 40×48: купол со щупальцами разной длины по кадрам. */
function drawJellyfish(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  // Купол.
  for (let y = 0; y < 16; y++) {
    const half = 16 * Math.sin((Math.PI * (y + 4)) / 22);
    for (let x = Math.ceil(20 - half); x < 20 + half; x++) {
      ctx.fillStyle = PALETTE.crystal;
      ctx.fillRect(x, y + 4 + oy, 1, 1);
    }
  }
  R(ctx, 10, 8 + oy, 4, 8, PALETTE.cloud);
  R(ctx, 10, 8 + oy, 9, 2, PALETTE.cloud);
  // Ободок.
  R(ctx, 5, 19 + oy, 30, 3, shade(PALETTE.crystal, 0.7));
  // Щупальца.
  const lens = frame === 1 ? [20, 14, 22, 14, 20] : [16, 20, 15, 20, 16];
  for (let t = 0; t < 5; t++) {
    const x = 9 + t * 6;
    for (let i = 0; i < lens[t]; i++) {
      const sway = i > 6 ? (t % 2 === 0 ? 1 : -1) : 0;
      ctx.fillStyle = PALETTE.crystal;
      ctx.fillRect(x + sway, 22 + oy + i, 2, 1);
    }
  }
  // Мордочка на куполе.
  R(ctx, 15, 12 + oy, 3, 4, PALETTE.void);
  R(ctx, 22, 12 + oy, 3, 4, PALETTE.void);
}

/** Seahorse 32×48: S-силуэт, бронированные кольца, хоботок и гребень. */
function drawSeahorse(ctx: CanvasRenderingContext2D, frame: number): void {
  const sway = frame === 1 ? 1 : 0;
  // Тело дугой.
  const spine: Array<[number, number, number]> = [
    [14, 8, 8],
    [16, 16, 9],
    [15, 24, 8],
    [13, 32, 7],
    [14, 39, 6],
  ];
  for (const [sx, sy, w] of spine) {
    R(ctx, sx + sway, sy, w, 8, PALETTE.gold);
  }
  // Броневые кольца.
  for (const [sx, sy, w] of spine) {
    R(ctx, sx + sway, sy + 6, w, 2, PALETTE.stoneDark);
  }
  // Хоботок и глаз.
  R(ctx, 20 + sway, 8, 7, 4, PALETTE.gold);
  R(ctx, 25 + sway, 9, 2, 2, PALETTE.earthDark);
  R(ctx, 13 + sway, 10, 3, 4, PALETTE.void);
  R(ctx, 14 + sway, 11, 1, 2, PALETTE.cloud);
  // Гребень-корона.
  R(ctx, 11 + sway, 4, 2, 5, PALETTE.earthDark);
  R(ctx, 14 + sway, 2, 2, 5, PALETTE.earthDark);
  R(ctx, 17 + sway, 4, 2, 5, PALETTE.earthDark);
  // Спинной плавник.
  for (let i = 0; i < 6; i++) {
    R(ctx, 23 + sway - Math.floor(i / 2), 22 + i * 2, 4, 2, PALETTE.cloud);
  }
  // Закрученный хвост.
  R(ctx, 12 + sway, 44, 8, 3, PALETTE.gold);
  R(ctx, 12 + sway, 44, 8, 1, PALETTE.stoneDark);
}

/** Pearlwhale 60×44: кит с фонтаном, светлое брюхо. */
function drawPearlwhale(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -2 : 0;
  // Туша.
  for (let y = 0; y < 24; y++) {
    const half = 24 * Math.sin((Math.PI * (y + 2)) / 27);
    for (let x = Math.ceil(28 - half); x < 28 + half; x++) {
      ctx.fillStyle = PALETTE.stone;
      ctx.fillRect(x, y + 10 + oy, 1, 1);
    }
  }
  // Брюхо.
  for (let y = 0; y < 8; y++) {
    const half = 18 * Math.sin((Math.PI * (y + 1)) / 10);
    for (let x = Math.ceil(28 - half); x < 28 + half; x++) {
      ctx.fillStyle = PALETTE.roadLight;
      ctx.fillRect(x, y + 26 + oy, 1, 1);
    }
  }
  // Хвостовой плавник слева.
  for (let i = 0; i < 8; i++) {
    R(ctx, 6 - Math.floor(i / 2), 12 + oy + i, 4, 2, PALETTE.stoneDark);
  }
  // Спинной плавник.
  R(ctx, 26, 4 + oy, 5, 7, PALETTE.stoneDark);
  // Фонтан (выше в кадре 1).
  const spout = frame === 1 ? 3 : 0;
  R(ctx, 27, 0 + oy - spout, 2, 5, PALETTE.cloud);
  R(ctx, 24, 1 + oy - spout, 2, 2, PALETTE.cloud);
  R(ctx, 30, 1 + oy - spout, 2, 2, PALETTE.cloud);
  // Глаз и жемчужина-щёчка.
  R(ctx, 42, 18 + oy, 3, 4, PALETTE.void);
  R(ctx, 43, 19 + oy, 1, 2, PALETTE.cloud);
  R(ctx, 36, 24 + oy, 4, 4, PALETTE.crystal);
}

/** Clown 36×48: колпак, круглое лицо, жабо, пуговки. */
function drawClown(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -1 : 0;
  // Колпак.
  for (let y = 0; y < 12; y++) {
    const half = 2 + y * 0.5;
    for (let x = Math.ceil(18 - half); x < 18 + half; x++) {
      ctx.fillStyle = y % 4 < 2 ? PALETTE.gold : PALETTE.earth;
      ctx.fillRect(x, y + 2 + oy, 1, 1);
    }
  }
  R(ctx, 16, 0 + oy, 4, 3, PALETTE.crystal);
  R(ctx, 11, 12 + oy, 14, 3, PALETTE.earthDark);
  // Лицо.
  for (let y = 0; y < 14; y++) {
    const half = 10 * Math.sin((Math.PI * (y + 2)) / 17);
    for (let x = Math.ceil(18 - half); x < 18 + half; x++) {
      ctx.fillStyle = PALETTE.roadLight;
      ctx.fillRect(x, y + 15 + oy, 1, 1);
    }
  }
  // Нос, глаза, улыбка.
  R(ctx, 16, 21 + oy, 4, 4, PALETTE.earth);
  R(ctx, 12, 19 + oy, 3, 3, PALETTE.void);
  R(ctx, 21, 19 + oy, 3, 3, PALETTE.void);
  R(ctx, 13, 26 + oy, 10, 1, PALETTE.earthDark);
  R(ctx, 13, 25 + oy, 1, 2, PALETTE.earthDark);
  R(ctx, 22, 25 + oy, 1, 2, PALETTE.earthDark);
  // Жабо и тело.
  R(ctx, 10, 29 + oy, 16, 4, PALETTE.cloud);
  R(ctx, 12, 33 + oy, 12, 11, PALETTE.crystal);
  R(ctx, 17, 35 + oy, 2, 3, PALETTE.gold);
  R(ctx, 17, 40 + oy, 2, 3, PALETTE.gold);
  // Руки (одна поднята по кадру).
  R(ctx, 8, 34 + oy + (frame === 1 ? -3 : 0), 3, 8, PALETTE.crystal);
  R(ctx, 25, 34 + oy + (frame === 1 ? 3 : 0), 3, 8, PALETTE.crystal);
}

/** Juggler 40×52: жонглёр, три мяча на разной высоте по кадрам. */
function drawJuggler(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -1 : 0;
  // Мячи в воздухе.
  const balls: Array<[number, number, string]> =
    frame === 0
      ? [
          [8, 6, PALETTE.gold],
          [20, 2, PALETTE.crystal],
          [32, 6, PALETTE.earth],
        ]
      : [
          [8, 2, PALETTE.gold],
          [20, 8, PALETTE.crystal],
          [32, 2, PALETTE.earth],
        ];
  for (const [bx, by, c] of balls) {
    for (let y = -3; y <= 3; y++) {
      for (let x = -3; x <= 3; x++) {
        if (x * x + y * y <= 9) {
          ctx.fillStyle = c;
          ctx.fillRect(bx + x, by + y + oy, 1, 1);
        }
      }
    }
  }
  // Шляпа-цилиндр.
  R(ctx, 15, 14 + oy, 10, 9, PALETTE.void);
  R(ctx, 12, 22 + oy, 16, 3, PALETTE.void);
  R(ctx, 15, 18 + oy, 10, 2, PALETTE.gold);
  // Лицо.
  R(ctx, 16, 25 + oy, 8, 7, PALETTE.roadLight);
  R(ctx, 17, 27 + oy, 2, 2, PALETTE.void);
  R(ctx, 21, 27 + oy, 2, 2, PALETTE.void);
  R(ctx, 18, 30 + oy, 4, 1, PALETTE.earthDark);
  // Камзол и руки вверх.
  R(ctx, 14, 32 + oy, 12, 14, PALETTE.earth);
  R(ctx, 14, 32 + oy, 12, 2, PALETTE.gold);
  R(ctx, 10, 24 + oy, 3, 10, PALETTE.earth);
  R(ctx, 27, 24 + oy, 3, 10, PALETTE.earth);
  R(ctx, 15, 46 + oy, 4, 5, PALETTE.earthDark);
  R(ctx, 21, 46 + oy, 4, 5, PALETTE.earthDark);
}

/** Magician 36×52: цилиндр, плащ, палочка со звездой. */
function drawMagician(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -1 : 0;
  const wandUp = frame === 1 ? -3 : 0;
  // Цилиндр.
  R(ctx, 12, 4 + oy, 12, 13, PALETTE.void);
  R(ctx, 12, 13 + oy, 12, 3, PALETTE.gold);
  R(ctx, 9, 16 + oy, 18, 3, PALETTE.void);
  // Плащ.
  for (let y = 0; y < 26; y++) {
    const half = 6 + y * 0.35;
    for (let x = Math.ceil(18 - half); x < 18 + half; x++) {
      ctx.fillStyle = PALETTE.void;
      ctx.fillRect(x, y + 22 + oy, 1, 1);
    }
  }
  R(ctx, 11, 22 + oy, 14, 2, PALETTE.earthDark);
  // Лицо и бабочка.
  R(ctx, 14, 20 + oy, 8, 7, PALETTE.roadLight);
  R(ctx, 15, 22 + oy, 2, 2, PALETTE.void);
  R(ctx, 19, 22 + oy, 2, 2, PALETTE.void);
  R(ctx, 15, 27 + oy, 6, 3, PALETTE.gold);
  // Палочка со звездой.
  R(ctx, 27, 26 + oy + wandUp, 2, 12, PALETTE.earth);
  R(ctx, 25, 22 + oy + wandUp, 6, 2, PALETTE.gold);
  R(ctx, 27, 20 + oy + wandUp, 2, 6, PALETTE.gold);
  R(ctx, 24, 23 + oy + wandUp, 2, 2, PALETTE.gold);
  R(ctx, 30, 23 + oy + wandUp, 2, 2, PALETTE.gold);
}

/** Elephant 60×52: туша, уши, хобот (кадр 1 закручен), бивни. */
function drawElephant(ctx: CanvasRenderingContext2D, frame: number): void {
  const oy = frame === 1 ? -1 : 0;
  // Ноги-тумбы.
  R(ctx, 14, 40 + oy, 9, 10, PALETTE.stoneDark);
  R(ctx, 38, 40 + oy, 9, 10, PALETTE.stoneDark);
  // Туша.
  R(ctx, 10, 18 + oy, 42, 24, PALETTE.stone);
  R(ctx, 10, 18 + oy, 42, 3, shade(PALETTE.stone, 1.18));
  R(ctx, 10, 39 + oy, 42, 3, PALETTE.stoneDark);
  // Ухо.
  R(ctx, 36, 14 + oy, 12, 14, shade(PALETTE.stone, 0.85));
  R(ctx, 38, 16 + oy, 8, 10, shade(PALETTE.stone, 1.1));
  // Голова.
  R(ctx, 44, 20 + oy, 12, 16, PALETTE.stone);
  // Глаз.
  R(ctx, 48, 24 + oy, 3, 4, PALETTE.void);
  R(ctx, 49, 25 + oy, 1, 2, PALETTE.cloud);
  // Бивни.
  R(ctx, 54, 30 + oy, 4, 2, PALETTE.roadLight);
  R(ctx, 54, 34 + oy, 3, 2, PALETTE.roadLight);
  // Хобот: висит или закручен.
  if (frame === 0) {
    R(ctx, 52, 28 + oy, 5, 14, PALETTE.stone);
    R(ctx, 52, 28 + oy, 1, 14, PALETTE.stoneDark);
  } else {
    R(ctx, 52, 28 + oy, 5, 8, PALETTE.stone);
    R(ctx, 52, 34 + oy, 8, 4, PALETTE.stone);
    R(ctx, 52, 28 + oy, 1, 8, PALETTE.stoneDark);
  }
  // Хвост.
  R(ctx, 8, 24 + oy, 3, 10, PALETTE.stoneDark);
  R(ctx, 7, 33 + oy, 4, 3, PALETTE.earthDark);
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
 * Силуэт каждого tier заметно выше предыдущего.
 */
function drawTowerTierExtra(
  ctx: CanvasRenderingContext2D,
  kind: 'arrow' | 'cannon' | 'ice',
  off: number,
): void {
  if (kind === 'arrow') {
    // Площадки со slab через каждые 16px, шест флага сквозь них, флажок сверху.
    for (let y = off - 4; y >= 16; y -= 16) {
      ctx.fillStyle = PALETTE.earthDark;
      ctx.fillRect(18, y, 28, 6);
      ctx.fillStyle = shade(PALETTE.earth, 1.2);
      ctx.fillRect(18, y, 28, 1);
      ctx.fillStyle = PALETTE.earth;
      ctx.fillRect(18, y - 8, 2, 8);
      ctx.fillRect(44, y - 8, 2, 8);
      ctx.fillRect(18, y - 8, 28, 2);
    }
    ctx.fillStyle = PALETTE.earthDark;
    ctx.fillRect(31, 12, 2, off - 4);
    ctx.fillStyle = PALETTE.gold;
    for (let x = 0; x < 9; x++) {
      ctx.fillRect(33 + x, 9, 1, 5 - Math.floor(x / 2));
    }
  } else if (kind === 'cannon') {
    // Верхняя сужающаяся тумба + ободок.
    for (let y = 16; y < off; y++) {
      const k = (y - 16) / Math.max(off - 16, 1);
      const half = 11 - k * 3;
      for (let x = Math.ceil(32 - half); x < 32 + half; x++) {
        ctx.fillStyle = PALETTE.stone;
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.fillRect(Math.ceil(32 - half), y, 1, 1);
      ctx.fillRect(Math.floor(32 + half) - 1, y, 1, 1);
    }
    ctx.fillStyle = shade(PALETTE.stone, 1.2);
    ctx.fillRect(20, 14, 24, 3);
    ctx.fillStyle = PALETTE.stoneDark;
    ctx.fillRect(24, 22, 2, 2);
    ctx.fillRect(35, 30, 2, 1);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(30, 18, 2, 2);
  } else {
    // Высокий обелиск поверх базового (сходятся по ширине на шве).
    const bot = off + 16;
    for (let y = 8; y < bot; y++) {
      const k = 1 - (y - 8) / (bot - 8);
      const half = 1 + 6 * k;
      for (let x = Math.ceil(32 - half); x < 32 + half; x++) {
        ctx.fillStyle = PALETTE.crystal;
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.fillStyle = shade(PALETTE.crystal, 0.55);
      ctx.fillRect(Math.ceil(32 - half), y, 1, 1);
    }
    ctx.fillStyle = PALETTE.cloud;
    ctx.fillRect(27, 14, 2, 18);
    ctx.fillStyle = PALETTE.crystal;
    ctx.fillRect(22, off - 2, 4, 12);
    ctx.fillRect(38, off - 6, 4, 14);
    ctx.fillStyle = 'rgba(102,224,255,0.30)';
    ctx.fillRect(22, 14, 2, off - 16);
    ctx.fillRect(40, 14, 2, off - 16);
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
