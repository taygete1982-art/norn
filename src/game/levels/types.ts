import { WaveConfig } from '../config/ConfigLoader';

export interface LevelConfig {
  biomeId: 1 | 2 | 3 | 4 | 5 | 6;
  /** 1-216 */
  levelNumber: number;
  /** всегда 8×12 */
  gridSize: { width: number; height: number };
  /** waypoints от старта к кристаллу */
  path: Array<{ x: number; y: number }>;
  /** точки строительства */
  buildPoints: Array<{ x: number; y: number }>;
  /** массив волн уровня */
  waves: WaveConfig[];
  /** формулы сложности уровня */
  difficulty: { hpMul: number; rewardMul: number; startingGold: number };
  /** активные механики биома (пока только структура) */
  environmentEffects: string[];
  /** уровень-босс или null */
  boss: { type: string } | null;
}

export interface LevelMeta {
  levelNumber: number;
  biomeId: number;
  biomeName: string;
}
