import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world';
import { GameStateManager } from '../game/GameState';
import { ConfigLoader } from '../game/config/ConfigLoader';
import { EnvironmentSystem } from '../game/systems/EnvironmentSystem';
import { BossSystem } from '../game/systems/BossSystem';
import { TowerFactory } from '../game/entities/TowerFactory';
import { EnemyFactory } from '../game/entities/EnemyFactory';
import type { EnemyType } from '../game/entities/EnemyFactory';

// Канон #07 rename-pass: displayName — чистые данные, баланс не тронут.
const ENEMY_NAMES: Record<string, string> = {
  imp: 'Валун-ползун',
  goblin: 'Рунный истукан',
  troll: 'Горгулья-глыба',
  spore: 'Споровый призрак',
  puffling: 'Грибная масса',
  truffle: 'Панцирный жук',
  jelly: 'Осколок мрамора',
  jellymini: 'Осколок-детёныш',
  caramel: 'Смоляной голем',
  chocgolem: 'Голем жилок',
  candyfairy: 'Мраморная оса',
  balloon: 'Пепельный пузырь',
  cloudsheep: 'Туманная овца',
  stormling: 'Грозовой сгусток',
  fluffdragon: 'Сланцевый змей',
  clownfish: 'Рыба-фонарь',
  jellyfish: 'Медуза-светляк',
  seahorse: 'Рифовый страж',
  pearlwhale: 'Левиафан жемчуга',
  clown: 'Масочник',
  juggler: 'Жонглёр костями',
  magician: 'Фокусник без лица',
  elephant: 'Обсидиановый слон',
};

const BOSS_NAMES: Record<string, string> = {
  queenbee: 'Матрица роя',
  mushroomking: 'Владыка склепа',
  cakemonster: 'Голем жилок',
  cloudgiant: 'Сланцевый великан',
  seaking: 'Царь бездны',
  carnivaldirector: 'Директор карнавала',
};

const NEUTRAL = {
  biomeId: 1,
  choco: new Set<string>(),
  bubbles: new Set<string>(),
  wind: null,
  buildPoints: [] as Array<{ gx: number; gy: number }>,
};

describe('rename-pass: displayName и мрачные тосты', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    GameStateManager.reset();
    BossSystem.reset();
    EnvironmentSystem.configure({ ...NEUTRAL });
  });

  it('все 23 врага и 6 боссов имеют displayName из спеки', () => {
    const all = ConfigLoader.getEnemies();
    expect(Object.keys(ENEMY_NAMES)).toHaveLength(23);
    for (const [id, name] of Object.entries(ENEMY_NAMES)) {
      expect(all.find((e) => e.id === id)?.displayName, id).toBe(name);
    }
    for (const [id, name] of Object.entries(BOSS_NAMES)) {
      const boss = all.find((e) => e.id === id);
      expect(boss?.displayName, id).toBe(name);
      expect(boss?.abilities).toContain('boss');
    }
  });

  it('тосты ветра и пузырей — мрачные', () => {
    EnvironmentSystem.configure({ ...NEUTRAL, biomeId: 4, wind: { dx: 1, dy: 0 } });
    EnvironmentSystem.update(world);
    expect(EnvironmentSystem.takeToast()).toBe('Ветер меняет направление...');

    const w2 = new World();
    EnvironmentSystem.configure({ ...NEUTRAL, biomeId: 5, bubbles: new Set(['5,5']) });
    TowerFactory.create(w2, 'arrow', 5, 5);
    EnvironmentSystem.update(w2);
    expect(EnvironmentSystem.takeToast()).toBe('Пузыри замедляют стрельбу...');
  });

  it('тосты способностей боссов — мрачные', () => {
    const cases: Array<[EnemyType, number, string]> = [
      ['queenbee', 11, 'Призывает слуг...'],
      ['mushroomking', 15, 'Усыпляет башни...'],
      ['cakemonster', 21, 'Морозная волна...'],
      ['seaking', 19, 'Щит неуязвимости...'],
    ];
    for (const [id, advance, text] of cases) {
      const w = new World();
      BossSystem.reset();
      EnemyFactory.create(w, id, 4, 4);
      w.updateTime(advance);
      BossSystem.update(w);
      expect(BossSystem.takeEvent()?.text, id).toBe(text);
    }
  });
});
