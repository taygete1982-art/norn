import { World } from '../../ecs/world';
import { EnemyFactory, EnemyType } from '../entities/EnemyFactory';

export interface BossEvent {
  kind: 'telegraph';
  /** экранные координаты не здесь — App пересчитает из gx, gy */
  gx: number;
  gy: number;
  radius: number;
  text: string;
}

export interface BossState {
  abilityType: string;
  period: number;
  enemy?: string;
  count?: number;
  radius?: number;
  duration?: number;
  nextAt: number;
  telegraphed: boolean;
  cycleIdx: number;
}

/** Параметры cycle carnivaldirector: summon imp, sleepPulse, frostWave, shieldWave. */
const CYCLE: Array<Partial<BossState> & { abilityType: string }> = [
  { abilityType: 'summon', enemy: 'imp', count: 2 },
  { abilityType: 'sleepPulse', radius: 2.5, duration: 2 },
  { abilityType: 'frostWave', duration: 4 },
  { abilityType: 'shieldWave', duration: 3 },
];

/** Телеграф за 1 c до срабатывания. */
const TELEGRAPH_LEAD = 1;
/** Антиспираль: саммонов живых миньонов больше этого — пропуск. */
const MAX_MINIONS_ALIVE = 30;

/**
 * Боссы биомов. Статика как у EnvironmentSystem: окна frost/shield —
 * мировое время, стан — компонентом Stunned на башне, телеграфы —
 * компонентом Telegraph на боссе + очередь событий для App
 * (кольцо-предупреждение + тост). update() время не двигает.
 */
export class BossSystem {
  private static frostUntil = -1;
  private static shieldUntil = -1;
  private static events: BossEvent[] = [];

  public static reset(): void {
    this.frostUntil = -1;
    this.shieldUntil = -1;
    this.events = [];
  }

  public static isFrosted(world: World): boolean {
    return world.getCurrentTime() < this.frostUntil;
  }

  public static isShielded(world: World): boolean {
    return world.getCurrentTime() < this.shieldUntil;
  }

  /** Множитель кулдаунов башен: ×2 пока активна frostWave. */
  public static frostMult(world: World): number {
    return this.isFrosted(world) ? 2 : 1;
  }

  public static isStunned(world: World, towerId: number): boolean {
    const st = world.getComponent<{ until: number }>(towerId, 'Stunned');
    return !!st && world.getCurrentTime() < st.until;
  }

  public static takeEvent(): BossEvent | null {
    return this.events.shift() ?? null;
  }

  public static update(world: World): void {
    const now = world.getCurrentTime();
    for (const id of world.query('Boss', 'Enemy', 'GridPos', 'Health')) {
      const boss = world.getComponent<BossState>(id, 'Boss');
      const health = world.getComponent<{ hp: number }>(id, 'Health');
      const pos = world.getComponent<{ gx: number; gy: number }>(id, 'GridPos');
      if (!boss || !health || !pos || health.hp <= 0) continue;
      if (now >= boss.nextAt - TELEGRAPH_LEAD && !boss.telegraphed) {
        boss.telegraphed = true;
        world.addComponent(id, 'Telegraph', { until: boss.nextAt });
        this.events.push({
          kind: 'telegraph',
          gx: pos.gx,
          gy: pos.gy,
          radius: boss.abilityType === 'sleepPulse' ? (boss.radius ?? 0) : 0,
          text: this.abilityName(boss),
        });
      }
      if (now >= boss.nextAt) {
        boss.telegraphed = false;
        this.trigger(world, id, boss, pos);
        boss.nextAt = now + boss.period;
      }
    }
  }

  private static abilityName(boss: BossState): string {
    const t = this.effectiveType(boss);
    return t === 'summon'
      ? 'Призывает слуг...'
      : t === 'sleepPulse'
        ? 'Усыпляет башни...'
        : t === 'frostWave'
          ? 'Морозная волна...'
          : 'Щит неуязвимости...';
  }

  private static effectiveType(boss: BossState): string {
    if (boss.abilityType !== 'cycle') return boss.abilityType;
    return CYCLE[boss.cycleIdx % CYCLE.length].abilityType;
  }

  private static trigger(
    world: World,
    id: number,
    boss: BossState,
    pos: { gx: number; gy: number },
  ): void {
    const now = world.getCurrentTime();
    let type = boss.abilityType;
    let params: Partial<BossState> = boss;
    if (type === 'cycle') {
      const step = CYCLE[boss.cycleIdx % CYCLE.length];
      type = step.abilityType;
      params = { ...boss, ...step };
      boss.cycleIdx += 1;
    }
    if (type === 'summon') {
      const alive = world
        .query('Health', 'Enemy')
        .filter(
          (e) =>
            !world.hasComponent(e, 'Boss') &&
            (world.getComponent<{ hp: number }>(e, 'Health')?.hp ?? 0) > 0,
        ).length;
      if (alive >= MAX_MINIONS_ALIVE) return;
      const count = params.count ?? 2;
      for (let i = 0; i < count; i++) {
        EnemyFactory.create(world, (params.enemy ?? 'imp') as EnemyType, pos.gx, pos.gy);
      }
    } else if (type === 'sleepPulse') {
      const radius = params.radius ?? 2.5;
      const until = now + (params.duration ?? 2);
      for (const tid of world.query('Tower', 'GridPos')) {
        const tp = world.getComponent<{ gx: number; gy: number }>(tid, 'GridPos');
        if (!tp || Math.hypot(tp.gx - pos.gx, tp.gy - pos.gy) > radius) continue;
        const cur = world.getComponent<{ until: number }>(tid, 'Stunned');
        if (cur) cur.until = Math.max(cur.until, until);
        else world.addComponent(tid, 'Stunned', { until });
      }
    } else if (type === 'frostWave') {
      this.frostUntil = now + (params.duration ?? 4);
    } else if (type === 'shieldWave') {
      this.shieldUntil = now + (params.duration ?? 3);
    }
    void id;
  }
}
