// Генератор уровней биомов 1–2 (level_002 … level_072).
// Запуск: npm run gen:levels
// Детерминирован: seed = номер уровня, никакого Math.random/Date.
// level_001.json — ручной туториал, генератором не трогается.

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GW = 8;
const GH = 12;

const BIOMES = {
  1: { roster: ['imp', 'goblin', 'troll'], hpBase: 1, rwBase: 1, goldBase: 100, heavy: 'troll' },
  2: { roster: ['spore', 'puffling', 'truffle'], hpBase: 1.6, rwBase: 1.4, goldBase: 130, heavy: 'truffle' },
  // Биомы 3–6: пулы волн и базы сложности.
  // Базы предполагают tier3-апгрейды к концу биома,
  // финальный тюнинг — после шага баланс-симулятора.
  3: { roster: ['jelly', 'caramel', 'chocgolem', 'candyfairy'], hpBase: 2.4, rwBase: 1.9, goldBase: 170, heavy: 'chocgolem' },
  4: { roster: ['balloon', 'cloudsheep', 'stormling', 'fluffdragon'], hpBase: 3.4, rwBase: 2.6, goldBase: 215, heavy: 'fluffdragon' },
  5: { roster: ['clownfish', 'jellyfish', 'seahorse', 'pearlwhale'], hpBase: 4.8, rwBase: 3.5, goldBase: 270, heavy: 'pearlwhale' },
  6: { roster: ['clown', 'juggler', 'magician', 'elephant'], hpBase: 6.5, rwBase: 4.6, goldBase: 330, heavy: 'elephant' },
};

const FLYING_TYPES = new Set(['spore', 'candyfairy', 'balloon', 'fluffdragon', 'magician']);

const r2 = (v) => Math.round(v * 100) / 100;

/** Путь: спуск сверху вниз (y 0→11) с боковыми вихорами; 8-связность, без повторов. */
function genPath(rnd, lib) {
  const L = Math.round(14 + ((lib - 1) * 12) / 35); // 14..26
  let x = Math.floor(rnd() * GW);
  const cells = [[x, 0]];
  // Распределить E доборных клеток по 11 промежуткам (макс 3 на промежуток).
  let remaining = L - 12;
  const extras = new Array(GH - 1).fill(0);
  let g = Math.floor(rnd() * (GH - 1));
  while (remaining > 0) {
    const room = 3 - extras[g];
    if (room > 0) {
      const take = Math.min(remaining, 1 + Math.floor(rnd() * room));
      extras[g] += take;
      remaining -= take;
    }
    g = (g + 1) % (GH - 1);
  }
  for (let y = 0; y < GH - 1; y++) {
    // Вихор в строке y (монотонно — повторов нет).
    const dir = x <= GW / 2 - 1 ? 1 : -1;
    for (let i = 0; i < extras[y]; i++) {
      x += dir;
      cells.push([x, y]);
    }
    // Спуск (8-связный).
    const dx = Math.floor(rnd() * 3) - 1;
    x = Math.max(0, Math.min(GW - 1, x + dx));
    cells.push([x, y + 1]);
  }
  return cells;
}

/** Точки строительства: смежные с путём, не на пути; 3..8 штук. */
function genBuildPoints(rnd, path, lib) {
  const target = Math.min(8, 3 + Math.floor(((lib - 1) * 5) / 35));
  const onPath = new Set(path.map(([x, y]) => x + ',' + y));
  const cand = [];
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      if (onPath.has(x + ',' + y)) continue;
      let adj = false;
      for (let dy = -1; dy <= 1 && !adj; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (onPath.has(x + dx + ',' + (y + dy))) {
            adj = true;
            break;
          }
        }
      }
      if (adj) cand.push([x, y]);
    }
  }
  for (let i = cand.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [cand[i], cand[j]] = [cand[j], cand[i]];
  }
  return cand.slice(0, Math.min(target, cand.length));
}

/** 5 волн: ранние — 2 НЕлетающих типа, поздние — весь пул, flying ≤ 4 за волну. */
function genWaves(rnd, biome) {
  const waves = [];
  const nonFly = biome.roster.filter((t) => !FLYING_TYPES.has(t));
  for (let i = 0; i < 5; i++) {
    const count = Math.round(5 + i * (7 / 4)); // 5 → 12
    const delay = r2(1.0 - i * 0.1375); // 1.0 → 0.45
    const types = i < 2 ? nonFly.slice(0, 2) : [...biome.roster];
    const spawns = [];
    let rest = count;
    types.forEach((t, ti) => {
      if (ti === types.length - 1) {
        spawns.push({ enemy: t, count: rest, delay });
      } else {
        const c = Math.max(1, Math.round((count / types.length) * (0.7 + rnd() * 0.6)));
        const take = Math.min(rest - (types.length - ti - 1), c);
        spawns.push({ enemy: t, count: take, delay });
        rest -= take;
      }
    });
    if (i >= 2) capFlying(spawns, 4);
    waves.push({ number: i + 1, spawns });
  }
  return waves;
}

/** Срезать летунов сверх капа, переложив единицы в нелетающие записи.
 *  Элитные записи не трогает (ни убавить, ни добавить). */
