import { Container, Graphics, Text } from 'pixi.js';
import { PAL } from '../art/PixelArt';
import { LevelMeta } from '../game/levels/types';

export interface LevelProgressView {
  levelNumber: number;
  stars: number;
  unlocked: boolean;
}

export interface LevelSelectScreenOptions {
  levels: LevelMeta[];
  progress: LevelProgressView[];
  totalStars: number;
  onSelect: (levelNumber: number) => void;
}

const STAGE_W = 720;
const COLS = 6;
const ROWS = 6;
const BTN = 100;
const GAP = 12;
const GRID_X = (STAGE_W - (COLS * BTN + (COLS - 1) * GAP)) / 2;
const GRID_Y = 300;

const BIOME_COLORS: Record<number, number> = {
  1: PAL.grass,
  2: PAL.earth,
  3: PAL.gold,
  4: PAL.cloud,
  5: PAL.crystal,
  6: PAL.roadLight,
};

export class LevelSelectScreen extends Container {
  constructor(private opts: LevelSelectScreenOptions) {
    super();
    this.build();
  }

  private lockIcon(btn: Container, x: number, y: number): void {
    const lock = new Graphics();
    // Дужка.
    lock.rect(x - 9, y - 12, 18, 12);
    lock.stroke({ width: 4, color: PAL.stone, alpha: 1 });
    // Корпус.
    lock.rect(x - 13, y, 26, 22);
    lock.fill({ color: PAL.stoneDark, alpha: 1 });
    lock.stroke({ width: 2, color: PAL.stone, alpha: 1 });
    // Скважина.
    lock.rect(x - 2, y + 6, 4, 10);
    lock.fill({ color: 0x1a1a2e, alpha: 1 });
    btn.addChild(lock);
  }

  private build(): void {
    const { levels, progress, totalStars, onSelect } = this.opts;
    const byLevel = new Map(levels.map((l) => [l.levelNumber, l]));
    const byProgress = new Map(progress.map((p) => [p.levelNumber, p]));

    const bg = new Graphics();
    bg.rect(0, 0, STAGE_W, 1280);
    bg.fill({ color: PAL.void, alpha: 1 });
    this.addChild(bg);

    // Верхняя плашка с суммарными звёздами.
    const bar = new Graphics();
    bar.rect(0, 0, STAGE_W, 64);
    bar.fill({ color: PAL.uiPanel, alpha: 0.95 });
    bar.rect(0, 60, STAGE_W, 4);
    bar.fill({ color: PAL.gold, alpha: 1 });
    this.addChild(bar);
    const total = new Text({
      text: `★ ${totalStars}`,
      style: { fontFamily: 'Arial', fontSize: 32, fill: PAL.gold },
    });
    total.anchor.set(0, 0.5);
    total.position.set(24, 32);
    this.addChild(total);

    const title = new Text({
      text: 'NORN',
      style: { fontFamily: 'Arial', fontSize: 72, fill: PAL.gold, align: 'center' },
    });
    title.anchor.set(0.5, 0);
    title.position.set(STAGE_W / 2, 90);
    this.addChild(title);

    const sub = new Text({
      text: 'Выбери уровень',
      style: { fontFamily: 'Arial', fontSize: 30, fill: PAL.uiText, align: 'center' },
    });
    sub.anchor.set(0.5, 0);
    sub.position.set(STAGE_W / 2, 180);
    this.addChild(sub);

    for (let i = 0; i < COLS * ROWS; i++) {
      const levelNumber = i + 1;
      const meta = byLevel.get(levelNumber);
      const view = byProgress.get(levelNumber);
      const unlocked = !!meta && (view?.unlocked ?? false);
      const stars = unlocked ? (view?.stars ?? 0) : 0;
      const cx = GRID_X + (i % COLS) * (BTN + GAP);
      const cy = GRID_Y + Math.floor(i / COLS) * (BTN + GAP);

      const btn = new Container();
      btn.position.set(cx, cy);
      const bgBtn = new Graphics();
      bgBtn.rect(0, 0, BTN, BTN);
      bgBtn.fill({ color: PAL.uiPanel, alpha: unlocked ? 1 : 0.4 });
      bgBtn.stroke({ width: 2, color: PAL.gold, alpha: unlocked ? 0.9 : 0.25 });
      btn.addChild(bgBtn);

      // Иконка биома.
      const icon = new Graphics();
      icon.rect(8, 8, 26, 26);
      icon.fill({ color: meta ? (BIOME_COLORS[meta.biomeId] ?? PAL.stone) : 0x333333, alpha: 1 });
      btn.addChild(icon);

      if (unlocked) {
        const num = new Text({
          text: String(levelNumber),
          style: { fontFamily: 'Arial', fontSize: 34, fill: PAL.uiText, align: 'center' },
        });
        num.anchor.set(0.5);
        num.position.set(BTN / 2, BTN / 2 - 6);
        btn.addChild(num);

        // Звёзды: заработанные горят золотом.
        for (let s = 0; s < 3; s++) {
          const lit = s < stars;
          const star = new Text({
            text: lit ? '★' : '☆',
            style: { fontFamily: 'Arial', fontSize: 18, fill: lit ? PAL.gold : 0x555566 },
          });
          star.anchor.set(0.5);
          star.position.set(BTN / 2 + (s - 1) * 22, BTN - 14);
          btn.addChild(star);
        }

        btn.eventMode = 'static';
        btn.cursor = 'pointer';
        btn.on('pointertap', (e: any) => {
          e?.stopPropagation?.();
          onSelect(levelNumber);
        });
      } else {
        this.lockIcon(btn, BTN / 2, BTN / 2 - 4);
        btn.eventMode = 'none';
      }
      btn.alpha = unlocked ? 1 : 0.55;
      this.addChild(btn);
    }
  }
}
