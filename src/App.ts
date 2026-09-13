import { Application, Container, Graphics, Rectangle, Text } from 'pixi.js';
import { IsoMath } from './iso/IsoMath';
import { World } from './ecs/world';
import { GameStateManager } from './game/GameState';
import { ConfigLoader } from './game/config/ConfigLoader';
import { TowerFactory, TowerType } from './game/entities/TowerFactory';
import { WaveSpawnerSystem } from './game/systems/WaveSpawnerSystem';
import { TowerAttackSystem } from './game/systems/TowerAttackSystem';
import { MoveSystem, PATH } from './game/systems/MoveSystem';
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

const BUILD_POINTS: BuildPoint[] = [
  { gx: 3, gy: 2, towerId: null },
  { gx: 5, gy: 4, towerId: null },
  { gx: 2, gy: 6, towerId: null },
];

const TOWER_COLORS: Record<string, number> = {
  arrow: 0x2ecc71,
  cannon: 0xe74c3c,
  ice: 0x3498db,
};

interface TowerButton {
  type: TowerType;
  x: number;
  y: number;
  w: number;
  h: number;
}

const TOWER_BUTTONS: TowerButton[] = [
  { type: 'arrow', x: 30, y: H - 130, w: 200, h: 90 },
  { type: 'cannon', x: 260, y: H - 130, w: 200, h: 90 },
  { type: 'ice', x: 490, y: H - 130, w: 200, h: 90 },
];

export class MainScene extends Container {
  private world = new World();
  private iso = new IsoMath({ x: 32, y: 16 });
  private staticLayer = new Graphics();
  private dynamicLayer = new Graphics();
  private hudWave!: Text;
  private hudGold!: Text;
  private hudCrystal!: Text;
  private hudCenter!: Text;
  private hudSub!: Text;
  private btnLabels: Text[] = [];
  private selectedType: TowerType = 'arrow';

  constructor() {
    super();
    this.addChild(this.staticLayer);
    this.addChild(this.dynamicLayer);
    this.drawStatic();
    this.buildHud();

    this.dynamicLayer.eventMode = 'none';
    this.eventMode = 'static';
    this.hitArea = new Rectangle(0, 0, W, H);
    this.on('pointertap', (e: any) => this.onTap(e.global.x, e.global.y));

    WaveSpawnerSystem.reset();
    TowerAttackSystem.reset();
    GameStateManager.reset();
    WaveSpawnerSystem.startWave(this.world);
  }

  private sx(gx: number, gy: number): { x: number; y: number } {
    const p = this.iso.gridToScreen(gx, gy);
    return { x: ORIGIN_X + p.x, y: ORIGIN_Y + p.y };
  }

  private drawStatic(): void {
    const g = this.staticLayer;
    // дорога по пути
    g.moveTo(0, 0);
    for (let i = 0; i < PATH.length; i++) {
      const p = this.sx(PATH[i].gx, PATH[i].gy);
      if (i === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    }
    g.stroke({ width: 10, color: 0x8a6d3b, alpha: 0.9 });

    // сетка
    for (let gy = 0; gy <= 11; gy++) {
      for (let gx = 0; gx <= 7; gx++) {
        const p = this.sx(gx, gy);
        g.circle(p.x, p.y, 2);
        g.fill({ color: 0x3a3f5a, alpha: 0.6 });
      }
    }
    this.drawBuildPoints(g);
  }

  private drawBuildPoints(g: Graphics): void {
    for (const bp of BUILD_POINTS) {
      const p = this.sx(bp.gx, bp.gy);
      const occupied = bp.towerId !== null;
      g.moveTo(p.x, p.y - 20);
      g.lineTo(p.x + 28, p.y);
      g.lineTo(p.x, p.y + 20);
      g.lineTo(p.x - 28, p.y);
      g.closePath();
      g.fill({ color: occupied ? 0x555555 : 0x9b59b6, alpha: occupied ? 0.5 : 0.35 });
      g.stroke({ width: 2, color: occupied ? 0x777777 : 0xbb88ff, alpha: 0.9 });
    }
  }

  private buildHud(): void {
    const style = { fontFamily: 'Arial', fontSize: 28, fill: 0xffffff };
    this.hudWave = new Text({ text: 'Wave 1/5', style });
    this.hudWave.position.set(30, 30);
    this.hudGold = new Text({ text: 'Gold: 0', style });
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
    this.addChild(this.hudWave, this.hudGold, this.hudCrystal, this.hudCenter, this.hudSub);

    const names: Record<TowerType, string> = { arrow: 'Arrow', cannon: 'Cannon', ice: 'Ice' };
    for (const btn of TOWER_BUTTONS) {
      const label = new Text({
        text: `${names[btn.type]}\n${TowerFactory.costOf(btn.type)}g`,
        style: { fontFamily: 'Arial', fontSize: 24, fill: 0xffffff, align: 'center' },
      });
      label.anchor.set(0.5);
      label.position.set(btn.x + btn.w / 2, btn.y + btn.h / 2);
      this.btnLabels.push(label);
      this.addChild(label);
    }
  }

  private onTap(x: number, y: number): void {
    for (const btn of TOWER_BUTTONS) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        this.selectedType = btn.type;
        return;
      }
    }

