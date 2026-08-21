import { DEFAULT_CONFIG } from '../constants';

const STORAGE_KEYS = {
  CORES: 'gravity_pivot_cores_v6',
  SHIELD_LVL: 'gravity_pivot_shieldLvl_v6',
  MAGNET_LVL: 'gravity_pivot_magnetLvl_v6',
  TETHER_LVL: 'gravity_pivot_tetherLvl_v6',
  HIGH_SCORES: 'gravity_pivot_highScores_v6',
  UNLOCKED_SKINS: 'gravity_pivot_unlockedSkins_v6',
  ACTIVE_SKIN_ID: 'gravity_pivot_activeSkinId_v6',
  DAILY_BEST: 'gravity_pivot_dailyBest_v6',
  DAILY_BEST_DATE: 'gravity_pivot_dailyBestDate_v6'
} as const;

export class GameSaveState {
  public totalCores: number = 0;
  public shieldLvl: number = 1;
  public magnetLvl: number = 1;
  public tetherLvl: number = 1;
  public highScores: Array<{ score: number, sector: number, date: string }> = [];
  public unlockedSkins: number[] = [0];
  public activeSkinId: number = 0;
  public dailyBest: number = 0;
  public dailyBestDate: string = '';

  constructor() {
    this.load();
  }

  public save(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CORES, this.totalCores.toString());
      localStorage.setItem(STORAGE_KEYS.SHIELD_LVL, this.shieldLvl.toString());
      localStorage.setItem(STORAGE_KEYS.MAGNET_LVL, this.magnetLvl.toString());
      localStorage.setItem(STORAGE_KEYS.TETHER_LVL, this.tetherLvl.toString());
      localStorage.setItem(STORAGE_KEYS.HIGH_SCORES, JSON.stringify(this.highScores));
      localStorage.setItem(STORAGE_KEYS.UNLOCKED_SKINS, JSON.stringify(this.unlockedSkins));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SKIN_ID, this.activeSkinId.toString());
      localStorage.setItem(STORAGE_KEYS.DAILY_BEST, this.dailyBest.toString());
      localStorage.setItem(STORAGE_KEYS.DAILY_BEST_DATE, this.dailyBestDate);
    } catch (e) {
      // Silent fallback for sandboxed contexts
    }
  }

  public load(): void {
    try {
      const rawCores = localStorage.getItem(STORAGE_KEYS.CORES);
      const rawShield = localStorage.getItem(STORAGE_KEYS.SHIELD_LVL);
      const rawMagnet = localStorage.getItem(STORAGE_KEYS.MAGNET_LVL);
      const rawTether = localStorage.getItem(STORAGE_KEYS.TETHER_LVL);
      const rawHighScores = localStorage.getItem(STORAGE_KEYS.HIGH_SCORES);
      const rawUnlockedSkins = localStorage.getItem(STORAGE_KEYS.UNLOCKED_SKINS);
      const rawActiveSkinId = localStorage.getItem(STORAGE_KEYS.ACTIVE_SKIN_ID);
      const rawDailyBest = localStorage.getItem(STORAGE_KEYS.DAILY_BEST);
      const rawDailyBestDate = localStorage.getItem(STORAGE_KEYS.DAILY_BEST_DATE);

      const parsedCores = rawCores ? parseInt(rawCores, 10) : 0;
      const parsedShield = rawShield ? parseInt(rawShield, 10) : 1;
      const parsedMagnet = rawMagnet ? parseInt(rawMagnet, 10) : 1;
      const parsedTether = rawTether ? parseInt(rawTether, 10) : 1;

      this.totalCores = Number.isFinite(parsedCores) && parsedCores >= 0 ? parsedCores : 0;
      const maxLvl = DEFAULT_CONFIG.maxUpgradeLevel;
      this.shieldLvl = Number.isFinite(parsedShield) && parsedShield > 0 ? Math.min(parsedShield, maxLvl) : 1;
      this.magnetLvl = Number.isFinite(parsedMagnet) && parsedMagnet > 0 ? Math.min(parsedMagnet, maxLvl) : 1;
      this.tetherLvl = Number.isFinite(parsedTether) && parsedTether > 0 ? Math.min(parsedTether, maxLvl) : 1;

      if (rawHighScores) {
        try {
          const parsed = JSON.parse(rawHighScores);
          this.highScores = Array.isArray(parsed) ? parsed : [];
        } catch {
          this.highScores = [];
        }
      } else {
        this.highScores = [];
      }

      if (rawUnlockedSkins) {
        try {
          const parsed = JSON.parse(rawUnlockedSkins);
          this.unlockedSkins = Array.isArray(parsed) ? parsed : [0];
        } catch {
          this.unlockedSkins = [0];
        }
      } else {
        this.unlockedSkins = [0];
      }

      const parsedActiveSkin = rawActiveSkinId ? parseInt(rawActiveSkinId, 10) : 0;
      this.activeSkinId = Number.isFinite(parsedActiveSkin) && parsedActiveSkin >= 0 ? parsedActiveSkin : 0;

      const todayStr = new Date().toDateString();
      const parsedDailyBestVal = rawDailyBest ? parseInt(rawDailyBest, 10) : 0;
      if (rawDailyBestDate === todayStr) {
        this.dailyBest = Number.isFinite(parsedDailyBestVal) && parsedDailyBestVal >= 0 ? parsedDailyBestVal : 0;
        this.dailyBestDate = todayStr;
      } else {
        this.dailyBest = 0;
        this.dailyBestDate = todayStr;
      }
    } catch (e) {
      // Retain defaults on security restriction exceptions
    }
  }

  public addHighScore(score: number, sector: number): void {
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    this.highScores.push({ score: Math.floor(score), sector, date: dateStr });
    this.highScores.sort((a, b) => b.score - a.score);
    this.highScores = this.highScores.slice(0, 5);
    this.save();
  }

  public updateDailyBest(score: number): boolean {
    const todayStr = new Date().toDateString();
    if (this.dailyBestDate !== todayStr) {
      this.dailyBest = 0;
      this.dailyBestDate = todayStr;
    }
    const cleanScore = Math.floor(score);
    if (cleanScore > this.dailyBest) {
      this.dailyBest = cleanScore;
      this.save();
      return true;
    }
    return false;
  }
}
