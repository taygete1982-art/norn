import { Container, Graphics } from 'pixi.js';
import { LevelMeta } from '../game/levels/types';
import { ROMAN, STONE, glyph, stoneGradient, stonePanel } from './StoneTheme';

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
    // Каменная руна замка.
    const lock = new Graphics();
    lock.rect(x - 9 * s, y - 12 * s, 18 * s, 12 * s);
    lock.stroke({ width: 4, color: STONE.lock, alpha: 1 });
    lock.rect(x - 13 * s, y, 26 * s, 22 * s);
    lock.fill({ color: STONE.bgDark, alpha: 1 });
    lock.stroke({ width: 2, color: STONE.lock, alpha: 1 });
    lock.rect(x - 2 * s, y + 6 * s, 4 * s, 10 * s);
    lock.fill({ color: STONE.bgDeep, alpha: 1 });
    parent.addChild(lock);
  }

  private build(): void {
    const { totalStars } = this.opts;

    // Фон: градиент камня во тьму.
    this.addChild(stoneGradient(STAGE_W, 1280, STONE.bgDeep, STONE.black));

    const bar = stonePanel(STAGE_W, 64, { seed: 41 });
    this.addChild(bar);
    // Плашка суммарных звёзд: камень с руной и числом.
    const slab = stonePanel(150, 48, { seed: 42 });
    slab.position.set(16, 8);
    this.addChild(slab);
    const total = glyph(`★ ${totalStars}`, 30, STONE.border, 'left');
    total.anchor.set(0, 0.5);
    total.position.set(30, 32);
    this.addChild(total);

    const title = glyph('NORN', 64, STONE.glyph, 'center');
    title.anchor.set(0.5, 0);
    title.position.set(STAGE_W / 2, 84);
    this.addChild(title);

    const sub = glyph('Выбери уровень', 26, STONE.glyph, 'center');
    sub.anchor.set(0.5, 0);
    sub.position.set(STAGE_W / 2, 168);
    this.addChild(sub);

    // Вкладки биомов — каменные таблички с римским номером; без уровней залочена.
    for (let b = 1; b <= 6; b++) {
      const has = this.opts.levels.some((m) => biomeOf(m.levelNumber) === b);
      const tab = new Container();
      tab.position.set(TAB_X + (b - 1) * (TAB_W + TAB_GAP), TAB_Y);
      const bgTab = new Graphics();
      bgTab.rect(0, 0, TAB_W, TAB_H);
      bgTab.fill({ color: STONE.bg, alpha: has ? 1 : 0.4 });
      bgTab.stroke({
        width: 3,
        color: b === this.selectedBiome ? STONE.border : STONE.borderDim,
        alpha: 1,
      });
      tab.addChild(bgTab);
      const rune = new Graphics();
      rune.rect(10, TAB_H / 2 - 11, 22, 22);
      rune.fill({ color: has ? STONE.border : 0x333333, alpha: has ? 0.85 : 1 });
      tab.addChild(rune);
      const label = glyph(has ? ROMAN[b - 1] : '×', 28, has ? STONE.glyph : 0x666666, 'center');
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
      bgTab.fill({ color: STONE.bg, alpha: 1 });
      bgTab.stroke({
        width: 3,
        color: i + 1 === this.selectedBiome ? STONE.border : STONE.borderDim,
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
      bgBtn.fill({ color: STONE.bg, alpha: unlocked ? 1 : 0.4 });
      bgBtn.stroke({ width: 2, color: unlocked ? STONE.border : STONE.borderDim, alpha: unlocked ? 0.9 : 0.25 });
      btn.addChild(bgBtn);

      const icon = new Graphics();
      icon.rect(8, 8, 26, 26);
      icon.fill({
        color: STONE.bgDark,
        alpha: 1,
      });
      btn.addChild(icon);

      if (unlocked) {
        const num = glyph(String(levelNumber), 34, STONE.glyph, 'center');
        num.anchor.set(0.5);
        num.position.set(BTN / 2, BTN / 2 - 6);
        btn.addChild(num);

        for (let s = 0; s < 3; s++) {
          const lit = s < stars;
          const star = glyph('★', 18, lit ? STONE.runeLit : STONE.runeDim, 'center');
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
