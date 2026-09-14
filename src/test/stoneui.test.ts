import { describe, it, expect, vi } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import { STONE, ROMAN, glyph, stonePanel, stoneGradient } from '../ui/StoneTheme';
import { TowerSelectMenu } from '../ui/TowerSelectMenu';
import { TowerUpgradeMenu } from '../ui/TowerUpgradeMenu';
import { EndScreen } from '../ui/EndScreen';
import { LevelSelectScreen } from '../ui/LevelSelectScreen';
import { MainScene } from '../App';
import { LevelLoader } from '../game/levels/LevelLoader';

// Канон #08 stone-ui: каменный UI. Логика экранов не тронута —
// тесты проверяют сборку без ошибок, открытие/закрытие и стиль.

// MainScene тянет PixelArt/Lighting через document: минимальный фейк canvas.
function makeCtx(): unknown {
  return {
    imageSmoothingEnabled: true,
    fillStyle: '#000000',
    fillRect: () => undefined,
    clearRect: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    drawImage: () => undefined,
    createImageData: (w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    }),
    putImageData: () => undefined,
    getImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
  };
}
vi.stubGlobal('document', {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => makeCtx(),
  }),
});

/** Сколько контейнеров в дереве с заданной alpha. */
function countAlpha(root: Container, alpha: number): number {
  let n = root.alpha === alpha ? 1 : 0;
  for (const c of root.children) {
    if (c instanceof Container) n += countAlpha(c, alpha);
  }
  return n;
}

const MENU_OPTS = {
  gridX: 5,
  gridY: 5,
  screenX: 360,
  screenY: 400,
  onSelect: () => undefined,
  onCancel: () => undefined,
};

describe('stone-ui: каменная тема', () => {
  it('StoneTheme: палитра и строители', () => {
    expect(STONE.bg).toBe(0x2e3038);
    expect(STONE.border).toBe(0x35e0ff);
    expect(STONE.glyph).toBe(0xe0e0e0);
    expect(STONE.runeLit).toBe(0x35e0ff);
    expect(STONE.runeDim).toBe(0x1e2028);
    expect(STONE.lock).toBe(0x8d9199);
    expect(ROMAN).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI']);
    expect(stonePanel(100, 50)).toBeInstanceOf(Graphics);
    expect(stoneGradient(720, 1280, STONE.bgDeep, STONE.black)).toBeInstanceOf(Graphics);
    const t = glyph('NORN', 64);
    expect(t.text).toBe('NORN');
  });

  it('меню выбора открывается, затемняется недоступное, закрывается', () => {
    const rich = new TowerSelectMenu({ ...MENU_OPTS, gold: 1000 });
    expect(countAlpha(rich, 0.4)).toBe(0);
    rich.update(0.5);
    rich.close();

    const poor = new TowerSelectMenu({ ...MENU_OPTS, gold: 0 });
    // Три кнопки башен затемнены, рамка гаснет.
    expect(countAlpha(poor, 0.4)).toBe(3);
    poor.close();
  });

  it('меню апгрейдов открывается с кнопками и с MAX, закрывается', () => {
    const base = {
      title: 'Arrow · tier 1',
      lines: ['Урон 10'],
      sellValue: 70,
      onUpgrade: () => undefined,
      onSell: () => undefined,
      onClose: () => undefined,
    };
    const m1 = new TowerUpgradeMenu({ ...base, upgradeCost: 100 });
    m1.update(0.5);
    m1.close();
    const m2 = new TowerUpgradeMenu({ ...base, upgradeCost: null });
    m2.close();
  });

  it('EndScreen собирается для победы и поражения', () => {
    const base = {
      onNext: () => undefined,
      onReplay: () => undefined,
      onToSelect: () => undefined,
    };
    const won = new EndScreen({ ...base, won: true, stars: 2, hasNext: true });
    expect(won.children.length).toBeGreaterThan(5);
    const lost = new EndScreen({ ...base, won: false, stars: 0, hasNext: false });
    expect(lost.children.length).toBeGreaterThan(3);
  });

  it('экран выбора уровней собирается, сетка 36 кнопок', () => {
    const levels = Array.from({ length: 36 }, (_, i) => ({
      levelNumber: i + 1,
      biomeId: 1,
      biomeName: 'Замшелые Руины',
    }));
    const progress = levels.map((l) => ({
      levelNumber: l.levelNumber,
      stars: l.levelNumber === 1 ? 2 : 0,
      unlocked: l.levelNumber <= 2,
    }));
    const screen = new LevelSelectScreen({
      levels,
      progress,
      totalStars: 2,
      onSelect: () => undefined,
    });
    expect(screen.children.length).toBeGreaterThan(10);
  });

  it('HUD сцены рендерится без ошибок', async () => {
    const scene = new MainScene(await LevelLoader.loadLevel(1));
    expect(scene.children.length).toBeGreaterThan(5);
    scene.update(0.016);
  });
});
