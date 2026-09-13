import { Container, Graphics, Text } from 'pixi.js';
import { ConfigLoader } from '../game/config/ConfigLoader';
import { TowerType } from '../game/entities/TowerFactory';
import { PAL } from '../art/PixelArt';

export interface TowerSelectMenuOptions {
  gridX: number;
  gridY: number;
  /** экранные координаты точки строительства (bottom-sheet их не использует) */
  screenX: number;
  screenY: number;
  gold: number;
  onSelect: (type: TowerType) => void;
  onCancel: () => void;
}

const STAGE_W = 720;
const STAGE_H = 1280;
const SHEET_H = 340;
const BTN_W = 213;
const BTN_H = 150;
const BTN_Y = STAGE_H - 260;
const GAP = 20;
const PAD = 20;

const COLORS: Record<string, number> = {
  arrow: 0x2ecc71,
  cannon: 0xe74c3c,
  ice: 0x3498db,
};

const NAMES: Record<string, string> = {
  arrow: 'Arrow',
  cannon: 'Cannon',
  ice: 'Ice',
};

const SLIDE_DUR = 0.25;
const SLIDE_DIST = 360;

export class TowerSelectMenu extends Container {
  private sheet = new Container();
  private animT = 0;

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.opts.onCancel();
  };

  constructor(private opts: TowerSelectMenuOptions) {
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

  private build(): void {
    const { gridX, gridY, gold, onSelect, onCancel } = this.opts;
    const towers = ConfigLoader.getTowers();

    // Дим-подложка на весь экран: тап вне панели = отмена.
    const backdrop = new Graphics();
    backdrop.rect(0, 0, STAGE_W, STAGE_H);
    backdrop.fill({ color: 0x000000, alpha: 0.35 });
    backdrop.eventMode = 'static';
    backdrop.cursor = 'default';
    backdrop.on('pointertap', (e: any) => {
      e?.stopPropagation?.();
      onCancel();
    });
    this.addChild(backdrop);

    // Панель bottom-sheet.
    const panel = new Graphics();
    panel.rect(0, STAGE_H - SHEET_H, STAGE_W, SHEET_H);
    panel.fill({ color: PAL.uiPanel, alpha: 0.98 });
    panel.rect(0, STAGE_H - SHEET_H, STAGE_W, 4);
    panel.fill({ color: PAL.gold, alpha: 1 });
    panel.eventMode = 'static';
    // Тап по панели мимо кнопок — ничего не делает, не закрывает.
    panel.on('pointertap', (e: any) => e?.stopPropagation?.());
    this.sheet.addChild(panel);

    const title = new Text({
      text: `Башня? (${gridX}, ${gridY})`,
      style: { fontFamily: 'Arial', fontSize: 26, fill: PAL.uiText },
    });
    title.anchor.set(0, 0.5);
    title.position.set(PAD, STAGE_H - SHEET_H + 34);
    this.sheet.addChild(title);

    const hint = new Text({
      text: `Gold: ${gold}`,
      style: { fontFamily: 'Arial', fontSize: 22, fill: PAL.gold },
    });
    hint.anchor.set(0, 0.5);
    hint.position.set(PAD, STAGE_H - SHEET_H + 68);
    this.sheet.addChild(hint);

    // Крестик отмены.
    const cancel = new Container();
    cancel.position.set(STAGE_W - PAD - 20, STAGE_H - SHEET_H + 40);
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
      onCancel();
    });
    this.sheet.addChild(cancel);

    towers.slice(0, 3).forEach((t, i) => {
      const affordable = gold >= t.cost;
      const bx = PAD + i * (BTN_W + GAP);
      const btn = new Container();
      btn.position.set(bx + BTN_W / 2, BTN_Y + BTN_H / 2);
      const bg = new Graphics();
      bg.rect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H);
      bg.fill({ color: COLORS[t.id] ?? 0x888888, alpha: 1 });
      bg.stroke({ width: 3, color: 0xffffff, alpha: 0.85 });
      bg.rect(-BTN_W / 2 + 6, -BTN_H / 2 + 6, BTN_W - 12, BTN_H - 12);
      bg.stroke({ width: 2, color: 0x000000, alpha: 0.5 });
      btn.addChild(bg);
      const label = new Text({
        text: `${NAMES[t.id] ?? t.id}\n${t.cost}g`,
        style: { fontFamily: 'Arial', fontSize: 26, fill: 0xffffff, align: 'center' },
      });
      label.anchor.set(0.5);
      btn.addChild(label);
      btn.alpha = affordable ? 1 : 0.4;
      if (affordable) {
        btn.eventMode = 'static';
        btn.cursor = 'pointer';
        const type = t.id as TowerType;
        btn.on('pointertap', (e: any) => {
          e?.stopPropagation?.();
          onSelect(type);
        });
      } else {
        btn.eventMode = 'none';
      }
      this.sheet.addChild(btn);
    });

    // Широкая кнопка отмены.
    const cancelWide = new Container();
    cancelWide.position.set(STAGE_W / 2, STAGE_H - 48);
    const cancelWideBg = new Graphics();
    cancelWideBg.rect(-(STAGE_W / 2 - PAD), -24, STAGE_W - PAD * 2, 48);
    cancelWideBg.fill({ color: 0x444444, alpha: 1 });
    cancelWideBg.stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
    const cancelWideLabel = new Text({
      text: 'Отмена',
      style: { fontFamily: 'Arial', fontSize: 24, fill: 0xffffff, align: 'center' },
    });
    cancelWideLabel.anchor.set(0.5);
    cancelWide.addChild(cancelWideBg, cancelWideLabel);
    cancelWide.eventMode = 'static';
    cancelWide.cursor = 'pointer';
    cancelWide.on('pointertap', (e: any) => {
      e?.stopPropagation?.();
      onCancel();
    });
    this.sheet.addChild(cancelWide);

    // Стартовая позиция для выезда снизу.
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
