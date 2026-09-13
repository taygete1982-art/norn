// Headless баланс-симулятор: бой БЕЗ Pixi и ECS, только конфиги + чистая математика,
// повторяющая правила игры. АВТОТЮНИНГ ЗАПРЕЩЁН: только измеряет и пишет отчёт.
//
// Запуск: npm run sim:balance
//   → таблица по биомам в консоль + tools/simReport.json (поуровневые данные).
// Точечно: node tools/simulateBalance.mjs --level N --policy reference|none|adaptive
//   → один JSON результата в stdout (для санити-тестов).
//
// Правила (зеркало игры):
// - кулдаун = fireRate / fireRateMul, bubble ×1.25, карнавальный бафф ÷1.5,
//   танец и spore_clouds блокируют стрельбу;
// - damageType против armorPhysical (physical = 0);
// - splitOnDeath с капом 200 сущностей на волну, осколки с обычной наградой;
// - flying по прямой, утечка у кристалла;
// - slow от ice (×0.5 на slowDuration), aoe от cannon (×aoeMul);
// - choco: скорость ×1.3, входящий magic ×1.2; wind ×1.15 / ×0.85 по dot;
// - hp = round(base*hpMul) (elite ×6), reward = round(base*rewardMul) (elite ×8);
// - волны/очередь/переход как в WaveSpawnerSystem; победа = волны кончились
//   и поле пусто, кристалл жив.
//
// Эталонная политика игрока (dumb):
// - точки строятся по покрытию пути (сумма 1/dist до плиток пути);
// - порядок: 1-я и 2-я точки — arrow, 3-я — ice, 4-я и дальше — cannon;
// - таргетинг: ближайший к башне;
// - апгрейды в приоритете: как только хватает золота — старейшая башня
//   до t2, затем до t3, затем следующая постройка; продажа не используется.
//
// Адаптивная политика (adaptive) — верхняя граница разумной игры:
// - против пула с armorPhysical: cannon, cannon, ice, затем arrow;
// - против пула с flying (без брони): чередование ice/arrow,
//   первая точка — из flying-коридора (2 последние точки уровня);
// - таргетинг: ближайший к кристаллу (first);
// - апгрейды как у эталона; продажа не используется в обеих политиках.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const ENEMIES = readJson(resolve(root, 'src/game/config/enemies.json')).enemies;
const TOWERS = readJson(resolve(root, 'src/game/config/towers.json')).towers;
const EN = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));
const TW = Object.fromEntries(TOWERS.map((t) => [t.id, t]));

// Шаг симуляции. Игра тикает на ~60fps: мелкий шаг точнее повторяет
// непрерывный бой (крупный шаг систематически режет DPS окнами радиуса).
const DT = 0.025;
const MAX_T = 1800;
const CRYSTAL_MAX = 20;
const SPLIT_CAP = 200;

function coverageOrder(level) {
  const road = level.path;
  return level.buildPoints
    .map((bp, i) => {
      let cov = 0;
      for (const c of road) {
        const d = Math.hypot(bp.x - c.x, bp.y - c.y);
        if (d > 1e-6) cov += 1 / d;
      }
      return { bp, cov, i };
    })
    .sort((a, b) => b.cov - a.cov || a.i - b.i)
    .map((o) => o.bp);
}

function buildTypeBySlot(slot) {
  if (slot === 2) return 'ice';
  if (slot >= 3) return 'cannon';
  return 'arrow';
}

/** План политики: порядок точек + тип по слоту. Коридор = 2 последние точки. */
function planForPolicy(level, policy) {
  const order = coverageOrder(level);
  if (policy !== 'adaptive') return { order, typeAt: buildTypeBySlot };
  const pool = new Set(level.waves.flatMap((w) => w.spawns.map((s) => s.enemy)));
  const has = (ab) => [...pool].some((t) => (EN[t].abilities ?? []).includes(ab));
  const hasArmor = has('armorPhysical');
  const hasFlying = has('flying');
  let pts = order.slice();
  if (hasFlying && level.buildPoints.length >= 2) {
    const last2 = new Set(level.buildPoints.slice(-2).map((p) => `${p.x},${p.y}`));
    const corr = pts.filter((p) => last2.has(`${p.x},${p.y}`));
    const rest = pts.filter((p) => !last2.has(`${p.x},${p.y}`));
    if (corr.length > 0) pts = [corr[0], ...rest, ...corr.slice(1)];
  }
  let typeAt;
  if (hasArmor) {
    const seq = ['cannon', 'cannon', 'ice', 'arrow'];
    typeAt = (slot) => seq[Math.min(slot, seq.length - 1)];
  } else if (hasFlying) {
    typeAt = (slot) => (slot % 2 === 0 ? 'ice' : 'arrow');
  } else {
    typeAt = buildTypeBySlot;
  }
  return { order: pts, typeAt };
}

