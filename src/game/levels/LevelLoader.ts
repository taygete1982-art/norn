import { LevelConfig, LevelMeta } from './types';

const BIOME_NAMES: Record<number, string> = {
  1: 'Цветочные Поляны',
  2: 'Грибной Лес',
  3: 'Конфетный Остров',
  4: 'Облачный Замок',
  5: 'Радужный Риф',
  6: 'Карнавал Чудес',
};

type LevelModule = { default: LevelConfig };

export class LevelLoader {
  private static cache = new Map<number, LevelConfig>();

  /** Загружает уровень по номеру (1-216), кэширует. Нет файла — бросает ошибку. */
  public static async loadLevel(levelNumber: number): Promise<LevelConfig> {
    const hit = this.cache.get(levelNumber);
    if (hit) return hit;
    const pad = levelNumber.toString().padStart(3, '0');
    let mod: LevelModule;
    try {
      mod = (await import(`./level_${pad}.json`)) as LevelModule;
    } catch {
      throw new Error(`Level not found: ${levelNumber}`);
    }
    if (!mod || !mod.default || !Array.isArray(mod.default.path)) {
      throw new Error(`Level not found: ${levelNumber}`);
    }
    this.cache.set(levelNumber, mod.default);
    return mod.default;
  }

  public static getBiomeName(biomeId: number): string {
    return BIOME_NAMES[biomeId] ?? `Биом ${biomeId}`;
  }

  /**
   * Сканирует папку levels/ через import.meta.glob и возвращает метаданные
   * всех доступных уровней (растёт автоматически с новыми level_XXX.json).
   */
  public static async loadAllMetadata(): Promise<LevelMeta[]> {
    const glob = (
      import.meta as unknown as {
        glob: (pattern: string) => Record<string, () => Promise<LevelModule>>;
      }
    ).glob('./level_*.json');
    const out: LevelMeta[] = [];
    for (const [path, load] of Object.entries(glob)) {
      const m = path.match(/level_(\d+)\.json$/);
      if (!m) continue;
      const levelNumber = parseInt(m[1], 10);
      const mod = await load();
      out.push({
        levelNumber,
        biomeId: mod.default.biomeId,
        biomeName: this.getBiomeName(mod.default.biomeId),
      });
    }
    out.sort((a, b) => a.levelNumber - b.levelNumber);
    return out;
  }
}
