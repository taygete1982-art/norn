import { Application, Container, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import { IsoMath } from './iso/IsoMath';
import { World } from './ecs/world';
import { GameStateManager } from './game/GameState';
import { ConfigLoader } from './game/config/ConfigLoader';
import { getTile, getRoadKeys, PAL, TileId } from './art/PixelArt';
import { TowerFactory } from './game/entities/TowerFactory';
import { TowerSelectMenu } from './ui/TowerSelectMenu';
import { EffectsLayer } from './ui/EffectsLayer';
import { WaveSpawnerSystem } from './game/systems/WaveSpawnerSystem';
import { TowerAttackSystem } from './game/systems/TowerAttackSystem';
import { MoveSystem, PATH, setPath } from './game/systems/MoveSystem';
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

/** Префикс тайла врага; неизвестные типы падают на гоблина. */
function enemyTilePrefix(type: string): string {
  return type === 'troll' ||
    type === 'imp' ||
    type === 'spore' ||
    type === 'puffling' ||
    type === 'truffle'
    ? type
    : 'goblin';
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
  // Порядок слоёв: фон < остров < тени < сущности < fx < UI-плашка < bottom-sheet.
  private bgLayer = new Container();
  private islandLayer = new Container();
  private shadowStatic = new Graphics();
  private shadowDyn = new Graphics();
  private dynamicLayer = new Graphics();
  private uiLayer = new Container();
  private clouds: Array<{ s: Sprite; v: number }> = [];
  // Пиксельные спрайты сущностей (reconcile по id): тени < unitLayer < dynamicLayer.
  private unitLayer = new Container();
  private towerSprites = new Map<number, Sprite>();
  private enemySprites = new Map<number, { s: Sprite; t: number; f: number; lx: number }>();
  private hudWave!: Text;
  private hudGold!: Text;
  private hudCrystal!: Text;
  private hudCenter!: Text;
  private hudSub!: Text;
  private menu: TowerSelectMenu | null = null;
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
    // Эффекты: выше игрового поля, ниже HUD и меню.
    this.addChild(this.fx);
    this.addChild(this.uiLayer);
    this.buildBackground();
    this.buildIsland();
    this.drawStaticShadows();
    this.buildHud();

    this.dynamicLayer.eventMode = 'none';
    this.eventMode = 'static';
    this.hitArea = new Rectangle(0, 0, W, H);
    this.on('pointertap', (e: any) => this.onTap(e.global.x, e.global.y));

    WaveSpawnerSystem.reset();
    TowerAttackSystem.reset();
    GameStateManager.reset();
    setPath(level.path.map((p) => ({ gx: p.x, gy: p.y })));
    WaveSpawnerSystem.setWaves(level.waves);
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

    // Два слоя облаков с разной скоростью дрейфа.
    const defs: Array<{ id: TileId; x: number; y: number; v: number; alpha: number }> = [
      { id: 'cloud-1', x: 60, y: 150, v: 8, alpha: 0.5 },
      { id: 'cloud-2', x: 420, y: 215, v: 8, alpha: 0.5 },
      { id: 'cloud-1', x: 300, y: 110, v: 8, alpha: 0.45 },
      { id: 'cloud-2', x: 80, y: 830, v: 20, alpha: 0.9 },
      { id: 'cloud-1', x: 500, y: 960, v: 20, alpha: 0.9 },
    ];
    for (const d of defs) {
      const s = new Sprite(getTile(d.id));
      s.position.set(d.x, d.y);
      s.alpha = d.alpha;
      this.bgLayer.addChild(s);
      this.clouds.push({ s, v: d.v });
    }
  }

  private updateClouds(dt: number): void {
    for (const c of this.clouds) {
      c.s.position.x += c.v * dt;
      if (c.s.position.x > W + 40) c.s.position.x = -170;
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
    this.islandLayer.addChild(crystal);
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
    // Плоская UI-плашка сверху.
    const panel = new Graphics();
    panel.rect(0, 0, W, 150);
    panel.fill({ color: PAL.uiPanel, alpha: 0.95 });
    panel.rect(0, 146, W, 4);
    panel.fill({ color: PAL.gold, alpha: 1 });
    this.uiLayer.addChild(panel);

    const style = { fontFamily: 'Arial', fontSize: 28, fill: PAL.uiText };
    this.hudWave = new Text({ text: 'Wave 1/5', style });
    this.hudWave.position.set(30, 30);
    this.hudGold = new Text({
      text: 'Gold: 0',
      style: { fontFamily: 'Arial', fontSize: 28, fill: PAL.gold },
    });
    this.hudGold.position.set(30, 70);
    this.hudCrystal = new Text({ text: 'Crystal: 0', style });
    this.hudCrystal.position.set(30, 110);
    this.hudCenter = new Text({
      text: '',
      style: { fontFamily: 'Arial', fontSize: 64, fill: 0xffe066, align: 'center' },
    });
    this.hudCenter.anchor.set(0.5);
    this.hudCenter.position.set(W / 2, H / 2);
    this.hudSub = new Text({
      text: '',
      style: { fontFamily: 'Arial', fontSize: 28, fill: 0xffffff, align: 'center' },
    });
    this.hudSub.anchor.set(0.5);
    this.hudSub.position.set(W / 2, H / 2 + 80);
    this.uiLayer.addChild(this.hudWave, this.hudGold, this.hudCrystal, this.hudCenter, this.hudSub);
  }

  private onTap(x: number, y: number): void {
    // Пока меню открыто — все тапы обрабатывает оно (подложка/кнопки/ESC).
    if (this.menu) return;

    if (GameStateManager.getStatus() !== 'playing') {
      // С EndScreen выходы — его кнопки; без колбэка — старый тап-рестарт.
      if (this.onGameEnd) return;
      this.resetGame();
      return;
    }
    for (const bp of this.buildPoints) {
      if (bp.towerId !== null) continue;
      const p = this.sx(bp.gx, bp.gy);
      if (Math.hypot(p.x - x, p.y - y) < 44) {
        this.openMenu(bp.gx, bp.gy);
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
    for (const st of this.enemySprites.values()) {
      this.unitLayer.removeChild(st.s);
      st.s.destroy();
    }
    this.enemySprites.clear();
  }

  private closeMenu(): void {
    if (!this.menu) return;
    const m = this.menu;
    this.menu = null;
    m.close();
  }

  private resetGame(): void {
    this.closeMenu();
    this.fx.clear();
    this.clearUnitSprites();
    this.endNotified = false;
    this.world = new World();
    this.buildPoints = this.level.buildPoints.map((p) => ({ gx: p.x, gy: p.y, towerId: null }));
    WaveSpawnerSystem.reset();
    TowerAttackSystem.reset();
    GameStateManager.reset();
    WaveSpawnerSystem.setWaves(this.level.waves);
    this.hudCenter.text = '';
    this.hudSub.text = '';
    WaveSpawnerSystem.startWave(this.world);
  }

  update(dt: number): void {
    if (GameStateManager.getStatus() !== 'playing') {
      this.updateClouds(dt);
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
    this.menu?.update(dt);

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
    TowerAttackSystem.update(this.world, dt);
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

      this.fx.spawnProjectile(
        from.x,
        from.y,
        tx,
        ty,
        PROJ_TILES[tower.kind] ?? 'proj_arrow',
        gridDist,
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
      const tower = this.world.getComponent<{ kind: string }>(id, 'Tower');
      const pos = this.world.getComponent<{ gx: number; gy: number }>(id, 'GridPos');
      if (!tower || !pos) continue;
      const p = this.sx(pos.gx, pos.gy);
      sh.ellipse(p.x, p.y + 12, 16, 7);
      sh.fill({ color: 0x000000, alpha: 0.3 });
      seenTowers.add(id);
      let spr = this.towerSprites.get(id);
      if (!spr) {
        spr = new Sprite(getTile(TOWER_TILES[tower.kind] ?? 'tower_arrow'));
        spr.anchor.set(0.5, 1);
        this.unitLayer.addChild(spr);
        this.towerSprites.set(id, spr);
      }
      spr.position.set(p.x, p.y + 16);
    }
    for (const [id, spr] of this.towerSprites) {
      if (!seenTowers.has(id)) {
        this.unitLayer.removeChild(spr);
        spr.destroy();
        this.towerSprites.delete(id);
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
        st = { s, t: 0, f: 0, lx: pos.gx };
        this.enemySprites.set(id, st);
      }
      const s = st.s;
      s.position.set(p.x, p.y + (flying ? -6 : 8));
      // Flip по знаку dx; стоит — сохраняет последний разворот.
      if (pos.gx > st.lx + 0.02) s.scale.x = 1;
      else if (pos.gx < st.lx - 0.02) s.scale.x = -1;
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
        g.circle(p.x, p.y, 16);
        g.fill({ color: SLOW_TINT_COLOR, alpha: 0.45 });
        g.circle(p.x, p.y, 20);
        g.stroke({ width: 3, color: SLOW_TINT_COLOR, alpha: 0.9 });
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
  await app.init({ width: W, height: H, background: '#1a1a2e' });
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
