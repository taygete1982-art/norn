import { World } from '../ecs/world';
import { ConfigLoader, TierConfig } from './config/ConfigLoader';
import { GameStateManager } from './GameState';

export const MAX_TIER = 3;

const FALLBACK_TIER: TierConfig = {
  damageMul: 1,
  fireRateMul: 1,
  rangeMul: 1,
  upgradeCost: null,
};

/** Конфиг tier'а башни (1-based). Нет конфига — множители 1. */
export function tierConfigOf(towerId: string, tier: number): TierConfig {
  const cfg = ConfigLoader.getTowers().find((t) => t.id === towerId);
  const tiers = cfg?.tiers ?? [];
  if (tiers.length === 0) return FALLBACK_TIER;
  return tiers[Math.min(Math.max(tier, 1), tiers.length) - 1] ?? FALLBACK_TIER;
}

export interface EffectiveStats {
  damage: number;
  /** секунды между выстрелами */
  cooldown: number;
  range: number;
  aoeRadius?: number;
}

/** Эффективные статы из базовых и множителей tier'а. */
export function effectiveStats(
  base: { damage: number; fireRate: number; range: number; aoeRadius?: number },
  tierCfg: TierConfig,
): EffectiveStats {
  const out: EffectiveStats = {
    damage: base.damage * tierCfg.damageMul,
    cooldown: base.fireRate / tierCfg.fireRateMul,
    range: base.range * tierCfg.rangeMul,
  };
  if (base.aoeRadius !== undefined) out.aoeRadius = base.aoeRadius * (tierCfg.aoeMul ?? 1);
  return out;
}

/** Цена перехода tier -> tier+1; null на максимальном. */
export function upgradeCostOf(towerId: string, tier: number): number | null {
  if (tier >= MAX_TIER) return null;
  const cfg = ConfigLoader.getTowers().find((t) => t.id === towerId);
  return cfg?.tiers?.[tier]?.upgradeCost ?? null;
}

/** Выкуп: 70% вложенного, округление вниз. */
export function sellValue(spent: number): number {
  return Math.floor(spent * 0.7);
}

/** Апгрейд: списать золото, tier+1. false — нет золота или уже максимум. */
export function applyUpgrade(world: World, towerId: number): boolean {
  const tower = world.getComponent<{ kind: string; tier: number; spent: number }>(
    towerId,
    'Tower',
  );
  if (!tower || tower.tier >= MAX_TIER) return false;
  const cost = upgradeCostOf(tower.kind, tower.tier);
  if (cost === null || !GameStateManager.spendGold(cost)) return false;
  tower.tier += 1;
  tower.spent += cost;
  return true;
}

/** Продажа: вернуть 70%, удалить сущность. Возвращает выплаченную сумму. */
export function sellTower(world: World, towerId: number): number {
  const tower = world.getComponent<{ spent: number }>(towerId, 'Tower');
  if (!tower) return 0;
  const value = sellValue(tower.spent);
  GameStateManager.addGold(value);
  world.removeEntity(towerId);
  return value;
}
