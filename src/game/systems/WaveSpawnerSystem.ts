import { World } from '../../ecs/world';
import { ConfigLoader, WaveConfig } from '../config/ConfigLoader';
import { EnemyFactory, EnemyType } from '../entities/EnemyFactory';
import { PATH } from './MoveSystem';

export type WaveStatus = 'idle' | 'spawning' | 'completed';

interface SpawnEvent {
  type: EnemyType;
  at: number;
}

/**
 * Спавнер волн. update() сам двигает время мира на dt,
 * чтобы тесты вида update(world, 1.0) работали без ручного тиканья.
 */
export class WaveSpawnerSystem {
  private static waveIndex = 0;
  private static status: WaveStatus = 'idle';
  private static queue: SpawnEvent[] = [];
  private static paused = false;
  /** Волны уровня (setWaves). null — волны из ConfigLoader (дефолт/тесты). */
  private static customWaves: WaveConfig[] | null = null;

  public static reset(): void {
    this.waveIndex = 0;
    this.status = 'idle';
    this.queue = [];
    this.paused = false;
    this.customWaves = null;
  }

  /** Подменить волны волнами уровня. */
  public static setWaves(waves: WaveConfig[]): void {
    this.customWaves = [...waves];
  }

  private static waves(): WaveConfig[] {
    return this.customWaves ?? ConfigLoader.getWaves();
  }

  public static pause(): void {
    this.paused = true;
  }

  public static resume(): void {
    this.paused = false;
  }

  public static getStatus(): WaveStatus {
    return this.status;
  }

  /** Номер текущей волны для HUD (1-based). */
  public static getCurrentWaveNumber(): number {
    const waves = this.waves();
    if (this.status === 'completed') return waves.length;
    return Math.min(this.waveIndex + 1, waves.length);
  }

  public static getTotalWaves(): number {
    return this.waves().length;
  }

  public static startWave(world: World): void {
    if (this.status === 'spawning') return;
    if (this.status === 'completed') return;
    const waves: WaveConfig[] = this.waves();
    if (this.waveIndex >= waves.length) {
      this.status = 'completed';
      return;
    }
    const wave = waves[this.waveIndex];
    const now = world.getCurrentTime();
    this.queue = [];
    for (const spawn of wave.spawns) {
      for (let i = 0; i < spawn.count; i++) {
        this.queue.push({ type: spawn.enemy as EnemyType, at: now + i * spawn.delay });
      }
    }
    this.queue.sort((a, b) => a.at - b.at);
    this.status = 'spawning';
  }

  public static update(world: World, dt: number): void {
    world.updateTime(dt);
    if (this.paused) return;
    if (this.status !== 'spawning') return;

    const now = world.getCurrentTime();
    while (this.queue.length > 0 && this.queue[0].at <= now) {
      const ev = this.queue.shift()!;
      EnemyFactory.create(world, ev.type, PATH[0].gx, PATH[0].gy);
    }

    if (this.queue.length === 0) {
      const alive = world.query('Health', 'Enemy');
      if (alive.length === 0) {
        this.waveIndex += 1;
        const waves = this.waves();
        if (this.waveIndex >= waves.length) {
          this.status = 'completed';
        } else {
          const wave = waves[this.waveIndex];
          const t = world.getCurrentTime();
          this.queue = [];
          for (const spawn of wave.spawns) {
            for (let i = 0; i < spawn.count; i++) {
              this.queue.push({ type: spawn.enemy as EnemyType, at: t + i * spawn.delay });
            }
          }
          this.queue.sort((a, b) => a.at - b.at);
        }
      }
    }
  }
}
