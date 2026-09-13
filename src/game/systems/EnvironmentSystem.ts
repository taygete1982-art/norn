import { World } from '../../ecs/world';

export interface EnvConfig {
  biomeId: number;
  /** клетки choco "x,y" (биом 3) */
  choco: Set<string>;
  /** клетки bubble-зон "x,y" (биом 5) */
  bubbles: Set<string>;
  wind: { dx: number; dy: number } | null;
  buildPoints: Array<{ gx: number; gy: number }>;
}

export interface CloudState {
  gx: number;
  gy: number;
  until: number;
}

export interface DanceState {
  id: number;
  danceUntil: number;
  buffUntil: number;
}

const SPORE_PERIOD = 30;
const SPORE_DUR = 5;
const SPORE_RADIUS = 1.5;
const DANCE_PERIOD = 40;
const DANCE_DUR = 3;
const BUFF_DUR = 5;
const HASTE = 1.5;

/**
 * Механики среды биомов. Активный набор определяется biomeId
 * (environmentEffects уровня — задел на будущее):
 * 2 — spore_clouds, 3 — choco (по terrain), 4 — wind, 5 — bubble (по terrain),
 * 6 — carnival. Всё время — мировое (детерминировано, стопорится паузой).
 */
export class EnvironmentSystem {
  private static biomeId = 1;
  private static choco = new Set<string>();
  private static bubbles = new Set<string>();
  private static wind: { dx: number; dy: number } | null = null;
  private static buildPoints: Array<{ gx: number; gy: number }> = [];
  private static nextCloudAt = SPORE_PERIOD;
  private static cloud: CloudState | null = null;
  private static nextDanceAt = DANCE_PERIOD;
  private static dance: DanceState | null = null;
  private static toasts: string[] = [];
  private static windAnnounced = false;
  private static bubbleAnnounced = false;

  /** Полная конфигурация забега (из MainScene). Сбрасывает таймеры. */
  public static configure(cfg: EnvConfig): void {
    this.biomeId = cfg.biomeId;
    this.choco = new Set(cfg.choco);
    this.bubbles = new Set(cfg.bubbles);
    this.wind = cfg.wind ? { ...cfg.wind } : null;
    this.buildPoints = cfg.buildPoints.map((p) => ({ ...p }));
    this.resetRuntime();
  }

  /** Рестарт таймеров, конфиг сохраняется. */
  public static reset(): void {
    this.resetRuntime();
  }

  private static resetRuntime(): void {
    this.nextCloudAt = SPORE_PERIOD;
    this.cloud = null;
    this.nextDanceAt = DANCE_PERIOD;
    this.dance = null;
    this.toasts = [];
    this.windAnnounced = false;
    this.bubbleAnnounced = false;
  }

  private static key(gx: number, gy: number): string {
    return `${Math.round(gx)},${Math.round(gy)}`;
  }

  public static isChoco(gx: number, gy: number): boolean {
    return this.biomeId === 3 && this.choco.has(this.key(gx, gy));
  }

  /** Башня в пузыре: на bubble-плитке или по соседству (8-окрестность). */
  public static inBubble(gx: number, gy: number): boolean {
    if (this.biomeId !== 5) return false;
    const cx = Math.round(gx);
    const cy = Math.round(gy);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (this.bubbles.has(`${cx + dx},${cy + dy}`)) return true;
      }
    }
    return false;
  }

  /** Множитель скорости врага: choco ×1.3, ветер ×1.15 / ×0.85. */
  public static moveMult(gx: number, gy: number, dx: number, dy: number): number {
    let m = 1;
    if (this.isChoco(gx, gy)) m *= 1.3;
    if (this.wind && this.biomeId === 4) {
      m *= dx * this.wind.dx + dy * this.wind.dy > 0 ? 1.1 : 0.9;
    }
    return m;
  }

  /** Множитель получаемого magic-урона на choco. */
  public static magicTakenMult(gx: number, gy: number): number {
    return this.isChoco(gx, gy) ? 1.2 : 1;
  }

  /** Множитель кулдауна башни в пузыре. */
  public static cooldownMult(gx: number, gy: number): number {
    return this.inBubble(gx, gy) ? 1.25 : 1;
  }

  public static isSilenced(world: World, gx: number, gy: number): boolean {
    if (this.biomeId !== 2 || !this.cloud) return false;
    if (world.getCurrentTime() >= this.cloud.until) return false;
    return Math.hypot(gx - this.cloud.gx, gy - this.cloud.gy) <= SPORE_RADIUS;
  }

  public static isDancing(world: World, id: number): boolean {
    if (this.biomeId !== 6 || !this.dance) return false;
    return this.dance.id === id && world.getCurrentTime() < this.dance.danceUntil;
  }

  public static hasteMult(world: World, id: number): number {
    if (this.biomeId !== 6 || !this.dance) return 1;
    const now = world.getCurrentTime();
    return this.dance.id === id && now >= this.dance.danceUntil && now < this.dance.buffUntil
      ? HASTE
      : 1;
  }

  public static getDance(id: number): DanceState | null {
    return this.dance?.id === id ? this.dance : null;
  }

  public static getCloud(world: World): CloudState | null {
    if (!this.cloud || world.getCurrentTime() >= this.cloud.until) return null;
    return this.cloud;
  }

  public static takeToast(): string | null {
    return this.toasts.shift() ?? null;
  }

  public static update(world: World): void {
    const now = world.getCurrentTime();
    // Споры биома 2: каждые 30 c зона вокруг точки строительства на 5 c.
    if (this.biomeId === 2) {
      if (this.cloud && now >= this.cloud.until) this.cloud = null;
      if (!this.cloud && now >= this.nextCloudAt && this.buildPoints.length > 0) {
        const idx = Math.floor(now / SPORE_PERIOD) % this.buildPoints.length;
        const bp = this.buildPoints[idx];
        this.cloud = { gx: bp.gx, gy: bp.gy, until: now + SPORE_DUR };
        this.nextCloudAt = now + SPORE_PERIOD;
        this.toasts.push('Споры!');
      }
    }
    // Ветер: тост один раз за забег.
    if (this.biomeId === 4 && this.wind && !this.windAnnounced) {
      this.windAnnounced = true;
      this.toasts.push('Ветер!');
    }
    // Пузыри: тост при первой пострадавшей башне.
    if (this.biomeId === 5 && !this.bubbleAnnounced) {
      for (const id of world.query('Tower', 'GridPos')) {
        const p = world.getComponent<{ gx: number; gy: number }>(id, 'GridPos');
        if (p && this.inBubble(p.gx, p.gy)) {
          this.bubbleAnnounced = true;
          this.toasts.push('Пузыри!');
          break;
        }
      }
    }
    // Карнавал биома 6: каждые 40 c танец 3 c, затем бафф ×1.5 на 5 c.
    if (this.biomeId === 6) {
      if (this.dance && now >= this.dance.buffUntil) this.dance = null;
      if (!this.dance && now >= this.nextDanceAt) {
        const towers = world.query('Tower', 'GridPos');
        if (towers.length > 0) {
          const idx = Math.floor(now / DANCE_PERIOD) % towers.length;
          this.dance = {
            id: towers[idx],
            danceUntil: now + DANCE_DUR,
            buffUntil: now + DANCE_DUR + BUFF_DUR,
          };
          this.nextDanceAt = now + DANCE_PERIOD;
          this.toasts.push('Карнавал!');
        } else {
          this.nextDanceAt = now + DANCE_PERIOD;
        }
      }
    }
  }
}
