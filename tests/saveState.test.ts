import { describe, test, expect, beforeEach } from 'vitest';
import { GameSaveState } from '../src/state/saveState';

describe('GameSaveState', () => {
  beforeEach(() => {
    // Setup clean mock localStorage for tests
    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { for (const key in store) delete store[key]; }
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true
    });
  });

  test('should load default values when localStorage is empty', () => {
    const state = new GameSaveState();
    expect(state.totalCores).toBe(0);
    expect(state.shieldLvl).toBe(1);
    expect(state.magnetLvl).toBe(1);
    expect(state.tetherLvl).toBe(1);
  });

  test('should load saved values from localStorage', () => {
    localStorage.setItem('gravity_pivot_cores_v6', '100');
    localStorage.setItem('gravity_pivot_shieldLvl_v6', '3');
    localStorage.setItem('gravity_pivot_magnetLvl_v6', '4');
    localStorage.setItem('gravity_pivot_tetherLvl_v6', '2');

    const state = new GameSaveState();
    expect(state.totalCores).toBe(100);
    expect(state.shieldLvl).toBe(3);
    expect(state.magnetLvl).toBe(4);
    expect(state.tetherLvl).toBe(2);
  });

  test('should guard against negative and non-finite numbers', () => {
    localStorage.setItem('gravity_pivot_cores_v6', '-50');
    localStorage.setItem('gravity_pivot_shieldLvl_v6', 'NaN');
    localStorage.setItem('gravity_pivot_magnetLvl_v6', 'Infinity');
    localStorage.setItem('gravity_pivot_tetherLvl_v6', '0');

    const state = new GameSaveState();
    expect(state.totalCores).toBe(0);
    expect(state.shieldLvl).toBe(1);
    expect(state.magnetLvl).toBe(1);
    expect(state.tetherLvl).toBe(1);
  });

  test('should cap loaded level values to maxUpgradeLevel', () => {
    localStorage.setItem('gravity_pivot_cores_v6', '100');
    localStorage.setItem('gravity_pivot_shieldLvl_v6', '999');
    localStorage.setItem('gravity_pivot_magnetLvl_v6', '12');
    localStorage.setItem('gravity_pivot_tetherLvl_v6', '6');

    const state = new GameSaveState();
    expect(state.shieldLvl).toBe(10);
    expect(state.magnetLvl).toBe(10);
    expect(state.tetherLvl).toBe(6);
  });

  test('should serialize and save values correctly', () => {
    const state = new GameSaveState();
    state.totalCores = 50;
    state.shieldLvl = 10;
    state.magnetLvl = 2;
    state.tetherLvl = 3;
    state.save();

    expect(localStorage.getItem('gravity_pivot_cores_v6')).toBe('50');
    expect(localStorage.getItem('gravity_pivot_shieldLvl_v6')).toBe('10');
    expect(localStorage.getItem('gravity_pivot_magnetLvl_v6')).toBe('2');
    expect(localStorage.getItem('gravity_pivot_tetherLvl_v6')).toBe('3');
  });

  test('should sort, serialize and cap high scores leaderboard to top 5', () => {
    const state = new GameSaveState();
    state.addHighScore(100, 1);
    state.addHighScore(500, 3);
    state.addHighScore(300, 2);
    state.addHighScore(50, 1);
    state.addHighScore(400, 2);
    state.addHighScore(200, 1);

    expect(state.highScores.length).toBe(5);
    expect(state.highScores[0].score).toBe(500);
    expect(state.highScores[1].score).toBe(400);
    expect(state.highScores[2].score).toBe(300);
    expect(state.highScores[3].score).toBe(200);
    expect(state.highScores[4].score).toBe(100);

    const loaded = new GameSaveState();
    expect(loaded.highScores.length).toBe(5);
    expect(loaded.highScores[0].score).toBe(500);
  });

  test('should serialize and validate unlocked skins and active skin ID', () => {
    const state = new GameSaveState();
    state.unlockedSkins = [0, 1, 2];
    state.activeSkinId = 2;
    state.save();

    const loaded = new GameSaveState();
    expect(loaded.unlockedSkins).toEqual([0, 1, 2]);
    expect(loaded.activeSkinId).toBe(2);
  });

  test('should initialize and serialize daily best scores correctly', () => {
    const state = new GameSaveState();
    const isNew = state.updateDailyBest(120);
    expect(isNew).toBe(true);
    expect(state.dailyBest).toBe(120);
    expect(state.dailyBestDate).toBe(new Date().toDateString());

    const isBetter = state.updateDailyBest(90);
    expect(isBetter).toBe(false);
    expect(state.dailyBest).toBe(120);

    const isDoubleBetter = state.updateDailyBest(150);
    expect(isDoubleBetter).toBe(true);
    expect(state.dailyBest).toBe(150);

    const loaded = new GameSaveState();
    expect(loaded.dailyBest).toBe(150);
    expect(loaded.dailyBestDate).toBe(new Date().toDateString());
  });

  test('should reset daily best when date shifts', () => {
    localStorage.setItem('gravity_pivot_dailyBest_v6', '350');
    localStorage.setItem('gravity_pivot_dailyBestDate_v6', 'Mon Jan 01 2026');

    const state = new GameSaveState();
    expect(state.dailyBest).toBe(0);
    expect(state.dailyBestDate).toBe(new Date().toDateString());
  });
});
