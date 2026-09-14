import { Container, Graphics } from 'pixi.js';
import { STONE, glyph, stonePanel } from './StoneTheme';

export interface TowerUpgradeMenuOptions {
  title: string;
  /** строки текущих эффективных статов */
  lines: string[];
  /** цена tier+1; null — максимум, кнопка скрыта */
  upgradeCost: number | null;
  sellValue: number;
  onUpgrade: () => void;
  onSell: () => void;
  onClose: () => void;
}

const STAGE_W = 720;
const STAGE_H = 1280;
const SHEET_H = 360;
const BTN_W = STAGE_W - 40;
const BTN_H = 64;

const SLIDE_DUR = 0.25;
const SLIDE_DIST = 380;

export class TowerUpgradeMenu extends Container {
  private sheet = new Container();
  private animT = 0;

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.opts.onClose();
  };

  constructor(private opts: TowerUpgradeMenuOptions) {
    super();
    this.build();
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKey);
    }
  }

  /** Анимация выезда снизу. Вызывается из MainScene.update. */
  public update(dt: number): void {
    if (this.animT >= 1) return;
    this.animT = Math.min(this.animT + dt / SLIDE_DUR, 1);
    const k = 1 - Math.pow(1 - this.animT, 3);
    this.sheet.position.y = (1 - k) * SLIDE_DIST;
  }

  private wideButton(y: number, label: string, primary: boolean, cb: () => void): void {
    const btn = new Container();
    btn.position.set(STAGE_W / 2, y);
    // Каменная плашка с руной: primary горит цианом.
    const bg = stonePanel(BTN_W, BTN_H, {
      border: primary ? STONE.border : STONE.borderDim,
      seed: primary ? 51 : 52,
    });
    bg.position.set(-BTN_W / 2, -BTN_H / 2);
    const text = glyph(label, 26, STONE.glyph, 'center');
    text.anchor.set(0.5);
    btn.addChild(bg, text);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', (e: any) => {
      e?.stopPropagation?.();
      cb();
    });
    this.sheet.addChild(btn);
  }

  private build(): void {
    const { title, lines, upgradeCost, sellValue, onUpgrade, onSell, onClose } = this.opts;

    const backdrop = new Graphics();
    backdrop.rect(0, 0, STAGE_W, STAGE_H);
    backdrop.fill({ color: 0x000000, alpha: 0.35 });
    backdrop.eventMode = 'static';
    backdrop.cursor = 'default';
    backdrop.on('pointertap', (e: any) => {
      e?.stopPropagation?.();
      onClose();
    });
    this.addChild(backdrop);

    const panel = stonePanel(STAGE_W, SHEET_H, { seed: 34 });
    panel.position.set(0, STAGE_H - SHEET_H);
    panel.eventMode = 'static';
    panel.on('pointertap', (e: any) => e?.stopPropagation?.());
    this.sheet.addChild(panel);

    const titleText = glyph(title, 26);
    titleText.anchor.set(0, 0.5);
    titleText.position.set(20, STAGE_H - SHEET_H + 34);
    this.sheet.addChild(titleText);

    lines.slice(0, 3).forEach((line, i) => {
      const t = glyph(line, 22);
      t.anchor.set(0, 0.5);
      t.position.set(20, STAGE_H - SHEET_H + 68 + i * 28);
      this.sheet.addChild(t);
    });

    const cancel = new Container();
    cancel.position.set(STAGE_W - 40, STAGE_H - SHEET_H + 40);
    const cancelBg = new Graphics();
    cancelBg.rect(-20, -20, 40, 40);
    cancelBg.fill({ color: STONE.bg, alpha: 1 });
    cancelBg.stroke({ width: 2, color: STONE.border, alpha: 0.8 });
    const cross = glyph('X', 22, STONE.glyph, 'center');
    cross.anchor.set(0.5);
    cancel.addChild(cancelBg, cross);
    cancel.eventMode = 'static';
    cancel.cursor = 'pointer';
    cancel.on('pointertap', (e: any) => {
      e?.stopPropagation?.();
      onClose();
    });
    this.sheet.addChild(cancel);

    if (upgradeCost !== null) {
      this.wideButton(STAGE_H - 180, `Улучшить за ${upgradeCost}`, true, onUpgrade);
    } else {
      const max = glyph('MAX tier', 24, STONE.glyph, 'center');
      max.anchor.set(0.5);
      max.position.set(STAGE_W / 2, STAGE_H - 180);
      this.sheet.addChild(max);
    }
    this.wideButton(STAGE_H - 100, `Продать за ${sellValue}`, false, onSell);

    this.sheet.position.y = SLIDE_DIST;
    this.addChild(this.sheet);
  }

  public close(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKey);
    }
    this.parent?.removeChild(this);
    this.destroy({ children: true });
  }
}
