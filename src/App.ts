import { Application, CanvasSource, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { IsoMath } from './iso/IsoMath';
import { World } from './ecs/world';
import { GameStateManager } from './game/GameState';
import { ConfigLoader } from './game/config/ConfigLoader';
import { getTile, getRoadKeys, PAL, TileId, torchGlow } from './art/PixelArt';
import { STONE, glyph, stonePanel } from './ui/StoneTheme';
import {
  buildLightMap,
  buildFogVignette,
  updateTorches,
  LIGHT_PULSE_MIN,
  LIGHT_PULSE_MAX,
  LIGHT_PULSE_PERIOD,
} from './art/Lighting';
import { TowerFactory } from './game/entities/TowerFactory';
import { EnemyFactory } from './game/entities/EnemyFactory';
import {
  tierConfigOf,
  effectiveStats,
  upgradeCostOf,
  sellValue,
  applyUpgrade,
  sellTower,
} from './game/Upgrades';
import { TowerSelectMenu } from './ui/TowerSelectMenu';
import { TowerUpgradeMenu } from './ui/TowerUpgradeMenu';
import { EffectsLayer } from './ui/EffectsLayer';
import { WaveSpawnerSystem } from './game/systems/WaveSpawnerSystem';
import { TowerAttackSystem } from './game/systems/TowerAttackSystem';
import { MoveSystem, PATH, setPath } from './game/systems/MoveSystem';
import { EnvironmentSystem } from './game/systems/EnvironmentSystem';
import { BossSystem } from './game/systems/BossSystem';
import { LevelConfig } from './game/levels/types';
import { LevelLoader } from './game/levels/LevelLoader';
import { RulesSystem } from './game/systems/RulesSystem';
import { HealthSystem } from './game/systems/HealthSystem';

const W = 720;
const H = 1280;
const ORIGIN_X = 360;
const ORIGIN_Y = 320;

interface BuildPoint {
  gx: number;
  gy: number;
  towerId: number | null;
}

export interface GameEndResult {
  won: boolean;
  crystalHP: number;
  crystalMax: number;
}

const PROJ_TILES: Record<string, TileId> = {
  arrow: 'proj_arrow',
  cannon: 'proj_cannon',
  ice: 'proj_ice',
};

const TOWER_TILES: Record<string, TileId> = {
  arrow: 'tower_arrow',
  cannon: 'tower_cannon',
  ice: 'tower_ice',
};

/** Тайл башни по tier'у: t1 базовый, t2/t3 этажные. */
function towerTileFor(kind: string, tier: number): TileId {
  if (!(kind in TOWER_TILES)) return 'tower_arrow';
  if (tier >= 3) return `tower_${kind}_t3` as TileId;
  if (tier === 2) return `tower_${kind}_t2` as TileId;
  return TOWER_TILES[kind];
}

/** Префикс тайла врага; неизвестные типы падают на гоблина. */
const KNOWN_ENEMY_PREFIXES = new Set([
  'goblin',
  'troll',
  'imp',
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
]);

function enemyTilePrefix(type: string): string {
  return KNOWN_ENEMY_PREFIXES.has(type) ? type : 'goblin';
}

/** ~4 кадра/сек покачивания врагов. */
const ENEMY_FRAME_DUR = 0.25;

const SLOW_TINT_COLOR = 0x6fd3ff;

export class MainScene extends Container {
  private world = new World();
  private level: LevelConfig;
  private buildPoints: BuildPoint[] = [];
  private gridW = 8;
  private gridH = 12;
  private onGameEnd: ((r: GameEndResult) => void) | null = null;
  private endNotified = false;
  private iso = new IsoMath({ x: 32, y: 16 });
  // Порядок слоёв: фон < остров < тени < сущности < свет < fx < туман < UI-плашка < bottom-sheet.
  private bgLayer = new Container();
  private islandLayer = new Container();
  private shadowStatic = new Graphics();
  private shadowDyn = new Graphics();
  private dynamicLayer = new Graphics();
  private uiLayer = new Container();
  // Предрендер света: аддитивный слой + туман-виньетка (канон #05).
  private lightSprite: Sprite | null = null;
  private fogSprite: Sprite | null = null;
  private lightT = 0;
  // Факелы башен и пульсация кристалла (канон #06).
  private torchGlows = new Map<number, Sprite>();
  private crystalSprite: Sprite | null = null;
  private crystalFrame = 0;
  private clouds: Array<{ s: Sprite; v: number }> = [];
  // Пиксельные спрайты сущностей (reconcile по id): тени < unitLayer < dynamicLayer.
  private unitLayer = new Container();
  private towerSprites = new Map<number, Sprite>();
  private enemySprites = new Map<number, { s: Sprite; t: number; f: number; lx: number; dir: number }>();
  private hudWave!: Text;
  private hudGold!: Text;
  private hudCrystal!: Text;
  private hudCenter!: Text;
  private hudSub!: Text;
  private menu: TowerSelectMenu | null = null;
  private upgradeMenu: TowerUpgradeMenu | null = null;
  private cloudSprite: Sprite | null = null;
  private buffFlashed = new Set<number>();
  private windArrows: Array<{ s: Sprite; vx: number; vy: number }> = [];
  private toastText!: Text;
  private toastT = 99;
  private fx = new EffectsLayer();

  constructor(level: LevelConfig, opts: { onGameEnd?: (r: GameEndResult) => void } = {}) {
    super();
    this.level = level;
    this.onGameEnd = opts.onGameEnd ?? null;
    this.gridW = level.gridSize.width;
    this.gridH = level.gridSize.height;
    this.buildPoints = level.buildPoints.map((p) => ({ gx: p.x, gy: p.y, towerId: null }));
    this.addChild(this.bgLayer);
    this.addChild(this.islandLayer);
    this.addChild(this.shadowStatic, this.shadowDyn);
    this.addChild(this.unitLayer);
    this.addChild(this.dynamicLayer);
    this.buildBackground();
    this.buildIsland();
    // Свет: между сущностями и EffectsLayer, аддитивный.
    this.buildLight();
    // Эффекты: выше игрового поля и света, ниже тумана/HUD/меню.
    this.addChild(this.fx);
    // Туман: поверх всего, кроме UI.
    this.buildFog();
    this.addChild(this.uiLayer);
    this.drawStaticShadows();
    this.buildHud();

    this.dynamicLayer.eventMode = 'none';
    this.eventMode = 'static';
    this.hitArea = new Rectangle(0, 0, W, H);
    this.on('pointertap', (e: any) => this.onTap(e.global.x, e.global.y));

    WaveSpawnerSystem.reset();
    TowerAttackSystem.reset();
    BossSystem.reset();
    EnvironmentSystem.reset();
    EnemyFactory.resetDifficulty();
    GameStateManager.reset(level.difficulty.startingGold);
    EnemyFactory.setDifficulty(level.difficulty);
    setPath(level.path.map((p) => ({ gx: p.x, gy: p.y })));
    WaveSpawnerSystem.setWaves(level.waves);
    EnvironmentSystem.configure({
      biomeId: level.biomeId,
      choco: new Set(
        level.terrain.filter((t) => t.kind === 'choco').map((t) => `${t.x},${t.y}`),
      ),
      bubbles: new Set(
        level.terrain.filter((t) => t.kind === 'bubble').map((t) => `${t.x},${t.y}`),
      ),
      wind: level.wind,
      buildPoints: level.buildPoints.map((p) => ({ gx: p.x, gy: p.y })),
    });
    WaveSpawnerSystem.startWave(this.world);
  }

  private sx(gx: number, gy: number): { x: number; y: number } {
    const p = this.iso.gridToScreen(gx, gy);
    return { x: ORIGIN_X + p.x, y: ORIGIN_Y + p.y };
  }

  private buildBackground(): void {
    const bg = new Sprite(getTile('void-bg'));
    bg.width = W;
    bg.height = H;
    this.bgLayer.addChild(bg);

    // Два слоя облаков с разной скоростью дрейфа (тёмные, полупрозрачные).
    const defs: Array<{ id: TileId; x: number; y: number; v: number; alpha: number }> = [
      { id: 'cloud-1', x: 60, y: 150, v: 8, alpha: 0.3 },
      { id: 'cloud-2', x: 420, y: 215, v: 8, alpha: 0.3 },
      { id: 'cloud-1', x: 300, y: 110, v: 8, alpha: 0.3 },
      { id: 'cloud-2', x: 80, y: 830, v: 20, alpha: 0.3 },
      { id: 'cloud-1', x: 500, y: 960, v: 20, alpha: 0.3 },
    ];
    for (const d of defs) {
      const s = new Sprite(getTile(d.id));
      s.position.set(d.x, d.y);
      s.alpha = d.alpha;
      this.bgLayer.addChild(s);
      this.clouds.push({ s, v: d.v });
    }
    // Стрелки ветра биома 4.
    if (this.level.wind) {
      const sdx = (this.level.wind.dx - this.level.wind.dy) * 32;
      const sdy = (this.level.wind.dx + this.level.wind.dy) * 16;
      const len = Math.hypot(sdx, sdy) || 1;
      const angle = Math.atan2(sdy, sdx);
      const spots: Array<[number, number]> = [
        [120, 220],
        [420, 140],
        [200, 700],
        [520, 880],
      ];
      for (const [ax, ay] of spots) {
        const s = new Sprite(getTile('fx_wind_arrow'));
        s.anchor.set(0.5);
        s.position.set(ax, ay);
        s.rotation = angle;
        s.alpha = 0.7;
        this.bgLayer.addChild(s);
        this.windArrows.push({ s, vx: (sdx / len) * 60, vy: (sdy / len) * 60 });
      }
    }
  }

  private updateWindArrows(dt: number): void {
    for (const a of this.windArrows) {
      a.s.position.x += a.vx * dt;
      a.s.position.y += a.vy * dt;
      if (a.s.position.x > W + 80) a.s.position.x = -80;
      if (a.s.position.x < -80) a.s.position.x = W + 80;
      if (a.s.position.y > H + 80) a.s.position.y = -80;
      if (a.s.position.y < -80) a.s.position.y = H + 80;
    }
  }

  private updateClouds(dt: number): void {
    for (const c of this.clouds) {
      c.s.position.x += c.v * dt;
      if (c.s.position.x > W + 40) c.s.position.x = -170;
    }
  }

  /** Позиции башен-факелов для карты света. */
  private torchPositions(): Array<{ gx: number; gy: number }> {
    return this.buildPoints
      .filter((b) => b.towerId !== null)
      .map((b) => ({ gx: b.gx, gy: b.gy }));
  }

  private lightCanvasSprite(cv: HTMLCanvasElement, blend: 'add' | 'multiply'): Sprite {
    const source = new CanvasSource({ resource: cv });
    const s = new Sprite(new Texture({ source }));
    s.blendMode = blend;
    return s;
  }

  /** Аддитивный слой света: свечение кристалла + тёплые пятна факелов башен. */
  private buildLight(): void {
    const end = PATH[PATH.length - 1];
    const cv = buildLightMap(
      this.gridW,
      this.gridH,
      { gx: end.gx, gy: end.gy },
      this.torchPositions(),
    );
    this.lightSprite = this.lightCanvasSprite(cv, 'add');
    this.lightSprite.position.set(ORIGIN_X - cv.width / 2, ORIGIN_Y);
    this.addChild(this.lightSprite);
  }

  /** Туман-виньетка на весь кадр: маскирует кромки острова. */
  private buildFog(): void {
    this.fogSprite = this.lightCanvasSprite(buildFogVignette(W, H), 'multiply');
    this.addChild(this.fogSprite);
  }

  /**
   * Перестроить lightMap по событию (постройка/продажа/апгрейд башни).
   * Не каждый кадр — только при изменении списка факелов.
   */
  private refreshTorches(): void {
    if (!this.lightSprite) return;
    const cv = updateTorches(this.torchPositions());
    const old = this.lightSprite.texture;
    const source = new CanvasSource({ resource: cv });
    this.lightSprite.texture = new Texture({ source });
    old.destroy(true);
  }

  /** Пульсация кристалла: альфа света 0.12–0.18, период 3 c. */
  private tickLight(dt: number): void {
    if (!this.lightSprite) return;
    this.lightT += dt;
    const mid = (LIGHT_PULSE_MIN + LIGHT_PULSE_MAX) / 2;
    const amp = (LIGHT_PULSE_MAX - LIGHT_PULSE_MIN) / 2;
    this.lightSprite.alpha =
      mid + amp * Math.sin((this.lightT / LIGHT_PULSE_PERIOD) * Math.PI * 2);
    // Пульсация кристалла: кадры f0/f1 ~2 раза в секунду.
    const cf = Math.floor(this.lightT * 2) % 2;
    if (cf !== this.crystalFrame && this.crystalSprite) {
      this.crystalFrame = cf;
      this.crystalSprite.texture = getTile(cf === 0 ? 'crystal_f0' : 'crystal_f1');
    }
    // Мерцание факелов башен: альфа 0.8–1.2, период 0.7 c.
    for (const [id, gl] of this.torchGlows) {
      gl.alpha = 1 + 0.2 * Math.sin((this.lightT / 0.7) * Math.PI * 2 + id * 1.7);
    }
  }

  private buildIsland(): void {
    const road = getRoadKeys(PATH);
    for (let gy = 0; gy < this.gridH; gy++) {
      for (let gx = 0; gx < this.gridW; gx++) {
        const p = this.sx(gx, gy);
        const isRoad = road.has(`${gx},${gy}`);
        const variant = (gx + gy) % 2 === 0;
        const tile = new Sprite(
          getTile(isRoad ? (variant ? 'road-a' : 'road-b') : variant ? 'grass-a' : 'grass-b'),
        );
        tile.anchor.set(0.5);
        tile.position.set(p.x, p.y);
        this.islandLayer.addChild(tile);
        // Юбка острова по южным краям: кромка травы, бока земля/камень.
        if (gx === this.gridW - 1 || gy === this.gridH - 1) {
          const tall = (gx * 7 + gy * 13) % 2 === 0;
          const skirt = new Sprite(getTile(tall ? 'skirt-tall' : 'skirt-short'));
          skirt.anchor.set(0.5, 0);
          skirt.position.set(p.x, p.y - 16);
          this.islandLayer.addChild(skirt);
        }
      }
    }
    // Постаменты точек строительства.
    for (const bp of this.buildPoints) {
      const p = this.sx(bp.gx, bp.gy);
      const ped = new Sprite(getTile('pedestal'));
      ped.anchor.set(0.5);
      ped.position.set(p.x, p.y - 4);
      this.islandLayer.addChild(ped);
    }
    // Кристалл в конце пути.
    const end = PATH[PATH.length - 1];
    const cp = this.sx(end.gx, end.gy);
    const crystal = new Sprite(getTile('crystal'));
    crystal.anchor.set(0.5, 0.9);
    crystal.position.set(cp.x, cp.y - 6);
    this.crystalSprite = crystal;
    this.islandLayer.addChild(crystal);
    // Choco-плитки биома 3: шоколадные капли поверх земли.
    const chocoG = new Graphics();
    for (const t of this.level.terrain) {
      if (t.kind !== 'choco') continue;
      const p = this.sx(t.x, t.y);
      chocoG.rect(p.x - 14, p.y - 6, 8, 5);
      chocoG.fill({ color: PAL.earthDark, alpha: 1 });
      chocoG.rect(p.x + 2, p.y + 1, 10, 6);
      chocoG.fill({ color: PAL.earth, alpha: 1 });
      chocoG.rect(p.x - 6, p.y - 10, 6, 4);
      chocoG.fill({ color: PAL.earthDark, alpha: 1 });
    }
    this.islandLayer.addChild(chocoG);
    // Пузыри биома 5.
    for (const t of this.level.terrain) {
      if (t.kind !== 'bubble') continue;
      const p = this.sx(t.x, t.y);
      const b = new Sprite(getTile('fx_bubble'));
      b.anchor.set(0.5);
      b.position.set(p.x, p.y);
      b.alpha = 0.8;
      this.islandLayer.addChild(b);
    }
  }

  private drawStaticShadows(): void {
    const g = this.shadowStatic;
    for (const bp of this.buildPoints) {
      const p = this.sx(bp.gx, bp.gy);
      g.ellipse(p.x, p.y + 14, 26, 10);
      g.fill({ color: 0x000000, alpha: 0.3 });
    }
    const end = PATH[PATH.length - 1];
    const cp = this.sx(end.gx, end.gy);
    g.ellipse(cp.x, cp.y + 8, 22, 9);
    g.fill({ color: 0x000000, alpha: 0.3 });
  }

  private buildHud(): void {
    // Каменная UI-плашка сверху с циановой рунической кромкой.
    const panel = stonePanel(W, 150, { seed: 21 });
    this.uiLayer.addChild(panel);
    const edge = new Graphics();
    edge.rect(0, 146, W, 4);
    edge.fill({ color: STONE.border, alpha: 1 });
    this.uiLayer.addChild(edge);

    this.hudWave = glyph('Wave 1/5', 28);
    this.hudWave.position.set(30, 30);
    this.hudGold = glyph('Gold: 0', 28);
    this.hudGold.position.set(30, 70);
    this.hudCrystal = glyph('Crystal: 0', 28);
    this.hudCrystal.position.set(30, 110);
    this.hudCenter = glyph('', 64, STONE.glyph, 'center');
    this.hudCenter.anchor.set(0.5);
    this.hudCenter.position.set(W / 2, H / 2);
    this.hudSub = glyph('', 28, STONE.glyph, 'center');
    this.hudSub.anchor.set(0.5);
    this.hudSub.position.set(W / 2, H / 2 + 80);
    this.toastText = glyph('', 36, STONE.glyph, 'center');
    this.toastText.anchor.set(0.5);
    this.toastText.position.set(W / 2, 190);
    this.toastText.alpha = 0;
    this.uiLayer.addChild(
      this.hudWave,
      this.hudGold,
      this.hudCrystal,
      this.hudCenter,
      this.hudSub,
      this.toastText,
    );
  }

  private onTap(x: number, y: number): void {
    // Пока меню открыто — все тапы обрабатывает оно (подложка/кнопки/ESC).
    if (this.menu || this.upgradeMenu) return;

    if (GameStateManager.getStatus() !== 'playing') {
      // С EndScreen выходы — его кнопки; без колбэка — старый тап-рестарт.
      if (this.onGameEnd) return;
      this.resetGame();
      return;
    }
    for (const bp of this.buildPoints) {
      const p = this.sx(bp.gx, bp.gy);
      if (Math.hypot(p.x - x, p.y - y) < 44) {
        if (bp.towerId === null) this.openMenu(bp.gx, bp.gy);
        else this.openUpgradeMenu(bp);
        return;
      }
    }
  }

  private openMenu(gx: number, gy: number): void {
    this.closeMenu();
    const p = this.sx(gx, gy);
    const menu = new TowerSelectMenu({
      gridX: gx,
      gridY: gy,
      screenX: p.x,
      screenY: p.y,
      gold: GameStateManager.getGold(),
      onSelect: (type) => {
        const bp = this.buildPoints.find((b) => b.gx === gx && b.gy === gy);
        if (!bp || bp.towerId !== null) {
          this.closeMenu();
          return;
        }
        const cost = TowerFactory.costOf(type);
        if (!GameStateManager.spendGold(cost)) {
          this.closeMenu();
          return;
        }
        bp.towerId = TowerFactory.create(this.world, type, gx, gy);
        this.refreshTorches();
        this.closeMenu();
      },
      onCancel: () => this.closeMenu(),
    });
    this.menu = menu;
    // Поверх всего: последний ребёнок сцены.
    this.addChild(menu);
  }

  private clearUnitSprites(): void {
    for (const spr of this.towerSprites.values()) {
      this.unitLayer.removeChild(spr);
      spr.destroy();
    }
    this.towerSprites.clear();
    for (const gl of this.torchGlows.values()) {
      this.unitLayer.removeChild(gl);
      gl.destroy();
    }
    this.torchGlows.clear();
    for (const st of this.enemySprites.values()) {
      this.unitLayer.removeChild(st.s);
      st.s.destroy();
    }
    this.enemySprites.clear();
  }

  private openUpgradeMenu(bp: BuildPoint): void {
    this.closeUpgrade();
    const towerId = bp.towerId;
    if (towerId === null) return;
    const tower = this.world.getComponent<{
      kind: string;
      tier: number;
      spent: number;
      damage: number;
      fireRate: number;
      range: number;
      aoeRadius?: number;
    }>(towerId, 'Tower');
    if (!tower) return;
    const eff = effectiveStats(tower, tierConfigOf(tower.kind, tower.tier));
    const r1 = (v: number): number => Math.round(v * 10) / 10;
    const lines = [
      `Урон ${r1(eff.damage)} · ${r1(1 / eff.cooldown)}/сек · радиус ${r1(eff.range)}`,
      ...(eff.aoeRadius !== undefined ? [`АОЕ ${r1(eff.aoeRadius)}`] : []),
      `Вложено ${tower.spent}`,
    ];
    const names: Record<string, string> = { arrow: 'Arrow', cannon: 'Cannon', ice: 'Ice' };
    const menu = new TowerUpgradeMenu({
      title: `${names[tower.kind] ?? tower.kind} · tier ${tower.tier}`,
      lines,
      upgradeCost: upgradeCostOf(tower.kind, tower.tier),
      sellValue: sellValue(tower.spent),
      onUpgrade: () => {
        if (!applyUpgrade(this.world, towerId)) {
          this.closeUpgrade();
          return;
        }
        const p = this.sx(bp.gx, bp.gy);
        this.fx.spawnHitFlash(p.x, p.y - 20, 0xffd75e);
        this.refreshTorches();
        this.closeUpgrade();
        this.openUpgradeMenu(bp);
      },
      onSell: () => {
        sellTower(this.world, towerId);
        bp.towerId = null;
        this.refreshTorches();
        this.closeUpgrade();
      },
      onClose: () => this.closeUpgrade(),
    });
    this.upgradeMenu = menu;
    this.addChild(menu);
  }

  private closeUpgrade(): void {
    if (!this.upgradeMenu) return;
    const m = this.upgradeMenu;
    this.upgradeMenu = null;
    m.close();
  }

  /** Тост события механики: показать на ~2 c. */
  private showToast(text: string): void {
    this.toastText.text = text;
    this.toastText.alpha = 1;
    this.toastT = 0;
  }

  private drainToasts(): void {
    let t: string | null;
    while ((t = EnvironmentSystem.takeToast()) !== null) this.showToast(t);
    let e: { text: string } | null;
    while ((e = BossSystem.takeEvent()) !== null) this.showToast(e.text);
  }

  private tickToast(dt: number): void {
    this.toastT += dt;
    if (this.toastT >= 2.2) {
      this.toastText.alpha = 0;
      return;
    }
    this.toastText.alpha = this.toastT < 1.6 ? 1 : Math.max(0, 1 - (this.toastT - 1.6) / 0.6);
  }

  /** Puff-облако спор над глушимой точкой (биом 2). */
  private syncCloudSprite(): void {
    const cloud = EnvironmentSystem.getCloud(this.world);
    if (!cloud) {
      if (this.cloudSprite) {
        this.fx.removeChild(this.cloudSprite);
        this.cloudSprite.destroy();
        this.cloudSprite = null;
      }
      return;
    }
    const p = this.sx(cloud.gx, cloud.gy);
    if (!this.cloudSprite) {
      this.cloudSprite = new Sprite(getTile('fx_spore_cloud'));
      this.cloudSprite.anchor.set(0.5);
      this.fx.addChild(this.cloudSprite);
    }
    this.cloudSprite.position.set(p.x, p.y - 30);
    this.cloudSprite.alpha = 0.75 + Math.sin(this.world.getCurrentTime() * 6) * 0.2;
  }

  private closeMenu(): void {
    if (!this.menu) return;
    const m = this.menu;
    this.menu = null;
    m.close();
  }

  private resetGame(): void {
    this.closeMenu();
    this.closeUpgrade();
    this.fx.clear();
    this.cloudSprite = null;
    this.buffFlashed.clear();
    this.clearUnitSprites();
    this.endNotified = false;
    this.world = new World();
    this.buildPoints = this.level.buildPoints.map((p) => ({ gx: p.x, gy: p.y, towerId: null }));
    this.refreshTorches();
    WaveSpawnerSystem.reset();
    TowerAttackSystem.reset();
    EnemyFactory.resetDifficulty();
    EnvironmentSystem.reset();
    GameStateManager.reset(this.level.difficulty.startingGold);
    EnemyFactory.setDifficulty(this.level.difficulty);
    WaveSpawnerSystem.setWaves(this.level.waves);
    this.hudCenter.text = '';
    this.hudSub.text = '';
    WaveSpawnerSystem.startWave(this.world);
  }

  update(dt: number): void {
    this.tickLight(dt);
    if (GameStateManager.getStatus() !== 'playing') {
      this.updateClouds(dt);
    this.updateWindArrows(dt);
    this.tickToast(dt);
      this.fx.update(dt);
      this.refreshEndScreen();
      // Уведомить один раз сразу в момент конца игры (main покажет EndScreen).
      if (!this.endNotified) {
        this.endNotified = true;
        if (this.onGameEnd) {
          const status = GameStateManager.getStatus();
          this.onGameEnd({
            won: status === 'won',
            crystalHP: GameStateManager.getCrystalHP(),
            crystalMax: ConfigLoader.getEconomy().crystalHP,
          });
        }
      }
      return;
    }
    this.updateClouds(dt);
    this.updateWindArrows(dt);
    this.tickToast(dt);
    this.menu?.update(dt);
    this.upgradeMenu?.update(dt);

    // Снапшот до систем: моменты последних выстрелов и позиции врагов
    // (цель, умершая от выстрела, берётся из снапшота).
    const prevFire = new Map<number, number>();
    for (const id of this.world.query('Tower', 'GridPos')) {
      const t = this.world.getComponent<{ lastFireTime: number }>(id, 'Tower');
      if (t) prevFire.set(id, t.lastFireTime);
    }
    const prevPos = new Map<number, { gx: number; gy: number }>();
    for (const id of this.world.query('Enemy', 'GridPos')) {
      const p = this.world.getComponent<{ gx: number; gy: number }>(id, 'GridPos');
      if (p) prevPos.set(id, { gx: p.gx, gy: p.gy });
    }

    WaveSpawnerSystem.update(this.world, dt);
    EnvironmentSystem.update(this.world);
    this.drainToasts();
    this.syncCloudSprite();
    TowerAttackSystem.update(this.world, dt);
    BossSystem.update(this.world);
    MoveSystem.update(this.world, dt);
    RulesSystem.update(this.world, dt);
    this.spawnShotEffects(prevFire, prevPos);
    this.spawnDeathGhosts();
    HealthSystem.update(this.world, dt);
    this.fx.update(dt);
    this.redraw(dt);
  }

  /** Визуал выстрелов: снаряд + вспышка + кольцо AoE. Урон уже применён системой. */
  private spawnShotEffects(
    prevFire: Map<number, number>,
    prevPos: Map<number, { gx: number; gy: number }>,
  ): void {
    for (const id of this.world.query('Tower', 'GridPos')) {
      const tower = this.world.getComponent<{
        kind: string;
        range: number;
        damageType: string;
        lastFireTime: number;
        aoeRadius?: number;
      }>(id, 'Tower');
      const tpos = this.world.getComponent<{ gx: number; gy: number }>(id, 'GridPos');
      if (!tower || !tpos) continue;
      if ((prevFire.get(id) ?? tower.lastFireTime) >= tower.lastFireTime) continue;

      const from = this.sx(tpos.gx, tpos.gy);
      let bestId: number | null = null;
      let tx: number | null = null;
      let ty: number | null = null;
      let gridDist = 0;
      let best = Infinity;
      // Цель — ближайший живой враг в радиусе (позиции после MoveSystem).
      for (const eid of this.world.query('Health', 'Enemy', 'GridPos')) {
        const h = this.world.getComponent<{ hp: number }>(eid, 'Health');
        const ep = this.world.getComponent<{ gx: number; gy: number }>(eid, 'GridPos');
        if (!h || !ep || h.hp <= 0) continue;
        const d = Math.hypot(ep.gx - tpos.gx, ep.gy - tpos.gy);
        if (d <= tower.range && d < best) {
          best = d;
          bestId = eid;
          const s = this.sx(ep.gx, ep.gy);
          tx = s.x;
          ty = s.y;
          gridDist = d;
        }
      }
      // Убитая этим выстрелом цель исчезнет только в HealthSystem —
      // fallback на снапшот на случай, если живых в радиусе не осталось.
      if (tx === null || ty === null) {
        for (const snap of prevPos.values()) {
          const d = Math.hypot(snap.gx - tpos.gx, snap.gy - tpos.gy);
          if (d <= tower.range && d < best) {
            best = d;
            const s = this.sx(snap.gx, snap.gy);
            tx = s.x;
            ty = s.y;
            gridDist = d;
          }
        }
      }
      if (tx === null || ty === null) continue;

      // Рикошет: физика по броне — серая вспышка вместо белой.
      const victim =
        bestId !== null
          ? this.world.getComponent<{ abilities?: string[] }>(bestId, 'Enemy')
          : undefined;
      const blocked =
        tower.damageType === 'physical' && victim?.abilities?.includes('armorPhysical');

      const wind = this.level.wind;
      this.fx.spawnProjectile(
        from.x,
        from.y,
        tx,
        ty,
        PROJ_TILES[tower.kind] ?? 'proj_arrow',
        gridDist,
        wind ? wind.dx * 18 : 0,
        wind ? wind.dy * 10 : 0,
      );
      this.fx.spawnHitFlash(tx, ty, blocked ? 0x8f8f9f : 0xffffff);
      if (tower.kind === 'cannon' && tower.aoeRadius !== undefined) {
        this.fx.spawnAoERing(tx, ty, tower.aoeRadius * 32);
      }
    }
  }

  /**
   * Призраки смерти: сущности с hp <= 0 ещё в мире (RulesSystem уже выдал
   * награду, HealthSystem удалит их следующим шагом). Утечки к кристаллу
   * сюда не попадают — их RulesSystem удаляет сразу с hp > 0.
   */
  private spawnDeathGhosts(): void {
    for (const id of this.world.query('Health', 'Enemy', 'GridPos')) {
      const health = this.world.getComponent<{ hp: number }>(id, 'Health');
      const enemy = this.world.getComponent<{ type: string; abilities?: string[] }>(id, 'Enemy');
      const pos = this.world.getComponent<{ gx: number; gy: number }>(id, 'GridPos');
      if (!health || !enemy || !pos || health.hp > 0) continue;
      const p = this.sx(pos.gx, pos.gy);
      const prefix = enemyTilePrefix(enemy.type);
      const st = this.enemySprites.get(id);
      const f = st?.f ?? 0;
      this.fx.spawnDeathGhost(p.x, p.y - 12, `enemy_${prefix}_f${f}` as TileId);
    }
  }

  private redraw(dt: number): void {
    const g = this.dynamicLayer;
    g.clear();
    const sh = this.shadowDyn;
    sh.clear();

    // Башни: пиксельные спрайты на постаментах.
    const seenTowers = new Set<number>();
    for (const id of this.world.query('Tower', 'GridPos')) {
      const tower = this.world.getComponent<{ kind: string; tier: number }>(id, 'Tower');
      const pos = this.world.getComponent<{ gx: number; gy: number }>(id, 'GridPos');
      if (!tower || !pos) continue;
      const p = this.sx(pos.gx, pos.gy);
      sh.ellipse(p.x, p.y + 12, 16, 7);
      sh.fill({ color: 0x000000, alpha: 0.3 });
      seenTowers.add(id);
      let spr = this.towerSprites.get(id);
      const wantTile = towerTileFor(tower.kind, tower.tier);
      if (!spr) {
        spr = new Sprite(getTile(wantTile));
        spr.anchor.set(0.5, 1);
        this.unitLayer.addChild(spr);
        this.towerSprites.set(id, spr);
      } else if (spr.texture !== getTile(wantTile)) {
        spr.texture = getTile(wantTile);
      }
      spr.position.set(p.x, p.y + 16);
      // Факел башни: аддитивный glow-спрайт, мерцание — в tickLight.
      let gl = this.torchGlows.get(id);
      if (!gl) {
        gl = torchGlow();
        this.unitLayer.addChild(gl);
        this.torchGlows.set(id, gl);
      }
      gl.position.set(p.x, p.y - 58);
      // Карнавал: танец покачивает спрайт, начало баффа — искорки.
      const nowT = this.world.getCurrentTime();
      const dance = EnvironmentSystem.getDance(id);
      if (dance && nowT < dance.danceUntil) {
        spr.position.x += Math.sin(nowT * 20) * 5;
      }
      if (dance && nowT >= dance.danceUntil && nowT < dance.buffUntil) {
        if (!this.buffFlashed.has(id)) {
          this.buffFlashed.add(id);
          this.fx.spawnHitFlash(p.x, p.y - 30, 0xffd75e);
        }
      } else if (this.buffFlashed.has(id)) {
        this.buffFlashed.delete(id);
      }
    }
    for (const [id, spr] of this.towerSprites) {
      if (!seenTowers.has(id)) {
        this.unitLayer.removeChild(spr);
        spr.destroy();
        this.towerSprites.delete(id);
        const gl = this.torchGlows.get(id);
        if (gl) {
          this.unitLayer.removeChild(gl);
          gl.destroy();
          this.torchGlows.delete(id);
        }
      }
    }

    // Враги: пиксельные спрайты (покачивание f0/f1, flip по dx); hp и tint — поверх.
    const seenEnemies = new Set<number>();
    for (const id of this.world.query('Health', 'Enemy', 'GridPos')) {
      const health = this.world.getComponent<{ hp: number; maxHp: number }>(id, 'Health');
      const enemy = this.world.getComponent<{ type: string; abilities?: string[] }>(id, 'Enemy');
      const pos = this.world.getComponent<{ gx: number; gy: number }>(id, 'GridPos');
      if (!health || !enemy || !pos || health.hp <= 0) continue;
      const p = this.sx(pos.gx, pos.gy);
      // Летун: парит выше, тень меньше и бледнее.
      const flying = enemy.abilities?.includes('flying') ?? false;
      sh.ellipse(p.x, p.y + 12, flying ? 10 : 14, flying ? 5 : 6);
      sh.fill({ color: 0x000000, alpha: flying ? 0.22 : 0.3 });
      seenEnemies.add(id);
      const prefix = enemyTilePrefix(enemy.type);
      let st = this.enemySprites.get(id);
      if (!st) {
        const s = new Sprite(getTile(`enemy_${prefix}_f0` as TileId));
        s.anchor.set(0.5, 1);
        this.unitLayer.addChild(s);
        st = { s, t: 0, f: 0, lx: pos.gx, dir: 1 };
        this.enemySprites.set(id, st);
      }
      const s = st.s;
      s.position.set(p.x, p.y + (flying ? -6 : 8));
      // Flip по знаку dx (стоит — сохраняет разворот); элита в 1.5 раза больше.
      if (pos.gx > st.lx + 0.02) st.dir = 1;
      else if (pos.gx < st.lx - 0.02) st.dir = -1;
      const eliteScale = this.world.hasComponent(id, 'Elite') ? 1.5 : 1;
      s.scale.set(eliteScale * st.dir, eliteScale);
      const moving = Math.abs(pos.gx - st.lx) > 0.02;
      st.lx = pos.gx;
      // Кадры ~4/сек; стоит — кадр f0.
      st.t += dt;
      if (st.t >= ENEMY_FRAME_DUR) {
        st.t = 0;
        const nf = moving ? 1 - st.f : 0;
        if (nf !== st.f) {
          st.f = nf;
          s.texture = getTile(`enemy_${prefix}_f${nf}` as TileId);
        }
      }
      // Индикация замедления: голубой tint, пока активен Slow.
      const slow = this.world.getComponent<{ amount?: number; factor?: number; until: number }>(
        id,
        'Slow',
      );
      if (slow && this.world.getCurrentTime() < slow.until) {
        // Циановое мерцание замедления поверх спрайта.
        const fl = 0.3 + 0.25 * (0.5 + 0.5 * Math.sin(this.world.getCurrentTime() * 10 + id));
        g.circle(p.x, p.y, 16);
        g.fill({ color: SLOW_TINT_COLOR, alpha: fl });
        g.circle(p.x, p.y, 20);
        g.stroke({ width: 3, color: SLOW_TINT_COLOR, alpha: Math.min(1, fl + 0.4) });
      }
      const k = Math.max(0, health.hp / health.maxHp);
      g.rect(p.x - 16, p.y - 50, 32 * k, 5);
      g.fill({ color: 0x2ecc71 });
    }
    for (const [id, st] of this.enemySprites) {
      if (!seenEnemies.has(id)) {
        this.unitLayer.removeChild(st.s);
        st.s.destroy();
        this.enemySprites.delete(id);
      }
    }

    const total = WaveSpawnerSystem.getTotalWaves();
    const cur = WaveSpawnerSystem.getCurrentWaveNumber();
    this.hudWave.text = `Wave ${cur}/${total}`;
    this.hudGold.text = `Gold: ${GameStateManager.getGold()}`;
    this.hudCrystal.text = `Crystal: ${GameStateManager.getCrystalHP()}/${ConfigLoader.getEconomy().crystalHP}`;
  }

  private refreshEndScreen(): void {
    const status = GameStateManager.getStatus();
    if (status === 'won') {
      this.hudCenter.text = 'Победа!';
      this.hudSub.text = 'Тапни чтобы играть снова';
    } else if (status === 'lost') {
      this.hudCenter.text = 'Поражение';
      this.hudSub.text = 'Тапни чтобы играть снова';
    }
  }
}

export async function createApp(): Promise<Application> {
  const app = new Application();
  await app.init({ width: W, height: H, background: '#000000' });
  const host = document.getElementById('app');
  if (host) host.appendChild(app.canvas);
  else document.body.appendChild(app.canvas);

  const scene = new MainScene(await LevelLoader.loadLevel(1));
  app.stage.addChild(scene);
  (window as any).__norn = { app, scene, GameStateManager };
  app.ticker.add((ticker) => {
    scene.update(ticker.deltaMS / 1000);
  });
  return app;
}
