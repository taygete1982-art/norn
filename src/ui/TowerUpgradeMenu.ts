import { Container, Graphics, Text } from 'pixi.js';
import { PAL } from '../art/PixelArt';

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
    const bg = new Graphics();
    bg.rect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H);
    bg.fill({ color: 0x444444, alpha: 1 });
    bg.stroke({ width: 3, color: primary ? PAL.gold : PAL.stone, alpha: 0.9 });
    const text = new Text({
      text: label,
      style: { fontFamily: 'Arial', fontSize: 26, fill: PAL.uiText, align: 'center' },
    });
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

    const panel = new Graphics();
    panel.rect(0, STAGE_H - SHEET_H, STAGE_W, SHEET_H);
    panel.fill({ color: PAL.uiPanel, alpha: 0.98 });
    panel.rect(0, STAGE_H - SHEET_H, STAGE_W, 4);
    panel.fill({ color: PAL.gold, alpha: 1 });
    panel.eventMode = 'static';
    panel.on('pointertap', (e: any) => e?.stopPropagation?.());
    this.sheet.addChild(panel);

    const titleText = new Text({
      text: title,
      style: { fontFamily: 'Arial', fontSize: 26, fill: PAL.uiText },
    });
    titleText.anchor.set(0, 0.5);
    titleText.position.set(20, STAGE_H - SHEET_H + 34);
    this.sheet.addChild(titleText);

    lines.slice(0, 3).forEach((line, i) => {
      const t = new Text({
        text: line,
        style: { fontFamily: 'Arial', fontSize: 22, fill: PAL.gold },
      });
      t.anchor.set(0, 0.5);
      t.position.set(20, STAGE_H - SHEET_H + 68 + i * 28);
      this.sheet.addChild(t);
    });

    const cancel = new Container();
    cancel.position.set(STAGE_W - 40, STAGE_H - SHEET_H + 40);
    const cancelBg = new Graphics();
    cancelBg.rect(-20, -20, 40, 40);
    cancelBg.fill({ color: 0x444444, alpha: 1 });
    cancelBg.stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
    const cross = new Text({
      text: 'X',
      style: { fontFamily: 'Arial', fontSize: 22, fill: 0xffffff, align: 'center' },
    });
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
      const max = new Text({
        text: 'MAX tier',
        style: { fontFamily: 'Arial', fontSize: 24, fill: PAL.gold, align: 'center' },
      });
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