function capFlying(spawns, cap) {
  const flyIdx = spawns
    .map((s, i) => (FLYING_TYPES.has(s.enemy) && !s.elite ? i : -1))
    .filter((i) => i >= 0);
  const nonFly = spawns
    .map((s, i) => (!FLYING_TYPES.has(s.enemy) && !s.elite ? i : -1))
    .filter((i) => i >= 0);
  if (flyIdx.length === 0 || nonFly.length === 0) return;
  let over = flyIdx.reduce((s, i) => s + spawns[i].count, 0) - cap;
  let ni = 0;
  while (over > 0) {
    let bi = flyIdx[0];
    for (const idx of flyIdx) if (spawns[idx].count > spawns[bi].count) bi = idx;
    if (spawns[bi].count <= 0) break;
    spawns[bi].count -= 1;
    spawns[nonFly[ni % nonFly.length]].count += 1;
    ni += 1;
    over -= 1;
  }
}

/** Terrain и ветер по биомам: choco на пути (3), wind по осям (4), bubble-зоны (5). */
function genTerrainWind(rnd, biomeId, path) {
  const terrain = [];
  let wind = null;
  if (biomeId === 3) {
    // 4–8 плиток choco на клетках пути.
    const order = [...path];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const count = 4 + Math.floor(rnd() * 5);
    for (const [x, y] of order.slice(0, Math.min(count, order.length))) {
      terrain.push({ x, y, kind: 'choco' });
    }
  } else if (biomeId === 4) {
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const [dx, dy] = dirs[Math.floor(rnd() * dirs.length)];
    wind = { dx, dy };
  } else if (biomeId === 5) {
    // 2–3 зоны радиусом 2 с центрами на клетках пути (подальше друг от друга).
    const zoneCount = 2 + (rnd() < 0.5 ? 0 : 1);
    const centers = [];
    const spaced = [...path].filter(
      (_, idx) => idx % 4 === 0 || idx === path.length - 1,
    );
    for (let i = spaced.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [spaced[i], spaced[j]] = [spaced[j], spaced[i]];
    }
    for (const [cx, cy] of spaced.slice(0, Math.min(zoneCount, spaced.length))) {
      centers.push([cx, cy]);
    }
    const seen = new Set();
    for (const [cx, cy] of centers) {
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          const k = x + ',' + y;
          if (seen.has(k)) continue;
          if (Math.hypot(x - cx, y - cy) <= 2) {
            seen.add(k);
            terrain.push({ x, y, kind: 'bubble' });
          }
        }
      }
    }
  }
  return { terrain, wind };
}

export function generateLevel(n) {
  const biomeId = n <= 36 ? 1 : n <= 72 ? 2 : n <= 108 ? 3 : n <= 144 ? 4 : n <= 180 ? 5 : 6;
  const lib = ((n - 1) % 36) + 1;
  const B = BIOMES[biomeId];
  const rnd = mulberry32(n);
  const path = genPath(rnd, lib);
  const buildPoints = genBuildPoints(rnd, path, lib);
  // Flying-коридор (биомы 2, 3, 4, 6): 2 точки вдоль прямой спавн→кристалл
  // (средняя колонка, y около 4 и 8), в конец списка. Сим берёт первую оттуда.
  if ([2, 3, 4, 6].includes(biomeId)) {
    const [x0] = path[0];
    const [x1] = path[path.length - 1];
    const mx = Math.max(0, Math.min(GW - 1, Math.round((x0 + x1) / 2)));
    const taken = new Set([
      ...path.map(([x, y]) => x + ',' + y),
      ...buildPoints.map(([x, y]) => x + ',' + y),
    ]);
    for (const cy of [4, 8]) {
      const k = mx + ',' + cy;
      if (!taken.has(k)) {
        taken.add(k);
        buildPoints.push([mx, cy]);
      }
    }
  }
  const waves = genWaves(rnd, B);
  const { terrain, wind } = genTerrainWind(rnd, biomeId, path);
  const isBoss = n === 36 || n === 72 || n === 108 || n === 144 || n === 180 || n === 216;
  if (isBoss) {
    waves[4].spawns.push({ enemy: B.heavy, count: 1, delay: 1.0, elite: true });
    // Летящий босс занимает слот капа: срезать обычных летунов до 3.
    if (FLYING_TYPES.has(B.heavy)) capFlying(waves[4].spawns, 3);
  }
  return {
    biomeId,
    levelNumber: n,
    gridSize: { width: GW, height: GH },
    path: path.map(([x, y]) => ({ x, y })),
    buildPoints: buildPoints.map(([x, y]) => ({ x, y })),
    waves,
    difficulty: {
      hpMul: r2(B.hpBase * (1 + 0.06 * (lib - 1))),
      rewardMul: r2(B.rwBase * (1 + 0.06 * (lib - 1))),
      startingGold: B.goldBase + 8 * (lib - 1),
    },
    environmentEffects: [],
    terrain,
    wind,
    boss: isBoss ? { type: 'elite' } : null,
  };
}

const here = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outDir = process.env.GEN_OUT || resolve(here, '../src/game/levels');
  for (let n = 2; n <= 216; n++) {
    const pad = String(n).padStart(3, '0');
    writeFileSync(resolve(outDir, `level_${pad}.json`), JSON.stringify(generateLevel(n), null, 2) + '\n');
  }
  console.log('generated levels 2..216 (215 files)');
}