function effStats(tw, tier) {
  const tc = tw.tiers[Math.min(tier, tw.tiers.length) - 1];
  return {
    damage: tw.damage * tc.damageMul,
    cooldown: tw.fireRate / tc.fireRateMul,
    range: tw.range * tc.rangeMul,
    aoe: tw.aoeRadius !== undefined ? tw.aoeRadius * (tc.aoeMul ?? 1) : undefined,
  };
}

function simulateLevel(level, policy) {
  const path = level.path;
  const last = path[path.length - 1];
  const segLens = [];
  for (let i = 0; i < path.length - 1; i++) {
    segLens.push(Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y));
  }
  const choco =
    level.biomeId === 3
      ? new Set(level.terrain.filter((t) => t.kind === 'choco').map((t) => `${t.x},${t.y}`))
      : new Set();
  const bubbles =
    level.biomeId === 5
      ? new Set(level.terrain.filter((t) => t.kind === 'bubble').map((t) => `${t.x},${t.y}`))
      : new Set();
  const wind = level.biomeId === 4 ? level.wind : null;
  const inBubble = (gx, gy) => {
    if (level.biomeId !== 5) return false;
    const cx = Math.round(gx);
    const cy = Math.round(gy);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) if (bubbles.has(`${cx + dx},${cy + dy}`)) return true;
    return false;
  };
  const isChoco = (gx, gy) => level.biomeId === 3 && choco.has(`${Math.round(gx)},${Math.round(gy)}`);

  let gold = level.difficulty.startingGold;
  let crystal = CRYSTAL_MAX;
  let t = 0;
  let waveIdx = 0;
  let queue = [];
  let status = 'spawning';
  const towers = []; // {type, gx, gy, tier, lastFire}
  const enemies = [];
  const plan = planForPolicy(level, policy);
  const order = plan.order;
  let buildIdx = 0;
  let spawnedThisWave = 0;
  // env-таймеры
  let nextCloudAt = 30;
  let cloud = null;
  let nextDanceAt = 40;
  let dance = null;

  const startWave = () => {
    queue = [];
    const wave = level.waves[waveIdx];
    for (const s of wave.spawns) {
      for (let i = 0; i < s.count; i++) {
        queue.push({ type: s.enemy, at: t + i * s.delay, elite: s.elite ?? false });
      }
    }
    queue.sort((a, b) => a.at - b.at);
    spawnedThisWave = 0;
  };

  const spawnEnemy = (type, gx, gy, elite) => {
    const st = EN[type];
    const hp = Math.round(st.hp * level.difficulty.hpMul) * (elite ? 6 : 1);
    enemies.push({
      type,
      hp,
      maxHp: hp,
      speed: st.speed,
      reward: Math.round(st.reward * level.difficulty.rewardMul) * (elite ? 8 : 1),
      damage: st.damage,
      abilities: st.abilities ?? [],
      splitInto: st.splitInto,
      x: gx,
      y: gy,
      seg: 0,
      segT: 0,
      slowUntil: -1,
      noSplit: false,
    });
  };

  const economy = () => {
    if (policy === 'none') return;
    for (;;) {
      let acted = false;
      const oldest = towers.find((tw) => tw.tier < 3);
      if (oldest) {
        const cost = TW[oldest.type].tiers[oldest.tier].upgradeCost;
        if (cost !== null && gold >= cost) {
          gold -= cost;
          oldest.tier += 1;
          acted = true;
          continue;
        }
      }
      if (buildIdx < order.length) {
        const type = plan.typeAt(buildIdx);
        const cost = TW[type].cost;
        if (gold >= cost) {
          gold -= cost;
          const bp = order[buildIdx];
          towers.push({ type, gx: bp.x, gy: bp.y, tier: 1, lastFire: 0 });
          buildIdx += 1;
          acted = true;
          continue;
        }
      }
      if (!acted) break;
    }
  };

  startWave();
  economy();

  while (t < MAX_T) {
    t = Math.round((t + DT) * 1e9) / 1e9;
    // спавн
    while (queue.length > 0 && queue[0].at <= t) {
      const ev = queue.shift();
      spawnEnemy(ev.type, path[0].x, path[0].y, ev.elite);
    }
    // env: споры
    if (level.biomeId === 2) {
      if (cloud && t >= cloud.until) cloud = null;
      if (!cloud && t >= nextCloudAt && level.buildPoints.length > 0) {
        const bp = level.buildPoints[Math.floor(t / 30) % level.buildPoints.length];
        cloud = { x: bp.x, y: bp.y, until: t + 5 };
        nextCloudAt = t + 30;
      }
    }
    // env: карнавал
    if (level.biomeId === 6) {
      if (dance && t >= dance.buffUntil) dance = null;
      if (!dance && t >= nextDanceAt) {
        if (towers.length > 0) {
          const idx = Math.floor(t / 40) % towers.length;
          dance = { idx, tower: towers[idx], danceUntil: t + 3, buffUntil: t + 8 };
          nextDanceAt = t + 40;
        } else {
          nextDanceAt = t + 40;
        }
      }
    }
    // стрельба
    for (const tw of towers) {
      if (cloud && Math.hypot(tw.gx - cloud.x, tw.gy - cloud.y) <= 1.5) continue;
      if (dance && dance.tower === tw && t < dance.danceUntil) continue;
      const eff = effStats(TW[tw.type], tw.tier);
      let cd = eff.cooldown;
      if (inBubble(tw.gx, tw.gy)) cd *= 1.25;
      if (dance && dance.tower === tw && t >= dance.danceUntil && t < dance.buffUntil) cd /= 1.5;
      if (t - tw.lastFire < cd) continue;
      let best = null;
      let bestD = Infinity;
      let bestC = Infinity;
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - tw.gx, e.y - tw.gy);
        if (d > eff.range) continue;
        if (policy === 'adaptive') {
          // first: ближайший к кристаллу, ничья — ближайший к башне.
          const dc = Math.hypot(e.x - last.x, e.y - last.y);
          if (dc < bestC || (dc === bestC && d < bestD)) {
            bestC = dc;
            bestD = d;
            best = e;
          }
        } else if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (!best) continue;
      const victims =
        eff.aoe !== undefined
          ? enemies.filter((e) => e.hp > 0 && Math.hypot(e.x - best.x, e.y - best.y) <= eff.aoe)
          : [best];
      for (const e of victims) {
        if (TW[tw.type].damageType === 'physical' && e.abilities.includes('armorPhysical')) continue;
        let dmg = eff.damage;
        if (TW[tw.type].damageType === 'magic' && isChoco(e.x, e.y)) dmg *= 1.2;
        e.hp -= dmg;
        const twCfg = TW[tw.type];
        if (twCfg.slowAmount !== undefined) e.slowUntil = Math.max(e.slowUntil, t + twCfg.slowDuration);
      }
      tw.lastFire = t;
    }
    // движение
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      let mult = t < e.slowUntil ? 1 - 0.5 : 1;
      if (e.abilities.includes('flying')) {
        const dx = last.x - e.x;
        const dy = last.y - e.y;
        const d = Math.hypot(dx, dy);
        const dirx = d > 0 ? dx / d : 0;
        const diry = d > 0 ? dy / d : 0;
        if (isChoco(e.x, e.y)) mult *= 1.3;
        if (wind) mult *= dirx * wind.dx + diry * wind.dy > 0 ? 1.15 : 0.85;
        const step = e.speed * mult * DT;
        if (d <= step) {
          e.x = last.x;
          e.y = last.y;
        } else {
          e.x += dirx * step;
          e.y += diry * step;
        }
        continue;
      }
      if (e.seg < segLens.length) {
        const a = path[e.seg];
        const b = path[e.seg + 1];
        const L = segLens[e.seg];
        const dirx = L > 0 ? (b.x - a.x) / L : 0;
        const diry = L > 0 ? (b.y - a.y) / L : 0;
        if (isChoco(e.x, e.y)) mult *= 1.3;
        if (wind) mult *= dirx * wind.dx + diry * wind.dy > 0 ? 1.15 : 0.85;
        let remaining = e.speed * mult * DT;
        while (remaining > 0 && e.seg < segLens.length) {
          const left = segLens[e.seg] - e.segT;
          if (remaining < left) {
            e.segT += remaining;
            remaining = 0;
          } else {
            remaining -= left;
            e.seg += 1;
            e.segT = 0;
          }
        }
      }
      if (e.seg >= segLens.length) {
        e.x = last.x;
        e.y = last.y;
      } else {
        const a = path[e.seg];
        const b = path[e.seg + 1];
        const L = segLens[e.seg] || 1;
        const k = e.segT / L;
        e.x = a.x + (b.x - a.x) * k;
        e.y = a.y + (b.y - a.y) * k;
      }
    }
    // смерти, сплиты, утечки
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.hp <= 0) {
        gold += e.reward;
        if (e.splitInto && !e.noSplit && spawnedThisWave < SPLIT_CAP) {
          for (let k = 0; k < e.splitInto.count && spawnedThisWave < SPLIT_CAP; k++) {
            spawnEnemy(e.splitInto.type, e.x, e.y, false);
            enemies[enemies.length - 1].noSplit = true;
            spawnedThisWave += 1;
          }
        }
        enemies.splice(i, 1);
      } else {
        const atCrystal =
          e.abilities.includes('flying')
            ? Math.hypot(e.x - last.x, e.y - last.y) < 0.2
            : e.seg >= segLens.length;
        if (atCrystal) {
          crystal -= e.damage;
          enemies.splice(i, 1);
          if (crystal <= 0) break;
        }
      }
    }
    if (crystal <= 0) break;
    economy();
    // переход волн
    if (queue.length === 0 && enemies.length === 0) {
      waveIdx += 1;
      if (waveIdx >= level.waves.length) break;
      startWave();
    }
  }

  const win = crystal > 0 && queue.length === 0 && enemies.length === 0 && waveIdx >= level.waves.length;
  const stars = !win ? 0 : crystal >= CRYSTAL_MAX ? 3 : crystal >= CRYSTAL_MAX / 2 ? 2 : 1;
  return {
    levelNumber: level.levelNumber,
    biomeId: level.biomeId,
    win,
    crystalLeft: Math.max(0, Math.round(crystal)),
    stars,
    duration: Math.round(t * 10) / 10,
  };
}

