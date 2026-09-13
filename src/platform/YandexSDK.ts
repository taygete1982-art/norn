/**
 * Yandex Games SDK Obертка
 * Лок ориентации — настройка Консоли разработчика при публикации.
 */

export interface IPlatformSDK {
  init(): Promise<void>;
  gameplayStart(): void; gameplayStop(): void;
  showRewarded(h: { onReward: () => void }): void;
  showInterstitial(): void;
  save(d: object): Promise<void>; load(): Promise<object | null>;
}

export class YandexSDK implements IPlatformSDK {
  private initialized: boolean;
  private _saveData: Map<string, object>;
  private orientation: 'portrait' | 'landscape' | null = null;

  constructor() {
    this.initialized = false;
    this._saveData = new Map();
  }

  init(): Promise<void> {
    if (typeof window !== 'undefined') {
      const isYandex = (window as any).ysdk?.player?.isYandexGames;
      this.initialized = isYandex;
    }
    return Promise.resolve();
  }

  gameplayStart() {
    // SDK будет автоматически инициализирован при старте игры в Yandex
  }

  gameplayStop() {
  }

  showRewarded(h: { onReward: () => void }): void {
    console.log('YandexSDK.showRewarded called');
    h.onReward();
  }

  showInterstitial() {
    console.log('YandexSDK.showInterstitial called');
  }

  save(d: object): Promise<void> {
    const key = 'norn_save';
    const payload = JSON.stringify(d);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, payload);
      } else {
        this._saveData.set(key, d);
      }
    } catch {
      this._saveData.set(key, d);
    }
    console.log(`Saved:`, d);
    return Promise.resolve();
  }

  load(): Promise<object | null> {
    const key = 'norn_save';
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as object;
          console.log('Loaded:', parsed);
          return Promise.resolve(parsed);
        }
        return Promise.resolve(null);
      }
    } catch {
      // приватный режим / битый JSON — падаем на in-memory
    }
    const saved = this._saveData.get(key);
    if (saved) {
      console.log('Loaded:', saved);
      return Promise.resolve(saved);
    }
    return Promise.resolve(null);
  }

  getOrientation(): 'portrait' | 'landscape' | null {
    // Портрет — ширина < высоты
    if (window.innerWidth > window.innerHeight) {
      this.orientation = 'landscape';
    } else {
      this.orientation = 'portrait';
    }
    return this.orientation;
  }
}

// Export instance
export const sdk = new YandexSDK();
