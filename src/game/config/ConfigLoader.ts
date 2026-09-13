import enemiesJson from './enemies.json'
import towersJson from './towers.json'
import wavesJson from './waves.json'
import economyJson from './economy.json'

export interface BossAbilityConfig {
  type: string
  period: number
  enemy?: string
  count?: number
  radius?: number
  duration?: number
}

export interface EnemyConfig {
  id: string
  hp: number
  speed: number
  reward: number
  damage: number
  abilities: string[]
  splitInto?: { type: string; count: number }
  /** "flat": hp не масштабируется hpMul уровня (только hpOverride спавна) */
  scaling?: string
  bossAbility?: BossAbilityConfig
}

export interface TierConfig {
  damageMul: number
  fireRateMul: number
  rangeMul: number
  upgradeCost: number | null
  aoeMul?: number
}

export interface TowerConfig {
  id: string
  damage: number
  fireRate: number
  range: number
  cost: number
  damageType: string
  tiers: TierConfig[]
  aoeRadius?: number
  slowAmount?: number
  slowDuration?: number
}

export interface WaveSpawnConfig {
  enemy: string
  count: number
  delay: number
  elite?: boolean
  /** спавн босса: hp берётся из hpOverride (flat scaling), не из hpMul */
  boss?: boolean
  hpOverride?: number
}

export interface WaveConfig {
  number: number
  spawns: WaveSpawnConfig[]
}

export interface EconomyConfig {
  startingGold: number
  crystalHP: number
}

export class ConfigLoader {
  private static enemies: EnemyConfig[] = enemiesJson.enemies
  private static towers: TowerConfig[] = towersJson.towers
  private static waves: WaveConfig[] = wavesJson.waves
  private static economy: EconomyConfig = economyJson

  public static getEnemies(): EnemyConfig[] {
    return [...this.enemies]
  }

  public static getTowers(): TowerConfig[] {
    return [...this.towers]
  }

  public static getWaves(): WaveConfig[] {
    return [...this.waves]
  }

  public static getEconomy(): EconomyConfig {
    return { ...this.economy }
  }
}