function loadLevels() {
  return readdirSync(resolve(root, 'src/game/levels'))
    .filter((f) => /^level_\d+\.json$/.test(f))
    .sort()
    .map((f) => readJson(resolve(root, 'src/game/levels', f)));
}

function main() {
  const args = process.argv.slice(2);
  const li = args.indexOf('--level');
  const pi = args.indexOf('--policy');
  if (li !== -1) {
    const n = Number(args[li + 1]);
    const policy = pi !== -1 ? args[pi + 1] : 'reference';
    const level = loadLevels().find((l) => l.levelNumber === n);
    if (!level) {
      console.error(`no such level: ${n}`);
      process.exit(2);
    }
    console.log(JSON.stringify(simulateLevel(level, policy)));
    return;
  }
  const levels = loadLevels();
  const slim = (r) => ({ win: r.win, crystalLeft: r.crystalLeft, stars: r.stars, duration: r.duration });
  const rows = levels.map((l) => {
    const sim = simulateLevel(l, 'reference');
    const ad = simulateLevel(l, 'adaptive');
    return {
      levelNumber: l.levelNumber,
      biomeId: l.biomeId,
      dumb: slim(sim),
      adaptive: slim(ad),
    };
  });
  const summarize = (key) => {
    const byBiome = {};
    for (const r of rows) {
      const s = (byBiome[r.biomeId] ??= { levels: 0, wins: 0, stars: 0, crystal: 0 });
      s.levels += 1;
      if (r[key].win) s.wins += 1;
      s.stars += r[key].stars;
      s.crystal += r[key].crystalLeft;
    }
    const summary = {};
    console.log(`policy ${key} | biome | levels | wins | winrate | avgStars | avgCrystal`);
    for (const b of Object.keys(byBiome).sort((a, z) => Number(a) - Number(z))) {
      const s = byBiome[b];
      summary[b] = {
        levels: s.levels,
        wins: s.wins,
        winrate: Math.round((s.wins / s.levels) * 1000) / 10,
        avgStars: Math.round((s.stars / s.levels) * 100) / 100,
        avgCrystal: Math.round((s.crystal / s.levels) * 100) / 100,
      };
      console.log(
        `${key} | ${b} | ${s.levels} | ${s.wins} | ${summary[b].winrate}% | ${summary[b].avgStars} | ${summary[b].avgCrystal}`,
      );
    }
    return summary;
  };
  const report = { levels: rows, summary: { dumb: summarize('dumb'), adaptive: summarize('adaptive') } };
  writeFileSync(resolve(here, 'simReport.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('wrote tools/simReport.json');
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) main();

export { simulateLevel, loadLevels };
