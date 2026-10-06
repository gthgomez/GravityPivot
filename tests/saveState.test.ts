import { beforeEach, describe, expect, test, vi } from 'vitest';
import { SAVE_KEY, SaveV7 } from '../src/state/saveSchema';
import { GameSaveState } from '../src/state/saveState';

describe('GameSaveState v7', () => {
  let store: Record<string, string>;
  let setItem: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = {};
    setItem = vi.fn((key: string, value: string) => {
      store[key] = value;
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem,
        removeItem: (key: string) => delete store[key],
        clear: () => {
          store = {};
        },
      },
      writable: true,
      configurable: true,
    });
  });

  test('writes one complete default blob when storage is empty', () => {
    const state = new GameSaveState();
    expect(state.totalCores).toBe(0);
    expect(state.upgrades).toEqual({ shield: 1, magnet: 1, tether: 1 });
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(
      SAVE_KEY,
      expect.stringContaining('"version":7'),
    );
  });

  test('migrates valid legacy balances, scores, skins, and Daily v1 records once', () => {
    store.gravity_pivot_cores_v6 = '100';
    store.gravity_pivot_shieldLvl_v6 = '3';
    store.gravity_pivot_magnetLvl_v6 = '4';
    store.gravity_pivot_tetherLvl_v6 = '2';
    store.gravity_pivot_highScores_v6 = JSON.stringify([
      { score: 100, sector: 2, date: 'Oct 6' },
    ]);
    store.gravity_pivot_unlockedSkins_v6 = '[0,1,2]';
    store.gravity_pivot_activeSkinId_v6 = '2';
    store.gravity_pivot_dailyBest_v6 = '999';
    store.gravity_pivot_dailyBestDate_v6 = new Date().toDateString();
    store.gravity_pivot_dailyChallengeRecords_v1 = JSON.stringify({
      'v1:2026-10-06': 120,
    });

    const state = new GameSaveState();
    expect(state.totalCores).toBe(100);
    expect(state.upgrades).toEqual({ shield: 3, magnet: 4, tether: 2 });
    expect(state.highScores).toEqual([
      { score: 100, sector: 2, date: 'Oct 6' },
    ]);
    expect(state.unlockedSkins).toEqual([0, 1, 2]);
    expect(state.activeSkinId).toBe(2);
    expect(state.getDailyChallengeBest('2026-10-06', 1)).toBe(120);
    expect(state.getDailyChallengeBest('2026-10-06', 0)).toBe(0);
    expect(JSON.parse(store[SAVE_KEY]).dailyRecords).toEqual({
      '2026-10-06@1': 120,
    });
    expect(store.gravity_pivot_cores_v6).toBe('100');
    expect(store.gravity_pivot_dailyBest_v6).toBe('999');
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  test('repairs negative, fractional, nonfinite, invalid score and skin values', () => {
    store.gravity_pivot_cores_v6 = '-50';
    store.gravity_pivot_shieldLvl_v6 = '1.5';
    store.gravity_pivot_magnetLvl_v6 = 'Infinity';
    store.gravity_pivot_tetherLvl_v6 = '999';
    store.gravity_pivot_highScores_v6 = JSON.stringify([
      { score: -1, sector: 1, date: 'bad' },
      { score: 20.5, sector: 2, date: 'bad' },
      { score: 30, sector: 1, date: 'valid' },
      { score: Number.MAX_SAFE_INTEGER + 1, sector: 3, date: 'bad' },
    ]);
    store.gravity_pivot_unlockedSkins_v6 = '[1,1,55,-1,"2"]';
    store.gravity_pivot_activeSkinId_v6 = '2';

    const state = new GameSaveState();
    expect(state.totalCores).toBe(0);
    expect(state.upgrades).toEqual({ shield: 1, magnet: 1, tether: 10 });
    expect(state.highScores).toEqual([{ score: 30, sector: 1, date: 'valid' }]);
    expect(state.unlockedSkins).toEqual([0, 1]);
    expect(state.activeSkinId).toBe(0);
  });

  test('backs up malformed current data before repairing it', () => {
    const damaged = '{broken';
    store[SAVE_KEY] = damaged;
    const state = new GameSaveState();
    expect(state.totalCores).toBe(0);
    expect(store.gravity_pivot_save_corrupt_backup).toBe(damaged);
    expect(JSON.parse(store[SAVE_KEY]).version).toBe(7);
  });

  test('backs up and repairs invalid fields in a current v7 blob', () => {
    const invalid: SaveV7 = {
      version: 7,
      totalCores: -12,
      upgrades: { shield: 1.5, magnet: 2, tether: 3 },
      highScores: [{ score: -1, sector: 1, date: 'invalid' }],
      skins: { unlockedIds: [1, 1, 99], activeId: 99 },
      preferences: { muted: false, reducedMotion: false },
      dailyRecords: { '2026-10-06@1': -50 },
    };
    store[SAVE_KEY] = JSON.stringify(invalid);
    const state = new GameSaveState();

    expect(state.totalCores).toBe(0);
    expect(state.upgrades).toEqual({ shield: 1, magnet: 2, tether: 3 });
    expect(state.highScores).toEqual([]);
    expect(state.unlockedSkins).toEqual([0, 1]);
    expect(state.activeSkinId).toBe(0);
    expect(state.getDailyChallengeBest('2026-10-06', 1)).toBe(0);
    expect(store.gravity_pivot_save_corrupt_backup).toBe(
      JSON.stringify(invalid),
    );
  });

  test('does not replace corrupt data when a backup cannot be written', () => {
    const damaged = '{broken';
    store[SAVE_KEY] = damaged;
    setItem.mockImplementation((key: string, value: string) => {
      if (key.includes('corrupt_backup')) throw new Error('quota denied');
      store[key] = value;
    });
    const state = new GameSaveState();
    expect(state.totalCores).toBe(0);
    expect(store[SAVE_KEY]).toBe(damaged);
    state.awardCores(5);
    expect(state.totalCores).toBe(5);
    expect(store[SAVE_KEY]).toBe(damaged);
  });

  test('failed migration writes keep v6 source keys and gameplay available', () => {
    store.gravity_pivot_cores_v6 = '45';
    setItem.mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const state = new GameSaveState();
    expect(state.totalCores).toBe(45);
    expect(store.gravity_pivot_cores_v6).toBe('45');
    expect(state.awardCores(2)).toBe(47);
  });

  test('leaves unsupported future saves byte-for-byte untouched', () => {
    const future = JSON.stringify({
      version: 8,
      totalCores: 12345,
      extra: true,
    });
    store[SAVE_KEY] = future;
    const state = new GameSaveState();
    state.awardCores(10);
    expect(state.totalCores).toBe(10);
    expect(store[SAVE_KEY]).toBe(future);
    expect(setItem).not.toHaveBeenCalled();
  });

  test('remains playable when storage access or writes are denied', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => {
          throw new Error('storage blocked');
        },
        setItem: () => {
          throw new Error('storage blocked');
        },
      },
      writable: true,
      configurable: true,
    });
    const state = new GameSaveState();
    expect(state.purchaseUpgrade('shield')).toBe(false);
    expect(state.awardCores(10)).toBe(10);
  });

  test('exposes copied readonly snapshots rather than mutable save internals', () => {
    const state = new GameSaveState();
    state.awardCores(100);
    state.addHighScore(100, 1);
    const upgrades = state.upgrades as { shield: number };
    upgrades.shield = 10;
    const scores = state.highScores as Array<{
      score: number;
      sector: number;
      date: string;
    }>;
    scores[0].score = 9999;
    const skins = state.unlockedSkins as number[];
    skins.push(2);
    const snapshot = state.getSnapshot();
    snapshot.upgrades.shield = 9;
    snapshot.skins.unlockedIds.push(3);

    expect(state.upgrades.shield).toBe(1);
    expect(state.highScores[0].score).toBe(100);
    expect(state.unlockedSkins).toEqual([0]);
  });

  test('records top five valid Standard scores', () => {
    const state = new GameSaveState();
    for (const score of [100, 500, 300, 50, 400, 200]) {
      state.addHighScore(score, 1);
    }
    expect(state.highScores.map((score) => score.score)).toEqual([
      500, 400, 300, 200, 100,
    ]);
    state.addHighScore(Number.NaN, 1);
    state.addHighScore(100, 0);
    expect(state.highScores).toHaveLength(5);
  });

  test('purchase APIs enforce upgrade costs, caps, and skin ownership', () => {
    const state = new GameSaveState();
    expect(state.purchaseUpgrade('shield')).toBe(false);
    state.awardCores(1000);
    expect(state.purchaseUpgrade('shield')).toBe(true);
    expect(state.shieldLvl).toBe(2);
    expect(state.equipSkin(1)).toBe(false);
    expect(state.purchaseNextSkin()).toBe('purchased');
    expect(state.activeSkinId).toBe(1);
    expect(state.equipSkin(0)).toBe(true);
    expect(state.activeSkinId).toBe(0);
    expect(state.equipSkin(99)).toBe(false);
  });

  test('Daily records are challenge and version scoped with 30-day retention', () => {
    const state = new GameSaveState();
    for (let day = 1; day <= 35; day++) {
      const id = new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10);
      state.updateDailyChallengeBest(id, 1, day);
    }
    state.updateDailyChallengeBest('2020-01-01', 1, 77);
    const days = new Set(
      Object.keys(state.dailyRecords).map((key) => key.split('@')[0]),
    );
    expect(days.size).toBe(30);
    expect(state.getDailyChallengeBest('2020-01-01', 1)).toBe(77);
    expect(state.getDailyChallengeBest('2026-02-04', 1)).toBe(35);
    expect(state.getDailyChallengeBest('2026-02-04', 2)).toBe(0);
  });

  test('rejects impossible challenge dates and rules versions', () => {
    const state = new GameSaveState();
    expect(state.updateDailyChallengeBest('2026-02-30', 1, 100)).toBe(false);
    expect(state.updateDailyChallengeBest('2026-10-06', 0, 100)).toBe(false);
    expect(state.getDailyChallengeBest('2026-02-30', 1)).toBe(0);
  });
});
