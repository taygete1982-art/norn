import { Container, Graphics, Text } from 'pixi.js';
import { PAL } from '../art/PixelArt';

export interface EndScreenOptions {
  won: boolean;
  stars: 0 | 1 | 2 | 3;
  /** false — кнопки «Следующий уровень» нет (уровня N+1 не существует) */
  hasNext: boolean;
  onNext: () => void;
  onReplay: () => void;
  onToSelect: () => void;
}

const STAGE_W = 720;
const STAGE_H = 1280;
const PANEL_W = 600;
const PANEL_H = 480;
const BTN_W = 520;
const BTN_H = 76;

export class EndScreen extends Container {
  constructor(private opts: EndScreenOptions) {
    super();
    this.build();
  }

  private button(y: number, label: string, primary: boolean, cb: () => void): void {
    const btn = new Container();
    btn.position.set(STAGE_W / 2, y);
    const bg = new Graphics();
    bg.rect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H);
    bg.fill({ color: PAL.uiPanel, alpha: 1 });
    bg.stroke({ width: 3, color: primary ? PAL.gold : PAL.stone, alpha: 1 });
    const text = new Text({
      text: label,
      style: { fontFamily: 'Arial', fontSize: 30, fill: PAL.uiText, align: 'center' },
    });
    text.anchor.set(0.5);
    btn.addChild(bg, text);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', (e: any) => {
      e?.stopPropagation?.();
      cb();
    });
    this.addChild(btn);
  }

  private build(): void {
    const { won, stars, hasNext, onNext, onReplay, onToSelect } = this.opts;

    // Дим на весь экран, тапы глотает (кнопки — единственный выход).
    const backdrop = new Graphics();
    backdrop.rect(0, 0, STAGE_W, STAGE_H);
    backdrop.fill({ color: 0x000000, alpha: 0.55 });
    backdrop.eventMode = 'static';
    backdrop.on('pointertap', (e: any) => e?.stopPropagation?.());
    this.addChild(backdrop);

    const px = (STAGE_W - PANEL_W) / 2;
    const py = (STAGE_H - PANEL_H) / 2;
    const panel = new Graphics();
    panel.rect(px, py, PANEL_W, PANEL_H);
    panel.fill({ color: PAL.uiPanel, alpha: 0.98 });
    panel.stroke({ width: 4, color: won ? PAL.gold : PAL.stoneDark, alpha: 1 });
    this.addChild(panel);

    const title = new Text({
      text: won ? 'Победа!' : 'Поражение',
      style: {
        fontFamily: 'Arial',
        fontSize: 54,
        fill: won ? PAL.gold : PAL.uiText,
        align: 'center',
      },
    });
    title.anchor.set(0.5, 0);
    title.position.set(STAGE_W / 2, py + 36);
    this.addChild(title);

    let y = py + 130;
    if (won) {
      // Три слота звёзд: заработанные горят.
      for (let i = 0; i < 3; i++) {
        const lit = i < stars;
        const star = new Text({
          text: lit ? '★' : '☆',
          style: { fontFamily: 'Arial', fontSize: 72, fill: lit ? PAL.gold : 0x555566 },
        });
        star.anchor.set(0.5, 0);
        star.position.set(STAGE_W / 2 + (i - 1) * 96, y);
        this.addChild(star);
      }
      y += 110;
      if (hasNext) {
        this.button(y + BTN_H / 2, 'Следующий уровень', true, onNext);
        y += BTN_H + 16;
      }
      this.button(y + BTN_H / 2, 'Переиграть', !hasNext, onReplay);
      y += BTN_H + 16;
      this.button(y + BTN_H / 2, 'К выбору', false, onToSelect);
    } else {
      this.button(y + BTN_H / 2, 'Ещё раз', true, onReplay);
      y += BTN_H + 16;
      this.button(y + BTN_H / 2, 'К выбору', false, onToSelect);
    }
  }
}
