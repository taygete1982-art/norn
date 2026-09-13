import { sdk } from '../platform/YandexSDK';

export interface LevelProgress {
  stars: 0 | 1 | 2 | 3;
  completed: boolean;
}

export interface SaveData {
  levels: Record<number, LevelProgress>;
  totalStars: number;
}

function emptySave(): SaveData {
  return { levels: {}, totalStars: 0 };
}

function clampStars(v: unknown): 0 | 1 | 2 | 3 {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0;
  return Math.max(0, Math.min(3, n)) as 0 | 1 | 2 | 3;
}

/** Чинит/отбрасывает битый сейв, totalStars всегда пересчитывается. */
function sanitize(raw: unknown): SaveData {
  const out = emptySave();
  if (!raw || typeof raw !== 'object') return out;
  const rec = (raw as { levels?: unknown }).levels;
  if (!rec || typeof rec !== 'object') return out;
  for (const [k, v] of Object.entries(rec as Record<string, unknown>)) {
    const n = Number(k);
    if (!Number.isInteger(n) || n <= 0 || !v || typeof v !== 'object') continue;
    const vv = v as { stars?: unknown; completed?: unknown };
    out.levels[n] = { stars: clampStars(vv.stars), completed: vv.completed === true };
  }
  out.totalStars = Object.values(out.levels).reduce((s, l) => s + l.stars, 0);
  return out;
}

/**
 * Прогрессия со звёздами и разблокировкой. Персистентность — через
 * IPlatformSDK (стаб: localStorage + in-memory фолбэк).
 */
export class Progression {
  private static cache: SaveData | null = null;

  public static async load(): Promise<SaveData> {
    if (this.cache) return this.cache;
    let raw: unknown = null;
    try {
      raw = await sdk.load();
    } catch {
      raw = null;
    }
    this.cache = sanitize(raw);
    return this.cache;
  }

  public static async save(data: SaveData): Promise<void> {
    this.cache = data;
    try {
      await sdk.save(data);
    } catch {
      // оффлайн/приватный режим — прогресс живёт в памяти до перезагрузки
    }
  }

  /**
   * Победа: 3 звезды за нетронутый кристалл, 2 за половину и больше, иначе 1.
   * Пишется максимум из старых и новых звёзд.
   */
  public static async recordWin(
    levelNumber: number,
    crystalHP: number,
    crystalMax: number,
  ): Promise<LevelProgress> {
    const data = await this.load();
    const stars: 0 | 1 | 2 | 3 =
      crystalHP >= crystalMax ? 3 : crystalHP * 2 >= crystalMax ? 2 : 1;
    const prev = data.levels[levelNumber];
    const next: LevelProgress = {
      stars: Math.max(prev?.stars ?? 0, stars) as 0 | 1 | 2 | 3,
      completed: true,
    };
    data.levels[levelNumber] = next;
    data.totalStars = Object.values(data.levels).reduce((s, l) => s + l.stars, 0);
    await this.save(data);
    return next;
  }

  /** Уровень 1 всегда открыт; N открыт, если N-1 пройден. */
  public static async isUnlocked(levelNumber: number): Promise<boolean> {
    if (levelNumber <= 1) return true;
    const data = await this.load();
    return data.levels[levelNumber - 1]?.completed === true;
  }

  public static async getStars(levelNumber: number): Promise<number> {
    const data = await this.load();
    return data.levels[levelNumber]?.stars ?? 0;
  }

  public static async getTotalStars(): Promise<number> {
    const data = await this.load();
    return data.totalStars;
  }

  /** Только для тестов: сбросить кэш (стаб SDK при этом хранит данные). */
  public static resetCache(): void {
    this.cache = null;
  }
}
