/**
 * Предрендер освещения тёмного острова (канон #05, dark-engine-lite).
 *
 * Никаких динамических источников в кадре: свет запекается в offscreen
 * canvas и кладётся аддитивным спрайтом, туман-виньетка — multiply-слоем.
 * Перестройка lightMap — только по событию (постройка/продажа/апгрейд башни).
 */

export interface GridPos {
  gx: number;
  gy: number;
}

/** Изометрия тайла 64×32: те же константы, что в IsoMath/App. */
const ISO_X = 32;
const ISO_Y = 16;

/** Радиусы света в пикселях: кристалл 6 клеток, факел 2 клетки. */
const CRYSTAL_RADIUS = 6 * ISO_X;
const TORCH_RADIUS = 2 * ISO_X;

/** Цвета света. */
const CRYSTAL_RGB: [number, number, number] = [0x35, 0xe0, 0xff];
const TORCH_RGB: [number, number, number] = [0xff, 0x9a, 0x3c];

/** Пик формы света: кристалл 1.0, факел 0.8 (глобальная альфа слоя 0.12–0.18). */
const CRYSTAL_PEAK = 1.0;
const TORCH_PEAK = 0.8;

/** Пульсация кристалла: альфа lightMap-спрайта, период — секунды. */
export const LIGHT_PULSE_MIN = 0.12;
export const LIGHT_PULSE_MAX = 0.18;
export const LIGHT_PULSE_PERIOD = 3;

/** Максимальная альфа тумана по краям кадра. */
export const FOG_EDGE_ALPHA = 0.7;

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w));
  cv.height = Math.max(1, Math.round(h));
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [cv, ctx];
}

/** Квадратичное затухание 1 → 0 на радиусе. */
function falloff(dist: number, radius: number): number {
  if (dist >= radius) return 0;
  const k = 1 - dist / radius;
  return k * k;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Параметры последней сборки — для пересборки по updateTorches. */
let lastGridW = 0;
let lastGridH = 0;
let lastCrystal: GridPos = { gx: 0, gy: 0 };
let hasParams = false;

/** Экранные координаты центра клетки внутри lightMap-canvas. */
function cellToLight(
  gx: number,
  gy: number,
  lightW: number,
): { x: number; y: number } {
  return { x: (gx - gy) * ISO_X + lightW / 2, y: (gx + gy) * ISO_Y };
}

function paintLightMap(
  ctx: CanvasRenderingContext2D,
  lightW: number,
  lightH: number,
  crystal: GridPos,
  torches: GridPos[],
): void {
  const img = ctx.createImageData(lightW, lightH);
  const data = img.data;
  const cc = cellToLight(crystal.gx, crystal.gy, lightW);
  const tc = torches.map((t) => cellToLight(t.gx, t.gy, lightW));
  for (let y = 0; y < lightH; y++) {
    for (let x = 0; x < lightW; x++) {
      const dc = Math.hypot(x - cc.x, y - cc.y);
      const sc = falloff(dc, CRYSTAL_RADIUS) * CRYSTAL_PEAK;
      let st = 0;
      for (const t of tc) {
        const d = Math.hypot(x - t.x, y - t.y);
        const s = falloff(d, TORCH_RADIUS) * TORCH_PEAK;
        if (s > st) st = s;
      }
      const i = (y * lightW + x) * 4;
      data[i] = Math.min(255, Math.round(sc * CRYSTAL_RGB[0] + st * TORCH_RGB[0]));
      data[i + 1] = Math.min(255, Math.round(sc * CRYSTAL_RGB[1] + st * TORCH_RGB[1]));
      data[i + 2] = Math.min(255, Math.round(sc * CRYSTAL_RGB[2] + st * TORCH_RGB[2]));
      data[i + 3] = Math.round(Math.max(sc, st) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Строит карту света размером с остров.
 * Пиксель хранит цвет света и нормированную форму (пик 1.0);
 * рабочую яркость задаёт альфа спрайта (пульсация 0.12–0.18).
 */
export function buildLightMap(
  gridW: number,
  gridH: number,
  crystalPos: GridPos,
  torchPositions: GridPos[],
): HTMLCanvasElement {
  lastGridW = gridW;
  lastGridH = gridH;
  lastCrystal = { gx: crystalPos.gx, gy: crystalPos.gy };
  hasParams = true;
  const lightW = (gridW + gridH) * ISO_X;
  const lightH = (gridW + gridH) * ISO_Y + 96;
  const [cv, ctx] = makeCanvas(lightW, lightH);
  paintLightMap(ctx, cv.width, cv.height, lastCrystal, torchPositions);
  return cv;
}

/**
 * Перестраивает lightMap при постройке/продаже/апгрейде башни.
 * С пустым массивом не падает (остаётся только свет кристалла).
 * До первого buildLightMap возвращает прозрачный canvas 1×1.
 */
export function updateTorches(torchPositions: GridPos[]): HTMLCanvasElement {
  if (!hasParams) {
    const [cv, ctx] = makeCanvas(1, 1);
    ctx.clearRect(0, 0, 1, 1);
    return cv;
  }
  return buildLightMap(lastGridW, lastGridH, lastCrystal, torchPositions);
}

/**
 * Туман-виньетка на весь портретный кадр: центр прозрачный,
 * к краям чёрный до FOG_EDGE_ALPHA. Маскирует кромки острова в туман.
 */
export function buildFogVignette(screenW: number, screenH: number): HTMLCanvasElement {
  const [cv, ctx] = makeCanvas(screenW, screenH);
  const img = ctx.createImageData(cv.width, cv.height);
  const data = img.data;
  const cx = cv.width / 2;
  const cy = cv.height / 2;
  const maxDist = Math.hypot(cx, cy);
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      const d = Math.hypot(x - cx, y - cy) / maxDist;
      const a = FOG_EDGE_ALPHA * smoothstep(0.35, 0.75, d);
      const i = (y * cv.width + x) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
