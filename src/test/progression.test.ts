import { describe, it, expect, beforeEach } from 'vitest';
import { Progression } from '../game/Progression';

async function freshSave(): Promise<void> {
  Progression.resetCache();
  await Progression.save({ levels: {}, totalStars: 0 });
}

describe('Progression (stars, unlocks, save round-trip)', () => {
  beforeEach(async () => {
    await freshSave();
  });

  it('границы звёзд: полный кристалл=3, ровно половина=2, меньше=1', async () => {
    expect((await Progression.recordWin(1, 20, 20)).stars).toBe(3);
    await freshSave();
    expect((await Progression.recordWin(1, 10, 20)).stars).toBe(2);
    await freshSave();
    expect((await Progression.recordWin(1, 9, 20)).stars).toBe(1);
  });

  it('пишется максимум, completed=true, total суммируется', async () => {
    await Progression.recordWin(1, 9, 20);
    expect(await Progression.getStars(1)).toBe(1);
    await Progression.recordWin(1, 20, 20);
    expect(await Progression.getStars(1)).toBe(3);
    // худший результат не затирает лучший
    await Progression.recordWin(1, 5, 20);
    expect(await Progression.getStars(1)).toBe(3);
    await Progression.recordWin(2, 10, 20);
    expect(await Progression.getTotalStars()).toBe(5);
    const data = await Progression.load();
    expect(data.levels[1].completed).toBe(true);
  });

  it('разблокировка цепочкой 1→2→3', async () => {
    expect(await Progression.isUnlocked(1)).toBe(true);
    expect(await Progression.isUnlocked(2)).toBe(false);
    expect(await Progression.isUnlocked(3)).toBe(false);
    await Progression.recordWin(1, 20, 20);
    expect(await Progression.isUnlocked(2)).toBe(true);
    expect(await Progression.isUnlocked(3)).toBe(false);
    await Progression.recordWin(2, 20, 20);
    expect(await Progression.isUnlocked(3)).toBe(true);
  });

  it('save/load round-trip через стаб SDK (перезагрузка = сброс кэша)', async () => {
    await Progression.recordWin(1, 20, 20);
    expect(await Progression.getTotalStars()).toBe(3);
    // «перезагрузка страницы»: кэш падает, стаб SDK отдаёт сохранённое
    Progression.resetCache();
    const data = await Progression.load();
    expect(data.levels[1]).toEqual({ stars: 3, completed: true });
    expect(data.totalStars).toBe(3);
    expect(await Progression.isUnlocked(2)).toBe(true);
  });

  it('битый сейв чинится в пустой', async () => {
    Progression.resetCache();
    const { sdk } = await import('../platform/YandexSDK');
    await sdk.save({ garbage: true } as unknown as object);
    Progression.resetCache();
    const data = await Progression.load();
    expect(data).toEqual({ levels: {}, totalStars: 0 });
  });
});
