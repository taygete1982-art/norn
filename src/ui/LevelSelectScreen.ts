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
const GRID_Y = 330;
const TAB_W = 104;
const TAB_H = 52;
const TAB_GAP = 10;
const TAB_X = (STAGE_W - (6 * TAB_W + 5 * TAB_GAP)) / 2;
const TAB_Y = 258;
const LEVELS_PER_BIOME = 36;

const BIOME_COLORS: Record<number, number> = {
  1: PAL.grass,
  2: PAL.earth,
  3: PAL.gold,
  4: PAL.cloud,
  5: PAL.crystal,
  6: PAL.roadLight,
};

function biomeOf(levelNumber: number): number {
  return Math.floor((levelNumber - 1) / LEVELS_PER_BIOME) + 1;
}

export class LevelSelectScreen extends Container {
  private grid = new Container();
  private tabs: Container[] = [];
  private selectedBiome = 1;

  constructor(private opts: LevelSelectScreenOptions) {
    super();
    this.build();
  }

  private lockIcon(parent: Container, x: number, y: number, s = 1): void {
    const lock = new Graphics();
    lock.rect(x - 9 * s, y - 12 * s, 18 * s, 12 * s);
    lock.stroke({ width: 4, color: PAL.stone, alpha: 1 });
    lock.rect(x - 13 * s, y, 26 * s, 22 * s);
    lock.fill({ color: PAL.stoneDark, alpha: 1 });
    lock.stroke({ width: 2, color: PAL.stone, alpha: 1 });
    lock.rect(x - 2 * s, y + 6 * s, 4 * s, 10 * s);
    lock.fill({ color: 0x1a1a2e, alpha: 1 });
    parent.addChild(lock);
  }

  private build(): void {
    const { totalStars } = this.opts;

    const bg = new Graphics();
    bg.rect(0, 0, STAGE_W, 1280);
    bg.fill({ color: PAL.void, alpha: 1 });
    this.addChild(bg);

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
      style: { fontFamily: 'Arial', fontSize: 64, fill: PAL.gold, align: 'center' },
    });
    title.anchor.set(0.5, 0);
    title.position.set(STAGE_W / 2, 84);
    this.addChild(title);

    const sub = new Text({
      text: 'Выбери уровень',
      style: { fontFamily: 'Arial', fontSize: 26, fill: PAL.uiText, align: 'center' },
    });
    sub.anchor.set(0.5, 0);
    sub.position.set(STAGE_W / 2, 168);
    this.addChild(sub);

    // Вкладки биомов; без сгенерированных уровней вкладка залочена.
    for (let b = 1; b <= 6; b++) {
      const has = this.opts.levels.some((m) => biomeOf(m.levelNumber) === b);
      const tab = new Container();
      tab.position.set(TAB_X + (b - 1) * (TAB_W + TAB_GAP), TAB_Y);
      const bgTab = new Graphics();
      bgTab.rect(0, 0, TAB_W, TAB_H);
      bgTab.fill({ color: PAL.uiPanel, alpha: has ? 1 : 0.4 });
      bgTab.stroke({
        width: 3,
        color: b === this.selectedBiome ? PAL.gold : PAL.stoneDark,
        alpha: 1,
      });
      tab.addChild(bgTab);
      const dot = new Graphics();
      dot.rect(10, TAB_H / 2 - 11, 22, 22);
      dot.fill({ color: has ? (BIOME_COLORS[b] ?? PAL.stone) : 0x333333, alpha: 1 });
      tab.addChild(dot);
      const label = new Text({
        text: has ? String(b) : '×',
        style: { fontFamily: 'Arial', fontSize: 28, fill: has ? PAL.uiText : 0x666666 },
      });
      label.anchor.set(0.5);
      label.position.set(TAB_W / 2 + 10, TAB_H / 2);
      tab.addChild(label);
      if (has) {
        tab.eventMode = 'static';
        tab.cursor = 'pointer';
        const biome = b;
        tab.on('pointertap', (e: any) => {
          e?.stopPropagation?.();
          this.selectedBiome = biome;
          this.refreshTabs();
          this.rebuildGrid();
        });
      } else {
        tab.eventMode = 'none';
        tab.alpha = 0.55;
      }
      this.tabs.push(tab);
      this.addChild(tab);
    }

    this.addChild(this.grid);
    this.rebuildGrid();
  }

  private refreshTabs(): void {
    for (let i = 0; i < this.tabs.length; i++) {
      const tab = this.tabs[i];
      const bgTab = tab.children[0] as Graphics;
      bgTab.clear();
      bgTab.rect(0, 0, TAB_W, TAB_H);
      bgTab.fill({ color: PAL.uiPanel, alpha: 1 });
      bgTab.stroke({
        width: 3,
        color: i + 1 === this.selectedBiome ? PAL.gold : PAL.stoneDark,
        alpha: 1,
      });
      // Иконка и подпись — дети 1 и 2, их не трогаем.
    }
  }

  private rebuildGrid(): void {
    for (const child of [...this.grid.children]) {
      this.grid.removeChild(child);
      child.destroy({ children: true });
    }
    const { levels, progress, onSelect } = this.opts;
    const byLevel = new Map(levels.map((l) => [l.levelNumber, l]));
    const byProgress = new Map(progress.map((p) => [p.levelNumber, p]));
    const base = (this.selectedBiome - 1) * LEVELS_PER_BIOME;

    for (let i = 0; i < COLS * ROWS; i++) {
      const levelNumber = base + i + 1;
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

      const icon = new Graphics();
      icon.rect(8, 8, 26, 26);
      icon.fill({
        color: meta ? (BIOME_COLORS[meta.biomeId] ?? PAL.stone) : 0x333333,
        alpha: 1,
      });
      btn.addChild(icon);

      if (unlocked) {
        const num = new Text({
          text: String(levelNumber),
          style: { fontFamily: 'Arial', fontSize: 34, fill: PAL.uiText, align: 'center' },
        });
        num.anchor.set(0.5);
        num.position.set(BTN / 2, BTN / 2 - 6);
        btn.addChild(num);

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
      this.grid.addChild(btn);
    }
  }
}
