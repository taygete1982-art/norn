import { Application } from 'pixi.js';
import { MainScene, GameEndResult, createApp } from './App';

export { createApp };

import { LevelSelectScreen, LevelProgressView } from './ui/LevelSelectScreen';
import { EndScreen } from './ui/EndScreen';
import { LevelLoader } from './game/levels/LevelLoader';
import { Progression } from './game/Progression';

const W = 720;
const H = 1280;

/**
 * Точка входа: экран выбора → игра → EndScreen → выбор/рестарт/следующий.
 * Сцена всегда пересоздаётся из JSON — утечек состояния между запусками нет.
 */
async function boot(): Promise<void> {
  const app = new Application();
  await app.init({ width: W, height: H, background: '#1a1a2e' });
  const host = document.getElementById('app');
  if (host) host.appendChild(app.canvas);
  else document.body.appendChild(app.canvas);

  let current: MainScene | null = null;
  app.ticker.add((ticker) => {
    current?.update(ticker.deltaMS / 1000);
  });
  (window as any).__norn = { app };

  const removeScene = (scene: MainScene): void => {
    app.stage.removeChild(scene);
    scene.destroy({ children: true });
    if (current === scene) current = null;
  };

  const showSelect = async (): Promise<void> => {
    const levels = await LevelLoader.loadAllMetadata();
    const progress: LevelProgressView[] = [];
    for (const m of levels) {
      progress.push({
        levelNumber: m.levelNumber,
        stars: await Progression.getStars(m.levelNumber),
        unlocked: await Progression.isUnlocked(m.levelNumber),
      });
    }
    const totalStars = await Progression.getTotalStars();
    const select = new LevelSelectScreen({
      levels,
      progress,
      totalStars,
      onSelect: (n) => {
        app.stage.removeChild(select);
        select.destroy({ children: true });
        void startLevel(n);
      },
    });
    app.stage.addChild(select);
  };

  const startLevel = async (n: number): Promise<void> => {
    const level = await LevelLoader.loadLevel(n);
    const scene = new MainScene(level, { onGameEnd: (r) => void onGameEnd(n, scene, r) });
    current = scene;
    app.stage.addChild(scene);
    (window as any).__norn.scene = scene;
  };

  const onGameEnd = async (n: number, scene: MainScene, r: GameEndResult): Promise<void> => {
    current = null; // поле боя замирает под EndScreen
    let stars: 0 | 1 | 2 | 3 = 0;
    if (r.won) {
      // Запись в сейв — строго перед показом EndScreen.
      stars = (await Progression.recordWin(n, r.crystalHP, r.crystalMax)).stars;
    }
    const metas = await LevelLoader.loadAllMetadata();
    const hasNext = metas.some((m) => m.levelNumber === n + 1);
    const end = new EndScreen({
      won: r.won,
      stars,
      hasNext,
      onNext: () => {
        closeEnd();
        removeScene(scene);
        void startLevel(n + 1);
      },
      onReplay: () => {
        closeEnd();
        removeScene(scene);
        void startLevel(n);
      },
      onToSelect: () => {
        closeEnd();
        removeScene(scene);
        void showSelect();
      },
    });
    const closeEnd = (): void => {
      app.stage.removeChild(end);
      end.destroy({ children: true });
    };
    app.stage.addChild(end);
  };

  await showSelect();
}

void boot();
