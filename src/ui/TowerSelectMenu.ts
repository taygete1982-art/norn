import { Container, Graphics } from 'pixi.js';
import { ConfigLoader } from '../game/config/ConfigLoader';
import { TowerType } from '../game/entities/TowerFactory';
import { STONE, glyph, stonePanel } from './StoneTheme';

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

/** Рунические глифы типов башен. */
const RUNES: Record<string, string> = {
  arrow: '↑',
  cannon: '●',
  ice: '◆',
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

    // Панель bottom-sheet: тёмный камень с циановой кромкой.
    const panel = stonePanel(STAGE_W, SHEET_H, { seed: 33 });
    panel.position.set(0, STAGE_H - SHEET_H);
    panel.eventMode = 'static';
    // Тап по панели мимо кнопок — ничего не делает, не закрывает.
    panel.on('pointertap', (e: any) => e?.stopPropagation?.());
    this.sheet.addChild(panel);

    const title = glyph(`Башня? (${gridX}, ${gridY})`, 26);
    title.anchor.set(0, 0.5);
    title.position.set(PAD, STAGE_H - SHEET_H + 34);
    this.sheet.addChild(title);

    const hint = glyph(`Gold: ${gold}`, 22);
    hint.anchor.set(0, 0.5);
    hint.position.set(PAD, STAGE_H - SHEET_H + 68);
    this.sheet.addChild(hint);

    // Крестик отмены в каменной плашке.
    const cancel = new Container();
    cancel.position.set(STAGE_W - PAD - 20, STAGE_H - SHEET_H + 40);
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
      onCancel();
    });
    this.sheet.addChild(cancel);

    towers.slice(0, 3).forEach((t, i) => {
      const affordable = gold >= t.cost;
      const bx = PAD + i * (BTN_W + GAP);
      const btn = new Container();
      btn.position.set(bx + BTN_W / 2, BTN_Y + BTN_H / 2);
      // Каменная плашка: рамка горит при доступности, гаснет при нехватке.
      const bg = stonePanel(BTN_W, BTN_H, {
        border: affordable ? STONE.border : STONE.borderDim,
        seed: 100 + i,
      });
      bg.position.set(-BTN_W / 2, -BTN_H / 2);
      btn.addChild(bg);
      const rune = glyph(RUNES[t.id] ?? '◆', 30, affordable ? STONE.border : STONE.borderDim, 'center');
      rune.anchor.set(0.5);
      rune.position.set(0, -42);
      btn.addChild(rune);
      const label = glyph(`${NAMES[t.id] ?? t.id}\n${t.cost}g`, 24, STONE.glyph, 'center');
      label.anchor.set(0.5);
      label.position.set(0, 18);
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

    // Широкая кнопка отмены: каменная плашка.
    const cancelWide = new Container();
    cancelWide.position.set(STAGE_W / 2, STAGE_H - 48);
    const cancelWideBg = new Graphics();
    cancelWideBg.rect(-(STAGE_W / 2 - PAD), -24, STAGE_W - PAD * 2, 48);
    cancelWideBg.fill({ color: STONE.bg, alpha: 1 });
    cancelWideBg.stroke({ width: 2, color: STONE.borderDim, alpha: 0.8 });
    const cancelWideLabel = glyph('Отмена', 24, STONE.glyph, 'center');
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