    if (GameStateManager.getStatus() !== 'playing') {
      this.resetGame();
      return;
    }
    for (const bp of BUILD_POINTS) {
      if (bp.towerId !== null) continue;
      const p = this.sx(bp.gx, bp.gy);
      if (Math.hypot(p.x - x, p.y - y) < 44) {
        const cost = TowerFactory.costOf(this.selectedType);
        if (!GameStateManager.spendGold(cost)) return;
        bp.towerId = TowerFactory.create(this.world, this.selectedType, bp.gx, bp.gy);
        this.redrawStatic();
        return;
      }
    }
  }

  private redrawStatic(): void {
    this.staticLayer.clear();
    this.drawStatic();
  }

  private resetGame(): void {
    this.world = new World();
    for (const bp of BUILD_POINTS) bp.towerId = null;
    this.selectedType = 'arrow';
    WaveSpawnerSystem.reset();
    TowerAttackSystem.reset();
    GameStateManager.reset();
    this.hudCenter.text = '';
    this.hudSub.text = '';
    this.redrawStatic();
    WaveSpawnerSystem.startWave(this.world);
  }

  update(dt: number): void {
    if (GameStateManager.getStatus() !== 'playing') {
      this.refreshEndScreen();
      return;
    }
    WaveSpawnerSystem.update(this.world, dt);
    TowerAttackSystem.update(this.world, dt);
    MoveSystem.update(this.world, dt);
    RulesSystem.update(this.world, dt);
    HealthSystem.update(this.world, dt);
    this.redraw();
  }

  private redraw(): void {
    const g = this.dynamicLayer;
    g.clear();

    // башни
    for (const id of this.world.query('Tower', 'GridPos')) {
      const tower = this.world.getComponent<{ kind: string }>(id, 'Tower');
      const pos = this.world.getComponent<{ gx: number; gy: number }>(id, 'GridPos');
      if (!tower || !pos) continue;
      const p = this.sx(pos.gx, pos.gy);
      const color = TOWER_COLORS[tower.kind] ?? 0x2ecc71;
      g.rect(p.x - 16, p.y - 16, 32, 32);
      g.fill({ color });
      g.stroke({ width: 2, color: 0x000000, alpha: 0.6 });
    }

    // враги c полоской hp
    for (const id of this.world.query('Health', 'Enemy', 'GridPos')) {
      const health = this.world.getComponent<{ hp: number; maxHp: number }>(id, 'Health');
      const enemy = this.world.getComponent<{ type: string }>(id, 'Enemy');
      const pos = this.world.getComponent<{ gx: number; gy: number }>(id, 'GridPos');
      if (!health || !enemy || !pos || health.hp <= 0) continue;
      const p = this.sx(pos.gx, pos.gy);
      const color = enemy.type === 'troll' ? 0xc0392b : enemy.type === 'imp' ? 0xe67e22 : 0x7f8c8d;
      g.circle(p.x, p.y, 16);
      g.fill({ color });
      g.stroke({ width: 2, color: 0x000000, alpha: 0.6 });
      const k = Math.max(0, health.hp / health.maxHp);
      g.rect(p.x - 16, p.y - 24, 32 * k, 5);
      g.fill({ color: 0x2ecc71 });
    }

    const total = WaveSpawnerSystem.getTotalWaves();
    const cur = WaveSpawnerSystem.getCurrentWaveNumber();
    this.hudWave.text = `Wave ${cur}/${total}`;
    this.hudGold.text = `Gold: ${GameStateManager.getGold()}`;
    this.hudCrystal.text = `Crystal: ${GameStateManager.getCrystalHP()}/${ConfigLoader.getEconomy().crystalHP}`;

    // кнопки выбора башни
    for (const btn of TOWER_BUTTONS) {
      const selected = this.selectedType === btn.type;
      const affordable = GameStateManager.getGold() >= TowerFactory.costOf(btn.type);
      g.rect(btn.x, btn.y, btn.w, btn.h);
      g.fill({ color: TOWER_COLORS[btn.type], alpha: selected ? 1 : affordable ? 0.55 : 0.25 });
      g.stroke({ width: selected ? 4 : 2, color: 0xffffff, alpha: selected ? 1 : 0.5 });
    }
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

  const scene = new MainScene();
  app.stage.addChild(scene);
  (window as any).__norn = { app, scene, GameStateManager };
  app.ticker.add((ticker) => {
    scene.update(ticker.deltaMS / 1000);
  });
  return app;
}
